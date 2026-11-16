/* =====================================================================
   Севастополис — радар+ (v182)
   • На радаре всегда виден путь к Парку Победы: жёлтая линия со
     стрелками по настоящим улицам (поиск пути A* по дорожной сети).
     Если парк за краем радара — стрелка «🌳» по краю круга.
   • Радар можно перетаскивать пальцем в удобное место и масштабировать
     щипком двумя пальцами. Двойное касание — вернуть как было.
     Положение и масштаб запоминаются (localStorage «sevradar»).
   Рисование встроено в цикл радара ядра через window.__sevRadarDraw.
   ===================================================================== */
(function () {
  'use strict';
  var PARK = { x: 6, z: -40, name: 'Парк Победы' };
  var G = null, path = null, lastFrom = null, lastT = 0, busy = false;

  /* ---- граф улиц ---- */
  function buildGraph(RD) {
    var id = new Map(), X = [], Z = [], adj = [], H = new Map();
    function v(p) {
      var k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2), i = id.get(k);
      if (i === undefined) { i = X.length; id.set(k, i); X.push(p[0]); Z.push(p[1]); adj.push([]);
        var hk = Math.floor(p[0] / 40) + ',' + Math.floor(p[1] / 40), A = H.get(hk); if (!A) H.set(hk, A = []); A.push(i); }
      return i;
    }
    RD.forEach(function (r) {
      var p = r.p; if (!p || p.length < 2) return;
      var w = r.c === 2 ? .85 : 1; // проспекты чуть «выгоднее»
      for (var i = 0; i < p.length - 1; i++) {
        var a = v(p[i]), b = v(p[i + 1]); if (a === b) continue;
        var L = Math.hypot(X[a] - X[b], Z[a] - Z[b]) * w; adj[a].push(b, L); adj[b].push(a, L);
      }
    });
    var comp = new Int32Array(X.length).fill(-1), nc = 0;
    for (var st = 0; st < X.length; st++) {
      if (comp[st] >= 0) continue; var q = [st]; comp[st] = nc;
      while (q.length) { var c = q.pop(), A = adj[c]; for (var k = 0; k < A.length; k += 2) if (comp[A[k]] < 0) { comp[A[k]] = nc; q.push(A[k]); } }
      nc++;
    }
    var tgt = new Map(); // ближайшая к парку точка в каждой связной части сети
    for (var i2 = 0; i2 < X.length; i2++) { var d2 = Math.hypot(X[i2] - PARK.x, Z[i2] - PARK.z), t0 = tgt.get(comp[i2]); if (!t0 || d2 < t0[1]) tgt.set(comp[i2], [i2, d2]); }
    return { X: X, Z: Z, adj: adj, H: H, comp: comp, tgt: tgt };
  }
  function nearest(x, z) {
    var cx = Math.floor(x / 40), cz = Math.floor(z / 40), best = -1, bd = 1e18;
    for (var r = 0; r < 6 && best < 0; r++) for (var i = -r; i <= r; i++) for (var j = -r; j <= r; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      var A = G.H.get((cx + i) + ',' + (cz + j)); if (!A) continue;
      for (var k = 0; k < A.length; k++) { var q = A[k], d = (G.X[q] - x) * (G.X[q] - x) + (G.Z[q] - z) * (G.Z[q] - z); if (d < bd) { bd = d; best = q; } }
    }
    return best;
  }
  function astar(s, t) {
    var n = G.X.length, gS = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    var heap = [], tx = G.X[t], tz = G.Z[t];
    function h(i) { return .85 * Math.hypot(G.X[i] - tx, G.Z[i] - tz); }
    function push(f, i) { heap.push([f, i]); var c = heap.length - 1; while (c > 0) { var p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; var t0 = heap[p]; heap[p] = heap[c]; heap[c] = t0; c = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var c = 0; for (;;) { var l = 2 * c + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; var t1 = heap[m]; heap[m] = heap[c]; heap[c] = t1; c = m; } } return top; }
    gS[s] = 0; push(h(s), s); var it = 0;
    while (heap.length && it++ < 200000) {
      var cur = pop()[1]; if (closed[cur]) continue; closed[cur] = 1; if (cur === t) break;
      var A = G.adj[cur];
      for (var k = 0; k < A.length; k += 2) { var nb = A[k], ng = gS[cur] + A[k + 1]; if (ng < gS[nb]) { gS[nb] = ng; prev[nb] = cur; push(ng + h(nb), nb); } }
    }
    if (prev[t] < 0 && s !== t) return null;
    var out = [], c2 = t; while (c2 >= 0) { out.push([G.X[c2], G.Z[c2]]); if (c2 === s) break; c2 = prev[c2]; }
    return out.reverse();
  }
  function update(x, z) {
    var now = performance.now();
    if (!G) { var RD = window.__sevRD; if (!RD || !RD.length) return; G = buildGraph(RD); }
    if (busy || now - lastT < 1500) return;
    if (lastFrom && Math.hypot(lastFrom[0] - x, lastFrom[1] - z) < 12 && path) return;
    lastT = now; busy = true;
    try { var s = nearest(x, z), tg = s >= 0 ? G.tgt.get(G.comp[s]) : null; path = tg ? astar(s, tg[0]) : null; if (path && tg[1] > 25) path.push([PARK.x, PARK.z]); lastFrom = [x, z]; } catch (e) { path = null; }
    busy = false;
  }

  /* ---- рисование на радаре (вызывается ядром) ---- */
  window.__sevRadarDraw = function (g, x, z, R, C) {
    update(x, z);
    var dPark = Math.hypot(PARK.x - x, PARK.z - z);
    if (dPark < 70) return; // уже в парке
    var sx = function (px) { return C + (px - x) / R * C; }, sy = function (pz) { return C - (pz - z) / R * C; };
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, 7); g.clip();
    if (path && path.length > 1) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx(x), sy(z));
      for (var i = 0; i < path.length; i++) g.lineTo(sx(path[i][0]), sy(path[i][1]));
      g.strokeStyle = 'rgba(10,40,90,.55)'; g.lineWidth = 11; g.stroke();
      g.strokeStyle = '#ffd21f'; g.lineWidth = 6; g.stroke();
      // стрелки-шевроны вдоль пути
      var acc = 14, step = 30;
      for (var j = 0; j < path.length - 1; j++) {
        var ax = sx(path[j][0]), ay = sy(path[j][1]), bx = sx(path[j + 1][0]), by = sy(path[j + 1][1]), L = Math.hypot(bx - ax, by - ay);
        if (L < .01) continue;
        while (acc < L) {
          var t = acc / L, px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
          if (Math.hypot(px - C, py - C) < C - 8) {
            var an = Math.atan2(by - ay, bx - ax);
            g.save(); g.translate(px, py); g.rotate(an); g.beginPath(); g.moveTo(-4, -5); g.lineTo(3, 0); g.lineTo(-4, 5);
            g.strokeStyle = '#7a3e00'; g.lineWidth = 2.6; g.stroke(); g.restore();
          }
          acc += step;
        }
        acc -= L;
      }
    }
    g.restore();
    // значок парка: на карте или по краю круга
    var px2 = sx(PARK.x), py2 = sy(PARK.z), dx = px2 - C, dy = py2 - C, d = Math.hypot(dx, dy);
    if (d > C - 22) { px2 = C + dx / d * (C - 22); py2 = C + dy / d * (C - 22); }
    g.save(); g.fillStyle = '#18a36b'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(px2, py2, 15, 0, 7); g.fill(); g.stroke();
    g.font = '18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🌳', px2, py2 + 1);
    if (d > C - 22) { var an2 = Math.atan2(dy, dx); g.translate(C + dx / d * (C - 6), C + dy / d * (C - 6)); g.rotate(an2); g.beginPath(); g.moveTo(-6, -7); g.lineTo(5, 0); g.lineTo(-6, 7); g.closePath(); g.fillStyle = '#ffd21f'; g.fill(); g.strokeStyle = '#7a3e00'; g.lineWidth = 2; g.stroke(); }
    g.restore();
  };

  /* ---- перетаскивание и щипок ---- */
  var saved = {}; try { saved = JSON.parse(localStorage.getItem('sevradar') || '{}') || {}; } catch (e) { }
  window.__sevRadarZoom = saved.z || 1;
  function place(box) {
    var N = document.getElementById('sevRadarN'), SN = document.getElementById('sevRadarSt'), r = box.getBoundingClientRect();
    if (N) { N.style.left = (r.left + r.width / 2) + 'px'; N.style.top = (r.top - 7) + 'px'; }
    if (SN) { SN.style.left = (r.left - 2) + 'px'; SN.style.top = (r.bottom + 8) + 'px'; }
  }
  function setPos(box, x, y) {
    var w = box.offsetWidth, h = box.offsetHeight;
    x = Math.max(-w * .3, Math.min(innerWidth - w * .7, x)); y = Math.max(0, Math.min(innerHeight - h * .7, y));
    box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.right = 'auto'; place(box); return [x, y];
  }
  function save(box) { try { localStorage.setItem('sevradar', JSON.stringify({ x: parseFloat(box.style.left) || null, y: parseFloat(box.style.top) || null, z: window.__sevRadarZoom })); } catch (e) { } }
  function wire(box) {
    if (box.__sr) return; box.__sr = 1; box.classList.add('sr-live');
    if (saved.x != null && saved.y != null) setPos(box, saved.x, saved.y);
    var P = new Map(), start = null, lastTap = 0, lastTapOk = false, moved = 0, downT = 0;
    box.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation(); try { box.setPointerCapture(e.pointerId); } catch (_) { }
      P.set(e.pointerId, [e.clientX, e.clientY]); box.classList.add('sr-drag');
      var r = box.getBoundingClientRect();
      if (P.size === 1) {
        var now = performance.now(); if (now - lastTap < 320 && lastTapOk) { window.__sevRadarZoom = 1; box.style.left = ''; box.style.top = ''; place(box); try { localStorage.removeItem('sevradar'); } catch (_) { } }
        lastTap = now; downT = now; moved = 0; start = { mode: 'drag', x: e.clientX, y: e.clientY, bx: r.left, by: r.top };
      } else if (P.size === 2) {
        moved = 99; lastTapOk = false; var pts = Array.from(P.values()); start = { mode: 'pinch', d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1, z: window.__sevRadarZoom };
      }
    }, { passive: false });
    box.addEventListener('pointermove', function (e) {
      if (!P.has(e.pointerId) || !start) return; e.preventDefault(); e.stopPropagation();
      P.set(e.pointerId, [e.clientX, e.clientY]);
      if (start.mode === 'drag' && P.size === 1) { moved = Math.max(moved, Math.hypot(e.clientX - start.x, e.clientY - start.y)); } if (start.mode === 'drag' && P.size === 1) setPos(box, start.bx + e.clientX - start.x, start.by + e.clientY - start.y);
      else if (start.mode === 'pinch' && P.size >= 2) {
        var pts = Array.from(P.values()), d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1;
        window.__sevRadarZoom = Math.max(.35, Math.min(3, start.z * start.d / d)); // пальцы шире — крупнее карта
      }
    }, { passive: false });
    function up(e) {
      if (!P.has(e.pointerId)) return; P.delete(e.pointerId); e.stopPropagation();
      if (!P.size) { lastTapOk = moved < 8 && performance.now() - downT < 250; box.classList.remove('sr-drag'); start = null; save(box); }
      else if (P.size === 1) { var q = Array.from(P.values())[0], r = box.getBoundingClientRect(); start = { mode: 'drag', x: q[0], y: q[1], bx: r.left, by: r.top }; }
    }
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', function (e) { e.preventDefault(); window.__sevRadarZoom = Math.max(.35, Math.min(3, window.__sevRadarZoom * (e.deltaY > 0 ? 1.12 : .89))); save(box); }, { passive: false });
    addEventListener('resize', function () { if (box.style.left) setPos(box, parseFloat(box.style.left), parseFloat(box.style.top)); });
  }
  setInterval(function () { var b = document.getElementById('sevRadar'); if (b) wire(b); }, 800);
  window.__sevRadarPlus = { park: PARK, get path() { return path; }, get graph() { return G; } };
})();
