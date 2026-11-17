/* =====================================================================
   Севастополис — рыбалка: FishingController (v185)
   Связывает модули: подход к воде → удочка → наживка → заброс (сила) →
   ожидание и поклёвки → подсечка → вываживание → улов / обрыв / сход →
   карточка, альбом, награды, события (чайка, сундук, бутылка, карта клада,
   крупная рыба тянет к воде), соревнование с Михалычем.
   Использует Water & Shoreline Manager (SevWater): где вода, высота волны,
   круги на воде, тип берега. Сохранение — localStorage «sevfish».
   ===================================================================== */
(function () {
  'use strict';
  var F = window.SevFish, DB = F.DB, C = F.Collection, U = F.UI, A = F.Anim;
  var K = { state: 'idle', t: 0 };
  F.Controller = K;
  function G() { return window.__sevGame; }
  function W() { return window.SevWater; }
  function store() { return window.__sevVehicleStore; }
  function V3() { var g = G(); return g.player.position.constructor; }

  /* ---------- где мы ---------- */
  function fwdOf(g) { var h = g.player.heading || 0; return { x: Math.sin(h), z: Math.cos(h) }; }
  function onBoat() { var f = store(); return f && f.riding && (f.vehicle === 'boat' || f.vehicle === 'yacht'); }
  function waterAhead(g, fwd) {
    var w = W(), P = g.player.position; if (!w || !w.isWater) return null;
    if (onBoat()) return { d: 3, x: P.x + fwd.x * 3, z: P.z + fwd.z * 3 };
    for (var d = 1.2; d <= 9; d += .6) { var x = P.x + fwd.x * d, z = P.z + fwd.z * d; if (w.isWater(x, z) === true) return { d: d, x: x, z: z }; }
    return null;
  }
  function zoneAt(g, x, z) {
    if (onBoat()) return 'sea';
    for (var i = 0; i < DB.bays.length; i++) { var b = DB.bays[i]; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 'bay'; }
    var P = g.player.position, w = W(), me = w.shoreAt(P.x, P.z), there = w.shoreAt(x, z);
    if (me && me.type === 'rock' && me.h > .15) return 'pier';
    if (there && there.type === 'rock') return 'rocks';
    if (there && there.toLand > 30) return 'sea';
    return 'beach';
  }
  function isNight(g) { var s = 0; g.scene.lights.forEach(function (l) { if (l.isEnabled() && l.getClassName() === 'DirectionalLight') s = Math.max(s, l.intensity); }); return s < .3; }
  function isRain() { var c = window.__sevAtmCur && window.__sevAtmCur(); return !!(c && c.rain > .5); }

  /* ---------- состояние ---------- */
  function set(st) { K.state = st; K.t = 0; ui(); }
  function ui() {
    var s = K.state; U.bar.hidden = s === 'idle'; U.fish.hidden = true;
    U.main.classList.remove('sf-r'); U.main.classList.add('sf-y');
    if (s === 'ready') { U.main.textContent = '🎣 Забросить'; U.status('Зажми «Забросить» и отпусти — чем дольше, тем дальше'); }
    else if (s === 'charge') { U.main.textContent = '🎣 Отпусти!'; }
    else if (s === 'fly' || s === 'wait') { U.main.textContent = '⏳ Ждём…'; U.status('Ждём поклёвку… поплавок качается на волнах'); }
    else if (s === 'bite') { U.main.textContent = '❗ Подсечь!'; U.main.classList.add('sf-r'); U.status('💥 Клюёт! Жми «Подсечь»!'); }
    else if (s === 'fight') { U.main.textContent = '💪 Тяни'; }
    else if (s === 'land' || s === 'gull' || s === 'result') { U.main.textContent = '…'; U.hideHud(); }
    U.baitLabel();
  }
  function begin() {
    var g = G(); A.ensure(g.scene); A.gear(); A.show(true);
    K.anchor = { x: g.player.position.x, z: g.player.position.z }; K.heading = g.player.heading || 0; K.fwd = fwdOf(g);
    set('ready');
  }
  function end() { A.show(false); clearBobber(); if (K.model) { A.disposeModel(K.model); K.model = null; } if (K.gullM) { K.gullM.dispose(false, false); K.gullM = null; } U.hideHud(); U.close(); set('idle'); }
  function clearBobber() { A.bob && A.bob.setEnabled(false); A.lineShow(false); K.bobber = null; }

  /* ---------- кнопки ---------- */
  U.fish.addEventListener('click', function () { if (K.dig) return digTreasure(); if (K.state === 'idle') begin(); });
  U.stop.addEventListener('click', end);
  U.bait.addEventListener('click', function () {
    var keys = Object.keys(DB.baits).filter(function (k) { return k === 'bread' || (k === 'lure' ? C.s.baits.lure : (C.s.baits[k] || 0) > 0); });
    var i = keys.indexOf(C.s.eq.bait); C.s.eq.bait = keys[(i + 1) % keys.length]; C.save(); U.baitLabel();
    U.toast(DB.baits[C.s.eq.bait].e + ' Наживка: ' + DB.baits[C.s.eq.bait].n, 1400);
  });
  var holding = false;
  function down(e) { if (e) { e.preventDefault(); e.stopPropagation(); } holding = true;
    if (K.state === 'ready') { set('charge'); K.pw = 0; }
    else if (K.state === 'bite') hook();
    else if (K.state === 'wait') { U.toast('🙊 Рано! Рыба испугалась и уплыла', 1800); reelIn(); } }
  function up(e) { if (e) { e.preventDefault(); e.stopPropagation(); } holding = false; if (K.state === 'charge') cast(); }
  U.main.addEventListener('pointerdown', down); U.main.addEventListener('pointerup', up); U.main.addEventListener('pointercancel', up); U.main.addEventListener('pointerleave', function () { if (holding && K.state === 'fight') holding = false; });
  addEventListener('keydown', function (e) { if (K.state !== 'idle' && (e.code === 'Space' || e.code === 'KeyF') && !e.repeat) { down(e); } });
  addEventListener('keyup', function (e) { if (K.state !== 'idle' && (e.code === 'Space' || e.code === 'KeyF')) up(e); });

  /* ---------- заброс ---------- */
  function cast() {
    var g = G(), w = W(), P = g.player.position, f = K.fwd, want = 5 + K.pw * 17, tgt = null;
    for (var d = want; d <= want + 8 && !tgt; d += .5) if (w.isWater(P.x + f.x * d, P.z + f.z * d) === true) tgt = d;
    for (d = want; d >= 2.5 && !tgt; d -= .5) if (w.isWater(P.x + f.x * d, P.z + f.z * d) === true) tgt = d;
    if (!tgt) { U.toast('Тут нет воды — повернись к морю', 1800); set('ready'); return; }
    var b = C.s.eq.bait; if (b !== 'bread' && b !== 'lure') { C.s.baits[b] = (C.s.baits[b] || 0) - 1; if (C.s.baits[b] <= 0) { C.s.baits[b] = 0; C.s.eq.bait = 'bread'; U.toast('Наживка кончилась — теперь на хлеб', 1600); } C.save(); }
    K.castBait = b;
    K.target = { x: P.x + f.x * tgt, z: P.z + f.z * tgt }; K.zone = zoneAt(g, K.target.x, K.target.z);
    K.from = A.tipPos ? A.tipPos.clone() : P.clone();
    set('fly');
  }
  function reelIn() { clearBobber(); set('ready'); }

  /* ---------- поклёвка и подсечка ---------- */
  function startWait() {
    var B = DB.baits[K.castBait] || DB.baits.bread;
    K.wait = (3 + Math.random() * 8) / B.speed * (isRain() ? .8 : 1); K.nib = 1 + ((Math.random() * 3) | 0); K.nibT = K.wait * (.3 + Math.random() * .3);
    set('wait'); K.bobber = { x: K.target.x, z: K.target.z, dip: 0 };
    U.toast('🎯 ' + DB.zones[K.zone], 1300);
  }
  function hook() {
    var g = G(); K.catch = F.Loot.roll(K.zone, K.castBait, { night: isNight(g), rain: isRain() });
    var rod = DB.rods.filter(function (r) { return r.id === C.s.eq.rod; })[0] || DB.rods[0], line = DB.lines.filter(function (l) { return l.id === C.s.eq.line; })[0] || DB.lines[0];
    K.ev = F.Events.plan(K.catch); K.mg = new F.Minigame(K.catch, { reel: rod.reel, str: line.str, tough: rod.tough }, K.ev); K.pulledMsg = false;
    W().ring(K.bobber.x, K.bobber.z, 1.6); set('fight');
  }

  /* ---------- улов ---------- */
  function won() {
    var g = G(), it = K.catch; it.place = DB.zones[K.zone]; it.date = new Date().toLocaleDateString('ru-RU'); it.rain = isRain(); it.night = isNight(g);
    K.model = A.catchModel(it.sp, it.l); K.model.position.set(K.bobber.x, -.6, K.bobber.z); K.landFrom = K.model.position.clone();
    W().ring(K.bobber.x, K.bobber.z, 1.8); clearBobber(); set('land');
  }
  function finish(stolen) {
    var it = K.catch, sp = it.sp, extra = '', coins = 0;
    if (stolen) { U.toast('🕊️ Чайка утащила улов! В следующий раз жми «Кыш!»', 3000); if (K.model) { A.disposeModel(K.model); K.model = null; } set('ready'); return; }
    var res = C.add(it); coins = sp.c || 0;
    if (sp.coins) coins += sp.coins[0] + ((Math.random() * (sp.coins[1] - sp.coins[0])) | 0);
    if (sp.bottle) { var bt = F.Events.bottle(); if (bt.kind === 'map') { var m = F.Events.newMap(); if (m) { extra += '<div style="font-weight:900;color:#9b4dff">🗺️ В бутылке карта! Клад спрятан ' + m.n + '. Ищи ❌ на радаре.</div>'; marker(); } }
      else { extra += '<div style="font-style:italic">📜 ' + bt.text + '</div>'; coins += bt.coins; } }
    if (sp.map) { var m2 = F.Events.newMap(); if (m2) { extra += '<div style="font-weight:900;color:#9b4dff">🗺️ Клад спрятан ' + m2.n + '. Ищи ❌ на радаре!</div>'; marker(); } }
    var rv = C.rivalCheck(it); if (rv.hit) extra += '<div style="font-weight:900;color:#e07000">🦝 Рекорд Михалыча по виду «' + sp.n + '» побит!</div>';
    if (rv.won) { coins += 60; extra += '<div style="font-weight:900;color:#18a36b">🏆 Ты выиграл соревнование дня! +60 🪙 и карбоновая удочка</div>'; res.ach.push('rival'); }
    if (K.gullSaved) { if (C.unlock('gull')) res.ach.push('gull'); K.gullSaved = false; }
    if (coins) { var st = store(); if (st) { st.add(coins); try { st._emit(); } catch (e) { } } C.s.earned += coins; C.save(); extra += '<div style="font-weight:900;color:#b26b00">+' + coins + ' 🪙</div>'; }
    res.ach.forEach(function (id) { var a = DB.achievements.filter(function (x) { return x.id === id; })[0]; if (a) extra += '<div style="font-weight:900">' + a.e + ' Достижение: ' + a.n + '</div>'; });
    try { window.dispatchEvent(new CustomEvent('sev:fish', { detail: { id: sp.id, w: it.w, l: it.l, zone: K.zone } })); } catch (e) { }
    A.gear(); set('result');
    U.onClose = function () { if (K.model) { A.disposeModel(K.model); K.model = null; } if (K.state === 'result') set('ready'); };
    U.card(it, res, extra, function () { });
  }

  /* ---------- клад по карте ---------- */
  var mk = null;
  function marker() {
    var g = G(); if (!g || !window.__sevBJS) return; var Jb = window.__sevBJS, m = C.s.maps.filter(function (q) { return !q.found; })[0];
    if (mk) { mk.dispose(false, false); mk = null; } if (!m) return;
    mk = Jb.MB.CreateBox('fish-x', { size: .01 }, g.scene); mk.isVisible = false; mk.position.set(m.x, 0, m.z);
    var mt = new Jb.Mat('fish-x-m', g.scene); mt.emissiveColor = Jb.C3.FromHexString('#ffd21f'); mt.diffuseColor = Jb.C3.FromHexString('#ffd21f'); mt.alpha = .55;
    [-1, 1].forEach(function (s) { var b = Jb.MB.CreateBox('fish-x-b', { width: 2.4, height: .08, depth: .4 }, g.scene); b.parent = mk; b.rotation.y = s * .785; b.position.y = .12; b.material = mt; b.isPickable = false; });
    var col = Jb.MB.CreateCylinder('fish-x-c', { diameter: .5, height: 14, tessellation: 10 }, g.scene); col.parent = mk; col.position.y = 7; col.material = mt; col.isPickable = false;
    mk.target = m;
  }
  function digTreasure() {
    var m = K.dig; if (!m) return; m.found = true; C.save(); var coins = 50 + ((Math.random() * 70) | 0), st = store(); if (st) { st.add(coins); try { st._emit(); } catch (e) { } }
    var got = C.unlock('map'); if (mk) { mk.dispose(false, false); mk = null; } K.dig = null; marker();
    U.open('<div class="sf-big">🧰 Клад найден!</div><div style="font-weight:800;margin:8px 0">Старый сундук с монетами: +' + coins + ' 🪙' + (got ? '<br>⭐ Достижение «Кладоискатель» — звёздный поплавок!' : '') + '</div><button class="sf-b sf-y" type="button" onclick="SevFish.UI.close()">Ура!</button>');
  }
  // крестик на радаре
  var prevDraw = null;
  function hookRadar() {
    if (window.__sevRadarDraw === radarDraw) return; prevDraw = window.__sevRadarDraw; window.__sevRadarDraw = radarDraw;
  }
  function radarDraw(g2, x, z, R, Cc) {
    if (prevDraw) prevDraw(g2, x, z, R, Cc);
    C.s.maps.forEach(function (m) { if (m.found) return; var px = Cc + (m.x - x) / R * Cc, py = Cc - (m.z - z) / R * Cc, dx = px - Cc, dy = py - Cc, d = Math.hypot(dx, dy);
      if (d > Cc - 16) { px = Cc + dx / d * (Cc - 16); py = Cc + dy / d * (Cc - 16); }
      g2.save(); g2.font = '900 20px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = 4; g2.strokeStyle = '#fff'; g2.strokeText('❌', px, py); g2.fillText('❌', px, py); g2.restore(); });
  }

  /* ---------- Михалыч на пирсе ---------- */
  var rivalDone = false;
  function rivalNPC() {
    if (rivalDone) return; var api = window.SevNPC; if (!api || !api.builders || !api.register) return; rivalDone = true;
    api.action('sevFishRival', function () { U.album('rival'); });
    try {
      api.register({ id: 'fisher-mihalych', name: 'Михалыч', title: 'Старый рыбак', scene: 'pobedy', build: api.builders.raccoon, height: 2.3, radius: .5, speed: 0,
        spawn: { x: DB.rival.x, z: DB.rival.z, heading: .6 }, route: [{ x: DB.rival.x, z: DB.rival.z, wait: [30, 60], face: .6 }], loop: true,
        dialog: { start: [{ go: 'hi' }], nodes: { hi: { emote: 'wave', text: 'Здорово, лисёнок! Я тут каждый день рыбачу. Спорим, не перебьёшь мои рекорды дня? Подойди к воде — увидишь кнопку «Рыбачить».',
          choices: [{ label: '🏆 Соревнование', 'do': 'sevFishRival' }, { label: 'Попробую!', alt: true }] } } } });
    } catch (e) { console.warn('[fishing] Михалыч', e); }
  }

  /* ---------- кадр ---------- */
  var last = performance.now(), boundScene = null;
  function frame() {
    var now = performance.now(), dt = Math.min(.25, (now - last) / 1000); last = now;
    var g = G(); if (!g || !g.scene || g.scene.isDisposed || !g.player || !g.def) return;
    if (g.def.id !== 'pobedy' || !W() || !W().state || !W().state.mask) { if (K.state !== 'idle') end(); U.fish.hidden = true; return; }
    if (boundScene !== g.scene) { boundScene = g.scene; A.sc = null; marker(); }
    hookRadar(); rivalNPC();
    K.t += dt;
    var P = g.player.position, w = W(), f = store();
    if (K.state === 'idle') {
      // клад рядом?
      K.dig = null; C.s.maps.forEach(function (m) { if (!m.found && Math.hypot(m.x - P.x, m.z - P.z) < 3.2) K.dig = m; });
      if (K.dig) { U.fish.textContent = '⛏️ Копать клад'; U.fish.hidden = document.body.dataset.mode !== 'scene'; return; }
      U.fish.textContent = '🎣 Рыбачить';
      var ok = !U.ov.hidden ? false : (!f || !f.riding || onBoat()) && !g.player._swimming && P.y > -.4 && !!waterAhead(g, fwdOf(g));
      U.fish.hidden = !ok; return;
    }
    // во время рыбалки лисёнок стоит на месте и смотрит на воду
    if (!onBoat() && K.anchor) { P.x = K.anchor.x; P.z = K.anchor.z; }
    g.player.heading = K.heading; if (g.player.model && g.player.model.root) g.player.model.root.rotation.y = K.heading;
    var fw = K.fwd, Vc = V3(), hand = new Vc(P.x + fw.x * .32 + fw.z * .18, P.y + .78, P.z + fw.z * .32 - fw.x * .18);
    var tgtPos = K.bobber ? new Vc(K.bobber.x, w.height(K.bobber.x, K.bobber.z) - (K.bobber.dip || 0), K.bobber.z) : null;
    var s = K.state, pitch = .75, bend = 0;
    if (s === 'charge') { K.pw = .5 - .5 * Math.cos(K.t * 4.2); pitch = .75 + K.pw * .9; U.power(K.pw); }
    if (s === 'fly') { var k = Math.min(1, K.t / .9); pitch = k < .25 ? 1.65 - k * 4 * 1.2 : .45;
      var a = K.from, b = new Vc(K.target.x, w.height(K.target.x, K.target.z), K.target.z), bp = new Vc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * 3.2, a.z + (b.z - a.z) * k);
      A.bob.setEnabled(true); A.bob.position.copyFrom(bp); var tip0 = A.pose(hand, fw, pitch, 0); A.lineTo(tip0, bp, .1);
      if (k >= 1) { w.ring(b.x, b.z, 1.4); startWait(); } return; }
    if (s === 'wait' || s === 'bite') {
      var bo = K.bobber;
      if (s === 'wait') {
        if (K.nib > 0 && K.t > K.nibT) { K.nib--; K.nibT = K.t + .7 + Math.random() * 1.6; bo.dip = .07; w.ring(bo.x, bo.z, .5); }
        if (K.t > K.wait) { set('bite'); bo.dip = .32; w.ring(bo.x, bo.z, 1.5); }
      } else { bo.dip = .32 + Math.sin(K.t * 18) * .05; if (K.t > 1.35) { U.toast('🐟 Рыба сорвалась… надо подсекать быстрее', 2000); reelIn(); return; } }
      if (s === 'wait') bo.dip = Math.max(0, bo.dip - dt * .25);
      A.bob.setEnabled(true); A.bob.position.copyFrom(tgtPos); A.bob.rotation.z = Math.sin(K.t * 1.7) * .15;
      var tip1 = A.pose(hand, fw, pitch, 0); A.lineTo(tip1, tgtPos, .35); return;
    }
    if (s === 'fight') {
      var m = K.mg, res = m.update(dt, holding), r = m.dist / 100, P0 = { x: P.x + fw.x * 1.2, z: P.z + fw.z * 1.2 };
      var sway = Math.sin(K.t * 2.3) * 1.6 * r + (m.burst > 0 ? Math.sin(K.t * 9) * .6 : 0);
      K.bobber.x = P0.x + (K.target.x - P0.x) * Math.min(1.25, r) + fw.z * sway; K.bobber.z = P0.z + (K.target.z - P0.z) * Math.min(1.25, r) - fw.x * sway; K.bobber.dip = .25;
      if (w.isWater(K.bobber.x, K.bobber.z) !== true) { K.bobber.x = K.target.x + (K.bobber.x - K.target.x) * .3; K.bobber.z = K.target.z + (K.bobber.z - K.target.z) * .3; }
      K.rAcc = (K.rAcc || 0) + dt; if (K.rAcc > (m.burst > 0 ? .25 : .6)) { K.rAcc = 0; w.ring(K.bobber.x, K.bobber.z, m.burst > 0 ? 1.2 : .6); }
      bend = Math.min(.8, m.tension / 140); pitch = .9 - bend * .2;
      // крупная рыба тянет лисёнка к воде
      if (K.ev.pull && m.burst > 0 && !onBoat()) {
        var nx = K.anchor.x + fw.x * dt * .9, nz = K.anchor.z + fw.z * dt * .9;
        if (w.isWater(nx + fw.x * .8, nz + fw.z * .8) !== true) { K.anchor.x = nx; K.anchor.z = nz; }
        if (!K.pulledMsg) { K.pulledMsg = true; U.toast('😱 Огромная рыба тянет лисёнка к воде! Отпускай, когда рвётся', 2600); }
      }
      U.fight(m);
      var tp = new Vc(K.bobber.x, w.height(K.bobber.x, K.bobber.z) - .25, K.bobber.z);
      A.bob.setEnabled(false); var tip2 = A.pose(hand, fw, pitch, bend, tp); A.lineTo(tip2, tp, Math.max(0, .25 - m.tension / 300));
      if (res === 'won') won();
      else if (res === 'snap') { U.toast('💔 Леска оборвалась! ' + (m.ev.snapAt ? 'Зацепилась за камень…' : 'Слишком сильно тянул'), 2400); clearBobber(); set('ready'); }
      else if (res === 'escape') { U.toast('🐟 Рыба ушла… тяни, когда она спокойна', 2400); clearBobber(); set('ready'); }
      return;
    }
    if (s === 'land') {
      var k2 = Math.min(1, K.t / 1.0), top = new Vc(P.x + fw.x * .6, P.y + 2.4, P.z + fw.z * .6), a2 = K.landFrom;
      K.model.position.set(a2.x + (top.x - a2.x) * k2, a2.y + (top.y - a2.y) * k2 + Math.sin(k2 * Math.PI) * 2.2, a2.z + (top.z - a2.z) * k2); K.model.rotation.y += dt * 6; K.model.rotation.z = Math.sin(K.t * 14) * .3 * (1 - k2);
      var tip3 = A.pose(hand, fw, 1.2, .2, K.model.position); A.lineTo(tip3, K.model.position, 0);
      if (k2 >= 1) { A.lineShow(false); if (K.ev.gull) { startGull(); } else finish(false); }
      return;
    }
    if (s === 'gull') { updGull(dt); A.pose(hand, fw, .75, 0); return; }
    if (s === 'result') { if (K.model) { K.model.rotation.y += dt * 1.5; if (K.model.metadata && K.model.metadata.glow) K.model.scaling.setAll(1 + Math.sin(K.t * 4) * .05); } A.pose(hand, fw, .75, 0); return; }
    A.pose(hand, fw, pitch, bend);
  }

  /* ---------- чайка ---------- */
  var shoo = null;
  function startGull() {
    var g = G(); K.gullM = A.gull(); var P = g.player.position; K.gullFrom = new (V3())(P.x - K.fwd.z * 25, P.y + 12, P.z + K.fwd.x * 25);
    K.gullM.position.copyFrom(K.gullFrom); set('gull'); K.gullSaved = false;
    if (!shoo) { shoo = document.createElement('button'); shoo.type = 'button'; shoo.className = 'sf-b sf-r'; shoo.style.cssText = 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:59;font-size:24px;padding:16px 30px'; shoo.textContent = '🕊️ Кыш!'; document.body.appendChild(shoo);
      shoo.addEventListener('click', function () { if (K.state === 'gull' && K.t < 1.8) { K.gullSaved = true; K.gullAway = true; shoo.hidden = true; U.toast('💪 Чайка улетела ни с чем!', 1600); } }); }
    shoo.hidden = false; K.gullAway = false; U.toast('🕊️ Чайка хочет украсть улов! Жми «Кыш!»', 1800);
  }
  function updGull(dt) {
    var g = K.gullM, t = K.t, tgt = K.model.position; g.wings.forEach(function (w, i) { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 16) * .6; });
    if (!K.gullAway) {
      var k = Math.min(1, t / 1.8); g.position.set(K.gullFrom.x + (tgt.x - K.gullFrom.x) * k, K.gullFrom.y + (tgt.y + .4 - K.gullFrom.y) * k, K.gullFrom.z + (tgt.z - K.gullFrom.z) * k);
      g.lookAt(tgt);
      if (k >= 1) { // утащила
        if (shoo) shoo.hidden = true; K.model.parent = g; K.model.position.set(0, -.4, 0); K.gullAway = 'steal'; K.t = 0;
      }
    } else {
      g.position.y += dt * 6; g.position.x += dt * 9 * (K.fwd.z || 1); g.position.z -= dt * 9 * K.fwd.x;
      if (t > (K.gullAway === 'steal' ? 1.3 : 1.2)) {
        var stolen = K.gullAway === 'steal'; if (shoo) shoo.hidden = true;
        if (stolen) { K.model.parent = null; } g.dispose(false, false); K.gullM = null; finish(stolen);
      }
    }
  }

  // кадр рыбалки — вместе с отрисовкой сцены (без дрожания поплавка); подключаемся к каждой новой сцене
  var obsScene = null;
  setInterval(function () {
    var g = G(); if (!g || !g.scene || g.scene.isDisposed) return;
    if (obsScene !== g.scene) { obsScene = g.scene; last = performance.now(); g.scene.onBeforeRenderObservable.add(function () { try { frame(); } catch (e) { console.error('[fishing]', e); } }); }
  }, 500);
  window.SevFishing = K;
  // для тестов
  K._test = { begin: begin, end: end, cast: function (p) { K.pw = p == null ? .5 : p; cast(); }, hook: hook, set: set, won: won, startGull: startGull, digTreasure: digTreasure, marker: marker };
})();
