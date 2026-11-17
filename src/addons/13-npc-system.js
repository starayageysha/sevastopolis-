
/* ============================================================
   «Севастополис» — Жители города (NPC Manager) v1.0
   Отдельный модуль: не меняет код игры, подключается к window.__sevGame.
   Регистрация нового жителя:  SevNPC.register({ id, name, scene, build, spawn, route, dialog ... })
   ============================================================ */
(function () {
'use strict';
if (window.SevNPC) return;

var PI = Math.PI, TAU = Math.PI * 2;
var FLIP = false;                      // если нормали смотрят внутрь — переключить

/* ---------- мелкие утилиты ---------- */
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(c, t, k, dt) { return c + (t - c) * (1 - Math.exp(-k * dt)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function angDiff(a, b) { var d = (a - b) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; }
function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function hex(c) {
  if (typeof c !== 'string') return c;
  c = c.replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  return [parseInt(c.substr(0, 2), 16) / 255, parseInt(c.substr(2, 2), 16) / 255, parseInt(c.substr(4, 2), 16) / 255];
}
function rotate(v, e) {
  var x = v[0], y = v[1], z = v[2], c, s, t;
  if (e[0]) { c = Math.cos(e[0]); s = Math.sin(e[0]); t = y * c - z * s; z = y * s + z * c; y = t; }
  if (e[1]) { c = Math.cos(e[1]); s = Math.sin(e[1]); t = x * c + z * s; z = -x * s + z * c; x = t; }
  if (e[2]) { c = Math.cos(e[2]); s = Math.sin(e[2]); t = x * c - y * s; y = x * s + y * c; x = t; }
  return [x, y, z];
}
function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

/* ============================================================
   ГЕОМЕТРИЯ: мягкие округлые формы с вершинными цветами.
   Все примитивы одной детали сливаются в один меш (2 материала: матовый и глянцевый).
   ============================================================ */
function Geo() { this.b = { m: { p: [], n: [], c: [], i: [] }, g: { p: [], n: [], c: [], i: [] } }; this.tf = null; }
Geo.prototype.at = function (p, r) { this.tf = { p: p, r: r || [0, 0, 0] }; return this; };
Geo.prototype.end = function () { this.tf = null; return this; };

Geo.prototype.grid = function (o, W, H, fn, inv) {
  var b = this.b[o.gloss ? 'g' : 'm'], base = b.p.length / 3;
  var col = hex(o.col), col2 = o.col2 ? hex(o.col2) : null, e = o.rot || null;
  var px = o.x || 0, py = o.y || 0, pz = o.z || 0, tf = this.tf, ao = o.ao === undefined ? 0.16 : o.ao;
  for (var j = 0; j <= H; j++) for (var k = 0; k <= W; k++) {
    var r = fn(j, k), p = r[0], n = r[1];
    if (e) { p = rotate(p, e); n = rotate(n, e); }
    p = [p[0] + px, p[1] + py, p[2] + pz];
    if (tf) { p = rotate(p, tf.r); p = [p[0] + tf.p[0], p[1] + tf.p[1], p[2] + tf.p[2]]; n = rotate(n, tf.r); }
    var c = col, t = r[2];
    if (col2 && t !== undefined) c = [col[0] + (col2[0] - col[0]) * t, col[1] + (col2[1] - col[1]) * t, col[2] + (col2[2] - col[2]) * t];
    var sh = 1 - ao * (1 - (n[1] * 0.5 + 0.5));
    b.p.push(p[0], p[1], p[2]); b.n.push(n[0], n[1], n[2]); b.c.push(c[0] * sh, c[1] * sh, c[2] * sh, 1);
  }
  var flip = inv ? !FLIP : FLIP;
  for (j = 0; j < H; j++) for (k = 0; k < W; k++) {
    var a = base + j * (W + 1) + k, bb = a + 1, cc = a + W + 1, d = cc + 1;
    if (flip) b.i.push(a, bb, cc, bb, d, cc); else b.i.push(a, cc, bb, bb, cc, d);
  }
};

/* эллипсоид: e(цвет, x,y,z, rx,ry,rz, {rot,gloss,col2,w,h,t0,t1,p0,p1}) */
Geo.prototype.e = function (col, x, y, z, rx, ry, rz, o) {
  o = o || {}; o.col = col; o.x = x; o.y = y; o.z = z;
  var W = o.w || 16, H = o.h || 11, t0 = o.t0 || 0, t1 = o.t1 === undefined ? PI : o.t1, p0 = o.p0 || 0, p1 = o.p1 === undefined ? TAU : o.p1;
  this.grid(o, W, H, function (j, k) {
    var th = t0 + (t1 - t0) * j / H, ph = p0 + (p1 - p0) * k / W, st = Math.sin(th), ct = Math.cos(th), cp = Math.cos(ph), sp = Math.sin(ph);
    return [[rx * st * cp, ry * ct, rz * st * sp], norm([st * cp / rx, ct / ry, st * sp / rz]), j / H];
  });
  return this;
};
/* конус / цилиндр по оси Y: c(цвет, x,y,z (основание), r0,r1,h, {sx,sz,rot,caps,w}) */
Geo.prototype.c = function (col, x, y, z, r0, r1, h, o) {
  o = o || {}; o.col = col; o.x = x; o.y = y; o.z = z;
  var W = o.w || 14, sx = o.sx || 1, sz = o.sz || 1, caps = o.caps === undefined ? 2 : o.caps;
  this.grid(o, W, 1, function (j, k) {
    var ph = TAU * k / W, r = r0 + (r1 - r0) * j;
    return [[r * sx * Math.cos(ph), h * j, r * sz * Math.sin(ph)], norm([Math.cos(ph) * h / sx, (r0 - r1), Math.sin(ph) * h / sz]), j];
  }, true);
  var oo;
  if (caps) {   // верхняя крышка
    oo = { col: col, x: x, y: y, z: z, rot: o.rot, gloss: o.gloss, ao: o.ao };
    if (r1 > 0.001) this.grid(oo, W, 1, function (j, k) { var ph = TAU * k / W, r = r1 * j; return [[r * sx * Math.cos(ph), h, r * sz * Math.sin(ph)], [0, 1, 0], 1]; }, true);
    if (r0 > 0.001 && caps > 1) this.grid(oo, W, 1, function (j, k) { var ph = TAU * k / W, r = r0 * j; return [[r * sx * Math.cos(ph), 0, r * sz * Math.sin(ph)], [0, -1, 0], 0]; }, false);
  }
  return this;
};
/* тор: t(цвет, x,y,z, R,r, {rot, w,h}) — кольцо лежит в плоскости XZ */
Geo.prototype.t = function (col, x, y, z, R, r, o) {
  o = o || {}; o.col = col; o.x = x; o.y = y; o.z = z;
  var W = o.w || 20, H = o.h || 7, sx = o.sx || 1, sz = o.sz || 1;
  this.grid(o, W, H, function (j, k) {
    var u = TAU * j / W, v = TAU * k / H, cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
    return [[(R + r * cv) * cu * sx, r * sv, (R + r * cv) * su * sz], norm([cv * cu, sv, cv * su]), 0.5];
  });
  return this;
};
/* коробка с отдельными гранями: b(цвет, x,y,z, sx,sy,sz, {rot}) */
Geo.prototype.b_ = function (col, x, y, z, sx, sy, sz, o) {
  o = o || {}; o.col = col; o.x = x; o.y = y; o.z = z;
  var hx = sx / 2, hy = sy / 2, hz = sz / 2;
  var faces = [[[1, 0, 0], [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]]],
               [[-1, 0, 0], [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]]],
               [[0, 1, 0], [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]]],
               [[0, -1, 0], [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]]],
               [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
               [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]];
  var self = this;
  faces.forEach(function (f) {
    var q = f[1], n = f[0];
    self.grid(o, 1, 1, function (j, k) {
      var idx = j === 0 ? (k === 0 ? 0 : 1) : (k === 0 ? 3 : 2);
      return [q[idx], n, 0.5];
    }, true);
  });
  return this;
};
Geo.prototype.build = function (rig, node, name) {
  var out = [], self = this;
  ['m', 'g'].forEach(function (key) {
    var b = self.b[key]; if (!b.p.length) return;
    var m = new rig.C.Mesh((name || node.name) + '_' + key, rig.scene);
    m.setVerticesData('position', new Float32Array(b.p), false);
    m.setVerticesData('normal', new Float32Array(b.n), false);
    m.setVerticesData('color', new Float32Array(b.c), false);
    m.setIndices(b.p.length / 3 > 65000 ? new Uint32Array(b.i) : new Uint16Array(b.i));
    m.material = key === 'g' ? rig.mats.g : rig.mats.m;
    m.parent = node; m.isPickable = false; m.checkCollisions = false; m.receiveShadows = false;
    m.doNotSyncBoundingInfo = false;
    rig.meshes.push(m); out.push(m);
  });
  return out;
};

/* ---------- общие детали: лицо ---------- */
/* большой мультяшный глаз, смотрит по +Z в локальных координатах (ставится через g.at) */
function eye(g, es, iris, o) {
  o = o || {};
  var wh = o.white || '#ffffff';
  g.e(wh, 0, 0, 0, es, es * 1.18, es * 0.34, { gloss: true, ao: 0 });
  g.e(iris, o.ix || 0, o.iy || -es * 0.06, es * 0.12, es * 0.8, es * 0.98, es * 0.3, { gloss: true, ao: 0, col2: o.iris2 || iris });
  g.e('#1b1b2a', o.ix || 0, o.iy || -es * 0.06, es * 0.22, es * 0.46, es * 0.6, es * 0.3, { gloss: true, ao: 0 });
  g.e('#ffffff', es * 0.28 + (o.ix || 0), es * 0.34, es * 0.42, es * 0.2, es * 0.2, es * 0.1, { gloss: true, ao: 0 });
  g.e('#ffffff', -es * 0.26 + (o.ix || 0), -es * 0.3, es * 0.4, es * 0.1, es * 0.1, es * 0.07, { gloss: true, ao: 0 });
}
/* поставить глаз на поверхность головы-эллипсоида (центр в 0,0,0) */
function eyeOn(g, R, x, y, es, iris, o) {
  var zz = R[2] * Math.sqrt(Math.max(0.05, 1 - (x / R[0]) * (x / R[0]) - (y / R[1]) * (y / R[1])));
  var n = norm([x / (R[0] * R[0]), y / (R[1] * R[1]), zz / (R[2] * R[2])]);
  var rot = [-Math.asin(clamp(n[1], -1, 1)), Math.atan2(n[0], n[2]), 0];
  g.at([x - n[0] * es * 0.12, y - n[1] * es * 0.12, zz - n[2] * es * 0.12], rot);
  eye(g, es, iris, o); g.end();
}
/* точка на эллипсоиде по углам (для пятен, бусин, чешуи) */
function surf(R, th, ph) {
  var st = Math.sin(th), ct = Math.cos(th), cp = Math.cos(ph), sp = Math.sin(ph);
  var p = [R[0] * st * cp, R[1] * ct, R[2] * st * sp], n = norm([st * cp / R[0], ct / R[1], st * sp / R[2]]);
  return { p: p, n: n, rot: [-Math.asin(clamp(n[1], -1, 1)), Math.atan2(n[0], n[2]), 0] };
}
/* пятнышко/блямба на поверхности эллипсоида с центром c */
function spot(g, col, c, R, th, ph, rx, ry, rz, o) {
  var s = surf(R, th, ph);
  g.at([c[0] + s.p[0], c[1] + s.p[1], c[2] + s.p[2]], s.rot); g.e(col, 0, 0, 0, rx, ry, rz, o); g.end();
}
function smile(g, col, y, z, w, n, o) {
  var i; o = o || {};
  for (i = 0; i < n; i++) {
    var t = (i / (n - 1)) * 2 - 1;
    g.e(col, t * w, y + t * t * w * 0.55, z - Math.abs(t) * w * 0.25, w * 0.13, w * 0.1, w * 0.08, { ao: 0, gloss: o.gloss });
  }
}
function star(g, col, x, y, z, s, o) {
  o = o || {}; o.gloss = true;
  g.e(col, x, y, z, s * 0.55, s * 0.55, s * 0.3, o);
  for (var i = 0; i < 5; i++) { var a = TAU * i / 5 + PI / 2; var oo = { gloss: true, w: 6, rot: [0, 0, a - PI / 2 + 0 ], ao: 0 };
    g.c(col, x - Math.cos(a) * 0.0, y, z, s * 0.38, 0.01, s * 1.25, { rot: [0, 0, a - PI / 2], gloss: true, w: 5, caps: 0, ao: 0 }); }
}

/* ============================================================
   СКЕЛЕТ: узлы + процедурная анимация (см. update ниже)
   ============================================================ */
function Rig(scene, C, mats, name) {
  this.scene = scene; this.C = C; this.mats = mats; this.meshes = []; this.nodes = {}; this.cfg = {};
  this.root = new C.TN(name, scene);
}
Rig.prototype.node = function (name, parent, x, y, z) {
  var n = new this.C.TN(this.root.name + '_' + name, this.scene);
  n.parent = parent || this.root; n.position.set(x || 0, y || 0, z || 0);
  this.nodes[name] = n; return n;
};
Rig.prototype.part = function (node, fn, name) {
  var g = new Geo(); fn(g); return g.build(this, node, name || node.name);
};

/* ============================================================
   ДВИЖОК: поиск классов Babylon в уже созданной сцене
   ============================================================ */
function getCtors(scene) {
  var B = window.BABYLON || {}, C = {};
  function find(list, cls) { for (var i = 0; i < list.length; i++) if (list[i].getClassName && list[i].getClassName() === cls) return list[i].constructor; }
  C.Mesh = B.Mesh || find(scene.meshes, 'Mesh');
  C.TN = B.TransformNode || find(scene.transformNodes, 'TransformNode');
  if (!C.TN) { var any = scene.meshes[0]; C.TN = null; }
  C.Std = B.StandardMaterial || find(scene.materials, 'StandardMaterial');
  var dm = null; for (var i = 0; i < scene.materials.length; i++) if (scene.materials[i].diffuseColor) { dm = scene.materials[i]; break; }
  C.C3 = B.Color3 || (dm && dm.diffuseColor.constructor);
  C.V3 = B.Vector3 || scene.activeCamera.position.constructor;
  if (!C.TN || !C.Mesh || !C.Std || !C.C3) return null;
  return C;
}

/* ============================================================
   ХРАНИЛИЩЕ ПРОГРЕССА (локально на устройстве)
   ============================================================ */
var LS_KEY = 'sevnpc.v1';
var state = { flags: {}, quests: {}, met: {} };
try { var raw = localStorage.getItem(LS_KEY); if (raw) { var s0 = JSON.parse(raw); if (s0 && typeof s0 === 'object') state = { flags: s0.flags || {}, quests: s0.quests || {}, met: s0.met || {} }; } } catch (e) {}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

/* ============================================================
   СОБЫТИЯ
   ============================================================ */
var listeners = {};
function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
function emit(ev, a, b) { (listeners[ev] || []).forEach(function (f) { try { f(a, b); } catch (e) { console.error(e); } }); }

/* ============================================================
   ЗАДАНИЯ (архитектура на вырост: простые шаги «поговорить / принести»)
   ============================================================ */
var questDefs = {};
var Quests = {
  register: function (q) { questDefs[q.id] = q; },
  status: function (id) { return state.quests[id] || 'new'; },
  start: function (id) { if (this.status(id) !== 'new') return false; state.quests[id] = 'active'; save(); toast('📜 Задание принято: ' + ((questDefs[id] || {}).title || id)); emit('quest:start', id); return true; },
  complete: function (id) { if (this.status(id) !== 'active') return false; state.quests[id] = 'done'; save(); toast('✅ Задание выполнено: ' + ((questDefs[id] || {}).title || id)); emit('quest:done', id); return true; },
  list: function () { return Object.keys(questDefs).map(function (k) { return { id: k, title: questDefs[k].title, status: Quests.status(k) }; }); }
};
/* условия вида 'q:id:active', 'f:flag', '!f:flag', 'met:npc' */
function cond(c) {
  if (c === undefined || c === null || c === true) return true;
  if (Array.isArray(c)) return c.every(cond);
  var neg = false; if (c[0] === '!') { neg = true; c = c.slice(1); }
  var p = c.split(':'), r = false;
  if (p[0] === 'q') r = Quests.status(p[1]) === p[2];
  else if (p[0] === 'f') r = !!state.flags[p[1]];
  else if (p[0] === 'met') r = !!state.met[p[1]];
  return neg ? !r : r;
}
/* действия вида 'quest:start:id', 'quest:done:id', 'flag:name' */
var customActions = {};
function act(a, npc) {
  if (typeof a === 'function') return a(npc, api);
  var p = String(a).split(':');
  if (p[0] === 'quest' && p[1] === 'start') Quests.start(p[2]);
  else if (p[0] === 'quest' && p[1] === 'done') Quests.complete(p[2]);
  else if (p[0] === 'flag') { state.flags[p[1]] = true; save(); }
  else if (customActions[p[0]]) customActions[p[0]](p.slice(1), npc, api);
  emit('action', a, npc);
}


/* ============================================================
   ИНТЕРФЕЙС: подсказка «Поговорить», маркеры, диалог, уведомления
   ============================================================ */
var CSS = '' +
'.npc-talk{bottom:calc(128px + var(--safe-b,0px)) !important;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;z-index:7 !important}' +
'.npc-talk[hidden]{display:none}' +
'.npcm{position:fixed;left:0;top:0;z-index:5;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
  'font-size:18px;background:rgba(255,248,224,.94);border:2px solid #e0b04a;box-shadow:0 3px 8px rgba(0,0,0,.3);pointer-events:none;opacity:0;transition:opacity .25s,transform .2s;will-change:transform}' +
'.npcm.on{opacity:1}.npcm.near{pointer-events:auto;cursor:pointer;background:linear-gradient(#ffe08a,#e0a030);border-color:#7a4a10;animation:npcm-b 1.2s ease-in-out infinite}' +
'@keyframes npcm-b{0%,100%{margin-top:-17px}50%{margin-top:-23px}}' +
'.npcd{position:fixed;inset:0;z-index:30;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;' +
  'padding:0 calc(10px + var(--safe-r,0px)) calc(10px + var(--safe-b,0px)) calc(10px + var(--safe-l,0px))}' +
'.npcd[hidden]{display:none}' +
'.npcd__panel{pointer-events:auto;position:relative;width:min(560px,100%);box-sizing:border-box;border:4px solid #e0b04a;border-radius:20px;color:#3b2410;' +
  'background:linear-gradient(#fff8e4,#f6e7c0);padding:16px 16px 14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.45);animation:npcd-in .28s ease-out;' +
  'font-family:"Trebuchet MS","Segoe UI",system-ui,-apple-system,Roboto,sans-serif}' +
'@keyframes npcd-in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}' +
'.npcd__top{display:flex;gap:12px;align-items:center;margin-bottom:8px}' +
'.npcd__port{flex:none;width:76px;height:76px;border-radius:50%;border:4px solid #e0b04a;background:#cfe9f2 center/cover no-repeat;box-shadow:0 3px 8px rgba(0,0,0,.3);margin-top:-44px}' +
'.npcd__name{font-size:21px;font-weight:800;line-height:1.1}' +
'.npcd__title{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#a36b00;font-weight:700;margin-top:2px}' +
'.npcd__text{margin:0 0 12px;font-size:17px;line-height:1.42;min-height:72px;max-height:34vh;overflow:auto;-webkit-overflow-scrolling:touch}' +
'.npcd__btns{display:flex;flex-direction:column;gap:8px}' +
'.npcd__b{cursor:pointer;font:inherit;font-weight:800;font-size:16px;color:#3b2410;border-radius:13px;padding:12px 14px;min-height:46px;' +
  'background:linear-gradient(#ffe08a,#e0a030);border:3px solid #7a4a10;box-shadow:0 3px #7a4a10;touch-action:manipulation}' +
'.npcd__b:active{transform:translateY(2px);box-shadow:0 1px #7a4a10}' +
'.npcd__b--alt{color:#ffe9c0;background:linear-gradient(#a06f3a,#7b4c24);border-color:#4a2a10;box-shadow:0 3px #34200c}' +
'.npcd__b--alt:active{box-shadow:0 1px #34200c}' +
'.npct{position:fixed;left:50%;top:calc(112px + var(--safe-t,0px));transform:translate(-50%,-12px);z-index:31;max-width:88vw;text-align:center;pointer-events:none;opacity:0;transition:opacity .3s,transform .3s;' +
  'background:rgba(255,248,224,.97);border:3px solid #e0b04a;border-radius:16px;padding:9px 16px;font:700 14px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#3b2410;box-shadow:0 5px 16px rgba(0,0,0,.35)}' +
'.npct.on{opacity:1;transform:translate(-50%,0)}' +
'@media (max-height:520px){.npcd__text{max-height:26vh;min-height:48px;font-size:15px}.npcd__port{width:56px;height:56px;margin-top:-30px}.npcd__b{padding:8px 12px;min-height:38px}}';

var ui = null;
function buildUI() {
  if (ui) return ui;
  var st = document.createElement('style'); st.id = 'npc-css'; st.textContent = CSS; document.head.appendChild(st);
  var talk = document.createElement('button'); talk.type = 'button'; talk.className = 'interact npc-talk'; talk.hidden = true; document.body.appendChild(talk);
  var dlg = document.createElement('div'); dlg.className = 'npcd'; dlg.hidden = true; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-live', 'polite');
  dlg.innerHTML = '<div class="npcd__panel"><div class="npcd__top"><div class="npcd__port"></div><div><div class="npcd__name"></div><div class="npcd__title"></div></div></div>' +
    '<p class="npcd__text"></p><div class="npcd__btns"></div></div>';
  document.body.appendChild(dlg);
  var toastEl = document.createElement('div'); toastEl.className = 'npct'; document.body.appendChild(toastEl);
  ui = { talk: talk, dlg: dlg, panel: dlg.firstChild, port: dlg.querySelector('.npcd__port'), name: dlg.querySelector('.npcd__name'), title: dlg.querySelector('.npcd__title'),
         text: dlg.querySelector('.npcd__text'), btns: dlg.querySelector('.npcd__btns'), toast: toastEl, markers: {} };
  talk.addEventListener('click', function () { M.talkNearest(); });
  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey) return;
    if (e.code === 'KeyE' && !M.dlg) M.talkNearest();
    else if (e.code === 'Escape' && M.dlg) M.closeDialog();
    else if ((e.code === 'Space' || e.code === 'Enter') && M.dlg && ui.text.dataset.typing === '1') { e.preventDefault(); skipType(); }
  });
  ui.text.addEventListener('click', function () { if (ui.text.dataset.typing === '1') skipType(); });
  return ui;
}
var toastTimer = 0;
function toast(msg) {
  buildUI(); ui.toast.textContent = msg; ui.toast.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { ui.toast.classList.remove('on'); }, 3400);
}
var typeTimer = 0, typeFull = '';
function typeText(s) {
  clearInterval(typeTimer); typeFull = s; var i = 0; ui.text.textContent = ''; ui.text.dataset.typing = '1';
  typeTimer = setInterval(function () {
    i += 2; ui.text.textContent = typeFull.slice(0, i);
    if (i >= typeFull.length) { clearInterval(typeTimer); ui.text.dataset.typing = '0'; showButtons(); }
  }, 28);
  ui.btns.innerHTML = '';
}
function skipType() { clearInterval(typeTimer); ui.text.textContent = typeFull; ui.text.dataset.typing = '0'; showButtons(); }
var pendingButtons = [];
function showButtons() {
  ui.btns.innerHTML = '';
  pendingButtons.forEach(function (b) {
    var el = document.createElement('button'); el.type = 'button'; el.className = 'npcd__b' + (b.alt ? ' npcd__b--alt' : ''); el.textContent = b.label;
    el.addEventListener('click', b.fn); ui.btns.appendChild(el);
  });
}

