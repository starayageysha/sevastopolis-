/* =====================================================================
   Севастополис — Water & Shoreline Manager (v185)
   Бирюзовая прибрежная вода, видимое песчаное дно, мягкие волны,
   живая пена прибоя (накатывает и отступает), мокрый песок, круги и
   всплески от лисёнка, дождь на воде. Совместимо с лодками и плаванием.

   Как устроено:
   • Береговая линия берётся из НАСТОЯЩЕЙ геометрии суши: вокруг игрока
     (окно 384×384 м) треугольники твёрдых мешей «растеризуются» сверху
     в сетку 0,75 м (это 28 тыс. треугольников на всю карту — миллисекунды).
     По сетке строится поле расстояний: сколько метров до суши / до воды
     и что рядом — песок или камни/пирс/стенка. Поле — одна текстура.
   • Море остаётся тем же (волны Герстнера из ядра, по ним плавают лодки).
     Шейдер моря дополняется: волны мелеют у берега, цвет зависит от глубины,
     на мелководье виден песок и блики, у берега — пена накатами, у камней —
     брызги; круги от лисёнка/поплавка/дождя. Вдали эффекты отключаются.
   • На песке — тонкая прозрачная «полоса прибоя»: мокрый песок и пена,
     которая забегает на берег и уходит обратно.
   • Уровни: «Выкл», «Тестовый пляж» (только пляж Парка Победы — по умолчанию,
     как требует ТЗ: сначала площадка), «Везде».
   API: window.SevWater — ring(x,z,amp), isWater(x,z), shoreAt(x,z),
        height(x,z), level, setLevel(n).
   ===================================================================== */
