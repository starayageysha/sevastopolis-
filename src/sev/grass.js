/* =====================================================================
   Севастополис — Vegetation / Grass Manager (v184)
   Объёмная трава из отдельных травинок с ветром и реакцией на лисёнка.

   Как устроено (под телефон):
   • Мир поделён на участки 16×16 м. Вокруг игрока строятся до ~45 участков;
     каждый участок — ОДИН меш (одна отрисовка) из тысяч травинок.
     Отдельных JS-объектов на травинки нет — только массивы вершин.
   • Уровни детализации: близко — полная густота, дальше — 35 %, ещё дальше —
     12 %; за 58 м трава плавно «растворяется» прямо в шейдере (без discard).
   • Ветер, порывы, разная фаза у каждой травинки и отклонение от лисёнка
     и жителей считаются в вершинном шейдере — процессор не тратится.
   • Типы: низкая, газонная, высокая полевая, очень густая высокая,
     луговые растения с цветами. Где какой тип — решает карта зон
     (шумы + близость к дорогам + ручные зоны SevGrass.zones).
   • Не растёт на асфальте, тротуарах, площадях, песке, в зданиях
     (проверка поверхности, препятствий, дорог и карты занятости парка).
   • Автокачество: если FPS падает, новые участки строятся реже.
   Подключение: после ядра и 28-sev-gfx-pobedy.js. Локация pobedy.
   ===================================================================== */