/* ============================================================
   NPC: поведение и процедурная анимация
   ============================================================ */
var defs = {};          // зарегистрированные жители
var M = null;           // менеджер (см. ниже)

function Npc(def, rig, mgr) {
  this.def = def; this.id = def.id; this.rig = rig; this.mgr = mgr;
  var sp = def.spawn; this.x = sp.x; this.z = sp.z; this.y = 0; this.heading = sp.heading || 0; this.speed = 0; this.phase = rnd(0, 6);
  this.mode = 'idle'; this.timer = rnd(1.5, 4); this.wp = 0; this.dir = 1; this.faceH = null; this.gest = null; this.gestTimer = rnd(5, 11);
  this.hy = 0; this.hp = 0; this.hr = 0; this.lookT = rnd(1.5, 4); this.lookY = 0; this.lookP = 0; this.t = rnd(0, 50);
  this.noticeCd = 0; this.talking = false; this.hopY = 0; this.vis = true; this.yieldT = 0;
  this.ex = {};          // произвольные переменные персонажа
}
Npc.prototype.gesture = function (type, dur) { if (this.gest && this.gest.type === type) return; this.gest = { type: type, t: 0, dur: dur || ({ wave: 2.6, hop: 0.95, laugh: 1.9, think: 3, shrug: 1.7, nod: 1.1 }[type] || 2) }; };
Npc.prototype.emote = function (name) {
  if (name === 'happy') this.gesture('hop'); else if (name === 'laugh') this.gesture('laugh'); else if (name === 'think') this.gesture('think');
  else if (name === 'shrug') this.gesture('shrug'); else if (name === 'wave') this.gesture('wave'); else if (name === 'nod') this.gesture('nod');
};

Npc.prototype.update = function (dt, pl) {
  /* Лассо: пока житель захвачен, обычный маршрут и AI не перетирают его позицию. */
  if (this.ex && this.ex.lassoHold) {
    this.speed = 0; this.mode = 'idle';
    this.rig.root.position.set(this.x, this.y, this.z);
    this.rig.root.rotation.y = this.heading;
    this.collider.position.set(this.x, this.y, this.z);
    return;
  }
  if (this.ex && this.ex.lassoFlight) {
    var lf = this.ex.lassoFlight; lf.t += dt; lf.vy -= 16 * dt;
    this.x += lf.vx * dt; this.z += lf.vz * dt; this.y += lf.vy * dt;
    if (this.y <= 0) { this.y = 0; if (lf.vy < -2) lf.vy = -lf.vy * .22; else lf.vy = 0; lf.vx *= .72; lf.vz *= .72; }
    this.heading = Math.atan2(lf.vx, lf.vz); this.speed = Math.hypot(lf.vx, lf.vz);
    lf.vx *= Math.exp(-2.5 * dt); lf.vz *= Math.exp(-2.5 * dt);
    this.rig.root.position.set(this.x, this.y, this.z); this.rig.root.rotation.y = this.heading;
    this.collider.position.set(this.x, this.y, this.z);
    if ((lf.t > .9 && Math.hypot(lf.vx, lf.vz) < .65 && this.y <= .01) || lf.t > 3.2) {
      this.ex.lassoFlight = null; this.collider.checkCollisions = !!this.vis; this.speed = 0; this.mode = 'idle'; this.timer = 2.5;
      this.gesture('hop');
    }
    return;
  }
  var d = this.def, rig = this.rig, cfg = rig.cfg, N = rig.nodes, route = d.route || [];
  this.t += dt;
  var dx = pl.x - this.x, dz = pl.z - this.z, dist = Math.hypot(dx, dz), bearing = Math.atan2(dx, dz);
  this.noticeCd -= dt; this.dist = dist;
  var vmax = d.speed || cfg.speed || 1.2, targetSpeed = 0, targetH = this.heading, turnRate = 3.2;

  /* ---- выбор режима ---- */
  if (this.ex.flee && this.ex.flee.t > 0 && !this.talking) { var fl = this.ex.flee; fl.t -= dt; fl.on = true; var g0 = M && M.game; if (g0 && g0._cbInWater && g0._cbInWater(this.x + Math.sin(fl.h) * 2.2, this.y, this.z + Math.cos(fl.h) * 2.2)) { fl.h += (this.id.length % 2 ? 1.6 : -1.6); } targetH = fl.h; targetSpeed = vmax * 2.4; turnRate = 8; this.mode = 'idle'; this.timer = 1; this.faceH = null; if (fl.t <= 0) fl.on = false; } else if (this.ex.departing && !this.talking) { var dst=this.ex.departTarget||{x:this.x,z:this.z}, dx2=dst.x-this.x,dz2=dst.z-this.z,dd=Math.hypot(dx2,dz2); if(dd<.8){this.mgr.despawn(this.id);return} targetH=Math.atan2(dx2,dz2);targetSpeed=vmax;turnRate=4.2; } else if (this.talking) {
    this.mode = 'talk'; targetH = bearing; turnRate = 3.0;
  } else if (this.mode === 'talk') {   // диалог закончился
    this.mode = 'idle'; this.timer = rnd(1.5, 3); this.faceH = null;
  } else if (this.mode === 'idle') {
    this.timer -= dt;
    if (dist < 8 && this.noticeCd <= 0) {          // заметил игрока: поворот, взмах рукой, радость
      this.noticeCd = 50; this.faceH = bearing; this.gesture(Math.random() < 0.3 ? 'hop' : 'wave'); this.timer = Math.max(this.timer, 2.8);
    }
    if (this.faceH !== null) targetH = this.faceH;
    else if (dist < 7 && Math.abs(angDiff(bearing, this.heading)) > 1.0) targetH = bearing;
    if (this.timer <= 0 && route.length > 1 && !this.gest) { this.mode = 'walk'; this.faceH = null; }
    else if (this.timer <= 0) this.timer = rnd(2, 5);
  } else if (this.mode === 'walk') {
    var w = route[this.wp] || route[0], tx = w.x - this.x, tz = w.z - this.z, td = Math.hypot(tx, tz);
    if (td < 0.25) {
      this.mode = 'idle'; var wt = w.wait || [3, 7]; this.timer = rnd(wt[0], wt[1]);
      this.faceH = w.face !== undefined ? w.face : null;
      if (route.length > 1) { this.wp += this.dir; if (this.wp >= route.length || this.wp < 0) { if (d.loop) this.wp = 0; else { this.dir = -this.dir; this.wp += this.dir * 2; } } }
      if (w.act) this.gesture(w.act);
    } else {
      targetH = Math.atan2(tx, tz);
      var diff = Math.abs(angDiff(targetH, this.heading));
      targetSpeed = vmax * clamp(1.15 - diff / 1.3, 0.15, 1);
      /* уступить дорогу игроку */
      var ahead = Math.abs(angDiff(bearing, this.heading)) < 1.1 && dist < 2.8;
      if (ahead) { targetSpeed = 0; this.yieldT += dt; if (this.yieldT > 3.5) { this.mode = 'idle'; this.timer = 1; this.yieldT = 0; } } else this.yieldT = 0;
    }
  }

  /* ---- движение ---- */
  this.speed = damp(this.speed, targetSpeed, 5, dt);
  if (this.speed < 0.02) this.speed = 0;
  var dh = angDiff(targetH, this.heading), step = clamp(dh * (1 - Math.exp(-5 * dt)), -turnRate * dt, turnRate * dt);
  this.heading += step;
  if (this.speed > 0) { this.x += Math.sin(this.heading) * this.speed * dt; this.z += Math.cos(this.heading) * this.speed * dt; }
  if (this.ex.flee && this.ex.flee.on) { var ob0 = M && M.game && M.game.world && M.game.world.ctx && M.game.world.ctx.obstacles; if (ob0 && ob0.resolve) { var pq = { x: this.x, z: this.z }; try { if (ob0.resolve(pq, 0.5)) { this.x = pq.x; this.z = pq.z; } } catch (e) {} } }
  this.phase += this.speed * dt * (cfg.freq || 2.4);
  var moving = clamp(this.speed / vmax, 0, 1), turning = clamp(Math.abs(dh) / 0.8, 0, 1) * (1 - moving);

  /* ---- жесты ---- */
  var gw = 0, gg = 0, gt = null;
  if (this.gest) {
    this.gest.t += dt; gg = this.gest.t / this.gest.dur;
    if (gg >= 1) this.gest = null; else { gw = smooth(0, 0.14, gg) * (1 - smooth(0.82, 1, gg)); gt = this.gest.type; }
  } else if (!this.talking && this.mode === 'idle') {
    this.gestTimer -= dt;
    if (this.gestTimer <= 0) {
      this.gestTimer = rnd(7, 16); var list = d.idleGestures || cfg.idleGestures || ['think', 'shrug', 'hop', 'laugh', 'wave'];
      this.gesture(list[Math.floor(Math.random() * list.length)]);
    }
  }
  if (this.talking && !this.gest) { this.gestTimer -= dt; if (this.gestTimer <= 0) { this.gestTimer = rnd(2.2, 4); this.gesture(Math.random() < 0.5 ? 'nod' : 'shrug'); } }

  /* ---- взгляд ---- */
  var tgtY, tgtP;
  if (dist < 10 || this.talking) { tgtY = clamp(angDiff(bearing, this.heading), -1.0, 1.0); tgtP = clamp(-0.05 + (pl.y + 1.4 - (this.y + 1.5)) * -0.03, -0.25, 0.25); }
  else {
    this.lookT -= dt; if (this.lookT <= 0) { this.lookT = rnd(1.8, 5); this.lookY = Math.random() < 0.35 ? 0 : rnd(-0.8, 0.8); this.lookP = rnd(-0.12, 0.15); }
    tgtY = this.lookY; tgtP = this.lookP;
  }
  this.hy = damp(this.hy, tgtY, 5, dt); this.hp = damp(this.hp, tgtP, 5, dt);

  /* ---- поза ---- */
  var sw = Math.sin(this.phase), t = this.t, hop = cfg.hopLoco ? Math.abs(Math.sin(this.phase * 0.5)) : 0;
  var bob = cfg.hopLoco ? hop * 0.22 * moving : Math.abs(sw) * 0.05 * moving * (cfg.bob || 1);
  var gHop = (gt === 'hop') ? Math.sin(clamp(gg * 1.0, 0, 1) * PI) * 0.55 * smooth(0, 0.05, gg) : 0;
  var breathe = Math.sin(t * 2.1) * 0.012;
  var tor = N.torso, hd = N.head;
  var float = cfg.float ? (cfg.float + Math.sin(t * 1.6) * 0.07) : 0;
  this.hopY = bob + gHop + float;
  var squash = gt === 'hop' ? (1 - 0.1 * Math.sin(gg * PI * 2) * (gg < 0.5 ? 1 : 0.4)) : 1;
  if (tor) {
    tor.position.y = (cfg.torsoY || 0) + (cfg.hopLoco ? 0 : bob * 0.6);
    tor.rotation.z = sw * 0.06 * moving * (cfg.waddle || 1) + (gt === 'laugh' ? Math.sin(t * 24) * 0.03 * gw : 0) + (gt === 'shrug' ? Math.sin(gg * 6) * 0.04 * gw : 0);
    tor.rotation.x = 0.07 * moving + (gt === 'laugh' ? -0.2 * gw : 0) + (gt === 'nod' ? Math.sin(gg * PI * 2) * 0.05 : 0);
    tor.scaling.y = (1 + breathe) * squash; tor.scaling.x = tor.scaling.z = 1 / Math.sqrt(squash);
  }
  if (hd) {
    var nod = gt === 'nod' ? Math.sin(gg * PI * 2) * 0.28 : 0;
    hd.rotation.y = this.hy; hd.rotation.x = this.hp + nod + (gt === 'laugh' ? -0.3 * gw : 0) + (gt === 'think' ? 0.1 * gw : 0) - 0.04 * moving;
    hd.rotation.z = (gt === 'think' ? 0.28 * gw : 0) + (gt === 'laugh' ? Math.sin(t * 24) * 0.04 * gw : 0) + (gt === 'shrug' ? 0.12 * gw * Math.sin(gg * 5) : 0) + sw * 0.03 * moving;
  }
  /* ноги */
  var lsw = cfg.hopLoco ? 0 : 0.75;
  if (N.legA) { N.legA.rotation.x = sw * lsw * moving + (cfg.hopLoco ? -hop * 0.5 * moving : 0); }
  if (N.legB) { N.legB.rotation.x = -sw * lsw * moving + (cfg.hopLoco ? -hop * 0.5 * moving : 0); }
  /* руки: базовая поза + шаги + жесты */
  var base = cfg.arms || {}, bA = base.A || [0, 0.1], bB = base.B || [0, -0.1], free = cfg.armsFree || { A: 1, B: 1 };
  var asw = (cfg.hopLoco ? 0 : 0.6) * moving, armA = [bA[0], bA[1]], armB = [bB[0], bB[1]];
  if (free.A) armA[0] += -sw * asw; if (free.B) armB[0] += sw * asw;
  var waveArm = cfg.waveArm === 'B' ? 'B' : 'A', wa = waveArm === 'A' ? armA : armB, ws = waveArm === 'A' ? 1 : -1;
  if (gt === 'wave') { wa[1] = lerp(wa[1], ws * (2.35 + Math.sin(t * 11) * 0.35), gw); wa[0] = lerp(wa[0], -0.15, gw); }
  else if (gt === 'hop') { if (free.A) { armA[1] = lerp(armA[1], 1.5, gw); } if (free.B) { armB[1] = lerp(armB[1], -1.5, gw); } }
  else if (gt === 'think') { wa[0] = lerp(wa[0], -2.0, gw); wa[1] = lerp(wa[1], ws * 0.35, gw); }
  else if (gt === 'shrug') { if (free.A) armA[1] = lerp(armA[1], 0.95, gw); if (free.B) armB[1] = lerp(armB[1], -0.95, gw); }
  else if (gt === 'laugh') { if (free.A) armA[0] = lerp(armA[0], -0.7, gw); if (free.B) armB[0] = lerp(armB[0], -0.7, gw); }
  else if (this.talking && !gt && free.A) { armA[0] += Math.sin(t * 3) * 0.12; armA[1] += 0.12; }
  if (N.armA) { N.armA.rotation.x = armA[0]; N.armA.rotation.z = armA[1]; }
  if (N.armB) { N.armB.rotation.x = armB[0]; N.armB.rotation.z = armB[1]; }
  /* уши / хвост / крылья — мелкая «живость» */
  var ewig = Math.sin(t * 2.7 + this.id.length) * 0.05 + (gt === 'wave' ? Math.sin(t * 9) * 0.06 * gw : 0) + (gt === 'hop' ? 0.2 * gw : 0);
  if (N.earA) { N.earA.rotation.z = (cfg.earBase || 0) + ewig; N.earA.rotation.x = Math.sin(t * 1.3) * 0.03; }
  if (N.earB) { N.earB.rotation.z = -(cfg.earBase || 0) - ewig * 0.9; N.earB.rotation.x = Math.sin(t * 1.1 + 1) * 0.03; }
  if (N.tail) { N.tail.rotation.y = Math.sin(t * 2.2) * 0.22 + sw * 0.15 * moving; N.tail.rotation.x = Math.sin(t * 1.4) * 0.05 - 0.04 * moving; }
  if (rig.extra) rig.extra(this, dt, { t: t, gt: gt, gw: gw, gg: gg, moving: moving, sw: sw, hop: hop });

  /* ---- мир ---- */
  var gy = M && M.groundY ? M.groundY(this.x, this.z) : 0; this.y = damp(this.y, gy, 8, dt);
  rig.root.position.set(this.x, this.y + this.hopY, this.z);
  rig.root.rotation.y = this.heading;
  if (this.collider) { this.collider.position.set(this.x, this.y, this.z); }
  if (this.blob) { this.blob.position.set(this.x, gy + 0.03, this.z); var bs = 1 - this.hopY * 0.35; this.blob.scaling.set(bs, 1, bs); }
};

/* v186: def.post(npc, dt) — модули дополняют позу после обычного обновления (рыбаки сидят и т.п.). Ставится последним. */
function installPostHook(){if(Npc.prototype.__postHook)return;var base=Npc.prototype.update;Npc.prototype.update=function(dt,pl){base.call(this,dt,pl);if(this.def&&this.def.post&&this.rig){try{this.def.post(this,dt)}catch(e){}}};Npc.prototype.__postHook=1}
setTimeout(installPostHook,0);
/* ============================================================
   NPC MANAGER
   ============================================================ */
function makeMaterials(scene, C) {
  var m = new C.Std('npcMat', scene); m.diffuseColor = new C.C3(1, 1, 1); m.specularColor = new C.C3(0.1, 0.1, 0.1); m.specularPower = 20; m.emissiveColor = new C.C3(0.17, 0.17, 0.17);
  var g = new C.Std('npcGloss', scene); g.diffuseColor = new C.C3(1, 1, 1); g.specularColor = new C.C3(0.85, 0.85, 0.85); g.specularPower = 70; g.emissiveColor = new C.C3(0.17, 0.17, 0.17);
  var b = new C.Std('npcBlob', scene); b.diffuseColor = new C.C3(0, 0, 0); b.specularColor = new C.C3(0, 0, 0); b.emissiveColor = new C.C3(0, 0, 0); b.disableLighting = true; b.zOffset = -3; b.backFaceCulling = false;
  b.alpha = 0.999; // включает смешивание, итоговая прозрачность — в цвете вершин
  return { m: m, g: g, b: b };
}

