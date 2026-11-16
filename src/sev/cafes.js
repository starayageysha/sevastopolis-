/* =====================================================================
   Севастополис — кафе-тележки с продавцами и дополнительные ящики с едой
   v181. Классический скрипт: подключается ПОСЛЕ 13-npc-system.js.

   • 9 тележек (Парк Победы, набережная, бухта Омега, остановки ПОР,
     Юмашева, Героев Сталинграда). Возле каждой — продавец-NPC.
   • Подходим ближе 6 м: над тележкой жёлтый пин «купить покушать»,
     внизу кнопка; по нажатию — меню (всё по 5 монеток), еда снимает голод.
   • 48 новых красных ящиков с едой на газонах Парка Победы
     (раньше там не было ни одного) + маячки над ящиками в темноте.
   Babylon в window нет: ядро отдаёт MeshBuilder и материалы через
   window.__sevBJS (одна строка в _crateInit).
   ===================================================================== */
(function () {
  'use strict';
  var PRICE = 5;
  var MENU = [
    { id: 'chebu', e: '🥟', n: 'Чебурек' },
    { id: 'fries', e: '🍟', n: 'Картошка фри' },
    { id: 'corn', e: '🌽', n: 'Кукуруза' },
    { id: 'sushi', e: '🍣', n: 'Суши' },
    { id: 'pizza', e: '🍕', n: 'Пицца' },
    { id: 'cola', e: '🥤', n: 'Кока-кола' },
    { id: 'sprite', e: '🍋', n: 'Спрайт' }
  ];
  // [id, x, z, смотреть на (x,z), название, цвет тележки, продавец]
  var CAFES = [
    ['georgy', 14, -6, 4, -20, 'Кафе «У Георгия»', '#2f8fd8', 'raccoon'],
    ['park-1', -106, -60, -130, -60, 'Кафе «Морской бриз»', '#1fa7c9', 'ducky'],
    ['park-palms', -106, 200, -130, 200, 'Три пальмы', '#18a36b', 'rabbit'],
    ['park-3', -106, 480, -130, 480, 'Кафе «Чайка»', '#e0703a', 'gull'],
    ['omega-palms', -420, -276, -474, -222, 'Три пальмы', '#18a36b', 'octo'],
    ['omega-2', -402, -224, -474, -222, 'Кафе «Омега»', '#2f8fd8', 'robot'],
    ['omega-3', -436, -174, -474, -222, 'Кафе «Круглая бухта»', '#c9456a', 'turtle'],
    ['por', -168, -270, -168, -290, 'Кафе «Октябрьское»', '#e0a020', 'mushroom'],
    ['yumashev', -112, -270, -112, -290, 'Кафе «У Юмашева»', '#7a5cd6', 'raccoon'],
    ['stalingrad', -382, -311, -382, -330, 'Кафе «Сталинград»', '#d8483a', 'ducky']
  ];
  CAFES.forEach(function (c) { c.h = Math.atan2(c[3] - c[1], c[4] - c[2]); });

  /* ---------- 1. Новые ящики с едой в Парке Победы ----------
     Ядро читает window.__sevExtraFood при старте (game.bundle.js). */
  var KINDS = ['fries', 'nuggets', 'pizza', 'cake'];
  window.__sevExtraFood = [[-100, 26], [-42, -102], [46, -44], [63, -96], [40, -130], [37, -56], [84, 5], [-75, -48], [85, -16], [82, 24], [-26, -80], [67, -80], [-88, 260], [-66, 258], [-25, 452], [-42, 690], [-95, 242], [-66, 183], [-27, 81], [-71, 295], [-47, 724], [-59, 163], [-71, 354], [-73, 433], [69, 213], [93, 379], [89, 510], [71, 422], [60, 550], [95, 334], [77, 226], [67, 299], [46, 330], [29, 646], [26, 341], [100, 203], [16, -126], [-5, -81], [-43, -48], [31, -112], [-59, -115], [-51, -140], [29, -91], [46, -116], [-15, -51], [-60, -49], [16, -48], [8, -72]]
    .map(function (p, i) { return [p[0], p[1], KINDS[i % 4]]; });

  /* ---------- 2. Продавцы — жители через SevNPC ---------- */
  var api = window.SevNPC, B = api && api.builders;
  if (api && B) {
    api.action('sevCafe', function (args) { openMenu(args[0]); });
    CAFES.forEach(function (c) {
      var build = B[c[7]] || B.raccoon; if (!build) return;
      var sx = c[1] - Math.sin(c.h) * 1.55, sz = c[2] - Math.cos(c.h) * 1.55;
      try {
        api.register({
          id: 'cafe-' + c[0], name: 'Продавец', title: c[5], scene: 'pobedy', build: build,
          height: 2.3, radius: .5, speed: 0,
          spawn: { x: sx, z: sz, heading: c.h },
          route: [{ x: sx, z: sz, wait: [30, 60], face: c.h }], loop: true,
          dialog: { start: [{ go: 'hi' }], nodes: { hi: { emote: 'wave',
            text: 'Здравствуй! Чебуреки горячие, кукуруза сладкая, а напитки холодные. Всё по ' + PRICE + ' монеток!',
            choices: [{ label: '🍔 Открыть меню', 'do': 'sevCafe:' + c[0] }, { label: 'Спасибо, позже', alt: true }] } } }
        });
      } catch (e) { console.warn('[cafes] продавец', c[0], e); }
    });
  } else console.warn('[cafes] SevNPC.builders не найден — продавцы не добавлены');

  /* ---------- 3. Интерфейс: кнопка и меню ---------- */
  var ui = {};
  function el(tag, id, html) { var d = document.createElement(tag); if (id) d.id = id; if (html) d.innerHTML = html; return d; }
  function store() { return window.__sevVehicleStore; }
  function toast(s) {
    var t = document.getElementById('sevToast');
    if (t) { t.innerHTML = s; t.classList.add('on'); clearTimeout(ui.tt); ui.tt = setTimeout(function () { t.classList.remove('on'); }, 2400); }
    else if (api && api.toast) api.toast(s.replace(/<[^>]+>/g, ' '));
  }
  function initUI() {
    if (ui.ready) return; ui.ready = true;
    ui.btn = el('button', 'sevCafeBtn', '🍔 Купить покушать'); ui.btn.type = 'button'; ui.btn.hidden = true;
    ui.btn.addEventListener('click', function () { if (ui.near) openMenu(ui.near[0]); });
    ui.menu = el('div', 'sevCafe', '<div class="sc-panel"><button class="sc-x" type="button" aria-label="Закрыть">×</button>' +
      '<p class="sc-coins"></p><h2 class="sc-title"></h2><p class="sc-sub">Выбери угощение — всё по ' + PRICE + ' 🪙</p><div class="sc-list"></div>' +
      '<button class="sc-ok" type="button">Закрыть</button></div>');
    ui.menu.hidden = true;
    ui.menu.addEventListener('click', function (ev) { if (ev.target === ui.menu || ev.target.closest('.sc-x,.sc-ok')) closeMenu(); });
    var list = ui.menu.querySelector('.sc-list');
    MENU.forEach(function (m) {
      var b = el('button', null, '<span class="sc-e">' + m.e + '</span><span class="sc-n">' + m.n + '</span><span class="sc-p">' + PRICE + ' 🪙</span>');
      b.type = 'button'; b.className = 'sc-item'; b.dataset.id = m.id;
      b.addEventListener('click', function () { buy(m); });
      list.appendChild(b);
    });
    document.body.appendChild(ui.btn); document.body.appendChild(ui.menu);
  }
  function refreshCoins() {
    var s = store(), c = s ? s.coins : 0;
    ui.menu.querySelector('.sc-coins').textContent = 'У тебя ' + c + ' 🪙';
    [].forEach.call(ui.menu.querySelectorAll('.sc-item'), function (b) { b.classList.toggle('poor', c < PRICE); });
  }
  function openMenu(id) {
    initUI();
    var c = CAFES.filter(function (x) { return x[0] === id; })[0] || ui.near; if (!c) return;
    ui.menu.querySelector('.sc-title').textContent = (/Три пальмы/.test(c[5]) ? '🌴 ' : '☕ ') + c[5];
    refreshCoins(); ui.menu.hidden = false;
  }
  function closeMenu() { if (ui.menu) ui.menu.hidden = true; }
  function buy(m) {
    var s = store();
    if (!s) return;
    if (s.coins < PRICE) { toast('😿 Не хватает монеток<br><small>Нужно ' + PRICE + ' 🪙 — собери их в городе</small>'); return; }
    s.coins -= PRICE; try { s._save(); s._emit && s._emit(); } catch (e) { }
    try { window.__sevSetHunger && window.__sevSetHunger(0); localStorage.setItem('sevHunger', '0'); } catch (e) { }
    refreshCoins();
    toast(m.e + ' Ням-ням! ' + m.n + '<br><small>Лисёнок сыт!</small>');
    var pop = el('div', null, m.e); pop.className = 'sc-pop'; document.body.appendChild(pop);
    setTimeout(function () { pop.remove(); }, 1300);
  }

  /* ---------- 4. 3D: тележки, пины, маячки над ящиками ---------- */
  var S = null; // состояние текущей сцены
  function tools(g) {
    var J = window.__sevBJS; // MeshBuilder, Color3, StandardMaterial, DynamicTexture из ядра
    if (!J || !J.MB) return null;
    var sc = g.scene, MB = J.MB, C3 = J.C3, Mat = J.Mat, DT = J.DT, mats = {}, all = [];
    function col(h) { return C3.FromHexString(h); }
    function mat(h, em) {
      var k = h + (em || 0); if (mats[k]) return mats[k];
      var m = new Mat('cafe-m-' + k, sc); m.diffuseColor = col(h); m.specularColor = new C3(.12, .12, .12);
      m.emissiveColor = col(h).scale(em == null ? .18 : em); return (mats[k] = m);
    }
    function texMat(name, w, h, draw, alpha) {
      var t = new DT('cafe-t-' + name, { width: w, height: h }, sc, false), c = t.getContext();
      c.clearRect(0, 0, w, h); draw(c, w, h); t.update(true); t.hasAlpha = !!alpha;
      var m = new Mat('cafe-tm-' + name, sc); m.diffuseTexture = t; m.emissiveColor = new C3(.55, .55, .55);
      m.specularColor = new C3(0, 0, 0); if (alpha) { m.useAlphaFromDiffuseTexture = true; m.backFaceCulling = false; }
      return m;
    }
    function fin(o, parent, x, y, z, m) { o.isPickable = false; o.parent = parent; o.position.set(x, y, z); if (m) o.material = m; all.push(o); return o; }
    return {
      sc: sc, all: all, mat: mat, texMat: texMat, col: col,
      box: function (n, p, w, h, d, x, y, z, m) { return fin(MB.CreateBox(n, { width: w, height: h, depth: d }, sc), p, x, y, z, m); },
      plane: function (n, p, w, h, x, y, z, m) { return fin(MB.CreatePlane(n, { width: w, height: h, sideOrientation: 2 }, sc), p, x, y, z, m); },
      cylZ: function (n, p, d, len, x, y, z, m) { var o = fin(MB.CreateCylinder(n, { diameter: d, height: len, tessellation: 14 }, sc), p, x, y, z, m); o.rotation.x = Math.PI / 2; return o; },
      cylY: function (n, p, d, len, x, y, z, m) { return fin(MB.CreateCylinder(n, { diameter: d, height: len, tessellation: 14 }, sc), p, x, y, z, m); },
      ball: function (n, p, d, x, y, z, m) { return fin(MB.CreateSphere(n, { diameter: d, segments: 8 }, sc), p, x, y, z, m); },
      node: function (n) { var r = MB.CreateBox(n, { size: .01 }, sc); r.isVisible = false; r.isPickable = false; all.push(r); return r; }
    };
  }
  function signDraw(text, color) {
    return function (c, w, h) {
      c.fillStyle = color; c.fillRect(0, 0, w, h);
      var gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(.5, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var fs = 64; c.font = 'bold ' + fs + 'px Arial';
      while (c.measureText(text).width > w - 50 && fs > 26) { fs -= 4; c.font = 'bold ' + fs + 'px Arial'; }
      c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6; c.fillText(text, w / 2, h / 2 + 3);
    };
  }
  function buildCart(T, c) {
    var root = T.node('cafe-' + c[0]), palms = /Три пальмы/.test(c[5]);
    root.position.set(c[1], 0, c[2]); root.rotation.y = c.h;
    var body = T.mat(c[6], .22), white = T.mat('#f7f3ea', .3), wood = T.mat('#8a5a2b', .15), dark = T.mat('#2b2f36', .1), steel = T.mat('#c9d3db', .25);
    // корпус, столешница, колёса, ручка
    T.box('cafe-body', root, 2.6, 1.0, 1.25, 0, .85, 0, body);
    T.box('cafe-stripe', root, 2.62, .16, 1.27, 0, 1.1, 0, white);
    T.box('cafe-top', root, 2.8, .1, 1.45, 0, 1.4, .05, wood);
    [[-1, -.68], [1, -.68], [-1, .68], [1, .68]].forEach(function (p) { var w = T.cylY('cafe-wheel', root, .75, .16, p[0], .38, p[1], dark); w.rotation.x = Math.PI / 2; });
    T.box('cafe-handle', root, .08, .08, 1.0, 1.55, 1.15, 0, steel);
    // навес на четырёх стойках, полосатый
    [[-1.25, -.6], [1.25, -.6], [-1.25, .65], [1.25, .65]].forEach(function (p) { T.cylY('cafe-pole', root, .08, 1.3, p[0], 2.05, p[1], steel); });
    var aw = T.texMat('aw-' + c[0], 256, 64, function (g, w, h) { for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : c[6]; g.fillRect(i * w / 8, 0, w / 8, h); } });
    var roof = T.box('cafe-awning', root, 3.1, .12, 1.9, 0, 2.75, .05, aw); roof.rotation.x = -.08;
    T.box('cafe-valance', root, 3.1, .28, .05, 0, 2.6, 1.0, aw);
    // вывеска с двух сторон
    var sm = T.texMat('sign-' + c[0], 512, 128, signDraw(c[5], c[6]));
    T.box('cafe-sign-board', root, 2.9, .78, .05, 0, 3.3, 0, T.mat('#ffffff', .4));
    var f = T.plane('cafe-sign', root, 2.8, .7, 0, 3.3, .035, sm); f.rotation.y = Math.PI;
    T.plane('cafe-sign-b', root, 2.8, .7, 0, 3.3, -.035, sm);
    // угощение на прилавке
    T.box('cafe-chebu', root, .42, .1, .26, -.9, 1.5, .25, T.mat('#e8b04a', .25));
    T.cylY('cafe-corn', root, .16, .55, -.35, 1.55, .25, T.mat('#ffd23a', .3)).rotation.z = Math.PI / 2;
    T.cylY('cafe-pizza', root, .55, .05, .25, 1.48, .2, T.mat('#f0a03a', .3));
    T.cylY('cafe-cola', root, .16, .34, .8, 1.62, .35, T.mat('#d8202a', .3));
    T.cylY('cafe-sprite', root, .16, .34, 1.05, 1.62, .35, T.mat('#2bb14a', .3));
    T.box('cafe-fries', root, .2, .26, .12, .55, 1.58, .4, T.mat('#e8402a', .25));
    // столик со стульями рядом
    var tx = 2.6;
    T.cylY('cafe-tbl', root, 1.0, .06, tx, .9, 1.2, white); T.cylY('cafe-tbl-leg', root, .1, .9, tx, .45, 1.2, steel);
    [-1, 1].forEach(function (s) { T.box('cafe-chair', root, .45, .08, .45, tx + s * .85, .5, 1.2, body); T.box('cafe-chair-back', root, .45, .5, .06, tx + s * .85, .78, 1.2 + (s > 0 ? 0 : 0) - .22, body); });
    // «Три пальмы» — три пальмы вокруг тележки
    if (palms) {
      var trunk = T.mat('#8a633d', .15), leaf = T.mat('#2f9a52', .22);
      [[-2.4, -1.4], [-2.9, .6], [2.0, -1.6]].forEach(function (p, i) {
        T.cylY('cafe-palm', root, .3, 4.4, p[0], 2.2, p[1], trunk);
        for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3 + i, lf = T.box('cafe-leaf', root, 2.4, .07, .45, p[0] + Math.cos(a) * 1.0, 4.35, p[1] + Math.sin(a) * 1.0, leaf); lf.rotation.y = -a; lf.rotation.z = -.35; }
        T.ball('cafe-coco', root, .32, p[0] + .2, 4.2, p[1], T.mat('#5a3a1e', .1));
      });
    }
    // жёлтый пин «купить покушать» (виден вблизи)
    var pm = T.texMat('pin-' + c[0], 512, 256, function (g, w, h) {
      g.fillStyle = 'rgba(14,70,140,.82)'; var r = 48; g.beginPath(); g.moveTo(r, 150); g.arcTo(w - 8, 150, w - 8, 248, r); g.arcTo(w - 8, 248, 8, 248, r); g.arcTo(8, 248, 8, 150, r); g.arcTo(8, 150, w - 8, 150, r); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('купить покушать', w / 2, 201);
      g.fillStyle = '#ffd21f'; g.strokeStyle = '#8a5a00'; g.lineWidth = 6;
      g.beginPath(); g.arc(w / 2, 58, 46, Math.PI * .85, Math.PI * .15); g.lineTo(w / 2, 142); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, 58, 18, 0, 7); g.fill();
    }, true);
    var pin = T.plane('cafe-pin', null, 3.2, 1.6, c[1], 4.6, c[2], pm); pin.billboardMode = 7; pin.setEnabled(false);
    return { root: root, pin: pin, c: c };
  }
  function buildBeacons(T, g) {
    var m = T.texMat('crate-beacon', 128, 128, function (gx, w, h) {
      var gr = gx.createRadialGradient(64, 54, 4, 64, 54, 60); gr.addColorStop(0, 'rgba(255,240,150,1)'); gr.addColorStop(.35, 'rgba(255,120,40,.8)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      gx.fillStyle = gr; gx.fillRect(0, 0, w, h);
      gx.fillStyle = '#fff'; gx.strokeStyle = '#c8281a'; gx.lineWidth = 6; gx.beginPath(); gx.moveTo(40, 44); gx.lineTo(88, 44); gx.lineTo(64, 84); gx.closePath(); gx.fill(); gx.stroke();
    }, true);
    m.emissiveColor = new (m.emissiveColor.constructor)(1, 1, 1); m.disableLighting = true;
    var pool = [];
    for (var i = 0; i < 14; i++) { var b = T.plane('crate-beacon', null, 1.3, 1.3, 0, -50, 0, m); b.billboardMode = 7; b.setEnabled(false); pool.push(b); }
    // ящики с едой — ярче (один раз, не каждый кадр)
    try { var fm = g._cBase.food && g._cBase.food.material; if (fm) fm.emissiveColor.set(.85, .26, .12); } catch (e) { }
    return pool;
  }
  function build(g) {
    var T = tools(g); if (!T) return null;
    var st = { scene: g.scene, carts: [], beacons: [], t: 0, acc: 0 };
    CAFES.forEach(function (c) { try { st.carts.push(buildCart(T, c)); } catch (e) { console.error('[cafes] тележка', c[0], e); } });
    try { st.beacons = buildBeacons(T, g); } catch (e) { console.error('[cafes] маячки', e); }
    T.all.forEach(function (m) { if (!m.billboardMode) { m.computeWorldMatrix(true); m.freezeWorldMatrix(); } });
    st.obs = g.scene.onBeforeRenderObservable.add(function () { tick(g, st); });
    g.scene.onDisposeObservable.add(function () { if (S === st) S = null; if (ui.btn) ui.btn.hidden = true; closeMenu(); });
    window.__sevCafes = { list: CAFES.map(function (c) { return { id: c[0], name: c[5], x: c[1], z: c[2] }; }), state: st, open: openMenu };
    return st;
  }
  function tick(g, st) {
    var P = g.player && g.player.position; if (!P) return;
    var dt = Math.min(.1, st.scene.getEngine().getDeltaTime() / 1000); st.t += dt; st.acc += dt;
    if (st.near && st.near.pin.isEnabled()) st.near.pin.position.y = 4.6 + Math.sin(st.t * 3) * .18;
    st.beacons.forEach(function (b, i) { if (b.isEnabled()) b.position.y = b._y + Math.sin(st.t * 3 + i) * .25; });
    if (st.acc < .25) return; st.acc = 0;
    // ближняя тележка, дальние — выключены (не рисуются)
    var best = null, bd = 1e9;
    st.carts.forEach(function (k) {
      var d = Math.hypot(P.x - k.c[1], P.z - k.c[2]);
      var on = d < 170; if (k.root.isEnabled() !== on) k.root.setEnabled(on);
      if (d < bd) { bd = d; best = k; }
    });
    var near = bd < 6 && Math.abs(P.y) < 4 ? best : null;
    if (near !== st.near) {
      if (st.near) st.near.pin.setEnabled(false);
      st.near = near; ui.near = near && near.c;
      if (near) near.pin.setEnabled(true);
      initUI(); ui.btn.hidden = !near; if (!near) closeMenu();
    }
    // маячки над 14 ближайшими целыми ящиками с едой (до 70 м)
    var crates = (g._crates || []).filter(function (c) { return c.kind === 'food' && c.alive; })
      .map(function (c) { return [Math.hypot(P.x - c.x, P.z - c.z), c]; })
      .filter(function (a) { return a[0] < 70 && a[0] > 3; }).sort(function (a, b) { return a[0] - b[0]; });
    st.beacons.forEach(function (b, i) {
      var a = crates[i];
      if (!a) { if (b.isEnabled()) b.setEnabled(false); return; }
      var c = a[1]; b._y = (c.y || 0) + c.s + 1.6; b.position.x = c.x; b.position.z = c.z;
      if (!b.isEnabled()) { b.position.y = b._y; b.setEnabled(true); }
    });
  }
  setInterval(function () {
    var g = window.__sevGame;
    if (!g || !g.scene || g.scene.isDisposed || !g.def || g.def.id !== 'pobedy') return;
    if (S && S.scene === g.scene) return;
    if (!g._cBase || !g.player || !window.__sevBJS) return;
    S = build(g);
  }, 700);
})();
