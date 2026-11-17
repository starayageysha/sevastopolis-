/* ===== Севастополис v179: страховка и диагностика =====
   1) Резервная копия прогресса: при первом запуске новой версии все ключи сохранений (localStorage, «sev…»)
      копируются в sevbackup:<версия>. Хранятся 3 последние копии. Сами сохранения игры не меняются.
   2) В «Настройках» на заставке: «Сохранить прогресс в файл» / «Загрузить из файла» / «Показывать FPS и ошибки».
   3) Счётчик FPS и ошибок JavaScript: с ?debug или при включённом переключателе.
   Модуль не трогает ядро и другие модули: только читает window.__sevGame и дописывает кнопки в окно настроек.
   Доступ из кода: window.Sev.version, window.Sev.save.{keys, snapshot, backups, exportFile, importData}. */
(function () {
  'use strict';
  var VERSION = 'v185';
  var Sev = window.Sev = window.Sev || {};
  Sev.version = VERSION;

  /* ---------- ошибки (ловим с самого начала, до загрузки ядра) ---------- */
  var errs = [], errN = 0, consoleN = 0;
  function note(msg) { errN++; errs.push(String(msg).slice(0, 160)); if (errs.length > 5) errs.shift(); render(); }
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) { note('Не загрузился файл: ' + (e.target.src || e.target.href)); return; }
    note((e && e.message) || 'ошибка');
  }, true);
  window.addEventListener('unhandledrejection', function (e) { note('Promise: ' + ((e && e.reason && (e.reason.message || e.reason)) || '')); });
  var ce = console.error;
  console.error = function () { consoleN++; try { return ce.apply(console, arguments); } finally { render(); } };
  Sev.errors = function () { return { count: errN, console: consoleN, last: errs.slice() }; };

  /* ---------- сохранения ---------- */
  var BK = 'sevbackup:', KEEP = 3;
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function keys() {
    var s = ls(), out = [];
    if (!s) return out;
    for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf('sev') === 0 && k.indexOf(BK) !== 0 && k !== 'sevdiag') out.push(k); }
    return out.sort();
  }
  function snapshot() { var s = ls(), o = {}; keys().forEach(function (k) { o[k] = s.getItem(k); }); return o; }
  function backups() {
    var s = ls(), out = [];
    if (!s) return out;
    for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf(BK) === 0 && k !== BK + 'version') out.push(k); }
    return out.sort();
  }
  function backup(tag) {
    var s = ls(); if (!s) return null;
    var data = snapshot(); if (!Object.keys(data).length) return null;
    var key = BK + tag + ':' + new Date().toISOString().slice(0, 19);
    try { s.setItem(key, JSON.stringify(data)); } catch (e) { return null; }
    var all = backups(); while (all.length > KEEP) { try { s.removeItem(all.shift()); } catch (e) { break; } }
    return key;
  }
  /* одна копия при первом запуске каждой новой версии */
  (function () {
    var s = ls(); if (!s) return;
    var last = null; try { last = s.getItem(BK + 'version'); } catch (e) {}
    if (last !== VERSION) { backup('before-' + VERSION); try { s.setItem(BK + 'version', VERSION); } catch (e) {} }
  })();

  function fileName() { return 'Sevastopolis-progress-' + new Date().toISOString().slice(0, 10) + '.json'; }
  function exportFile() {
    var body = JSON.stringify({ game: 'Sevastopolis', version: VERSION, date: new Date().toISOString(), keys: snapshot() }, null, 1);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    a.download = fileName(); document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return body.length;
  }
  /* загрузка: сначала копия текущего прогресса, потом запись ключей из файла */
  function importData(obj) {
    if (!obj || obj.game !== 'Sevastopolis' || !obj.keys || typeof obj.keys !== 'object') throw new Error('Это не файл прогресса «Севастополиса»');
    var s = ls(); if (!s) throw new Error('Браузер не даёт сохранять данные');
    backup('before-import');
    var n = 0;
    Object.keys(obj.keys).forEach(function (k) {
      if (k.indexOf('sev') !== 0 || k.indexOf(BK) === 0 || typeof obj.keys[k] !== 'string') return;
      s.setItem(k, obj.keys[k]); n++;
    });
    return n;
  }
  Sev.save = { keys: keys, snapshot: snapshot, backups: backups, backup: backup, exportFile: exportFile, importData: importData };

  /* ---------- счётчик FPS и ошибок ---------- */
  var QS = new URLSearchParams(location.search);
  function diagOn() { try { return QS.has('debug') || localStorage.getItem('sevdiag') === '1'; } catch (e) { return QS.has('debug'); } }
  var pill = null, open = false, timer = 0;
  function render() {
    if (!pill) return;
    var g = window.__sevGame, fps = '';
    try { if (g && g.engine && document.body.dataset.mode === 'scene') fps = 'FPS ' + Math.round(g.engine.getFps()) + ' · '; } catch (e) {}
    pill.textContent = fps + 'ошибок ' + errN + (consoleN ? ' · консоль ' + consoleN : '') + (open && errs.length ? '\n' + errs.join('\n') : '');
    pill.style.background = errN ? 'rgba(170,30,30,.85)' : 'rgba(0,0,0,.55)';
  }
  function mountPill() {
    if (pill || !diagOn()) return;
    pill = document.createElement('div');
    pill.id = 'sevDiag';
    pill.style.cssText = 'position:fixed;z-index:60;right:calc(8px + env(safe-area-inset-right,0px));top:calc(118px + env(safe-area-inset-top,0px));' +
      'max-width:70vw;padding:3px 8px;border-radius:9px;color:#fff;font:600 11px/1.35 system-ui,sans-serif;white-space:pre-wrap;cursor:pointer;user-select:none';
    pill.title = 'Нажмите, чтобы увидеть последние ошибки';
    pill.addEventListener('click', function () { open = !open; render(); });
    document.body.appendChild(pill);
    render(); clearInterval(timer); timer = setInterval(render, 500);
  }
  function unmountPill() { clearInterval(timer); if (pill) { pill.remove(); pill = null; } }

  /* ---------- кнопки в «Настройках» на заставке ---------- */
  function addSettings(pb) {
    if (!pb || pb.querySelector('.sevsave') || !/Настройки/.test(pb.textContent)) return;
    var box = document.createElement('div');
    box.className = 'sevsave';
    box.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px dashed #c9a46a';
    box.innerHTML = '<div><b>💾 Прогресс</b> <small style="opacity:.7">(' + keys().length + ' записей)</small></div>' +
      '<button type="button" class="splash__mt" data-sv="out">Сохранить прогресс в файл</button>' +
      '<button type="button" class="splash__mt" data-sv="in">Загрузить прогресс из файла</button>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" data-sv="diag"> Показывать FPS и ошибки</label>' +
      '<div data-sv="msg" style="margin-top:6px;font-size:12px"></div>' +
      '<input type="file" accept=".json,application/json" data-sv="file" hidden>';
    pb.appendChild(box);
    var msg = box.querySelector('[data-sv=msg]'), file = box.querySelector('[data-sv=file]'), cb = box.querySelector('[data-sv=diag]');
    try { cb.checked = localStorage.getItem('sevdiag') === '1'; } catch (e) {}
    box.querySelector('[data-sv=out]').addEventListener('click', function () {
      try { exportFile(); msg.textContent = 'Файл ' + fileName() + ' сохранён в «Загрузки».'; } catch (e) { msg.textContent = 'Не получилось: ' + e.message; }
    });
    box.querySelector('[data-sv=in]').addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var obj = JSON.parse(r.result);
          if (!confirm('Заменить текущий прогресс прогрессом из файла от ' + String(obj.date || '').slice(0, 10) + '?\nТекущий прогресс сначала будет сохранён в резервную копию.')) return;
          var n = importData(obj); msg.textContent = 'Загружено записей: ' + n + '. Перезапускаю игру…';
          setTimeout(function () { location.reload(); }, 900);
        } catch (e) { msg.textContent = 'Не получилось: ' + e.message; }
      };
      r.readAsText(f);
    });
    cb.addEventListener('change', function () {
      try { localStorage.setItem('sevdiag', cb.checked ? '1' : '0'); } catch (e) {}
      if (cb.checked) mountPill(); else if (!QS.has('debug')) unmountPill();
    });
  }
  function watch() {
    mountPill();
    try {
      new MutationObserver(function () {
        if (document.body.dataset.mode === 'scene') return;   /* в 3D-сцене окна настроек нет — ничего не делаем */
        var pb = document.querySelector('.screen--splash .splash__pb');
        if (pb && pb.childElementCount) addSettings(pb);
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();