M = {
  game: null, scene: null, C: null, mats: null, list: [], pending: [], dlg: null, near: null, obs: null, groundY: null, lastCheck: 0, shadowOn: true,
  bind: function (g) {
    var scene = g.scene, C = getCtors(scene);
    if (!C) { console.warn('[SevNPC] не найдены классы Babylon'); return; }
    this.game = g; this.scene = scene; this.C = C; this.mats = makeMaterials(scene, C); this.list = []; this.pending = []; this.near = null; this.dlg = null;
    this.sceneId = g.def && g.def.id; this.groundY = null;
    buildUI(); ui.talk.hidden = true;
    var self = this;
    Object.keys(defs).forEach(function (id) { if (defs[id].scene === self.sceneId) self.pending.push(defs[id]); });
    this.obs = scene.onBeforeRenderObservable.add(function () { self.frame(); });
    scene.onDisposeObservable.add(function () { if (self.scene === scene) self.unbind(); });
  },
  unbind: function () {
    this.closeDialog(true); this.list = []; this.pending = []; this.scene = null; this.game = null; this.near = null;
    if (ui) { ui.talk.hidden = true; Object.keys(ui.markers).forEach(function (k) { ui.markers[k].classList.remove('on'); }); }
  },
  spawn: function (def) {
    var scene = this.scene, C = this.C, rig = new Rig(scene, C, this.mats, 'npc_' + def.id);
    def.build(rig, C); addNPCPlushDetails(def, rig);
    var sc = (def.scale || 1.15) * 1.2; rig.root.scaling.set(sc, sc, sc);
    var n = new Npc(def, rig, this); n.sc = sc;
    n.y = this.groundY ? this.groundY(n.x, n.z) : 0;
    rig.root.position.set(n.x, n.y, n.z); rig.root.rotation.y = n.heading;
    /* невидимый коллайдер: игрок не проходит сквозь жителя */
    var col = new C.Mesh('npcCol_' + def.id, scene);
    var r = (def.radius || 0.55) * sc, h = (def.height || 2.4) * sc, seg = 8, p = [], idx = [], i;
    for (i = 0; i < seg; i++) { var a = TAU * i / seg; p.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * r, h, Math.sin(a) * r); }
    for (i = 0; i < seg; i++) { var i2 = (i + 1) % seg, a0 = i * 2, a1 = a0 + 1, b0 = i2 * 2, b1 = b0 + 1; idx.push(a0, a1, b0, b0, a1, b1, b0, a1, a0, b1, a1, b0); }
    var nrm = []; for (i = 0; i < p.length / 3; i++) nrm.push(0, 1, 0);
    col.setVerticesData('position', new Float32Array(p), false); col.setVerticesData('normal', new Float32Array(nrm), false); col.setIndices(new Uint16Array(idx));
    col.isVisible = false; col.isPickable = false; col.checkCollisions = true;
    n.collider = col; col.position.set(n.x, n.y, n.z);
    /* мягкая тень под ногами */
    var blob = new C.Mesh('npcBlob_' + def.id, scene), bp = [0, 0, 0], bc = [0, 0, 0, 0.34], bi = [], br = (def.radius || 0.55) * sc * 1.7, bn = [0, 1, 0];
    for (i = 0; i < 12; i++) { var aa = TAU * i / 12; bp.push(Math.cos(aa) * br, 0, Math.sin(aa) * br); bc.push(0, 0, 0, 0); bn.push(0, 1, 0); bi.push(0, 1 + i, 1 + (i + 1) % 12); }
    blob.setVerticesData('position', new Float32Array(bp), false); blob.setVerticesData('normal', new Float32Array(bn), false); blob.setVerticesData('color', new Float32Array(bc), false);
    blob.setIndices(new Uint16Array(bi)); blob.hasVertexAlpha = true; blob.material = this.mats.b; blob.isPickable = false; blob.alphaIndex = 5;
    n.blob = blob;
    /* тени от солнца только для крупных деталей */
    var sh = this.game.world && this.game.world.shadows;
    if (sh && sh.addShadowCaster && rig.nodes.torso) {
      rig.meshes.forEach(function (m) { var pn = m.parent && m.parent.name; if (/torso$|head$|leg[AB]$/.test(pn || '')) sh.addShadowCaster(m); });
    }
    this.list.push(n); emit('spawn', n);
    return n;
  },
  despawn: function (id) {
    for (var i = 0; i < this.list.length; i++) if (this.list[i].id === id) {
      var n = this.list[i]; if (this.dlg && this.dlg.npc === n) this.closeDialog();
      n.rig.meshes.forEach(function (m) { m.dispose(); }); n.rig.root.getChildTransformNodes && n.rig.root.getChildTransformNodes().forEach(function (t) { t.dispose(); });
      n.rig.root.dispose(); n.collider.dispose(); n.blob.dispose(); this.list.splice(i, 1); emit('despawn', id); return true;
    }
    return false;
  },
  get: function (id) { for (var i = 0; i < this.list.length; i++) if (this.list[i].id === id) return this.list[i]; return null; },
  frame: function () {
    var g = this.game, scene = this.scene; if (!g || !scene || scene.isDisposed || !g.player) return;
    var dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000 || 0.016), pp = g.player.position, pl = { x: pp.x, y: pp.y, z: pp.z };
    /* жители появляются по мере приближения к локации (по одному за кадр) */
    if (this.pending.length) {
      for (var i = 0; i < this.pending.length; i++) {
        var d = this.pending[i], sp = d.spawn;
        if (pl.y < 30 && Math.hypot(sp.x - pl.x, sp.z - pl.z) < (d.spawnRadius || 95)) { this.pending.splice(i, 1); this.spawn(d); break; }
      }
    }
    this._dsT = (this._dsT || 0) + dt; if (this._dsT > 1) { this._dsT = 0; for (var di = this.list.length - 1; di >= 0; di--) { var nn = this.list[di]; if ((!this.dlg || this.dlg.npc !== nn) && Math.hypot(nn.x - pl.x, nn.z - pl.z) > ((nn.def.spawnRadius || 95) + 70)) { var dd = nn.def; this.despawn(nn.id); this.pending.push(dd); } } }
    var best = null, bd = 1e9;
    for (var k = 0; k < this.list.length; k++) {
      var n = this.list[k]; if (n._vehicleDeadUntil) { if (performance.now() < n._vehicleDeadUntil) continue; var home = n.def.spawn; n.x=home.x; n.z=home.z; n.y=this.groundY?this.groundY(n.x,n.z):0; n.heading=home.heading||0; n.speed=0; n.mode=`idle`; n.timer=2; n.ex={}; n._vehicleDeadUntil=0; if(window.__sevGame&&window.__sevGame._npcCartoonSound)window.__sevGame._npcCartoonSound(`respawn`); n.rig.root.position.set(n.x,n.y,n.z); n.rig.root.rotation.y=n.heading; n.rig.root.scaling.setAll(n.sc); n.collider.position.set(n.x,n.y,n.z); n.collider.checkCollisions=!0; n.rig.root.setEnabled(!0); n.blob.setEnabled(!0); n.vis=!0; } var far = Math.hypot(n.x - pl.x, n.z - pl.z);
      var vis = far < 110; if (vis !== n.vis) { n.vis = vis; n.rig.root.setEnabled(vis); n.blob.setEnabled(vis); n.collider.checkCollisions = vis; }
      if (!vis) continue;
      n.talking = !!(this.dlg && this.dlg.npc === n);
      if (!this.freeze) n.update(dt, pl);
      if (n.ex && (n.ex.lassoHold || n.ex.lassoFlight)) continue;
      var tr = n.def.talkRadius || 5.2;
      if (far < tr && far < bd) { bd = far; best = n; }
    }
    this.near = best;
    this.syncUI(pl);
  },
  blocked: function () {
    var g = this.game; if (!g) return true;
    if (this.dlg || g.ferris) return true;
    if (g.card && g.card.isOpen) return true;
    if (document.body.classList.contains('in-shop')) return true;
    var q = document.getElementById('qpanel'); if (q && !q.hidden) return true;
    return false;
  },
  syncUI: function (pl) {
    var blocked = this.blocked(), n = this.near;
    if (!ui) return;
    var show = !!n && !blocked;
    if (show) { var txt = '💬 Поговорить: ' + n.def.name; if (ui.talk.textContent !== txt) ui.talk.textContent = txt; }
    if (ui.talk.hidden === show) ui.talk.hidden = !show;
    /* значки над головами жителей */
    var scene = this.scene, eng = scene.getEngine(), cam = scene.activeCamera, vm = scene.getTransformMatrix().m, W = eng.getRenderWidth(), H = eng.getRenderHeight();
    var canvas = eng.getRenderingCanvas(), cw = canvas.clientWidth, ch = canvas.clientHeight, rect = canvas.getBoundingClientRect();
    for (var i = 0; i < this.list.length; i++) {
      var q = this.list[i], el = ui.markers[q.id];
      if (!el) { el = document.createElement('div'); el.className = 'npcm'; el.textContent = '💬'; document.body.appendChild(el); ui.markers[q.id] = el; (function (qq) { el.addEventListener('click', function () { if (M.near === qq) M.talk(qq); else toast('Подойди ближе к ' + qq.def.name); }); })(q); }
      var on = q.vis && !blocked && q.dist < 16;
      if (on) {
        var x = q.x, y = q.y + (q.def.height || 2.4) * q.sc + 0.55 + q.hopY, z = q.z;
        var cx = x * vm[0] + y * vm[4] + z * vm[8] + vm[12], cy = x * vm[1] + y * vm[5] + z * vm[9] + vm[13], cw_ = x * vm[3] + y * vm[7] + z * vm[11] + vm[15];
        if (cw_ <= 0.01) on = false;
        else { var sx = (cx / cw_ * 0.5 + 0.5) * cw + rect.left, sy = (1 - (cy / cw_ * 0.5 + 0.5)) * ch + rect.top;
          if (sx < -20 || sx > window.innerWidth + 20 || sy < -20 || sy > window.innerHeight + 20) on = false; else el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)'; }
      }
      el.classList.toggle('on', on); el.classList.toggle('near', on && this.near === q);
    }
  },
  talkNearest: function () { if (this.near && !this.blocked()) this.talk(this.near); },

  /* ---------- диалог ---------- */
  talk: function (n) {
    if (this.dlg) return; var g = this.game, def = n.def;
    buildUI();
    this.dlg = { npc: n, node: null };
    try { g.input.setEnabled(false); g.input.clear && g.input.clear(); } catch (e) {}
    ui.talk.hidden = true;
    ui.name.textContent = def.name; ui.title.textContent = def.title || '';
    var pic = window.SEV_NPC_PORTRAITS && window.SEV_NPC_PORTRAITS[def.portrait || def.id];
    ui.port.style.backgroundImage = pic ? 'url(' + pic + ')' : 'none';
    ui.dlg.hidden = false;
    var first = !state.met[def.id]; state.met[def.id] = true; save();
    var dlg = def.dialog || {}, entry = dlg.start, id = null;
    if (Array.isArray(entry)) { for (var i = 0; i < entry.length; i++) if (cond(entry[i]['if'])) { id = entry[i].go; break; } } else id = entry || 'hello';
    n.gesture('wave'); emit('dialog:open', n);
    this.showNode(id || 'hello');
  },
  showNode: function (id) {
    var D = this.dlg; if (!D) return; var n = D.npc, node = (n.def.dialog.nodes || {})[id];
    if (!node) { this.closeDialog(); return; }
    D.node = id;
    if (node.once) act(node.once, n);
    if (node['do']) [].concat(node['do']).forEach(function (a) { act(a, n); });
    if (node.emote) n.emote(node.emote);
    var self = this; pendingButtons = [];
    var ch = (node.choices || []).filter(function (c) { return cond(c['if']); });
    if (ch.length) ch.forEach(function (c) {
      pendingButtons.push({ label: c.label, alt: !!c.alt, fn: function () { if (c.emote) n.emote(c.emote); if (c['do']) [].concat(c['do']).forEach(function (a) { act(a, n); }); if (c.next) self.showNode(c.next); else self.closeDialog(); } });
    });
    else {
      if (node.next) pendingButtons.push({ label: 'Продолжить', fn: function () { self.showNode(node.next); } });
      pendingButtons.push({ label: 'Попрощаться', alt: true, fn: function () { n.emote('wave'); self.closeDialog(); } });
    }
    var txt = typeof node.text === 'function' ? node.text(n, api) : node.text;
    if (id === 'hello' && !D.mem) { D.mem = 1; try { var rm = window.SevChaos && window.SevChaos.remark && window.SevChaos.remark(n.def.id, n.def.name); if (rm) txt = rm + '\n\n' + txt; } catch (e) {} }
    typeText(txt);
  },
  closeDialog: function (silent) {
    if (!this.dlg) return; var n = this.dlg.npc; this.dlg = null;
    clearInterval(typeTimer); if (ui) ui.dlg.hidden = true;
    try { if (!silent && this.game && this.game.input) this.game.input.setEnabled(true); } catch (e) {}
    emit('dialog:close', n);
  }
};

/* ============================================================
   ПРИВЯЗКА К ИГРЕ: ждём window.__sevGame, переподключаемся при смене сцены
   ============================================================ */
setInterval(function () {
  var g = window.__sevGame;
  if (g && g.scene && !g.scene.isDisposed && g.world && g.player && g !== M.game) { try { M.bind(g); } catch (e) { console.error('[SevNPC]', e); } }
}, 400);

/* ============================================================
   ПУБЛИЧНЫЙ API
   ============================================================ */
var baseNpcUpdate=Npc.prototype.update;Npc.prototype.update=function(dt,pl){baseNpcUpdate.call(this,dt,pl);var d=this.def,N=this.rig.nodes;if(d.sleepy){var dx=pl.x-this.x,dz=pl.z-this.z,dist=Math.hypot(dx,dz);if(dist<5){if(!this.ex.awakeUntil||this.ex.awakeUntil<=this.t)this.gesture('hop');this.ex.awakeUntil=this.t+5}if(dist>7&&this.ex.awakeUntil<this.t)this.ex.awakeUntil=0;var want=this.ex.awakeUntil>this.t?0:1;this.ex.sleep=damp(this.ex.sleep===undefined?1:this.ex.sleep,want,2.8,dt);var sl=this.ex.sleep;if(N.sleepLids)N.sleepLids.setEnabled(sl>.55);if(N.sleepCurl)N.sleepCurl.setEnabled(sl>.35);if(N.torso){N.torso.rotation.z=N.torso.rotation.z*(1-sl)+1.12*sl;N.torso.position.y=N.torso.position.y*(1-sl)+.3*sl}if(N.head)N.head.rotation.z+=.2*sl;if(N.armA){N.armA.rotation.x=N.armA.rotation.x*(1-sl)-1.15*sl;N.armA.rotation.z=N.armA.rotation.z*(1-sl)-.6*sl}if(N.armB){N.armB.rotation.x=N.armB.rotation.x*(1-sl)-1.15*sl;N.armB.rotation.z=N.armB.rotation.z*(1-sl)+.6*sl}if(N.legA)N.legA.rotation.x=N.legA.rotation.x*(1-sl)+.75*sl;if(N.legB)N.legB.rotation.x=N.legB.rotation.x*(1-sl)+.75*sl;if(sl>.7){this.gest=null;this.speed=0}}if(d.ballPair){var mate=this.mgr&&this.mgr.get(d.ballMate);if(mate){var dx=mate.x-this.x,dz=mate.z-this.z;this.heading=Math.atan2(dx,dz);this.rig.root.rotation.y=this.heading;this.mode='idle';this.speed=0;if(N.ball){var u=(this.t*.42)%2;u=u<1?u:2-u;var lx=dx*Math.cos(this.heading)-dz*Math.sin(this.heading),lz=dx*Math.sin(this.heading)+dz*Math.cos(this.heading);N.ball.position.set(lx*u,.3+Math.sin(u*Math.PI)*.85,lz*u);N.ball.rotation.x+=dt*4;N.ball.rotation.z+=dt*3}var beat=Math.sin(this.t*2.6);if(N.armA){N.armA.rotation.x=-.22+Math.max(0,beat)*.55;N.armA.rotation.z=-.38}if(N.armB){N.armB.rotation.x=-.22+Math.max(0,-beat)*.55;N.armB.rotation.z=.38}}}};var preWaterKnockUpdate=Npc.prototype.update;Npc.prototype.update=function(dt,pl){preWaterKnockUpdate.call(this,dt,pl);var w=this.ex.waterKnock;if(!w)return;w.t+=dt;var k=Math.max(0,1-w.t/w.dur);this.x+=w.vx*dt;this.z+=w.vz*dt;w.vx*=Math.max(0,1-dt*3.4);w.vz*=Math.max(0,1-dt*3.4);var tor=this.rig.nodes.torso;if(tor)tor.rotation.z+=Math.sin(Math.min(1,w.t/.28)*Math.PI)*.95*(this.id.length%2?-1:1);if(w.t>=w.dur){if(tor)tor.rotation.z=0;this.ex.waterKnock=null;this.gesture('hop')}};var api = window.SevNPC = {
  version: '1.0',
  getAll: function () { return M && M.list ? M.list : []; },
  waterBlast: function(origin,dir,range,width,pitch,speed,gravity){if(!M||!M.list)return 0;var count=0;for(var i=0;i<M.list.length;i++){var n=M.list[i],dx=n.x-origin.x,dz=n.z-origin.z,along=dx*dir.x+dz*dir.z,side=Math.abs(dx*dir.z-dz*dir.x),t=along/(speed*Math.cos(pitch)),jetY=origin.y+speed*Math.sin(pitch)*t-.5*gravity*t*t,bodyY=n.y+1.05;if(along>-.6&&along<range&&side<width+.55&&jetY>n.y-.1&&jetY<bodyY+1.1){n.ex.waterKnock={t:0,dur:.95,vx:dir.x*(7+Math.random()*3)-(side<.2?0:Math.sign(dx*dir.z-dz*dir.x)*2),vz:dir.z*(7+Math.random()*3)+(side<.2?0:Math.sign(dx*dir.z-dz*dir.x)*2)};n.speed=0;n.mode='idle';n.timer=3;n.gesture('hop');if(n.def.sleepy){n.ex.awakeUntil=n.t+5;n.ex.sleep=0}count++}}return count},
  scold: function (x, z, o) {
    if (!M || !M.list || M.dlg) return 0; o = o || {};
    var now = performance.now(), R = o.r || 6, near = [], i;
    for (i = 0; i < M.list.length; i++) {
      var n = M.list[i]; if (!n.vis || n.talking || n.mode === 'talk' || n._vehicleDeadUntil || n.ex.departing) continue;
      var d = Math.hypot(n.x - x, n.z - z); if (d > R) continue;
      if (n.ex.scoldT && now - n.ex.scoldT < 7000) continue;
      near.push({ n: n, d: d });
    }
    if (!near.length) return 0;
    near.sort(function (a, b) { return a.d - b.d; });
    var LS = {
      mushroom: ['Юный лис, это не спортивный снаряд!', 'Моя шляпка! Не размахивай тут!', 'Безобразие! Я пожалуюсь грибной управе.'],
      turtle: ['Юнга! Швартуй свою ношу немедленно!', 'Капитан не любит, когда летает палубный груз!', 'Тише, тише, это порт, а не шторм!'],
      sonya: ['Чик-чирик! Я улетаю, а ты не кидайся!', 'Ой-ой, мои пёрышки!', 'Хулиган! Всё расскажу чайкам!'],
      fox: ['Эй, братец, это же не мячик!', 'Искрик, ну что за цирк?!', 'Поставь на место, а то хвост дрожит!'],
      rabbit: ['Ой-ой-ой, спасайся кто может!', 'Мои уши! Мимо, мимо!', 'Я тихий кролик, не надо в меня!'],
      robot: ['Предупреждение: летящий объект. Бип!', 'Обнаружен хулиган. Бип-бип.', 'Уровень опасности: лис с урной.'],
      ducky: ['Кря-кря! Ты что творишь?!', 'Кря! Я таких манер не одобряю!'],
      raccoon: ['Это не я! И не кидай в меня!', 'Эй, поделись, а не кидайся!'],
      fairy: ['Ай! Мои крылышки!', 'Осторожнее, пыльца осыплется!'],
      crystal: ['Осторожно, я хрупкий!', 'Звенит от страха всеми гранями!'],
      octo: ['Бульк! Восемь рук, и все уворачиваются!', 'Тише, а то уплыву в море!'],
      toy: ['Ух ты! …Ой, не попади!', 'Эй, поаккуратнее с игрушками!']
    };
    var GEN = ['Эй! Поосторожнее!', 'Ты что творишь?!', 'Караул! Нас сейчас зашибут!', 'Положи на место, хулиган!', 'Что за безобразие!', 'Лисёнок, ну нельзя так размахивать!', 'Я мирный житель, не трогай меня!'];
    var pick = function (a) { return a[(Math.random() * a.length) | 0]; };
    near.forEach(function (c, idx) {
      var n = c.n, ang = Math.atan2(n.x - x, n.z - z) + (Math.random() - 0.5) * 0.9;
      n.ex.scoldT = now; n.ex.flee = { t: 1.6 + Math.random() * 1.6 + (o.big ? 1 : 0), h: ang, on: false };
      n.speed = 0; n.faceH = null;
      try { n.gesture(idx === 0 ? 'shrug' : pick(['hop', 'shrug'])); } catch (e) {}
      if (idx < 2) {
        var arr = (LS[n.id] && Math.random() < 0.6) ? LS[n.id] : GEN;
        var say = function () { if (!M.dlg) toast(n.def.name + ': «' + pick(arr) + '»'); };
        if (idx === 0) { if (now - (api._scT || 0) > 2600) { api._scT = now; say(); } }
        else setTimeout(say, 1100);
      }
      try { window.dispatchEvent(new CustomEvent('sev:npcnoise', { detail: { id: n.id } })); } catch (e) {}
    });
    return near.length;
  },
  noise: function (x, z, power) {
    if (!M || !M.list || M.dlg) return 0;
    var now = performance.now(); var lv = (window.SevChaos && window.SevChaos.level && window.SevChaos.level()) || 0; if (now - (api._nzT || 0) < 14000 - lv * 70) return 0;
    var strong = power >= 1.2, near = [];
    for (var i = 0; i < M.list.length; i++) {
      var n = M.list[i]; if (n.talking || n.mode === 'talk' || !n.vis) continue;
      if (n.ex.noiseT && now - n.ex.noiseT < 45000) continue;
      var d = Math.hypot(n.x - x, n.z - z); if (d < 15) near.push({ n: n, d: d });
    }
    if (!near.length || Math.random() > (strong ? 0.5 : 0.22) + lv / 250) return 0;
    near.sort(function (a, b) { return a.d - b.d; });
    var L = {
      mushroom: ['Я даже спрашивать не буду, что здесь произошло.', 'Я надеялся, что ты немного повзрослеешь…', 'Ящики, юный лис, не мячики.', 'Кхм. Записываю в журнал: «опять грохот».', 'Тихо! У меня шляпка дрожит.'],
      turtle: ['Моя удочка! …Ах, это не она. Уф.', 'Грохот на всю бухту! Рыба обиделась.', 'Эй, юнга, тише на поворотах!', 'Салют в честь ящика! Пли!', 'Я думал, это шторм. А это ты.'],
      sonya: ['Не смотри на меня так. Это не я!', 'Разбили ящик? А бутерброды там были?', 'Чик-чирик! Мне почудился запах крошек.', 'Я ничего не видела. Я просто чайка.'],
      fox: ['Хвост дрогнул от грохота!', 'Опять Искрик? Надо было догадаться.', 'Ящик не выжил. Соболезную.', 'Хм, похоже на классический «бдыщ».'],
      rabbit: ['Ой-ой, у меня уши в трубочку свернулись!', 'Я всё слышал! Честное ушастое!', 'Это был ящик или маленький гром?'],
      fairy: ['Ай! Пыль с крыльев осыпалась!', 'Если это фейерверк, то странный.'],
      crystal: ['Звон такой, что я чуть не треснул!', 'Вибрации! Мои грани гудят!'],
      octo: ['Бульк! Все восемь рук подпрыгнули.', 'Это был ящик? Я думал, кракен.'],
      ducky: ['Кря! Грохот сильнее моего кряка!', 'Шумно. Но я всё равно кряк-кряк-крякну громче.'],
      raccoon: ['Если что-то разбилось, это точно не я!', 'Там было что-то вкусное? Просто спрашиваю.'],
      robot: ['Обнаружен шум: 87 децибел. Причина: лис.', 'Бип. Ящик перешёл в состояние «щепки».'],
      toy: ['Ух ты, кто-то разбил ящик!', 'Бабах! Я аж подпрыгнул!', 'Ого, а у меня уши слышат всё!', 'Это было мощно… и немножко смешно.', 'Ой, а там монетки были?']
    };
    var G = ['Ой! Что это там грохнуло?', 'Кто-то опять веселится…', 'Надеюсь, никто не пострадал!', 'Вот это грохот!', 'Я даже не удивлён. Почти.', 'Кажется, у нас кто-то тренирует разбег.'];
    var pick = function (a) { return a[(Math.random() * a.length) | 0]; };
    var react = function (c, second) {
      var n = c.n, id = n.id, arr = L[id] || (id.indexOf('toy_') === 0 ? L.toy : null) || G;
      n.ex.noiseT = performance.now(); n.speed = 0; n.mode = 'idle'; n.timer = 3;
      n.faceH = Math.atan2(x - n.x, z - n.z); n.gesture(pick(second ? ['laugh', 'shrug', 'nod'] : ['hop', 'shrug', 'think', 'laugh']));
      toast(n.def.name + ': «' + pick(arr) + '»'); try { window.dispatchEvent(new CustomEvent('sev:npcnoise', { detail: { id: n.id } })); } catch (e) {}
    };
    api._nzT = now; react(near[0], false);
    if (near[1] && near[1].d < 12 && Math.random() < 0.3) setTimeout(function () { if (!M.dlg) react(near[1], true); }, 2300);
    return 1;
  },
  hear: function (x, z, kind) {
    if (!M || !M.list || M.dlg) return 0;
    var C = { dance: { r: 15, max: 3, cd: 16000 }, clap: { r: 12, max: 2, cd: 14000 }, cheer: { r: 15, max: 3, cd: 14000 }, wave: { r: 10, max: 1, cd: 9000 }, hello: { r: 10, max: 1, cd: 9000 }, bye: { r: 10, max: 1, cd: 9000 }, point: { r: 9, max: 1, cd: 12000 }, path: { r: 9, max: 1, cd: 12000 }, cool: { r: 9, max: 1, cd: 10000 }, shrug: { r: 9, max: 1, cd: 12000 }, encourage: { r: 11, max: 2, cd: 12000 }, thud: { r: 13, max: 1, cd: 20000 } }[kind];
    if (!C) return 0;
    var now = performance.now(), key = 'h_' + kind, near = [];
    for (var i = 0; i < M.list.length; i++) {
      var n = M.list[i]; if (n.talking || n.mode === 'talk' || !n.vis) continue;
      if (n.ex[key] && now - n.ex[key] < C.cd) continue;
      var d = Math.hypot(n.x - x, n.z - z); if (d < C.r) near.push({ n: n, d: d });
    }
    if (!near.length) return 0;
    near.sort(function (a, b) { return a.d - b.d; });
    var GES = { dance: ['hop', 'laugh', 'nod', 'wave'], clap: ['nod', 'hop', 'laugh'], cheer: ['hop', 'laugh', 'wave'], wave: ['wave'], hello: ['wave', 'nod'], bye: ['wave'], point: ['think', 'shrug'], path: ['nod', 'think'], cool: ['laugh', 'nod'], shrug: ['shrug', 'laugh'], encourage: ['hop', 'nod', 'laugh'], thud: ['hop', 'shrug'] };
    var P = {
      dance: ['Ого, вот это танцы!', 'Искрик, ты звезда танцпола!', 'Так и хочется пуститься в пляс!', 'Раз-два-три, раз-два-три…', 'Классный ритм!'],
      clap: ['Браво! Бис!', 'Хлоп-хлоп! Отлично!', 'Аплодисменты слышно на всю площадь!'],
      cheer: ['Ура-а-а! Я тоже кричу!', 'Какая радость! Ура!', 'Праздник у нас, что ли?'],
      wave: ['Привет-привет!', 'Ой, мне машут!', 'И тебе привет!'],
      hello: ['Здравствуй, Искрик!', 'Доброго дня!', 'О, привет! Как дела?'],
      bye: ['До встречи!', 'Счастливо, Искрик!', 'Возвращайся скорее!'],
      point: ['Куда-куда? Ага, вижу!', 'Что ты там показываешь?', 'Хм, и правда интересно!'],
      path: ['Туда? Спасибо, запомню!', 'А ты хорошо знаешь город!', 'Дорогу указываешь? Молодец!'],
      cool: ['Класс! Согласен!', 'Лайк! Даже два.', 'Вот это я понимаю!'],
      shrug: ['Не знаешь? Я тоже!', 'Бывает. Не переживай.', 'Пожал плечами — и дело с концом.'],
      encourage: ['Спасибо, подбодрил!', 'Вместе справимся!', 'Ты лучший, Искрик!'],
      thud: ['Бах! Ты там цел?', 'Ой, земля дрогнула!', 'Вот это приземление!']
    };
    var PC = {
      mushroom: { dance: ['Хм. Шляпки так не трясут.', 'Танцы на площади… допустим.'], thud: ['Ох, у меня шляпка подпрыгнула!'] },
      turtle: { dance: ['Капитан одобряет танец! Юнга, тоже вкруговую!'], cheer: ['Ура! Поднять паруса!'] },
      sonya: { dance: ['Я тоже умею — чик-чирик, дрыг-дрыг!'], clap: ['Крошки с аплодисментов не ждём?'] },
      rabbit: { dance: ['Уши сами под музыку пляшут!'], hello: ['Здравствуй! Почту не приносил?'] },
      robot: { dance: ['Бип-бип. Танцевальный модуль загружен.'], clap: ['Аплодисменты: 100%. Бип.'] }
    };
    var pick = function (a) { return a[(Math.random() * a.length) | 0]; };
    var count = 0;
    near.slice(0, C.max).forEach(function (c, idx) {
      var n = c.n, id = n.id, pool = (PC[id] && PC[id][kind] && Math.random() < 0.5) ? PC[id][kind] : P[kind];
      n.ex[key] = now; n.speed = 0; n.mode = 'idle'; n.timer = kind === 'dance' ? 3.2 : 2.6;
      n.faceH = Math.atan2(x - n.x, z - n.z);
      if (n.def.sleepy) { n.ex.awakeUntil = n.t + 5; n.ex.sleep = 0; }
      setTimeout(function () { if (!M.dlg && !n.talking) n.gesture(pick(GES[kind])); }, idx * 350);
      if (kind === 'dance') setTimeout(function () { if (!M.dlg && !n.talking) n.gesture(pick(['hop', 'laugh', 'wave'])); }, 1700 + idx * 300);
      if (idx === 0 && now - (api._hearT || 0) > 3500) { api._hearT = now; setTimeout(function () { toast(n.def.name + ': «' + pick(pool) + '»'); }, idx * 350 + 300); }
      try { window.dispatchEvent(new CustomEvent('sev:npcnoise', { detail: { id: n.id } })); } catch (e) {}
      count++;
    });
    return count;
  },
  dance: function (x, z, r, sec) {
    if (!M || !M.list) return 0;
    var end = performance.now() + sec * 1000, cnt = 0;
    M.list.forEach(function (n) { if (Math.hypot(n.x - x, n.z - z) <= r) cnt++; });
    var tm = setInterval(function () {
      var now = performance.now(); if (now > end || M.dlg) { clearInterval(tm); return; }
      M.list.forEach(function (n, i) {
        if (n.talking || n.mode === 'talk' || !n.vis || Math.hypot(n.x - x, n.z - z) > r) return;
        n.speed = 0; n.mode = 'idle'; n.timer = 1.2; n.gesture(['hop', 'wave', 'laugh', 'nod'][(i + Math.floor(now / 700)) % 4]);
      });
    }, 650);
    toast('🪩 Танцпол включён! Жители пустились в пляс' + (cnt ? ' (' + cnt + ')' : ''));
    return cnt;
  },
  register: function (def) {
    if (!def || !def.id) throw new Error('SevNPC.register: нужен id');
    defs[def.id] = def;
    if (M.scene && M.sceneId === def.scene && !M.get(def.id) && M.pending.indexOf(def) < 0) M.pending.push(def);   // «горячее» добавление жителя
  },
  unregister: function (id) { M.despawn(id); delete defs[id]; M.pending = M.pending.filter(function (d) { return d.id !== id; }); },
  get: function (id) { return M.get(id); },
  list: function () { return M.list.slice(); },
  say: function (id) { var n = M.get(id); if (n) M.talk(n); },
  quests: Quests, state: state, on: on, toast: toast,
  action: function (name, fn) { customActions[name] = fn; },
  manager: M,
  Geo: Geo, helpers: { eye: eye, eyeOn: eyeOn, surf: surf, spot: spot, smile: smile, star: star }
};