(function () {
  'use strict';
  var W = 384, N = 512, CELL = W / N, MAXW = 48, MAXL = 8;
  var TEST = { x0: -220, z0: 770, x1: 540, z1: 1180 }; // тестовая площадка: пляж Парка Победы
  var LV = 1; try { var sv = localStorage.getItem('sevwater'); if (sv != null) LV = +sv; } catch (e) { }
  var api = window.SevWater = { level: LV, test: TEST, stats: {} };
  var S = null;

  function G() { return window.__sevGame; }
  function J() { return window.__sevBJS; }

  /* ---------- 1. карта берега ---------- */
  var STRUCT = /pier|wall|quay|mol|breakwater|bound|bridge|prichal|rock|stone|kamen/i;
  function buildMask(st, cx, cz) {
    var t0 = performance.now(), sc = st.sc;
    var x0 = Math.round(cx - W / 2), z0 = Math.round(cz - W / 2);
    var H = new Float32Array(N * N).fill(-99), T = new Uint8Array(N * N);
    var V = sc.meshes[0] && sc.meshes[0].position.constructor, tmp = V ? new V(0, 0, 0) : null, tris = 0;
    sc.meshes.forEach(function (m) {
      if (!m.checkCollisions || !m.isEnabled() || (m.metadata && m.metadata.water)) return;
      var bb = m.getBoundingInfo().boundingBox, mn = bb.minimumWorld, mx = bb.maximumWorld;
      if (mx.y < -.96 || mx.x < x0 || mn.x > x0 + W || mx.z < z0 || mn.z > z0 + W) return;
      var src = m.isAnInstance ? m.sourceMesh : m, P = src.getVerticesData && src.getVerticesData('position'), I = src.getIndices && src.getIndices();
      if (!P || !I) return;
      var wm = m.computeWorldMatrix(true).m, typ = STRUCT.test(m.name) ? 2 : 1, n = P.length / 3, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
      for (var i = 0; i < n; i++) { var px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        X[i] = px * wm[0] + py * wm[4] + pz * wm[8] + wm[12]; Y[i] = px * wm[1] + py * wm[5] + pz * wm[9] + wm[13]; Z[i] = px * wm[2] + py * wm[6] + pz * wm[10] + wm[14]; }
      for (var k = 0; k < I.length; k += 3) {
        var a = I[k], b = I[k + 1], c = I[k + 2];
        if (Y[a] < -.96 && Y[b] < -.96 && Y[c] < -.96) continue;
        var ax = (X[a] - x0) / CELL, az = (Z[a] - z0) / CELL, bx = (X[b] - x0) / CELL, bz = (Z[b] - z0) / CELL, qx = (X[c] - x0) / CELL, qz = (Z[c] - z0) / CELL;
        var den = (bz - qz) * (ax - qx) + (qx - bx) * (az - qz); if (Math.abs(den) < 1e-6) continue; // вертикальные стенки не закрывают клеток
        var i0 = Math.max(0, Math.floor(Math.min(ax, bx, qx))), i1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, qx))), j0 = Math.max(0, Math.floor(Math.min(az, bz, qz))), j1 = Math.min(N - 1, Math.ceil(Math.max(az, bz, qz)));
        tris++;
        for (var jj = j0; jj <= j1; jj++) for (var ii = i0; ii <= i1; ii++) {
          var px2 = ii + .5, pz2 = jj + .5, w1 = ((bz - qz) * (px2 - qx) + (qx - bx) * (pz2 - qz)) / den, w2 = ((qz - az) * (px2 - qx) + (ax - qx) * (pz2 - qz)) / den, w3 = 1 - w1 - w2;
          if (w1 < -.02 || w2 < -.02 || w3 < -.02) continue;
          var y = w1 * Y[a] + w2 * Y[b] + w3 * Y[c], id = jj * N + ii;
          if (y > H[id]) { H[id] = y; T[id] = typ; }
        }
      }
    });
    // суша — где верх выше -0.85 м
    var land = new Uint8Array(N * N); for (var q = 0; q < N * N; q++) land[q] = H[q] > -.96 ? 1 : 0; // граница — там, где суша выходит из воды
    var dW = edt(land, 1, MAXW / CELL), dL = edt(land, 0, MAXL / CELL);
    // тип ближайшей суши для воды: структура или песок (распространяем на 4 м)
    var near = new Uint8Array(N * N); for (q = 0; q < N * N; q++) near[q] = land[q] ? T[q] : 0;
    for (var it = 0; it < 6; it++) for (var jy = 1; jy < N - 1; jy++) for (var ix = 1; ix < N - 1; ix++) { var id2 = jy * N + ix; if (near[id2]) continue; var v = near[id2 - 1] || near[id2 + 1] || near[id2 - N] || near[id2 + N]; if (v) near[id2] = v; }
    // текстура: R — метры до суши (вода), G — метры до воды (суша), B — рядом камни/пирс
    var img = st.ctx.createImageData(N, N), D = img.data;
    for (var j = 0; j < N; j++) for (var i3 = 0; i3 < N; i3++) {
      var s = j * N + i3, o = ((N - 1 - j) * N + i3) * 4;
      D[o] = land[s] ? 0 : Math.min(255, dW[s] * CELL / MAXW * 255);
      D[o + 1] = land[s] ? Math.min(255, dL[s] * CELL / MAXL * 255) : 0;
      D[o + 2] = near[s] === 2 ? 255 : 0; D[o + 3] = 255;
    }
    st.ctx.putImageData(img, 0, 0); st.tex.update(true);
    st.mask = { x0: x0, z0: z0, H: H, T: T, land: land, dW: dW, dL: dL, near: near };
    st.rect = [x0, z0, W, W]; st.ver = (st.ver || 0) + 1;
    api.stats.maskMs = Math.round(performance.now() - t0); api.stats.maskTris = tris;
    buildSwash(st);
  }
  // поле расстояний (два прохода, соседи 1 и √2) в клетках
  function edt(land, target, maxC) {
    var D = new Float32Array(N * N), INF = 1e6, r2 = Math.SQRT2;
    for (var i = 0; i < N * N; i++) D[i] = (land[i] === target) ? 0 : INF;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = y * N + x, v = D[k]; if (!v) continue;
      if (x > 0) v = Math.min(v, D[k - 1] + 1); if (y > 0) { v = Math.min(v, D[k - N] + 1); if (x > 0) v = Math.min(v, D[k - N - 1] + r2); if (x < N - 1) v = Math.min(v, D[k - N + 1] + r2); } D[k] = v; }
    for (y = N - 1; y >= 0; y--) for (x = N - 1; x >= 0; x--) { k = y * N + x; v = D[k]; if (!v) continue;
      if (x < N - 1) v = Math.min(v, D[k + 1] + 1); if (y < N - 1) { v = Math.min(v, D[k + N] + 1); if (x < N - 1) v = Math.min(v, D[k + N + 1] + r2); if (x > 0) v = Math.min(v, D[k + N - 1] + r2); } D[k] = Math.min(v, maxC); }
    return D;
  }
  function cellAt(x, z) { var M = S && S.mask; if (!M) return -1; var i = Math.floor((x - M.x0) / CELL), j = Math.floor((z - M.z0) / CELL); if (i < 0 || j < 0 || i >= N || j >= N) return -1; return j * N + i; }
  api.isWater = function (x, z) { var c = cellAt(x, z); if (c < 0) return null; return !S.mask.land[c]; };
  api.shoreAt = function (x, z) { var c = cellAt(x, z); if (c < 0) return null; var M = S.mask; return { water: !M.land[c], toLand: M.dW[c] * CELL, toWater: M.dL[c] * CELL, type: (M.land[c] ? M.T[c] : M.near[c]) === 2 ? 'rock' : 'sand', h: M.H[c] }; };
  api.height = function (x, z) { var w = window.__sevWave; return (w && w.on ? w.h(x, z) : 0) + (w ? w.y : -1); };
  api.inZone = function (x, z) { return api.level === 2 || (api.level === 1 && x > TEST.x0 && x < TEST.x1 && z > TEST.z0 && z < TEST.z1); };

  /* ---------- 2. шейдер моря ---------- */
  var VS_ADD_DECL = 'uniform sampler2D shoreTex;uniform vec4 shoreRect;uniform vec4 zoneRect;uniform float zoneAll;uniform float wind;varying float vSd;varying float vZn;\n';
  var VS_ADD = [
    'vec2 su=(p-shoreRect.xy)/shoreRect.zw;float ins=step(0.,su.x)*step(su.x,1.)*step(0.,su.y)*step(su.y,1.);',
    'float wdist=mix(48.,texture2D(shoreTex,su).r*48.,ins);',
    'float zn=max(zoneAll,step(zoneRect.x,p.x)*step(p.x,zoneRect.z)*step(zoneRect.y,p.y)*step(p.y,zoneRect.w));',
    'f*=mix(1.,mix(.16,1.,smoothstep(1.5,30.,wdist))*(.8+wind*.55),zn);',
    'vSd=wdist;vZn=zn;'].join('\n');
  var FS_ADD_DECL = 'uniform sampler2D shoreTex;uniform vec4 shoreRect;uniform float wind;uniform float rain;uniform float sunny;uniform float bright;uniform vec4 rings[8];uniform float on;varying float vSd;varying float vZn;\n';
  var FS_ADD = [
    'float nearC=1.-smoothstep(80.,130.,dist);',
    'if(vZn*on>0.001){',
    ' vec2 su2=(p-shoreRect.xy)/shoreRect.zw;float ins2=step(0.,su2.x)*step(su2.x,1.)*step(0.,su2.y)*step(su2.y,1.);vec4 shx=texture2D(shoreTex,su2);float wd=mix(48.,shx.r*48.,ins2);float stc=shx.b*ins2;',
    ' float depth=clamp(wd/26.,0.,1.);',
    ' vec2 cp=p*.42+vec2(time*.05,time*.03);',
    ' float ca=pow(abs(sin(cp.x*1.7+sin(cp.y*1.3+time*.6))*sin(cp.y*1.9+sin(cp.x*1.1-time*.5))),.7);',
    ' vec3 sandC=vec3(.86,.78,.57)*(.84+.3*ca*nearC);',
    ' vec3 wc=mix(vec3(.62,.93,.88),vec3(.27,.80,.76),smoothstep(0.,.1,depth));',
    ' wc=mix(wc,vec3(.11,.60,.68),smoothstep(.1,.42,depth));wc=mix(wc,vec3(.05,.38,.52),smoothstep(.42,1.,depth));',
    ' float clar=(1.-smoothstep(0.,.32,depth))*(.55+.45*sunny);',
    ' vec3 und=mix(wc,sandC*mix(vec3(1.),wc*1.25,.42),clar*.78);',
    ' float nd2=max(dot(n,L),0.);',
    ' vec3 c2=und*(.64+.48*nd2);',
    ' c2=mix(c2,mix(fogC,vec3(.66,.86,.97),.4),min(fr*.95,.8)*(.3+.7*depth)*(1.-.35*sunny*(1.-depth)));',
    ' c2+=vec3(1.,.95,.82)*pow(max(dot(n,Hh),0.),110.)*(.5+1.1*sunny);',
    ' c2+=vec3(.9,1.,.95)*ca*.11*(1.-depth)*sunny*nearC;',
    ' float nz=texture2D(foamTex,p/9.+vec2(time*.010,-time*.013)).a,nz2=texture2D(foamTex,p/3.6+vec2(-time*.02,time*.017)).a;',
    ' float Tp=6.5/(1.+wind*.55),Rr=9.+wind*9.,fo=0.;',
    ' float nzB=texture2D(foamTex,p/16.+vec2(time*.004,time*.006)).a;',
    ' for(int k=0;k<2;k++){float ph=fract(time/Tp+float(k)*.5+nz*.45);float f0=Rr*(1.-ph)+(nzB-.5)*2.4;float ww=.45+1.3*(1.-clamp(f0/Rr,0.,1.));',
    '  float band=1.-smoothstep(0.,ww,abs(wd-f0));float trail=step(f0,wd)*(1.-smoothstep(f0+1.,f0+5.5,wd))*.5;',
    '  fo=max(fo,(band*1.1+trail)*smoothstep(.12,.55,nz2*.85+band*.45)*smoothstep(.18,.55,nzB+.12*sin(p.x*.21+p.y*.17+float(k)*2.))*(1.-ph*.3));}',
    ' float edge=1.-smoothstep(.4,2.2+1.2*sin(time*.9+nz*6.),wd);fo=max(fo,edge*smoothstep(.1,.5,nz2+.3));',
    ' fo=max(fo,stc*(1.-smoothstep(0.,3.2,wd))*smoothstep(.42,.78,nz2+.32*sin(time*3.1+p.x*.7+p.y*.5)));',
    ' fo=clamp(fo*(.85+wind*.7)*nearC,0.,1.);',
    ' vec3 fcol=mix(vec3(.72,.9,.95),vec3(1.),smoothstep(.35,.9,fo));',
    ' c2=mix(c2,fcol*(.78+.28*nd2),fo*.93);',
    ' c2*=bright;',
    ' col=mix(col,c2,vZn*on);',
    '}',
    'if(on>0.001){float rg=0.;',
    ' for(int i=0;i<8;i++){vec4 r=rings[i];float age=time-r.z;if(age<0.||age>2.4)continue;float dd=distance(p,r.xy);float rad=.15+age*(.9+.7*r.w);',
    '  rg+=(1.-smoothstep(0.,.07+age*.05,abs(dd-rad)))*(1.-age/2.4)*min(r.w,1.2);',
    '  rg+=(1.-smoothstep(0.,.05+age*.04,abs(dd-rad*.62)))*(1.-age/2.4)*.5*min(r.w,1.);}',
    ' if(rain>.02&&dist<60.){vec2 ce=floor(p*1.4);float hh=fract(sin(dot(ce,vec2(12.9898,78.233)))*43758.5453);float tt=fract(time*.9+hh);',
    '  vec2 cc=(ce+.5+vec2(fract(hh*7.13)-.5,fract(hh*13.7)-.5)*.6)/1.4;float dd2=distance(p,cc);',
    '  rg+=step(hh,rain*.85)*(1.-smoothstep(0.,.04,abs(dd2-tt*.42)))*(1.-tt)*.9;}',
    ' col=mix(col,vec3(.93,.98,1.),clamp(rg,0.,1.)*.85*nearC);}'
  ].join('\n');

  function patchSea(st) {
    var sc = st.sc, mesh = sc.getMeshByName('seaWaves'), M0 = mesh && mesh.material;
    if (!M0 || !M0._shaderPath || !M0._shaderPath.vertexSource) return false;
    var vs = M0._shaderPath.vertexSource, fs = M0._shaderPath.fragmentSource;
    var vAnchor = vs.indexOf('vec3 d=vec3(0.);'), fAnchor = fs.indexOf('float fg=clamp(');
    if (vAnchor < 0 || fAnchor < 0 || vs.indexOf('void main(){') < 0) { console.warn('[water] шейдер моря не распознан — оставлен прежний'); return false; }
    vs = vs.replace('void main(){', VS_ADD_DECL + 'void main(){').replace('vec3 d=vec3(0.);', VS_ADD + '\nvec3 d=vec3(0.);');
    fs = fs.replace('void main(){', FS_ADD_DECL + 'void main(){'); fAnchor = fs.indexOf('float fg=clamp(');
    fs = fs.slice(0, fAnchor) + FS_ADD + '\n' + fs.slice(fAnchor);
    var Jb = J(), M = new Jb.SM('seaShore', sc, { vertexSource: vs, fragmentSource: fs }, {
      attributes: ['position'],
      uniforms: ['viewProjection', 'cameraPosition', 'center', 'time', 'shoreRect', 'zoneRect', 'zoneAll', 'wind', 'rain', 'sunny', 'bright', 'rings', 'on'],
      samplers: ['detailTex', 'foamTex', 'shoreTex']
    });
    M.backFaceCulling = false;
    var tx = M0._textures || {}; if (tx.detailTex) M.setTexture('detailTex', tx.detailTex); if (tx.foamTex) M.setTexture('foamTex', tx.foamTex);
    M.setTexture('shoreTex', st.tex);
    st.sea = { mesh: mesh, orig: M0, mat: M, foam: tx.foamTex };
    return true;
  }

  /* ---------- 3. полоса прибоя на песке ---------- */
  var SW_VS = ['precision highp float;attribute vec3 position;attribute vec2 sd;uniform mat4 viewProjection;varying vec2 vS;varying vec2 vP;',
    'void main(){vS=sd;vP=position.xz;gl_Position=viewProjection*vec4(position,1.);}'].join('\n');
  var SW_FS = ['precision highp float;uniform float time;uniform float wind;uniform float bright;uniform sampler2D foamTex;varying vec2 vS;varying vec2 vP;',
    'void main(){float dl=vS.x;',
    ' float nz=texture2D(foamTex,vP/7.+vec2(time*.01,-time*.012)).a,nz2=texture2D(foamTex,vP/2.8+vec2(-time*.02,time*.016)).a;',
    ' float cyc=time*(.8+wind*.25)+nz*2.4;float s=.5+.5*sin(cyc);float run=.25+(1.1+wind*2.)*s*s;',
    ' float wetMax=run+.6+(1.3+wind*1.6)*.55;',
    ' float wet=(1.-smoothstep(run*.6,wetMax,dl))*.62;',
    ' float edgeF=1.-smoothstep(0.,.32+.25*nz,abs(dl-run));',
    ' float recede=step(0.,-cos(cyc));',
    ' float lace=step(dl,run)*smoothstep(.45,.8,nz2+.15)*(.55+.45*recede);',
    ' float fo=clamp(edgeF*smoothstep(.2,.6,nz2+.3)+lace*.75,0.,1.)*(1.-smoothstep(run,run+.4,dl));',
    ' vec3 wc=vec3(.50,.42,.28);vec3 fc=vec3(.97,.99,1.);',
    ' float film=step(dl,run)*.25;',
    ' vec3 c=mix(wc,vec3(.55,.82,.82),film/.25*.6);c=mix(c,fc,fo);',
    ' float a=max(max(wet,film),fo*.95);',
    ' gl_FragColor=vec4(c*bright,a);}'].join('\n');
  function buildSwash(st) {
    if (st.swash) { st.swash.dispose(); st.swash = null; }
    var M = st.mask, Jb = J(); if (!M || !Jb) return;
    var step = 2, P = [], SD = [], I = [], idx = new Int32Array((N / step + 1) * (N / step + 1)).fill(-1), GN = N / step + 1;
    function vid(gi, gj) {
      var k = gj * GN + gi; if (idx[k] >= 0) return idx[k];
      var i = Math.min(N - 1, gi * step), j = Math.min(N - 1, gj * step), c = j * N + i, h = M.land[c] ? M.H[c] : -.6;
      var x = M.x0 + gi * step * CELL, z = M.z0 + gj * step * CELL;
      P.push(x, Math.max(h, -.9) + .04, z); SD.push(M.land[c] ? M.dL[c] * CELL : 0, M.T[c] === 2 ? 1 : 0);
      return (idx[k] = P.length / 3 - 1);
    }
    for (var gj = 0; gj < GN - 1; gj++) for (var gi = 0; gi < GN - 1; gi++) {
      // только целые клетки песка у воды: без «занавесок» на стыке со стенками и пирсами
      var ok = true, near = false, hmin = 1e9, hmax = -1e9;
      for (var dj = 0; dj <= 1 && ok; dj++) for (var di = 0; di <= 1 && ok; di++) { var cc = Math.min(N - 1, (gj + dj) * step) * N + Math.min(N - 1, (gi + di) * step);
        if (!M.land[cc] || M.T[cc] !== 1) ok = false; else { if (M.dL[cc] * CELL < 6) near = true; hmin = Math.min(hmin, M.H[cc]); hmax = Math.max(hmax, M.H[cc]); } }
      if (!ok || !near || hmax - hmin > .5) continue;
      if (!api.inZone(M.x0 + gi * step * CELL, M.z0 + gj * step * CELL)) continue;
      var a = vid(gi, gj), b = vid(gi + 1, gj), q = vid(gi + 1, gj + 1), d = vid(gi, gj + 1);
      I.push(a, q, b, a, d, q);
    }
    if (!I.length) return;
    var m = new Jb.Mesh('sev-swash', st.sc), vd = new Jb.VD(); vd.positions = P; vd.indices = I; vd.applyToMesh(m, false);
    m.setVerticesData('sd', new Float32Array(SD), false, 2);
    if (!st.swMat) {
      st.swMat = new Jb.SM('sevSwash', st.sc, { vertexSource: SW_VS, fragmentSource: SW_FS }, { attributes: ['position', 'sd'], uniforms: ['viewProjection', 'time', 'wind', 'bright'], samplers: ['foamTex'], needAlphaBlending: true });
      st.swMat.backFaceCulling = false; st.swMat.zOffset = -4; st.swMat.disableDepthWrite = true;
      if (st.sea && st.sea.foam) st.swMat.setTexture('foamTex', st.sea.foam);
    }
    m.material = st.swMat; m.isPickable = false; m.receiveShadows = false; m.freezeWorldMatrix(); m.alphaIndex = 5;
    st.swash = m; api.stats.swashTris = I.length / 3;
  }

  /* ---------- 4. камни тестового пляжа ---------- */
  function testRocks(st) {
    if (st.rocks || api.level < 1) return; st.rocks = [];
    var Jb = J(), sc = st.sc, m = new Jb.Mat('sevRockMat', sc); m.diffuseColor = Jb.C3.FromHexString('#8f8b84'); m.specularColor = new Jb.C3(.08, .08, .08);
    var g = G(), obs = [g.world && g.world.ctx && g.world.ctx.obstacles, g.player && g.player.obstacles].filter(function (o, i, A) { return o && A.indexOf(o) === i; });
    [[-60, 864, 1.4], [-48, 866.5, .8], [-30, 863, 1.0], [40, 866, 1.2], [58, 864.5, .7], [150, 865, 1.5], [168, 867, .9], [210, 863.5, 1.1], [250, 866, .8]].forEach(function (r, i) {
      var s = Jb.MB.CreateSphere('sev-test-rock-' + i, { diameter: 1, segments: 6 }, sc);
      s.scaling.set(r[2] * 1.4, r[2] * .7, r[2]); s.rotation.y = i * 1.3; s.position.set(r[0], -.25 + r[2] * .12, r[1]); s.material = m; s.receiveShadows = true;
      obs.forEach(function (o) { try { o.circle(r[0], r[1], r[2] * .65); } catch (e) { } });
      st.rocks.push(s);
    });
  }

  /* ---------- 5. лисёнок в воде ---------- */
  var RB = [], rbI = 0; for (var i = 0; i < 8; i++) RB.push(1e6, 1e6, -100, 0);
  api.ring = function (x, z, amp) { var t = S ? S.t : 0; RB[rbI * 4] = x; RB[rbI * 4 + 1] = z; RB[rbI * 4 + 2] = t; RB[rbI * 4 + 3] = amp || 1; rbI = (rbI + 1) % 8; };
  var drops = [];
  function splash(st, x, y, z, n, up, spread) {
    var Jb = J(); if (!st.dropMat) { st.dropMat = new Jb.Mat('sevDrop', st.sc); st.dropMat.diffuseColor = Jb.C3.FromHexString('#e8fbff'); st.dropMat.emissiveColor = Jb.C3.FromHexString('#9fdff0'); st.dropMat.alpha = .85; }
    for (var k = 0; k < n; k++) {
      var d = drops.filter(function (q) { return !q.on; })[0];
      if (!d) { if (drops.length >= 18) return; var m = Jb.MB.CreateSphere('sev-drop', { diameter: .12, segments: 3 }, st.sc); m.material = st.dropMat; m.isPickable = false; d = { m: m }; drops.push(d); }
      var a = Math.random() * 6.283; d.on = true; d.m.setEnabled(true); d.m.position.set(x + Math.cos(a) * spread, y, z + Math.sin(a) * spread);
      d.vx = Math.cos(a) * (.8 + Math.random() * 1.2); d.vz = Math.sin(a) * (.8 + Math.random() * 1.2); d.vy = up * (.6 + Math.random() * .6); d.s = .6 + Math.random() * .7;
    }
  }
  function updDrops(dt) { drops.forEach(function (d) { if (!d.on) return; d.vy -= 9.8 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt; d.m.scaling.setAll(d.s); if (d.m.position.y < -1.1) { d.on = false; d.m.setEnabled(false); if (S && Math.random() < .5) api.ring(d.m.position.x, d.m.position.z, .35); } }); }
  function foxWater(st, dt) {
    var g = st.g, P = g.player && g.player.position; if (!P) return;
    var F = window.__sevVehicleStore; if (F && F.riding) { st.wasWet = false; return; }
    var sh = api.shoreAt(P.x, P.z), atm = st.atm, run = .25 + (1.1 + atm.wind * 2) * Math.pow(.5 + .5 * Math.sin(st.t * (.8 + atm.wind * .25)), 2);
    var swim = g.player._swimming || P.y < -.45, shallow = sh && !sh.water && sh.type === 'sand' && sh.toWater < run && api.inZone(P.x, P.z);
    var wet = swim || shallow || (sh && sh.water && P.y < .3);
    var v = g.player.velocity ? Math.hypot(g.player.velocity.x, g.player.velocity.z) : 0;
    st.rAcc = (st.rAcc || 0) + dt;
    if (wet) {
      var every = v > 6 ? .18 : v > .6 ? .32 : 1.3;
      if (st.rAcc > every) { st.rAcc = 0; api.ring(P.x, P.z, v > 6 ? 1.3 : v > .6 ? .9 : .5); if (v > 3) splash(st, P.x, Math.max(P.y, -.9) + .1, P.z, v > 6 ? 4 : 2, v > 6 ? 3.2 : 2.2, .35); }
      st.wetT = 2.2;
    } else if (st.wasWet && st.wetT > 0) { // выходит из воды — капли
      st.wetT -= dt; st.dAcc = (st.dAcc || 0) + dt; if (st.dAcc > .12) { st.dAcc = 0; splash(st, P.x, P.y + .9, P.z, 1, .2, .3); }
    }
    if (wet && !st.wasWet) { splash(st, P.x, Math.max(P.y, -.9) + .1, P.z, 5, 2.6, .3); api.ring(P.x, P.z, 1.4); }
    st.wasWet = wet || st.wetT > 0;
  }

  /* ---------- 6. кадр ---------- */
  function lightK(sc) { var s = 0, h = 0; sc.lights.forEach(function (l) { if (!l.isEnabled()) return; var k = l.getClassName(); if (k === 'DirectionalLight') s = Math.max(s, l.intensity); if (k === 'HemisphericLight') h = Math.max(h, l.intensity); }); return Math.max(.22, Math.min(1.1, (s * .75 + h * .9) / 1.05)); }
  function tick(st) {
    var sc = st.sc, eng = sc.getEngine(), dt = Math.min(.1, eng.getDeltaTime() / 1000), cam = sc.activeCamera, g = st.g, P = g.player && g.player.position;
    if (!cam || !P) return;
    var wv = window.__sevWave; st.t = wv && wv.on ? wv.t : st.t + dt;
    var cur = window.__sevAtmCur ? window.__sevAtmCur() : null;
    st.atm = { wind: cur ? cur.wind : .3, rain: cur ? cur.rain : 0, sunny: cur ? Math.max(0, 1 - cur.cl) * (cur.lt || 1) : 1 };
    if (!st.ltT || st.t - st.ltT > 1) { st.ltT = st.t; st.bright = lightK(sc); }
    var on = api.level > 0 ? 1 : 0;
    if (on && st.sea && st.sea.mesh.material !== st.sea.mat) st.sea.mesh.material = st.sea.mat;
    if (!on && st.sea && st.sea.mesh.material !== st.sea.orig) st.sea.mesh.material = st.sea.orig;
    // окно береговой карты следует за игроком (нужно и траве, и рыбалке — строим всегда)
    var c = st.mask; if (!c || Math.abs(P.x - (c.x0 + W / 2)) > 110 || Math.abs(P.z - (c.z0 + W / 2)) > 110 || st.dirty) { st.dirty = false; try { buildMask(st, P.x, P.z); } catch (e) { console.error('[water] mask', e); } }
    if (!on) { if (st.swash) st.swash.setEnabled(false); return; }
    if (st.swash) st.swash.setEnabled(true);
    var M = st.sea && st.sea.mat;
    if (M) {
      var cp = cam.globalPosition || cam.position;
      M.setFloat('time', st.t); M.setVector3('center', cp); M.setVector3('cameraPosition', cp);
      M.setVector4('shoreRect', v4(st.rect[0], st.rect[1], st.rect[2], st.rect[3])); M.setVector4('zoneRect', v4(TEST.x0, TEST.z0, TEST.x1, TEST.z1)); M.setFloat('zoneAll', api.level === 2 ? 1 : 0);
      M.setFloat('wind', st.atm.wind); M.setFloat('rain', st.atm.rain); M.setFloat('sunny', st.atm.sunny); M.setFloat('bright', st.bright); M.setFloat('on', 1); M.setArray4('rings', RB);
    }
    if (st.swMat) { st.swMat.setFloat('time', st.t); st.swMat.setFloat('wind', st.atm.wind); st.swMat.setFloat('bright', st.bright); }
    foxWater(st, dt); updDrops(dt);
  }
  function v4(a, b, c, d) { return { x: a, y: b, z: c, w: d }; }

  function setup(g) {
    var Jb = J(); if (!Jb || !Jb.SM || !Jb.DT) return null;
    var sc = g.scene, tex = new Jb.DT('sevShoreTex', { width: N, height: N }, sc, false, 2);
    tex.wrapU = tex.wrapV = 0; // clamp
    var st = { g: g, sc: sc, tex: tex, ctx: tex.getContext(), t: 0, rect: [1e6, 1e6, 1, 1], atm: { wind: .3, rain: 0, sunny: 1 }, bright: 1 };
    if (!patchSea(st)) console.warn('[water] море без новой отрисовки');
    testRocks(st);
    sc.onBeforeRenderObservable.add(function () { try { tick(st); } catch (e) { console.error('[water]', e); } });
    sc.onDisposeObservable.add(function () { if (S === st) S = null; drops = []; });
    return st;
  }
  api.setLevel = function (lv) { api.level = lv; try { localStorage.setItem('sevwater', String(lv)); } catch (e) { } if (S) { S.dirty = true; if (lv >= 1) testRocks(S); } };

  function addSetting() {
    var box = document.querySelector('.sevsave') || document.querySelector('.splash__pb'); if (!box || document.getElementById('sevWaterSet')) return;
    var d = document.createElement('div'); d.id = 'sevWaterSet'; d.style.cssText = 'margin:8px 0 4px;font:800 14px Nunito,Arial,sans-serif;display:flex;gap:6px;align-items:center;flex-wrap:wrap';
    d.innerHTML = '<span>🌊 Новая вода:</span>' + ['Выкл', 'Тестовый пляж', 'Везде'].map(function (t, i) { return '<button type="button" data-lv="' + i + '" style="padding:6px 12px;border-radius:999px;border:2px solid #fff;font:800 13px Nunito,Arial;color:#fff;background:' + (api.level === i ? 'linear-gradient(180deg,#ffd84a,#f2a600)' : 'linear-gradient(180deg,#7fd6ff,#1f86e6 60%,#0d5bb8)') + '">' + t + '</button>'; }).join('');
    d.addEventListener('click', function (e) { var b = e.target.closest('button[data-lv]'); if (!b) return; api.setLevel(+b.dataset.lv); d.remove(); addSetting(); });
    box.appendChild(d);
  }
  setInterval(addSetting, 1500);

  var asked = /[?&]watertest\b/.test(location.search), moved = false;
  setInterval(function () {
    var g = G(); if (!g || !g.scene || g.scene.isDisposed || !g.def || g.def.id !== 'pobedy' || !J() || !g.scene.getMeshByName('seaWaves')) return;
    if (S && S.sc === g.scene) return;
    S = setup(g); api.state = S;
    if (asked && !moved && g.player) { moved = true; g.player.position.x = 100; g.player.position.z = 852; }
  }, 600);
})();
