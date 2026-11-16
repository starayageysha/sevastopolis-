
/* ===== Живое море: волны, корабли, «Варшавянки», швартовка, перетаскивание пальцем ===== */
(function () {
  'use strict';

  var CSS = '' +
    '.sl{position:absolute;inset:0;pointer-events:none;z-index:1}' +
    '.sl *{pointer-events:none}' +
    /* корабли */
    '.sl-b{transition:opacity 1.3s ease;position:absolute;left:0;top:0;width:var(--w,6.5%);aspect-ratio:var(--ar,4/3);will-change:transform;touch-action:none}' +
    '.sl .sl-b.sl-hit{pointer-events:auto;cursor:grab}' +
    '.sl-b.sl-hit::before{content:"";position:absolute;inset:-40%;pointer-events:auto}' +
    '.sl-b.drag{cursor:grabbing}' +
    '.sl-b__in{position:absolute;inset:0;display:block;animation:sl-bob var(--bd,3.2s) ease-in-out infinite;animation-delay:var(--dl,0s)}' +
    '.sl-b__in svg{width:100%;height:100%;display:block;overflow:visible}' +
    '.sl-b__w{position:absolute;right:88%;top:60%;width:150%;height:34%;border-radius:50%;' +
      'background:linear-gradient(to left,rgba(255,255,255,.7),rgba(255,255,255,.22) 45%,rgba(255,255,255,0));animation:sl-wake 1.6s ease-in-out infinite alternate}' +
    '.sl-b.is-m .sl-b__w{display:none}' +
    '.sl-b.drag .sl-b__in{filter:drop-shadow(0 6px 4px rgba(0,30,60,.5))}' +
    '@keyframes sl-bob{0%,100%{transform:translateY(-3%) rotate(-2.5deg)}50%{transform:translateY(4%) rotate(2.5deg)}}' +
    '@keyframes sl-wake{from{transform:scaleX(.82);opacity:.65}to{transform:scaleX(1.08);opacity:.95}}' +
    /* подводные лодки */
    '.sl-s__in{display:block;position:absolute;inset:0;opacity:.14;transform:translateY(22%) scale(.97);transition:opacity 2.4s ease,transform 2.4s ease}' +
    '.sl-s.up .sl-s__in{opacity:1;transform:none}' +
    '.sl-s .sl-b__w{opacity:0;animation:none;transition:opacity 2s;top:55%;height:50%}' +
    '.sl-s.up .sl-b__w{opacity:.85}' +
    /* блики */
    '.sl-sp{position:absolute;width:var(--s,1.1%);aspect-ratio:1;background:#fff;opacity:0;' +
      'clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);' +
      'animation:sl-tw var(--d,2.4s) ease-in-out infinite;animation-delay:var(--dl,0s)}' +
    '@keyframes sl-tw{0%,100%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0)}50%{opacity:.95;transform:translate(-50%,-50%) scale(1) rotate(35deg)}}' +
    /* волны на море и прибой */
    '.sl-wv{position:absolute;width:var(--s,3.2%);aspect-ratio:3/1;opacity:0;animation:sl-wv var(--d,7s) ease-in-out infinite;animation-delay:var(--dl,0s)}' +
    '.sl-wv svg{width:100%;height:100%;display:block;overflow:visible}' +
    '@keyframes sl-wv{0%{opacity:0;transform:translate(-50%,-50%) translateX(-14%) scale(.8)}45%{opacity:.7}100%{opacity:0;transform:translate(-50%,-50%) translateX(14%) scale(1.15)}}' +
    '.sl-fm{position:absolute;width:var(--s,3.4%);aspect-ratio:3/1;border-radius:50%;opacity:0;' +
      'background:radial-gradient(ellipse,rgba(255,255,255,.9) 0,rgba(255,255,255,.45) 45%,rgba(255,255,255,0) 72%);' +
      'animation:sl-fm var(--d,3.6s) ease-in-out infinite;animation-delay:var(--dl,0s)}' +
    '@keyframes sl-fm{0%,100%{opacity:0;transform:translate(-50%,-50%) scale(.6,.7)}50%{opacity:.85;transform:translate(-50%,-50%) scale(1.25,1)}}' +
    /* круги-волны (плеск, всплытие) */
    '.sl-ring{position:absolute;width:var(--s,5%);aspect-ratio:1;border:1.6px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 5px rgba(170,235,255,.7);' +
      'transform:translate(-50%,-50%) scale(.15,.09);opacity:0;animation:sl-rg 2.8s ease-out forwards;animation-delay:var(--dl,0s)}' +
    '@keyframes sl-rg{0%{opacity:.95;transform:translate(-50%,-50%) scale(.15,.09)}100%{opacity:0;transform:translate(-50%,-50%) scale(1,.6)}}' +
    /* волны от нажатия пальцем */
    '.sl-rp{position:absolute;width:0;height:0;pointer-events:none;z-index:4}' +
    '.sl-rp i{position:absolute;left:0;top:0;width:190px;height:190px;border-radius:50%;opacity:0;' +
      'border:2.5px solid rgba(255,255,255,.9);box-shadow:0 0 10px rgba(160,230,255,.85),inset 0 0 12px rgba(160,230,255,.55);' +
      'transform:translate(-50%,-50%) scale(.08,.05);animation:sl-rpw 2s ease-out forwards}' +
    '.sl-rp i:nth-child(2){animation-delay:.2s;border-width:2px}' +
    '.sl-rp i:nth-child(3){animation-delay:.4s;border-width:1.5px}' +
    '.sl-rp b{position:absolute;left:0;top:0;width:16px;height:16px;border-radius:50%;opacity:0;background:radial-gradient(circle,#fff,rgba(190,240,255,0) 70%);' +
      'transform:translate(-50%,-50%) scale(.3);animation:sl-rpc .9s ease-out forwards}' +
    '@keyframes sl-rpw{0%{opacity:.95;transform:translate(-50%,-50%) scale(.08,.05)}100%{opacity:0;transform:translate(-50%,-50%) scale(1,.6)}}' +
    '@keyframes sl-rpc{0%{opacity:1;transform:translate(-50%,-50%) scale(.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}' +
    /* свечение фонтанов и кристаллов */
    '.sl-gl{position:absolute;width:var(--s,2.8%);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);mix-blend-mode:screen;' +
      'background:radial-gradient(circle,rgba(190,250,255,.95) 0,rgba(110,225,255,.55) 35%,rgba(110,225,255,0) 70%);animation:sl-gl var(--d,2.8s) ease-in-out infinite alternate;animation-delay:var(--dl,0s)}' +
    '@keyframes sl-gl{from{opacity:.25;transform:translate(-50%,-50%) scale(.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1.25)}}' +
    /* чайки */
    '.sl-g{position:absolute;width:4%;aspect-ratio:2/1;will-change:left,top}' +
    '.sl-g svg{width:100%;height:100%;display:block;overflow:visible;animation:sl-flap .55s ease-in-out infinite alternate;transform-origin:50% 60%}' +
    '@keyframes sl-flap{from{transform:scaleY(1)}to{transform:scaleY(.35)}}' +
    '@media (prefers-reduced-motion:reduce){.sl-sp,.sl-gl,.sl-ring,.sl-wv,.sl-fm,.sl-b__in,.sl-b__w,.sl-g svg{animation:none!important}.sl-sp{opacity:.6}.sl-fm{opacity:.5}}';

  var st = document.createElement('style');
  st.id = 'sea-life-css';
  st.textContent = CSS;
  document.head.appendChild(st);

  /* ---------- спрайты (смотрят вправо) ---------- */
  var O = 'stroke="#2b1a0c" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"';
  var FLAG = function (x, y, w) {                              /* российский триколор */
    var h = w * 0.22;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fff"/>' +
           '<rect x="' + x + '" y="' + (y + h) + '" width="' + w + '" height="' + h + '" fill="#1c57a5"/>' +
           '<rect x="' + x + '" y="' + (y + 2 * h) + '" width="' + w + '" height="' + h + '" fill="#d52b1e"/>';
  };
  var SPR = [
    /* 0 парусник */
    '<svg viewBox="0 0 40 30"><path d="M20 3 L20 19 L7 19 Z" fill="#fff6e0" ' + O + '/><path d="M22 7 L22 19 L33 19 Z" style="fill:var(--c,#e8553f)" ' + O + '/>' +
    '<path d="M3 20 L37 20 L31 27.5 L9 27.5 Z" style="fill:var(--h,#8a5a2e)" ' + O + '/><path d="M20 2 L20 20" ' + O + '/></svg>',
    /* 1 лодочка */
    '<svg viewBox="0 0 40 30"><path d="M5 19 Q20 25 35 19 L31 26 L9 26 Z" style="fill:var(--c,#d98b3a)" ' + O + '/>' +
    '<path d="M16.5 15 L23.5 15 L22.5 20.5 L17.5 20.5 Z" style="fill:var(--h,#3a78c2)" ' + O + '/>' +
    '<path d="M12 12 L27 24" ' + O + '/></svg>',
    /* 2 катер */
    '<svg viewBox="0 0 40 30"><path d="M2 19 L30 19 L38 15.5 L33 26 L7 26 Z" fill="#fffaf0" ' + O + '/>' +
    '<path d="M3 22 L35 22 L33 26 L7 26 Z" style="fill:var(--c,#d8403a)" ' + O + '/>' +
    '<path d="M13 19 L15 11 L25 11 L28 19 Z" fill="#fffaf0" ' + O + '/><path d="M14 8 L26 8" ' + O + '/></svg>',
    /* 3 рыбацкий кораблик */
    '<svg viewBox="0 0 40 30"><path d="M2 18 L38 18 L32 27 L7 27 Z" style="fill:var(--c,#2f5f9e)" ' + O + '/>' +
    '<rect x="11" y="10" width="15" height="8" rx="1.2" fill="#fffaf0" ' + O + '/><rect x="26.5" y="6" width="4" height="12" fill="#3a3f4a" ' + O + '/>' +
    '</svg>',
    /* 4 контейнеровоз */
    '<svg viewBox="0 0 60 24"><path d="M2 14 L58 14 L53 21.5 L6 21.5 Z" style="fill:var(--h,#8a2a2a)" ' + O + '/>' +
    '<rect x="5" y="8" width="9" height="6" style="fill:var(--c1,#e8553f)" ' + O + '/><rect x="14" y="8" width="9" height="6" style="fill:var(--c2,#3f8fd8)" ' + O + '/>' +
    '<rect x="23" y="8" width="9" height="6" style="fill:var(--c3,#f2b134)" ' + O + '/><rect x="9" y="2.5" width="9" height="5.5" style="fill:var(--c3,#f2b134)" ' + O + '/>' +
    '<rect x="18" y="2.5" width="9" height="5.5" style="fill:var(--c1,#e8553f)" ' + O + '/><rect x="32" y="8" width="8" height="6" style="fill:var(--c2,#3f8fd8)" ' + O + '/>' +
    '<rect x="42" y="4" width="12" height="10" fill="#fffaf0" ' + O + '/><rect x="48" y="0.5" width="3.4" height="4" fill="#3a3f4a" ' + O + '/></svg>',
    /* 5 танкер */
    '<svg viewBox="0 0 60 24"><path d="M1 15 L59 15 L54 21.5 L5 21.5 Z" style="fill:var(--h,#2a3140)" ' + O + '/>' +
    '<path d="M2 15 L58 15" stroke="#d8403a" stroke-width="2"/>' +
    '<path d="M6 12.5 L40 12.5" stroke="#9aa6b2" stroke-width="1.6"/>' +
    '<rect x="44" y="5" width="11" height="10" fill="#fffaf0" ' + O + '/><rect x="50" y="2" width="3.4" height="3" fill="#3a3f4a" ' + O + '/></svg>',
    /* 6 военный корабль (российский флаг) */
    '<svg viewBox="0 0 60 24"><path d="M1 15 L48 15 L59 11 L54 21.5 L6 21.5 Z" fill="#8f9cab" ' + O + '/>' +
    '<path d="M4 18 L55 18" stroke="#5f6c7a" stroke-width="1.3"/>' +
    '<path d="M17 15 L21 7.5 L39 7.5 L43 15 Z" fill="#aab6c2" ' + O + '/>' +
    '<path d="M30 7.5 L30 1.5" ' + O + '/>' +
    '<rect x="8" y="11.5" width="6" height="3.5" fill="#7a8794" ' + O + '/><path d="M13 13 L19 11.8" stroke="#2b1a0c" stroke-width="1.6" stroke-linecap="round"/>' +
    '<rect x="44" y="11.3" width="5" height="3.7" fill="#7a8794" ' + O + '/>' + FLAG(30.6, 0.2, 6) + '</svg>',
    /* 7 подводная лодка «Варшавянка» (проект 636), российская */
    '<svg viewBox="0 0 80 18"><path d="M2 11.5 Q2 6.5 10 6.5 L66 6.5 Q78 6.5 78 11.5 Q78 16.5 66 16.5 L10 16.5 Q2 16.5 2 11.5 Z" fill="#171d28" stroke="#05080d" stroke-width="1"/>' +
    '<path d="M6 8.4 Q40 6.6 74 8.4" fill="none" stroke="#3a4658" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M29 6.6 L32 1.6 L45 1.6 L48 6.6 Z" fill="#212a38" stroke="#05080d" stroke-width="1" stroke-linejoin="round"/>' +
    '<path d="M36 1.6 L36 -2.5" stroke="#05080d" stroke-width="1.1"/><path d="M44 1.6 L44 -3" stroke="#05080d" stroke-width="0.9"/>' + FLAG(44.4, -3, 6.5) +
    '<path d="M64 16.5 L68 17.6 L72 16.5" fill="none" stroke="#05080d" stroke-width="0.9"/></svg>'
  ];
  /* параметры типов: [ширина %, ar, скорость, вес] */
  var TYPES = {
    0: { w: [6, 7.4], ar: '4/3', sp: [0.007, 0.011] },
    1: { w: [5.4, 6.6], ar: '4/3', sp: [0.005, 0.008] },
    2: { w: [6, 7.4], ar: '4/3', sp: [0.012, 0.018] },
    3: { w: [7.5, 9], ar: '4/3', sp: [0.006, 0.009] },
    4: { w: [12, 14], ar: '5/2', sp: [0.004, 0.007] },
    5: { w: [12, 14], ar: '5/2', sp: [0.0035, 0.006] },
    6: { w: [11, 13], ar: '5/2', sp: [0.008, 0.013] },
    7: { w: [11, 12.5], ar: '40/9', sp: [0.005, 0.008] }
  };
  var COLS = ['#e8553f', '#f2b134', '#3f8fd8', '#4fb36a', '#d8403a', '#9a5fc8', '#f08a3c'];
  var HULL = ['#8a5a2e', '#fffaf0', '#2f5f9e', '#6d3f1d'];
  var CARGOH = ['#8a2a2a', '#244a7a', '#2d5a3d', '#3a3a44'];
  var GULL = '<svg viewBox="0 0 20 10"><path d="M1 6 Q5.5 0 10 6 Q14.5 0 19 6" fill="none" stroke="#2a4a66" stroke-opacity=".5" stroke-width="3.2" stroke-linecap="round"/>' +
             '<path d="M1 6 Q5.5 0 10 6 Q14.5 0 19 6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
  var WAVE = '<svg viewBox="0 0 24 8"><path d="M1 5.5 Q4 0.5 7 4 T13 4 T19 4 T23 2.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>';

  var GLOWS = {
    crimea: [[1468, 446], [429, 592], [803, 645], [1022, 529], [743, 832], [1435, 488], [529, 819], [560, 190], [413, 448], [1350, 581]]
  };
  var IMGW = { crimea: 1531 }, IMGH = { crimea: 1027 };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  /* вода = прозрачное место (под картой море) или сине-голубой цвет */
  function waterPx(d, i) {
    var a = d[i + 3];
    if (a < 140) return 2;                                   /* 2 — открытое море */
    var r = d[i], g = d[i + 1], b = d[i + 2];
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
    if (!df || mx !== b && mx !== g) return 0;
    var s = df / mx, v = mx / 255, h = mx === b ? 60 * (4 + (r - g) / df) : 60 * (2 + (b - r) / df);
    return (h >= 170 && h <= 245 && s > 0.38 && v > 0.4) ? 1 : 0;   /* 1 — нарисованная вода */
  }

  function buildMask(img) {
    var W = Math.min(img.naturalWidth, 1536);
    var H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data;
    var kind = new Uint8Array(W * H);
    for (var i = 0, p = 0; i < d.length; i += 4, p++) kind[p] = waterPx(d, i);
    return { w: W, h: H, k: kind };
  }

  /* сетки: sea — открытое море, deep — море, вокруг которого ~2% ширины нет суши, shore — полоса прибоя */
  function buildGrids(m) {
    var GW = 200, GH = Math.max(1, Math.round(GW * m.h / m.w)), x, y, i;
    var land = new Uint8Array(GW * GH);
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      var sx = Math.min(m.w - 1, Math.floor((x + 0.5) / GW * m.w)), sy = Math.min(m.h - 1, Math.floor((y + 0.5) / GH * m.h));
      land[y * GW + x] = m.k[sy * m.w + sx] === 2 ? 0 : 1;
    }
    var S = new Int32Array((GW + 1) * (GH + 1));
    for (y = 1; y <= GH; y++) for (x = 1; x <= GW; x++)
      S[y * (GW + 1) + x] = land[(y - 1) * GW + (x - 1)] + S[(y - 1) * (GW + 1) + x] + S[y * (GW + 1) + x - 1] - S[(y - 1) * (GW + 1) + x - 1];
    function cnt(x, y, R) {
      var x0 = Math.max(0, x - R), x1 = Math.min(GW, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(GH, y + R + 1);
      return S[y1 * (GW + 1) + x1] - S[y0 * (GW + 1) + x1] - S[y1 * (GW + 1) + x0] + S[y0 * (GW + 1) + x0];
    }
    var deep = new Uint8Array(GW * GH), sea = new Uint8Array(GW * GH), shore = [], berth = [];
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      i = y * GW + x;
      if (land[i]) continue;
      sea[i] = 1;
      if (cnt(x, y, 4) === 0) deep[i] = 1;
      if (cnt(x, y, 1) === 0 && cnt(x, y, 2) > 0) berth.push([(x + 0.5) / GW, (y + 0.5) / GW]);   /* y в единицах ширины */
      else if (cnt(x, y, 2) > 0 && cnt(x, y, 0) === 0) shore.push([(x + 0.5) / GW, (y + 0.5) / GW]);
    }
    return { w: GW, h: GH, sea: sea, deep: deep, shore: shore, berth: berth };
  }

  function seaLife(box, mapId, signal) {
    var img = box.querySelector('.map__img');
    if (!img || box.querySelector('.sl')) return;
    var stage = box.parentElement;

    function start() {
      var m = null, G = null;
      try { m = buildMask(img); G = buildGrids(m); } catch (e) { console.warn('sea mask', e); return; }
      var R = m.w / m.h, Hh = 1 / R;
      var X0 = -0.35, X1 = 1.35, Y0 = -0.35, Y1 = Hh + 0.35;         /* где плавают корабли */
      var WX0 = -0.5, WX1 = 1.5, WY0 = -0.9, WY1 = Hh + 0.9;         /* где мерцают блики и волны */
      var big = mapId === 'crimea';

      function cell(grid, x, y) {
        var gx = Math.min(G.w - 1, Math.floor(x * G.w)), gy = Math.min(G.h - 1, Math.floor(y / Hh * G.h));
        return grid[gy * G.w + gx] === 1;
      }
      function inB(x, y, wide) { return wide ? (x >= WX0 && x <= WX1 && y >= WY0 && y <= WY1) : (x >= X0 && x <= X1 && y >= Y0 && y <= Y1); }
      function deepAt(x, y, wide) {
        if (!inB(x, y, wide)) return false;
        if (x < 0 || x > 1 || y < 0 || y > Hh) return true;
        return cell(G.deep, x, y);
      }
      function seaAt(x, y, wide) {
        if (!inB(x, y, wide)) return false;
        if (x < 0 || x > 1 || y < 0 || y > Hh) return true;
        return cell(G.sea, x, y);
      }
      function randSea(wide) {
        for (var t = 0; t < 600; t++) {
          var x = wide ? rnd(WX0, WX1) : rnd(X0, X1), y = wide ? rnd(WY0, WY1) : rnd(Y0, Y1);
          if (deepAt(x, y, wide)) return { x: x, y: y };
        }
        return null;
      }

      var layer = document.createElement('div');
      layer.className = 'sl';
      box.insertBefore(layer, img.nextSibling);
      function place(el, x, y) { el.style.left = (x * 100) + '%'; el.style.top = (y / Hh * 100) + '%'; }
      function ringAt(x, y, size, delay) {
        var r = document.createElement('i'); r.className = 'sl-ring';
        r.style.setProperty('--s', size + '%'); if (delay) r.style.setProperty('--dl', delay + 's');
        place(r, x, y); layer.appendChild(r);
        setTimeout(function () { r.remove(); }, 3200 + (delay || 0) * 1000);
      }

      var i, p, e;

      /* ---- блики на открытом море ---- */
      for (i = 0; i < (big ? 60 : 42); i++) {
        p = randSea(true); if (!p) break;
        e = document.createElement('i'); e.className = 'sl-sp';
        e.style.setProperty('--s', rnd(1.4, 2.6).toFixed(2) + '%');
        e.style.setProperty('--d', rnd(1.8, 4).toFixed(2) + 's');
        e.style.setProperty('--dl', (-rnd(0, 4)).toFixed(2) + 's');
        place(e, p.x, p.y); layer.appendChild(e);
      }

      /* ---- волны на море: гребешки появляются, плывут и тают на новом месте ---- */
      for (i = 0; i < (big ? 60 : 38); i++) {
        p = randSea(true); if (!p) break;
        e = document.createElement('span'); e.className = 'sl-wv'; e.innerHTML = WAVE;
        e.style.setProperty('--s', rnd(2.6, 4.6).toFixed(2) + '%');
        e.style.setProperty('--d', rnd(5, 9).toFixed(2) + 's');
        e.style.setProperty('--dl', (-rnd(0, 9)).toFixed(2) + 's');
        place(e, p.x, p.y); layer.appendChild(e);
      }
      layer.addEventListener('animationiteration', function (ev) {
        var t = ev.target;
        if (t.classList && t.classList.contains('sl-wv')) { var q = randSea(true); if (q) place(t, q.x, q.y); }
      });

      /* ---- прибой у берега ---- */
      var shore = G.shore.slice(), nF = Math.min(shore.length, big ? 110 : 70);
      for (i = 0; i < nF; i++) {
        var sc = shore.splice(Math.floor(Math.random() * shore.length), 1)[0];
        e = document.createElement('i'); e.className = 'sl-fm';
        e.style.setProperty('--s', rnd(2.4, 4.2).toFixed(2) + '%');
        e.style.setProperty('--d', rnd(2.8, 5).toFixed(2) + 's');
        e.style.setProperty('--dl', (-rnd(0, 5)).toFixed(2) + 's');
        place(e, sc[0] + rnd(-0.004, 0.004), sc[1] + rnd(-0.004, 0.004)); layer.appendChild(e);
      }

      /* ---- блики на нарисованной воде (озёра, реки, бухта) ---- */
      var cand = [], k = m.k, W = m.w, H = m.h, x, y, need = big ? 3 : 8;
      for (y = 3; y < H - 3; y += 1) for (x = 3; x < W - 3; x += 1) {
        var q = y * W + x;
        if (k[q] !== 1) continue;
        var cnt = 0;
        if (big) { cnt = (k[q - 1] === 1) + (k[q + 1] === 1) + (k[q - W] === 1) + (k[q + W] === 1); if (cnt < need) continue; }
        else {
          for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) if (k[q + dy * W + dx] === 1) cnt++;
          if (cnt < 22) continue;
        }
        cand.push(q);
      }
      for (i = 0; i < (big ? 70 : 34) && cand.length; i++) {
        var qi = cand[Math.floor(Math.random() * cand.length)];
        e = document.createElement('i'); e.className = 'sl-sp';
        e.style.setProperty('--s', rnd(1.1, 2).toFixed(2) + '%');
        e.style.setProperty('--d', rnd(1.5, 3.2).toFixed(2) + 's');
        e.style.setProperty('--dl', (-rnd(0, 3)).toFixed(2) + 's');
        place(e, (qi % W + 0.5) / W, ((qi / W | 0) + 0.5) / W);
        layer.appendChild(e);
      }

      /* ---- свечение фонтанов и кристаллов (Крым) ---- */
      var gl = GLOWS[mapId];
      if (gl) gl.forEach(function (c) {
        var g = document.createElement('i'); g.className = 'sl-gl';
        g.style.setProperty('--d', rnd(2, 3.6).toFixed(2) + 's');
        g.style.setProperty('--dl', (-rnd(0, 3)).toFixed(2) + 's');
        g.style.left = (c[0] / IMGW[mapId] * 100) + '%';
        g.style.top = (c[1] / IMGH[mapId] * 100) + '%';
        layer.appendChild(g);
      });

      /* ================= КОРАБЛИ ================= */
      var BW = box.offsetWidth || 390;
      function measure() { BW = box.offsetWidth || BW; }
      if (window.ResizeObserver) { try { new ResizeObserver(measure).observe(box); } catch (er) {} }
      window.addEventListener('resize', measure, { signal: signal });

      var subLayer = document.createElement('div');            /* лодки под водой — ниже надводных */
      subLayer.style.cssText = 'position:absolute;inset:0';
      layer.appendChild(subLayer);

      var boats = [], berths = G.berth.map(function (b) { return { x: b[0], y: b[1], occ: null }; });

      /* ---------- навигационная сетка (весь район плавания) и поиск пути ---------- */
      var CS = 1 / 200, NW = Math.ceil((X1 - X0) / CS), NH = Math.ceil((Y1 - Y0) / CS);
      var navDeep = new Uint8Array(NW * NH), navSea = new Uint8Array(NW * NH), cx0, cy0;
      for (cy0 = 0; cy0 < NH; cy0++) for (cx0 = 0; cx0 < NW; cx0++) {
        var px0 = X0 + (cx0 + 0.5) * CS, py0 = Y0 + (cy0 + 0.5) * CS;
        navDeep[cy0 * NW + cx0] = deepAt(px0, py0) ? 1 : 0;
        navSea[cy0 * NW + cx0] = seaAt(px0, py0) ? 1 : 0;
      }
      var gS = new Float32Array(NW * NH), gStamp = new Int32Array(NW * NH), closed = new Int32Array(NW * NH), prevN = new Int32Array(NW * NH), stampN = 0;
      function cellX(x) { return clamp(Math.floor((x - X0) / CS), 0, NW - 1); }
      function cellY(y) { return clamp(Math.floor((y - Y0) / CS), 0, NH - 1); }
      function deepCell(x, y) { return navDeep[cellY(y) * NW + cellX(x)] === 1; }

      function findPath(sx, sy, tx, ty, shallow) {
        var pass = shallow ? navSea : navDeep;
        var s = cellY(sy) * NW + cellX(sx), t = cellY(ty) * NW + cellX(tx), txc = t % NW, tyc = (t - txc) / NW;
        stampN++;
        var hN = [], hF = [];
        function push(n, f) { var i = hN.length; hN.push(n); hF.push(f);
          while (i > 0) { var p = (i - 1) >> 1; if (hF[p] <= hF[i]) break;
            var tn = hN[p], tf = hF[p]; hN[p] = hN[i]; hF[p] = hF[i]; hN[i] = tn; hF[i] = tf; i = p; } }
        function pop() { var top = hN[0], ln = hN.pop(), lf = hF.pop();
          if (hN.length) { hN[0] = ln; hF[0] = lf; var i = 0, n = hN.length;
            for (;;) { var l = 2 * i + 1, r = l + 1, m = i;
              if (l < n && hF[l] < hF[m]) m = l; if (r < n && hF[r] < hF[m]) m = r; if (m === i) break;
              var tn = hN[m], tf = hF[m]; hN[m] = hN[i]; hF[m] = hF[i]; hN[i] = tn; hF[i] = tf; i = m; } }
          return top; }
        function heur(n) { var x = n % NW, y = (n - x) / NW, dx = Math.abs(x - txc), dy = Math.abs(y - tyc); return dx + dy - 0.586 * Math.min(dx, dy); }
        gS[s] = 0; gStamp[s] = stampN; prevN[s] = -1; push(s, heur(s));
        var it = 0, found = false;
        while (hN.length && it++ < 120000) {
          var cur = pop();
          if (cur === t) { found = true; break; }
          if (closed[cur] === stampN) continue;
          closed[cur] = stampN;
          var cx = cur % NW, cy = (cur - cx) / NW;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            var nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
            var ni = ny * NW + nx;
            if (!pass[ni] && ni !== t) continue;
            if (dx && dy && (!pass[cy * NW + nx] || !pass[ny * NW + cx])) continue;   /* не режем углы суши */
            var ng = gS[cur] + (dx && dy ? 1.414 : 1) * (navDeep[ni] ? 1 : 5);
            if (gStamp[ni] !== stampN || ng < gS[ni]) { gS[ni] = ng; gStamp[ni] = stampN; prevN[ni] = cur; push(ni, ng + heur(ni)); }
          }
        }
        if (!found) return null;
        var pts = [], n = t;
        while (n !== -1) { var x = n % NW, y = (n - x) / NW; pts.push({ x: X0 + (x + 0.5) * CS, y: Y0 + (y + 0.5) * CS }); n = prevN[n]; }
        pts.reverse();
        pts[0] = { x: sx, y: sy };
        /* спрямляем путь по прямой, пока она идёт по глубокой воде */
        function los(a, c) {
          var d = Math.hypot(c.x - a.x, c.y - a.y), k2 = Math.max(2, Math.ceil(d / 0.006));
          for (var q = 1; q < k2; q++) { var f = q / k2; if (!deepCell(a.x + (c.x - a.x) * f, a.y + (c.y - a.y) * f)) return false; }
          return true;
        }
        var out = [pts[0]], i = 0;
        while (i < pts.length - 1) {
          var j = pts.length - 1;
          while (j > i + 1 && !los(pts[i], pts[j])) j--;
          out.push(pts[j]); i = j;
        }
        return out;
      }

      /* ---------- куда плывём: причал, выход за край моря или далёкая точка (для подлодок) ---------- */
      function edgePoint(avoid) {
        for (var t = 0; t < 20; t++) {
          var r = Math.random(), side = r < 0.35 ? 0 : (r < 0.7 ? 1 : (r < 0.85 ? 2 : 3)), x, y;
          if (side === avoid) continue;
          if (side < 2) { x = side ? X1 - 0.02 : X0 + 0.02; y = rnd(Y0 + 0.05, Y1 - 0.05); }
          else { y = side === 2 ? Y0 + 0.02 : Y1 - 0.02; x = rnd(X0 + 0.05, X1 - 0.05); }
          if (deepAt(x, y)) return { x: x, y: y, side: side };
        }
        return null;
      }
      function pickDest(b) {
        if (b.sub) {
          for (var t = 0; t < 30; t++) { var p = randSea(); if (p && Math.hypot(p.x - b.x, p.y - b.y) > 0.45) return { kind: 'sea', x: p.x, y: p.y }; }
          return null;
        }
        if (Math.random() < 0.62) {
          var cand = [];
          for (var j = 0; j < berths.length; j++) {
            var br = berths[j]; if (br.occ) continue;
            var d = Math.hypot(br.x - b.x, br.y - b.y);
            if (d < 0.22 || d > 1.4) continue;
            var busy = false;
            for (var o = 0; o < berths.length; o++) if (berths[o].occ && Math.hypot(berths[o].x - br.x, berths[o].y - br.y) < 0.07) { busy = true; break; }
            if (!busy) cand.push(br);
          }
          if (cand.length) { var br2 = pick(cand); return { kind: 'berth', x: br2.x, y: br2.y, ref: br2 }; }
        }
        var e = edgePoint(-1);
        return e ? { kind: 'exit', x: e.x, y: e.y, side: e.side } : null;
      }
      function dropBerth(b) { if (b.berth) { b.berth.occ = null; b.berth = null; } b.el.classList.remove('is-m'); }

      function assign(b, spawnMode) {
        dropBerth(b);
        for (var tries = 0; tries < 12; tries++) {
          var d = pickDest(b); if (!d) continue;
          var shallow = b.sub ? !deepCell(b.x, b.y) : (d.kind === 'berth' || !deepCell(b.x, b.y));
          var path = findPath(b.x, b.y, d.x, d.y, shallow);
          if (!path || path.length < 2) continue;
          var tg = path[1], dir = Math.atan2(tg.y - b.y, tg.x - b.x);
          if (!spawnMode && tries < 10 && Math.abs(angDiff(dir, b.th)) > 1.25) continue;      /* без разворотов на месте */
          if (spawnMode) b.th = dir;
          b.path = path; b.pi = 1; b.dest = d; b.mode = 'route';
          if (d.kind === 'berth') { d.ref.occ = b; b.berth = d.ref; }
          return true;
        }
        b.mode = 'wait'; b.t = 3;
        return false;
      }

      function spawn(b) {
        var pt = null, tries = 0;
        while (tries++ < 60) {
          pt = randSea(); if (!pt) break;
          var ok = true;
          for (var j = 0; j < boats.length; j++) if (boats[j] !== b && !boats[j].sub === !b.sub && Math.hypot(boats[j].x - pt.x, boats[j].y - pt.y) < 0.08) { ok = false; break; }
          if (ok) break;
        }
        if (!pt) return false;
        b.x = pt.x; b.y = pt.y; b.th = rnd(0, Math.PI * 2);
        return true;
      }
      function respawnAtEdge(b) {
        var e = edgePoint(b.dest && b.dest.side !== undefined ? b.dest.side : -1);
        if (!e) { spawn(b); }
        else {
          b.x = e.x; b.y = e.y;
          var toC = Math.atan2((Hh / 2) - e.y, 0.5 - e.x);
          b.th = toC + rnd(-0.5, 0.5); b.v = 0;
        }
        b.el.style.opacity = 1;
        assign(b, true);
      }

      function makeBoat(type, idx) {
        var T = TYPES[type], el = document.createElement('div'), sub = type === 7;
        el.className = 'sl-b' + (sub ? ' sl-s' : ' sl-hit');
        el.style.setProperty('--w', rnd(T.w[0], T.w[1]).toFixed(2) + '%');
        el.style.setProperty('--ar', T.ar);
        el.style.setProperty('--c', pick(COLS)); el.style.setProperty('--h', type >= 4 && type <= 5 ? pick(CARGOH) : pick(HULL));
        el.style.setProperty('--c1', pick(COLS)); el.style.setProperty('--c2', pick(COLS)); el.style.setProperty('--c3', pick(COLS));
        el.style.setProperty('--bd', rnd(2.6, 4.2).toFixed(2) + 's');
        el.style.setProperty('--dl', (-rnd(0, 3)).toFixed(2) + 's');
        el.innerHTML = '<span class="sl-b__w"></span><span class="sl-b__in">' + (sub ? '<span class="sl-s__in">' + SPR[7] + '</span>' : SPR[type]) + '</span>';
        var b = { el: el, type: type, sub: sub, sp: rnd(T.sp[0], T.sp[1]), x: 0, y: 0, th: 0,
                  mode: 'wait', t: 0.2 + (idx || 0) * 0.12, berth: null, dest: null, path: null, pi: 0, up: false, scale: 1,
                  v: 0, sx: 1, dirT: 1, tl: 0, dtr: 0.016, can: false, canT: 0 };
        if (sub) b.subT = rnd(4, 26);
        if (!spawn(b)) return null;
        b.sx = b.dirT = Math.cos(b.th) >= 0 ? 1 : -1;
        (sub ? subLayer : layer).appendChild(el);
        boats.push(b);
        bindDrag(b);
        return b;
      }

      /* состав флота: на Крыме вдвое меньше надводных кораблей */
      var plan = big ? [0, 0, 0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]
                     : [0, 0, 0, 1, 1, 2, 2, 2, 3, 4, 4, 5, 6, 6, 6, 7, 7, 7];
      plan.forEach(function (t, i) { makeBoat(t, i); });

      /* перетаскивание пальцем */
      function bindDrag(b) {
        var el = b.el, off = null;
        function toBox(ev) { var r = box.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.width }; }
        el.addEventListener('pointerdown', function (ev) {
          if (b.sub && !b.can) return;
          ev.stopPropagation(); ev.preventDefault();
          try { el.setPointerCapture(ev.pointerId); } catch (er) {}
          dropBerth(b);
          el.style.opacity = 1;
          var pt = toBox(ev); off = { dx: b.x - pt.x, dy: b.y - pt.y, id: ev.pointerId };
          b.mode = 'drag'; b.scale = 1.22; el.classList.add('drag'); el.style.zIndex = 5;
        }, { signal: signal });
        el.addEventListener('pointermove', function (ev) {
          if (b.mode !== 'drag' || !off || ev.pointerId !== off.id) return;
          ev.stopPropagation();
          var pt = toBox(ev), nx = clamp(pt.x + off.dx, WX0, WX1), ny = clamp(pt.y + off.dy, WY0, WY1);
          if (!seaAt(nx, ny, true)) {                         /* на сушу не затащить: скользим вдоль берега */
            if (seaAt(nx, b.y, true)) ny = b.y; else if (seaAt(b.x, ny, true)) nx = b.x; else return;
          }
          var mx = nx - b.x, my = ny - b.y;
          if (Math.hypot(mx, my) > 0.002) b.th = Math.atan2(my, mx);
          b.x = nx; b.y = ny;
        }, { signal: signal });
        function drop() {
          if (b.mode !== 'drag') return;
          off = null; b.scale = 1; el.classList.remove('drag'); el.style.zIndex = '';
          b.v = 0; b.mode = 'wait'; b.t = 0.4;
          if (b.sub) b.subT = Math.max(b.subT, 6);
          if (!inB(b.x, b.y)) { b.x = clamp(b.x, X0, X1); b.y = clamp(b.y, Y0, Y1); }
        }
        el.addEventListener('pointerup', drop, { signal: signal });
        el.addEventListener('pointercancel', drop, { signal: signal });
      }

      function subState(b, dt) {
        if (b.mode === 'drag') return;
        b.subT -= dt;
        if (!b.up && b.subT <= 0) {                             /* всплытие */
          b.up = true; b.subT = rnd(8, 14); b.el.classList.add('up');
          ringAt(b.x, b.y, 7, 0); ringAt(b.x, b.y, 5, 0.35); ringAt(b.x, b.y, 3.6, 0.7);
          b.canT = 1.8;
        } else if (b.up && b.subT <= 0) {                       /* погружение */
          b.up = false; b.subT = rnd(16, 48); b.can = false; b.el.classList.remove('up', 'sl-hit');
          ringAt(b.x, b.y, 6, 0); ringAt(b.x, b.y, 4, 0.4);
        }
        if (b.up && b.canT > 0) { b.canT -= dt; if (b.canT <= 0) { b.can = true; b.el.classList.add('sl-hit'); } }
      }

      function render(b) {
        var c = Math.cos(b.th);
        if (c > 0.12) b.dirT = 1; else if (c < -0.12) b.dirT = -1;     /* возле вертикали курс «зеркала» не меняется */
        b.sx += (b.dirT - b.sx) * Math.min(1, b.dtr * 2.2);            /* разворот спрайта — плавно, не щелчком */
        var tilt = clamp(Math.atan2(Math.sin(b.th), Math.abs(c)), -0.4, 0.4) * (b.dirT > 0 ? 1 : -1);
        b.tl += (tilt - b.tl) * Math.min(1, b.dtr * 3);
        b.el.style.transform = 'translate(' + (b.x * BW).toFixed(1) + 'px,' + (b.y * BW).toFixed(1) + 'px) translate(-50%,-50%) rotate(' +
          b.tl.toFixed(3) + 'rad) scale(' + (b.sx * b.scale).toFixed(3) + ',' + b.scale.toFixed(3) + ')';
      }

      function arrive(b) {
        var d = b.dest || {};
        if (d.kind === 'berth') { b.mode = 'moored'; b.v = 0; b.t = rnd(10, 24); b.el.classList.add('is-m'); }
        else if (d.kind === 'exit') { b.mode = 'fade'; b.t = 1.5; b.el.style.opacity = 0; }
        else { assign(b, false); }                                      /* подлодка: сразу новый далёкий курс */
      }

      function step(b, dt) {
        b.dtr = dt;
        if (b.sub) subState(b, dt);
        if (b.mode === 'drag') { render(b); return; }
        if (b.mode === 'moored') { b.v = 0; b.t -= dt; if (b.t <= 0) { b.el.classList.remove('is-m'); assign(b, false); } render(b); return; }
        if (b.mode === 'wait') { b.v = 0; b.t -= dt; if (b.t <= 0) assign(b, true); render(b); return; }
        if (b.mode === 'fade') { b.v = 0; b.t -= dt; if (b.t <= 0) respawnAtEdge(b); render(b); return; }
        /* маршрут: едем по пути, поворачиваем только плавно и заранее */
        var p = b.path, last = p.length - 1;
        while (b.pi < last && Math.hypot(p[b.pi].x - b.x, p[b.pi].y - b.y) < 0.022) b.pi++;
        var wp = p[b.pi], dx = wp.x - b.x, dy = wp.y - b.y, d = Math.hypot(dx, dy);
        if (b.pi === last && d < (b.dest && b.dest.kind === 'berth' ? 0.016 : 0.03)) { arrive(b); render(b); return; }
        var diff = angDiff(Math.atan2(dy, dx), b.th), maxTurn = b.sub ? 0.32 : 0.5;
        b.th += clamp(diff, -maxTurn * dt, maxTurn * dt);
        var vt = b.sp * (1 - 0.7 * Math.min(1, Math.abs(diff) / 0.9));
        if (b.pi === last && b.dest && b.dest.kind === 'berth') vt *= clamp(d * 7, 0.25, 1);
        b.v += (vt - b.v) * Math.min(1, dt * 0.8);
        b.x += Math.cos(b.th) * b.v * dt; b.y += Math.sin(b.th) * b.v * dt;
        render(b);
      }

      /* ---- чайки ---- */
      var gulls = [];
      for (i = 0; i < (big ? 5 : 3); i++) {
        var ge = document.createElement('div'); ge.className = 'sl-g'; ge.innerHTML = GULL;
        var dirG = Math.random() < 0.5 ? 1 : -1;
        var gu = { el: ge, x: rnd(X0, X1), y: rnd(Y0, Y1), vx: dirG * rnd(0.05, 0.09), vy: rnd(-0.012, 0.012), ph: rnd(0, 6.28) };
        layer.appendChild(ge); gulls.push(gu);
      }

      /* ---- плеск рыбки ---- */
      var ringTimer = setInterval(function () {
        if (signal && signal.aborted) { clearInterval(ringTimer); return; }
        if (document.hidden) return;
        var pt = randSea(); if (!pt) return;
        ringAt(pt.x, pt.y, 4, 0); ringAt(pt.x, pt.y, 2.6, 0.3);
      }, 1700);

      var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var last = 0;
      boats.forEach(function (b) { render(b); });
      if (!still) (function loop(ts) {
        if (signal && signal.aborted) { clearInterval(ringTimer); return; }
        requestAnimationFrame(loop);
        var t = ts / 1000, dt = Math.min(0.05, last ? t - last : 0.016);
        last = t;
        for (var i2 = 0; i2 < boats.length; i2++) step(boats[i2], dt);
        for (var j2 = 0; j2 < gulls.length; j2++) {
          var g = gulls[j2];
          g.x += g.vx * dt; g.y += g.vy * dt + Math.sin(t * 1.3 + g.ph) * 0.0004;
          if (g.vx > 0 && g.x > X1) { g.x = X0; g.y = rnd(Y0, Y1); }
          if (g.vx < 0 && g.x < X0) { g.x = X1; g.y = rnd(Y0, Y1); }
          place(g.el, g.x, g.y);
          g.el.style.transform = 'translate(-50%,-50%) scaleX(' + (g.vx > 0 ? 1 : -1) + ')';
        }
      })(performance.now());
      else gulls.forEach(function (g) { place(g.el, g.x, g.y); });

      box.__sl = { boats: boats, berths: berths, assign: assign, tick: function (dt) { boats.forEach(function (b) { step(b, dt); }); }, G: G };   /* для проверок */

      /* ---- волны от нажатия на воду ---- */
      function isWaterAt(ev) {
        var r = box.getBoundingClientRect();
        var u = (ev.clientX - r.left) / r.width, v = (ev.clientY - r.top) / r.height;
        if (u < 0 || u > 1 || v < 0 || v > 1) return true;
        var px = Math.min(W - 1, Math.max(0, Math.round(u * (W - 1)))), py = Math.min(H - 1, Math.max(0, Math.round(v * (H - 1))));
        var hit = 0, tot = 0;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
          var xx = px + dx, yy = py + dy; tot++;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || k[yy * W + xx]) hit++;
        }
        return hit / tot >= 0.45;
      }
      var down = null, live = 0;
      stage.addEventListener('pointerdown', function (ev) { down = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId }; }, { signal: signal });
      stage.addEventListener('pointerup', function (ev) {
        var d0 = down; down = null;
        if (!d0 || d0.id !== ev.pointerId) return;
        if (Math.hypot(ev.clientX - d0.x, ev.clientY - d0.y) > 12 || performance.now() - d0.t > 700) return;
        if (ev.target.closest && ev.target.closest('.pin,button,a,.sheet,.map__bar,.sl-b')) return;
        if (live > 8 || !isWaterAt(ev)) return;
        var sr = stage.getBoundingClientRect();
        var rp = document.createElement('div');
        rp.className = 'sl-rp';
        rp.style.left = (ev.clientX - sr.left) + 'px';
        rp.style.top = (ev.clientY - sr.top) + 'px';
        rp.innerHTML = '<i></i><i></i><i></i><b></b>';
        stage.appendChild(rp); live++;
        setTimeout(function () { rp.remove(); live--; }, 2700);
      }, { signal: signal });
      stage.addEventListener('pointercancel', function () { down = null; }, { signal: signal });
    }

    if (img.complete && img.naturalWidth) start();
    else img.addEventListener('load', start, { once: true });
  }

  var prev = window.__sevWater;
  window.__sevWater = function (box, mapId, signal) {
    try { if (prev) prev(box, mapId, signal); } catch (e) { console.warn('water fx', e); }
    try { seaLife(box, mapId, signal); } catch (e) { console.warn('sea life', e); }
  };
  window.__sevRipple = function () {};                       /* волны рисует обработчик выше */
})();
