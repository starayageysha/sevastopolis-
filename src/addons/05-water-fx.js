
/* ===== Вода на картах: круги по воде и живые водопады ===== */
(function () {
  'use strict';

  /* ---------- круги по воде ---------- */
  var cache = new WeakMap();

  function getMask(img) {
    var m = cache.get(img);
    if (m) return m;
    if (!img.naturalWidth) return null;
    var W = Math.min(img.naturalWidth, 640);
    var H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
    try {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, W, H);
      m = { w: W, h: H, d: x.getImageData(0, 0, W, H).data };
    } catch (e) { m = { bad: true }; }
    cache.set(img, m);
    return m;
  }

  /* вода = прозрачное место (под картой голубое море) или сине-голубой/бирюзовый цвет */
  function isWaterPx(d, i) {
    var a = d[i + 3];
    if (a < 140) return true;
    var r = d[i], g = d[i + 1], b = d[i + 2];
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
    if (!df) return false;
    var s = df / mx, v = mx / 255, h;
    if (mx === b) h = 60 * (4 + (r - g) / df);
    else if (mx === g) h = 60 * (2 + (b - r) / df);
    else return false;
    return h >= 170 && h <= 245 && s > 0.38 && v > 0.4;
  }

  function isWaterAt(img, box, ev) {
    var r = box.getBoundingClientRect();
    var u = (ev.clientX - r.left) / r.width, v = (ev.clientY - r.top) / r.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return true;       /* за краем карты — море */
    var m = getMask(img);
    if (!m || m.bad) return false;
    var px = Math.min(m.w - 1, Math.max(0, Math.round(u * (m.w - 1))));
    var py = Math.min(m.h - 1, Math.max(0, Math.round(v * (m.h - 1))));
    var hit = 0, tot = 0;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
      var x = px + dx, y = py + dy;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) { hit++; tot++; continue; }
      tot++;
      if (isWaterPx(m.d, (y * m.w + x) * 4)) hit++;
    }
    return hit / tot >= 0.45;
  }

  var live = 0;
  window.__sevRipple = function (stage, box, ev) {
    try {
      var img = box.querySelector('.map__img');
      if (!img || live > 10 || !isWaterAt(img, box, ev)) return;
      var sr = stage.getBoundingClientRect();
      var el = document.createElement('div');
      el.className = 'rip';
      el.style.left = (ev.clientX - sr.left) + 'px';
      el.style.top = (ev.clientY - sr.top) + 'px';
      el.innerHTML = '<i></i><i></i><i></i><b></b>';
      stage.appendChild(el);
      live++;
      setTimeout(function () { el.remove(); live--; }, 2000);
    } catch (e) {}
  };

  /* ---------- живые водопады (карта Крыма) ---------- */
  var IMGW = 1531, IMGH = 1027, S = 6;
  /* координаты в пикселях картинки: полоса воды x0..x1, сверху top, внизу bot, брызги sx,sy */
  var FALLS = {
    crimea: [
      { x0: 885, x1: 891, top: 697, bot: 735, sx: 888, sy: 738, r: 14 },
      { x0: 583, x1: 591, top: 878, bot: 921, sx: 590, sy: 924, r: 12 },
      { x0: 522, x1: 528, top: 946, bot: 966, sx: 528, sy: 969, r: 8 }
    ]
  };

  function makeFall(box, ref, f) {
    var left = f.x0 - 16, right = f.x1 + 16, top = f.top - 6, bottom = f.sy + 16;
    var cv = document.createElement('canvas');
    cv.className = 'wf';
    cv.width = Math.round((right - left) * S);
    cv.height = Math.round((bottom - top) * S);
    cv.style.left = (left / IMGW * 100) + '%';
    cv.style.top = (top / IMGH * 100) + '%';
    cv.style.width = ((right - left) / IMGW * 100) + '%';
    cv.style.height = ((bottom - top) / IMGH * 100) + '%';
    box.insertBefore(cv, ref);                      /* под значками */
    var fw = f.x1 - f.x0, nSt = Math.round(fw * 1.7), st = [], i;
    for (i = 0; i < nSt; i++) st.push({ x: Math.random(), y: Math.random(), v: 28 + Math.random() * 30, len: 4 + Math.random() * 7, a: 0.55 + Math.random() * 0.4 });
    return { f: f, cv: cv, c: cv.getContext('2d'), left: left, top: top, st: st, dr: [], acc: 0 };
  }

  function drawFall(w, t, dt) {
    var f = w.f, c = w.c, fw = f.x1 - f.x0, H = f.bot - f.top, i, k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w.cv.width, w.cv.height);
    c.setTransform(S, 0, 0, S, -w.left * S, -w.top * S);
    c.lineCap = 'round';

    /* 1. бегущие вниз водяные полосы */
    var n = Math.max(3, Math.round(fw / 1.8));
    for (k = 0; k < n; k++) {
      var x = f.x0 + (k + 0.5) / n * fw, sw = Math.sin(t * 1.7 + k * 1.3) * 0.18;
      c.setLineDash([2.6 + (k % 3) * 0.7, 2.2 + (k % 2) * 0.8]);
      c.lineDashOffset = -(t * (20 + (k % 4) * 4));
      c.lineWidth = fw / n * 0.8;
      c.strokeStyle = 'rgba(255,255,255,' + (0.3 + 0.16 * Math.sin(t * 2.3 + k)).toFixed(3) + ')';
      c.beginPath(); c.moveTo(x + sw, f.top + 1); c.lineTo(x - sw, f.bot); c.stroke();
    }
    c.setLineDash([]);

    /* 2. быстрые светлые струйки */
    for (i = 0; i < w.st.length; i++) {
      var p = w.st[i];
      p.y += p.v * dt / H;
      if (p.y > 1) { p.y -= 1; p.x = Math.random(); }
      var y = f.top + p.y * H, px = f.x0 + 0.5 + p.x * (fw - 1);
      var a = p.a * Math.min(1, p.y * 7) * Math.min(1, (1 - p.y) * 5 + 0.25);
      c.strokeStyle = 'rgba(232,249,255,' + a.toFixed(3) + ')';
      c.lineWidth = 0.55;
      c.beginPath(); c.moveTo(px, y); c.lineTo(px, Math.min(f.bot + 1, y + p.len)); c.stroke();
    }

    /* 3. рябь на воде внизу */
    for (k = 0; k < 2; k++) {
      var ph = (t * 0.55 + k * 0.5) % 1, rx = f.r * (0.3 + ph * 1.05), ry = rx * 0.36;
      c.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - ph)).toFixed(3) + ')';
      c.lineWidth = 0.4;
      c.beginPath(); c.ellipse(f.sx, f.sy + 1.5, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    }

    /* 4. облачка брызг */
    for (k = 0; k < 7; k++) {
      var q = (t * 0.75 + k / 7) % 1;
      var rad = f.r * (0.22 + 0.55 * q), al = 0.55 * (1 - q) * (1 - q * 0.3);
      var cx = f.sx + Math.sin(k * 2.7 + 1) * f.r * 0.45 * (0.4 + q), cy = f.sy - q * f.r * 0.55;
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,255,255,' + al.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
    }

    /* 5. капли, летящие дугой */
    w.acc += dt * (6 + fw);
    while (w.acc >= 1 && w.dr.length < 28) {
      w.acc -= 1;
      w.dr.push({ x: f.sx + (Math.random() - 0.5) * fw, y: f.sy - 1, vx: (Math.random() - 0.5) * 26, vy: -(10 + Math.random() * 16), l: 1 });
    }
    w.acc = Math.min(w.acc, 1);
    for (i = w.dr.length - 1; i >= 0; i--) {
      var d = w.dr[i];
      d.vy += 70 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.l -= dt * 1.4;
      if (d.l <= 0 || d.y > f.sy + 3) { w.dr.splice(i, 1); continue; }
      c.fillStyle = 'rgba(255,255,255,' + Math.min(1, d.l * 1.3).toFixed(3) + ')';
      c.beginPath(); c.arc(d.x, d.y, 0.38, 0, Math.PI * 2); c.fill();
    }
  }

  window.__sevWater = function (box, mapId, signal) {
    var list = FALLS[mapId];
    if (!list) return;
    try {
      var ref = box.querySelector('.map__img');
      var falls = list.map(function (f) { return makeFall(box, ref ? ref.nextSibling : box.firstChild, f); });
      var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) { falls.forEach(function (w) { drawFall(w, 0, 0.016); }); return; }
      var last = 0;
      (function loop(ts) {
        if (signal && signal.aborted) return;
        requestAnimationFrame(loop);
        var t = ts / 1000, dt = Math.min(0.05, last ? t - last : 0.016);
        last = t;
        for (var i = 0; i < falls.length; i++) drawFall(falls[i], t, dt);
      })(performance.now());
    } catch (e) { console.warn('water fx', e); }
  };
})();
