/* ===== Радио «Севастополис» ===== */
(function () {
  'use strict';

  /* Каналы. Песни лежат в assets/radio/<id>/, список — src/data/radio-playlist.js
     (создаётся командой python3 tools/radio_playlist.py). Пустой канал — только эфирное шипение,
     при включении радио выбирается ближайший канал с песнями.
     v178: вернули музыку. v179: по решению автора убраны станции «Радио Памяти», «Севастопольский РОК»,
     «ФанКрым FM»; песни СевастопоЛеди и Севастополис FM пережаты в MP3 моно 32 кбит/с. */
  var RT = window.SEV_RADIO_TRACKS || {};
  var CHANNELS = [
    { id: 'krymboom',  name: 'КрымБум FM',           freq: '87.9',  icon: '🌴' },
    { id: 'kids',      name: 'Детская волна',        freq: '90.6',  icon: '🧸' },
    { id: 'ladies',    name: 'СевастопоЛеди',        freq: '93.2',  icon: '🌸' },
    { id: 'sevfm',     name: 'Севастополис FM',      freq: '99.5',  icon: '📻' },
    { id: 'breeze',    name: 'Морской Бриз FM',      freq: '101.4', icon: '⚓' },
    { id: 'fox',       name: 'Fox FM',               freq: '104.8', icon: '🦊' }
  ];
  CHANNELS.forEach(function (c) { c.tracks = RT[c.id] || []; });

  var LS_KEY = 'sevradio';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) {}
  var chIdx = (saved.ch | 0);
  if (chIdx < 0 || chIdx >= CHANNELS.length) chIdx = 0;
  var vol = typeof saved.vol === 'number' ? Math.min(1, Math.max(0, saved.vol)) : 0.8;
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify({ ch: chIdx, vol: vol })); } catch (e) {} }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* порядок песен — строго по порядковому номеру в названии */
  function trackNum(t) { var m = /\d+/.exec(t.title || t.id); return m ? parseInt(m[0], 10) : 1e9; }
  function byNumber(tracks) {
    return tracks.map(function (_, i) { return i; }).sort(function (a, b) {
      var d = trackNum(tracks[a]) - trackNum(tracks[b]);
      if (d) return d;
      return String(tracks[a].title + tracks[a].id) < String(tracks[b].title + tracks[b].id) ? -1 : 1;
    });
  }
  /* состояние каждого канала: порядок песен, позиция, «где мы остановились в эфире» */
  var st = CHANNELS.map(function (c) {
    return { order: byNumber(c.tracks), pos: 0, t: 0, leftAt: 0, started: false };
  });

  /* ---------- разметка ---------- */
  var root = document.createElement('div');
  root.innerHTML =
    '<button id="btnRadio" class="hud__btn rd-btn" type="button" title="Радио" aria-label="Открыть радио" aria-expanded="false">📻</button>' +
    '<section id="radioPanel" class="rd" hidden aria-label="Радио">' +
      '<div class="rd__top">' +
        '<span class="rd__live" id="rdLive"><span class="rd__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span id="rdLiveTxt">В ЭФИРЕ</span></span>' +
        '<span class="rd__sp"></span>' +
        '<button id="rdClose" class="rd__x" type="button" aria-label="Свернуть радио">×</button>' +
      '</div>' +
      '<div class="rd__tune">' +
        '<button id="rdChPrev" class="rd__b" type="button" title="Предыдущий канал" aria-label="Предыдущий канал">◀</button>' +
        '<div class="rd__name"><b id="rdName"></b><small id="rdFreq"></small></div>' +
        '<button id="rdChNext" class="rd__b" type="button" title="Следующий канал" aria-label="Следующий канал">▶</button>' +
      '</div>' +
      '<div class="rd__dial" id="rdDial"><div class="rd__needle" id="rdNeedle"></div></div>' +
      '<div class="rd__now"><span id="rdTitle"></span><span id="rdTime"></span></div>' +
      '<div class="rd__bar"><i id="rdFill"></i></div>' +
      '<div class="rd__ctrl">' +
        '<button id="rdPrev" class="rd__b" type="button" title="Предыдущая песня" aria-label="Предыдущая песня">⏮</button>' +
        '<button id="rdPlay" class="rd__b rd__b--play" type="button" aria-label="Пауза или воспроизведение">⏸</button>' +
        '<button id="rdNext" class="rd__b" type="button" title="Следующая песня" aria-label="Следующая песня">⏭</button>' +
        '<label class="rd__vol"><span aria-hidden="true">🔈</span><input id="rdVol" type="range" min="0" max="100" step="1" aria-label="Громкость радио"></label>' +
      '</div>' +
    '</section>';
  while (root.firstChild) document.body.appendChild(root.firstChild);

  function $(id) { return document.getElementById(id); }
  var btn = $('btnRadio'), panel = $('radioPanel'), dial = $('rdDial');
  var elName = $('rdName'), elFreq = $('rdFreq'), elTitle = $('rdTitle'), elTime = $('rdTime'), elFill = $('rdFill');
  var elPlay = $('rdPlay'), elPrev = $('rdPrev'), elNext = $('rdNext'), elVol = $('rdVol');
  var elLive = $('rdLive'), elLiveTxt = $('rdLiveTxt'), elNeedle = $('rdNeedle');
  elVol.value = Math.round(vol * 100);

  /* кнопки станций на «шкале» */
  dial.style.setProperty('--n', CHANNELS.length);
  var stBtns = CHANNELS.map(function (c, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'rd__st'; b.textContent = c.icon;
    b.title = c.name; b.setAttribute('aria-label', c.name);
    b.addEventListener('click', function () { selectChannel(i); });
    dial.insertBefore(b, elNeedle);
    return b;
  });

  /* чтобы касания по радио не двигали камеру/персонажа */
  [btn, panel].forEach(function (el) {
    ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(function (ev) {
      el.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
    });
  });

  /* ---------- звук ---------- */
  var audio = new Audio();
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  audio.volume = vol;

  var wantPlay = false, loadedKey = '', loadTok = 0, errCount = 0, hiddenPaused = false;

  function ch() { return CHANNELS[chIdx]; }
  function hasTracks() { return ch().tracks.length > 0; }
  function curTrack() { var s = st[chIdx], c = ch(); return c.tracks.length ? c.tracks[s.order[s.pos]] : null; }
  function keyOf() { var t = curTrack(); return t ? chIdx + ':' + t.id : ''; }
  function srcFor(t) { return t.src || (window.RADIO_AUDIO && window.RADIO_AUDIO[t.id]) || ('radio/' + t.id + '.m4a'); }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* шум настройки приёмника */
  var actx = null, noiseBuf = null;
  function audioCtx() {
    if (actx) return actx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      actx = new AC();
      var len = actx.sampleRate * 2;
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { actx = null; }
    return actx;
  }
  /* звук переключения: щелчок ручки, шипение со свистом, щелчок «поймали станцию».
     steps — сколько станций пролетели по шкале (на каждую — короткий всплеск эфира) */
  function click(c, t, f, v) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.03);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.05);
  }
  function playStatic(sec, steps) {
    var c = audioCtx(); if (!c || vol <= 0) return;
    steps = Math.max(1, Math.min(4, steps || 1));
    try {
      if (c.state === 'suspended') c.resume();
      var t = c.currentTime, peak = 0.05 + 0.3 * vol;
      sec = Math.max(sec, 0.45 + 0.13 * steps);
      click(c, t, 900, 0.05 + 0.1 * vol);                       /* щелчок ручки */
      var src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      var seg = (sec - 0.1) / steps, k;
      for (k = 0; k < steps; k++) {                             /* проскакиваем станции */
        var t0 = t + 0.05 + k * seg;
        var f0 = 700 + Math.random() * 900, f1 = 1800 + Math.random() * 2400;
        bp.frequency.setValueAtTime(f0, t0);
        bp.frequency.exponentialRampToValueAtTime(f1, t0 + seg * 0.6);
        bp.frequency.exponentialRampToValueAtTime(f0, t0 + seg);
        g.gain.exponentialRampToValueAtTime(peak, t0 + seg * 0.25);
        g.gain.exponentialRampToValueAtTime(peak * 0.25, t0 + seg * 0.8);
        var o = c.createOscillator(), og = c.createGain();      /* свист несущей */
        o.type = 'sine';
        o.frequency.setValueAtTime(400 + Math.random() * 300, t0);
        o.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 800, t0 + seg * 0.5);
        o.frequency.exponentialRampToValueAtTime(500, t0 + seg);
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(0.025 + 0.06 * vol, t0 + seg * 0.4);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + seg);
        o.connect(og); og.connect(c.destination); o.start(t0); o.stop(t0 + seg + 0.02);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(t); src.stop(t + sec + 0.05);
      click(c, t + sec - 0.05, 1500, 0.04 + 0.08 * vol);        /* «поймали» станцию */
    } catch (e) {}
  }

  var fadeTimer = 0;
  function fadeIn(ms) {
    clearInterval(fadeTimer);
    var t0 = performance.now();
    audio.volume = 0;
    fadeTimer = setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / ms);
      audio.volume = vol * k;
      if (k >= 1) clearInterval(fadeTimer);
    }, 40);
  }

  function onPlayBlocked(e) {
    if (e && (e.name === 'AbortError')) return;      /* трек сменили — это не ошибка */
    wantPlay = false; updateState();
  }

  function loadAndPlay(offset) {
    var t = curTrack(); if (!t) return;
    var tok = ++loadTok;
    loadedKey = keyOf();
    audio.src = srcFor(t);
    if (offset > 0) {
      var seek = function () {
        audio.removeEventListener('loadedmetadata', seek);
        if (tok !== loadTok) return;
        if (!isFinite(audio.duration) || offset < audio.duration - 1) { try { audio.currentTime = offset; } catch (e) {} }
      };
      audio.addEventListener('loadedmetadata', seek);
    }
    var p = audio.play();
    if (p && p.catch) p.catch(onPlayBlocked);
    renderTrack(); updateState();
  }

  /* «прошло время, пока слушали другой канал» — эфир не стоит на месте */
  function catchUp(c, s, sec) {
    var n = c.tracks.length, total = 0, i;
    for (i = 0; i < n; i++) total += c.tracks[i].dur;
    sec = sec % total;
    var t = s.t + sec, d = c.tracks[s.order[s.pos]].dur;
    while (t >= d) { t -= d; s.pos = (s.pos + 1) % n; d = c.tracks[s.order[s.pos]].dur; }
    if (d - t < 3) { s.pos = (s.pos + 1) % n; t = 0; }
    s.t = t;
  }

  function leave() {
    var s = st[chIdx];
    if (!hasTracks() || !s.started) return;
    if (loadedKey && loadedKey.indexOf(chIdx + ':') === 0) s.t = audio.currentTime || 0;
    s.leftAt = wantPlay ? Date.now() : 0;
  }

  function tuneIn(withStatic, steps) {
    var c = ch(), s = st[chIdx];
    clearInterval(fadeTimer);
    if (!c.tracks.length) {                         /* пустой канал: только шипение */
      audio.pause(); loadedKey = ''; loadTok++;
      if (withStatic) playStatic(1.8, steps);
      renderTrack(); updateState();
      return;
    }
    errCount = 0;
    if (!s.started) { s.started = true; s.pos = 0; s.t = 0; s.leftAt = 0; }
    else if (s.leftAt) { catchUp(c, s, (Date.now() - s.leftAt) / 1000); s.leftAt = 0; }
    if (withStatic) playStatic(0.75, steps);
    var off = s.t; s.t = 0;
    loadAndPlay(off);
    fadeIn(withStatic ? 750 : 250);
  }

  function selectChannel(i) {
    i = (i + CHANNELS.length) % CHANNELS.length;
    if (i === chIdx && wantPlay) return;
    leave();
    var d = Math.abs(i - chIdx), steps = Math.min(d, CHANNELS.length - d) || 1;
    chIdx = i; save();
    wantPlay = true;
    renderChannel();
    tuneIn(true, steps);
  }

  function step(dir, auto) {
    var s = st[chIdx], n = ch().tracks.length;
    if (!n) return;
    s.started = true; s.pos = (s.pos + dir + n) % n; s.t = 0; s.leftAt = 0;
    wantPlay = true;
    loadAndPlay(0);
    if (auto) audio.volume = vol; else fadeIn(250);
  }

  function togglePlay() {
    if (wantPlay) {
      wantPlay = false;
      if (hasTracks()) { st[chIdx].t = audio.currentTime || 0; }
      st[chIdx].leftAt = 0;
      audio.pause(); updateState();
      return;
    }
    wantPlay = true;
    if (hasTracks() && loadedKey && loadedKey === keyOf() && !audio.ended) {
      audio.volume = vol;
      var p = audio.play(); if (p && p.catch) p.catch(onPlayBlocked);
      updateState();
    } else {
      tuneIn(true);
    }
  }

  audio.addEventListener('ended', function () { if (wantPlay) { errCount = 0; step(1, true); } });
  audio.addEventListener('error', function () {
    if (!wantPlay || !hasTracks()) return;
    errCount++;
    if (errCount >= ch().tracks.length) { wantPlay = false; errCount = 0; updateState(); elTitle.textContent = 'Не удалось запустить эфир'; return; }
    step(1, true);
  });
  audio.addEventListener('timeupdate', function () {
    var d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (curTrack() ? curTrack().dur : 0);
    elFill.style.width = d ? Math.min(100, audio.currentTime / d * 100) + '%' : '0';
    elTime.textContent = d ? fmt(audio.currentTime) + ' / ' + fmt(d) : '';
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (wantPlay && !audio.paused) { hiddenPaused = true; audio.pause(); }
    } else if (hiddenPaused) {
      hiddenPaused = false;
      if (wantPlay) { var p = audio.play(); if (p && p.catch) p.catch(onPlayBlocked); }
    }
  });

  /* ---------- интерфейс ---------- */
  function renderChannel() {
    var c = ch();
    elName.textContent = c.name;
    elFreq.textContent = 'FM ' + c.freq;
    stBtns.forEach(function (b, i) { b.classList.toggle('on', i === chIdx); });
    elNeedle.style.transform = 'translateX(' + (chIdx * 100) + '%)';
    var has = c.tracks.length > 0;
    elPrev.disabled = elNext.disabled = !has;
    renderTrack();
  }
  function renderTrack() {
    var t = curTrack();
    if (!t) {
      elTitle.textContent = 'Скоро в эфире…';
      elTime.textContent = ''; elFill.style.width = '0';
    } else {
      elTitle.textContent = t.title;
      elTime.textContent = fmt(0) + ' / ' + fmt(t.dur); elFill.style.width = '0';
    }
    setMeta();
  }
  function setMeta() {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    var t = curTrack();
    try {
      navigator.mediaSession.metadata = t ? new MediaMetadata({ title: t.title, artist: ch().name, album: 'Севастополис' }) : null;
    } catch (e) {}
  }
  function updateState() {
    var playing = wantPlay && hasTracks();
    panel.classList.toggle('rd--on', playing);
    btn.classList.toggle('hud__btn--on', playing);
    elPlay.textContent = wantPlay ? '⏸' : '▶';
    elLive.classList.toggle('off', !playing);
    elLiveTxt.textContent = playing ? 'В ЭФИРЕ' : (wantPlay ? 'НЕТ СИГНАЛА' : 'ПАУЗА');
    /* пока играет радио, фоновая музыка игры уступает место */
    window.__radioOn = playing;
    if (window.__sevAmbientSync) { try { window.__sevAmbientSync(); } catch (e) {} }
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch (e) {} }
  }
  function openPanel(open) {
    panel.hidden = !open; btn.hidden = open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* true — радио включил заезд на транспорте; false — игрок сам (кнопкой) */
  var rideStarted = false;
  function ensureTracks() {
    if (hasTracks()) return;                        /* пустой канал → ближайший с песнями */
    for (var k = 0; k < CHANNELS.length; k++) {
      if (CHANNELS[k].tracks.length) { chIdx = k; save(); renderChannel(); break; }
    }
  }

  var autoScene = false;                            /* радио включил вход в локацию города */
  btn.addEventListener('click', function () {
    rideStarted = false; autoScene = false;
    ensureTracks();
    openPanel(true);
    if (!wantPlay) { wantPlay = true; tuneIn(true); }
  });
  /* любое действие игрока на панели делает радио «его»: посадка/высадка с транспорта его не выключит */
  panel.addEventListener('click', function () { rideStarted = false; autoScene = false; });

  /* локация города (3D-сцена) → играет радио; общие карты Крыма и городов → фоновая музыка */
  function sceneMode(on) {
    if (on) {
      if (wantPlay) return;                         /* уже играет — не трогаем */
      ensureTracks();
      autoScene = true; wantPlay = true; tuneIn(true);
    } else if (autoScene) {
      autoScene = false;
      if (wantPlay) { leave(); wantPlay = false; audio.pause(); clearInterval(fadeTimer); }
      openPanel(false);
      updateState();                                /* вернёт фоновую музыку карты */
    }
  }
  try {
    new MutationObserver(function () { sceneMode(document.body.dataset.mode === 'scene'); })
      .observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
  } catch (e) {}
  $('rdClose').addEventListener('click', function () { openPanel(false); });
  $('rdChPrev').addEventListener('click', function () { selectChannel(chIdx - 1); });
  $('rdChNext').addEventListener('click', function () { selectChannel(chIdx + 1); });
  elPrev.addEventListener('click', function () { step(-1); });
  elNext.addEventListener('click', function () { step(1); });
  elPlay.addEventListener('click', togglePlay);
  elVol.addEventListener('input', function () {
    vol = elVol.value / 100; audio.volume = vol; clearInterval(fadeTimer); save();
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', function () { if (!wantPlay) togglePlay(); });
      navigator.mediaSession.setActionHandler('pause', function () { if (wantPlay) togglePlay(); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { step(1); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { step(-1); });
    } catch (e) {}
  }

  /* транспорт: сел — радио включается само (если игрок его не включил), слез — выключается только
     то радио, которое включил транспорт. Если радио включил сам игрок кнопкой — оно играет дальше. */
  function ride(on) {
    document.body.classList.toggle('radio-ride', !!on);
    if (on) {
      if (wantPlay) return;                         /* уже играет — не трогаем */
      ensureTracks();
      rideStarted = true;
      openPanel(true);
      wantPlay = true; tuneIn(true);
    } else if (rideStarted) {
      rideStarted = false;
      if (wantPlay) { leave(); wantPlay = false; audio.pause(); clearInterval(fadeTimer); }
      openPanel(false);
      updateState();                                /* вернёт фоновую музыку */
    }
  }
  window.__sevRide = ride;

  renderChannel(); updateState();
  window.SevRadio = { ride: ride, channels: CHANNELS, select: selectChannel, next: function () { step(1); }, prev: function () { step(-1); }, toggle: togglePlay };
})();
