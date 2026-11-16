/* =====================================================================
   Севастополис — ящики по всему городу, кола, шляпы, переедание (v183)
   • __sevGenCrates(game): красные ящики во всех районах — где-то скопления
     во дворах, где-то одиночные ящики у тротуаров. Положение одинаковое
     при каждом запуске (сид), поэтому разбитые ящики не появляются снова раньше
     времени. Внутри: еда (чаще), кола или шляпа.
   • Кола: 30 секунд «реактивный лисёнок» — бег в 2,6 раза быстрее,
     из-под лап летит пыль.
   • Шляпы: 20 видов. Шляпа вылетает из ящика в звёздной пыли и сама
     прыгает на голову лисёнку вместо его соломенной шляпы.
     Найденные шляпы хранятся в коллекции (кнопка 🎩).
   • Переедание: 3 порции за 2 минуты — болит живот. Транспорт недоступен,
     нужно пробежать пешком 60 секунд.
   ===================================================================== */
(function () {
  'use strict';
  var LS = { hats: 'sevhats' };
  function J() { return window.__sevBJS; }
  function G() { return window.__sevGame; }
  function rngOf(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function toast(html) {
    var t = document.getElementById('sevToast');
    if (t) { t.innerHTML = html; t.classList.add('on'); clearTimeout(toast.tt); toast.tt = setTimeout(function () { t.classList.remove('on'); }, 2800); }
  }

  /* ================= 1. ящики по всему городу ================= */
  var FOODS = ['fries', 'nuggets', 'pizza', 'cake'];
  window.__sevGenCrates = function (game) {
    var RD = window.__sevRD || (typeof __SEV_RD !== 'undefined' ? __SEV_RD : null); if (!RD || !RD.length) return [];
    var w = game.world, ob = w && w.ctx && w.ctx.obstacles, rnd = rngOf(18303), out = [];
    // точки вдоль улиц (обочина за тротуаром), сгруппированные по кварталам 260 м
    var cells = new Map();
    RD.forEach(function (r) {
      var p = r.p; if (!p || p.length < 2) return; var hw = r.c === 2 ? 7 : 4, sw = r.c === 2 ? 2.5 : 2, acc = 0;
      for (var i = 0; i < p.length - 1; i++) {
        var a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < .1) continue;
        while (acc < L) {
          var t = acc / L, x = a[0] + dx * t, z = a[1] + dz * t, k = Math.floor(x / 260) + ',' + Math.floor(z / 260), A = cells.get(k);
          if (!A) cells.set(k, A = []); A.push([x, z, -dz / L, dx / L, hw + sw]); acc += 30;
        }
        acc -= L;
      }
    });
    var roadHash = new Map();
    RD.forEach(function (r) { var p = r.p; if (!p) return; var hw = (r.c === 2 ? 7 : 4) + .8; for (var i = 0; i < p.length; i++) { var k = Math.floor(p[i][0] / 20) + ',' + Math.floor(p[i][1] / 20), A = roadHash.get(k); if (!A) roadHash.set(k, A = []); A.push([p[i][0], p[i][1], hw]); } });
    function onRoad(x, z) { var cx = Math.floor(x / 20), cz = Math.floor(z / 20); for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) { var A = roadHash.get((cx + i) + ',' + (cz + j)); if (A) for (var q = 0; q < A.length; q++) if (Math.hypot(A[q][0] - x, A[q][1] - z) < A[q][2]) return true; } return false; }
    var placed = [];
    function ok(x, z) {
      if (onRoad(x, z)) return false;
      if (w.surfaceAt) { var s = w.surfaceAt(x, z); if (s === 'water') return false; }
      if (ob) { var p = { x: x, z: z }; if (ob.resolve(p, 1.2)) return false; }
      for (var i = Math.max(0, placed.length - 40); i < placed.length; i++) if (Math.hypot(placed[i][0] - x, placed[i][1] - z) < 2.4) return false;
      return true;
    }
    function content() { var r = rnd(); return r < .66 ? ['food'] : r < .84 ? ['cola'] : ['hat']; }
    function add(x, z) { var c = content(); var f = [Math.round(x * 10) / 10, Math.round(z * 10) / 10, FOODS[(rnd() * 4) | 0]]; if (c[0] !== 'food') f.push(c[0]); placed.push(f); out.push(f); }
    var keys = Array.from(cells.keys()).sort();
    keys.forEach(function (k) {
      var A = cells.get(k); if (A.length < 2) return;
      var roll = rnd(), n;
      if (roll < .22) { // скопление во дворе: 5–9 ящиков рядом
        var s = A[(rnd() * A.length) | 0], side = rnd() < .5 ? -1 : 1, d = s[4] + 6 + rnd() * 14, cx = s[0] + s[2] * d * side, cz = s[1] + s[3] * d * side;
        n = 5 + ((rnd() * 5) | 0);
        for (var t = 0, m = 0; m < n && t < n * 6; t++) { var x = cx + (rnd() - .5) * 12, z = cz + (rnd() - .5) * 12; if (ok(x, z)) { add(x, z); m++; } }
      } else { // одиночные: 1–3 ящика у тротуаров и во дворах
        n = roll < .65 ? 1 + ((rnd() * 2) | 0) : 1;
        for (var u = 0, mm = 0; mm < n && u < 12; u++) {
          var q = A[(rnd() * A.length) | 0], sd = rnd() < .5 ? -1 : 1, dd = q[4] + 1.5 + rnd() * (rnd() < .5 ? 3 : 18), xx = q[0] + q[2] * dd * sd, zz = q[1] + q[3] * dd * sd;
          if (ok(xx, zz)) { add(xx, zz); mm++; }
        }
      }
    });
    window.__sevCityCrates = { n: out.length, cola: out.filter(function (f) { return f[3] === 'cola'; }).length, hat: out.filter(function (f) { return f[3] === 'hat'; }).length };
    return out;
  };

  /* ================= 2. статусы и эффекты ================= */
  var ST = { boost: 0, tummy: 0, tummyRun: 0, eats: [] };
  var css = document.createElement('style');
  css.textContent = '#sevStatus{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 176px);z-index:46;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}' +
    '#sevStatus .p{font:900 14px Nunito,Arial,sans-serif;color:#fff;padding:6px 14px;border-radius:999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,30,90,.35),inset 0 1px 1px rgba(255,255,255,.6);text-shadow:0 1px 2px rgba(0,20,60,.6);white-space:nowrap}' +
    '#sevStatus .boost{background:linear-gradient(180deg,#ffb33a,#ff6a00)}#sevStatus .tummy{background:linear-gradient(180deg,#9be15d,#3fa34d)}' +
    '#sevHatBtn{position:fixed;z-index:24;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(200px + env(safe-area-inset-bottom,0px));width:46px;height:46px;font-size:24px;border-radius:50%;border:2.5px solid #fff;color:#fff;' +
    'background:radial-gradient(120% 90% at 50% 8%,#bfeaff 0,#5fc8ff 22%,#1a7fe0 62%,#0b4fa8 100%);box-shadow:0 4px 10px rgba(0,40,110,.45),inset 0 2px 2px rgba(255,255,255,.7)}' +
    'body:not([data-mode="scene"]) #sevHatBtn,body:not([data-mode="scene"]) #sevStatus{display:none!important}' +
    '#sevHats{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(0,30,80,.35)}#sevHats[hidden]{display:none}' +
    '#sevHats .pn{width:min(92vw,440px);max-height:86vh;overflow:auto;padding:14px;background:linear-gradient(180deg,rgba(235,248,255,.98),rgba(195,230,255,.97));border:3px solid #fff;border-radius:24px;box-shadow:0 0 0 3px #1a7fe0,0 14px 34px rgba(0,30,90,.5);font-family:Nunito,Arial,sans-serif;color:#0d3566;text-align:center}' +
    '#sevHats h2{margin:2px 0 4px;color:#0b4fa8}#sevHats .g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}' +
    '#sevHats .h{border-radius:16px;border:2px solid #8fcaf5;background:linear-gradient(180deg,#fff,#d9efff);padding:6px 2px;font:800 11px Nunito,Arial;color:#0d3566}#sevHats .h b{display:block;font-size:26px}' +
    '#sevHats .h.lock{opacity:.35;filter:grayscale(1)}#sevHats .h.on{box-shadow:0 0 0 3px #ffd84a}#sevHats .ok{padding:10px 28px;border-radius:999px;border:2px solid #fff;color:#fff;font:900 15px Nunito,Arial;background:linear-gradient(180deg,#7fd6ff,#1f86e6 60%,#0d5bb8)}' +
    '.sev-dust{position:fixed;pointer-events:none}';
  document.head.appendChild(css);
  var stBox = document.createElement('div'); stBox.id = 'sevStatus'; document.body.appendChild(stBox);
  function renderStatus() {
    var h = '';
    if (ST.boost > 0) h += '<div class="p boost">⚡ Реактивный лисёнок: ' + Math.ceil(ST.boost) + ' с</div>';
    if (ST.tummy > 0) h += '<div class="p tummy">🤢 Болит животик! Пробеги пешком: ' + Math.ceil(ST.tummy) + ' с</div>';
    if (stBox.innerHTML !== h) stBox.innerHTML = h;
  }

  /* переедание */
  function onEat() {
    var now = performance.now() / 1000; ST.eats = ST.eats.filter(function (t) { return now - t < 120; }); ST.eats.push(now);
    if (ST.eats.length >= 3 && ST.tummy <= 0) startTummy();
  }
  window.addEventListener('sev:eat', onEat);
  function startTummy() {
    ST.tummy = 60; ST.eats = [];
    var F = window.__sevVehicleStore, g = G();
    if (F && F.riding) { try { if (window.__sevSafeDismount && g) window.__sevSafeDismount.call(g, g); } catch (e) { } if (F.riding) { F.__origToggle ? F.__origToggle.call(F) : F.toggleRide(); } try { g && g._syncRideBtn && g._syncRideBtn(); } catch (e) { } }
    toast('🤢 Ой, лисёнок переел!<br><small>Животик болит — побегай пешком минутку, транспорт пока нельзя</small>');
  }
  function wrapRide() {
    var F = window.__sevVehicleStore; if (!F || F.__tummyWrapped) return; F.__tummyWrapped = 1;
    var orig = F.toggleRide; F.__origToggle = orig;
    F.toggleRide = function () {
      if (!this.riding && ST.tummy > 0) { toast('🤢 Животик болит!<br><small>Ещё ' + Math.ceil(ST.tummy) + ' с бега пешком — потом можно в транспорт</small>'); return false; }
      return orig.apply(this, arguments);
    };
  }

  /* кола */
  function startBoost() { ST.boost = 30; window.__sevFootBoost = 2.6; toast('🥤⚡ Кола! Лисёнок стал реактивным!<br><small>30 секунд суперскорости</small>'); }

  /* пыль из-под лап (2D поверх игры — дёшево для телефона) */
  var dust = [];
  function puff(g) {
    var P = g.player, cam = g.scene.activeCamera; if (!P || !cam) return;
    var V3 = P.position.constructor, eng = g.scene.getEngine();
    try {
      var M = cam.getViewMatrix().constructor, p = V3.Project(new V3(P.position.x, P.position.y + .2, P.position.z), M.Identity(), g.scene.getTransformMatrix(), cam.viewport.toGlobal(eng.getRenderWidth(), eng.getRenderHeight()));
      var r = eng.getRenderingCanvasClientRect(), sx = r.width / eng.getRenderWidth(), sy = r.height / eng.getRenderHeight();
      var d = document.createElement('div'); d.className = 'sev-dust';
      var size = 18 + Math.random() * 22, x = r.left + p.x * sx + (Math.random() - .5) * 30, y = r.top + p.y * sy + (Math.random() - .5) * 10;
      d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:radial-gradient(circle,rgba(235,220,190,.9),rgba(210,190,150,0));z-index:30;transform:translate(-50%,-50%);transition:all .7s ease-out;opacity:.9';
      document.body.appendChild(d); dust.push(d);
      requestAnimationFrame(function () { d.style.transform = 'translate(-50%,-90%) scale(2.2)'; d.style.opacity = '0'; });
      setTimeout(function () { d.remove(); }, 750);
    } catch (e) { }
  }

  /* ================= 3. шляпы ================= */
  var HATS = [
    ['pirate', 'Пиратская треуголка', '🏴‍☠️'], ['sailor', 'Бескозырка', '⚓'], ['cowboy', 'Ковбойская шляпа', '🤠'], ['tophat', 'Цилиндр', '🎩'],
    ['crown', 'Корона', '👑'], ['chef', 'Колпак повара', '🍳'], ['wizard', 'Шляпа волшебника', '🧙'], ['sombrero', 'Сомбреро', '🌵'],
    ['ushanka', 'Ушанка', '❄️'], ['cap', 'Кепка', '🧢'], ['beret', 'Берет', '🎨'], ['bowler', 'Котелок', '🕴️'],
    ['fez', 'Феска', '🔴'], ['santa', 'Новогодний колпак', '🎅'], ['propeller', 'Кепка с пропеллером', '🚁'], ['viking', 'Шлем викинга', '⚔️'],
    ['party', 'Праздничный колпачок', '🥳'], ['wreath', 'Венок из цветов', '🌸'], ['captain', 'Капитанская фуражка', '⛴️'], ['safari', 'Пробковый шлем', '🧭']
  ];
  var HS = { owned: [], cur: null };
  try { var sv = JSON.parse(localStorage.getItem(LS.hats) || '{}'); HS.owned = sv.owned || []; HS.cur = sv.cur || null; } catch (e) { }
  function saveHats() { try { localStorage.setItem(LS.hats, JSON.stringify(HS)); } catch (e) { } }

  function buildHat(id, sc) {
    var Jb = J(), MB = Jb.MB, C3 = Jb.C3, Mat = Jb.Mat, mats = buildHat.m || (buildHat.m = {});
    function mat(h, em) { var k = h + (em || ''); if (mats[k] && !mats[k].isDisposed) return mats[k]; var m = new Mat('hat-' + k, sc); m.diffuseColor = C3.FromHexString(h); m.specularColor = new C3(.25, .25, .25); m.emissiveColor = C3.FromHexString(h).scale(em || .22); return (mats[k] = m); }
    var root = MB.CreateBox('hat-' + id, { size: .01 }, sc); root.isVisible = false; root.isPickable = false;
    function fin(m, x, y, z, c) { m.parent = root; m.position.set(x, y, z); m.material = mat(c); m.isPickable = false; return m; }
    function cyl(d, h, x, y, z, c, dTop, tess) { return fin(MB.CreateCylinder('hp', { diameterBottom: d, diameterTop: dTop == null ? d : dTop, height: h, tessellation: tess || 24 }, sc), x, y, z, c); }
    function sph(d, x, y, z, c, sy) { var m = fin(MB.CreateSphere('hp', { diameter: d, segments: 12 }, sc), x, y, z, c); if (sy) m.scaling.y = sy; return m; }
    function box(w, h, d, x, y, z, c) { return fin(MB.CreateBox('hp', { width: w, height: h, depth: d }, sc), x, y, z, c); }
    function ring(d, t, y, c) { if (MB.CreateTorus) { return fin(MB.CreateTorus('hp', { diameter: d, thickness: t, tessellation: 24 }, sc), 0, y, 0, c); } return cyl(d + t, t, 0, y, 0, c); }
    switch (id) {
      case 'pirate':
        cyl(.95, .45, 0, .22, 0, '#1b1b1f', .8);
        [0, 2.094, 4.189].forEach(function (a) { var b = box(1.25, .38, .1, Math.sin(a) * .52, .36, Math.cos(a) * .52, '#232329'); b.rotation.y = a; b.rotation.x = -.55; });
        ring(1.05, .05, .5, '#e0b44a'); sph(.24, 0, .32, .66, '#f5f1e6'); box(.26, .05, .05, 0, .2, .7, '#f5f1e6').rotation.z = .6; break;
      case 'sailor':
        cyl(1.0, .2, 0, .1, 0, '#13224a'); cyl(1.18, .16, 0, .27, 0, '#ffffff', 1.26); ring(1.0, .04, .2, '#e0b44a');
        [-.12, .12].forEach(function (x, i) { var r = box(.11, .62, .02, x, -.18, -.5, '#111'); r.rotation.z = i ? .14 : -.14; r.rotation.x = .25; }); break;
      case 'cowboy':
        cyl(2.0, .05, 0, .03, 0, '#8a5a2b'); cyl(.95, .55, 0, .3, 0, '#9c6a35', .78); cyl(.97, .1, 0, .1, 0, '#3b2414');
        box(.4, .06, .06, 0, .22, .49, '#e0b44a'); break;
      case 'tophat':
        cyl(1.5, .05, 0, .03, 0, '#151518'); cyl(.88, 1.0, 0, .52, 0, '#1d1d22', .92); cyl(.9, .15, 0, .13, 0, '#c0182a'); break;
      case 'crown':
        cyl(1.0, .32, 0, .16, 0, '#f2c230', 1.04, 32);
        for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; cyl(.22, .34, Math.sin(a) * .47, .48, Math.cos(a) * .47, '#f2c230', 0, 8); sph(.1, Math.sin(a) * .47, .67, Math.cos(a) * .47, '#fff3a0'); }
        sph(.16, 0, .16, .52, '#e0203a'); sph(.13, .36, .16, .38, '#2a6fe0'); sph(.13, -.36, .16, .38, '#1fae5a'); break;
      case 'chef':
        cyl(.95, .32, 0, .16, 0, '#fafafa'); sph(1.25, 0, .62, 0, '#ffffff', .62); sph(.6, .3, .82, .1, '#ffffff'); sph(.6, -.28, .8, -.12, '#ffffff'); break;
      case 'wizard':
        cyl(1.8, .05, 0, .03, 0, '#2a3fa8'); var cn = cyl(1.0, 1.45, 0, .74, 0, '#3350c8', 0, 24); cn.rotation.z = .12;
        [[.25, .45, .4], [-.2, .8, .3], [.08, 1.1, .2], [-.35, .3, .3]].forEach(function (p) { var s = box(.12, .12, .03, p[0], p[1], p[2] + .02, '#ffe24a'); s.rotation.z = .785; }); break;
      case 'sombrero':
        cyl(2.7, .06, 0, .04, 0, '#e8c25a'); ring(2.7, .1, .06, '#d8432a'); cyl(.92, .75, 0, .4, 0, '#e2b84c', .32); cyl(.94, .14, 0, .13, 0, '#2a9d4a');
        sph(.14, 0, .85, 0, '#d8432a'); break;
      case 'ushanka':
        cyl(1.12, .45, 0, .22, 0, '#6b4a2c', 1.05); sph(1.1, 0, .45, 0, '#7a5534', .5);
        box(.18, .55, .55, .58, .02, 0, '#8a6440'); box(.18, .55, .55, -.58, .02, 0, '#8a6440'); box(.9, .25, .1, 0, .4, .55, '#8a6440'); sph(.18, 0, .45, .6, '#d8432a'); break;
      case 'cap':
        sph(1.05, 0, .05, 0, '#d8302a', .62); var v = box(.75, .04, .55, 0, .06, .66, '#d8302a'); v.rotation.x = -.12; sph(.1, 0, .38, 0, '#ffffff'); break;
      case 'beret':
        var bt = sph(1.25, .05, .14, 0, '#c8243a', .3); bt.rotation.z = .25; cyl(.05, .14, .05, .32, 0, '#7a1020'); break;
      case 'bowler':
        cyl(1.3, .05, 0, .03, 0, '#1d1d22'); sph(.95, 0, .22, 0, '#222228', .78); cyl(.96, .09, 0, .08, 0, '#5a1a1a'); break;
      case 'fez':
        cyl(.85, .6, 0, .3, 0, '#c8202a', .68); cyl(.04, .4, .25, .45, 0, '#111').rotation.z = .5; sph(.12, .4, .3, 0, '#111'); break;
      case 'santa':
        cyl(1.12, .22, 0, .11, 0, '#ffffff'); var sc1 = cyl(1.0, 1.05, -.08, .7, 0, '#d0182a', 0, 24); sc1.rotation.z = .35; sph(.3, -.27, 1.2, 0, '#ffffff'); break;
      case 'propeller':
        sph(1.05, 0, .05, 0, '#2a8fe0', .62); var half = sph(1.06, 0, .05, 0, '#f2c230', .63); half.scaling.x = .5; half.position.x = .26;
        cyl(.06, .3, 0, .45, 0, '#444'); var pr = MB.CreateBox('hat-prop', { width: 1.1, height: .03, depth: .14 }, sc); fin(pr, 0, .6, 0, '#e0203a'); var pr2 = MB.CreateBox('hat-prop2', { width: .14, height: .03, depth: 1.1 }, sc); fin(pr2, 0, .6, 0, '#1fae5a');
        root.metadata = { spin: [pr, pr2] }; break;
      case 'viking':
        sph(1.1, 0, .06, 0, '#b8c2cc', .72); cyl(1.1, .14, 0, .07, 0, '#c9973a'); box(.08, .5, .08, 0, .25, .54, '#c9973a');
        [-1, 1].forEach(function (s) { var h = cyl(.28, .62, s * .62, .42, 0, '#f3ead2', 0, 12); h.rotation.z = -s * .9; }); break;
      case 'party':
        var cols = ['#ff4fa3', '#ffd21f', '#3fc1ff', '#7be05a'];
        for (var k = 0; k < 4; k++) cyl(.85 - k * .2, .3, 0, .15 + k * .3, 0, cols[k], .65 - k * .2 > 0 ? .65 - k * .2 : 0.02, 20);
        sph(.24, 0, 1.25, 0, '#ffffff'); break;
      case 'wreath':
        ring(1.0, .16, .06, '#2f8f46');
        var fc = ['#ff6fae', '#ffd21f', '#ffffff', '#ff8a2a', '#b07bff'];
        for (var f = 0; f < 10; f++) { var an = f * Math.PI / 5; sph(.2, Math.sin(an) * .5, .12, Math.cos(an) * .5, fc[f % 5]); } break;
      case 'captain':
        cyl(1.0, .25, 0, .12, 0, '#16181f'); cyl(1.22, .18, 0, .33, 0, '#ffffff', 1.25); var vs = box(.8, .04, .45, 0, .04, .6, '#111'); vs.rotation.x = -.2;
        sph(.17, 0, .17, .5, '#f2c230'); ring(1.0, .03, .03, '#f2c230'); break;
      case 'safari':
        cyl(1.6, .05, 0, .03, 0, '#d9c28c'); sph(1.15, 0, .1, 0, '#e2cf9c', .75); cyl(1.16, .1, 0, .1, 0, '#7a5534'); sph(.12, 0, .5, 0, '#d9c28c'); break;
    }
    root.getChildMeshes().forEach(function (m) { m.receiveShadows = true; });
    return root;
  }

  /* соломенная шляпа модели: прячем её вершины, когда надета другая */
  var MASK_COLS = [[.6, .4, .1], [.4, .2, .1], [.7, .4, .1], [.6, .3, .1], [.1, .4, .0], [.0, .3, .0]];
  var maskState = { model: null, mesh: null, orig: null, idx: null, base: null };
  function lin(c) { return Math.pow(Math.max(0, c), 2.2); }
  function prepMask(model) {
    var mesh = (model.meshes || []).filter(function (m) { return /FurCloth|primitive0/.test(m.name + (m.material && m.material.name)); })[0];
    if (!mesh) return null;
    var Kc = 'color', Kp = 'position', Ki = 'matricesIndices', Kw = 'matricesWeights';
    var P = mesh.__sevOrigP || (mesh.__sevOrigP = mesh.getVerticesData(Kp)), C = mesh.getVerticesData(Kc), I = mesh.getVerticesData(Ki), W = mesh.getVerticesData(Kw);
    if (!P || !C || !I || !W) return null;
    var sk = mesh.skeleton, head = -1; if (sk) sk.bones.forEach(function (b, i) { if (b.name === 'head') head = i; });
    var cs = C.length / (P.length / 3), idx = [], sx = 0, sy = 1e9, sz = 0, maxy = -1e9;
    for (var v = 0; v < P.length / 3; v++) {
      var y = P[v * 3 + 1]; if (y < .66) continue;
      var bw = -1, bi = -1; for (var q = 0; q < 4; q++) if (W[v * 4 + q] > bw) { bw = W[v * 4 + q]; bi = I[v * 4 + q]; }
      if (head >= 0 && bi !== head) continue;
      var r = lin(C[v * cs]), g = lin(C[v * cs + 1]), b = lin(C[v * cs + 2]), hit = false; // Babylon хранит цвета в гамма-пространстве
      for (var m = 0; m < MASK_COLS.length && !hit; m++) { var c = MASK_COLS[m]; if (Math.abs(r - c[0]) <= .06 && Math.abs(g - c[1]) <= .06 && Math.abs(b - c[2]) <= .06) hit = true; }
      if (!hit) continue;
      idx.push(v); sx += P[v * 3]; sz += P[v * 3 + 2]; if (y < sy) sy = y; if (y > maxy) maxy = y;
    }
    if (!idx.length) return null;
    return { mesh: mesh, P: P, idx: idx, cx: sx / idx.length, cz: sz / idx.length, by: sy, top: maxy };
  }
  function setStrawHat(visible) {
    var g = G(), model = g && g.player && g.player.model; if (!model) return;
    if (maskState.model !== model) { maskState.model = model; maskState.info = prepMask(model); }
    var inf = maskState.info; if (!inf) return;
    var mesh = inf.mesh;
    if (!mesh.__sevOrigIdx) { // запоминаем исходные треугольники один раз
      var I0 = mesh.getIndices(); mesh.__sevOrigIdx = Array.prototype.slice.call(I0);
      var set = new Uint8Array(inf.P.length / 3); inf.idx.forEach(function (v) { set[v] = 1; });
      var keep = []; for (var t = 0; t < I0.length; t += 3) if (!(set[I0[t]] && set[I0[t + 1]] && set[I0[t + 2]])) keep.push(I0[t], I0[t + 1], I0[t + 2]);
      mesh.__sevNoHatIdx = keep;
    }
    var want = visible ? 'on' : 'off'; if (mesh.__sevHatState === want) return;
    // прячем только треугольники самой шляпы — без «лучей» и дыр
    mesh.setIndices(visible ? mesh.__sevOrigIdx : mesh.__sevNoHatIdx);
    mesh.__sevHatState = want; maskState.hidden = !visible;
  }

  var worn = { id: null, node: null, model: null };
  function headNode(model) { return model.root.getChildTransformNodes(false).filter(function (t) { return t.name === 'head'; })[0]; }
  function wearHat(id) {
    var g = G(), model = g && g.player && g.player.model; if (!model || !J()) return;
    if (worn.node) { try { worn.node.dispose(false, false); } catch (e) { } worn.node = null; }
    worn.id = id; worn.model = model;
    if (!id) { setStrawHat(true); return; }
    setStrawHat(false);
    var inf = maskState.info, hn = headNode(model); if (!hn) return;
    var hat = buildHat(id, g.scene);
    var mesh = inf ? inf.mesh : model.meshes[0], V3 = mesh.position.constructor;
    var wm = mesh.getWorldMatrix(), base = V3.TransformCoordinates(new V3(inf ? inf.cx : 0, inf ? inf.by + .1 : .79, inf ? inf.cz : 0), wm);
    var top = V3.TransformCoordinates(new V3(inf ? inf.cx : 0, inf ? inf.top : .95, inf ? inf.cz : 0), wm), scale = Math.max(.8, Math.min(2.2, 1.4 * (top.y - base.y) / .49)); // шляпа шире головы, как прежняя
    hat.position.copyFrom(base); hat.scaling.setAll(scale); hat.rotation.y = (model.root.rotation && model.root.rotation.y || 0) + (g.player.heading || 0) * 0;
    hat.setParent(hn); worn.node = hat;
  }
  function refreshHat() { var g = G(), model = g && g.player && g.player.model; if (!model) return; if (worn.model !== model || (HS.cur || null) !== worn.id) { maskState.model = null; wearHat(HS.cur); } }

  /* шляпа из ящика: звёздная пыль, потом прыжок на голову */
  var flying = [];
  function dropHat(x, z) {
    var notOwned = HATS.filter(function (h) { return HS.owned.indexOf(h[0]) < 0; }), pool = notOwned.length ? notOwned : HATS, h = pool[(Math.random() * pool.length) | 0];
    var g = G(); if (!g || !J()) return;
    var hat = buildHat(h[0], g.scene); hat.position.set(x, 1.2, z); hat.scaling.setAll(1.1);
    var stars = [], MB = J().MB, sm = new (J().Mat)('hat-star', g.scene); sm.emissiveColor = J().C3.FromHexString('#ffe680'); sm.disableLighting = true;
    for (var i = 0; i < 14; i++) { var s = MB.CreateBox('hat-star', { size: .14 }, g.scene); s.material = sm; s.isPickable = false; s.rotation.set(.6, .6, 0); stars.push({ m: s, a: i * .45, r: .6 + Math.random() * .7, y: Math.random() * 1.2, sp: 2 + Math.random() * 2 }); }
    flying.push({ hat: hat, h: h, t: 0, x: x, z: z, stars: stars, mat: sm });
    toast(h[2] + ' Из ящика выпала шляпа!<br><small>' + h[1] + '</small>');
  }
  function updFlying(dt, g) {
    for (var i = flying.length - 1; i >= 0; i--) {
      var f = flying[i]; f.t += dt;
      var P = g.player.position;
      if (f.t < 1.6) { f.hat.position.y = 1.2 + f.t * .9; f.hat.rotation.y += dt * 5; }
      else { var k = Math.min(1, (f.t - 1.6) / .7), tx = P.x, ty = P.y + 2.6, tz = P.z; f.hat.position.x += (tx - f.hat.position.x) * k; f.hat.position.y += (ty - f.hat.position.y) * k; f.hat.position.z += (tz - f.hat.position.z) * k; f.hat.rotation.y += dt * 8; }
      f.stars.forEach(function (s) { s.a += dt * s.sp; s.m.position.set(f.hat.position.x + Math.cos(s.a) * s.r, f.hat.position.y - .4 + s.y + Math.sin(s.a * 2) * .2, f.hat.position.z + Math.sin(s.a) * s.r); s.m.rotation.y += dt * 6; var sc = f.t > 2.1 ? Math.max(.01, 1 - (f.t - 2.1) * 3) : 1; s.m.scaling.setAll(sc); });
      if (f.t > 2.35) {
        f.stars.forEach(function (s) { s.m.dispose(); }); f.mat.dispose(); f.hat.dispose(false, false); flying.splice(i, 1);
        if (HS.owned.indexOf(f.h[0]) < 0) HS.owned.push(f.h[0]); HS.cur = f.h[0]; saveHats(); maskState.model = null; wearHat(HS.cur);
        toast(f.h[2] + ' Новая шляпа: ' + f.h[1] + '!<br><small>Коллекция шляп — кнопка 🎩 (' + HS.owned.length + ' из 20)</small>');
      }
    }
  }

  /* коллекция шляп */
  var hb = document.createElement('button'); hb.id = 'sevHatBtn'; hb.type = 'button'; hb.textContent = '🎩'; hb.title = 'Коллекция шляп'; document.body.appendChild(hb);
  var panel = document.createElement('div'); panel.id = 'sevHats'; panel.hidden = true; document.body.appendChild(panel);
  function openHats() {
    var h = '<div class="pn"><h2>🎩 Шляпы лисёнка</h2><div>Найдено ' + HS.owned.length + ' из 20. Ищи их в красных ящиках!</div><div class="g">';
    h += '<button class="h' + (!HS.cur ? ' on' : '') + '" data-id=""><b>👒</b>Своя</button>';
    HATS.forEach(function (x) { var own = HS.owned.indexOf(x[0]) >= 0; h += '<button class="h' + (own ? '' : ' lock') + (HS.cur === x[0] ? ' on' : '') + '" data-id="' + x[0] + '"' + (own ? '' : ' disabled') + '><b>' + (own ? x[2] : '❔') + '</b>' + (own ? x[1] : '???') + '</button>'; });
    h += '</div><button class="ok" type="button">Закрыть</button></div>';
    panel.innerHTML = h; panel.hidden = false;
  }
  hb.addEventListener('click', openHats);
  panel.addEventListener('click', function (e) {
    var b = e.target.closest('.h'); if (b && !b.disabled) { HS.cur = b.dataset.id || null; saveHats(); maskState.model = null; wearHat(HS.cur); openHats(); return; }
    if (e.target === panel || e.target.closest('.ok')) panel.hidden = true;
  });

  /* ================= 4. ящик разбит ================= */
  window.addEventListener('sev:crate', function (e) {
    var d = e.detail || {};
    if (d.kind === 'cola') { colaPop(); startBoost(); }
    else if (d.kind === 'hat') dropHat(d.x, d.z);
  });
  function colaPop() { var p = document.createElement('div'); p.className = 'sc-pop'; p.textContent = '🥤'; document.body.appendChild(p); setTimeout(function () { p.remove(); }, 1300); }

  /* ================= 5. кадр ================= */
  var last = performance.now(), dAcc = 0, uiAcc = 0, bendT = 0;
  /* лисёнок держится за живот: после анимации чуть сгибаем грудь вперёд */
  function hookBend(g) {
    var sc = g.scene; if (sc.__sevBend) return; sc.__sevBend = 1;
    sc.onBeforeRenderObservable.add(function () {
      if (!(ST.bend > 0)) return; var m = g.player && g.player.model; if (!m || !m.root) return;
      var nodes = m.__sevBN || (m.__sevBN = m.root.getChildTransformNodes(false).filter(function (t) { return t.name === 'chest' || t.name === 'spine'; }));
      nodes.forEach(function (n) { var q = n.rotationQuaternion; if (!q) return; var Q = q.constructor, V3 = n.position.constructor; q.multiplyInPlace(Q.RotationAxis(new V3(1, 0, 0), ST.bend * .5)); });
    });
  }
  function frame() {
    requestAnimationFrame(frame);
    var now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    var g = G(); if (!g || !g.player || !g.scene || g.scene.isDisposed) return;
    wrapRide();
    var P = g.player, F = window.__sevVehicleStore, v = P.velocity ? Math.hypot(P.velocity.x, P.velocity.z) : 0, riding = F && F.riding;
    if (ST.boost > 0) { ST.boost -= dt; if (ST.boost <= 0) { ST.boost = 0; window.__sevFootBoost = 1; toast('⚡ Суперскорость закончилась'); }
      if (!riding && v > 6) { dAcc += dt; if (dAcc > .06) { dAcc = 0; puff(g); } } }
    if (ST.tummy > 0) {
      if (!riding && v > 1.5) ST.tummy -= dt; // время идёт, только пока лисёнок бежит пешком
      bendT += dt;
      ST.bend = (v < 1 ? .45 : .25) + Math.sin(bendT * 3) * .08; hookBend(g);
      if (ST.tummy <= 0) { ST.tummy = 0; ST.bend = 0; toast('😊 Животик прошёл!<br><small>Транспорт снова доступен</small>'); }
    }
    if (flying.length) updFlying(dt, g);
    if (worn.node && worn.node.metadata && worn.node.metadata.spin) worn.node.metadata.spin.forEach(function (m) { m.rotation.y += dt * 14; });
    uiAcc += dt; if (uiAcc > .25) { uiAcc = 0; renderStatus(); if (g.def && J()) refreshHat(); }
  }
  requestAnimationFrame(frame);
  window.__sevLoot = { _mask: function () { var i = maskState.info; return i ? { n: i.idx.length, by: i.by, top: i.top, hidden: maskState.hidden } : null; }, state: ST, hats: HS, list: HATS, wear: function (id) { HS.cur = id; saveHats(); maskState.model = null; wearHat(id); }, drop: dropHat, cola: startBoost, tummy: startTummy };
})();