/* ============================================================
   ПЕРСОНАЖИ: собственный сказочный стиль «Севастополиса»
   (большие глаза, округлые формы, крупные головы, яркие, но гармоничные цвета)
   Ориентация: лицо смотрит в +Z, высота — по Y, единицы — метры (герой ≈ 2.8 м).
   ============================================================ */
function ring(g, col, n, cx, cy, cz, rx, rz, r, a0, a1, o) {
  for (var i = 0; i < n; i++) { var a = a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1)); g.e(col, cx + Math.sin(a) * rx, cy, cz + Math.cos(a) * rz, r, r, r, o || {}); }
}
function limb(g, col, x, y, z, rx, ry, rz, col2) { g.e(col, x, y, z, rx, ry, rz, col2 ? { col2: col2 } : {}); }

/* ---------- 1. Морская лисичка ---------- */
function buildFox(R) {
  var teal = '#4cc5ba', tealD = '#2e9b97', tealL = '#86e6d8', cream = '#f8f2e6', skirt = '#ecd3a3', strap = '#b8692f', gold = '#f2c444';
  R.cfg = { speed: 1.25, freq: 2.3, waddle: 0.9, arms: { A: [0, 0.14], B: [0, -0.14] }, idleGestures: ['think', 'shrug', 'wave', 'hop', 'laugh'] };
  var hipY = 0.5, torso, head;
  [['legA', 0.2], ['legB', -0.2]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) { limb(g, teal, 0, -0.24, 0, 0.12, 0.27, 0.13, tealD); limb(g, teal, 0, -0.46, 0.07, 0.14, 0.09, 0.19); limb(g, cream, 0, -0.48, 0.19, 0.1, 0.06, 0.09); });
  });
  torso = R.node('torso', null, 0, hipY, 0);
  R.part(torso, function (g) {
    limb(g, '#fbf8f0', 0, 0.4, 0, 0.4, 0.38, 0.33, '#e9e2d3');                    // блузка
    g.c(skirt, 0, -0.02, 0, 0.54, 0.36, 0.44, { sz: 0.88, w: 18 });                  // юбка-запах
    g.t('#b5753a', 0, 0.4, 0, 0.36, 0.04, { sz: 0.88, w: 18 });                      // пояс
    g.b_(strap, -0.16, 0.2, 0.43, 0.07, 0.4, 0.03, { rot: [-0.3, 0, 0.5] });          // ремешки на юбке
    g.b_(strap, 0.14, 0.2, 0.43, 0.07, 0.4, 0.03, { rot: [-0.3, 0, -0.5] });
    g.b_(strap, 0, 0.2, 0.45, 0.07, 0.4, 0.03, { rot: [-0.3, 0, 0.5] });
    g.b_('#c78a3c', 0.04, 0.6, 0.27, 0.09, 0.62, 0.04, { rot: [-0.25, 0, 0.55] });   // лямка сумки
    ring(g, '#e8b982', 11, 0, 0.7, 0.04, 0.26, 0.24, 0.04, -1.25, 1.25, { gloss: true });   // бусы
    g.e(gold, 0, 0.58, 0.32, 0.06, 0.07, 0.04, { gloss: true });                    // кулон
    limb(g, '#fbf8f0', 0.42, 0.66, 0, 0.17, 0.12, 0.17); limb(g, '#fbf8f0', -0.42, 0.66, 0, 0.17, 0.12, 0.17);  // рюши-рукава
  });
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.46, 0.68, 0);
    R.part(A, function (g) { limb(g, teal, 0, -0.26, 0, 0.1, 0.3, 0.1, tealD); limb(g, cream, 0, -0.58, 0.02, 0.12, 0.11, 0.12); g.t('#c07a3a', 0, -0.42, 0, 0.1, 0.035, { gloss: true }); });
  });
  var tail = R.node('tail', torso, 0, 0.25, -0.3);
  R.part(tail, function (g) { limb(g, teal, 0, 0.05, -0.2, 0.2, 0.2, 0.3, tealD); limb(g, teal, 0, 0.2, -0.55, 0.28, 0.28, 0.38); limb(g, teal, 0, 0.42, -0.85, 0.27, 0.27, 0.34, tealL); limb(g, '#ffffff', 0, 0.6, -1.05, 0.19, 0.19, 0.22); });
  head = R.node('head', torso, 0, 1.02, 0);
  var HR = [0.72, 0.6, 0.62];
  R.part(head, function (g) {
    g.e(teal, 0, 0, 0, HR[0], HR[1], HR[2], { w: 22, h: 16, col2: tealD });
    g.e(cream, 0, -0.2, 0.2, 0.52, 0.38, 0.46, { w: 18 });                         // светлая мордочка
    g.e(cream, 0, -0.18, 0.46, 0.3, 0.2, 0.2);
    g.e('#26262f', 0, -0.1, 0.65, 0.08, 0.06, 0.06, { gloss: true });             // носик
    smile(g, '#7a2a2a', -0.27, 0.63, 0.12, 5, { gloss: true }); g.e('#f07a8a', 0, -0.33, 0.6, 0.05, 0.03, 0.03);
    limb(g, cream, 0.64, -0.12, 0.1, 0.18, 0.2, 0.3); limb(g, cream, -0.64, -0.12, 0.1, 0.18, 0.2, 0.3);   // пушистые щёки
    eyeOn(g, HR, 0.29, -0.01, 0.19, '#37a9d8', { iris2: '#2a6fb4' }); eyeOn(g, HR, -0.29, -0.01, 0.19, '#37a9d8', { iris2: '#2a6fb4' });
    g.e('#1d3c46', 0.4, 0.2, 0.52, 0.12, 0.03, 0.04, { rot: [0, 0, 0.45], ao: 0 }); g.e('#1d3c46', -0.4, 0.2, 0.52, 0.12, 0.03, 0.04, { rot: [0, 0, -0.45], ao: 0 });  // ресницы
    g.e('#f7a07c', 0.45, -0.17, 0.4, 0.11, 0.065, 0.03, { rot: [0, -0.7, 0], ao: 0 }); g.e('#f7a07c', -0.45, -0.17, 0.4, 0.11, 0.065, 0.03, { rot: [0, 0.7, 0], ao: 0 });
    g.c(tealL, 0, 0.5, 0.06, 0.15, 0.0, 0.32, { rot: [0.55, 0, 0], w: 8 }); g.c(tealL, 0.1, 0.52, 0.02, 0.1, 0.0, 0.26, { rot: [0.5, 0, -0.2], w: 8 }); g.c(tealL, -0.1, 0.52, 0.02, 0.1, 0.0, 0.26, { rot: [0.5, 0, 0.2], w: 8 }); // чуб
    g.c(tealL, 0, -0.1, -0.5, 0.26, 0.0, 0.85, { rot: [2.5, 0, 0], w: 8 });         // грива сзади
    g.t('#a35f2c', 0, 0.3, -0.04, 0.66, 0.04, { rot: [-0.3, 0, 0], w: 26 });       // ремешок очков
    [1, -1].forEach(function (s) {
      g.e('#f26a3a', s * 0.23, 0.4, 0.45, 0.2, 0.15, 0.05, { rot: [-0.4, 0, 0], gloss: true });   // стёкла
      g.t('#e0b060', s * 0.23, 0.4, 0.46, 0.18, 0.035, { rot: [PI / 2 - 0.4, 0, 0], sx: 1.15, sz: 0.85, gloss: true });
    });
    g.b_('#e0b060', 0, 0.4, 0.46, 0.1, 0.04, 0.04, { gloss: true });
  });
  [['earA', 1], ['earB', -1]].forEach(function (d) {
    var E = R.node(d[0], head, d[1] * 0.42, 0.46, -0.05), s = d[1];
    R.part(E, function (g) { g.c(teal, 0, -0.06, 0, 0.27, 0.03, 0.7, { sz: 0.42, rot: [-0.05, 0, -s * 0.28], w: 12 }); g.c(cream, s * 0.02, -0.02, 0.06, 0.16, 0.02, 0.52, { sz: 0.3, rot: [-0.05, 0, -s * 0.28], w: 12 }); g.c(tealD, s * 0.19, 0.55, 0, 0.03, 0.03, 0.02, { w: 4 }); });
  });
  R.cfg.earBase = 0;
}

/* ---------- 2. Капитан Черепах ---------- */
function buildTurtle(R) {
  var skin = '#6f9d3e', skinD = '#4f7a2d', belly = '#b7ca7c', tan = '#d0b58a', tanD = '#b99a6c', navy = '#2a3764', brown = '#6b4423', brass = '#e2b13c';
  R.cfg = { speed: 0.8, freq: 2.0, waddle: 1.1, bob: 0.7, arms: { A: [-0.9, 0.12], B: [0, -0.1] }, armsFree: { A: 0, B: 1 }, waveArm: 'B', idleGestures: ['think', 'laugh', 'shrug', 'wave', 'nod'] };
  var hipY = 0.5;
  [['legA', 0.25], ['legB', -0.25]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) {
      limb(g, skin, 0, -0.22, 0, 0.19, 0.28, 0.2, skinD); limb(g, skin, 0, -0.44, 0.1, 0.21, 0.09, 0.3);
      [-0.1, 0, 0.1].forEach(function (x) { g.e('#efe3c0', x, -0.46, 0.38, 0.045, 0.04, 0.06); });
      g.b_('#26346a', 0, -0.08, 0, 0.42, 0.22, 0.4, { rot: [0, 0, 0] });
    });
  });
  var torso = R.node('torso', null, 0, hipY, 0), head, rodBase = [0.57, 0.09, 0.03];
  R.part(torso, function (g) {
    limb(g, tan, 0, 0.45, 0, 0.5, 0.5, 0.4, tanD);                                    // китель
    g.c(tan, 0, 0.02, 0, 0.52, 0.5, 0.2, { sz: 0.82, w: 18 }); g.t(navy, 0, 0.02, 0, 0.51, 0.035, { sz: 0.82, w: 18 });
    g.t(brown, 0, 0.26, 0, 0.5, 0.05, { sz: 0.82, w: 18 }); g.b_(brass, 0, 0.26, 0.42, 0.14, 0.12, 0.05, { gloss: true });
    [1, -1].forEach(function (s) { g.b_(tanD, s * 0.22, 0.58, 0.38, 0.17, 0.15, 0.04, { rot: [-0.2, 0, 0] }); g.e(brass, s * 0.22, 0.62, 0.42, 0.025, 0.025, 0.02, { gloss: true }); });
    g.e(navy, 0, 0.9, 0.2, 0.25, 0.12, 0.2); g.c(navy, 0, 0.5, 0.42, 0.13, 0.04, 0.34, { rot: [-0.1, 0, 0], sz: 0.4 });   // платок
    limb(g, navy, 0.2, 0.9, 0.33, 0.1, 0.07, 0.08); limb(g, navy, -0.2, 0.9, 0.33, 0.1, 0.07, 0.08);
    /* панцирь */
    limb(g, '#7d5a2b', 0, 0.55, -0.46, 0.52, 0.56, 0.34, '#5f4220'); g.t('#5a3f1e', 0, 0.55, -0.4, 0.46, 0.06, { rot: [PI / 2, 0, 0], sx: 1, sz: 1.05 });
    [[0, 0.58, -0.78, 0.2], [0, 0.95, -0.66, 0.16], [0, 0.22, -0.7, 0.16], [0.3, 0.76, -0.7, 0.16], [-0.3, 0.76, -0.7, 0.16], [0.3, 0.38, -0.72, 0.15], [-0.3, 0.38, -0.72, 0.15]].forEach(function (p) {
      g.e('#9a7338', p[0], p[1], p[2], p[3], p[3] * 1.05, 0.06, { w: 8, h: 6 });
    });
    /* подзорная труба на поясе */
    g.c(brass, -0.46, 0.12, 0.2, 0.06, 0.09, 0.5, { rot: [1.2, 0, 0.3], gloss: true }); g.t(brown, -0.46, 0.2, 0.2, 0.07, 0.02, { rot: [1.2, 0, 0.3] });
    /* удочка */
    var ANG = 1.2, RL = 3.4, dirY = Math.cos(ANG), dirZ = Math.sin(ANG);
    g.c('#8a5a2b', rodBase[0], rodBase[1], rodBase[2], 0.045, 0.014, RL, { rot: [ANG, 0, 0], w: 6 });
    g.e('#b0332e', rodBase[0], rodBase[1] + 0.12, rodBase[2] + 0.3, 0.055, 0.05, 0.1);
    /* леска до воды */
    var tx = rodBase[0], ty = rodBase[1] + dirY * RL, tz = rodBase[2] + dirZ * RL, bottom = -1.45, len = ty - bottom;
    g.c('#e8e8e8', tx, bottom, tz, 0.008, 0.008, len, { w: 4, caps: 0, ao: 0 });
    R.bobPos = [tx, bottom, tz];
  });
  var bob = R.node('bobber', torso, R.bobPos[0], R.bobPos[1], R.bobPos[2]);   // поплавок качается отдельно
  R.part(bob, function (g) { g.e('#e83a3a', 0, 0, 0, 0.1, 0.1, 0.1, { gloss: true }); g.e('#ffffff', 0, 0.08, 0, 0.07, 0.05, 0.07, { gloss: true }); });
  R.extra = function (n, dt, a) { bob.position.y = R.bobPos[1] + Math.sin(a.t * 2.1) * 0.035; };
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.57, 0.78, 0);
    R.part(A, function (g) { limb(g, tan, 0, -0.28, 0, 0.16, 0.36, 0.16, tanD); g.t(navy, 0, -0.55, 0, 0.14, 0.035); limb(g, skin, 0, -0.68, 0.03, 0.15, 0.13, 0.14); });
  });
  head = R.node('head', torso, 0, 1.12, 0.06);
  var HR = [0.5, 0.45, 0.52];
  R.part(head, function (g) {
    g.e(skin, 0, 0, 0, HR[0], HR[1], HR[2], { w: 20, h: 14, col2: skinD });
    g.e(belly, 0, -0.17, 0.36, 0.3, 0.2, 0.28); g.e(skin, 0, -0.05, 0.42, 0.27, 0.2, 0.26);
    g.e('#33401f', 0.07, -0.02, 0.66, 0.03, 0.025, 0.02, { gloss: true }); g.e('#33401f', -0.07, -0.02, 0.66, 0.03, 0.025, 0.02, { gloss: true });
    smile(g, '#3b2a1a', -0.17, 0.6, 0.14, 5, {});
    [1, -1].forEach(function (s) {
      eyeOn(g, HR, s * 0.28, 0.06, 0.12, '#8a5a2a', { iris2: '#5c3a1a' });
      g.e(skinD, s * 0.28, 0.2, 0.42, 0.14, 0.04, 0.06, { rot: [0.2, 0, -s * 0.15] });   // веки/брови
      g.e('#f2a08a', s * 0.4, -0.12, 0.34, 0.08, 0.05, 0.03, { rot: [0, -s * 0.8, 0], ao: 0 });
    });
    /* капитанская фуражка */
    g.c(tan, 0, 0.3, -0.02, 0.5, 0.48, 0.22, { sx: 1.02, sz: 1.0, w: 20 }); g.e(tan, 0, 0.52, -0.02, 0.5, 0.18, 0.47, { t1: PI / 2, w: 20 });
    g.t(navy, 0, 0.36, -0.02, 0.5, 0.05, { w: 20, sx: 1.02 });
    g.e(navy, 0, 0.32, 0.52, 0.38, 0.04, 0.26, { rot: [0.2, 0, 0] });               // козырёк
    g.e(brass, 0, 0.45, 0.5, 0.1, 0.1, 0.04, { gloss: true }); g.t('#8a6a1c', 0, 0.45, 0.52, 0.045, 0.012, { rot: [PI / 2, 0, 0] });
  });
}

/* ---------- 3. Чайка Соня ---------- */
function buildGull(R) {
  var cream = '#f6e8d4', blue = '#6fb7cb', jacket = '#6f8fb0', jacketD = '#53718f', orange = '#f1a04a', scarf = '#f7b840', navy = '#25365a', boot = '#9a6a44', sock = '#9097a3';
  R.cfg = { speed: 2.4, freq: 1.6, hopLoco: true, arms: { A: [0, 0.2], B: [0, -0.2] }, idleGestures: ['hop', 'wave', 'laugh', 'shrug', 'think', 'hop'] };
  var hipY = 0.42;
  [['legA', 0.15], ['legB', -0.15]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) { limb(g, sock, 0, -0.17, 0, 0.085, 0.21, 0.085); limb(g, boot, 0, -0.37, 0.06, 0.12, 0.08, 0.19); g.t('#f0e4cc', 0, -0.06, 0, 0.09, 0.03); });
  });
  var torso = R.node('torso', null, 0, hipY, 0);
  R.part(torso, function (g) {
    limb(g, jacket, 0, 0.3, 0, 0.32, 0.33, 0.27, jacketD);
    g.c(orange, 0, -0.02, 0, 0.4, 0.28, 0.3, { sz: 0.9, w: 16 }); g.c('#e0803a', 0, -0.02, 0, 0.41, 0.4, 0.05, { sz: 0.9, w: 16, caps: 0 });
    g.t('#8a5a30', 0, 0.3, 0, 0.3, 0.04, { sz: 0.9 }); g.b_('#e8c24a', 0, 0.3, 0.27, 0.1, 0.08, 0.04, { gloss: true });
    g.t(scarf, 0, 0.58, 0.02, 0.2, 0.09, { sz: 0.9, w: 16 }); g.c(scarf, 0.06, 0.2, 0.2, 0.09, 0.02, 0.4, { rot: [-0.2, 0, 0.1], sz: 0.4 });
    g.e(blue, 0, 0.2, -0.3, 0.12, 0.05, 0.26, { rot: [0.5, 0, 0] });                  // хвостовые перья
  });
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.36, 0.5, 0);
    R.part(A, function (g) { limb(g, jacket, 0, -0.2, 0, 0.1, 0.24, 0.1, jacketD); g.t('#8a5a30', 0, -0.38, 0, 0.09, 0.03); limb(g, '#e8b96a', 0, -0.46, 0.02, 0.09, 0.08, 0.09); });
  });
  [['wingA', 1], ['wingB', -1]].forEach(function (d) {
    var W = R.node(d[0], torso, d[1] * 0.3, 0.55, -0.22), s = d[1];
    R.part(W, function (g) {
      var cols = ['#86a6c8', '#6c8cb4', '#5a7aa2', '#6c8cb4', '#9eb7d2'];
      for (var i = 0; i < 5; i++) { var a = -0.15 + i * 0.22; g.e(cols[i], s * (0.12 + i * 0.05), -0.12 - i * 0.12, -0.06 - i * 0.02, 0.09, 0.42 - i * 0.02, 0.035, { rot: [0, 0, s * (0.28 + i * 0.12)], w: 10, h: 8 }); }
      g.e('#8aaccc', s * 0.06, -0.02, -0.02, 0.15, 0.2, 0.05, { rot: [0, 0, s * 0.2] });
    });
    W.rotation.z = s * 0.15;
  });
  var head = R.node('head', torso, 0, 0.98, 0), HR = [0.6, 0.54, 0.54];
  R.part(head, function (g) {
    g.e(cream, 0, 0, 0, HR[0], HR[1], HR[2], { w: 22, h: 16, col2: '#e8d4b8' });
    g.c(orange, 0, -0.1, 0.46, 0.17, 0.02, 0.36, { rot: [PI / 2, 0, 0], sz: 0.8, gloss: true, w: 12 });                  // клюв
    g.e('#e08a2c', 0, -0.2, 0.62, 0.12, 0.05, 0.16, { gloss: true });
    [1, -1].forEach(function (s) {
      eyeOn(g, HR, s * 0.28, 0.03, 0.17, '#b8691e', { iris2: '#7a3a12' });
      g.e(navy, s * 0.3, 0.2, 0.45, 0.13, 0.035, 0.04, { rot: [0, 0, -s * 0.15], ao: 0 });
      g.e('#f7a08a', s * 0.42, -0.14, 0.34, 0.09, 0.055, 0.03, { rot: [0, -s * 0.8, 0], ao: 0 });
      g.e(navy, s * 0.54, 0.02, -0.04, 0.1, 0.18, 0.1, { rot: [0, 0, -s * 0.5] });                // пряди у лица
      g.e(navy, s * 0.5, -0.12, -0.1, 0.08, 0.16, 0.08, { rot: [0, 0, -s * 0.9] });
    });
    g.e(blue, 0, 0.2, -0.02, 0.62, 0.42, 0.58, { t1: PI * 0.55, w: 20, col2: '#5aa3b9' });  // кепка
    g.e('#4f9ab0', 0, 0.19, 0.5, 0.42, 0.04, 0.3, { rot: [0.25, 0, 0] });
    star(g, '#f1a04a', 0, 0.42, 0.52, 0.08);
  });
}

