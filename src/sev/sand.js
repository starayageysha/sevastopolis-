/* =====================================================================
   Севастополис — единый песок на всех пляжах (v186)
   Один переиспользуемый плагин материала (MaterialPluginBase из движка).
   Он дописывает расчёт песка в обычный StandardMaterial, поэтому
   сохраняются освещение, тени, туман и коллизии — меняется только цвет
   и микрорельеф поверхности.

   Слои: 1) основной золотистый цвет; 2) мелкое зерно; 3) крупные пятна
   (светлое золото → мёд → охра) без повторов (процедурный шум по мировым
   координатам); 4) рябь от ветра; 5) микрорельеф (возмущение нормали —
   рябь и зерно реально освещаются солнцем); 6) блёстки на солнце.
   Влажный песок у кромки берётся из береговой карты SevWater — переход
   плавный и точно по линии воды. Следы лап, жителей и колёс — отдельная
   текстура вокруг игрока, следы медленно затираются.

   Где работает:
   • все отдельные пляжные меши (пляж Парка Победы, пандус, песочница…);
   • вдоль ВСЕГО природного берега карты: полоса суши у воды (до ~11 м)
     с пологим рельефом получает песок с мягким переходом к траве.
   Настройка участков: SevSand.areas — [{x0,z0,x1,z1, tint:[r,g,b], scale,
   relief, wet}] или SevSand.register(mesh, {tint, scale, relief, wet}).
   Уровень: «Настройки» → «🏖️ Новый песок: Выкл/Вкл» (localStorage sevsand).
   ===================================================================== */
