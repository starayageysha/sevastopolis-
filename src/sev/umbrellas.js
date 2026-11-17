/* =====================================================================
   Севастополис — зонтики у жителей в дождь (v186)
   Когда начинается дождь (погода из 10-sev-atmosphere), у каждого жителя
   над головой раскрывается зонтик своего цвета; кончился дождь — зонтик
   складывается и исчезает. Зонтик крепится к модели жителя, ходит вместе
   с ним. Строятся только у видимых жителей (рядом с игроком).
   ===================================================================== */
(function () {
  'use strict';
  var COLS = ['#e8402a', '#1f86e6', '#ffd21f', '#18a36b', '#ff6fae', '#7c4dff', '#ff8a00', '#2fc6a8', '#ffffff', '#3a4a5c'];
  var mats = {}, sceneRef = null, open = 0;
  function J() { return window.__sevBJS; }
  function mat(sc, hex) { if (mats[hex] && sceneRef === sc) return mats[hex]; var Jb = J(), m = new Jb.Mat('umb-' + hex, sc); m.diffuseColor = Jb.C3.FromHexString(hex); m.specularColor = new Jb.C3(.25, .25, .25); m.emissiveColor = Jb.C3.FromHexString(hex).scale(.2); m.backFaceCulling = false; return (mats[hex] = m); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function build(n, sc) {
    var Jb = J(), MB = Jb.MB, h = (n.def.height || 2.2), col = COLS[hash(n.id) % COLS.length];
    var root = MB.CreateBox('umb-' + n.id, { size: .01 }, sc); root.isVisible = false; root.isPickable = false;
    var pole = MB.CreateCylinder('umb-pole', { diameter: .05, height: 1.15, tessellation: 6 }, sc); pole.parent = root; pole.position.y = .5; pole.material = mat(sc, '#3a2a1e');
    var hook = MB.CreateTorus ? MB.CreateTorus('umb-hook', { diameter: .14, thickness: .035, tessellation: 10 }, sc) : null; if (hook) { hook.parent = root; hook.position.set(.07, -.05, 0); hook.rotation.x = Math.PI / 2; hook.material = pole.material; }
    var can = MB.CreateCylinder('umb-can', { diameterTop: 0, diameterBottom: 1.75, height: .48, tessellation: 8 }, sc); can.parent = root; can.position.y = 1.2; can.material = mat(sc, col);
    var rim = MB.CreateCylinder('umb-rim', { diameterTop: 1.75, diameterBottom: 1.78, height: .06, tessellation: 8 }, sc); rim.parent = root; rim.position.y = .96; rim.material = mat(sc, col === '#ffffff' ? '#1f86e6' : '#ffffff');
    var tip = MB.CreateSphere('umb-tip', { diameter: .08, segments: 4 }, sc); tip.parent = root; tip.position.y = 1.47; tip.material = pole.material;
    root.getChildMeshes().forEach(function (m) { m.isPickable = false; });
    root.parent = n.rig.root; var s = n.rig.root.scaling; root.scaling.set(1 / (s.x || 1), 1 / (s.y || 1), 1 / (s.z || 1));
    root.position.set(.22 / (s.x || 1), (h * .62) / (s.y || 1), .05 / (s.z || 1)); root.rotation.z = -.12;
    root.metadata = { k: 0 }; return root;
  }
  setInterval(function () {
    var g = window.__sevGame, M = window.SevNPC && window.SevNPC.manager; if (!g || !g.scene || !M || !M.list || !J()) return;
    if (sceneRef !== g.scene) { sceneRef = g.scene; mats = {}; }
    var c = window.__sevAtmCur && window.__sevAtmCur(), rain = !!(c && c.rain > .35);
    open += ((rain ? 1 : 0) - open) * .35; // плавно раскрываются и складываются
    M.list.forEach(function (n) {
      if (!n.rig || !n.rig.root || (n.rig.root.isDisposed && n.rig.root.isDisposed())) { n._umb = null; return; }
      if (open < .02) { if (n._umb) { n._umb.dispose(false, false); n._umb = null; } return; }
      if (n.vis === false) return;
      if (!n._umb || n._umb.isDisposed()) n._umb = build(n, g.scene);
      var u = n._umb, k = Math.max(.05, open); u.getChildMeshes().forEach(function (m) { if (/umb-can|umb-rim/.test(m.name)) { m.scaling.x = m.scaling.z = k; } });
    });
  }, 200);
  window.__sevUmbrellas = { get open() { return open; } };
})();