/* ---------- 4. Господин Гриб ---------- */
function buildMushroom(R) {
  var cream = '#f0e6d0', creamD = '#d9ccb0', red = '#d6322e', redD = '#a8221f', green = '#3f6a3e', brown = '#6a4326', boot = '#4a2f20';
  R.cfg = { speed: 0.9, freq: 2.4, waddle: 1.5, bob: 1.0, arms: { A: [0, 0.14], B: [-0.7, -0.12] }, armsFree: { A: 1, B: 0 }, idleGestures: ['think', 'shrug', 'laugh', 'nod', 'wave'] };
  var hipY = 0.38;
  [['legA', 0.2], ['legB', -0.2]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) { limb(g, cream, 0, -0.08, 0, 0.12, 0.14, 0.12); limb(g, boot, 0, -0.24, 0.05, 0.17, 0.15, 0.22); g.e('#17110d', 0, -0.37, 0.06, 0.18, 0.04, 0.25); g.t('#8a6a40', 0, -0.2, 0.03, 0.15, 0.025); });
  });
  var torso = R.node('torso', null, 0, hipY, 0);
  R.part(torso, function (g) {
    limb(g, cream, 0, 0.38, 0, 0.46, 0.44, 0.4, creamD);
    g.t('#6b4a26', 0, 0.26, 0, 0.44, 0.055, { sz: 0.9, w: 18 }); g.b_('#b8bcc4', 0, 0.26, 0.4, 0.15, 0.13, 0.05, { gloss: true }); g.b_('#4a3420', 0, 0.26, 0.43, 0.07, 0.06, 0.03);
    g.b_('#7a4f2a', 0.04, 0.55, 0.33, 0.1, 0.8, 0.04, { rot: [-0.2, 0, 0.8] });                                           // ремень через плечо
    /* зелёная накидка-воротник */
    g.c(green, 0, 0.62, 0, 0.5, 0.3, 0.2, { w: 18, sz: 0.9 }); g.t('#4c7a49', 0, 0.62, 0, 0.5, 0.04, { sz: 0.9, w: 18 });
    for (var i = 0; i < 9; i++) { var a = i / 9 * TAU; g.e('#477a44', Math.sin(a) * 0.5, 0.64, Math.cos(a) * 0.45, 0.14, 0.05, 0.14, { w: 8, h: 5 }); }
    limb(g, '#5a3e24', -0.04, 0.2, -0.38, 0.22, 0.2, 0.1);                                                                // маленький рюкзак
    g.c('#6a4a2a', -0.5, -0.38, 0.3, 0.045, 0.028, 2.5, { w: 6 });                                                        // посох с черникой
    g.e('#3b3f9c', -0.5, 2.2, 0.3, 0.17, 0.17, 0.17, { gloss: true }); g.e('#7a80e0', -0.5, 2.27, 0.4, 0.05, 0.05, 0.03, { gloss: true });
    g.e('#4f8a42', -0.36, 2.0, 0.3, 0.12, 0.04, 0.07, { rot: [0, 0, 0.4] }); g.e('#4f8a42', -0.62, 1.6, 0.3, 0.11, 0.04, 0.07, { rot: [0, 0, -0.4] });
  });
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.48, 0.58, 0);
    R.part(A, function (g) { limb(g, cream, 0, -0.18, 0, 0.1, 0.22, 0.1); g.e('#5a3e24', 0, -0.26, 0, 0.14, 0.12, 0.14); limb(g, cream, 0, -0.44, 0.02, 0.11, 0.1, 0.11); });
  });
  var head = R.node('head', torso, 0, 0.98, 0), HR = [0.56, 0.5, 0.5];
  R.part(head, function (g) {
    g.e(cream, 0, 0, 0, HR[0], HR[1], HR[2], { w: 22, h: 16, col2: creamD });
    [1, -1].forEach(function (s) { g.e('#14141c', s * 0.2, 0.0, 0.46, 0.06, 0.075, 0.04, { gloss: true }); g.e('#ffffff', s * 0.2 + 0.02, 0.03, 0.5, 0.02, 0.02, 0.015, { gloss: true }); g.e('#f6a8a0', s * 0.33, -0.12, 0.38, 0.09, 0.055, 0.03, { rot: [0, -s * 0.8, 0], ao: 0 }); });
    smile(g, '#e0705a', -0.14, 0.5, 0.09, 5, { gloss: true });
    g.e('#e6d9c0', 0, -0.05, 0.5, 0.05, 0.035, 0.03);
    /* шляпа-гриб */
    g.e(red, 0, 0.36, 0, 0.98, 0.64, 0.94, { w: 26, h: 16, t1: PI * 0.56, col2: redD });
    g.e('#e8d9c0', 0, 0.25, 0, 0.94, 0.1, 0.9, { w: 26, h: 4, col2: '#cbbca2' });
    var CR = [0.98, 0.64, 0.94], cc = [0, 0.36, 0], sp = [[0.35, 0.3, 0.17], [0.35, 1.5, 0.15], [0.45, 2.6, 0.16], [0.75, 0.2, 0.19], [0.75, 1.0, 0.13], [0.75, 1.95, 0.17], [0.75, 3.0, 0.14], [0.2, 4.0, 0.12], [0.2, 5.4, 0.13], [0.62, 4.4, 0.15], [0.62, 5.5, 0.12], [0.8, 5.0, 0.15]];
    sp.forEach(function (s) { spot(g, '#fbf3e6', cc, CR, s[0], s[1], s[2], s[2] * 0.95, 0.05, { w: 10, h: 6 }); });
  });
}

/* ---------- 5. Заяц-почтальон ---------- */
function buildRabbit(R) {
  var white = '#f8f8fb', whiteD = '#dcdde8', pink = '#f2b0c0', navy = '#2c3c66', blue = '#4c88c8', orange = '#f28b25', purple = '#51428f';
  R.cfg = { speed: 1.9, freq: 1.7, hopLoco: true, arms: { A: [0, 0.14], B: [-1.0, -0.2] }, armsFree: { A: 1, B: 0 }, idleGestures: ['wave', 'hop', 'think', 'shrug', 'nod'] };
  var hipY = 0.42;
  [['legA', 0.16], ['legB', -0.16]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) { limb(g, white, 0, -0.1, 0, 0.12, 0.17, 0.12); g.b_(navy, 0, 0.04, 0, 0.3, 0.22, 0.3); limb(g, white, 0, -0.35, 0.1, 0.13, 0.08, 0.23); limb(g, pink, 0, -0.39, 0.26, 0.05, 0.03, 0.05); });
  });
  var torso = R.node('torso', null, 0, hipY, 0);
  R.part(torso, function (g) {
    limb(g, '#ffffff', 0, 0.32, 0, 0.33, 0.35, 0.28, whiteD);
    g.b_(navy, 0, 0.18, 0, 0.62, 0.12, 0.48);                                                    // шорты
    limb(g, navy, 0, 0.34, 0.06, 0.34, 0.33, 0.25, '#1f2b4e');                                   // жилет
    g.b_('#ffffff', 0, 0.45, 0.25, 0.2, 0.3, 0.03); g.e(orange, 0, 0.6, 0.27, 0.1, 0.06, 0.05, { gloss: true }); g.e(orange, 0.12, 0.6, 0.26, 0.07, 0.06, 0.05, { gloss: true }); g.e(orange, -0.12, 0.6, 0.26, 0.07, 0.06, 0.05, { gloss: true }); // бантик
    g.b_(blue, 0.15, 0.4, 0.28, 0.07, 0.6, 0.03, { rot: [0, 0, 0.1] }); g.b_(blue, -0.15, 0.4, 0.28, 0.07, 0.6, 0.03, { rot: [0, 0, -0.1] });
    limb(g, white, 0, 0.2, -0.32, 0.17, 0.17, 0.15, whiteD);                                     // хвостик-помпон
    /* почтовая сумка через плечо с письмами */
    g.b_('#8a5a30', 0, 0.38, 0.0, 0.07, 0.9, 0.5, { rot: [0, 0, 0.0] });
    g.b_('#3d66a6', -0.38, 0.12, 0.05, 0.16, 0.34, 0.42); g.b_('#f0f0ea', -0.4, 0.34, 0.0, 0.1, 0.04, 0.2, { rot: [0, 0, 0.3] }); g.b_('#f6ecd6', -0.36, 0.34, 0.1, 0.1, 0.04, 0.2, { rot: [0, 0, -0.2] });
    /* посылка в левой руке */
    g.b_(orange, -0.28, 0.24, 0.5, 0.42, 0.36, 0.34, { rot: [0, 0.15, 0] }); g.b_(purple, -0.28, 0.24, 0.5, 0.08, 0.38, 0.36, { rot: [0, 0.15, 0] }); g.b_(purple, -0.28, 0.43, 0.5, 0.44, 0.04, 0.08, { rot: [0, 0.15, 0] });
  });
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.36, 0.52, 0);
    R.part(A, function (g) { limb(g, white, 0, -0.18, 0, 0.1, 0.22, 0.1); g.t(blue, 0, -0.34, 0, 0.1, 0.03); limb(g, '#ffffff', 0, -0.42, 0.02, 0.11, 0.1, 0.1); });
  });
  var head = R.node('head', torso, 0, 0.95, 0), HR = [0.58, 0.52, 0.52];
  R.part(head, function (g) {
    g.e('#ffffff', 0, 0, 0, HR[0], HR[1], HR[2], { w: 22, h: 16, col2: whiteD });
    g.e('#ffffff', 0, -0.2, 0.28, 0.42, 0.3, 0.32);
    g.e(pink, 0, -0.09, 0.56, 0.06, 0.045, 0.04, { gloss: true });
    smile(g, '#9a3a4a', -0.24, 0.5, 0.1, 5, { gloss: true }); g.b_('#ffffff', 0, -0.3, 0.5, 0.05, 0.05, 0.03);
    [1, -1].forEach(function (s) {
      eyeOn(g, HR, s * 0.25, 0.04, 0.16, '#d2651e', { iris2: '#8a3a10' });
      g.e('#555a6a', s * 0.27, 0.23, 0.44, 0.12, 0.028, 0.04, { rot: [0, 0, -s * 0.06], ao: 0 });
      g.e('#f7b0b8', s * 0.4, -0.14, 0.36, 0.09, 0.055, 0.03, { rot: [0, -s * 0.8, 0], ao: 0 });
    });
    g.e('#ffffff', 0.05, 0.5, 0.02, 0.08, 0.06, 0.06);
  });
  [['earA', 1], ['earB', -1]].forEach(function (d) {
    var s = d[1], E = R.node(d[0], head, s * 0.2, 0.42, -0.02);
    R.part(E, function (g) { g.c('#ffffff', 0, -0.05, 0, 0.17, 0.12, 0.95, { sz: 0.45, w: 12 }); g.c(pink, 0, 0.0, 0.05, 0.1, 0.06, 0.8, { sz: 0.3, w: 12 }); g.e('#ffffff', 0, 0.9, 0, 0.12, 0.09, 0.07); });
    E.rotation.z = -s * 0.16;
  });
  R.cfg.earBase = -0.16;
}

/* ---------- 6. Звёздная фея Луна (бонус) ---------- */
function buildFairy(R) {
  var skin = '#ffdcc8', hair = '#dcdaf2', hairD = '#a9a6d4', gold = '#ffe07a', blue = '#53b6ea', blueL = '#97dcf7', white = '#f4fbff', yellow = '#ffd84a';
  R.cfg = { speed: 0.8, freq: 2.2, waddle: 0.7, float: 0.25, arms: { A: [0, 0.35], B: [0, -0.35] }, idleGestures: ['wave', 'think', 'laugh', 'hop', 'shrug'] };
  var hipY = 0.5;
  [['legA', 0.12], ['legB', -0.12]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) { limb(g, skin, 0, -0.22, 0, 0.075, 0.26, 0.08); limb(g, yellow, 0, -0.45, 0.05, 0.1, 0.06, 0.15); g.e('#ff9a3a', 0, -0.42, 0.11, 0.05, 0.04, 0.03, { gloss: true }); });
  });
  var torso = R.node('torso', null, 0, hipY, 0);
  R.part(torso, function (g) {
    limb(g, blue, 0, 0.4, 0, 0.27, 0.3, 0.22, '#3e9ad6');
    for (var i = 0; i < 3; i++) { g.c(i % 2 ? blueL : '#7fd0f4', 0, 0.02 + i * 0.0, 0, 0.62 - i * 0.07, 0.3, 0.38, { w: 22, sz: 0.95, rot: [0, i, 0] }); g.t(white, 0, 0.02, 0, 0.62 - i * 0.07, 0.035, { w: 22 }); }
    ring(g, white, 14, 0, 0.4, 0, 0.28, 0.23, 0.07, -1.9, 1.9); limb(g, yellow, 0, 0.55, 0.22, 0.09, 0.09, 0.05); limb(g, '#7fd0f4', 0.12, 0.52, 0.22, 0.06, 0.06, 0.04);
    limb(g, blueL, 0.3, 0.6, 0, 0.17, 0.15, 0.17); limb(g, blueL, -0.3, 0.6, 0, 0.17, 0.15, 0.17);
  });
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.3, 0.6, 0);
    R.part(A, function (g) { limb(g, skin, 0, -0.18, 0, 0.065, 0.2, 0.065); limb(g, skin, 0, -0.4, 0.02, 0.08, 0.07, 0.08); });
  });
  var head = R.node('head', torso, 0, 1.0, 0), HR = [0.62, 0.56, 0.54];
  R.part(head, function (g) {
    g.e(skin, 0, 0, 0, HR[0], HR[1], HR[2], { w: 22, h: 16, col2: '#eeb89c' });
    [1, -1].forEach(function (s) {
      eyeOn(g, HR, s * 0.26, -0.04, 0.17, '#5a63c9', { iris2: '#3a3f9a' });
      g.e('#6b4a5a', s * 0.3, 0.14, 0.46, 0.1, 0.025, 0.03, { rot: [0, 0, -s * 0.2], ao: 0 });
      g.e('#f48a9a', s * 0.4, -0.17, 0.38, 0.1, 0.06, 0.03, { rot: [0, -s * 0.8, 0], ao: 0 });
      g.e(skin, s * 0.66, -0.02, -0.02, 0.2, 0.06, 0.06, { rot: [0, 0, s * 0.35] }); g.e('#f4a0a8', s * 0.68, -0.01, -0.0, 0.1, 0.03, 0.03, { rot: [0, 0, s * 0.35] });   // острые ушки
    });
    smile(g, '#a0405a', -0.27, 0.5, 0.07, 5, { gloss: true });
    /* волосы: серебристо-лавандовые, чёлка и косы */
    g.e(hair, 0, 0.12, -0.06, 0.7, 0.55, 0.6, { w: 22, h: 14, col2: hairD, t1: PI * 0.72 }); g.e(hair, 0, 0.22, 0.38, 0.5, 0.26, 0.2, { rot: [0.2, 0, 0] });
    g.c(hair, -0.1, 0.55, 0.04, 0.05, 0.0, 0.22, { rot: [0, 0, 0.5], w: 6 }); g.t(hair, 0.0, 0.62, 0.02, 0.1, 0.03, { rot: [0.6, 0, 0] });
    [1, -1].forEach(function (s) {
      g.e(hair, s * 0.5, -0.1, -0.25, 0.22, 0.6, 0.22, { rot: [0, 0, s * 0.15], col2: '#e7d6b8' }); g.e('#e7d6b8', s * 0.55, -0.62, -0.25, 0.2, 0.2, 0.2, { gloss: true });
      /* золотые рожки-полумесяцы */
      g.e(gold, s * 0.42, 0.5, -0.02, 0.1, 0.36, 0.08, { rot: [0, 0, -s * 0.35], gloss: true, col2: '#fff3b0' });
      g.e('#fff7c8', s * 0.5, 0.7, -0.02, 0.07, 0.22, 0.06, { rot: [0, 0, -s * 0.8], gloss: true });
    });
    star(g, '#ffd84a', 0.4, 0.28, 0.42, 0.05); star(g, '#8fdcff', -0.45, 0.2, 0.36, 0.04);
  });
  /* звёздочки вокруг */
  var st = R.node('stars', torso, 0, 0.7, 0);
  R.part(st, function (g) { [[0.8, 0.5, 0.3, 0.1], [-0.85, 0.2, 0.1, 0.08], [0.6, -0.2, -0.6, 0.09], [-0.5, 0.9, -0.4, 0.07], [0.2, 1.3, 0.5, 0.06]].forEach(function (p, i) { star(g, i % 2 ? '#fff3a0' : '#ffd84a', p[0], p[1], p[2], p[3]); }); });
  R.extra = function (n, dt, a) { st.rotation.y = a.t * 0.6; st.position.y = 0.7 + Math.sin(a.t * 1.4) * 0.08; };
}

/* ---------- 7. Старый Мшистый — хранитель кристаллов (бонус) ---------- */
function buildCrystal(R) {
  var skin = '#8fdcc8', skinD = '#55b6a4', fur = '#3e8f86', scale = '#3fd6b0', white = '#f4fbfa', moss = '#6f8c3a', foot = '#e8c6b2';
  R.cfg = { speed: 0.9, freq: 2.3, waddle: 1.4, bob: 1.0, arms: { A: [0, 0.22], B: [0, -0.22] }, idleGestures: ['think', 'laugh', 'shrug', 'nod', 'wave'] };
  var hipY = 0.5;
  [['legA', 0.24], ['legB', -0.24]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) { limb(g, '#3a9a86', 0, -0.22, 0, 0.17, 0.28, 0.18, '#2d7d70'); [0, 1, 2].forEach(function (i) { g.e('#6fe0c0', (i - 1) * 0.08, -0.16 + (i % 2) * 0.1, 0.16, 0.07, 0.05, 0.02, { gloss: true }); }); limb(g, foot, 0, -0.46, 0.1, 0.18, 0.08, 0.26); [-0.09, 0, 0.09].forEach(function (x) { g.e('#d8b4a0', x, -0.47, 0.34, 0.045, 0.04, 0.05); }); });
  });
  var torso = R.node('torso', null, 0, hipY, 0);
  R.part(torso, function (g) {
    limb(g, fur, 0, 0.42, 0, 0.48, 0.45, 0.38, '#2f7770');
    g.e(scale, 0, 0.26, 0.28, 0.34, 0.34, 0.22, { gloss: true, col2: '#9a7de0' });
    var sc = ['#2fd2b4', '#f1e06a', '#6fe0f0', '#ff9ac8', '#9a7de0'], i, j;
    for (j = 0; j < 4; j++) for (i = 0; i < 4 - (j % 2); i++) g.e(sc[(i + j * 2) % 5], (i - 1.5 + (j % 2) * 0.5) * 0.16, 0.12 + j * 0.13, 0.36 - j * 0.03 - Math.abs(i - 1.5) * 0.02, 0.075, 0.075, 0.03, { gloss: true, w: 8, h: 5 });
    g.t(moss, 0, 0.55, 0, 0.42, 0.07, { sz: 0.85, w: 18 });
    limb(g, '#7b6ad0', 0, 0.1, -0.42, 0.2, 0.34, 0.2, '#4ad0c0');                                    // радужный хвост
  });
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.5, 0.68, 0);
    R.part(A, function (g) { limb(g, skin, 0, -0.3, 0, 0.13, 0.36, 0.13, skinD); limb(g, skin, 0, -0.68, 0.03, 0.14, 0.13, 0.13); [-0.07, 0, 0.07].forEach(function (x) { g.e('#7ad0bc', x, -0.78, 0.06, 0.04, 0.08, 0.04); }); });
  });
  var head = R.node('head', torso, 0, 1.05, 0), HR = [0.66, 0.58, 0.58];
  R.part(head, function (g) {
    g.e(skin, 0, 0, 0, HR[0], HR[1], HR[2], { w: 22, h: 16, col2: skinD });
    g.e('#f0b0a0', 0, -0.1, 0.55, 0.09, 0.07, 0.06);
    [1, -1].forEach(function (s) {
      eyeOn(g, HR, s * 0.27, 0.05, 0.16, '#cdd02e', { iris2: '#8a9a20', white: '#f4f4e0' });
      g.e('#e6f4f2', s * 0.3, 0.21, 0.45, 0.14, 0.04, 0.05, { rot: [0, 0, -s * 0.2] });
      g.e('#f6a8a0', s * 0.42, -0.1, 0.4, 0.1, 0.06, 0.03, { rot: [0, -s * 0.8, 0], ao: 0 });
    });
    /* белая борода и пушистые брови */
    g.e(white, 0, -0.38, 0.32, 0.36, 0.3, 0.28, { col2: '#dfeeee' }); g.e(white, 0.2, -0.3, 0.38, 0.17, 0.17, 0.15); g.e(white, -0.2, -0.3, 0.38, 0.17, 0.17, 0.15); g.e(white, 0, -0.62, 0.3, 0.12, 0.14, 0.1);
    smile(g, '#4a7a70', -0.2, 0.54, 0.1, 5, {});
    /* кристальная корона */
    var cols = ['#e8fbff', '#b8f0ff', '#ffd6f0', '#d8e8ff'];
    for (var i = 0; i < 9; i++) { var a = i / 9 * TAU; g.c(cols[i % 4], Math.sin(a) * 0.4, 0.46 + (i % 2) * 0.04, Math.cos(a) * 0.36 - 0.05, 0.11, 0.0, 0.26 + (i % 3) * 0.08, { rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35], gloss: true, w: 6, caps: 0 }); }
    g.c('#ffffff', 0, 0.5, 0.1, 0.13, 0.0, 0.42, { gloss: true, w: 6, caps: 0 });
  });
  [['earA', 1], ['earB', -1]].forEach(function (d) {
    var s = d[1], E = R.node(d[0], head, s * 0.58, 0.12, -0.02);
    R.part(E, function (g) { g.e(skin, s * 0.32, 0.08, 0, 0.42, 0.14, 0.05, { rot: [0, 0, s * 0.3] }); g.e('#7fd8ff', s * 0.34, 0.1, 0.03, 0.34, 0.1, 0.03, { rot: [0, 0, s * 0.3], gloss: true, col2: '#c6a0ff' }); });
    E.rotation.z = 0;
  });
}

