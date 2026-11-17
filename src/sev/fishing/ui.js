/* Севастополис — рыбалка: FishingUI (v185)
   Крупные кнопки для телефона в стиле «Аэро», шкалы, карточка улова, альбом. */
(function () {
  'use strict';
  var F = window.SevFish = window.SevFish || {}, DB = F.DB, C = F.Collection;
  var css = document.createElement('style');
  css.textContent = [
    '.sf-b{font:900 17px Nunito,Arial,sans-serif;color:#fff;padding:12px 22px;border:3px solid #fff;border-radius:999px;background:linear-gradient(180deg,#7fd6ff,#1f86e6 60%,#0d5bb8);box-shadow:0 0 0 2px #0b4fa8,0 6px 16px rgba(0,0,0,.35),inset 0 2px 2px rgba(255,255,255,.7);text-shadow:0 1px 2px rgba(0,30,80,.6);touch-action:none;user-select:none;-webkit-user-select:none}',
    '.sf-b:active{transform:scale(.95)}.sf-y{color:#5a3200;text-shadow:none;background:linear-gradient(180deg,#fff3a6,#ffd21f 55%,#f2a600);box-shadow:0 0 0 2px #e09000,0 6px 16px rgba(0,0,0,.35)}',
    '.sf-r{background:linear-gradient(180deg,#ff9a8a,#e8402a 60%,#b0201a);box-shadow:0 0 0 2px #8a1a10,0 6px 16px rgba(0,0,0,.35)}',
    '#sfFish{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(238px + env(safe-area-inset-bottom,0px));z-index:57}',
    '#sfBar{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:58;display:flex;justify-content:center;align-items:flex-end;gap:10px;pointer-events:none}',
    '#sfBar>*{pointer-events:auto}#sfMain{min-width:170px;min-height:64px;font-size:20px}#sfBait,#sfStop{min-height:52px;font-size:15px;padding:10px 14px}',
    '#sfHud{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:58;width:min(86vw,380px);pointer-events:none;font:800 14px Nunito,Arial,sans-serif;color:#fff;text-align:center;text-shadow:0 1px 3px rgba(0,20,60,.8)}',
    '#sfHud .m{margin-bottom:6px}.sf-bar{position:relative;height:18px;border-radius:999px;border:2px solid #fff;background:rgba(10,50,110,.55);overflow:hidden;margin:4px 0;box-shadow:0 2px 8px rgba(0,0,0,.3)}',
    '.sf-bar i{position:absolute;top:0;bottom:0;left:0;border-radius:999px}.sf-bar .g{background:rgba(80,220,120,.55)}.sf-bar .f{background:linear-gradient(90deg,#7fd6ff,#ffd21f,#ff4a2a)}',
    '.sf-bar .n{width:4px;background:#fff;box-shadow:0 0 6px #fff}.sf-bar .k{font-size:15px;top:-3px;transform:translateX(-50%)}',
    'body:not([data-mode="scene"]) #sfFish,body:not([data-mode="scene"]) #sfBar,body:not([data-mode="scene"]) #sfHud,body:not([data-mode="scene"]) #sfAlbumBtn{display:none!important}',
    '#sfAlbumBtn{position:fixed;z-index:24;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(256px + env(safe-area-inset-bottom,0px));width:46px;height:46px;font-size:23px;border-radius:50%;border:2.5px solid #fff;color:#fff;background:radial-gradient(120% 90% at 50% 8%,#bfeaff 0,#5fc8ff 22%,#1a7fe0 62%,#0b4fa8 100%);box-shadow:0 4px 10px rgba(0,40,110,.45),inset 0 2px 2px rgba(255,255,255,.7)}',
    '.sf-ov{position:fixed;inset:0;z-index:72;display:flex;align-items:center;justify-content:center;background:rgba(0,30,80,.38)}.sf-ov[hidden]{display:none}',
    '.sf-pn{width:min(94vw,460px);max-height:88vh;overflow:auto;padding:14px;background:linear-gradient(180deg,rgba(235,248,255,.98),rgba(195,230,255,.97));border:3px solid #fff;border-radius:24px;box-shadow:0 0 0 3px #1a7fe0,0 14px 34px rgba(0,30,90,.5);font-family:Nunito,Arial,sans-serif;color:#0d3566;text-align:center}',
    '.sf-pn h2{margin:2px 0 6px;color:#0b4fa8}.sf-tag{display:inline-block;padding:2px 10px;border-radius:999px;color:#fff;font:900 12px Nunito,Arial}',
    '.sf-card img{width:150px;height:110px}.sf-big{font:900 24px Nunito,Arial}.sf-row{display:flex;justify-content:center;gap:14px;margin:6px 0;font-weight:800}',
    '.sf-tabs{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px}.sf-tabs button{padding:6px 12px;border-radius:999px;border:2px solid #8fcaf5;background:#fff;font:800 13px Nunito,Arial;color:#0d3566}.sf-tabs button.on{background:#1f86e6;color:#fff;border-color:#fff}',
    '.sf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sf-it{border-radius:16px;border:2px solid #8fcaf5;background:linear-gradient(180deg,#fff,#d9efff);padding:6px 4px;font:800 11px Nunito,Arial;color:#0d3566}',
    '.sf-it img{width:76px;height:56px;display:block;margin:0 auto}.sf-it small{display:block;font-weight:700;opacity:.8}.sf-it.lock{opacity:.75}',
    '.sf-list{text-align:left}.sf-li{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:12px;margin:4px 0;background:#fff;border:2px solid #cfe8fb;font-weight:800}.sf-li.off{opacity:.45;filter:grayscale(1)}.sf-li b{font-size:22px}.sf-li span{flex:1}',
    '.sf-li button{padding:5px 10px;border-radius:999px;border:2px solid #fff;color:#fff;font:800 12px Nunito,Arial;background:linear-gradient(180deg,#7fd6ff,#1f86e6 60%,#0d5bb8)}.sf-li button.eq{background:linear-gradient(180deg,#ffd84a,#f2a600)}'
  ].join('\n');
  document.head.appendChild(css);
  function el(tag, id, cls, html) { var d = document.createElement(tag); if (id) d.id = id; if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  var U = F.UI = {};
  U.fish = el('button', 'sfFish', 'sf-b sf-y', '🎣 Рыбачить'); U.fish.hidden = true;
  U.bar = el('div', 'sfBar'); U.bar.hidden = true;
  U.bait = el('button', 'sfBait', 'sf-b'); U.main = el('button', 'sfMain', 'sf-b sf-y', 'Забросить'); U.stop = el('button', 'sfStop', 'sf-b sf-r', '✖ Убрать');
  U.bar.appendChild(U.bait); U.bar.appendChild(U.main); U.bar.appendChild(U.stop);
  U.hud = el('div', 'sfHud'); U.hud.hidden = true;
  U.albumBtn = el('button', 'sfAlbumBtn', '', '📖'); U.albumBtn.title = 'Рыболовный альбом';
  U.ov = el('div', 'sfOv', 'sf-ov'); U.ov.hidden = true;
  [U.fish, U.bar, U.hud, U.albumBtn, U.ov].forEach(function (x) { document.body.appendChild(x); });
  [U.fish, U.main, U.bait, U.stop].forEach(function (b) { b.type = 'button'; });
  U.ov.addEventListener('click', function (e) { if (e.target === U.ov) U.close(); });

  U.toast = function (h, ms) { var t = document.getElementById('sevToast'); if (t) { t.innerHTML = h; t.classList.add('on'); clearTimeout(U.tt); U.tt = setTimeout(function () { t.classList.remove('on'); }, ms || 2800); } };
  U.baitLabel = function () { var b = C.s.eq.bait, B = DB.baits[b], n = b === 'bread' || b === 'lure' ? '∞' : (C.s.baits[b] || 0); U.bait.textContent = B.e + ' ' + B.n + ' ×' + n; };
  U.status = function (msg) { U.hud.hidden = false; U.hud.innerHTML = '<div class="m">' + msg + '</div>'; };
  U.power = function (p, msg) { U.hud.hidden = false; U.hud.innerHTML = '<div class="m">' + (msg || 'Отпусти, чтобы забросить') + '</div><div class="sf-bar"><i class="f" style="width:' + Math.round(p * 100) + '%"></i></div>'; };
  U.fight = function (m) {
    var z = m.zone(), sc = m.str * 1.15, w = function (v) { return Math.max(0, Math.min(100, v / sc * 100)); };
    U.hud.hidden = false;
    U.hud.innerHTML = '<div class="m">' + (m.burst > 0 ? '💥 Рыба рвётся! Отпусти!' : 'Держи «Тяни», следи за натяжением') + '</div>' +
      '<div>Натяжение лески</div><div class="sf-bar"><i class="g" style="left:' + w(z[0]) + '%;width:' + (w(z[1]) - w(z[0])) + '%"></i><i class="n" style="left:' + w(m.tension) + '%;background:' + (m.tension > z[1] ? '#ff4a2a' : '#fff') + '"></i></div>' +
      '<div>Рыба далеко ↔ близко</div><div class="sf-bar"><i class="k" style="left:' + Math.max(3, Math.min(97, 100 - m.dist)) + '%">🐟</i></div>';
  };
  U.hideHud = function () { U.hud.hidden = true; };

  /* иконки: рисуем рыбу её цветами; неизвестное — силуэт с «?» */
  var icons = {};
  U.icon = function (sp, known) {
    var k = sp.id + (known ? 1 : 0); if (icons[k]) return icons[k];
    var c = document.createElement('canvas'); c.width = 152; c.height = 112; var g = c.getContext('2d');
    g.translate(76, 56);
    if (sp.k === 'fish') {
      var flat = sp.shape === 'flat', h = sp.shape === 'round' ? 34 : flat ? 26 : sp.shape === 'goby' ? 24 : 19;
      var c0 = known ? sp.col[0] : '#22303c', c1 = known ? sp.col[1] : '#22303c';
      g.fillStyle = c1; g.beginPath(); g.moveTo(-38, 0); g.lineTo(-62, -h * .9); g.lineTo(-58, 0); g.lineTo(-62, h * .9); g.closePath(); g.fill();
      if (sp.shape === 'wing' && known) { g.fillStyle = '#4fb3ff'; g.beginPath(); g.ellipse(0, 10, 30, 14, .4, 0, 7); g.fill(); }
      g.fillStyle = c1; g.beginPath(); g.moveTo(-10, -h + 4); g.quadraticCurveTo(4, -h - 16, 18, -h + 6); g.fill();
      var gr = g.createLinearGradient(0, -h, 0, h); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 48, h, 0, 0, 7); g.fill();
      if (known) { g.fillStyle = '#fff'; g.beginPath(); g.arc(30, -h * .25, 7, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(32, -h * .25, 3.6, 0, 7); g.fill();
        if (sp.gold) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; for (var i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-20 + i * 14, -h * .6); g.lineTo(-14 + i * 14, h * .6); g.stroke(); } } }
    } else {
      g.font = '70px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (!known) g.filter = 'brightness(0) opacity(.85)'; g.fillText(sp.e, 0, 6); g.filter = 'none';
    }
    if (!known) { g.fillStyle = '#fff'; g.font = '900 40px Nunito,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 4); }
    return (icons[k] = c.toDataURL());
  };
  function tag(r) { var R = DB.rarity[r]; return '<span class="sf-tag" style="background:' + R.c + '">' + R.n + '</span>'; }
  U.open = function (html) { U.ov.innerHTML = '<div class="sf-pn">' + html + '</div>'; U.ov.hidden = false; };
  U.close = function () { U.ov.hidden = true; U.ov.innerHTML = ''; if (U.onClose) { var f = U.onClose; U.onClose = null; f(); } };

  U.card = function (it, res, extra, onMore) {
    var sp = it.sp, e = C.s.catches[sp.id];
    var h = '<div class="sf-card"><img src="' + U.icon(sp, true) + '"><div class="sf-big">' + sp.n + '</div>' + tag(sp.r) + ' <small>' + DB.kinds[sp.k] + '</small>' +
      '<div class="sf-row"><span>⚖️ ' + it.w + ' кг</span><span>📏 ' + it.l + ' см</span></div>' +
      (res.newSpecies ? '<div style="color:#18a36b;font-weight:900">✨ Новый вид в альбоме!</div>' : '') +
      (res.recordW ? '<div style="color:#e07000;font-weight:900">🏆 Рекорд по весу!</div>' : '') +
      '<div style="font-weight:800">Место: ' + it.place + ' · поймано всего: ' + (e ? e.n : 1) + '</div>' + (extra || '') +
      '<div style="margin-top:10px;display:flex;gap:8px;justify-content:center"><button class="sf-b sf-y" type="button" data-a="more">🎣 Ещё заброс</button><button class="sf-b" type="button" data-a="album">📖 Альбом</button></div></div>';
    U.open(h);
    U.ov.querySelector('[data-a=more]').onclick = function () { U.close(); onMore && onMore(); };
    U.ov.querySelector('[data-a=album]').onclick = function () { U.album('catch'); };
  };

  U.album = function (tab) {
    tab = tab || 'catch'; var s = C.s, h = '<h2>📖 Рыболовный альбом</h2><div class="sf-tabs">' +
      [['catch', 'Улов'], ['gear', 'Снасти'], ['ach', 'Достижения'], ['rival', 'Соревнование']].map(function (t) { return '<button type="button" data-t="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'catch') {
      var known = DB.species.filter(function (x) { return s.catches[x.id]; }).length;
      h += '<div style="font-weight:800;margin-bottom:6px">Открыто ' + known + ' из ' + DB.species.length + ' · всего уловов: ' + s.total + '</div><div class="sf-grid">';
      DB.species.forEach(function (sp) { var e = s.catches[sp.id];
        h += '<div class="sf-it' + (e ? '' : ' lock') + '"><img src="' + U.icon(sp, !!e) + '">' + (e ? sp.n : '???') + '<br>' + tag(sp.r) +
          (e ? '<small>×' + e.n + ' · до ' + e.maxW + ' кг · ' + e.maxL + ' см</small><small>' + e.place + ' · ' + e.date + '</small>' : '<small>' + DB.kinds[sp.k] + '</small>') + '</div>'; });
      h += '</div>';
    } else if (tab === 'gear') {
      h += '<div style="font-weight:800">У тебя ' + ((window.__sevVehicleStore || {}).coins || 0) + ' 🪙</div><div class="sf-list"><b>Удочки</b>';
      DB.rods.forEach(function (r) { var own = s.rods.indexOf(r.id) >= 0, ach = r.unlock && DB.achievements.filter(function (a) { return a.id === r.unlock; })[0];
        h += '<div class="sf-li' + (own ? '' : ' off') + '"><b>' + r.e + '</b><span>' + r.n + '<br><small>скорость ×' + r.reel + ', прочность ×' + r.tough + (own ? '' : ' · откроется: ' + (ach ? ach.n : '')) + '</small></span>' + (own ? '<button type="button" data-eq="rod:' + r.id + '" class="' + (s.eq.rod === r.id ? 'eq' : '') + '">' + (s.eq.rod === r.id ? 'В руках' : 'Взять') + '</button>' : '') + '</div>'; });
      h += '<b>Леска</b>';
      DB.lines.forEach(function (l) { var own = s.lines.indexOf(l.id) >= 0;
        h += '<div class="sf-li"><b>🧵</b><span>' + l.n + '<br><small>выдерживает ' + l.str + '</small></span>' + (own ? '<button type="button" data-eq="line:' + l.id + '" class="' + (s.eq.line === l.id ? 'eq' : '') + '">' + (s.eq.line === l.id ? 'Стоит' : 'Поставить') + '</button>' : '<button type="button" data-buy="line:' + l.id + '">' + l.price + ' 🪙</button>') + '</div>'; });
      h += '<b>Поплавки</b>';
      DB.bobbers.forEach(function (b) { var own = s.bobbers.indexOf(b.id) >= 0, ach = b.unlock && DB.achievements.filter(function (a) { return a.id === b.unlock; })[0];
        h += '<div class="sf-li' + (own ? '' : ' off') + '"><b style="color:' + b.top + '">●</b><span>' + b.n + (own ? '' : '<br><small>откроется: ' + (ach ? ach.n : '') + '</small>') + '</span>' + (own ? '<button type="button" data-eq="bobber:' + b.id + '" class="' + (s.eq.bobber === b.id ? 'eq' : '') + '">' + (s.eq.bobber === b.id ? 'Стоит' : 'Поставить') + '</button>' : '') + '</div>'; });
      h += '<b>Наживка</b>';
      Object.keys(DB.baits).forEach(function (k) { var B = DB.baits[k], n = k === 'bread' ? '∞' : k === 'lure' ? (s.baits.lure ? '∞' : 0) : (s.baits[k] || 0);
        h += '<div class="sf-li' + (k === 'lure' && !s.baits.lure ? ' off' : '') + '"><b>' + B.e + '</b><span>' + B.n + ' ×' + n + '</span>' + (B.price ? '<button type="button" data-buy="bait:' + k + '">+5 за ' + B.price * 5 + ' 🪙</button>' : '') + '</div>'; });
      h += '</div>';
    } else if (tab === 'ach') {
      h += '<div class="sf-list">'; DB.achievements.forEach(function (a) { var d = s.ach[a.id]; h += '<div class="sf-li' + (d ? '' : ' off') + '"><b>' + a.e + '</b><span>' + a.n + '<br><small>' + a.d + (d ? ' · ' + d : '') + '</small></span></div>'; }); h += '</div>';
    } else {
      var r = C.rival(); h += '<div style="font-weight:800">🦝 ' + DB.rival.n + ' вызывает на соревнование! Поймай рыбу тяжелее его рекорда дня.</div><div class="sf-list">';
      r.t.forEach(function (q) { var sp = DB.byId[q.id], e = s.catches[q.id]; h += '<div class="sf-li' + (q.beat ? '' : '') + '"><b>' + (q.beat ? '✅' : '🎯') + '</b><span>' + sp.n + ': у Михалыча ' + q.w + ' кг' + (e ? '<br><small>твой лучший: ' + e.maxW + ' кг</small>' : '') + '</span></div>'; });
      h += '</div><div style="font-weight:800">' + (r.done ? '🏆 Ты победил сегодня!' : 'Награда: 60 🪙 и карбоновая удочка') + '</div>';
    }
    h += '<div style="margin-top:10px"><button class="sf-b" type="button" data-a="x">Закрыть</button></div>';
    U.open(h);
    U.ov.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { U.album(b.dataset.t); }; });
    U.ov.querySelector('[data-a=x]').onclick = U.close;
    U.ov.querySelectorAll('[data-eq]').forEach(function (b) { b.onclick = function () { var p = b.dataset.eq.split(':'); C.s.eq[p[0]] = p[1]; C.save(); if (F.Anim.sc) F.Anim.gear(); U.album('gear'); }; });
    U.ov.querySelectorAll('[data-buy]').forEach(function (b) { b.onclick = function () {
      var p = b.dataset.buy.split(':'), st = window.__sevVehicleStore, price = p[0] === 'line' ? DB.lines.filter(function (l) { return l.id === p[1]; })[0].price : DB.baits[p[1]].price * 5;
      if (!st || st.coins < price) { U.toast('😿 Не хватает монеток'); return; }
      st.coins -= price; try { st._save(); st._emit(); } catch (e) { }
      if (p[0] === 'line') { C.s.lines.push(p[1]); C.s.eq.line = p[1]; } else C.s.baits[p[1]] = (C.s.baits[p[1]] || 0) + 5;
      C.save(); U.baitLabel(); U.album('gear'); }; });
  };
  U.albumBtn.addEventListener('click', function () { U.album('catch'); });
})();
