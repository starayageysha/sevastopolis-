/* ===== 3D-карта Крыма: рельеф, море с волнами, кораблики, свечение (WebGL2, без библиотек) ===== */
(function () {
  'use strict';
  if (window.__crimea3D) return;

  var DATA = window.__CRIMEA3D_DATA;
  var W = 0.9807, DD = 0.9354, MG = 0.05;                 /* размеры суши и поле вокруг */
  var WD = W * (1 + 2 * MG), DDD = DD * (1 + 2 * MG);     /* размеры всего поля с морем */
  var VS = 1.0;                                           /* вертикальный масштаб рельефа */
  var FOVY = 38 * Math.PI / 180;

  /* города: [u, v] на суше (0..1, север сверху), сторона подписи */
  var PINS = {
    sev: [0.0000, 0.6256, 't'], bal: [0.0216, 0.7060, 'b'], yal: [0.2837, 0.8255, 'b'], bah: [0.166, 0.574, 't'],
    sim: [0.335, 0.575, 't'], fe: [0.584, 0.822, 'b'], ke: [0.935, 0.902, 't']
  };
  function pinWorld(id) { var p = PINS[id]; return p ? [(p[0] - 0.5) * W, (p[1] - 0.5) * DD] : null; }

  var CSS = '' +
    '.map__gl{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none}' +
    '.map__gl:active{cursor:grabbing}' +
    '.map__box--3d{position:absolute!important;left:0!important;top:0!important;width:100%!important;height:100%!important;transform:none!important;pointer-events:none;will-change:auto!important;z-index:2}' +
    '.map__box--3d .pin{left:0!important;top:0!important;pointer-events:auto;will-change:transform;transition:opacity .25s;touch-action:none}' +
    '.map__box--3d .pin.is-occ{opacity:.42}' +
    '.map__box--3d .pin.is-off{opacity:0;pointer-events:none}' +
    '.map__box--3d .pin__label{transition:opacity .25s}.map__box--3d .pin--nolabel .pin__label{opacity:0}' +
    '.map__box--3d .pin__dot{box-shadow:0 0 0 3px rgba(255,236,150,.55),0 0 14px 4px rgba(255,214,90,.85),0 2px 4px #00000080}' +
    '.map__box--3d .pin--soon .pin__dot{box-shadow:0 0 10px 2px rgba(255,255,255,.55),0 2px 4px #00000080}' +
    '.map__box--3d .pin--city .pin__dot,.map__box--3d .pin--scene .pin__dot{animation:m3shine 1.9s ease-in-out infinite}' +
    '@keyframes m3shine{0%,100%{box-shadow:0 0 0 3px rgba(255,236,150,.55),0 0 12px 3px rgba(255,214,90,.8),0 2px 4px #00000080}50%{box-shadow:0 0 0 6px rgba(255,240,170,.35),0 0 26px 9px rgba(255,226,120,1),0 2px 4px #00000080}}' +
    '.map__box--3d .pin__label{font-weight:800;text-shadow:-1.5px 0 #fff,1.5px 0 #fff,0 -1.5px #fff,0 1.5px #fff,1px 1px #fff,-1px -1px #fff,1px -1px #fff,-1px 1px #fff,0 0 10px rgba(255,235,160,.9)}' +
    '.map3d__ctl{position:absolute;z-index:3;left:calc(12px + var(--safe-l,0px));bottom:calc(18px + var(--safe-b,0px));display:flex;flex-direction:column;gap:8px}' +
    '.map3d__ctl .wood{width:44px;padding:0;font-size:22px}' +
    '.map3d__ctl .wood[aria-pressed="false"]{opacity:.6}' +
    '.sheet-open .map3d__ctl{display:none}' +
    '.map3d__glow{position:absolute;inset:0;z-index:1;pointer-events:none;mix-blend-mode:screen;background:radial-gradient(ellipse 70% 55% at 50% 42%,rgba(255,240,190,.16),rgba(255,240,190,0) 70%),radial-gradient(ellipse 120% 90% at 50% 50%,rgba(255,255,255,0) 60%,rgba(20,60,120,.18) 100%)}';

  /* ---------- математика ---------- */
  function persp(f, a, n, fa, o) { var t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); o[0] = t / a; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 0; o[5] = t; o[6] = 0; o[7] = 0; o[8] = 0; o[9] = 0; o[10] = (fa + n) * nf; o[11] = -1; o[12] = 0; o[13] = 0; o[14] = 2 * fa * n * nf; o[15] = 0; return o; }
  function lookAt(e, c, o) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], zl = 1 / Math.hypot(zx, zy, zz); zx *= zl; zy *= zl; zz *= zl;
    var xx = zz, xy = 0, xz = -zx, xl = 1 / (Math.hypot(xx, xz) || 1); xx *= xl; xz *= xl;            /* up = (0,1,0) */
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1; return o;
  }
  function mul(a, b, o) {
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  /* матрица модели: сдвиг * Ry(yaw) * Rz(pitch) * Rx(roll) * масштаб */
  function model(o, x, y, z, yaw, pitch, roll, s) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    /* Rz(pitch)*Rx(roll) */
    var a00 = cp, a01 = -sp * cr, a02 = sp * sr, a10 = sp, a11 = cp * cr, a12 = -cp * sr, a20 = 0, a21 = sr, a22 = cr;
    /* Ry*(...) */
    var m00 = cy * a00 + sy * a20, m01 = cy * a01 + sy * a21, m02 = cy * a02 + sy * a22;
    var m10 = a10, m11 = a11, m12 = a12;
    var m20 = -sy * a00 + cy * a20, m21 = -sy * a01 + cy * a21, m22 = -sy * a02 + cy * a22;
    o[0] = m00 * s; o[1] = m10 * s; o[2] = m20 * s; o[3] = 0; o[4] = m01 * s; o[5] = m11 * s; o[6] = m21 * s; o[7] = 0; o[8] = m02 * s; o[9] = m12 * s; o[10] = m22 * s; o[11] = 0; o[12] = x; o[13] = y; o[14] = z; o[15] = 1; return o;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255, 1]; }

  /* ---------- шейдеры ---------- */
  var HEAD = '#version 300 es\nprecision highp float;\n';
  var COMMON = 'uniform mat4 uVP;uniform vec3 uCam;uniform float uT;uniform vec2 uDom;uniform float uVS;uniform vec3 uSun;uniform vec3 uHaze;\n';

  var TERRAIN_VS = HEAD + COMMON + 'uniform sampler2D uH;in vec2 aUV;out vec2 vUV;out vec3 vW;\n' +
    'void main(){float h=textureLod(uH,aUV,0.).r*uVS;vec3 p=vec3((aUV.x-.5)*uDom.x,h,(aUV.y-.5)*uDom.y);vW=p;vUV=aUV;gl_Position=uVP*vec4(p,1.);}';

  var TERRAIN_FS = HEAD + COMMON + 'uniform sampler2D uH;uniform sampler2D uC;in vec2 vUV;in vec3 vW;out vec4 o;\n' +
    'float H(vec2 uv){return textureLod(uH,uv,0.).r*uVS;}\n' +
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n' +
    'void main(){\n' +
    ' float e=1.7/1024.;\n' +
    ' float hE=H(vUV+vec2(e,0.)),hW=H(vUV-vec2(e,0.)),hS=H(vUV+vec2(0.,e)),hN=H(vUV-vec2(0.,e));\n' +
    ' vec3 n=normalize(vec3(-(hE-hW)/(2.*e*uDom.x),1.,-(hS-hN)/(2.*e*uDom.y)));\n' +
    ' vec3 L=normalize(uSun);\n' +
    ' float sh=1.;\n' +
    ' for(int i=1;i<=9;i++){float t=.004*float(i)+.0034*float(i)*float(i)*.5;vec3 p=vW+L*t;vec2 uv=p.xz/uDom+.5;float hs=H(uv);float d=hs-p.y;sh=min(sh,1.-smoothstep(.0,.014,d));}\n' +
    ' sh=mix(.55,1.,sh);\n' +
    ' vec3 alb=texture(uC,vUV).rgb;\n' +
    ' float ndl=dot(n,L);float rel=ndl-L.y;\n' +
    ' float lit=.93+.9*rel;lit=clamp(lit,.5,1.5);\n' +
    ' lit*=mix(.72,1.,sh);\n' +
    ' vec3 col=alb*lit*vec3(1.05,1.0,.95);float lm=dot(col,vec3(.3,.55,.15));col=mix(vec3(lm),col,1.18);\n' +
    ' vec3 V=normalize(uCam-vW);vec3 Hh=normalize(L+V);\n' +
    ' float sp=pow(max(dot(n,Hh),0.),48.);col+=sp*.16*sh*vec3(1.,.93,.78);\n' +
    ' float tw=hash(floor(vUV*1400.));float tws=step(.992,tw)*(.5+.5*sin(uT*2.6+tw*60.));\n' +
    ' col+=tws*pow(max(dot(n,Hh),0.),6.)*.9*vec3(1.,.95,.8);\n' +
    ' float s=dot(vW.xz,vec2(.82,.57));float ph=fract(uT*.085)*3.6-1.8;float band=exp(-pow((s-ph)/.1,2.));\n' +
    ' col+=band*.30*vec3(1.,.93,.7)*(.45+dot(alb,vec3(.33)));\n' +
    ' float dpt=max(-vW.y,0.);col=mix(col,uHaze*.97,smoothstep(.004,.052,dpt));\n' +
    ' float dist=length(vW-uCam);col=mix(col,uHaze,smoothstep(3.,6.,dist));\n' +
    ' o=vec4(col,1.);}';

  var WATER_VS = HEAD + COMMON + 'in vec2 aP;out vec3 vW;\n' +
    'void main(){vec2 p=aP;float w=.0011*sin(p.x*9.+uT*1.1)+.0009*sin(p.y*11.-uT*.9+p.x*3.)+.0006*sin((p.x+p.y)*17.+uT*1.6);vW=vec3(p.x,w,p.y);gl_Position=uVP*vec4(vW,1.);}';

  var WATER_FS = HEAD + COMMON + 'uniform sampler2D uH;uniform vec4 uRip[4];in vec3 vW;out vec4 o;\n' +
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n' +
    'float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}\n' +
    'vec2 wv(vec2 p,vec2 d,float k,float sp,float a){float ph=dot(p,d)*k-uT*sp;return d*k*a*cos(ph);}\n' +
    'void main(){\n' +
    ' vec2 p0=vW.xz;vec2 p=p0+.014*vec2(nz(p0*9.+uT*.12),nz(p0*9.+7.-uT*.1))+.005*vec2(nz(p0*26.-uT*.2),nz(p0*26.+3.+uT*.17));\n' +
    ' vec2 uv=clamp(p0/uDom+.5,0.,1.);\n' +
    ' float dep=-textureLod(uH,uv,0.).r*uVS;\n' +
    ' dep=max(dep,0.);\n' +
    ' vec2 g=vec2(0.);\n' +
    ' g+=wv(p,normalize(vec2(1.,.35)),34.,.9,.0016);g+=wv(p,normalize(vec2(.6,.8)),47.,1.05,.0012);\n' +
    ' g+=wv(p,normalize(vec2(-.4,1.)),58.,1.25,.0010);g+=wv(p,normalize(vec2(-.7,.55)),73.,1.4,.0008);\n' +
    ' g+=wv(p,normalize(vec2(.8,-.7)),97.,1.7,.0005);\n' +
    ' g+=wv(p,normalize(vec2(-.9,-.3)),160.,2.2,.00022);\n' +
    ' g+=(vec2(nz(p*150.+uT*.30),nz(p*150.-uT*.26+9.))-.5)*.045;\n' +
    ' vec4 R;float rf=0.;\n' +
    ' for(int i=0;i<4;i++){R=uRip[i];if(R.w>0.){float age=uT-R.z;if(age>0.&&age<3.2){vec2 dv=p-R.xy;float r=length(dv);float ring=exp(-pow((r-age*.16)/.014,2.))*exp(-age*1.1);g+=normalize(dv+1e-5)*ring*.9*cos((r-age*.16)*120.);rf+=ring;}}}\n' +
    ' vec3 n=normalize(vec3(-g.x,1.,-g.y));\n' +
    ' vec3 V=normalize(uCam-vW);vec3 L=normalize(uSun);\n' +
    ' float fr=.03+.97*pow(1.-max(dot(n,V),0.),4.);\n' +
    ' vec3 Rf=reflect(-V,n);\n' +
    ' vec3 sky=mix(vec3(.62,.82,.96),vec3(.35,.62,.92),clamp(Rf.y,0.,1.));\n' +
    ' float shT=exp(-dep*65.);\n' +
    ' vec3 deepC=vec3(.05,.36,.62),midC=vec3(.10,.60,.80),shC=vec3(.38,.93,.88);\n' +
    ' vec3 wc=mix(deepC,midC,exp(-dep*26.));wc=mix(wc,shC,shT);\n' +
    ' float pulse=.5+.5*sin(uT*1.3+dep*120.);\n' +
    ' wc+=shT*(.12+.14*pulse)*vec3(.25,1.,.95);\n' +
    ' float ringg=exp(-pow((dep-fract(uT*.10)*.075)/.007,2.))*(1.-fract(uT*.10))*smoothstep(.004,.012,dep);wc+=ringg*.35*vec3(.6,1.,1.);\n' +
    ' vec3 col=mix(wc,sky,fr*.7);\n' +
    ' float sp=pow(max(dot(Rf,L),0.),90.);col+=sp*.7*vec3(1.,.95,.78);\n' +
    ' col+=pow(max(dot(Rf,L),0.),12.)*.07*vec3(1.,.95,.8);\n' +
    ' vec2 gp=floor(p*380.);float gh=hash(gp);vec2 gf=fract(p*380.)-.5;float glit=step(.992,gh)*(.5+.5*sin(uT*3.4+gh*70.))*smoothstep(.5,.1,length(gf));\n' +
    ' col+=glit*pow(max(dot(Rf,L),0.),4.)*1.7*vec3(1.,.96,.82);\n' +
    ' float nzf=nz(p*60.+uT*.25);\n' +
    ' float band=.5+.5*sin(dep*250.-uT*1.8+nzf*3.2);\n' +
    ' float foam=(1.-smoothstep(.002,.016,dep))*smoothstep(.25,.85,band);\n' +
    ' foam+=(1.-smoothstep(.0,.0045,dep))*.9;\n' +
    ' float crest=smoothstep(.62,.9,nz(p*90.+vec2(uT*.4,-uT*.3)))*.16*smoothstep(.02,.06,dep);\n' +
    ' foam=clamp(foam+crest+rf*.9,0.,1.);\n' +
    ' col=mix(col,vec3(1.,1.,1.),foam*.92);\n' +
    ' float a=.80*(1.-exp(-dep*40.));\n' +
    ' a=max(a,foam*.92);a=max(a,fr*.5*step(.02,dep));\n' +
    ' float dist=length(vW-uCam);float fg=smoothstep(3.2,6.8,dist);col=mix(col,uHaze,fg);a=mix(a,1.,fg);\n' +
    ' o=vec4(col,a);}';

  var SHIP_VS = HEAD + COMMON + 'uniform mat4 uM;in vec3 aP;in vec3 aN;in vec4 aC;out vec3 vN;out vec4 vC;out vec3 vW;\n' +
    'void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;vC=aC;gl_Position=uVP*w;}';
  var SHIP_FS = HEAD + COMMON + 'uniform float uWake;uniform float uWA;in vec3 vN;in vec4 vC;in vec3 vW;out vec4 o;\n' +
    'void main(){\n' +
    ' if(uWake>.5){o=vec4(vC.rgb,vC.a*uWA);return;}\n' +
    ' vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;\n' +
    ' vec3 L=normalize(uSun);vec3 V=normalize(uCam-vW);float d=max(dot(n,L),0.);\n' +
    ' vec3 hemi=mix(vec3(.34,.44,.56),vec3(.86,.94,1.),n.y*.5+.5);\n' +
    ' vec3 col=vC.rgb*(hemi*.60+d*vec3(1.,.96,.88)*.78);\n' +
    ' col+=pow(max(dot(n,normalize(L+V)),0.),46.)*.30*vec3(1.,.97,.9);\n' +
    ' col+=pow(1.-max(dot(n,V),0.),3.)*.10*uHaze;\n' +
    ' float dist=length(vW-uCam);col=mix(col,uHaze,smoothstep(3.,6.,dist));\n' +
    ' o=vec4(col,1.);}';

  var SPARK_VS = HEAD + COMMON + 'uniform float uPx;in vec4 aS;out float vA;out float vS;\n' +
    'void main(){float s=aS.w;vec3 p=aS.xyz;p.y+=.010*sin(uT*.8+s*40.)+.012;p.x+=.012*sin(uT*.5+s*17.);p.z+=.012*cos(uT*.45+s*23.);\n' +
    ' vec4 c=uVP*vec4(p,1.);gl_Position=c;float tw=.5+.5*sin(uT*(1.8+s*2.4)+s*90.);vA=pow(tw,3.);vS=s;\n' +
    ' gl_PointSize=(7.+16.*fract(s*7.3))*uPx/ max(c.w,.3)*.9;}';
  var SPARK_FS = HEAD + 'in float vA;in float vS;out vec4 o;\n' +
    'void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;float core=exp(-r*r*7.);float cross_=exp(-abs(q.x)*38.)*exp(-abs(q.y)*5.)+exp(-abs(q.y)*38.)*exp(-abs(q.x)*5.);\n' +
    ' float a=(core+.7*cross_)*vA;if(a<.01)discard;vec3 c=mix(vec3(1.,.93,.62),vec3(.8,.96,1.),fract(vS*5.));o=vec4(c*a,a);}';

  var BEAM_VS = HEAD + COMMON + 'in vec3 aP;in vec2 aQ;in vec4 aK;out vec2 vQ;out vec4 vK;\n' +
    'void main(){vQ=aQ;vK=aK;gl_Position=uVP*vec4(aP,1.);}';
  var BEAM_FS = HEAD + 'uniform float uMode;uniform float uT;in vec2 vQ;in vec4 vK;out vec4 o;\n' +
    'void main(){float a;\n' +
    ' if(uMode<.5){float x=abs(vQ.x-.5)*2.;float core=exp(-x*x*5.);float f=pow(vQ.y,1.1);a=core*f*vK.a*2.4;}\n' +
    ' else{vec2 q=vQ-.5;float r=length(q)*2.;float ring=exp(-pow((r-(.55+.18*sin(uT*2.2)))/.12,2.));float disc=exp(-r*r*3.2);a=(ring*1.1+disc*.9)*vK.a*(1.-smoothstep(.85,1.,r))*1.4;}\n' +
    ' if(a<.004)discard;o=vec4(vK.rgb*a,a);}';

  /* ---------- строитель сетки корабликов ---------- */
  function Mesh() { this.v = []; }
  Mesh.prototype.tri = function (a, b, c, col) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    var P = [a, b, c];
    for (var i = 0; i < 3; i++) this.v.push(P[i][0], P[i][1], P[i][2], nx, ny, nz, col[0], col[1], col[2], col[3] === undefined ? 1 : col[3]);
  };
  Mesh.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
  Mesh.prototype.box = function (x, y, z, sx, sy, sz, col) {   /* x,y,z — центр основания */
    var x0 = x - sx / 2, x1 = x + sx / 2, y0 = y, y1 = y + sy, z0 = z - sz / 2, z1 = z + sz / 2;
    var A = [x0, y0, z0], B = [x1, y0, z0], C = [x1, y0, z1], D = [x0, y0, z1], E = [x0, y1, z0], F = [x1, y1, z0], G = [x1, y1, z1], Hh = [x0, y1, z1];
    this.quad(E, F, G, Hh, col); this.quad(A, B, F, E, col); this.quad(D, C, G, Hh, col); this.quad(A, D, Hh, E, col); this.quad(B, C, G, F, col);
  };
  /* корпус: набор сечений по длине; w — ширина, h — высота борта, bow — подъём носа */
  Mesh.prototype.hull = function (L, w, h, colSide, colDeck, opts) {
    opts = opts || {};
    var bw = opts.bowW === undefined ? 0.12 : opts.bowW, sw = opts.sternW === undefined ? 0.78 : opts.sternW, bot = opts.bot === undefined ? 0.5 : opts.bot, rise = opts.rise === undefined ? 0.18 : opts.rise, y0 = opts.y0 || 0;
    var st = [[-0.5, sw, 1], [-0.25, 1, 1], [0.2, 1, 1], [0.38, 0.72, 1.04], [0.5, bw, 1 + rise]];
    var T = [], B = [], i;
    for (i = 0; i < st.length; i++) {
      var x = st[i][0] * L, hw = st[i][1] * w / 2, yt = y0 + h * st[i][2];
      T.push([[x, yt, hw], [x, yt, -hw]]); B.push([[x, y0, hw * bot], [x, y0, -hw * bot]]);
    }
    for (i = 0; i < st.length - 1; i++) {
      this.quad(T[i][0], B[i][0], B[i + 1][0], T[i + 1][0], colSide);   /* левый борт */
      this.quad(T[i][1], T[i + 1][1], B[i + 1][1], B[i][1], colSide);   /* правый борт */
      this.quad(B[i][0], B[i][1], B[i + 1][1], B[i + 1][0], colSide);   /* днище */
      this.quad(T[i][0], T[i + 1][0], T[i + 1][1], T[i][1], colDeck);   /* палуба */
    }
    this.quad(T[0][0], T[0][1], B[0][1], B[0][0], colSide);             /* корма */
  };
  Mesh.prototype.ellipsoid = function (cx, cy, cz, rx, ry, rz, nu, nv, col) {
    var i, j, pts = [];
    for (j = 0; j <= nv; j++) { var th = Math.PI * j / nv, row = []; for (i = 0; i <= nu; i++) { var ph = 2 * Math.PI * i / nu; row.push([cx + rx * Math.cos(th), cy + ry * Math.sin(th) * Math.sin(ph), cz + rz * Math.sin(th) * Math.cos(ph)]); } pts.push(row); }
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) this.quad(pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i], col);
  };
  Mesh.prototype.flag = function (x, y, z, w, h) {   /* триколор, смотрит вдоль оси Z (двусторонний) */
    var cols = [[1, 1, 1, 1], [.1, .3, .75, 1], [.85, .12, .15, 1]];
    for (var i = 0; i < 3; i++) this.quad([x, y + h - h * i / 3, z], [x - w, y + h - h * i / 3, z], [x - w, y + h - h * (i + 1) / 3, z], [x, y + h - h * (i + 1) / 3, z], cols[i]);
  };

  var COLS = ['#e8553f', '#f2b134', '#3f8fd8', '#4fb36a', '#d8403a', '#9a5fc8', '#f08a3c'].map(hex);
  var HULLC = ['#8a5a2e', '#fffaf0', '#2f5f9e', '#6d3f1d'].map(hex);
  var CARGOH = ['#8a2a2a', '#244a7a', '#2d5a3d', '#3a3a44'].map(hex);
  var WHITE = hex('#fffaf0'), DARK = hex('#3a3f4a'), CREAM = hex('#fff6e0');
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k, 1]; }

  /* типы: L — длина (в мире), скорость, поворот */
  var TYPES = [
    { L: .075, sp: [.007, .011], turn: .7 }, { L: .066, sp: [.005, .008], turn: .8 }, { L: .074, sp: [.012, .018], turn: .8 }, { L: .088, sp: [.006, .009], turn: .7 },
    { L: .15, sp: [.004, .007], turn: .3 }, { L: .15, sp: [.0035, .006], turn: .3 }, { L: .14, sp: [.008, .013], turn: .35 }, { L: .13, sp: [.005, .008], turn: .35 }
  ];
  /* ===== v136: улучшенная графика корабликов: гладкие корпуса с ватерлинией, окна, мачты, паруса с пузом, контейнеры, пушки ===== */
  function _push(m, p, n, c) { m.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]); }
  Mesh.prototype.triS = function (a, b, c, na, nb, nc, ca, cb, cc) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * gx + gy * gy + gz * gz < 1e-20) return;
    if (gx * (na[0] + nb[0] + nc[0]) + gy * (na[1] + nb[1] + nc[1]) + gz * (na[2] + nb[2] + nc[2]) < 0) { var t = b; b = c; c = t; t = nb; nb = nc; nc = t; t = cb; cb = cc; cc = t; }
    _push(this, a, na, ca); _push(this, b, nb, cb); _push(this, c, nc, cc);
  };
  function _nrm(n) { var l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l]; }
  function _cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function _sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function _mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]; }
  /* сетка точек P[i][k] с гладкими нормалями; ref(p) — «наружу» для ориентации */
  Mesh.prototype.grid = function (P, C, ref) {
    var I = P.length, K = P[0].length, i, k, N = [];
    for (i = 0; i < I; i++) { N.push([]); for (k = 0; k < K; k++) {
      var du = _sub(P[Math.min(i + 1, I - 1)][k], P[Math.max(i - 1, 0)][k]), dk = _sub(P[i][Math.min(k + 1, K - 1)], P[i][Math.max(k - 1, 0)]);
      var n = _cross(du, dk), r = ref ? ref(P[i][k]) : null;
      if (Math.hypot(n[0], n[1], n[2]) < 1e-12) n = r || [0, 1, 0];
      else if (r && n[0] * r[0] + n[1] * r[1] + n[2] * r[2] < 0) n = [-n[0], -n[1], -n[2]];
      N[i].push(_nrm(n));
    } }
    for (i = 0; i < I - 1; i++) for (k = 0; k < K - 1; k++) {
      this.triS(P[i][k], P[i + 1][k], P[i + 1][k + 1], N[i][k], N[i + 1][k], N[i + 1][k + 1], C[i][k], C[i + 1][k], C[i + 1][k + 1]);
      this.triS(P[i][k], P[i + 1][k + 1], P[i][k + 1], N[i][k], N[i + 1][k + 1], N[i][k + 1], C[i][k], C[i + 1][k + 1], C[i][k + 1]);
    }
  };
  /* корпус с седловатостью, раскрывом бортов, ватерлинией и палубой */
  Mesh.prototype.hull2 = function (L, B, D, o) {
    var bw = o.bowW === undefined ? .1 : o.bowW, sw = o.sternW === undefined ? .8 : o.sternW, bot = o.bot === undefined ? .55 : o.bot, rise = o.rise === undefined ? .2 : o.rise, fl = o.flare === undefined ? .05 : o.flare;
    var side = o.side, K = { u: o.under || shade(side, .42), s: o.stripe || [.97, .96, .92, 1], h: side, r: o.rail || shade(side, 1.18), d: o.deck || hex('#b98a56') };
    var prof = [[0, 0, 'u'], [bot, .02, 'u'], [.86, .16, 'u'], [.91, .26, 'u'], [.91, .26, 's'], [.93, .31, 's'], [.93, .31, 'h'], [.98, .52, 'h'], [1, .80, 'h'], [1 + fl, .94, 'h'], [1 + fl, .94, 'r'], [1 + fl, 1, 'r'], [.95, 1, 'r'], [.93, 1, 'd'], [.5, 1.012, 'd'], [0, 1.02, 'd']];
    var n = prof.length, NU = 20, P = [], C = [], i, j;
    function Bf(u) { var w; if (u < .2) w = sw + (1 - sw) * Math.sin(u / .2 * Math.PI / 2); else if (u < .6) w = 1; else w = 1 - (1 - bw) * Math.pow((u - .6) / .4, 1.7); return w * B / 2; }
    function Dh(u) { return D * (1 + rise * Math.pow(Math.max(0, (u - .62) / .38), 2) + .06 * Math.pow(Math.max(0, (.22 - u) / .22), 2)); }
    function Yk(u) { return D * .55 * Math.pow(Math.max(0, (u - .72) / .28), 2.2) + D * .10 * Math.pow(Math.max(0, (.12 - u) / .12), 2); }
    for (i = 0; i <= NU; i++) {
      var u = i / NU, x = (u - .5) * L, bh = Bf(u), dh = Dh(u), yk = Yk(u), row = [], cr = [];
      for (j = n - 1; j >= 1; j--) { row.push([x, yk + (dh - yk) * prof[j][1], -bh * prof[j][0]]); cr.push(K[prof[j][2]]); }
      for (j = 0; j < n; j++) { row.push([x, yk + (dh - yk) * prof[j][1], bh * prof[j][0]]); cr.push(K[prof[j][2]]); }
      P.push(row); C.push(cr);
    }
    this.grid(P, C, function (p) { return [p[0] < -L * .49 ? -.3 : 0, p[1] - D * .45, p[2]]; });
    var ends = [[0, [-1, 0, 0]], [NU, [1, 0, 0]]];
    for (var e = 0; e < 2; e++) {
      var R = P[ends[e][0]], RC = C[ends[e][0]], nn = ends[e][1], cx = R[0][0], cy = D * .5;
      for (j = 0; j < R.length - 1; j++) this.triS([cx, cy, 0], R[j], R[j + 1], nn, nn, nn, K.h, RC[j], RC[j + 1]);
    }
  };
  Mesh.prototype.boxT = function (x, y, z, sx, sy, sz, col, top) {
    var x0 = x - sx / 2, x1 = x + sx / 2, y0 = y, y1 = y + sy, z0 = z - sz / 2, z1 = z + sz / 2;
    var A = [x0, y0, z0], Bq = [x1, y0, z0], Cc = [x1, y0, z1], Dd = [x0, y0, z1], E = [x0, y1, z0], F = [x1, y1, z0], G = [x1, y1, z1], Hh = [x0, y1, z1];
    this.quad(E, F, G, Hh, top || shade(col, 1.12)); this.quad(A, Bq, F, E, col); this.quad(Dd, Cc, G, Hh, col); this.quad(A, Dd, Hh, E, shade(col, .92)); this.quad(Bq, Cc, G, F, shade(col, .92));
  };
  Mesh.prototype.cyl = function (x, y, z, r, h, col, seg, rt, top) {
    seg = seg || 10; rt = rt === undefined ? r : rt; var s;
    for (s = 0; s < seg; s++) {
      var a0 = s / seg * 6.2832, a1 = (s + 1) / seg * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), sl = (r - rt) / (h || 1);
      var n0 = _nrm([c0, sl, s0]), n1 = _nrm([c1, sl, s1]);
      var p00 = [x + r * c0, y, z + r * s0], p01 = [x + r * c1, y, z + r * s1], p10 = [x + rt * c0, y + h, z + rt * s0], p11 = [x + rt * c1, y + h, z + rt * s1];
      this.triS(p00, p01, p11, n0, n1, n1, col, col, col); this.triS(p00, p11, p10, n0, n1, n0, col, col, col);
      if (rt > 0) this.triS([x, y + h, z], p10, p11, [0, 1, 0], [0, 1, 0], [0, 1, 0], top || col, top || col, top || col);
    }
  };
  Mesh.prototype.ell = function (cx, cy, cz, rx, ry, rz, nu, nv, col, col2) {
    var P = [], C = [], N = [], i, j;
    for (j = 0; j <= nv; j++) { var th = Math.PI * j / nv, row = [], cr = []; for (i = 0; i <= nu; i++) { var ph = 2 * Math.PI * i / nu; row.push([cx + rx * Math.cos(th), cy + ry * Math.sin(th) * Math.sin(ph), cz + rz * Math.sin(th) * Math.cos(ph)]); cr.push(_mix(col, col2 || col, Math.max(0, Math.sin(th) * Math.sin(ph)))); } P.push(row); C.push(cr); }
    this.grid(P, C, function (p) { return [(p[0] - cx) / (rx * rx), (p[1] - cy) / (ry * ry), (p[2] - cz) / (rz * rz)]; });
  };
  /* парус-треугольник с пузом (вдоль z) */
  Mesh.prototype.sail = function (A, Bp, Cp, belly, col) {
    var nu = 8, nv = 8, P = [], Cc = [], i, j;
    for (i = 0; i <= nu; i++) { var u = i / nu, row = [], cr = []; for (j = 0; j <= nv; j++) { var v = j / nv, bx = A[0] + (Bp[0] - A[0]) * v, by = A[1] + (Bp[1] - A[1]) * v; row.push([bx + (Cp[0] - bx) * u, by + (Cp[1] - by) * u, belly * Math.sin(Math.PI * v) * Math.pow(1 - u, .8) * (.4 + .6 * Math.sin(Math.PI * Math.min(1, u * 1.2 + .1)))]); cr.push(_mix(col, shade(col, .78), .35 * u + .25 * (1 - v))); } P.push(row); Cc.push(cr); }
    this.grid(P, Cc, function () { return [0, 0, 1]; });
  };
  Mesh.prototype.ribbon = function (x, y, z, sx, sz, hg, n, col) {   /* ряд окон по обоим бортам и впереди */
    var w = sx * .86 / n * .62, s, i;
    for (s = -1; s <= 1; s += 2) for (i = 0; i < n; i++) this.box(x - sx * .43 + (i + .5) * sx * .86 / n, y, z + s * sz / 2 * 1.01, w, hg, .002 * sx, col);
    this.box(x + sx / 2 * 1.01, y, z, .002 * sx, hg, sz * .7, col);
  };
  var GLASS = hex('#243b52'), GLASS2 = hex('#5aa6c8'), DECKG = hex('#6f7a82'), WOOD = hex('#b98a56'), STEEL = hex('#c9d0d6');
  function buildShip(type, k) {
    var m = new Mesh(), L = TYPES[type].L, c, h, i, r;
    if (type === 0) {   /* парусная яхта */
      c = pick(COLS); h = pick(HULLC); var hh = L * .10;
      m.hull2(L, L * .30, hh, { side: h, stripe: c, rail: shade(h, 1.25), deck: WOOD, bowW: .1, rise: .22 });
      m.boxT(-.05 * L, hh * .98, 0, L * .22, L * .045, L * .15, WHITE, [.9, .86, .78, 1]); m.ribbon(-.05 * L, hh + L * .02, 0, L * .20, L * .15, L * .018, 3, GLASS);
      m.cyl(.04 * L, hh * .95, 0, L * .0075, L * .70, [.22, .15, .08, 1], 6);
      m.box(-.16 * L, hh + L * .035, 0, L * .40, L * .009, L * .009, [.22, .15, .08, 1]);
      m.sail([.04 * L, hh + L * .045, 0], [-.34 * L, hh + L * .045, 0], [.04 * L, hh + L * .66, 0], L * .07, CREAM);
      m.sail([.40 * L, hh + L * .02, 0], [.07 * L, hh + L * .03, 0], [.05 * L, hh + L * .60, 0], -L * .05, shade(c, 1.05));
      m.tri([.04 * L, hh + L * .70, 0], [.04 * L, hh + L * .665, 0], [-.05 * L, hh + L * .685, 0], c);
    } else if (type === 1) {   /* рыбацкий катер */
      c = pick(COLS); var h1 = L * .11;
      m.hull2(L, L * .34, h1, { side: c, stripe: WHITE, deck: DECKG, bowW: .2, sternW: .85, bot: .6, rise: .3, flare: .08 });
      m.boxT(-.12 * L, h1 * .98, 0, L * .20, L * .13, L * .20, WHITE, shade(WHITE, .9)); m.ribbon(-.12 * L, h1 + L * .07, 0, L * .20, L * .20, L * .035, 3, GLASS);
      m.box(-.12 * L, h1 + L * .13, 0, L * .22, L * .012, L * .22, shade(c, .8));
      m.cyl(-.22 * L, h1 + L * .125, 0, L * .016, L * .12, shade(c, .7), 8);
      m.cyl(.14 * L, h1 * .95, 0, L * .007, L * .30, DARK, 6); m.box(.14 * L, h1 + L * .20, 0, L * .12, L * .006, L * .006, DARK);
      for (i = 0; i < 3; i++) m.boxT(.26 * L, h1 * .98 + i * L * .02, (i - 1) * L * .05, L * .05, L * .025, L * .035, hex('#d9a441'));
      m.sail([.14 * L, h1 + L * .20, 0], [.0 * L, h1 + L * .12, 0], [.14 * L, h1 + L * .12, 0], L * .01, [1, .9, .5, 1]);
    } else if (type === 2) {   /* белая моторная яхта */
      c = pick(COLS); var h2 = L * .12;
      m.hull2(L, L * .30, h2, { side: WHITE, stripe: c, under: shade(c, .6), rail: [1, 1, 1, 1], deck: hex('#d8c8a8'), bowW: .12, sternW: .92, rise: .14, bot: .6, flare: .07 });
      m.boxT(-.04 * L, h2 * .98, 0, L * .50, L * .10, L * .24, WHITE, [.93, .93, .9, 1]); m.ribbon(-.04 * L, h2 + L * .05, 0, L * .50, L * .24, L * .03, 6, GLASS2);
      m.boxT(-.10 * L, h2 + L * .10, 0, L * .30, L * .075, L * .21, WHITE, [.96, .96, .94, 1]); m.ribbon(-.10 * L, h2 + L * .135, 0, L * .30, L * .21, L * .028, 4, GLASS2);
      m.box(-.10 * L, h2 + L * .175, 0, L * .34, L * .008, L * .25, shade(c, .9));
      m.cyl(-.08 * L, h2 + L * .18, 0, L * .006, L * .12, DARK, 6); m.box(-.08 * L, h2 + L * .28, 0, L * .005, L * .008, L * .09, DARK);
      m.box(-.46 * L, h2 * .2, 0, L * .06, L * .012, L * .24, [.8, .8, .78, 1]);
      m.box(.2 * L, h2, 0, L * .12, L * .014, L * .14, shade(c, 1.1));
    } else if (type === 3) {   /* прогулочный катер с рубкой */
      c = pick([HULLC[2], hex('#2f5f9e'), hex('#2c6a4f'), hex('#8a2a2a')]); var h3 = L * .12;
      m.hull2(L, L * .30, h3, { side: c, stripe: WHITE, deck: hex('#e6dcc8'), bowW: .12, rise: .22, flare: .07 });
      m.boxT(-.06 * L, h3 * .98, 0, L * .38, L * .13, L * .22, WHITE); m.ribbon(-.06 * L, h3 + L * .06, 0, L * .38, L * .22, L * .035, 5, GLASS2);
      m.box(-.06 * L, h3 + L * .13, 0, L * .42, L * .012, L * .25, shade(c, 1.1));
      m.cyl(.0 * L, h3 + L * .14, 0, L * .018, L * .09, DARK, 8, L * .014, hex('#d8403a'));
      m.cyl(.30 * L, h3 * .95, 0, L * .006, L * .30, DARK, 6); m.box(.30 * L, h3 + L * .22, 0, L * .005, L * .006, L * .07, DARK);
      m.flag(-.30 * L, h3 + L * .12, 0, L * .05, L * .035);
    } else if (type === 4) {   /* контейнеровоз */
      h = pick(CARGOH); var h4 = L * .08;
      m.hull2(L, L * .22, h4, { side: h, stripe: hex('#d8403a'), under: hex('#7a1f1f'), rail: shade(h, 1.3), deck: DECKG, bowW: .1, sternW: .85, rise: .1, flare: .06 });
      var cc = [pick(COLS), pick(COLS), pick(COLS), pick(COLS)];
      for (i = 0; i < 7; i++) { var bx = (-.14 + i * .095) * L, st = (i % 3 === 2) ? 3 : (i % 2 ? 2 : 3); for (r = 0; r < 2; r++) for (var q = 0; q < st; q++) m.boxT(bx, h4 * .98 + q * L * .028, (r ? 1 : -1) * L * .045, L * .085, L * .026, L * .075, cc[(i + r + q) % 4]); }
      m.boxT(-.38 * L, h4 * .98, 0, L * .13, L * .17, L * .18, WHITE, [.9, .9, .9, 1]); m.ribbon(-.38 * L, h4 + L * .06, 0, L * .13, L * .18, L * .02, 3, GLASS); m.ribbon(-.38 * L, h4 + L * .11, 0, L * .13, L * .18, L * .02, 3, GLASS);
      m.boxT(-.385 * L, h4 + L * .17, 0, L * .11, L * .04, L * .20, WHITE); m.cyl(-.42 * L, h4 + L * .21, 0, L * .02, L * .07, shade(h, 1.3), 8);
      m.cyl(.34 * L, h4, 0, L * .005, L * .12, DARK, 5);
    } else if (type === 5) {   /* танкер */
      var h5 = L * .08, td = hex('#2a3140');
      m.hull2(L, L * .22, h5, { side: td, stripe: hex('#e8e8e0'), under: hex('#b02a26'), rail: shade(td, 1.6), deck: hex('#8a4a3a'), bowW: .12, sternW: .88, rise: .08, flare: .04 });
      for (i = 0; i < 4; i++) { m.cyl((-.12 + i * .15) * L, h5 * .98, 0, L * .03, L * .02, [.65, .68, .72, 1], 10); }
      m.box(.0 * L, h5 + L * .022, 0, L * .50, L * .012, L * .012, [.7, .72, .76, 1]); for (i = 0; i < 6; i++) m.box((-.2 + i * .09) * L, h5 + L * .008, L * .02, L * .01, L * .014, L * .06, [.75, .75, .78, 1]);
      m.boxT(-.38 * L, h5 * .98, 0, L * .14, L * .15, L * .18, WHITE); m.ribbon(-.38 * L, h5 + L * .06, 0, L * .14, L * .18, L * .02, 3, GLASS); m.ribbon(-.38 * L, h5 + L * .105, 0, L * .14, L * .18, L * .02, 3, GLASS);
      m.boxT(-.385 * L, h5 + L * .15, 0, L * .11, L * .035, L * .20, WHITE); m.cyl(-.43 * L, h5 + L * .185, 0, L * .02, L * .06, hex('#d8403a'), 8);
      m.cyl(.30 * L, h5, 0, L * .005, L * .10, DARK, 5);
    } else if (type === 6) {   /* эсминец */
      var h6 = L * .09, hg = hex('#8f9cab');
      m.hull2(L, L * .19, h6, { side: hg, stripe: hex('#6a7685'), under: hex('#4a2a2a'), rail: shade(hg, .9), deck: hex('#6e7a86'), bowW: .05, sternW: .85, rise: .24, bot: .5, flare: .1 });
      m.boxT(.02 * L, h6 * .98, 0, L * .36, L * .10, L * .13, hex('#aab6c2')); m.ribbon(.02 * L, h6 + L * .05, 0, L * .36, L * .13, L * .018, 5, GLASS);
      m.boxT(.02 * L, h6 + L * .10, 0, L * .20, L * .06, L * .10, hex('#c3ccd6')); m.ribbon(.02 * L, h6 + L * .13, 0, L * .20, L * .10, L * .016, 3, GLASS);
      m.cyl(.02 * L, h6 + L * .16, 0, L * .007, L * .20, DARK, 6); m.box(.02 * L, h6 + L * .30, 0, L * .005, L * .006, L * .08, DARK);
      m.box(-.04 * L, h6 + L * .24, 0, L * .02, L * .004, L * .10, [.85, .85, .9, 1]);
      m.cyl(-.1 * L, h6 + L * .10, 0, L * .03, L * .08, shade(hg, .85), 8, L * .024, hex('#6e7a86'));
      m.cyl(.30 * L, h6 * .98, 0, L * .042, L * .035, hex('#7a8794'), 12, L * .036, hex('#6e7a86')); m.box(.355 * L, h6 + L * .026, 0, L * .08, L * .009, L * .009, DARK);
      m.cyl(-.34 * L, h6 * .98, 0, L * .04, L * .03, hex('#7a8794'), 12, L * .034); m.box(-.39 * L, h6 + L * .02, 0, L * .06, L * .008, L * .008, DARK);
      m.box(.16 * L, h6 + L * .01, 0, L * .06, L * .02, L * .06, hex('#5a6672'));
      m.flag(-.30 * L, h6 + L * .15, 0, L * .06, L * .04); m.box(-.30 * L, h6, 0, L * .005, L * .15, L * .005, DARK);
    } else {   /* подводная лодка */
      var sc = hex('#242e3c');
      m.ell(0, 0, 0, L * .5, L * .07, L * .065, 20, 14, sc, hex('#3a4658'));
      m.boxT(-.02 * L, L * .045, 0, L * .20, L * .09, L * .045, hex('#2c3646'), hex('#3a4658'));
      m.cyl(-.06 * L, L * .13, 0, L * .004, L * .08, DARK, 5); m.cyl(.0 * L, L * .13, 0, L * .004, L * .06, DARK, 5);
      m.box(-.46 * L, .0, 0, L * .06, L * .0025, L * .24, hex('#1a212c')); m.box(-.46 * L, -L * .13, 0, L * .06, L * .26, L * .004, hex('#1a212c'));
      m.box(.26 * L, L * .02, 0, L * .05, L * .004, L * .20, hex('#1a212c'));
      m.flag(.0 * L, L * .20, 0, L * .06, L * .04);
    }
    return { data: new Float32Array(m.v), n: m.v.length / 10, L: L };
  }

  /* ---------- общий поддержка ---------- */
  var supportedCache = null;
  function supported() {
    if (supportedCache !== null) return supportedCache;
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl2');
      supportedCache = !!(gl && DATA && DATA.h && DATA.c);
      if (gl) { var x = gl.getExtension('WEBGL_lose_context'); x && x.loseContext(); }
    } catch (e) { supportedCache = false; }
    return supportedCache;
  }
  function loadImg(src) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('img')); }; im.src = src; }); }

  /* ---------- сама карта ---------- */
  function mount(stage, box, cfg, signal) {
    cfg = cfg || {};
    if (!document.getElementById('crimea3d-css')) { var st = document.createElement('style'); st.id = 'crimea3d-css'; st.textContent = CSS; document.head.appendChild(st); }
    var canvas = document.createElement('canvas'); canvas.className = 'map__gl'; canvas.setAttribute('aria-label', 'Карта Крыма в 3D: вращайте пальцем');
    stage.insertBefore(canvas, stage.firstChild);
    var glow = document.createElement('div'); glow.className = 'map3d__glow'; stage.insertBefore(glow, box);
    box.classList.add('map__box--3d');
    var pinEls = Array.prototype.slice.call(box.querySelectorAll('.pin'));
    var pins = pinEls.map(function (el, i) {
      var meta = cfg.pins && cfg.pins[+el.getAttribute('data-i')], id = meta && meta.id, w = id ? pinWorld(id) : null;
      
      return { el: el, id: id, w: w, kind: meta && meta.kind, pulse: meta && meta.pulse, x: 0, y: 0, vis: false, name: (meta && meta.name) || '', side: (id && PINS[id]) ? PINS[id][2] : 'b', hidden: false };
    }).filter(function (p) { return p.w; });
    pins.forEach(function (p) { p.el.classList.remove('pin--l', 'pin--r', 'pin--t'); if (p.side !== 'b') p.el.classList.add('pin--' + p.side); });
    var ctl = document.createElement('div'); ctl.className = 'map3d__ctl';
    ctl.innerHTML = '<button class="wood" type="button" data-c="north" aria-label="Север сверху" title="Север сверху">🧭</button><button class="wood" type="button" data-c="spin" aria-pressed="true" aria-label="Медленное вращение" title="Медленное вращение">⟳</button><button class="wood" type="button" data-c="move" aria-pressed="false" aria-label="Двигать карту пальцем" title="Двигать карту пальцем">✋</button>';
    (stage.parentNode || stage).appendChild(ctl);

    var gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    var ctrl = { dragged: false, consumeDrag: function () { var d = this.dragged; this.dragged = false; return d; }, zoomBy: function (f) { cam.zt = clamp(cam.zt / f, .55, 1.9); }, ready: false };
    if (!gl) { fail(); return ctrl; }

    var alive = true, raf = 0, F = null, N = 1024;
    var cam = { yaw: 0.9, pitch: 1.15, z: 1.35, yawT: 0, pitchT: 0.95, zt: 1, tx: 0, tz: 0.02, ttx: 0, ttz: 0.02, spin: true, idle: 0, vy: 0, vp: 0, intro: 0 };
    var VP = new Float32Array(16), PM = new Float32Array(16), VM = new Float32Array(16), tmp = new Float32Array(16), camPos = [0, 1, 1];
    var SUN = [-0.55, 0.74, -0.42], HAZE = [0.58, 0.83, 0.94];
    var cw = 1, ch = 1, aspect = 1, dpr = 1, fit = 2, qs = 1, slow = 0, fast = 0;
    var ships = [], rip = new Float32Array(16), ripN = 0, gulls = [];
    var progs = {}, vaos = {}, tex = {};
    var t0 = performance.now(), lastT = t0;

    function fail() { alive = false; cancelAnimationFrame(raf); canvas.remove(); glow.remove(); ctl.remove(); box.classList.remove('map__box--3d'); setTimeout(function () { if (cfg.onFail) cfg.onFail(); }, 0); }

    function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s) + '\n' + src.slice(0, 80)); } return s; }
    function program(vs, fs, attrs) {
      var p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      attrs.forEach(function (a, i) { gl.bindAttribLocation(p, i, a); });
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var inf = gl.getActiveUniform(p, i), nm = inf.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, inf.name); }
      return { p: p, u: u };
    }

    /* высота/глубина на CPU */
    function fAt(x, z) {
      var u = clamp(x / WD + .5, 0, 1) * (N - 1), v = clamp(z / DDD + .5, 0, 1) * (N - 1), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, i1 = Math.min(i + 1, N - 1), j1 = Math.min(j + 1, N - 1);
      return ((F[j * N + i] * (1 - fu) + F[j * N + i1] * fu) * (1 - fv) + (F[j1 * N + i] * (1 - fu) + F[j1 * N + i1] * fu) * fv) * VS;
    }
    function depthAt(x, z) { return -fAt(x, z); }

    function layout() {
      var r = stage.getBoundingClientRect(); cw = Math.max(1, r.width); ch = Math.max(1, r.height); aspect = cw / ch;
      dpr = Math.min(window.devicePixelRatio || 1, 1.75) * qs; var w = Math.round(cw * dpr), h = Math.round(ch * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      var tn = Math.tan(FOVY / 2), dW = (1.16 * W / 2) / (tn * aspect), dH = (1.30 * (DD * Math.sin(cam.pitchT) + .16) / 2) / tn;
      fit = Math.max(dW, dH, 0.9);
    }

    function setupGL() {
      progs.terrain = program(TERRAIN_VS, TERRAIN_FS, ['aUV']);
      progs.water = program(WATER_VS, WATER_FS, ['aP']);
      progs.ship = program(SHIP_VS, SHIP_FS, ['aP', 'aN', 'aC']);
      progs.spark = program(SPARK_VS, SPARK_FS, ['aS']);
      progs.beam = program(BEAM_VS, BEAM_FS, ['aP', 'aQ', 'aK']);
      /* рельеф: сетка */
      var GN = 360, uv = new Float32Array((GN + 1) * (GN + 1) * 2), idx = new Uint32Array(GN * GN * 6), i, j, k = 0;
      for (j = 0; j <= GN; j++) for (i = 0; i <= GN; i++) { uv[k++] = i / GN; uv[k++] = j / GN; }
      k = 0; for (j = 0; j < GN; j++) for (i = 0; i < GN; i++) { var a = j * (GN + 1) + i, b = a + 1, c = a + GN + 1, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
      vaos.terrain = mkVAO([[uv, 2]], idx, true); vaos.terrain.count = idx.length;
      /* вода: плоская сетка */
      var WN = 140, WR = 8, wp = new Float32Array((WN + 1) * (WN + 1) * 2), widx = new Uint16Array(WN * WN * 6); k = 0;
      for (j = 0; j <= WN; j++) for (i = 0; i <= WN; i++) { wp[k++] = (i / WN * 2 - 1) * WR; wp[k++] = (j / WN * 2 - 1) * WR; }
      k = 0; for (j = 0; j < WN; j++) for (i = 0; i < WN; i++) { var a2 = j * (WN + 1) + i, b2 = a2 + 1, c2 = a2 + WN + 1, d2 = c2 + 1; widx[k++] = a2; widx[k++] = c2; widx[k++] = b2; widx[k++] = b2; widx[k++] = c2; widx[k++] = d2; }
      vaos.water = mkVAO([[wp, 2]], widx, false); vaos.water.count = widx.length;
      /* искорки */
      var NS = 260, sp = new Float32Array(NS * 4);
      for (i = 0; i < NS; i++) { var px, pz, tries = 0; do { px = rnd(-.62, .62); pz = rnd(-.56, .56); tries++; } while (tries < 20 && fAt(px, pz) < -0.004 && Math.random() < .85); sp[i * 4] = px; sp[i * 4 + 1] = Math.max(fAt(px, pz), 0) + rnd(.004, .07); sp[i * 4 + 2] = pz; sp[i * 4 + 3] = Math.random(); }
      vaos.spark = mkVAO([[sp, 4]], null, false); vaos.spark.count = NS;
      /* динамика лучей */
      vaos.beam = { vao: gl.createVertexArray(), buf: gl.createBuffer(), count: 0 };
      gl.bindVertexArray(vaos.beam.vao); gl.bindBuffer(gl.ARRAY_BUFFER, vaos.beam.buf); gl.bufferData(gl.ARRAY_BUFFER, 8192, gl.DYNAMIC_DRAW);
      var S9 = 9 * 4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S9, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S9, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S9, 20);
      gl.bindVertexArray(null);
      /* кораблики */
      for (i = 0; i < 8; i++) {
        var variants = [];
        for (var q = 0; q < (i === 7 ? 1 : 3); q++) { var sd = buildShip(i); var vb = gl.createVertexArray(), bf = gl.createBuffer(); gl.bindVertexArray(vb); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, sd.data, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24); gl.bindVertexArray(null); variants.push({ vao: vb, n: sd.n }); }
        vaos['ship' + i] = variants;
      }
      var secs = [[-.45, .12, .5], [-1.1, .30, .26], [-2.1, .55, 0]], wk = [];
      function wp_(x, z, a) { return [x, 0, z, 0, 1, 0, 1, 1, 1, a]; }
      for (i = 0; i < 2; i++) {
        var A = secs[i], B = secs[i + 1];
        var a0 = wp_(A[0], -A[1], 0), a1 = wp_(A[0], 0, A[2]), a2 = wp_(A[0], A[1], 0), b0 = wp_(B[0], -B[1], 0), b1 = wp_(B[0], 0, B[2]), b2 = wp_(B[0], B[1], 0);
        [a0, a1, b1, a0, b1, b0, a1, a2, b2, a1, b2, b1].forEach(function (v) { wk = wk.concat(v); });
      }
      var wvb = gl.createVertexArray(), wbf = gl.createBuffer(); gl.bindVertexArray(wvb); gl.bindBuffer(gl.ARRAY_BUFFER, wbf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(wk), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24); gl.bindVertexArray(null);
      vaos.wake = { vao: wvb, n: 12 };
    }
    function mkVAO(attrs, idx, wide) {
      var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      attrs.forEach(function (a, i) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a[0], gl.STATIC_DRAW); gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, a[1], gl.FLOAT, false, 0, 0); });
      if (idx) { var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); }
      gl.bindVertexArray(null); return { vao: vao, wide: wide };
    }

    function uploadTextures(hImg, cImg) {
      var c = document.createElement('canvas'); c.width = hImg.naturalWidth; c.height = hImg.naturalHeight; N = c.width;
      var cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(hImg, 0, 0); var px = cx.getImageData(0, 0, N, N).data, lo = DATA.lo, hi = DATA.hi, i;
      F = new Float32Array(N * N); for (i = 0; i < N * N; i++) F[i] = lo + ((px[i * 4] * 256 + px[i * 4 + 1]) / 65535) * (hi - lo);
      tex.h = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex.h); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, N, N, 0, gl.RED, gl.FLOAT, F);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      tex.c = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex.c); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cImg); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }

    /* ---------- кораблики: поведение ---------- */
    var PLAN = [0, 0, 0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7];
    function losClear(x0, z0, x1, z1, m) { var n = 26; for (var i = 1; i <= n; i++) { var t = i / n; if (depthAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) < m) return false; } return true; }
    function pickTarget(b) {
      for (var k = 0; k < 40; k++) {
        var x = rnd(-1.25, 1.25), z = rnd(-.95, .95), r = TYPES[b.type].L;
        if (depthAt(x, z) > .03 && (k > 30 || losClear(b.x, b.z, x, z, .015)) && Math.hypot(x - b.x, z - b.z) > .25) { b.tx = x; b.tz = z; return true; }
      }
      b.tx = b.x; b.tz = b.z; return false;
    }
    function makeShip(type) {
      var b = { type: type, vi: Math.floor(Math.random() * (type === 7 ? 1 : 3)), x: 0, z: 0, th: rnd(0, 6.28), v: 0, sp: rnd(TYPES[type].sp[0], TYPES[type].sp[1]), seed: Math.random() * 100, y: 0, sub: type === 7, up: false, subT: rnd(2, 28), rise: 0, M: new Float32Array(16), WM: new Float32Array(16) };
      for (var k = 0; k < 80; k++) { var x = rnd(-1.2, 1.2), z = rnd(-.9, .9); if (depthAt(x, z) > .035 && ships.every(function (o) { return Math.hypot(o.x - x, o.z - z) > .12; })) { b.x = x; b.z = z; break; } }
      pickTarget(b); b.th = Math.atan2(b.tz - b.z, b.tx - b.x); if (b.sub) b.rise = 0; ships.push(b);
    }
    function addRipple(x, z, t) { var i = ripN++ % 4; rip[i * 4] = x; rip[i * 4 + 1] = z; rip[i * 4 + 2] = t; rip[i * 4 + 3] = 1; }
    function stepShips(dt, t) {
      for (var i = 0; i < ships.length; i++) {
        var b = ships[i], T = TYPES[b.type];
        var dx = b.tx - b.x, dz = b.tz - b.z, dist = Math.hypot(dx, dz);
        if (dist < .06) pickTarget(b);
        var want = Math.atan2(dz, dx);
        /* обход берега: щупаем впереди */
        var ahead = .05 + T.L * .6, dA = depthAt(b.x + Math.cos(b.th) * ahead, b.z + Math.sin(b.th) * ahead);
        if (dA < .014) {
          var dl = depthAt(b.x + Math.cos(b.th - .7) * ahead, b.z + Math.sin(b.th - .7) * ahead), dr = depthAt(b.x + Math.cos(b.th + .7) * ahead, b.z + Math.sin(b.th + .7) * ahead);
          want = b.th + (dr > dl ? 1.3 : -1.3); if (Math.random() < .03) pickTarget(b);
        }
        /* у каждого кораблика своя «зона»: обходим соседей плавно, справа (чтобы встречные расходились) */
        var rI = T.L * .58, avX = 0, avZ = 0, avSlow = 1;
        for (var j = 0; j < ships.length; j++) {
          if (j === i) continue;
          var o = ships[j], rJ = TYPES[o.type].L * .58, ox = o.x - b.x, oz = o.z - b.z, od = Math.hypot(ox, oz) || 1e-6, minD = rI + rJ, zone = minD + .06 + T.L * .6;
          if (od < zone) {
            var k = (zone - od) / (zone - minD); k = k > 1 ? 1 : k; var ux = -ox / od, uz = -oz / od;
            avX += (ux - uz * .8) * k * k * 1.6; avZ += (uz + ux * .8) * k * k * 1.6;
            if (ox * Math.cos(b.th) + oz * Math.sin(b.th) > 0) avSlow = Math.min(avSlow, .25 + .75 * (1 - k));
          }
        }
        if (avX || avZ) want = Math.atan2(Math.sin(want) + avZ, Math.cos(want) + avX);
        var d = angDiff(want, b.th), mx = T.turn * .8 * dt; b.th += clamp(d, -mx, mx);
        var spd = b.sp * .65 * avSlow * (dA < .02 ? .6 : 1); if (b.sub && b.rise < .5) spd *= .8;
        b.x += Math.cos(b.th) * spd * dt; b.z += Math.sin(b.th) * spd * dt; b.v = spd;
        for (var j2 = 0; j2 < ships.length; j2++) {   /* жёсткая граница: корпуса не пересекаются */
          if (j2 === i) continue;
          var o2 = ships[j2], mD = rI + TYPES[o2.type].L * .58, qx = b.x - o2.x, qz = b.z - o2.z, qd = Math.hypot(qx, qz) || 1e-6;
          if (qd < mD) { var pu = (mD - qd) * Math.min(1, dt * 5) * .5; b.x += qx / qd * pu; b.z += qz / qd * pu; o2.x -= qx / qd * pu; o2.z -= qz / qd * pu; }
        }
        if (depthAt(b.x, b.z) < .006) {         /* на мели — выталкиваем в глубину */
          var gx = depthAt(b.x + .01, b.z) - depthAt(b.x - .01, b.z), gz = depthAt(b.x, b.z + .01) - depthAt(b.x, b.z - .01), gl_ = Math.hypot(gx, gz) || 1;
          b.x += gx / gl_ * .05 * dt * 6; b.z += gz / gl_ * .05 * dt * 6; pickTarget(b);
        }
        if (Math.abs(b.x) > 1.5 || Math.abs(b.z) > 1.2) pickTarget(b);
        var bob = Math.sin(t * 1.3 + b.seed) * .0012, y = bob + (b.type === 7 ? 0 : 0.0008);
        if (b.sub) {                                  /* подлодка: ныряет и всплывает */
          b.subT -= dt;
          if (b.subT <= 0) { b.up = !b.up; b.subT = b.up ? rnd(9, 15) : rnd(14, 38); addRipple(b.x, b.z, t); }
          var goal = b.up ? 1 : 0; b.rise += (goal - b.rise) * Math.min(1, dt * .9);
          y = -.013 + .0135 * b.rise + bob * b.rise;
        }
        b.y = y;
        model(b.M, b.x, y, b.z, -b.th, Math.sin(t * .9 + b.seed * 2) * .03, Math.sin(t * 1.1 + b.seed) * .05, 1.15);
        model(b.WM, b.x, .0013, b.z, -b.th, 0, 0, T.L * 1.15);
      }
    }

    /* ---------- чайки ---------- */
    var gullVAO = null;
    function setupGulls() {
      var m = new Mesh(), c = [1, 1, 1, 1], g = .02;
      m.tri([0, 0, 0], [.012, 0, .0], [-.01, 0, g], c); m.tri([0, 0, 0], [.012, 0, 0], [-.01, 0, -g], c);
      m.tri([.014, 0, 0], [.02, 0, 0], [.012, 0, 0.004], [.9, .75, .4, 1]);
      var vb = gl.createVertexArray(), bf = gl.createBuffer(); gl.bindVertexArray(vb); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.v), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24); gl.bindVertexArray(null);
      gullVAO = { vao: vb, n: m.v.length / 10 };
      for (var i = 0; i < 9; i++) gulls.push({ cx: rnd(-.55, .55), cz: rnd(-.4, .4), r: rnd(.12, .34), w: rnd(.12, .22) * (Math.random() < .5 ? -1 : 1), ph: rnd(0, 6.28), h: rnd(.1, .18), M: new Float32Array(16) });
    }

    /* ---------- камера, ввод ---------- */
    var ptrs = new Map(), tapStart = null, lastInput = 0, moveMode = false;
    function panLim() { var k = clamp((1 - cam.zt) / .45, 0, 1); return [.28 + .30 * k, .24 + .28 * k]; }
    function onDown(e) {
      if (e.button > 0 && e.pointerType === 'mouse') return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      ctrl.dragged = false; cam.idle = 0; cam.vy = 0; cam.vp = 0; lastInput = performance.now();
      if (ptrs.size === 1) tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; else tapStart = null;
      if (ptrs.size === 2) { var a = Array.from(ptrs.values()); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, z: cam.zt, ang: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x), yaw: cam.yawT, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 }; ctrl.dragged = true; }
    }
    var pinch = null;
    function onMove(e) {
      var p = ptrs.get(e.pointerId); if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; cam.idle = 0; lastInput = performance.now();
      if (ptrs.size === 2 && pinch) {
        var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, ang = Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x);
        cam.zt = clamp(pinch.z / (d / pinch.d), .55, 1.9); cam.yawT = pinch.yaw - angDiff(ang, pinch.ang); cam.yaw = cam.yawT;
        var mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2; panBy(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my;
      } else if (ptrs.size === 1) {
        if (!ctrl.dragged && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) { ctrl.dragged = true; try { stage.setPointerCapture(e.pointerId); } catch (er) { } }
        if (ctrl.dragged && moveMode) { panBy(dx, dy); cam.vy = 0; cam.vp = 0; }
        else if (ctrl.dragged) { var ky = .0075, kp = .0052; cam.yawT -= dx * ky; cam.yaw = cam.yawT; cam.pitchT = clamp(cam.pitchT + dy * kp, .32, 1.5); cam.vy = -dx * ky * 60; cam.vp = 0; }
      }
    }
    function panBy(dx, dy) {
      var sc = 2 * Math.tan(FOVY / 2) * cam.z * fit / ch, rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), k = sc / Math.max(.4, Math.sin(cam.pitch));
      var L = panLim(); cam.ttx = clamp(cam.ttx - dx * sc * rx + dy * k * fx, -L[0], L[0]); cam.ttz = clamp(cam.ttz - dx * sc * rz + dy * k * fz, .02 - L[1], .02 + L[1]);
    }
    function onUp(e) {
      var wasTap = tapStart && ptrs.size === 1 && !ctrl.dragged && performance.now() - tapStart.t < 600;
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; lastInput = performance.now();
      if (wasTap && e.type === 'pointerup') tapWater(e);
    }
    function onWheel(e) { e.preventDefault(); cam.zt = clamp(cam.zt * Math.exp(e.deltaY * .0012), .55, 1.9); cam.idle = 0; lastInput = performance.now(); }
    function tapWater(e) {
      if (e.target && e.target.closest && e.target.closest('.pin')) return;
      var r = canvas.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      var inv = invert(VP); if (!inv) return;
      var a = unproj(inv, nx, ny, -1), b = unproj(inv, nx, ny, 1), dy = b[1] - a[1]; if (Math.abs(dy) < 1e-6) return;
      var t = -a[1] / dy; if (t < 0) return; var x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      if (depthAt(x, z) > .012 && Math.abs(x) < 1.6 && Math.abs(z) < 1.3) addRipple(x, z, (performance.now() - t0) / 1000);
    }
    function unproj(inv, x, y, zc) { var v = [x, y, zc, 1], o = [0, 0, 0, 0]; for (var r = 0; r < 4; r++) o[r] = inv[r] * v[0] + inv[4 + r] * v[1] + inv[8 + r] * v[2] + inv[12 + r] * v[3]; return [o[0] / o[3], o[1] / o[3], o[2] / o[3]]; }
    function invert(m) {
      var inv = new Float32Array(16), a = m;
      inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
      inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
      inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
      inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
      inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
      inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
      inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
      inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
      inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
      inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
      inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
      inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
      inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
      inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
      inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
      inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
      var det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12]; if (!det) return null; det = 1 / det; for (var i = 0; i < 16; i++) inv[i] *= det; return inv;
    }

    var opts = { signal: signal };
    stage.addEventListener('pointerdown', onDown, opts); stage.addEventListener('pointermove', onMove, opts); stage.addEventListener('pointerup', onUp, opts); stage.addEventListener('pointercancel', onUp, opts);
    stage.addEventListener('wheel', onWheel, { signal: signal, passive: false });
    stage.addEventListener('dblclick', function (e) { if (e.target.closest && e.target.closest('.pin')) return; home(); }, opts);
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      if (b.dataset.c === 'north') home(); else if (b.dataset.c === 'move') { moveMode = !moveMode; b.setAttribute('aria-pressed', moveMode ? 'true' : 'false'); } else { cam.spin = !cam.spin; b.setAttribute('aria-pressed', cam.spin ? 'true' : 'false'); }
    }, opts);
    ['pointerdown', 'pointermove', 'pointerup', 'wheel'].forEach(function (ev) { ctl.addEventListener(ev, function (e) { e.stopPropagation(); }, { signal: signal, passive: true }); });
    function home() { cam.yawT = Math.round(cam.yaw / (2 * Math.PI)) * 2 * Math.PI; cam.pitchT = .95; cam.zt = 1; cam.ttx = 0; cam.ttz = .02; cam.vy = 0; cam.idle = 0; lastInput = performance.now() + 3000; }
    var ro = (window.ResizeObserver ? new ResizeObserver(function () { layout(); }) : null); if (ro) ro.observe(stage); else window.addEventListener('resize', layout, opts);

    /* ---------- кадр ---------- */
    function screenOf(x, y, z) {
      var cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cwv = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      if (cwv <= .01) return null; return [(cx / cwv * .5 + .5) * cw, (1 - (cy / cwv * .5 + .5)) * ch, cwv];
    }
    function occluded(px, py, pz) {
      var dx = px - camPos[0], dy = py - camPos[1], dz = pz - camPos[2];
      for (var i = 1; i < 30; i++) { var t = i / 30 * .965, x = camPos[0] + dx * t, y = camPos[1] + dy * t, z = camPos[2] + dz * t; if (fAt(x, z) > y + .006) return true; }
      return false;
    }
    function updatePins(t) {
      var tris = [], beamV = [], haloV = [], right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
      for (var i = 0; i < pins.length; i++) {
        var p = pins[i], gy = Math.max(fAt(p.w[0], p.w[1]), 0.002), py = gy + .012, s = screenOf(p.w[0], py, p.w[1]);
        if (!s || s[0] < -60 || s[0] > cw + 60 || s[1] < -60 || s[1] > ch + 60) { if (p.vis) { p.el.classList.add('is-off'); p.vis = false; } continue; }
        if (!p.vis) { p.el.classList.remove('is-off'); p.vis = true; }
        p.x = s[0]; p.y = s[1];
        var sc = clamp(1.55 / (s[2] / fit), .82, 1.3);
        p.el.style.transform = 'translate3d(' + s[0].toFixed(1) + 'px,' + s[1].toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + sc.toFixed(3) + ')';
        var occ = occluded(p.w[0], py, p.w[1]); if (occ !== p.occ) { p.occ = occ; p.el.classList.toggle('is-occ', occ); }
        var avail = p.kind === 'city' || p.kind === 'scene', br = avail ? (p.pulse ? 1 : .75) : .42, hgt = avail ? .13 : .075, wd = avail ? .02 : .013;
        var colr = avail ? [1, .86, .38] : [.8, .93, 1], K = [colr[0], colr[1], colr[2], br * (.75 + .25 * Math.sin(t * 2.1 + i))];
        var x0 = p.w[0] - right[0] * wd, z0 = p.w[1] - right[2] * wd, x1 = p.w[0] + right[0] * wd, z1 = p.w[1] + right[2] * wd, yb = gy, yt = gy + hgt;
        pushQuad(beamV, [x0, yb, z0, 0, 1], [x1, yb, z1, 1, 1], [x1, yt, z1, 1, 0], [x0, yt, z0, 0, 0], K);
        var hr = avail ? .06 : .04;
        pushQuad(haloV, [p.w[0] - hr, gy + .003, p.w[1] - hr, 0, 0], [p.w[0] + hr, gy + .003, p.w[1] - hr, 1, 0], [p.w[0] + hr, gy + .003, p.w[1] + hr, 1, 1], [p.w[0] - hr, gy + .003, p.w[1] + hr, 0, 1], K);
      }
      placeLabels();
      var all = new Float32Array(beamV.concat(haloV)); gl.bindBuffer(gl.ARRAY_BUFFER, vaos.beam.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, all); vaos.beam.count = beamV.length / 9; vaos.beam.halo = haloV.length / 9;
    }
    var SIDES = ['t', 'b', 'r', 'l'];
    function labelRect(p, side) {
      var w = Math.min(92, (p.name.length * 7.6 + 6)), h = (p.name.length * 7.6 > 92) ? 26 : 14, x = p.x, y = p.y;
      if (side === 't') return [x - w / 2, y - 14 - h, x + w / 2, y - 12];
      if (side === 'b') return [x - w / 2, y + 12, x + w / 2, y + 12 + h];
      if (side === 'r') return [x + 22, y - h / 2, x + 22 + w, y + h / 2];
      return [x - 22 - w, y - h / 2, x - 22, y + h / 2];
    }
    function hit(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }
    function placeLabels() {
      var vis = pins.filter(function (p) { return p.vis; }), placed = [], order = vis.slice().sort(function (a, b) { return (b.kind === 'city' || b.kind === 'scene') - (a.kind === 'city' || a.kind === 'scene'); });
      var dots = vis.map(function (p) { return [p.x - 9, p.y - 9, p.x + 9, p.y + 9]; });
      order.forEach(function (p) {
        var tries = [p.side].concat(SIDES.filter(function (x) { return x !== p.side; })), ok = null;
        for (var pass = 0; pass < 2 && !ok; pass++) for (var k = 0; k < tries.length && !ok; k++) {
          var r = labelRect(p, tries[k]);
          if (r[0] < 4 || r[2] > cw - 4 || r[1] < 56 || r[3] > ch - 4) continue;
          var bad = placed.some(function (q) { return hit(r, q); }) || (pass === 0 && dots.some(function (d, i) { return vis[i] !== p && hit(r, d); }));
          if (!bad) ok = { side: tries[k], rect: r };
        }
        if (ok) { placed.push(ok.rect); if (ok.side !== p.side) { p.side = ok.side; applySide(p); } if (p.hidden) { p.hidden = false; p.el.classList.remove('pin--nolabel'); } }
        else if (!p.hidden) { p.hidden = true; p.el.classList.add('pin--nolabel'); }
      });
    }
    function applySide(p) { p.el.classList.remove('pin--l', 'pin--r', 'pin--t'); if (p.side !== 'b') p.el.classList.add('pin--' + p.side); }
    function pushQuad(arr, a, b, c, d, K) { [a, b, c, a, c, d].forEach(function (v) { arr.push(v[0], v[1], v[2], v[3], v[4], K[0], K[1], K[2], K[3]); }); }

    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      var rawdt = (now - lastT) / 1000, t = (now - t0) / 1000, dt = Math.min(.05, rawdt); lastT = now;
      if (!window.__CRIMEA3D_NOADAPT) { if (rawdt > .034) { slow++; fast = 0; } else { fast++; if (fast > 40) slow = Math.max(0, slow - 1); } if (slow > 24 && qs > .6) { qs = Math.max(.6, qs - .15); slow = 0; layout(); } }
      /* камера: плавное приближение к цели, лёгкая инерция, медленное вращение в покое */
      if (cam.intro < 1) { cam.intro = Math.min(1, cam.intro + dt / 2.2); var e = 1 - Math.pow(1 - cam.intro, 3); cam.z = 1.35 + (1 - 1.35) * e; cam.yaw = cam.yawT + (1 - e) * .9; cam.pitch = cam.pitchT + (1 - e) * .2; }
      else {
        if (!ptrs.size) { cam.yawT += cam.vy * dt; cam.vy *= Math.pow(.04, dt); if (cam.spin && now - lastInput > 4500 && !document.querySelector('.sheet:not([hidden])')) cam.yawT += .05 * dt; }
        cam.yaw += (cam.yawT - cam.yaw) * Math.min(1, dt * 12); cam.pitch += (cam.pitchT - cam.pitch) * Math.min(1, dt * 8); cam.z += (cam.zt - cam.z) * Math.min(1, dt * 8);
      }
      var PL = panLim(); cam.ttx = clamp(cam.ttx, -PL[0], PL[0]); cam.ttz = clamp(cam.ttz, .02 - PL[1], .02 + PL[1]);
      cam.tx += (cam.ttx - cam.tx) * Math.min(1, dt * 8); cam.tz += (cam.ttz - cam.tz) * Math.min(1, dt * 8);
      var d = fit * cam.z, cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      camPos = [cam.tx + Math.sin(cam.yaw) * cp * d, sp * d, cam.tz + Math.cos(cam.yaw) * cp * d];
      persp(FOVY, aspect, .06, 14, PM); lookAt(camPos, [cam.tx, 0.01, cam.tz], VM); mul(PM, VM, VP);
      stepShips(dt, t);
      updatePins(t);
      /* рисуем */
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(HAZE[0], HAZE[1], HAZE[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);
      var P = progs.terrain; useCommon(P, t);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.h); gl.uniform1i(P.u.uH, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.c); gl.uniform1i(P.u.uC, 1);
      gl.bindVertexArray(vaos.terrain.vao); gl.drawElements(gl.TRIANGLES, vaos.terrain.count, gl.UNSIGNED_INT, 0);
      /* кораблики */
      gl.disable(gl.CULL_FACE); P = progs.ship; useCommon(P, t); gl.uniform1f(P.u.uWake, 0);
      for (var i = 0; i < ships.length; i++) { var b = ships[i], v = vaos['ship' + b.type][b.vi]; gl.uniformMatrix4fv(P.u.uM, false, b.M); gl.bindVertexArray(v.vao); gl.drawArrays(gl.TRIANGLES, 0, v.n); }
      for (i = 0; i < gulls.length; i++) { var g = gulls[i], a = g.ph + t * g.w, gx = g.cx + Math.cos(a) * g.r, gz = g.cz + Math.sin(a) * g.r, ang = a + (g.w > 0 ? Math.PI / 2 : -Math.PI / 2); model(g.M, gx, g.h + .01 * Math.sin(t * 1.3 + g.ph), gz, -ang, 0, (g.w > 0 ? .35 : -.35) + .12 * Math.sin(t * 2.2 + g.ph), 1.15); gl.uniformMatrix4fv(P.u.uM, false, g.M); gl.bindVertexArray(gullVAO.vao); gl.drawArrays(gl.TRIANGLES, 0, gullVAO.n); }
      /* вода */
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      P = progs.water; useCommon(P, t); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.h); gl.uniform1i(P.u.uH, 0); gl.uniform4fv(P.u.uRip, rip);
      gl.bindVertexArray(vaos.water.vao); gl.drawElements(gl.TRIANGLES, vaos.water.count, gl.UNSIGNED_SHORT, 0);
      /* следы за корабликами */
      P = progs.ship; useCommon(P, t);
      for (i = 0; i < ships.length; i++) { var s2 = ships[i]; if (s2.sub && s2.rise < .6) continue; gl.uniform1f(P.u.uWake, 1); gl.uniform1f(P.u.uWA, clamp(s2.v / .012, .35, 1)); gl.uniformMatrix4fv(P.u.uM, false, s2.WM); gl.bindVertexArray(vaos.wake.vao); gl.drawArrays(gl.TRIANGLES, 0, vaos.wake.n); }
      /* свечение: лучи городов и искорки (складываются со светом) */
      gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.CULL_FACE);
      P = progs.beam; gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniform1f(P.u.uT, t); gl.bindVertexArray(vaos.beam.vao);
      gl.uniform1f(P.u.uMode, 1); gl.drawArrays(gl.TRIANGLES, vaos.beam.count, vaos.beam.halo);
      gl.uniform1f(P.u.uMode, 0); gl.drawArrays(gl.TRIANGLES, 0, vaos.beam.count);
      P = progs.spark; useCommon(P, t); gl.uniform1f(P.u.uPx, dpr * ch / 700 * 1.1); gl.bindVertexArray(vaos.spark.vao); gl.drawArrays(gl.POINTS, 0, vaos.spark.count);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
      if (!ctrl.ready) { ctrl.ready = true; stage.classList.add('is-3d-ready'); }
    }
    function useCommon(P, t) {
      gl.useProgram(P.p);
      if (P.u.uVP) gl.uniformMatrix4fv(P.u.uVP, false, VP); if (P.u.uCam) gl.uniform3fv(P.u.uCam, camPos); if (P.u.uT) gl.uniform1f(P.u.uT, t);
      if (P.u.uDom) gl.uniform2f(P.u.uDom, WD, DDD); if (P.u.uVS) gl.uniform1f(P.u.uVS, VS); if (P.u.uSun) gl.uniform3fv(P.u.uSun, SUN); if (P.u.uHaze) gl.uniform3fv(P.u.uHaze, HAZE);
    }

    /* ---------- запуск ---------- */
    Promise.all([loadImg(DATA.h), loadImg(DATA.c)]).then(function (im) {
      if (!alive || signal.aborted) return;
      try {
        uploadTextures(im[0], im[1]); setupGL();
        PLAN.forEach(function (tp) { makeShip(tp); }); setupGulls();
        layout(); cam.yawT = 0; cam.pitchT = .95; cam.yaw = .9; cam.pitch = 1.15; raf = requestAnimationFrame(frame);
      } catch (err) { console.warn('crimea3d', err); fail(); }
    }).catch(function (err) { console.warn('crimea3d load', err); fail(); });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); alive = false; cancelAnimationFrame(raf); }, false);

    signal && signal.addEventListener('abort', function () {
      alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect();
      try { var x = gl.getExtension('WEBGL_lose_context'); x && x.loseContext(); } catch (e) { }
      canvas.remove(); glow.remove(); ctl.remove();
    }, { once: true });
    ctrl._dbg = { cam: cam, ships: ships, pins: pins, fAt: fAt, gl: gl, vaos: vaos, progs: progs };
    return ctrl;
  }

  window.__crimea3D = { supported: supported, mount: mount, pins: PINS };
})();
