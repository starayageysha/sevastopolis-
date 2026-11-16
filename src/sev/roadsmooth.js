/* =====================================================================
   Севастополис — общий построитель дорог (Road Builder), v182
   Чистые функции без Babylon: сглаживание осевых линий улиц и
   поиск перекрёстков. Ядро вызывает window.SevRoad.smoothNet(RD)
   ДО построения асфальта, фонарей, деревьев, машин и названий —
   поэтому всё, что стоит вдоль дорог, сдвигается вместе с ними.

   Шаги:
   1. Узлы сети: концы улиц и точки, где одна улица упирается в другую.
      Узлы не двигаются — так улицы остаются соединёнными.
   2. Между узлами убирается «дрожание» точек (Дуглас — Пекер, 1.5–2 м).
   3. Каждый излом заменяется дугой окружности (скругление угла,
      радиус до 24 м для проспектов, до 14 м для улиц), дуга лежит
      внутри угла, поэтому улица остаётся на своём месте по карте.
   4. Плотная выборка точек по дуге — полотно строится непрерывной
      лентой одинаковой ширины (см. ribbon()).
   ===================================================================== */
(function (root) {
  'use strict';
  var Q = 2; // точность совпадения точек: 0.5 м
  function key(p) { return Math.round(p[0] * Q) + ',' + Math.round(p[1] * Q); }

  function dp(pts, eps, keep) { // Дуглас — Пекер, keep[i] — точку не трогать
    var n = pts.length; if (n < 3) return pts.slice();
    var mark = new Uint8Array(n); mark[0] = mark[n - 1] = 1;
    for (var i = 0; i < n; i++) if (keep[i]) mark[i] = 1;
    var st = [];
    var a = 0; for (var b = 1; b < n; b++) if (mark[b]) { st.push([a, b]); a = b; }
    while (st.length) {
      var s = st.pop(), i0 = s[0], i1 = s[1]; if (i1 - i0 < 2) continue;
      var A = pts[i0], B = pts[i1], dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz, bi = -1, bd = eps * eps;
      for (var k = i0 + 1; k < i1; k++) {
        var P = pts[k], t = L2 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        var ex = A[0] + dx * t - P[0], ez = A[1] + dz * t - P[1], d = ex * ex + ez * ez;
        if (d > bd) { bd = d; bi = k; }
      }
      if (bi > 0) { mark[bi] = 1; st.push([i0, bi], [bi, i1]); }
    }
    var out = [], kp = [];
    for (var j = 0; j < n; j++) if (mark[j]) { out.push(pts[j]); kp.push(keep[j] ? 1 : 0); }
    out.keep = kp; return out;
  }

  // скругление углов дугами; узлы сети (keep) не скругляются
  function fillet(pts, keep, Rmax, step) {
    var n = pts.length; if (n < 3) return pts.slice();
    var out = [pts[0]];
    var tin = new Float64Array(n), tout = new Float64Array(n), R = new Float64Array(n), th = new Float64Array(n);
    var seg = []; for (var i = 0; i < n - 1; i++) seg.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
    for (i = 1; i < n - 1; i++) {
      if (keep[i]) continue;
      var ax = pts[i][0] - pts[i - 1][0], az = pts[i][1] - pts[i - 1][1], bx = pts[i + 1][0] - pts[i][0], bz = pts[i + 1][1] - pts[i][1];
      var la = seg[i - 1] || 1, lb = seg[i] || 1, cr = (ax * bz - az * bx) / (la * lb), dt = (ax * bx + az * bz) / (la * lb);
      var ang = Math.atan2(cr, dt); if (Math.abs(ang) < .02) continue;
      var tn = Math.tan(Math.abs(ang) / 2);
      // длину касательной делим с соседними углами поровну
      var tl = Math.min(Rmax * tn, (keep[i - 1] || i === 1 ? .85 : .5) * la, (keep[i + 1] || i === n - 2 ? .85 : .5) * lb);
      th[i] = ang; tin[i] = tl; R[i] = tl / tn;
    }
    for (i = 1; i < n - 1; i++) {
      if (!tin[i]) { out.push(pts[i]); continue; }
      var P = pts[i], A0 = pts[i - 1], B0 = pts[i + 1];
      var la2 = seg[i - 1], lb2 = seg[i];
      var ux = (P[0] - A0[0]) / la2, uz = (P[1] - A0[1]) / la2, vx = (B0[0] - P[0]) / lb2, vz = (B0[1] - P[1]) / lb2;
      var s0x = P[0] - ux * tin[i], s0z = P[1] - uz * tin[i];
      var sgn = th[i] > 0 ? 1 : -1, nx = -uz * sgn, nz = ux * sgn; // к центру дуги
      var cx = s0x + nx * R[i], cz = s0z + nz * R[i];
      var a0 = Math.atan2(s0z - cz, s0x - cx), sweep = th[i];
      var k = Math.max(2, Math.ceil(Math.abs(sweep) * R[i] / step), Math.ceil(Math.abs(sweep) / .2));
      for (var j = 0; j <= k; j++) { var a = a0 + sweep * j / k; out.push([cx + Math.cos(a) * R[i], cz + Math.sin(a) * R[i]]); }
    }
    out.push(pts[n - 1]);
    return out;
  }

  function dens(pts, step) { // длинные прямые — промежуточные точки (для коллизий и разметки)
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.floor(L / step);
      for (var j = 1; j <= k; j++) { var t = j / (k + 1); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      if (L > .05) out.push(b);
    }
    return out;
  }

  /* склейка: две улицы, просто продолжающие друг друга (узел из двух концов),
     становятся одной линией — тогда и излом на стыке скругляется */
  function chain(RD) {
    var refs = new Map(), inner = new Map();
    RD.forEach(function (r, i) {
      var p = r.p; if (!p || p.length < 2) return;
      [[0, 0], [p.length - 1, 1]].forEach(function (e) { var k = key(p[e[0]]); var a = refs.get(k); if (!a) refs.set(k, a = []); a.push([i, e[1]]); });
      for (var j = 1; j < p.length - 1; j++) inner.set(key(p[j]), 1);
    });
    var used = new Uint8Array(RD.length), out = [];
    function nextAt(k, from) {
      var a = refs.get(k); if (!a || a.length !== 2 || inner.has(k)) return null;
      var o = a[0][0] === from ? a[1] : a[0]; if (o[0] === from || used[o[0]]) return null;
      var r0 = RD[from], r1 = RD[o[0]]; if (r0.c !== r1.c) return null;
      if (r0.n && r1.n && r0.n !== r1.n) return null; return o;
    }
    RD.forEach(function (r, i) {
      if (used[i]) return; used[i] = 1;
      var p = r.p; if (!p || p.length < 2) { out.push(r); return; }
      var pts = p.slice(), name = r.n, cur = i, guard = 0, nx;
      while ((nx = nextAt(key(pts[pts.length - 1]), cur)) && guard++ < 500) {
        var q = RD[nx[0]].p.slice(); if (nx[1] === 1) q.reverse(); used[nx[0]] = 1; pts = pts.concat(q.slice(1)); name = name || RD[nx[0]].n; cur = nx[0];
        if (key(pts[pts.length - 1]) === key(pts[0])) break;
      }
      cur = i; guard = 0;
      while ((nx = nextAt(key(pts[0]), cur)) && guard++ < 500) {
        var q2 = RD[nx[0]].p.slice(); if (nx[1] === 0) q2.reverse(); used[nx[0]] = 1; pts = q2.slice(0, -1).concat(pts); name = name || RD[nx[0]].n; cur = nx[0];
        if (key(pts[pts.length - 1]) === key(pts[0])) break;
      }
      var o = { p: pts, c: r.c }; if (name) o.n = name; out.push(o);
    });
    return out;
  }

  /* сеть улиц: [{p:[[x,z],...], c:1|2, n?}] → тот же формат, сглаженный; + nodes */
  function smoothNet(RD0) {
    var RD = chain(RD0), ends = new Map();
    RD.forEach(function (r) {
      var p = r.p; if (!p || p.length < 2) return;
      [0, p.length - 1].forEach(function (i) { var k = key(p[i]), e = ends.get(k); if (!e) ends.set(k, e = { x: p[i][0], z: p[i][1], n: 0, hw: 0 }); e.n++; e.hw = Math.max(e.hw, r.c === 2 ? 7 : 4); });
    });
    RD.forEach(function (r) { // улица проходит сквозь узел — это две «ветки»
      var p = r.p; if (!p || p.length < 3) return;
      for (var i = 1; i < p.length - 1; i++) { var e = ends.get(key(p[i])); if (e) { e.n += 2; e.hw = Math.max(e.hw, r.c === 2 ? 7 : 4); } }
    });
    var out = RD.map(function (r) {
      var p = r.p; if (!p || p.length < 2) return r;
      var big = r.c === 2, keep = p.map(function (q, i) { return i === 0 || i === p.length - 1 || ends.has(key(q)) ? 1 : 0; });
      var s = dp(p, big ? 2.0 : 1.5, keep);
      var f = fillet(s, s.keep, big ? 24 : 14, 2.5);
      var o = { p: dens(f, 6), c: r.c }; if (r.n) o.n = r.n;
      return o;
    });
    var nodes = []; ends.forEach(function (e) { if (e.n >= 3) nodes.push(e); });
    out.nodes = nodes; out.merged = RD0.length - RD.length;
    return out;
  }

  /* непрерывная лента: общие вершины на стыках, ширина постоянна (митра) */
  function ribbon(pts, o0, o1) {
    var n = pts.length, L = [], Rr = [], acc = [0];
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(n - 1, i + 1)];
      var n1x = 0, n1z = 0, n2x = 0, n2z = 0, l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (l1 > 1e-6) { n1x = -(b[1] - a[1]) / l1; n1z = (b[0] - a[0]) / l1; }
      if (l2 > 1e-6) { n2x = -(c[1] - b[1]) / l2; n2z = (c[0] - b[0]) / l2; }
      if (l1 <= 1e-6) { n1x = n2x; n1z = n2z; } if (l2 <= 1e-6) { n2x = n1x; n2z = n1z; }
      var mx = n1x + n2x, mz = n1z + n2z, ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      var d = mx * n1x + mz * n1z; d = d < .55 ? .55 : d; mx /= d; mz /= d;
      L.push([b[0] + mx * o0, b[1] + mz * o0]); Rr.push([b[0] + mx * o1, b[1] + mz * o1]);
      if (i) acc.push(acc[i - 1] + l1);
    }
    return { L: L, R: Rr, acc: acc };
  }

  root.SevRoad = { smoothNet: smoothNet, ribbon: ribbon, dp: dp, fillet: fillet, dens: dens, key: key };
})(typeof window !== 'undefined' ? window : globalThis);