(function () {
  'use strict';
  var CH = 16, R_FULL = 20, R_MID = 40, R_FAR = 58, FADE0 = 46, FADE1 = 58;
  var TYPES = { // плотность — травинок на м², высота и ширина (м), сегментов
    short: { d: 9, h: [.12, .3], w: [.035, .055], seg: 2, lean: .25 },
    lawn: { d: 11, h: [.3, .62], w: [.04, .065], seg: 2, lean: .35 },
    tall: { d: 9, h: [1.0, 1.9], w: [.05, .085], seg: 3, lean: .45, clump: 1 },
    dense: { d: 13, h: [1.6, 2.6], w: [.055, .095], seg: 3, lean: .5, clump: 1 }
  };
  var ORDER = ['none', 'short', 'lawn', 'tall', 'dense'];
  var Q = { mult: 1, auto: true, level: 2 };
  try { var lvS = localStorage.getItem('sevgrass'); if (lvS != null) Q.level = +lvS; } catch (e) { }
  var LV_MULT = [0, .55, 1];
  var api = window.SevGrass = {
    zones: [ // ручные зоны: {x0,z0,x1,z1,type,mult}; первая подходящая побеждает
      // тестовая площадка в Парке Победы: полосы короткой, средней и высокой густой травы
      { x0: 30, z0: 190, x1: 48, z1: 250, type: 'short', name: 'test-short' },
      { x0: 48, z0: 190, x1: 66, z1: 250, type: 'lawn', name: 'test-lawn' },
      { x0: 66, z0: 190, x1: 82, z1: 250, type: 'tall', name: 'test-tall' },
      { x0: 82, z0: 190, x1: 100, z1: 250, type: 'dense', name: 'test-dense' }
    ],
    quality: Q, stats: { chunks: 0, blades: 0, tris: 0, built: 0 }
  };

  /* ---------- шум ---------- */
  function h2(x, z, s) { var n = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
  function vn(x, z, s) { var xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    var a = h2(xi, zi, s), b = h2(xi + 1, zi, s), c = h2(xi, zi + 1, s), d = h2(xi + 1, zi + 1, s); return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz; }
  function fbm(x, z, s) { return vn(x, z, s) * .55 + vn(x * 2.1, z * 2.1, s + 7) * .3 + vn(x * 4.3, z * 4.3, s + 13) * .15; }

  /* ---------- где расти ---------- */
  var roadHash = null;
  function buildRoads() {
    var RD = window.__sevRD; roadHash = new Map(); if (!RD) return;
    RD.forEach(function (r) { var p = r.p; if (!p) return; var hw = (r.c === 2 ? 7 + 2.5 : 4 + 2) + .6;
      for (var i = 0; i < p.length - 1; i++) { var a = p[i], b = p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 6));
        for (var k = 0; k <= n; k++) { var x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n, key = Math.floor(x / 16) + ',' + Math.floor(z / 16), A = roadHash.get(key); if (!A) roadHash.set(key, A = []); A.push(x, z, hw); } } });
  }
  function roadDist(x, z) { // расстояние до края дорожного полотна с тротуаром (отрицательное — на дороге)
    if (!roadHash) buildRoads(); var cx = Math.floor(x / 16), cz = Math.floor(z / 16), best = 99;
    for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) { var A = roadHash.get((cx + i) + ',' + (cz + j)); if (!A) continue;
      for (var k = 0; k < A.length; k += 3) { var d = Math.hypot(A[k] - x, A[k + 1] - z) - A[k + 2]; if (d < best) best = d; } }
    return best;
  }
  /* мини-карта города (3 м на пиксель): зелёное — земля/парк, синее — море,
     белое — дороги, серо-зелёное — дома. По ней трава растёт по всему городу */
  var MM = { img: null, ok: false, cv: null, cx: null };
  function mmLoad() {
    if (MM.img || !window.__sevMinimap) return; var M = window.__sevMinimap;
    MM.img = new Image(); MM.img.onload = function () { MM.ok = true; }; MM.img.src = 'data:image/jpeg;base64,' + M.b64;
    MM.cv = document.createElement('canvas'); MM.cv.width = MM.cv.height = 24; MM.cx = MM.cv.getContext('2d', { willReadFrequently: true });
  }
  function mmPatch(x0, z0) { // кусок мини-карты вокруг участка (с полями 12 м)
    var M = window.__sevMinimap; if (!MM.ok) return null;
    var px0 = Math.floor((x0 - 12 - M.x0) / M.res), py0 = Math.floor((M.z1 - (z0 + CH + 12)) / M.res), n = 24;
    MM.cx.clearRect(0, 0, n, n); MM.cx.drawImage(MM.img, px0, py0, n, n, 0, 0, n, n);
    return { d: MM.cx.getImageData(0, 0, n, n).data, px0: px0, py0: py0, n: n, M: M };
  }
  function mmKind(pt, x, z) { // 0 — нельзя, 1 — земля, 2 — парк
    if (!pt) return -1;
    var px = Math.floor((x - pt.M.x0) / pt.M.res) - pt.px0, py = Math.floor((pt.M.z1 - z) / pt.M.res) - pt.py0;
    if (px < 0 || py < 0 || px >= pt.n || py >= pt.n) return 0;
    function at(a, b) { a = Math.max(0, Math.min(pt.n - 1, a)); b = Math.max(0, Math.min(pt.n - 1, b)); var i = (b * pt.n + a) * 4; return [pt.d[i], pt.d[i + 1], pt.d[i + 2]]; }
    var c = at(px, py), r = c[0], gg = c[1], bb = c[2];
    if (bb > gg || r > 150 || gg > 175) return 0; // море, дороги, дома
    for (var k = 0; k < 8; k++) { var a = k * .785, q = at(px + Math.round(Math.cos(a) * 4), py + Math.round(Math.sin(a) * 4)); if (q[2] > q[1] + 20) return 0; } // берег/пляж
    return gg > 140 && r < 86 && bb < 82 ? 2 : 1;
  }
  var PARK_BOX = [-170, -180, 170, 880]; // где у парка есть подробная карта дорожек
  function classify(g, x, z, pt) {
    var w = g.world; if (!w || !w.surfaceAt) return 0;
    if (window.SevSand && window.SevSand.on && window.SevSand.isSand(x, z)) return 0; // v186: на пляжном песке трава не растёт
    if (window.SevWater && window.SevWater.isWater) { var wt = window.SevWater.shoreAt(x, z); if (wt && (wt.water || wt.toWater < 1.5 || wt.h < -.3)) return 0; } // v185: не в море и не у самой кромки
    var inPark = x > PARK_BOX[0] && x < PARK_BOX[2] && z > PARK_BOX[1] && z < PARK_BOX[3], park = false;
    if (inPark) {
      if (w.surfaceAt(x, z) !== 'grass') return 0;
      if (window.__sevGfxFree && !window.__sevGfxFree(x, z)) return 0;
      park = x > -140 && x < 120 && z > -150 && z < 800;
    } else {
      var mk = mmKind(pt, x, z); if (mk <= 0) return 0; park = mk === 2;
    }
    var ob = w.ctx && w.ctx.obstacles; if (ob) { var p = { x: x, z: z }; if (ob.resolve(p, .6)) return 0; }
    var rd = roadDist(x, z); if (rd < .3) return 0;
    for (var i = 0; i < api.zones.length; i++) { var Z = api.zones[i]; if (x >= Z.x0 && x < Z.x1 && z >= Z.z0 && z < Z.z1) return ORDER.indexOf(Z.type) * (Z.mult === 0 ? 0 : 1); }
    var big = fbm(x / 48, z / 48, 3), pat = fbm(x / 11, z / 11, 9);
    if (rd < 2.5) return 1; // кромка у дороги — низкая
    if (park) return big > .66 && pat > .45 && rd > 8 ? 3 : (pat > .78 ? 1 : 2); // газон с островками высокой травы
    if (rd > 22) return big > .7 ? 4 : big > .46 ? 3 : 2; // окраины, пустыри, склоны — поле
    return big > .72 && rd > 8 ? 3 : pat > .7 ? 1 : 2;
  }

  /* ---------- шейдер ---------- */
  var VS = [
    'precision highp float;',
    'attribute vec3 position;attribute vec2 uv;attribute vec4 color;attribute vec4 bdata;',
    'uniform mat4 viewProjection;uniform float time;uniform vec3 wind;uniform vec4 act0;uniform vec4 act1;uniform vec4 act2;uniform vec4 act3;uniform vec3 camPos;uniform vec2 fade;',
    'varying vec3 vCol;varying float vT;varying vec3 vN;varying vec3 vW;',
    'float hs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
    'vec2 push(vec4 a,vec2 b){vec2 d=b-a.xz;float L=length(d);float f=clamp(1.0-L/max(a.w,0.01),0.0,1.0);return (L>0.001?d/L:vec2(0.0))*f*f;}',
    'void main(){',
    ' float t=uv.y;float tt=t*t;vec3 p=position;vec2 b=bdata.xy;float h=bdata.z;float ph=bdata.w;',
    ' vec2 wd=wind.xy;float ws=wind.z;',
    ' float gust=sin(dot(b,wd)*0.11-time*1.6+ph*0.7)*0.5+0.5;gust*=gust;',
    ' float fl=sin(time*(2.1+ph*0.35)+ph*6.2831)*0.22+sin(time*3.7+ph*11.0)*0.08;',
    ' vec2 side=vec2(-wd.y,wd.x);',
    ' vec2 off=(wd*(0.2+gust*0.8)*ws+side*fl*ws*0.5+wd*fl*0.25*ws)*tt*min(h,1.6)*0.42;',
    ' vec2 pz=push(act0,b)+push(act1,b)+push(act2,b)+push(act3,b);float pl=min(length(pz),1.0);',
    ' off+=pz*tt*min(h,2.0)*0.9;',
    ' p.xz+=off;p.y-=dot(off,off)/(h+0.05)*0.6+pl*tt*h*0.3;',
    ' float d=distance(camPos.xz,b);float keep=1.0-smoothstep(fade.x,fade.y,d);',
    ' gl_Position=viewProjection*vec4(p,1.0);',
    ' if(hs(b+0.37)>keep)gl_Position=vec4(2.0,2.0,2.0,1.0);',
    ' vCol=color.rgb;vT=t;vW=p;vN=normalize(vec3(-off.x*1.5,1.0,-off.y*1.5));',
    '}'].join('\n');
  var FS = [
    'precision highp float;',
    'uniform vec3 sunDir;uniform vec3 sunCol;uniform vec3 ambCol;uniform vec3 fogCol;uniform vec4 fogInfo;uniform vec3 camPos;',
    'varying vec3 vCol;varying float vT;varying vec3 vN;varying vec3 vW;',
    'void main(){',
    ' vec3 n=normalize(vN);vec3 L=-sunDir;',
    ' float ndl=max(dot(n,L),0.0)*0.55+0.45;', // мягкий «обёрнутый» свет — без пластика
    ' vec3 V=normalize(vW-camPos);',
    ' float tr=pow(max(dot(V,L),0.0),3.0)*vT*0.65;', // просвечивание против солнца
    ' float ao=mix(0.42,1.0,smoothstep(0.0,0.75,vT));', // тень у корней
    ' vec3 c=vCol*ao;',
    ' vec3 lit=c*(ambCol+sunCol*ndl)+vCol*sunCol*tr*vec3(0.85,1.0,0.45)+vec3(0.035,0.045,0.0)*vT*vT*sunCol;',
    ' float d=distance(camPos,vW);float f=1.0;',
    ' if(fogInfo.x>2.5)f=clamp((fogInfo.z-d)/max(fogInfo.z-fogInfo.y,0.01),0.0,1.0);',
    ' else if(fogInfo.x>1.5){float e=d*fogInfo.w;f=exp(-e*e);}else if(fogInfo.x>0.5)f=exp(-d*fogInfo.w);',
    ' gl_FragColor=vec4(mix(fogCol,lit,f),1.0);',
    '}'].join('\n');

  var S = null; // состояние сцены
  function setup(g) {
    var J = window.__sevBJS; if (!J || !J.SM || !J.Mesh || !J.VD) return null;
    var sc = g.scene;
    var mat = new J.SM('sevGrassMat', sc, { vertexSource: VS, fragmentSource: FS }, {
      attributes: ['position', 'uv', 'color', 'bdata'],
      uniforms: ['viewProjection', 'time', 'wind', 'act0', 'act1', 'act2', 'act3', 'camPos', 'fade', 'sunDir', 'sunCol', 'ambCol', 'fogCol', 'fogInfo']
    });
    mat.backFaceCulling = false;
    var st = { g: g, sc: sc, J: J, mat: mat, chunks: new Map(), t: 0, wdir: Math.random() * 6.28, fpsAcc: 0, fpsN: 0, fpsT: 0, queue: [] };
    sc.onBeforeRenderObservable.add(function () { try { tick(st); } catch (e) { console.error('[grass]', e); } });
    sc.onDisposeObservable.add(function () { if (S === st) S = null; });
    return st;
  }

  /* ---------- построение участка ---------- */
  var PAL = [[.27, .45, .16], [.33, .50, .19], [.23, .40, .14], [.40, .49, .22], [.48, .49, .26], [.56, .52, .30], [.20, .35, .12]]; // приглушённые природные оттенки
  function bladeColor(x, z, typ, r) {
    var dry = fbm(x / 26, z / 26, 21), lush = fbm(x / 7, z / 7, 33);
    var a = PAL[(r * 3) | 0], b = dry > .62 ? PAL[4 + ((r * 2) | 0)] : PAL[3 + ((r * 4) | 0) % 4];
    var k = Math.min(1, Math.max(0, (dry - .38) * 1.6)) * (typ >= 3 ? 1 : .55), v = .88 + lush * .24 + (h2(x, z, 5) - .5) * .12;
    return [(a[0] + (b[0] - a[0]) * k) * v, (a[1] + (b[1] - a[1]) * k) * v, (a[2] + (b[2] - a[2]) * k) * v];
  }
  function buildChunk(st, cx, cz, level) {
    var g = st.g, mult = (level === 0 ? 1 : level === 1 ? .35 : .12) * Q.mult * LV_MULT[Q.level];
    var P = [], U = [], C = [], B = [], I = [], blades = 0;
    var x0 = cx * CH, z0 = cz * CH, pt = mmPatch(x0, z0);
    function blade(x, z, typ, T, r1, r2, r3, flowerCol, wide) {
      var h = T.h[0] + (T.h[1] - T.h[0]) * Math.pow(r1, .8), w = (T.w[0] + (T.w[1] - T.w[0]) * r2) * (wide || 1), seg = T.seg;
      var a = r3 * 6.2831, ca = Math.cos(a), sa = Math.sin(a), la = h2(x, z, 9) * 6.2831, lean = T.lean * (.4 + r2 * .8);
      var lx = Math.cos(la) * lean, lz = Math.sin(la) * lean, ph = h2(z, x, 4), col = bladeColor(x, z, ORDER.indexOf(typ), r1), base = P.length / 3;
      var y0 = .02;
      for (var i = 0; i <= seg; i++) {
        var t = i / seg, bend = t * t * h, yy = y0 + h * t * (1 - lean * lean * .25 * t), ox = x + lx * bend, oz = z + lz * bend;
        var tip = i === seg, ww = w * (1 - t * .82) * .5;
        var cc = flowerCol && tip ? flowerCol : col, sh = 1 + t * .12;
        if (!tip) { P.push(ox - ca * ww, yy, oz - sa * ww, ox + ca * ww, yy, oz + sa * ww); U.push(0, t, 1, t); C.push(cc[0] * sh, cc[1] * sh, cc[2] * sh, 1, cc[0] * sh, cc[1] * sh, cc[2] * sh, 1); B.push(x, z, h, ph, x, z, h, ph); }
        else { P.push(ox, yy, oz); U.push(.5, 1); C.push(cc[0] * sh, cc[1] * sh, cc[2] * sh, 1); B.push(x, z, h, ph); }
      }
      for (var s = 0; s < seg - 1; s++) { var q = base + s * 2; I.push(q, q + 1, q + 3, q, q + 3, q + 2); }
      var qq = base + (seg - 1) * 2; I.push(qq, qq + 1, qq + 2);
      blades++;
    }
    for (var zi = 0; zi < CH; zi++) for (var xi = 0; xi < CH; xi++) {
      var cxp = x0 + xi + .5, czp = z0 + zi + .5, typI = classify(g, cxp, czp, pt); if (!typI) continue;
      var typ = ORDER[typI], T = TYPES[typ];
      // плотность меняется пятнами — без ровного ковра
      var dn = .55 + fbm(cxp / 6, czp / 6, 41) * .9, n = T.d * dn * mult, cnt = Math.floor(n) + (h2(cxp, czp, 2) < n % 1 ? 1 : 0);
      if (T.clump) { // высокая трава растёт кустиками
        var nc = 1 + ((h2(cxp, czp, 3) * 3) | 0), per = Math.ceil(cnt / nc);
        for (var c = 0; c < nc; c++) { var kx = cxp + (h2(cxp, czp, 10 + c) - .5), kz = czp + (h2(czp, cxp, 20 + c) - .5);
          for (var k = 0; k < per; k++) { var r = h2(kx * 3.1 + k, kz * 2.7, k), an = r * 6.2831, rr = Math.sqrt(h2(kz + k, kx, 7)) * .35;
            blade(kx + Math.cos(an) * rr, kz + Math.sin(an) * rr, typ, T, h2(kx, kz + k, 11), h2(kx + k, kz, 12), h2(k, kx + kz, 13)); } }
      } else {
        for (var k2 = 0; k2 < cnt; k2++) { var bx = cxp + h2(cxp + k2, czp, 31) - .5, bz = czp + h2(czp, cxp + k2, 32) - .5; blade(bx, bz, typ, T, h2(bx, bz, 11), h2(bz, bx, 12), h2(bx + bz, k2, 13)); }
      }
      // луговые растения с цветами (кустики шире и с цветком на верхушке)
      if (level < 2 && typI >= 2 && h2(cxp, czp, 50) < (typI >= 3 ? .07 : .035) * Q.mult) {
        var fc = [[1, 1, .95], [1, .86, .22], [.95, .45, .7], [.68, .58, 1], [1, .5, .25]][(h2(cxp, czp, 51) * 5) | 0];
        var PT = { h: typI >= 3 ? [.7, 1.2] : [.35, .6], w: [.09, .14], seg: 3, lean: .2 };
        for (var f = 0; f < 6; f++) blade(cxp + (h2(f, cxp, 52) - .5) * .3, czp + (h2(czp, f, 53) - .5) * .3, typ, PT, h2(f, czp, 54), h2(cxp, f, 55), f / 6 + h2(f, f, 56) * .1, f < 2 ? fc : null, 1.6);
      }
    }
    if (!blades) return { empty: true, level: level };
    var J = st.J, m = new J.Mesh('sev-grass-' + cx + '_' + cz, st.sc), vd = new J.VD();
    vd.positions = P; vd.indices = I; vd.uvs = U; vd.colors = C; vd.applyToMesh(m, false);
    m.setVerticesData('bdata', new Float32Array(B), false, 4);
    m.material = st.mat; m.isPickable = false; m.checkCollisions = false; m.receiveShadows = false;
    m.doNotSyncBoundingInfo = true; m.freezeWorldMatrix(); m.alwaysSelectAsActiveMesh = false;
    // запас границ: травинки качаются, а высокая трава выше
    try { var bi = m.getBoundingInfo(), mn = bi.minimum.clone(), mx = bi.maximum.clone(); mn.x -= 1; mn.z -= 1; mx.x += 1; mx.z += 1; mx.y += .5; bi.reConstruct(mn, mx); } catch (e) { }
    api.stats.built++;
    return { mesh: m, level: level, blades: blades, tris: I.length / 3 };
  }

  /* ---------- кадр ---------- */
  function levelFor(d) { return d < R_FULL ? 0 : d < R_MID ? 1 : d < R_FAR + 6 ? 2 : -1; }
  function tick(st) {
    var g = st.g, sc = st.sc, eng = sc.getEngine(), dt = Math.min(.1, eng.getDeltaTime() / 1000), cam = sc.activeCamera, P = g.player && g.player.position;
    if (!cam || !P) return;
    st.t += dt;
    // ветер: направление медленно гуляет, сила — от погоды
    var atm = window.__sevAtmCur ? window.__sevAtmCur() : null, wx = atm && atm.wind != null ? atm.wind : .3;
    st.wdir += dt * .02 * Math.sin(st.t * .05);
    var ws = .35 + wx * 1.4 + Math.sin(st.t * .23) * .12;
    var m = st.mat;
    m.setFloat('time', st.t); m.setVector3('wind', new P.constructor(Math.cos(st.wdir), Math.sin(st.wdir), ws));
    m.setVector3('camPos', cam.globalPosition || cam.position); m.setVector2('fade', vec2(FADE0, FADE1));
    // кто приминает траву: лисёнок (на транспорте — шире) и ближайшие жители
    var F = window.__sevVehicleStore, riding = F && F.riding, acts = [[P.x, P.y, P.z, riding ? 2.8 : 1.5]];
    var M = window.SevNPC && window.SevNPC.manager;
    if (M && M.list) { var near = []; M.list.forEach(function (n) { if (n.vis === false) return; var d = Math.hypot(n.x - P.x, n.z - P.z); if (d < 30) near.push([d, n]); }); near.sort(function (a, b) { return a[0] - b[0]; }); near.slice(0, 3).forEach(function (q) { acts.push([q[1].x, 0, q[1].z, 1.1]); }); }
    for (var i = 0; i < 4; i++) { var a = acts[i] || [1e6, 0, 1e6, .01]; m.setVector4('act' + i, v4(a[0], a[1], a[2], a[3])); }
    // свет и туман из сцены
    if (!st.lt || st.t - st.ltT > 1) { st.ltT = st.t; st.lt = lights(sc); }
    var L = st.lt; m.setVector3('sunDir', L.dir); m.setColor3('sunCol', L.sun); m.setColor3('ambCol', L.amb);
    m.setColor3('fogCol', sc.fogColor || L.amb); m.setVector4('fogInfo', v4(sc.fogEnabled === false ? 0 : sc.fogMode || 0, sc.fogStart || 0, sc.fogEnd || 1000, sc.fogDensity || 0));
    // высоко на вертолёте трава не видна — не строим; «Выкл» в настройках — убираем всё
    if (Q.level === 0) { if (st.chunks.size) { st.chunks.forEach(function (c) { if (c.mesh) c.mesh.dispose(); }); st.chunks.clear(); } api.stats.chunks = api.stats.tris = api.stats.blades = 0; return; }
    if (P.y > 40) { st.chunks.forEach(function (c) { if (c.mesh) c.mesh.setEnabled(false); }); return; }
    // автокачество по FPS
    st.fpsT += dt; st.fpsAcc += eng.getFps(); st.fpsN++;
    if (st.fpsT > 4) { var fps = st.fpsAcc / st.fpsN; st.fpsT = st.fpsAcc = st.fpsN = 0; if (Q.auto) { if (fps < 32 && Q.mult > .45) Q.mult = Math.max(.45, Q.mult - .15); else if (fps > 52 && Q.mult < 1) Q.mult = Math.min(1, Q.mult + .1); } api.stats.fps = Math.round(fps); }
    // какие участки нужны и с какой детализацией
    var pcx = Math.floor(P.x / CH), pcz = Math.floor(P.z / CH), R = Math.ceil((R_FAR + 8) / CH), want = [];
    for (var dz = -R; dz <= R; dz++) for (var dx = -R; dx <= R; dx++) {
      var cx = pcx + dx, cz = pcz + dz, ccx = cx * CH + CH / 2, ccz = cz * CH + CH / 2, d = Math.max(0, Math.hypot(ccx - P.x, ccz - P.z) - CH * .5), lv = levelFor(d);
      var k = cx + ',' + cz, c = st.chunks.get(k);
      if (lv < 0) { if (c && d > R_FAR + 26) { if (c.mesh) c.mesh.dispose(); st.chunks.delete(k); } else if (c && c.mesh) c.mesh.setEnabled(false); continue; }
      if (c && c.mesh && !c.mesh.isEnabled()) c.mesh.setEnabled(true);
      // перестраиваем, если нужна детальнее (с запасом, чтобы не дёргалось на границе)
      if (!c || c.level > lv) want.push([d, cx, cz, lv, k]);
    }
    mmLoad(); if (!MM.ok) want = want.filter(function (q) { var x = q[1] * CH, z = q[2] * CH; return x > PARK_BOX[0] && x < PARK_BOX[2] && z > PARK_BOX[1] && z < PARK_BOX[3]; });
    // уборка: участки, оставшиеся далеко (после телепорта/быстрой езды), удаляем
    st.sweep = (st.sweep || 0) + dt;
    if (st.sweep > .5) { st.sweep = 0; st.chunks.forEach(function (c, k) { var ij = k.split(','), d2 = Math.hypot((+ij[0] + .5) * CH - P.x, (+ij[1] + .5) * CH - P.z); if (d2 > R_FAR + 34) { if (c.mesh) c.mesh.dispose(); st.chunks.delete(k); } }); }
    // ждём карту берега (не сажаем траву в море); при новом окне — перестраиваем участки у воды
    var WS = window.SevWater && window.SevWater.state;
    if (WS && !WS.mask) want = [];
    if (WS && WS.ver && st.wver !== WS.ver) { st.wver = WS.ver; st.chunks.forEach(function (c, k) { if (c.mesh) c.mesh.dispose(); }); st.chunks.clear(); want = []; }
    want.sort(function (a, b) { return a[0] - b[0]; });
    var budget = 1 + (want.length && want[0][0] < R_FULL ? 1 : 0), t0 = performance.now();
    for (var w = 0; w < want.length && budget > 0 && performance.now() - t0 < 10; w++, budget--) {
      var q = want[w], old = st.chunks.get(q[4]), nc = buildChunk(st, q[1], q[2], q[3]);
      if (old && old.mesh) old.mesh.dispose();
      st.chunks.set(q[4], nc);
    }
    var bl = 0, tr = 0, n = 0; st.chunks.forEach(function (c) { if (c.mesh && c.mesh.isEnabled()) { bl += c.blades; tr += c.tris; n++; } });
    api.stats.chunks = n; api.stats.blades = bl; api.stats.tris = tr; api.stats.mult = Q.mult;
    // быстрый бег по высокой траве — травинки и пыль из-под лап
    var v = g.player.velocity ? Math.hypot(g.player.velocity.x, g.player.velocity.z) : 0;
    if (!riding && v > 7.5) { st.dust = (st.dust || 0) + dt; if (st.dust > .12) { st.dust = 0; var ty = classify(g, P.x, P.z, mmPatch(Math.floor(P.x / CH) * CH, Math.floor(P.z / CH) * CH)); if (ty >= 3) bits(g, ty); } }
    function vec2(a, b) { return { x: a, y: b }; }
  }
  function v4(a, b, c, d) { return { x: a, y: b, z: c, w: d }; }
  function lights(sc) {
    var sun = null, hemi = null; sc.lights.forEach(function (l) { if (!l.isEnabled()) return; var k = l.getClassName(); if (k === 'DirectionalLight' && (!sun || l.intensity > sun.intensity)) sun = l; if (k === 'HemisphericLight' && (!hemi || l.intensity > hemi.intensity)) hemi = l; });
    var dir = sun ? sun.direction.clone().normalize() : { x: -.4, y: -.8, z: -.3 };
    function col(l, k) { var c = l && (l.diffuse || l.groundColor); var i = l ? l.intensity : 0; return c ? { r: c.r * i * k, g: c.g * i * k, b: c.b * i * k } : { r: 0, g: 0, b: 0 }; }
    var s = col(sun, .78), a = col(hemi, .5);
    if (!sun) s = { r: .8, g: .78, b: .7 }; if (!hemi) a = { r: .35, g: .4, b: .42 };
    return { dir: dir, sun: s, amb: a };
  }
  function bits(g, ty) { // зелёные травинки/пылинки на экране из-под лап
    try {
      var sc = g.scene, cam = sc.activeCamera, eng = sc.getEngine(), P = g.player.position, V3 = P.constructor, M = cam.getViewMatrix().constructor;
      var p = V3.Project(new V3(P.x, P.y + .3, P.z), M.Identity(), sc.getTransformMatrix(), cam.viewport.toGlobal(eng.getRenderWidth(), eng.getRenderHeight()));
      var r = eng.getRenderingCanvasClientRect(), sx = r.width / eng.getRenderWidth(), sy = r.height / eng.getRenderHeight();
      for (var i = 0; i < 2; i++) {
        var d = document.createElement('div'), sz = 6 + Math.random() * 8, x = r.left + p.x * sx + (Math.random() - .5) * 40, y = r.top + p.y * sy + (Math.random() - .5) * 14;
        d.style.cssText = 'position:fixed;pointer-events:none;z-index:30;left:' + x + 'px;top:' + y + 'px;width:' + sz + 'px;height:' + (sz * .4) + 'px;border-radius:40%;background:' + (i ? 'rgba(120,170,70,.9)' : 'rgba(200,190,150,.7)') + ';transform:translate(-50%,-50%) rotate(' + (Math.random() * 180) + 'deg);transition:all .6s ease-out';
        document.body.appendChild(d);
        (function (d) { requestAnimationFrame(function () { d.style.transform += ' translate(' + ((Math.random() - .5) * 40) + 'px,-36px)'; d.style.opacity = '0'; }); setTimeout(function () { d.remove(); }, 650); })(d);
      }
    } catch (e) { }
  }

  /* ---------- настройка в «Настройках» на заставке ---------- */
  api.setLevel = function (lv) { Q.level = lv; try { localStorage.setItem('sevgrass', String(lv)); } catch (e) { } if (S) { S.chunks.forEach(function (c) { if (c.mesh) c.mesh.dispose(); }); S.chunks.clear(); } };
  function addSetting() {
    var box = document.querySelector('.sevsave') || document.querySelector('.splash__pb'); if (!box || document.getElementById('sevGrassSet')) return;
    var d = document.createElement('div'); d.id = 'sevGrassSet'; d.style.cssText = 'margin:10px 0 4px;font:800 14px Nunito,Arial,sans-serif;display:flex;gap:6px;align-items:center;flex-wrap:wrap';
    d.innerHTML = '<span>🌿 Объёмная трава:</span>' + ['Выкл', 'Средне', 'Много'].map(function (t, i) { return '<button type="button" data-lv="' + i + '" style="padding:6px 12px;border-radius:999px;border:2px solid #fff;font:800 13px Nunito,Arial;color:#fff;background:' + (Q.level === i ? 'linear-gradient(180deg,#ffd84a,#f2a600)' : 'linear-gradient(180deg,#7fd6ff,#1f86e6 60%,#0d5bb8)') + '">' + t + '</button>'; }).join('');
    d.addEventListener('click', function (e) { var b = e.target.closest('button[data-lv]'); if (!b) return; api.setLevel(+b.dataset.lv); d.remove(); addSetting(); });
    box.appendChild(d);
  }
  setInterval(addSetting, 1500);

  /* ---------- запуск ---------- */
  var asked = /[?&]grasstest\b/.test(location.search), moved = false;
  setInterval(function () {
    var g = window.__sevGame; if (!g || !g.scene || g.scene.isDisposed || !g.def || g.def.id !== 'pobedy' || !window.__sevBJS) return;
    if (S && S.sc === g.scene) return;
    roadHash = null; S = setup(g); api.state = S;
    if (asked && !moved && g.player) { moved = true; g.player.position.x = 74; g.player.position.z = 186; } // ?grasstest — к тестовой площадке
  }, 600);
})();