(function () {
  'use strict';
  var api = window.SevSand = { areas: [], stats: {} };
  var ON = 1; try { var sv = localStorage.getItem('sevsand'); if (sv != null) ON = +sv; } catch (e) { }
  api.on = ON;
  var BIGW = 1536, BIGN = 512, BIGC = BIGW / BIGN, BAND = 11;
  var FOOTW = 36, FOOTN = 512;
  var S = null;
  function G() { return window.__sevGame; }
  function J() { return window.__sevBJS; }

  var FRAG_DEF = [
    '#ifdef SEVSAND',
    'uniform sampler2D sandBig;uniform sampler2D sandFine;uniform sampler2D sandFoot;',
    'float sdH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float sdN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(sdH(i),sdH(i+vec2(1.,0.)),f.x),mix(sdH(i+vec2(0.,1.)),sdH(i+vec2(1.,1.)),f.x),f.y);}',
    'float sdF(vec2 p){return sdN(p)*.5+sdN(p*2.03+7.1)*.25+sdN(p*4.11+13.7)*.125+sdN(p*8.3+3.3)*.0625;}',
    'float sdRip(vec2 p){float w=sdF(p*.05)*9.;float r=sin(p.x*1.25+p.y*.45+w*2.4)*.5+.5;float m=smoothstep(.25,.75,sdN(p*.09+4.));return r*r*(.25+.75*m);}',
    '#endif'].join('\n');
  var FRAG_UPD = [
    '#ifdef SEVSAND',
    '{vec2 wp=vPositionW.xz;float amt=1.;',
    ' if(sandT.w>.5){vec2 bu=(wp-sandR.xy)/sandR.zw;float inb=step(0.,bu.x)*step(bu.x,1.)*step(0.,bu.y)*step(bu.y,1.);amt=texture2D(sandBig,bu).r*inb;}',
    ' amt*=sandE.z;',
    ' if(amt>.003){',
    '  vec2 sp=wp*sandP.x;',
    '  float big=sdF(sp*.045),mid=sdF(sp*.29+31.),fine=sdN(sp*2.7);',
    '  float grain=sdH(floor(wp*60.))*.55+sdH(floor(wp*150.)+3.)*.45;',
    '  vec3 c1=vec3(.97,.87,.65),c2=vec3(.93,.78,.53),c3=vec3(.86,.69,.45);',
    '  vec3 sc=mix(c1,c2,smoothstep(.32,.74,big));sc=mix(sc,c3,smoothstep(.6,.9,mid)*.5);',
    '  sc*=.9+grain*.16+fine*.06;sc*=sandT.rgb;',
    '  float wet=0.;vec2 fu=(wp-sandR2.xy)/sandR2.zw;',
    '  if(fu.x>0.&&fu.x<1.&&fu.y>0.&&fu.y<1.){vec4 fm=texture2D(sandFine,fu);wet=(1.-step(.002,fm.r))*(1.-smoothstep(.3,2.4+sandE.y,fm.g*8.));}',
    '  else{vec2 bu2=(wp-sandR.xy)/sandR.zw;wet=texture2D(sandBig,bu2).g;}',
    '  wet=clamp(wet*sandP.z,0.,1.);',
    '  sc=mix(sc,sc*vec3(.6,.55,.5),wet*.8);',
    '  vec2 ku=(wp-sandK.xy)/sandK.zw;float foot=0.;if(ku.x>0.&&ku.x<1.&&ku.y>0.&&ku.y<1.)foot=texture2D(sandFoot,ku).r;',
    '  sc*=1.-foot*.3;',
    '  vec3 Vd=normalize(vEyePosition.xyz-vPositionW);float tw=sdH(floor(wp*48.)+floor(Vd.xz*7.));',
    '  sc+=step(.9962,tw)*sandP.w*(1.-wet)*vec3(1.,.93,.75);',
    '  baseColor.rgb=mix(baseColor.rgb,sc,amt);',
    '  float e=.07,h0=sdRip(wp),hx=sdRip(wp+vec2(e,0.)),hz=sdRip(wp+vec2(0.,e));',
    '  float gx=sdN(wp*9.+1.)-sdN(wp*9.+vec2(1.13,1.)),gz=sdN(wp*9.+1.)-sdN(wp*9.+vec2(1.,1.13));',
    '  float fx=texture2D(sandFoot,ku+vec2(.002,0.)).r-foot,fz=texture2D(sandFoot,ku+vec2(0.,.002)).r-foot;',
    '  vec3 pert=vec3(-(hx-h0)/e*.32*sandP.y*(1.-wet)+gx*.35+fx*2.5,0.,-(hz-h0)/e*.32*sandP.y*(1.-wet)+gz*.35+fz*2.5);',
    '  normalW=normalize(normalW+pert*amt);',
    ' }}',
    '#endif'].join('\n');

  var Plugin = null;
  function makePluginClass() {
    var J0 = J(); if (!J0 || !J0.MPB) return null;
    return class SevSandPlugin extends J0.MPB {
      constructor(mat, cfg) { super(mat, 'SevSand', 210, { SEVSAND: false }, true, true); this.cfg = cfg || {}; }
      getClassName() { return 'SevSandPlugin'; }
      prepareDefines(defines) { defines.SEVSAND = !!(S && api.on); }
      getSamplers(samplers) { samplers.push('sandBig', 'sandFine', 'sandFoot'); }
      getUniforms() {
        return {
          ubo: [{ name: 'sandP', size: 4, type: 'vec4' }, { name: 'sandT', size: 4, type: 'vec4' }, { name: 'sandR', size: 4, type: 'vec4' }, { name: 'sandR2', size: 4, type: 'vec4' }, { name: 'sandK', size: 4, type: 'vec4' }, { name: 'sandE', size: 4, type: 'vec4' }],
          fragment: '#ifdef SEVSAND\nuniform vec4 sandP;uniform vec4 sandT;uniform vec4 sandR;uniform vec4 sandR2;uniform vec4 sandK;uniform vec4 sandE;\n#endif'
        };
      }
      bindForSubMesh(ubo) {
        if (!S) return; var c = this.cfg, t = c.tint || [1, 1, 1];
        ubo.updateFloat4('sandP', c.scale || 1, c.relief == null ? 1 : c.relief, c.wet == null ? 1 : c.wet, c.sparkle == null ? 1 : c.sparkle);
        ubo.updateFloat4('sandT', t[0], t[1], t[2], c.masked ? 1 : 0);
        ubo.updateFloat4('sandR', S.bigRect[0], S.bigRect[1], S.bigRect[2], S.bigRect[3]);
        var ws = window.SevWater && window.SevWater.state, r2 = ws && ws.rect ? ws.rect : [1e6, 1e6, 1, 1];
        ubo.updateFloat4('sandR2', r2[0], r2[1], r2[2], r2[3]);
        ubo.updateFloat4('sandK', S.footRect[0], S.footRect[1], FOOTW, FOOTW);
        ubo.updateFloat4('sandE', S.t, S.wind * 1.5, api.on ? 1 : 0, 0);
        ubo.setTexture('sandBig', S.bigTex); ubo.setTexture('sandFoot', S.footTex);
        ubo.setTexture('sandFine', ws && ws.tex ? ws.tex : S.bigTex);
      }
      getCustomCode(type) { return type === 'fragment' ? { CUSTOM_FRAGMENT_DEFINITIONS: FRAG_DEF, CUSTOM_FRAGMENT_UPDATE_DIFFUSE: FRAG_UPD } : null; }
    };
  }

  /* ---------- полоса песка вдоль берега (3 м/клетка, окно 1,5 км) ---------- */
  function buildBig(st, cx, cz) {
    var W = window.SevWater; if (!W || !W.computeMask) return;
    var t0 = performance.now(), M = W.computeMask(cx, cz, BIGW, BIGN); if (!M) return;
    var ctx = st.bigCtx, img = ctx.createImageData(BIGN, BIGN), D = img.data, N = BIGN, sand = new Float32Array(N * N);
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var c = j * N + i, o = ((N - 1 - j) * N + i) * 4, v = 0, wet = 0;
      if (M.land[c] && M.T[c] === 1 && M.H[c] < 3.2) { var d = M.dL[c] * BIGC; v = 1 - smooth(BAND - 5, BAND, d); wet = 1 - smooth(.5, 4, d); }
      v *= areaMult(M.x0 + (i + .5) * BIGC, M.z0 + (j + .5) * BIGC);
      sand[c] = v; D[o] = v * 255; D[o + 1] = wet * v * 255; D[o + 2] = 0; D[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); st.bigTex.update(true);
    st.big = { x0: M.x0, z0: M.z0, sand: sand }; st.bigRect = [M.x0, M.z0, BIGW, BIGW]; st.ver = (st.ver || 0) + 1;
    api.stats.bigMs = Math.round(performance.now() - t0);
  }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function areaMult(x, z) { for (var i = 0; i < api.areas.length; i++) { var A = api.areas[i]; if (x >= A.x0 && x < A.x1 && z >= A.z0 && z < A.z1 && A.off) return 0; } return 1; }
  api.isSand = function (x, z) { // для травы и следов
    if (!S) return false; if (S.sandMeshAt && S.sandMeshAt(x, z)) return true;
    var B = S.big; if (!B) return false; var i = Math.floor((x - B.x0) / BIGC), j = Math.floor((z - B.z0) / BIGC); if (i < 0 || j < 0 || i >= BIGN || j >= BIGN) return false;
    return B.sand[j * BIGN + i] > .35;
  };

  /* ---------- следы ---------- */
  function stampPaw(st, x, z, h, side, big) {
    var c = st.footCtx, px = (x - st.footRect[0]) / FOOTW * FOOTN, py = FOOTN - (z - st.footRect[1]) / FOOTW * FOOTN, k = FOOTN / FOOTW;
    c.save(); c.translate(px, py); c.rotate(h); c.translate(side * .11 * k, 0);
    c.fillStyle = 'rgba(255,255,255,.95)';
    var s = big ? 1.5 : 1;
    c.beginPath(); c.ellipse(0, 0, .055 * k * s, .07 * k * s, 0, 0, 7); c.fill();
    for (var t = -1; t <= 1; t++) { c.beginPath(); c.arc(t * .045 * k * s, -.085 * k * s, .022 * k * s, 0, 7); c.fill(); }
    c.restore(); st.footDirty = true;
  }
  function stampWheel(st, x, z, h, w) {
    var c = st.footCtx, k = FOOTN / FOOTW, px = (x - st.footRect[0]) * k, py = FOOTN - (z - st.footRect[1]) * k;
    c.save(); c.translate(px, py); c.rotate(h); c.fillStyle = 'rgba(255,255,255,.6)';
    [-1, 1].forEach(function (s) { c.fillRect(s * w * k - .09 * k, -.3 * k, .18 * k, .6 * k); }); c.restore(); st.footDirty = true;
  }
  function recenterFoot(st, x, z) {
    var nx = Math.round(x - FOOTW / 2), nz = Math.round(z - FOOTW / 2), dx = (nx - st.footRect[0]) / FOOTW * FOOTN, dz = (nz - st.footRect[1]) / FOOTW * FOOTN;
    var c = st.footCtx, tmp = st.tmpCv || (st.tmpCv = document.createElement('canvas')); tmp.width = tmp.height = FOOTN;
    var tc = tmp.getContext('2d'); tc.clearRect(0, 0, FOOTN, FOOTN); tc.drawImage(c.canvas, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, FOOTN, FOOTN); c.drawImage(tmp, -dx, dz);
    st.footRect = [nx, nz]; st.footDirty = true;
  }
  function footTick(st, dt) {
    var g = st.g, P = g.player && g.player.position; if (!P) return;
    if (Math.abs(P.x - (st.footRect[0] + FOOTW / 2)) > 9 || Math.abs(P.z - (st.footRect[1] + FOOTW / 2)) > 9) recenterFoot(st, P.x, P.z);
    var F = window.__sevVehicleStore, riding = F && F.riding, h = g.player.heading || 0;
    var walkers = [{ id: 'fox', x: P.x, z: P.z, y: P.y, h: h, riding: riding }];
    var M = window.SevNPC && window.SevNPC.manager;
    if (M && M.list) M.list.forEach(function (n) { if (n.vis === false || n._seated) return; if (Math.abs(n.x - P.x) < 16 && Math.abs(n.z - P.z) < 16) walkers.push({ id: n.id, x: n.x, z: n.z, y: n.y || 0, h: n.heading || 0 }); });
    walkers.forEach(function (w) {
      var L = st.lastStep[w.id]; if (!L) { st.lastStep[w.id] = { x: w.x, z: w.z, s: 1 }; return; }
      var d = Math.hypot(w.x - L.x, w.z - L.z); if (d < (w.riding ? .35 : .42)) return;
      if (d > 4) { L.x = w.x; L.z = w.z; return; }
      if (w.y < 1.4 && api.isSand(w.x, w.z)) { var hh = Math.atan2(w.x - L.x, w.z - L.z); if (w.riding) stampWheel(st, w.x, w.z, hh, .8); else { L.s = -L.s; stampPaw(st, w.x, w.z, hh, L.s, w.id === 'fox'); } }
      L.x = w.x; L.z = w.z;
    });
    st.fadeT = (st.fadeT || 0) + dt;
    if (st.fadeT > .6) { st.fadeT = 0; var c = st.footCtx; c.fillStyle = 'rgba(0,0,0,.035)'; c.fillRect(0, 0, FOOTN, FOOTN); st.footDirty = true; } // следы медленно затираются
    st.upT = (st.upT || 0) + dt; if (st.footDirty && st.upT > .2) { st.upT = 0; st.footDirty = false; st.footTex.update(true); }
  }

  /* ---------- подключение к материалам ---------- */
  var SAND_MESH = /^(shoreSand|shoreRamp|shoreWet|sandbox-sand|beach-sand|sev-beach)/;
  function attach(st) {
    var sc = st.sc, J0 = J(); st.plugins = [];
    // один общий материал для всех отдельных пляжных мешей (а не по текстуре на пляж)
    var sm = st.sandMat = new J0.Mat('sevSandMat', sc); sm.diffuseColor = new J0.C3(1, 1, 1); sm.specularColor = new J0.C3(.07, .06, .05); sm.specularPower = 24;
    st.plugins.push(new Plugin(sm, { scale: 1, relief: .7, wet: 1, sparkle: 1 }));
    st.sandMeshes = [];
    sc.meshes.forEach(function (m) {
      if (!SAND_MESH.test(m.name) || m.isAnInstance) return;
      m.metadata = m.metadata || {}; m.metadata.sevOrigMat = m.material; m.material = sm; st.sandMeshes.push(m);
    });
    // берег всей карты: материал суши получает «маскированный» песок у воды
    // coastPlain — равнина у набережных, capeLandM — мыс, coastLand — суша западного и южного побережья
    ['coastPlain', 'capeLandM', 'coastLand'].forEach(function (nm) {
      var cm = sc.getMaterialByName(nm); if (!cm || !cm.pluginManager && typeof cm.getClassName === 'function' && cm.getClassName() !== 'StandardMaterial' && cm.getClassName() !== 'PBRMaterial') return;
      try { if (cm.isFrozen) cm.unfreeze(); st.plugins.push(new Plugin(cm, { masked: true, scale: 1, relief: .6, wet: 1, sparkle: .8 })); if (nm === 'coastPlain') st.coastMat = cm; } catch (e) { console.warn('[sand]', nm, e); }
    });
    // участок под отдельным пляжным мешем — для следов и травы
    var boxes = st.sandMeshes.map(function (m) { var b = m.getBoundingInfo().boundingBox; return [b.minimumWorld.x, b.minimumWorld.z, b.maximumWorld.x, b.maximumWorld.z]; });
    st.sandMeshAt = function (x, z) { for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]) return true; } return false; };
    api.stats.meshes = st.sandMeshes.length; api.stats.plugins = st.plugins.length;
  }
  api.register = function (mesh, cfg) { if (!S || !Plugin) return null; var J0 = J(), m = new J0.Mat('sevSandMat-' + mesh.name, S.sc); m.diffuseColor = new J0.C3(1, 1, 1); m.specularColor = new J0.C3(.07, .06, .05); var p = new Plugin(m, cfg || {}); mesh.material = m; S.plugins.push(p); return p; };
  api.setOn = function (v) {
    api.on = v ? 1 : 0; try { localStorage.setItem('sevsand', String(api.on)); } catch (e) { }
    if (!S) return; S.sandMeshes.forEach(function (m) { m.material = api.on ? S.sandMat : (m.metadata.sevOrigMat || m.material); });
    S.plugins.forEach(function (p) { p.markAllDefinesAsDirty && p.markAllDefinesAsDirty(); });
  };

  function setup(g) {
    var J0 = J(); Plugin = Plugin || makePluginClass(); if (!Plugin || !J0.DT) { console.warn('[sand] плагин материалов недоступен — песок без изменений'); return null; }
    var sc = g.scene, big = new J0.DT('sevSandBig', { width: BIGN, height: BIGN }, sc, false, 2), foot = new J0.DT('sevSandFoot', { width: FOOTN, height: FOOTN }, sc, false, 2);
    big.wrapU = big.wrapV = 0; foot.wrapU = foot.wrapV = 0;
    var st = { g: g, sc: sc, bigTex: big, bigCtx: big.getContext(), footTex: foot, footCtx: foot.getContext(), bigRect: [1e6, 1e6, 1, 1], footRect: [0, 0], t: 0, wind: .3, lastStep: {} };
    st.footCtx.fillStyle = '#000'; st.footCtx.fillRect(0, 0, FOOTN, FOOTN); foot.update(true);
    st.bigCtx.fillStyle = '#000'; st.bigCtx.fillRect(0, 0, BIGN, BIGN); big.update(true);
    attach(st);
    if (!api.on) { S = st; api.setOn(0); }
    sc.onBeforeRenderObservable.add(function () {
      try {
        var dt = Math.min(.1, sc.getEngine().getDeltaTime() / 1000); st.t += dt;
        var c = window.__sevAtmCur && window.__sevAtmCur(); st.wind = c ? c.wind : .3;
        var P = g.player && g.player.position; if (!P) return;
        if (window.SevWater && window.SevWater.state && (!st.big || Math.abs(P.x - (st.bigRect[0] + BIGW / 2)) > 420 || Math.abs(P.z - (st.bigRect[1] + BIGW / 2)) > 420)) buildBig(st, P.x, P.z);
        if (api.on) footTick(st, dt);
      } catch (e) { console.error('[sand]', e); }
    });
    sc.onDisposeObservable.add(function () { if (S === st) S = null; });
    return st;
  }
  function addSetting() {
    var box = document.querySelector('.sevsave') || document.querySelector('.splash__pb'); if (!box || document.getElementById('sevSandSet')) return;
    var d = document.createElement('div'); d.id = 'sevSandSet'; d.style.cssText = 'margin:8px 0 4px;font:800 14px Nunito,Arial,sans-serif;display:flex;gap:6px;align-items:center;flex-wrap:wrap';
    d.innerHTML = '<span>🏖️ Новый песок:</span>' + ['Выкл', 'Вкл'].map(function (t, i) { return '<button type="button" data-v="' + i + '" style="padding:6px 12px;border-radius:999px;border:2px solid #fff;font:800 13px Nunito,Arial;color:#fff;background:' + (api.on === i ? 'linear-gradient(180deg,#ffd84a,#f2a600)' : 'linear-gradient(180deg,#7fd6ff,#1f86e6 60%,#0d5bb8)') + '">' + t + '</button>'; }).join('');
    d.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (!b) return; api.setOn(+b.dataset.v); d.remove(); addSetting(); });
    box.appendChild(d);
  }
  setInterval(addSetting, 1500);
  setInterval(function () {
    var g = G(); if (!g || !g.scene || g.scene.isDisposed || !J() || !g.def) return;
    if (S && S.sc === g.scene) return;
    if (g.def.id === 'pobedy' && !(window.SevWater && window.SevWater.state)) return; // ждём береговую карту
    S = setup(g); api.state = S;
  }, 700);
})();