/* ---------- 8. Осьминожка Мира — любит радио (бонус) ---------- */
function buildOcto(R) {
  var skin = '#62a48e', skinD = '#42806e', mauve = '#a64e68', mauveL = '#cc7890', bronze = '#c46a2c', teal = '#4e8a7c';
  R.cfg = { speed: 0.9, freq: 2.4, waddle: 1.0, arms: { A: [0, 0.15], B: [0, -0.15] }, idleGestures: ['wave', 'hop', 'think', 'laugh', 'shrug'] };
  var hipY = 0.4;
  [['legA', 0.17], ['legB', -0.17]].forEach(function (d) {
    var L = R.node(d[0], null, d[1], hipY, 0);
    R.part(L, function (g) { limb(g, skin, 0, -0.14, 0, 0.1, 0.17, 0.1); limb(g, teal, 0, -0.32, 0.05, 0.14, 0.12, 0.17, '#2f6a5c'); g.t(bronze, 0, -0.22, 0.02, 0.12, 0.03, { gloss: true }); });
  });
  var torso = R.node('torso', null, 0, hipY, 0);
  R.part(torso, function (g) {
    limb(g, teal, 0, 0.32, 0, 0.3, 0.3, 0.24, '#386f62');
    g.c(bronze, 0, -0.02, 0, 0.46, 0.3, 0.26, { w: 18, sz: 0.92 }); for (var i = 0; i < 9; i++) { var a = i / 9 * TAU; g.e('#d8803a', Math.sin(a) * 0.46, 0.0, Math.cos(a) * 0.42, 0.1, 0.07, 0.1); }
    g.e(bronze, 0, 0.38, 0.23, 0.12, 0.12, 0.05, { gloss: true }); g.t('#f0c070', 0, 0.38, 0.27, 0.08, 0.02, { rot: [PI / 2, 0, 0], gloss: true });
    g.t('#7a4a24', 0, 0.2, 0, 0.3, 0.035, { sz: 0.82 });
  });
  [['armA', 1], ['armB', -1]].forEach(function (d) {
    var A = R.node(d[0], torso, d[1] * 0.34, 0.5, 0);
    R.part(A, function (g) { limb(g, skin, 0, -0.18, 0, 0.08, 0.22, 0.08, skinD); limb(g, teal, 0, -0.1, 0, 0.11, 0.11, 0.11); limb(g, skin, 0, -0.42, 0.02, 0.09, 0.09, 0.09); [-0.06, 0.06].forEach(function (x) { g.c('#3a6e60', x, -0.46, 0.02, 0.03, 0.0, 0.14, { rot: [PI, 0, 0], w: 6 }); }); });
  });
  var head = R.node('head', torso, 0, 0.98, 0), HR = [0.66, 0.6, 0.58];
  R.part(head, function (g) {
    g.e(skin, 0, 0.02, 0, HR[0], HR[1], HR[2], { w: 24, h: 16, col2: skinD });
    [1, -1].forEach(function (s) {
      eyeOn(g, [HR[0], HR[1], HR[2]], s * 0.28, -0.04, 0.18, '#e0561f', { iris2: '#a03210' });
      g.e('#f19a8a', s * 0.42, -0.2, 0.34, 0.09, 0.055, 0.03, { rot: [0, -s * 0.8, 0], ao: 0 });
      /* наушники */
      g.e(bronze, s * 0.64, -0.02, 0, 0.1, 0.2, 0.2, { gloss: true }); g.e('#8a4a1e', s * 0.72, -0.02, 0, 0.05, 0.14, 0.14, { gloss: true });
      /* розовые щупальца-«пучки» */
      g.e(mauve, s * 0.4, 0.62, -0.02, 0.28, 0.24, 0.26, { col2: mauveL }); g.e(mauveL, s * 0.52, 0.78, 0, 0.12, 0.1, 0.1);
      for (var k = 0; k < 5; k++) g.e('#e8a0b4', s * (0.28 + k * 0.05), 0.56 + (k % 2) * 0.08, 0.17, 0.035, 0.035, 0.02);
      /* боковые щупальца-волосы */
      for (k = 0; k < 4; k++) g.e(teal, s * (0.62 + Math.sin(k * 0.9) * 0.1), -0.2 - k * 0.15, -0.1 - k * 0.04, 0.07 - k * 0.01, 0.13, 0.07 - k * 0.01);
    });
    g.e('#a64e68', 0, -0.26, 0.5, 0.06, 0.035, 0.03, { gloss: true });
    g.b_(bronze, 0, 0.6, 0.02, 0.8, 0.05, 0.08, { rot: [0, 0, 0.0], gloss: true });                 // дужка наушников
  });
  R.extra = function (n, dt, a) { /* тут можно оживить щупальца */ };
}


/* ============================================================
   ЖИТЕЛИ ГРАФСКОЙ ПРИСТАНИ  (демонстрационные диалоги; архитектура — для будущих квестов)
   Чтобы добавить жителя: SevNPC.register({...}) — основной код игры менять не нужно.
   Условия в диалогах: 'q:квест:статус', 'f:флаг', '!f:флаг'. Действия: 'quest:start:id', 'quest:done:id', 'flag:имя'.
   ============================================================ */
Quests.register({ id: 'shell', title: 'Золотая ракушка', giver: 'fox', steps: ['Спросить Соню', 'Вернуть ракушку лисичке'] });
Quests.register({ id: 'letter', title: 'Письмо для капитана', giver: 'rabbit', steps: ['Отнести письмо Капитану Черепаху'] });

var BYE = { label: 'Попрощаться', alt: true };

/* Парк Победы: новые мультяшные жители */
function buildDucky(R) { R.cfg={speed:1.05,freq:2.8,waddle:1.1,arms:{A:[0,.18],B:[0,-.18]},idleGestures:['wave','hop','laugh','think']}; var t=R.node('torso',null,0,.52,0); R.part(t,function(g){limb(g,'#f6cf45',0,.3,0,.38,.43,.3,'#e7aa2e');limb(g,'#f1a72b',0,.12,.27,.19,.09,.17)}); var h=R.node('head',t,0,.78,0); R.part(h,function(g){g.e('#ffe36a',0,.05,0,.48,.43,.4,{col2:'#eab83c'});[-1,1].forEach(function(x){eyeOn(g,[.48,.43,.4],x*.19,.02,.34,'#332a26')});g.e('#ef8135',0,-.14,.42,.24,.11,.12);g.e('#f7f2e8',0,.47,-.02,.25,.12,.22)}); }
function buildRaccoon(R) { R.cfg={speed:1.2,freq:2.2,waddle:.85,arms:{A:[0,.12],B:[0,-.12]},idleGestures:['wave','think','shrug','laugh']}; var t=R.node('torso',null,0,.5,0); R.part(t,function(g){limb(g,'#6e7c88',0,.34,0,.34,.4,.29,'#4c5964');g.e('#e8dfca',0,.33,.27,.21,.25,.07);g.t('#be8746',0,.12,0,.34,.04,{sz:.9})}); var h=R.node('head',t,0,.83,0); R.part(h,function(g){g.e('#87939b',0,.03,0,.49,.43,.4,{col2:'#56616b'});[-1,1].forEach(function(x){g.e('#56616b',x*.35,.03,.28,.19,.12,.08);eyeOn(g,[.49,.43,.4],x*.2,.04,.35,'#5da6a0')});g.e('#f0e4d2',0,-.18,.35,.23,.15,.12);g.e('#332d2d',0,-.12,.46,.08,.06,.05);g.e('#56616b',-.22,.4,-.02,.12,.23,.12);g.e('#56616b',.22,.4,-.02,.12,.23,.12)}); var q=R.node('tail',t,0,.18,-.3); R.part(q,function(g){g.e('#687680',0,0,-.27,.16,.17,.37);g.t('#d9d4c7',0,0,-.38,.15,.045)}); }
function buildRobot(R) { R.cfg={speed:.9,freq:2.5,waddle:.7,arms:{A:[0,.16],B:[0,-.16]},idleGestures:['wave','hop','think','nod']}; var t=R.node('torso',null,0,.55,0); R.part(t,function(g){g.b_('#4eb9b0',0,.28,0,.62,.62,.42,{gloss:true});g.e('#f4d46a',0,.32,.23,.17,.14,.06,{gloss:true});g.t('#eaf4ef',0,.32,.24,.23,.025)}); var h=R.node('head',t,0,.82,0); R.part(h,function(g){g.b_('#83d8d0',0,.02,0,.72,.58,.48,{gloss:true});[-1,1].forEach(function(x){g.e('#fff7cf',x*.2,.04,.27,.13,.14,.08);g.e('#346b79',x*.2,.04,.34,.065,.09,.035)});g.t('#2c7d82',0,-.17,.26,.19,.025);g.c('#f3be52',0,.4,0,.07,.18,.07);g.e('#f3be52',0,.59,0,.12,.12,.12,{gloss:true})}); }api.register({
  id: 'fox', name: 'Морская лисичка', title: 'Хранительница набережной', scene: 'grafskaya', build: buildFox, height: 2.9, radius: 0.6,
  spawn: { x: -17.5, z: 20.5, heading: 0.4 },
  route: [{ x: -17.5, z: 20.5, wait: [5, 9] }, { x: -21.5, z: 23.5, wait: [6, 10], face: 1.2 }, { x: -15.5, z: 23.8, wait: [4, 8] }], loop: true,
  dialog: {
    start: [{ 'if': ['q:shell:done', '!f:legend_told'], go: 'done' }, { 'if': 'q:shell:active', go: 'active' }, { 'if': 'q:shell:done', go: 'after' }, { go: 'hello' }],
    nodes: {
      hello: { emote: 'wave', text: 'Привет, путешественник! Ты случайно не видел маленькую золотую ракушку? Я потеряла её возле набережной!',
        choices: [{ label: 'Я помогу!', next: 'accept', 'do': 'quest:start:shell', emote: 'happy' }, { label: 'Может быть, позже', alt: true, next: 'later' }] },
      accept: { text: 'Ура! Она блестит, как солнечная дорожка на воде. Я уже всех расспросила… Загляни к чайке Соне — она знает каждую ракушку на набережной!' },
      later: { text: 'Конечно! Я буду здесь, у воды. Волны никуда не торопятся.' },
      active: { text: 'Ну что, нашёл мою золотую ракушку? Если пока нет — спроси чайку Соню. Она где-то рядом, бегает и прыгает.',
        choices: [{ label: 'Ракушка у меня!', 'if': 'f:shell_found', next: 'done', 'do': 'quest:done:shell', emote: 'happy' }, { label: 'Ещё ищу', alt: true, next: 'again' }] },
      again: { text: 'Не торопись. Море любит терпеливых.' },
      done: { emote: 'happy', text: 'Моя ракушка! Спасибо, спасибо, спасибо! За это я расскажу тебе настоящую легенду Севастополя.', next: 'legend' },
      legend: { 'do': 'flag:legend_told', text: 'В 1854 году, когда враги шли к бухте, моряки затопили старые корабли, чтобы закрыть им вход. Белая колонна с орлом на скале посреди воды стоит в память об этом.', next: 'legend2' },
      legend2: { text: 'А ещё говорят, что каменные львы у Графской пристани охраняют город и подмигивают всем, кто приходит с добрым сердцем.' },
      after: { text: 'Привет, друг! Хочешь, расскажу легенду ещё раз?', choices: [{ label: 'Расскажи легенду', next: 'legend' }, BYE] }
    }
  }
});

api.register({
  id: 'turtle', name: 'Капитан Черепах', title: 'Морской путешественник', scene: 'grafskaya', build: buildTurtle, height: 2.5, radius: 0.7,
  spawn: { x: -52, z: 27.5, heading: 0 },
  route: [{ x: -52, z: 27.5, wait: [14, 22], face: 0 }, { x: -49, z: 27.5, wait: [14, 22], face: 0 }],
  dialog: {
    start: [{ 'if': 'q:letter:active', go: 'letter' }, { go: 'hello' }],
    nodes: {
      hello: { emote: 'laugh', text: 'Хо-хо! Подойди, не бойся, юнга! Я Капитан Черепах. Тридцать лет бороздил моря, пока не бросил якорь на этой набережной с удочкой.', next: 'menu' },
      menu: { text: 'О чём расскажем сегодня?', choices: [{ label: 'Расскажите о кораблях', next: 'ships' }, { label: 'А сокровища тут есть?', next: 'treasure' }, { label: 'Клюёт рыбка?', next: 'fish' }, BYE] },
      ships: { text: 'Севастополь — город моряков. Его основали в 1783 году, и с тех пор корабли заходят в бухту, как домой. Посмотри на воду — видишь мачты?', next: 'menu', emote: 'nod' },
      treasure: { text: 'Сокровища? Хо-хо! Говорят, на дне бухты спят старые корабли, а в трюмах звенят монеты. Но я верю в другие клады — золотые монетки на набережной. Собирай, вдруг пригодятся!', next: 'menu', emote: 'think' },
      fish: { text: 'Клюёт редко. Зато я узнал главный секрет моря: рыба любит тишину, а чайки — шум. Вот так и живём.', next: 'menu', emote: 'laugh' },
      letter: { 'do': 'quest:done:letter', emote: 'happy', text: 'О! Письмо от Зайца-почтальона? Давно мне не писали… Ага, от старого штурмана! Спасибо, юнга, ты настоящий моряк.', next: 'letter2' },
      letter2: { text: 'Передай зайцу: пусть заходит на чай. Пирожков не обещаю, а морских баек — сколько угодно.' }
    }
  }
});

api.register({
  id: 'sonya', name: 'Чайка Соня', title: 'Собирательница ракушек', scene: 'grafskaya', build: buildGull, height: 2.2, radius: 0.5, portrait: 'gull', speed: 2.4,
  spawn: { x: 22, z: 25, heading: 3.6 },
  route: [{ x: 22, z: 25, wait: [1.5, 4] }, { x: 28, z: 26.8, wait: [1, 3], act: 'hop' }, { x: 34, z: 25, wait: [2, 5] }, { x: 28, z: 24, wait: [1, 3], act: 'wave' }], loop: true,
  dialog: {
    start: [{ 'if': ['q:shell:active', 'f:shell_found'], go: 'wait' }, { 'if': 'q:shell:active', go: 'shell' }, { go: 'hello' }],
    nodes: {
      hello: { emote: 'hop', text: 'Чайка-крик! Ой, привет! Я Соня. Бегаю, прыгаю и собираю ракушки. Сегодня нашла уже семь!', choices: [{ label: 'Покажешь ракушки?', next: 'show' }, { label: 'Пока, Соня!', alt: true }] },
      show: { text: 'Вот эта полосатая, эта розовая, а вот эта — золотая! Нашла её утром у лестницы. Блестит так, что глазам больно!', next: 'coins' },
      coins: { emote: 'laugh', text: 'А золотые монетки на набережной ты видел? Они тоже блестят. Собирай — их тут целая сотня!' },
      shell: { 'do': 'flag:shell_found', emote: 'happy', text: 'Золотая ракушка? Ах, это ты из-за неё… Я нашла её утром у лестницы и хотела оставить себе — она такая блестящая! Но раз лисичка скучает… держи!', next: 'gave' },
      gave: { text: 'Передай ей, что я не со зла. Я просто любопытная! И давай дружить, ладно?', choices: [{ label: 'Конечно, друзья!', emote: 'happy' }] },
      wait: { text: 'Ракушка уже у тебя! Беги скорее к лисичке, пока она не загрустила.' }
    }
  }
});

api.register({
  id: 'mushroom', name: 'Господин Гриб', title: 'Торговец диковинками', scene: 'grafskaya', build: buildMushroom, height: 2.55, radius: 0.75,
  spawn: { x: -33, z: 22, heading: 0.3 },
  route: [{ x: -33, z: 22, wait: [8, 14] }, { x: -29.5, z: 22.6, wait: [8, 14] }],
  dialog: {
    nodes: {
      hello: { emote: 'wave', text: 'Тс-с… подойди ближе, путешественник! Я Господин Гриб, торговец редкими диковинками. Шляпа? Нет-нет, она не ядовитая… почти.', choices: [{ label: 'Что продаёшь?', next: 'shop' }, { label: 'Откуда ты?', next: 'origin' }, BYE] },
      shop: { text: 'Скоро у меня откроется лавка: красивые украшения, редкие ракушки и коллекционные вещицы. Пока прилавок пуст, но загляни позже! (Демо: торговля появится в одном из следующих обновлений.)', emote: 'think' },
      origin: { text: 'Вырос в тени старой лестницы. Здесь тихо, влажно и пахнет морем — идеальное место для гриба!', emote: 'laugh' }
    }
  }
});

api.register({
  id: 'rabbit', name: 'Заяц-почтальон', title: 'Почта Севастополиса', scene: 'grafskaya', build: buildRabbit, height: 3.1, radius: 0.55, speed: 1.9,
  spawn: { x: 16, z: 21.5, heading: 1.5 },
  route: [{ x: 16, z: 21.5, wait: [3, 6] }, { x: 38, z: 21.5, wait: [2, 4], act: 'think' }, { x: 58, z: 21.5, wait: [3, 6], act: 'wave' }],
  dialog: {
    start: [{ 'if': 'q:letter:active', go: 'waiting' }, { 'if': 'q:letter:done', go: 'thanks' }, { go: 'hello' }],
    nodes: {
      hello: { emote: 'wave', text: 'Почта! Свежая почта! Ой, это ты… Здравствуй! У меня одно письмо никак не доедет — Капитану Черепаху. Ноги быстрые, а сумка тяжёлая. Отнесёшь?', choices: [{ label: 'Отнесу!', next: 'accept', 'do': 'quest:start:letter', emote: 'happy' }, { label: 'Может быть, позже', alt: true, next: 'later' }] },
      accept: { text: 'Спасибо! Капитан стоит на набережной у воды с удочкой, западнее колоннады. Его не пропустишь — у него фуражка с якорем!' },
      later: { text: 'Хорошо! У меня ещё куча посылок. Прыг-скок — побежал!' },
      waiting: { text: 'Письмо всё ещё у тебя? Капитан у воды, западнее колоннады, с удочкой и в фуражке с якорем.' },
      thanks: { emote: 'happy', text: 'Капитан уже ответил? Он такой! Ты настоящий помощник почтальона. В следующий раз найдётся работа поинтереснее!' }
    }
  }
});

api.register({
  id: 'fairy', name: 'Звёздная фея Луна', title: 'Хранительница звёзд', scene: 'grafskaya', build: buildFairy, height: 2.7, radius: 0.55,
  spawn: { x: 44, z: 26.5, heading: 3.3 },
  dialog: { nodes: {
    hello: { emote: 'wave', text: 'Ой, привет! Я Луна, Звёздная фея. Каждый вечер я собираю звёздочки, которые падают в бухту.', choices: [{ label: 'Покажешь звёзды?', next: 'stars' }, { label: 'Пока, Луна!', alt: true }] },
    stars: { emote: 'happy', text: 'Смотри: эта — для желаний, а эта — просто красивая. Говорят, если загадать желание у воды на закате, море его обязательно услышит.' }
  } }
});

api.register({
  id: 'crystal', name: 'Мшистый', title: 'Хранитель кристаллов', scene: 'grafskaya', build: buildCrystal, height: 2.6, radius: 0.7,
  spawn: { x: 57, z: 26.5, heading: 3.0 },
  route: [{ x: 57, z: 26.5, wait: [10, 18] }, { x: 53, z: 24.5, wait: [10, 18] }],
  dialog: { nodes: {
    hello: { emote: 'nod', text: 'Тише-тише… слышишь, как поют кристаллы? Я Мшистый. Берегу камни этой бухты уже много-много лет.', choices: [{ label: 'Какие камни?', next: 'stones' }, { label: 'До встречи!', alt: true }] },
    stones: { emote: 'think', text: 'Белая лестница Графской пристани построена из инкерманского камня — он светлый и тёплый. Говорят, камни помнят каждого, кто по ним проходил.' }
  } }
});

api.register({
  id: 'octo', name: 'Осьминожка Мира', title: 'Любительница радио', scene: 'grafskaya', build: buildOcto, height: 2.4, radius: 0.55,
  spawn: { x: -62, z: 21, heading: 0.8 },
  route: [{ x: -62, z: 21, wait: [6, 11] }, { x: -58.5, z: 23.5, wait: [6, 11], act: 'hop' }],
  dialog: { nodes: {
    hello: { emote: 'wave', text: 'Привет-привет! Я Мира, у меня в наушниках всегда играет что-то особенное. Знаешь, в этом городе есть своё радио!', choices: [{ label: 'Какое радио?', next: 'radio' }, { label: 'Пока, Мира!', alt: true }] },
    radio: { emote: 'happy', text: 'Нажми значок 📻 в углу экрана — это «Радио Севастополис». Выбирай станции, а я пока потанцую!' }
  } }
});

