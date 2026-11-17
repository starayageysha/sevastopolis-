/* Севастополис — рыбалка: FishingAnimation (v185)
   Удочка в лапах лисёнка, леска, поплавок, модель улова, чайка.
   Все объекты создаются один раз и переиспользуются. */
(function () {
  'use strict';
  var F = window.SevFish = window.SevFish || {}, DB = F.DB;
  function J() { return window.__sevBJS; }
  var A = F.Anim = { sc: null };
  var mats = {};
  function mat(sc, hex, em) { var k = hex + (em || ''); if (mats[k] && mats[k].getScene() === sc && !mats[k]._disposed) return mats[k]; var Jb = J(), m = new Jb.Mat('fish-' + k, sc); m.diffuseColor = Jb.C3.FromHexString(hex); m.specularColor = new Jb.C3(.3, .3, .3); m.emissiveColor = Jb.C3.FromHexString(hex).scale(em == null ? .15 : em); return (mats[k] = m); }

  A.ensure = function (sc) {
    if (A.sc === sc && A.rod) return;
    var Jb = J(), MB = Jb.MB; A.sc = sc; mats = {};
    // удочка: комель и гибкая вершинка (две части, чтобы гнуть)
    A.rod = MB.CreateCylinder('fish-rod-butt', { diameterTop: .035, diameterBottom: .06, height: 1.1, tessellation: 8 }, sc);
    A.tip = MB.CreateCylinder('fish-rod-tip', { diameterTop: .012, diameterBottom: .035, height: 1.1, tessellation: 6 }, sc);
    A.reel = MB.CreateCylinder('fish-reel', { diameter: .14, height: .07, tessellation: 12 }, sc);
    A.grip = MB.CreateCylinder('fish-grip', { diameter: .075, height: .32, tessellation: 8 }, sc);
    // поплавок
    A.bob = MB.CreateSphere('fish-bobber', { diameter: .2, segments: 10 }, sc);
    A.bobBot = MB.CreateSphere('fish-bobber-b', { diameter: .2, segments: 10, slice: .5 }, sc); A.bobBot.parent = A.bob; A.bobBot.rotation.x = Math.PI;
    A.bobAnt = MB.CreateCylinder('fish-bobber-a', { diameter: .03, height: .18, tessellation: 6 }, sc); A.bobAnt.parent = A.bob; A.bobAnt.position.y = .16;
    [A.rod, A.tip, A.reel, A.grip, A.bob, A.bobBot, A.bobAnt].forEach(function (m) { m.isPickable = false; m.setEnabled(false); });
    A.grip.material = mat(sc, '#2b1d14', .05); A.reel.material = mat(sc, '#c9d3db', .25); A.bobAnt.material = mat(sc, '#111111', .05);
    A.line = null; A.linePts = []; for (var i = 0; i < 14; i++) A.linePts.push(new (sc.meshes[0].position.constructor)(0, 0, 0));
    A.gear();
  };
  A.gear = function () {
    var s = F.Collection.s, rod = DB.rods.filter(function (r) { return r.id === s.eq.rod; })[0] || DB.rods[0], b = DB.bobbers.filter(function (x) { return x.id === s.eq.bobber; })[0] || DB.bobbers[0];
    A.rod.material = mat(A.sc, rod.col, rod.id === 'gold' ? .5 : .12); A.tip.material = A.rod.material;
    A.bob.material = mat(A.sc, b.top, .35); A.bobBot.material = mat(A.sc, b.bot, .35);
  };
  A.show = function (on) { [A.rod, A.tip, A.reel, A.grip].forEach(function (m) { m.setEnabled(on); }); if (!on) { A.bob.setEnabled(false); A.lineShow(false); } };
  // ориентировать цилиндр (ось Y) из точки a в точку b
  function orient(m, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1;
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.rotation.set(Math.acos(Math.max(-1, Math.min(1, dy / L))), Math.atan2(dx, dz), 0); m.scaling.y = L / 1.1;
  }
  // поза удочки: hand — точка лап, fwd — направление взгляда, pitch — подъём (рад), bend — изгиб к цели
  A.pose = function (hand, fwd, pitch, bend, target) {
    var V = hand.constructor, up = Math.sin(pitch), fl = Math.cos(pitch);
    var dir = new V(fwd.x * fl, up, fwd.z * fl), mid = hand.add(dir.scale(1.05)), tip;
    if (bend > 0 && target) { var tg = target.subtract(mid); tg.normalize(); var d2 = dir.scale(1 - bend).add(tg.scale(bend)); d2.normalize(); tip = mid.add(d2.scale(1.05)); }
    else tip = mid.add(dir.scale(1.05));
    var butt = hand.subtract(dir.scale(.15));
    orient(A.rod, butt, mid); orient(A.tip, mid, tip);
    A.grip.position.copyFrom(hand.subtract(dir.scale(.05))); A.grip.rotation.copyFrom(A.rod.rotation); A.grip.scaling.y = 1;
    A.reel.position.set(hand.x + dir.x * .12, hand.y + dir.y * .12 - .07, hand.z + dir.z * .12); A.reel.rotation.set(0, Math.atan2(fwd.x, fwd.z), Math.PI / 2);
    A.tipPos = tip; return tip;
  };
  // леска с провисанием: от вершинки к поплавку
  A.lineShow = function (on) { if (A.line) A.line.setEnabled(on); };
  A.lineTo = function (tip, end, slack) {
    var P = A.linePts, n = P.length;
    for (var i = 0; i < n; i++) { var t = i / (n - 1); P[i].set(tip.x + (end.x - tip.x) * t, tip.y + (end.y - tip.y) * t - Math.sin(t * Math.PI) * slack, tip.z + (end.z - tip.z) * t); }
    var Jb = J();
    if (!A.line || A.line.isDisposed()) { A.line = Jb.MB.CreateLines('fish-line', { points: P, updatable: true }, A.sc); A.line.color = Jb.C3.FromHexString('#f4f8ff'); A.line.alpha = .85; A.line.isPickable = false; }
    else Jb.MB.CreateLines('fish-line', { points: P, instance: A.line });
    A.line.setEnabled(true);
  };

  /* ---------- модель улова ---------- */
  A.catchModel = function (sp, len) {
    var Jb = J(), MB = Jb.MB, sc = A.sc, root = MB.CreateBox('fish-catch', { size: .01 }, sc); root.isVisible = false; root.isPickable = false;
    function part(m, x, y, z, c, em) { m.parent = root; m.position.set(x, y, z); m.material = mat(sc, c, em); m.isPickable = false; return m; }
    if (sp.k === 'fish') {
      var L = Math.max(.35, Math.min(1.6, len / 100 * 1.5)), sh = sp.shape, c0 = sp.col[0], c1 = sp.col[1], em = sp.gold ? .6 : .18;
      var body = part(MB.CreateSphere('fc-b', { diameter: 1, segments: 12 }, sc), 0, 0, 0, c0, em);
      var hh = sh === 'round' ? .55 : sh === 'flat' ? .14 : sh === 'goby' ? .38 : .32, ww = sh === 'flat' ? .62 : sh === 'round' ? .3 : .24;
      body.scaling.set(ww * L, hh * L, L);
      var belly = part(MB.CreateSphere('fc-bl', { diameter: 1, segments: 10 }, sc), 0, -hh * L * .18, 0, c1, em); belly.scaling.set(ww * L * .92, hh * L * .7, L * .86);
      var tail = part(MB.CreateBox('fc-t', { width: .02, height: hh * L * 1.3, depth: L * .32 }, sc), 0, 0, -L * .58, c1, em); tail.rotation.x = 0;
      var tail2 = part(MB.CreateBox('fc-t2', { width: .02, height: hh * L * .9, depth: L * .25 }, sc), 0, hh * L * .25, -L * .62, c1, em); tail2.rotation.x = .7;
      var tail3 = part(MB.CreateBox('fc-t3', { width: .02, height: hh * L * .9, depth: L * .25 }, sc), 0, -hh * L * .25, -L * .62, c1, em); tail3.rotation.x = -.7;
      var fin = part(MB.CreateBox('fc-f', { width: .02, height: hh * L * .55, depth: L * .4 }, sc), 0, hh * L * .55, -L * .05, c1, em); fin.rotation.x = -.35;
      if (sh === 'wing') { [-1, 1].forEach(function (s) { var w = part(MB.CreateBox('fc-w', { width: L * .55, height: .02, depth: L * .35 }, sc), s * L * .3, 0, L * .05, '#4fb3ff', .4); w.rotation.z = s * .4; }); }
      [-1, 1].forEach(function (s) { part(MB.CreateSphere('fc-e', { diameter: L * .1, segments: 6 }, sc), s * ww * L * .38, hh * L * .12, L * .36, '#ffffff', .4);
        part(MB.CreateSphere('fc-p', { diameter: L * .055, segments: 6 }, sc), s * ww * L * .44, hh * L * .13, L * .39, '#111111', 0); });
      if (sp.gold) root.metadata = { glow: true };
    } else if (sp.chest) {
      var bx = part(MB.CreateBox('fc-c', { width: .9, height: .5, depth: .6 }, sc), 0, 0, 0, '#7a4a22', .15);
      var lid = part(MB.CreateCylinder('fc-l', { diameter: .6, height: .9, tessellation: 12, arc: .5 }, sc), 0, .25, 0, '#8a5a2b', .15); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2;
      part(MB.CreateBox('fc-r', { width: .94, height: .08, depth: .64 }, sc), 0, .22, 0, '#f2c230', .5);
      part(MB.CreateBox('fc-k', { width: .14, height: .16, depth: .05 }, sc), 0, .12, .32, '#f2c230', .6);
    } else { // остальные находки — значок на «пузыре» (без пустых декораций: всё это идёт в альбом)
      var Jb2 = J(), t = new Jb2.DT('fc-tex', { width: 128, height: 128 }, sc, false), g = t.getContext();
      g.clearRect(0, 0, 128, 128); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#1f86e6'; g.lineWidth = 6; g.stroke();
      g.font = '74px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sp.e, 64, 70); t.update(true); t.hasAlpha = true;
      var m2 = new Jb2.Mat('fc-m', sc); m2.diffuseTexture = t; m2.useAlphaFromDiffuseTexture = true; m2.emissiveColor = new Jb2.C3(.9, .9, .9); m2.disableLighting = true; m2.backFaceCulling = false;
      var pl = MB.CreatePlane('fc-p', { size: .8 }, sc); pl.parent = root; pl.material = m2; pl.billboardMode = 7; pl.isPickable = false;
      root.metadata = { tex: t, mat: m2 };
    }
    return root;
  };
  A.disposeModel = function (m) { if (!m) return; var md = m.metadata; m.dispose(false, false); if (md && md.tex) { md.tex.dispose(); md.mat.dispose(); } };

  /* ---------- чайка ---------- */
  A.gull = function () {
    var Jb = J(), MB = Jb.MB, sc = A.sc, root = MB.CreateBox('fish-gull', { size: .01 }, sc); root.isVisible = false;
    function part(m, x, y, z, c) { m.parent = root; m.position.set(x, y, z); m.material = mat(sc, c, .3); m.isPickable = false; return m; }
    var b = part(MB.CreateSphere('g-b', { diameter: 1, segments: 8 }, sc), 0, 0, 0, '#ffffff'); b.scaling.set(.35, .32, .8);
    part(MB.CreateSphere('g-h', { diameter: .32, segments: 8 }, sc), 0, .12, .42, '#ffffff');
    var bk = part(MB.CreateCylinder('g-k', { diameterTop: 0, diameterBottom: .07, height: .2, tessellation: 6 }, sc), 0, .1, .62, '#ff9a1f'); bk.rotation.x = Math.PI / 2;
    root.wings = [-1, 1].map(function (s) { var w = part(MB.CreateBox('g-w', { width: .9, height: .03, depth: .3 }, sc), s * .5, .05, 0, '#9aa3ab'); return w; });
    return root;
  };
})();