/* v181: строители персонажей доступны модулям (продавцы кафе) */
api.builders={ducky:buildDucky,raccoon:buildRaccoon,robot:buildRobot,rabbit:buildRabbit,gull:buildGull,octo:buildOcto,turtle:buildTurtle,mushroom:buildMushroom,fox:buildFox};
api.register({id:'ducky',name:'Утёнок Кряк',title:'Юный исследователь парка',scene:'pobedy',build:buildDucky,height:2.1,radius:.5,speed:1.05,spawn:{x:-18,z:-5,heading:.4},route:[{x:-18,z:-5,wait:[3,6]},{x:-12,z:1,wait:[2,4],act:'hop'},{x:-20,z:7,wait:[3,5],act:'wave'}],loop:true,dialog:{nodes:{hello:{emote:'wave',text:'Кря-кря! Привет! Я Кряк, исследователь парка. Ищу самые красивые листья и самые весёлые лужи!',choices:[{label:'Что уже нашёл?',next:'finds'},{label:'Удачи, Кряк!',alt:true}]},finds:{emote:'happy',text:'Нашёл лист в форме звезды и целых три шишки! А ещё отсюда здорово смотреть на море.'}}}});
api.register({id:'raccoon',name:'Енот Тим',title:'Хранитель чистоты',scene:'pobedy',build:buildRaccoon,height:2.4,radius:.55,speed:1.2,spawn:{x:17,z:2,heading:2.4},route:[{x:17,z:2,wait:[5,8]},{x:23,z:8,wait:[3,6],act:'think'},{x:12,z:12,wait:[4,7]}],loop:true,dialog:{nodes:{hello:{emote:'wave',text:'Здравствуй! Я Тим, слежу, чтобы в парке было чисто и уютно. Красивый парк начинается с маленькой доброй привычки.',choices:[{label:'Чем помочь?',next:'help'},{label:'Пока, Тим!',alt:true}]},help:{emote:'nod',text:'Если увидишь бумажку или бутылку, донеси до урны. Тогда белки, птицы и все гуляющие будут довольны!'}}}});
api.register({id:'robot',name:'Робот Бип',title:'Помощник у колеса обозрения',scene:'pobedy',build:buildRobot,height:2.5,radius:.58,speed:.9,spawn:{x:31,z:-8,heading:3.1},route:[{x:31,z:-8,wait:[6,10]},{x:36,z:-2,wait:[4,8],act:'wave'}],loop:true,dialog:{nodes:{hello:{emote:'wave',text:'Би-бип! Привет, путешественник. Я Бип — маленький робот-гид. Мой любимый вид из парка — сверху, с колеса обозрения!',choices:[{label:'Ты умеешь летать?',next:'fly'},{label:'До встречи!',alt:true}]},fly:{emote:'think',text:'Пока только мечтаю! Зато я умею считать кабинки и здороваться со всеми гостями. Бип-бип!'}}}});/* Дополнительные жители обеих локаций: отдельные палитры, силуэты и реплики. */
/* ---------- Игрушечные зверята (большая голова, огромные глаза, без подставки) ---------- */
function toyEyeOn(g,R,x,y,es,rim){var zz=R[2]*Math.sqrt(Math.max(.05,1-(x/R[0])*(x/R[0])-(y/R[1])*(y/R[1]))),n=norm([x/(R[0]*R[0]),y/(R[1]*R[1]),zz/(R[2]*R[2])]),rot=[-Math.asin(clamp(n[1],-1,1)),Math.atan2(n[0],n[2]),0];
g.at([x-n[0]*es*.12,y-n[1]*es*.12,zz-n[2]*es*.12],rot);
g.e(rim,0,-es*.05,0,es*1.04,es*1.1,es*.3,{gloss:true,ao:0});g.e('#12121a',0,es*.05,es*.1,es*.94,es*1.0,es*.3,{gloss:true,ao:0});
g.e('#ffffff',es*.3,es*.36,es*.36,es*.26,es*.28,es*.1,{gloss:true,ao:0});g.e('#ffffff',-es*.28,-es*.3,es*.34,es*.1,es*.1,es*.07,{gloss:true,ao:0});g.end()}
function buildToy(P){return function(R){
var HR=P.HR||[.78,.66,.7],hipY=.34,rim=P.rim||'#4db3ee';
R.cfg={speed:P.speed||1,freq:2.6,waddle:.9,arms:{A:[0,.12],B:[0,-.12]},idleGestures:['wave','hop','think','laugh','shrug','nod']};
[['legA',.15],['legB',-.15]].forEach(function(d){var L=R.node(d[0],null,d[1],hipY,0);R.part(L,function(g){limb(g,P.body,0,-.13,0,.1,.17,.11,P.body2);limb(g,P.foot,0,-.29,.05,.11,.06,.15)})});
var torso=R.node('torso',null,0,hipY,0);
R.part(torso,function(g){limb(g,P.body,0,.22,0,.3,.3,.25,P.body2);g.e(P.belly,0,.2,.18,.2,.22,.1,{col2:P.belly})});
[['armA',1],['armB',-1]].forEach(function(d){var A=R.node(d[0],torso,d[1]*.3,.42,0);R.part(A,function(g){limb(g,P.body,0,-.11,.02,.075,.15,.08,P.body2);limb(g,P.hand||P.body,0,-.25,.05,.085,.075,.085)})});
if(P.tail&&P.tail!=='none'){var tl=R.node('tail',torso,0,.14,-.24);R.part(tl,function(g){var T=P.tailCol||P.body,K=P.tailTip||T;
if(P.tail==='bush'){limb(g,T,0,.1,-.2,.14,.14,.22);limb(g,T,0,.22,-.4,.2,.22,.28);limb(g,K,0,.36,-.58,.16,.17,.2)}
else if(P.tail==='bushWhite'){limb(g,T,0,.1,-.2,.15,.15,.22);limb(g,T,0,.24,-.42,.22,.24,.3);limb(g,K,0,.4,-.64,.2,.22,.26)}
else if(P.tail==='curl'){[[.08,-.2,.12],[.22,-.36,.12],[.42,-.42,.11],[.6,-.34,.1]].forEach(function(p){limb(g,T,0,p[0],p[1],p[2],p[2],p[2]*1.2)})}
else if(P.tail==='cat'){[[.1,-.2,.07],[.25,-.3,.07],[.42,-.32,.065],[.58,-.26,.06]].forEach(function(p,i){limb(g,i>1?K:T,0,p[0],p[1],p[2],p[2]*1.3,p[2])})}
else if(P.tail==='puff'){limb(g,K,0,.08,-.24,.17,.17,.16)}
else{limb(g,T,0,.06,-.2,.1,.1,.1)}})}
var head=R.node('head',torso,0,1,0);
R.part(head,function(g){
g.e(P.head,0,0,0,HR[0],HR[1],HR[2],{w:22,h:16,col2:P.head2||P.head});
if(P.face==='low')g.e(P.faceCol,0,-.28,.14,.66,.42,.6,{w:18});
if(P.face==='mask')g.e(P.faceCol,0,-.2,.2,.74,.5,.52,{w:18});
if(P.face==='muzzle')g.e(P.faceCol,0,-.27,.5,.28,.22,.18,{w:14});
if(P.face==='full')g.e(P.faceCol,0,-.04,.08,.68,.56,.6,{w:18});
toyEyeOn(g,HR,.31,-.01,.25,rim);toyEyeOn(g,HR,-.31,-.01,.25,rim);
var ny=P.noseY===undefined?-.2:P.noseY,nz=(P.noseZ||HR[2]*Math.sqrt(Math.max(.05,1-(ny/HR[1])*(ny/HR[1]))))-.03;
g.e(P.nose||'#1c1c24',0,ny,nz,P.noseR||.07,(P.noseR||.07)*.72,.05,{gloss:true});
for(var i=0;i<5;i++){var t=i/4*2-1,w=.1,yy=ny-.13+(P.sad?-1:1)*t*t*w*.55;g.e(P.mouth||'#8a4a3a',t*w,yy,nz-.02-Math.abs(t)*.02,w*.14,w*.1,.03,{ao:0})}
if(P.sad)[1,-1].forEach(function(s){g.e(P.brow||'#5a3a1e',s*.4,.36,.5,.2,.035,.04,{rot:[0,0,-s*.38],ao:0})});
if(P.stripes){[-.4,0,.4].forEach(function(d){spot(g,P.stripes,[0,0,0],HR,.5,PI/2+d,.05,.2,.03)});[1,-1].forEach(function(s){spot(g,P.stripes,[0,0,0],HR,1.3,PI/2+s*1.0,.2,.04,.03);spot(g,P.stripes,[0,0,0],HR,1.5,PI/2+s*1.05,.17,.04,.03)})}
if(P.hair){var n=P.hair.n,a0=P.hair.a0,a1=P.hair.a1;for(var k=0;k<n;k++){var a=a0+(a1-a0)*k/(n-1);g.c(P.hair.col,Math.cos(a)*HR[0]*.9,Math.sin(a)*HR[1]*.9,P.hair.z,P.hair.r,0,P.hair.h*(.8+.2*Math.sin(k*2.3)),{rot:[0,0,a-PI/2],w:8,caps:1})}}
});
if(P.ears){var E=P.ears;[['earA',1],['earB',-1]].forEach(function(d){var s=d[1],ex=E.type==='round'?s*.56:(E.type==='long'?s*.3:s*.45),ey=E.type==='round'?.46:(E.type==='long'?.5:.5),En=R.node(d[0],head,ex,ey,-.05);
R.part(En,function(g){
if(E.type==='point'){var h=E.h||.72;g.c(E.col,0,-.06,0,E.w||.28,.03,h,{sz:.42,rot:[-.05,0,-s*.28],w:12});g.c(E.inner,s*.02,-.02,.06,(E.w||.28)*.57,.02,h*.72,{sz:.3,rot:[-.05,0,-s*.28],w:12})}
else if(E.type==='round'){g.e(E.col,0,.1,0,.24,.24,.13);g.e(E.inner,0,.1,.07,.14,.14,.06)}
else{g.e(E.col,s*.04,.62,0,.2,.68,.1,{rot:[0,0,-s*.1]});g.e(E.inner,s*.04,.62,.06,.12,.52,.05,{rot:[0,0,-s*.1]})}})});R.cfg.earBase=0}
}}
var TOYS=[
{id:'toy_fox_sun',name:'Лисёнок Солнышко',title:'Любитель солнечных бликов',P:{head:'#f2c43a',head2:'#f0b04a',face:'low',faceCol:'#fbe3d6',body:'#eca24f',body2:'#d98a3e',belly:'#fbe3d6',foot:'#e9a35a',hand:'#f1b27a',tail:'bush',tailCol:'#e9a93a',ears:{type:'point',col:'#f0b535',inner:'#fde8a8'}},sp:{x:-30,z:12,heading:.5},route:[[-30,12],[-26,17],[-33,18]],hello:'Привет! Я собираю солнечные зайчики на воде. Хочешь, покажу, где их больше всего?',story:'Сегодня в бликах на море я насчитал целых тридцать семь зайчиков. Один, по-моему, мне подмигнул!'},
{id:'toy_bear_sad',name:'Мишка Грустинка',title:'Мечтатель с большими глазами',P:{head:'#b27a3e',head2:'#a06c33',body:'#a8723a',body2:'#946130',belly:'#c79860',foot:'#8a5a2c',tail:'stub',ears:{type:'round',col:'#a56f37',inner:'#b98650'},nose:'#7a4a52',noseR:.1,sad:true,rim:'#58b4ee'},sp:{x:-8,z:14,heading:3},route:[[-8,14],[-3,18],[-11,19]],hello:'Ох… Привет. Я не грущу, просто у меня такие глаза. А вообще я очень рад гостям!',story:'Когда мне становится совсем грустно, я иду в парк и смотрю на карусель. Вертится, и грусть тоже улетает.'},
{id:'toy_hedge_brown',name:'Ёжик Колючка',title:'Хранитель маленьких секретов',P:{head:'#f3dd9a',head2:'#ecd08c',body:'#f2dc9c',body2:'#e6c984',belly:'#f5cdbb',foot:'#f6e3b0',tail:'none',ears:{type:'round',col:'#f4e0a0',inner:'#f2b5a8'},hair:{n:11,a0:.5,a1:2.65,col:'#8a5a2e',z:-.02,r:.14,h:.42},nose:'#1c1c24',noseR:.06,noseY:-.12},sp:{x:5,z:-12,heading:1},route:[[5,-12],[10,-8],[2,-8]],hello:'Тсс! Я прячу блестящие камушки по всему парку. Если найдёшь один, это наш секрет!',story:'Колючки у меня только сверху. Внутри я мягкий, как булочка, особенно когда мне дарят яблоко.'},
{id:'toy_kitty',name:'Кошечка Мурка',title:'Знаток уютных уголков',P:{head:'#f7e6df',head2:'#f3d9d6',body:'#efe9f0',body2:'#e2dce8',belly:'#ffffff',foot:'#ffffff',tail:'cat',tailCol:'#d9d4de',tailTip:'#8c8d99',ears:{type:'point',col:'#8d8e9c',inner:'#cfcfe8',h:.8,w:.34},stripes:'#8c8d99',nose:'#ee8fb0',noseR:.05,mouth:'#e07a9a'},sp:{x:13,z:14,heading:3.4},route:[[13,14],[18,18],[10,19]],hello:'Мяу! Я знаю в парке все самые тёплые скамейки. Хочешь адрес лучшей?',story:'Лучшая скамейка стоит там, где солнце греет с утра. Только тихо: на ней иногда спит кто-то ещё.'},
{id:'toy_hare',name:'Зайка Ушастик',title:'Слушатель всех секретов',P:{head:'#e8d9a0',head2:'#f2dcc8',face:'low',faceCol:'#f9e6dc',body:'#c9c7d6',body2:'#b8b6c8',belly:'#efeaf6',foot:'#ffffff',tail:'puff',tailTip:'#ffffff',ears:{type:'long',col:'#b8b6c4',inner:'#d9d3ef'},nose:'#e8789e',noseR:.05,mouth:'#e07a9a'},sp:{x:-30,z:-12,heading:.8},route:[[-30,-12],[-25,-7],[-33,-6]],hello:'Ой, здравствуй! У меня такие большие уши, что я слышу, как шуршат листья за три аллеи.',story:'Сегодня утром я услышал, как в фонтане смеётся вода. Честное ушастое слово!'},
{id:'toy_fox_tail',name:'Лисичка Тая',title:'Хозяйка пушистого хвоста',P:{head:'#efb02c',head2:'#f0a63a',face:'low',faceCol:'#fff1ea',body:'#e49a3a',body2:'#cf842f',belly:'#fff1ea',foot:'#e6a04a',hand:'#eba558',tail:'bushWhite',tailCol:'#e19637',tailTip:'#ffffff',ears:{type:'point',col:'#efa92a',inner:'#f9dca8'}},sp:{x:56,z:610,heading:1.5},route:[[56,610],[62,616],[54,620]],hello:'Привет! Видишь, какой у меня хвост? Белый кончик, как пенка на волне. Все им любуются!',story:'Когда я бегу по плитке у аквапарка, хвост развевается, как флаг. Попробуй угнаться!'},
{id:'toy_bear_honey',name:'Медвежонок Бублик',title:'Знаток сладких булочек',P:{head:'#b38a3a',head2:'#9c7430',face:'muzzle',faceCol:'#f6d6b0',body:'#a8855a',body2:'#947249',belly:'#b08e60',foot:'#8c6a3a',tail:'stub',ears:{type:'round',col:'#a67e34',inner:'#f0d56a'},nose:'#2a2428',noseR:.09,noseY:-.18,noseZ:.7},sp:{x:72,z:610,heading:2},route:[[72,610],[78,615],[68,620]],hello:'Здравствуй! Я Бублик. Если пахнет булочками, я уже рядом. Нос меня ни разу не подводил!',story:'Говорят, у колеса обозрения самые вкусные булочки. Я сто раз проверял, чтобы быть уверенным.'},
{id:'toy_fox_cream',name:'Лис Рыжик',title:'Гид по аквапарку',P:{head:'#f3d13f',head2:'#f0c040',face:'mask',faceCol:'#fbe8d8',body:'#ee9a3a',body2:'#d8842f',belly:'#fbf1f5',foot:'#e9a550',hand:'#f0ae64',tail:'curl',tailCol:'#e78f2f',ears:{type:'point',col:'#eaa028',inner:'#fbeadb'}},sp:{x:86,z:608,heading:2.5},route:[[86,608],[92,614],[82,620]],hello:'Добро пожаловать! Я Рыжик, провожу всех к горкам. Лучше всего начинать с пиратского корабля!',story:'Со спиральной башни виден весь парк. Только не бойся: вода внизу мягкая, а смех слышно далеко.'},
{id:'toy_hedge_spiky',name:'Ёжик Шишка',title:'Мастер причёсок',P:{head:'#f9dfc2',head2:'#f5cdb0',body:'#b8873c',body2:'#a47630',belly:'#f6e3b0',hand:'#fbd6c0',foot:'#b0763a',tail:'none',ears:{type:'round',col:'#f9dfc2',inner:'#f2b5a8'},hair:{n:13,a0:-.15,a1:3.3,col:'#bf9a3c',z:-.25,r:.26,h:.75},nose:'#1c1c24',noseR:.05,noseY:-.1},sp:{x:62,z:622,heading:4},route:[[62,622],[68,618],[58,617]],hello:'Заметил мою причёску? Каждое утро причёсываю её сорок минут. Нравится?',story:'Секрет простой: капелька морской воды и хорошее настроение. Иголки сами встают как надо!'}];
TOYS.forEach(function(t){var d={hello:{emote:'wave',text:t.hello,choices:[{label:'Расскажи ещё!',next:'story'},{label:'До встречи!',alt:true}]},story:{emote:'happy',text:t.story}};
api.register({id:t.id,name:t.name,title:t.title,scene:'pobedy',build:buildToy(t.P),height:2.5,radius:.55,speed:1,spawn:t.sp,route:t.route.map(function(p,i){return{x:p[0],z:p[1],wait:[3,7],act:i===1?'hop':(i===2?'wave':undefined)}}),loop:true,dialog:{nodes:d}})});

function addNPCPlushDetails(def,R) {
  var id=def.id||'',sp=def.species||id.replace(/^(park_|graf_)/,''),fur=R.fur||'#f4e8d6',dark=R.furDark||'#b98b68',belly=R.belly||'#f8f2e8',t=R.nodes.torso;
  if(t){var panel=R.node('softBelly',t,0,0,0);R.part(panel,function(g){g.e(belly,0,.15,.255,.205,.19,.065,{col2:fur})});}
  if(R.nodes.tail&&['fox','firefox','dreamfox','facetedfox','knitfox','cat','squirrel','otter','raccoon'].indexOf(sp)>=0){var tip=R.node('softTailTip',R.nodes.tail,0,0,0);R.part(tip,function(g){g.e(sp==='facetedfox'?'#fff5e9':fur,0,.035,-.7,.11,.12,.15,{col2:dark})})}
}function makeTownNPC(o) { return function(R) {
  var sp=o.species||'', foxlike=sp==='fox'||sp==='firefox'||sp==='dreamfox'||sp==='knitfox'||sp==='facetedfox', sailor=sp==='raccoon', coat=sailor?'#f4f0df':o.accent, skin=o.body, headCol=o.head, feet=o.shoe||'#403a43';
  R.fur=o.trim;R.furDark=o.shade;R.belly=o.species==='graf_cat'?'#fffaf0':'#f7f0e4';R.cfg={speed:o.speed||1.05,freq:2.15+(o.n%4)*.18,waddle:.68+(o.n%3)*.12,arms:{A:[0,.13],B:[0,-.13]},idleGestures:['wave','think','laugh','hop','nod']};
  var torso=R.node('torso',null,0,.52,0);
  R.part(torso,function(g){
    limb(g,skin,0,.28,0,.39,.4,.31,o.shade);
    g.e(coat,0,.31,.235,.26,.28,.085,{col2:o.shade}); g.t(sailor?'#31527a':o.trim,0,.1,.015,.31,.035,{sz:.9});
    g.e(sailor?'#cc514b':o.trim,0,.25,.323,.085,.17,.04); [-.11,.11].forEach(function(x){g.e(sailor?'#f2c35a':o.accent,x,.21,.33,.035,.035,.025,{gloss:true})});
    if(sp==='butterfly'||sp==='gull'||sp==='penguin'||sp==='owl'||sp==='bat'||sp==='parrot')[-1,1].forEach(function(x){g.e((sp==='butterfly'||sp==='parrot')?o.accent:o.body,x*.37,.32,-.02,sp==='bat'?.23:.18,.27,.13,{col2:o.shade})});
    if(sp==='turtle'){g.e(o.accent,0,.33,-.17,.35,.31,.2,{col2:o.shade});g.t(o.trim,0,.34,-.18,.27,.024)}if(sp==='walrus'){g.e(o.trim,0,.22,.31,.19,.2,.08);[-1,1].forEach(function(x){g.e('#f4e7ca',x*.12,-.02,.37,.045,.18,.045)})}if(sp==='beaver')g.e(o.shade,0,.2,-.27,.3,.22,.14);if(sp==='knitfox'){for(var st=0;st<4;st++)[-1,1].forEach(function(x){g.e(o.trim,x*.22,.22+st*.1,.31,.035,.018,.018)});g.e(o.accent,0,.5,.31,.31,.07,.07)}if(sp==='dreamfox')g.e(o.accent,0,.53,.27,.15,.045,.025,{gloss:true});if(sp==='facetedfox'){g.e(o.accent,-.2,.34,.31,.09,.16,.025);g.e(o.trim,.2,.34,.31,.09,.16,.025)}if(sp==='alpaca')for(var wool=0;wool<5;wool++)g.e(o.trim,-.24+wool*.12,.46,.06,.09,.11,.09,{col2:o.shade})
    if(sp==='crab')[-1,1].forEach(function(x){g.e(o.accent,x*.42,.26,.02,.18,.14,.15);g.e(o.trim,x*.52,.35,.05,.12,.13,.12)})
    if(sp==='hedgehog')for(var k=0;k<5;k++)g.c(o.shade,-.25+k*.125,.56,-.04,.07,.17,.07,{w:6});
    if(sailor){g.e('#31527a',0,.5,-.06,.35,.22,.25);g.e('#f3ecdd',0,.62,-.05,.28,.1,.21);g.e('#ce534b',0,.43,.24,.09,.19,.04)}if(sp==='firefox'){g.e('#ffd45f',0,.37,.345,.16,.25,.045,{col2:'#f47b3b',gloss:true});g.e('#f9a044',-.14,.33,.33,.11,.22,.045,{col2:'#dc3f3d'});g.e('#f9a044',.14,.33,.33,.11,.22,.045,{col2:'#dc3f3d'});g.e('#fff0bc',0,.48,.35,.075,.16,.035,{gloss:true})}
  });
  [-1,1].forEach(function(side){var leg=R.node(side<0?'legA':'legB',torso,side*.15,-.12,0);R.part(leg,function(g){limb(g,o.pants||o.shade,0,-.13,0,.115,.19,.12);limb(g,o.pants||o.shade,0,-.31,.015,.09,.12,.1);g.e(feet,0,-.39,.09,.14,.075,.19);g.e(o.trim,-.055,-.39,.205,.035,.024,.018);g.e(o.trim,0,-.4,.22,.035,.024,.018);g.e(o.trim,.055,-.39,.205,.035,.024,.018);g.e(o.shade,0,-.36,.208,.075,.045,.018);[-1,1].forEach(function(px){g.e(o.trim,px*.095,-.39,.214,.018,.035,.012)})})});
  [-1,1].forEach(function(side){var arm=R.node(side<0?'armA':'armB',torso,side*.3,.42,0);R.part(arm,function(g){limb(g,coat,side*.08,-.1,0,.12,.2,.12,o.shade);limb(g,skin,side*.12,-.29,.035,.105,.1,.11);[-.06,-.02,.02,.06].forEach(function(x){g.e(o.trim,side*.12+x,-.34,.09,.026,.05,.032)});g.e(o.shade,side*.12,-.29,.14,.045,.035,.02)})});
  if(foxlike||['squirrel','cat','mouse','dog','dolphin','seal','seahorse','turtle'].indexOf(sp)>=0){var tail=R.node('tail',torso,0,.02,-.23);R.part(tail,function(g){var len=(sp==='squirrel'||foxlike)?.48:.34;g.e(o.body,0,0,-len,.2,.22,len*1.08,{col2:o.shade});g.e(o.trim,-.08,.09,-len*1.22,.12,.14,.16);g.e(o.trim,.08,-.08,-len*1.45,.12,.14,.16);if(sp==='squirrel'||foxlike)g.e(o.trim,0,.04,-len*1.7,.13,.14,.17);if(sp==='dolphin'||sp==='seahorse')g.e(o.accent,0,-.13,-len*1.6,.22,.08,.14)})}
  if(sp==='firefox'){[-1,1].forEach(function(side){var plume=R.node('firePlume'+side,torso,side*.2,.02,-.2);R.part(plume,function(g){g.e('#d83d42',0,.015,-.36,.13,.15,.39,{col2:'#ff9b42'});g.e('#ffd45f',0,.07,-.48,.09,.1,.3,{col2:'#fff0bc',gloss:true})})})}
  if(o.playBall&&o.ballOwner){var ball=R.node('ball',null,0,.32,.55);R.part(ball,function(g){g.e('#f4b942',0,0,0,.13,.13,.13,{gloss:true});g.e('#fff4da',0,0,.132,.035,.035,.018);g.e('#d94a45',0,0,-.132,.035,.035,.018)})}var head=R.node('head',torso,0,.82,0), rx=(sp==='bear'||sp==='seal'||sp==='cloud'||sp==='crab')?.47:.42, ry=sp==='deer'?.45:.39, rz=.35;
  R.part(head,function(g){g.e(headCol,0,.02,0,rx,ry,rz,{col2:o.shade});
    if(foxlike||['cat','mouse','dog','squirrel','rabbit'].indexOf(sp)>=0)[-1,1].forEach(function(x){var tall=sp==='rabbit'?.32:sp==='dog'?.12:.21;g.e(headCol,x*.26,.34,-.015,.13,tall,.12,{col2:o.shade});g.e(sp==='dog'?o.shade:o.trim,x*.26,.35,.06,.07,tall*.62,.035)});
    if(sp==='bear'||sp==='seal'||sp==='crab')[-1,1].forEach(function(x){g.e(headCol,x*.31,.34,-.015,.13,.13,.12,{col2:o.shade});g.e(o.trim,x*.31,.35,.08,.065,.065,.03)});
    if(sp==='deer'||sp==='seahorse')[-1,1].forEach(function(x){g.c(o.accent,x*.2,.42,-.03,.08,sp==='deer'?.27:.2,.08,{w:7});if(sp==='deer')g.c(o.trim,x*.3,.56,-.03,.05,.13,.05,{w:6})});
    if(sp==='alpaca')[-1,1].forEach(function(x){g.e(headCol,x*.27,.37,-.02,.09,.24,.08,{col2:o.shade})});if(sp==='hedgehog')for(var j=0;j<5;j++)g.c(o.shade,-.27+j*.135,.4,-.04,.075,.2,.075,{w:6});
    if(sp==='raccoon')[-1,1].forEach(function(x){g.e(o.shade,x*.17,.04,.325,.105,.07,.04)});if(sp==='dreamfox'||sp==='facetedfox'||sp==='knitfox')[-1,1].forEach(function(x){g.e(o.trim,x*.26,.48,.045,.075,.055,.035,{col2:o.shade})});if(sp==='robot'){g.b_(o.trim,0,.02,.28,.57,.25,.12,{gloss:true});g.e(o.accent,0,.51,0,.045,.25,.045);g.e(o.trim,0,.7,0,.1,.1,.1,{gloss:true})}
    if(sp==='owl'||sp==='butterfly')[-1,1].forEach(function(x){g.c(o.trim,x*.15,.41,-.04,.07,.16,.07,{w:6})});
    if(sp==='gull'||sp==='pelican'||sp==='penguin'||sp==='duck'||sp==='frog')g.e(o.accent,0,-.13,.35,.18,.105,.13);
    if(sp==='octopus')[-1,1].forEach(function(x){g.e(o.accent,x*.39,-.13,-.03,.09,.3,.11);g.e(o.accent,x*.31,-.24,-.04,.1,.23,.12)});
    if(sailor){g.e('#2d3447',-.22,.34,.12,.17,.12,.21);g.e('#f6f1e5',0,.42,-.02,.35,.13,.25);g.e('#31527a',0,.38,.18,.39,.055,.21);g.e('#2d3447',-.13,.31,.24,.14,.12,.08)}
    [-1,1].forEach(function(x){var ey=sp==='frog'||sp==='salamander'?.13:0;g.e(o.shade,x*.17,ey,.338,.082,.112,.043);g.e('#fff8ed',x*.17,ey,.362,.067,.091,.033);g.e(o.eye||'#35292c',x*.17,ey,.39,.045,.069,.024);g.e('#241e23',x*.17,ey-.004,.408,.023,.052,.013);g.e('#ffffff',x*.17-.014,ey+.032,.421,.015,.02,.011,{gloss:true});g.e('#ffffff',x*.17+.017,ey-.022,.419,.008,.01,.007,{gloss:true});if(sp==='dreamfox')g.e(o.shade,x*.17,ey+.064,.415,.068,.012,.012)});
    g.e(o.trim,-.25,-.12,.28,.07,.035,.024);g.e(o.trim,.25,-.12,.28,.07,.035,.024);
    if(sp==='cat'||sp==='seal'||sp==='mouse')[-1,1].forEach(function(x){g.e(o.shade,x*.31,-.12,.35,.14,.018,.018);g.e(o.shade,x*.35,-.18,.33,.12,.018,.018)});
    if(foxlike||sp==='dog'||sp==='squirrel'||sp==='bear')g.e(o.trim,0,-.11,.35,.16,.11,.08);
    smile(g,o.shade,-.23,.34,.105,5,{gloss:true});g.e('#f3a4a0',-.27,-.11,.29,.07,.045,.018,{gloss:true});g.e('#f3a4a0',.27,-.11,.29,.07,.045,.018,{gloss:true});
    if(foxlike||['squirrel','cat','deer','dog','mouse'].indexOf(sp)>=0){g.e(o.trim,-.13,.25,.325,.12,.07,.05);g.e(o.trim,.02,.28,.33,.14,.08,.055)}if(foxlike){[-1,1].forEach(function(x){g.e(o.shade,x*.26,.48,.045,.075,.055,.035,{col2:o.shade})});g.e(o.trim,0,-.1,.405,.09,.055,.045)}
  });
  if(o.sleepy){var lids=R.node('sleepLids',head,0,0,0);R.part(lids,function(g){[-1,1].forEach(function(x){g.e(o.shade,x*.17,.012,.424,.07,.014,.012);g.e(o.shade,x*.17-.025,.024,.423,.024,.012,.01);g.e(o.shade,x*.17+.025,.024,.423,.024,.012,.01)})});var curl=R.node('sleepCurl',torso,0,.03,-.12);R.part(curl,function(g){g.e(o.trim,-.28,.03,.05,.15,.18,.19,{col2:o.shade});g.e(o.trim,.28,.03,.05,.15,.18,.19,{col2:o.shade});g.e(o.trim,0,.21,.02,.22,.13,.15,{col2:o.shade});g.e(o.trim,0,-.14,.04,.2,.12,.14,{col2:o.shade})})}
}; }var extraParkNPCs=[
 ['park_squirrel','Белочка Рыжуля','Собирательница шишек','tail','#e48a43','#f5c98c','#b85c35','#8b472f','#4c352b','Вжик-вжик! Я Рыжуля. Прячу шишки в секретных местах и иногда сама забываю где!','Поможешь искать? Тогда смотри под самые пушистые сосны — там мои лучшие тайники.'],
 ['park_fox','Лисёнок Федя','Следопыт лесных дорожек','ears','#d97839','#f5d3a6','#3e9c87','#a64f32','#3a302b','Привет! Я Федя, знаю в парке каждую тропинку и каждую интересную корягу.','Моя любимая тропа ведёт к морю. Там ветер рассказывает самые длинные истории.'],
 ['park_owl','Сова Соната','Музыкальная мечтательница','hat','#9b79b5','#eee0f5','#ffd166','#70527f','#352f43','Добрый день! Я Соната. Вечером слушаю, как парк тихонько поёт под шелест листьев.','Если замолчать на минутку, можно услышать целый оркестр: птиц, ветер и море!'],
 ['park_bear','Медвежонок Топа','Любитель пикников','wide','#9b684d','#f5dfc4','#e6a64b','#654636','#352b26','Здравствуй! Я Топа, мастер уютных пикников. В корзинке у меня яблоки для друзей.','Угощайся! После прогулки яблоко особенно вкусное. Только мусор донеси до урны.'],
 ['park_frog','Лягушонок Квак','Знаток парковых луж','beak','#58ad68','#d7f2b0','#f5b642','#387a4e','#253b2b','Квак-привет! Я Квак, изучаю лужи. В каждой отражается своё маленькое небо.','После дождя найди самую большую лужу и посмотри, сколько облаков в ней поместилось.'],
 ['park_robot','Дрончик Пикс','Фотограф парка','antenna','#55a8c7','#d9f3f6','#f5c94d','#38788c','#173c4a','Пик-пик! Я Пикс, фотографирую красивые места и собираю улыбки в альбом.','Для отличного снимка встань так, чтобы за спиной были деревья и блестело море!'],
 ['park_turtle','Черепашка Лапа','Спокойная путешественница','shell','#69a88c','#b7ddbb','#d6a85d','#42745f','#27372d','Привет, я Лапа. Иду не спеша, зато замечаю каждый цветочек у дороги.','Попробуй сегодня пройтись медленно. Вдруг увидишь то, мимо чего обычно пробегаешь?'],
 ['park_mouse','Мышонок Пуговка','Художница листьев','ears','#a5a6b4','#f2e6df','#ed8db1','#747484','#35313a','Я Пуговка! Рисую листьями: у каждого дерева свой узор и свой зелёный оттенок.','Собираю только упавшие листья. Живые пусть остаются на ветках — им там лучше.'],
 ['park_deer','Оленёнок Искра','Знаток созвездий','horns','#c68e5b','#f4deb8','#74a9dc','#8b5e3c','#45352a','Меня зовут Искра. Днём ищу красивые облака, а вечером — созвездия над парком.','Найди вечером Большую Медведицу. Она похожа на ковш, которым море зачерпывает звёзды.'],
 ['park_cat','Кошка Мята','Проводница тихих троп','tail','#8dbab2','#f4ead6','#deaa4e','#608e85','#35312d','Мур-привет! Я Мята, показываю гостям тихие дорожки и солнечные лавочки.','На той лавочке солнце греет спинку почти весь день. Проверено лично!'],
 ['park_penguin','Пингвин Пончик','Мечтатель о дальних морях','beak','#4d718d','#e8f0e7','#f0a94b','#37536c','#24313c','Я Пончик, приехал помечтать о дальних морях. Здесь даже летний ветер пахнет приключениями.','Когда смотришь на горизонт, кажется, что можно доплыть до самого края карты!'],
 ['park_butterfly','Бабочка Фиалка','Садовая исследовательница','wings','#956fc2','#e8d8fa','#f3c85b','#6d4b9a','#393043','Привет! Я Фиалка, ищу цветы самых разных оттенков. Каждый лепесток будто маленькая открытка.','Загляни к клумбам и найди цветок, похожий на твой любимый цвет.'],
 ['park_hedgehog','Ёжик Колючка','Садовник-умелец','spikes','#9a765b','#f2dfc2','#6dab70','#71513c','#342a24','Я Колючка, помогаю садовникам и берегу молодые ростки. Они так стараются тянуться к солнцу!','Береги маленькие растения и не сходи с дорожек — так им будет спокойнее.'],
 ['park_dog','Щенок Барсик','Весёлый бегун','ears','#c8a05f','#f6e7c7','#5ba4d0','#917044','#382f24','Гав! Я Барсик, тренируюсь бегать по кругу и здороваться со всеми подряд.','Пробежка бодрит! А потом можно спокойно посидеть в тени и послушать птиц.'],
 ['park_cloud','Облачко Пух','Собиратель хорошего настроения','wide','#d6edf3','#ffffff','#f6c858','#9fcbd8','#3f5960','Я Пух, маленькое облачко над парком. Собираю хорошие пожелания и отправляю их к морю.','Загадай доброе желание для друга — ветер обязательно его подхватит!'],
 ['park_cubfox','Лисёнок Рыжик','Любопытный исследователь парка','ears','#f08a3c','#fff5e9','#f1a54b','#b95b25','#3b2d28','Привет! Я Рыжик. Люблю нюхать цветы и искать самые уютные места в парке.','Если увидишь красивый листочек, покажи его мне — я собираю осенние цвета!'],
 ['park_dreamingfox','Лисёнок Дрёма','Тихий мечтатель','ears','#c88e70','#f5e7d6','#b4a4d8','#79594f','#423535','Тс-с… я Дрёма. Люблю тихие уголки и облака, похожие на рыбок.','Когда закрываешь глаза, можно увидеть целое море снов.'],
 ['park_knitfox','Лисёнок Петелька','Мастерица уютных узоров','tail','#df803a','#fff0d9','#45a69b','#a55231','#49312b','Привет! Я Петелька, люблю тёплые шарфы и узоры.','У каждого узелка есть своя история — особенно рядом с морем!'],
 ['park_ballcat_a','Котик Пончик','Играет в мяч','ears','#d98955','#fff0df','#4ba8bb','#ad5c34','#3d302d','Лови! Я бросаю мячик!','Отличный пас! Давай ещё раз!'],
 ['park_ballcat_b','Кошечка Ириска','Играет в мяч','tail','#b98972','#f7e6d8','#dc8eae','#805c50','#41343a','Поймала! Теперь твоя очередь!','Мы с Пончиком можем играть целый день!'],
 ['park_sleepcat_a','Котик Соня','Любит тихие сны','ears','#a6a5b2','#fff2e8','#89b8bb','#777587','#39333a','Мр-р… я только что проснулся.','Как хорошо немного вздремнуть под шум деревьев!'],
 ['park_sleepcat_b','Кошечка Облачко','Любит спать клубочком','tail','#d1b8a6','#fff8ef','#b19cc8','#98806f','#43383a','Зев… Ты подошёл, и я проснулась!','Когда ты уйдёшь, я свернусь клубочком и продолжу сон.'],
];
var extraGrafNPCs=[
 ['graf_crab','Краб Клёпа','Пляжный строитель','wide','#e56e58','#ffd0ad','#f2bd4a','#b74d40','#472e2a','Топ-топ! Я Клёпа, строю песчаные башни и проверяю, чтобы они были ровными.','Мой секрет прост: широкое основание и немного терпения. Попробуй построить свою!'],
 ['graf_seal','Тюленёнок Плюх','Любитель морских брызг','wide','#8aa9b5','#e5f1eb','#6bc3c6','#5f818e','#2e3940','Плюх! Я Плюх, обожаю смотреть на волны и считать белые барашки.','Сколько волн успеешь насчитать, пока идёшь вдоль набережной? Я обычно сбиваюсь на улыбках.'],
 ['graf_gull','Чайчонок Перышко','Воздушный почтальон','beak','#f2eee0','#ffffff','#eabf58','#c9c2ad','#39332b','Карр! Я Перышко, разношу важные новости между чайками. Сегодня море спокойное!','Если увидишь красивую ракушку, оставь её на берегу — пусть порадует следующего гостя.'],
 ['graf_dolphin','Дельфинчик Дельф','Морской рассказчик','tail','#5b9fc9','#d8f2f0','#f5cf55','#397aa5','#293942','Привет с морской стороны! Я Дельф, знаю весёлые истории про каждую волну.','Однажды волна прокатила ракушку дальше, чем я проплыл за целый день!'],
 ['graf_octopus','Осьминожка Кнопа','Музыкантка бухты','antenna','#bf75aa','#f0c4dd','#58c0b1','#8a4d82','#38283a','Я Кнопа, отбиваю ритм щупальцами, когда волны стучат о берег.','Послушай прибой и попробуй прохлопать его ритм. У каждой волны своя мелодия.'],
 ['graf_cat','Енот Матрос','Знаток морских узлов','hat','#668da7','#e9e0ce','#d6a64c','#3e6077','#2d3033','Здравствуй! Я Матрос, знаю тринадцать морских узлов и один очень смешной анекдот.','Хочешь секрет? Хороший узел держится крепко, но развязывается легко.'],
 ['graf_fox','Выдра Искорка','Коллекционерница историй','ears','#df8d50','#f7e3c4','#8ab4d6','#ad6038','#42342b','Я Искорка, собираю истории путешественников. У каждого своя дорога к морю.','Расскажи кому-нибудь сегодня, что красивого увидел. Истории тоже любят путешествовать!'],
 ['graf_frog','Саламандра Бульк','Исследователь приливов','beak','#69b77b','#def2be','#f3b84d','#468b59','#29382b','Бульк! Я слежу за приливом и отливом. Вода то подходит ближе, то делает шаг назад.','Море дышит в своём ритме. Постой у берега и прислушайся.'],
 ['graf_mouse','Летучая мышка Марципан','Хранительница маячных огоньков','ears','#c5a4a0','#f5e5db','#f6ce67','#997574','#413135','Я Марципан, люблю огоньки у воды. Каждый вечер они напоминают звёзды, которые спустились погулять.','Самые красивые огни видны, когда небо только начинает темнеть.'],
 ['graf_turtle','Моржонок Шкипер','Юный мореплаватель','shell','#69a58c','#c5dfc2','#d7a758','#4b7662','#2c382e','Я Шкипер, тренируюсь прокладывать маршруты между воображаемыми островами.','Первое правило капитана: не забывай смотреть по сторонам и приветствовать команду!'],
 ['graf_seahorse','Морской конёк Вихрь','Танцор морских течений','horns','#e58f72','#f7d6c2','#4ab2b0','#bb6652','#49322b','Я Вихрь, танцую вместе с течениями. Они кружат, но всегда знают дорогу домой.','Попробуй покружиться на месте — вот так начинается мой морской танец!'],
 ['graf_robot','Пеликан Порт','Механик причала','antenna','#6b9fac','#d9eff0','#edb950','#477680','#2b3b40','Бип! Я Порт, проверяю воображаемые швартовы и желаю лодкам спокойного плавания.','Морякам полезно махать рукой — пусть знают, что их ждут на берегу!'],
 ['graf_bear','Альпачонок Капкейк','Пекарь морских историй','hat','#ad8066','#f1dec9','#e17c69','#805c48','#3b3029','Я Капкейк, пеку пирожки и придумываю к каждому начинку-приключение.','Сегодня у меня пирожок с историей про маяк. Он сладкий и немножко солёный!'],
 ['graf_butterfly','Попугай Лазурка','Путешественница над бухтой','wings','#6e9ed0','#dbe9fa','#f4d16c','#4d73a7','#303544','Я Лазурка, лечу вдоль берега и смотрю, как меняется цвет воды.','Утром море голубое, в полдень бирюзовое, а на закате становится золотым.'],
 ['graf_hedgehog','Бобр Штурман','Собиратель ракушек','spikes','#ae8a69','#f2e5cf','#e3b751','#806144','#39302a','Я Штурман, нахожу ракушки необычной формы и показываю их друзьям.','Любую ракушку лучше рассматривать на берегу и оставлять там, где её нашёл.'],
 ['graf_firefox','Лисичка Огнецвет','Хранительница тёплых историй','tail','#df483e','#ffe5a4','#ffd04f','#a92d37','#38262a','Я Огнецвет! В моих хвостах будто спрятались лучики заката. Хочешь, расскажу историю о море?','Однажды закат окрасил волны в золото, и мне показалось, что звёзды уже плывут к берегу.'],
 ['graf_lowpolyfox','Лисёнок Грань','Любитель геометрических фигур','ears','#da7846','#fff1dc','#6aabc7','#994b37','#342d32','Я Грань! Люблю находить угловатые камешки и складывать узоры.','Даже округлые вещи можно собрать из маленьких граней.'],
];
function npcPalette(id,scene,index){var h=((scene==='pobedy'?index:18+index)*137.508+31)%360;function hx(x){return Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')}function hs(v,ss,ll){v=((v%360)+360)%360;ss/=100;ll/=100;var c=(1-Math.abs(2*ll-1))*ss,x=c*(1-Math.abs((v/60)%2-1)),m=ll-c/2,r=0,g=0,b=0;if(v<60){r=c;g=x}else if(v<120){r=x;g=c}else if(v<180){g=c;b=x}else if(v<240){g=x;b=c}else if(v<300){r=x;b=c}else{r=c;b=x}return '#'+hx((r+m)*255)+hx((g+m)*255)+hx((b+m)*255)}return [hs(h,54,59),hs(h,43,88),hs(h+155,62,62),hs(h,48,39),'#35292c',hs(h+175,34,34)]}
function registerExtraResidents(list,scene,xs,zbase,range) {
 list.forEach(function(a,i){
  var p=npcPalette(a[0],scene,i),kind=a[3],x=xs[i],z=zbase+(i%3)*range,dx=(i%2?2.4:-2.4);if(a[0]==='park_ballcat_a'){x=44;z=-20}if(a[0]==='park_ballcat_b'){x=50;z=-20}if(a[0]==='park_sleepcat_a'){x=36;z=-28}if(a[0]==='park_sleepcat_b'){x=40;z=-28}var speciesMap={park_ballcat_a:'cat',park_ballcat_b:'cat',park_sleepcat_a:'cat',park_sleepcat_b:'cat',graf_cat:'raccoon',graf_fox:'otter',graf_frog:'salamander',graf_mouse:'bat',graf_turtle:'walrus',graf_robot:'pelican',graf_bear:'alpaca',graf_butterfly:'parrot',graf_hedgehog:'beaver',park_dreamingfox:'dreamfox',park_knitfox:'knitfox',graf_lowpolyfox:'facetedfox'},species=speciesMap[a[0]]||a[0].replace(/^(park_|graf_)/,''),profile={id:a[0],species:species,n:i,kind:kind,body:p[0],head:p[0],trim:p[1],accent:p[2],shade:p[3],eye:p[4],pants:p[5],shoe:'#403a43',speed:1+(i%4)*.12,playBall:a[0]==='park_ballcat_a'||a[0]==='park_ballcat_b',ballOwner:a[0]==='park_ballcat_a',sleepy:a[0]==='park_sleepcat_a'||a[0]==='park_sleepcat_b'};if(a[0]==='park_cubfox'){profile.species='fox';profile.body='#ed8838';profile.head='#ed8838';profile.trim='#fff3e7';profile.shade='#bd592c';profile.accent='#f3bd57';profile.eye='#3c2d2a'}if(a[0]==='graf_firefox'){profile.species='firefox';profile.body='#d9473e';profile.head='#e6533c';profile.trim='#ffd978';profile.shade='#a72f37';profile.accent='#ffb44f';profile.eye='#39272a'}if(a[0]==='park_dreamingfox'){profile.body='#c88e70';profile.head='#ce9879';profile.trim='#f5e7d6';profile.shade='#79594f';profile.accent='#b4a4d8'}if(a[0]==='park_knitfox'){profile.body='#df803a';profile.head='#e88a41';profile.trim='#fff0d9';profile.shade='#a55231';profile.accent='#45a69b'}if(a[0]==='graf_lowpolyfox'){profile.body='#da7846';profile.head='#df814a';profile.trim='#fff1dc';profile.shade='#994b37';profile.accent='#6aabc7'}var wayfinder=a[0]==='park_owl'||a[0]==='graf_cat';
  var nodes={hello:{emote:'wave',text:a[5],choices:wayfinder?[{label:'Подскажешь дорогу к морю?',next:'directions'},{label:'Расскажи ещё!',next:'story'},{label:'До встречи!',alt:true}]:[{label:i%2?'Расскажи ещё!':'Что посоветуешь?',next:'story'},{label:'До встречи!',alt:true}]},story:{emote:i%2?'happy':'nod',text:a[6]}};
  if(wayfinder){nodes.directions={emote:'think',text:'Море совсем близко. В какую сторону тебе показать путь?',choices:[{label:'⬅️ Налево, вдоль берега',do:'npc_way:left',next:'thanks'},{label:'➡️ Направо, по набережной',do:'npc_way:right',next:'thanks'}]};nodes.thanks={emote:'happy',text:'Спасибо, что помог(ла) мне выбрать дорогу! Я пойду туда, куда показывает стрелка. Хорошей прогулки у моря!',do:'npc_depart'}}
  api.register({id:a[0],name:a[1],title:a[2],scene:scene,species:profile.species,sleepy:profile.sleepy,ballPair:profile.playBall?'park_ballcats':null,ballMate:a[0]==='park_ballcat_a'?'park_ballcat_b':(a[0]==='park_ballcat_b'?'park_ballcat_a':null),ballOwner:profile.ballOwner,build:makeTownNPC(profile),height:2.25+(i%3)*.12,radius:.5,spawn:{x:x,z:z,heading:(i*.71)%6.28},route:profile.playBall||profile.sleepy?[{x:x,z:z,wait:[9999,9999]}]:[{x:x,z:z,wait:[3+i%3,6+i%4]},{x:x+dx,z:z+(i%2?1.8:-1.8),wait:[2,5],act:i%2?'wave':'think'}],loop:true,dialog:{nodes:nodes}})
 });
}api.action('npc_way',function(args,npc){var side=args[0]==='left'?-1:1,park=npc.def.scene==='pobedy';npc.ex.departTarget=park?{x:npc.x+side*18,z:npc.z+16}:{x:npc.x+side*18,z:24};npc.ex.way=side});
api.action('npc_depart',function(args,npc){setTimeout(function(){if(!npc.mgr||npc.mgr.list.indexOf(npc)<0)return;if(npc.mgr.dlg&&npc.mgr.dlg.npc===npc)npc.mgr.closeDialog();npc.ex.departing=true;npc.speed=0;npc.faceH=null;},3200)});registerExtraResidents(extraParkNPCs,'pobedy',[-52,-45,-38,-31,-24,-17,-10,-3,4,11,18,25,32,39,46,53,60,67,44,50,36,40],-38,5);
registerExtraResidents(extraGrafNPCs,'grafskaya',[-76,-66,-56,-46,-36,-26,-16,-6,4,14,24,34,44,54,64,74,84],15,4);})();

