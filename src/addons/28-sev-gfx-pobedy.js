
(function(){
'use strict';
/* Графика v1 — «Парк Победы».
   Модуль подключается к сцене так же, как sev-lightshadow и sev-atmosphere: ждёт window.__sevGame, ждёт, пока построится парк,
   и один раз улучшает картинку. Исходный код парка не меняется, поэтому всё можно выключить: window.__gfx.off() (до перезапуска сцены)
   или добавить к адресу ?gfx=0.
   Что делает:
   1) цвет: фильмовый тон-маппинг ACES, контраст, мягкая виньетка, тёплые света и прохладные тени;
   2) поверхности: детальная трава с крупными пятнами оттенка, асфальт с зерном, плитка с швами, песок с зёрнами
      (текстуры рисуются на лету, UV считаются по мировым координатам — без растяжений и швов между кусками);
   3) мелочь: пучки травы и полевые цветочки вокруг игрока (thin instances, одна отрисовка на всё);
   4) «контактные» тени-пятна под деревьями, кустами, урнами и скамейками;
   5) тени от солнца мягче (прозрачнее), туман чуть теплее. */
var MOB=(window.matchMedia&&matchMedia('(pointer: coarse)').matches)||('ontouchstart' in window);
var QS=new URLSearchParams(location.search);
var ENABLED=QS.get('gfx')!=='0';
var PROFILES={pobedy:{grade:true,surfaces:true,tufts:true,blobs:true,shadowDark:.26}};
var ANISO=MOB?4:8;
var CFG=window.__gfxCfg=window.__gfxCfg||{};
var cur=null;

function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash2(x,z,s){var h=Math.imul(x|0,374761393)+Math.imul(z|0,668265263)+Math.imul(s|0,2147483647);h=Math.imul(h^h>>>13,1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function vnoise(x,z,s){var xi=Math.floor(x),zi=Math.floor(z),fx=x-xi,fz=z-zi;fx=fx*fx*(3-2*fx);fz=fz*fz*(3-2*fz);
  var a=hash2(xi,zi,s),b=hash2(xi+1,zi,s),c=hash2(xi,zi+1,s),d=hash2(xi+1,zi+1,s);return a+(b-a)*fx+(c-a)*fz+(a-b-c+d)*fx*fz}
function rgba(c,a){return'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+a+')'}
function mixc(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}

/* ---------- текстуры ---------- */
function dyn(TX,sc,name,w,h,mips){var t=new TX(name,{width:w,height:h},sc,mips!==false);t.anisotropicFilteringLevel=ANISO;t.wrapU=1;t.wrapV=1;/* DynamicTexture по умолчанию CLAMP: нужен повтор */return t}
function wrapDraw(S,x,y,rad,fn){for(var ox=-1;ox<=1;ox++)for(var oy=-1;oy<=1;oy++){var X=x+ox*S,Y=y+oy*S;if(X<-rad||X>S+rad||Y<-rad||Y>S+rad)continue;fn(X,Y)}}
function blotches(c,S,r,n,r0,r1,cols,a){for(var i=0;i<n;i++){var x=r()*S,y=r()*S,rad=r0+r()*(r1-r0),col=cols[(r()*cols.length)|0];
  wrapDraw(S,x,y,rad,function(X,Y){var g=c.createRadialGradient(X,Y,0,X,Y,rad);g.addColorStop(0,rgba(col,a));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(X-rad,Y-rad,rad*2,rad*2)})}}
function grassTex(TX,sc){
  var S=512,t=dyn(TX,sc,'gfx-grass',S,S),c=t.getContext(),r=mulberry(11);
  c.fillStyle='#8fc263';c.fillRect(0,0,S,S);
  blotches(c,S,r,70,40,110,[[118,176,74],[160,208,104],[176,208,98],[104,158,66],[132,190,86]],.30);
  blotches(c,S,r,26,14,34,[[190,214,110],[96,148,64]],.22);
  var shades=[[84,138,56],[106,166,70],[132,190,84],[158,208,102],[182,222,126],[70,120,52]];
  c.lineCap='round';
  for(var i=0;i<4200;i++){var x=r()*S,y=r()*S,len=3+r()*7,ang=-Math.PI/2+(r()-.5)*1.3,col=shades[(r()*shades.length)|0],lw=.9+r()*1.2;
    (function(x,y,len,ang,col,lw){wrapDraw(S,x,y,10,function(X,Y){c.strokeStyle=rgba(col,.55+r()*.35);c.lineWidth=lw;c.beginPath();c.moveTo(X,Y);c.quadraticCurveTo(X+Math.cos(ang)*len*.5+(r()-.5)*2,Y+Math.sin(ang)*len*.5,X+Math.cos(ang)*len,Y+Math.sin(ang)*len);c.stroke()})})(x,y,len,ang,col,lw)}
  /* крошечные цветочки-крапинки */
  var fl=[[255,252,235],[255,226,120],[250,200,230]];
  for(i=0;i<46;i++){x=r()*S;y=r()*S;c.fillStyle=rgba(fl[(r()*fl.length)|0],.8);c.beginPath();c.arc(x,y,1+r()*.9,0,6.283);c.fill()}
  t.update(true);return t}
/* крупные пятна оттенка: умножаются поверх текстуры (lightmap) — убирают повторяемость на расстоянии */
function macroTex(TX,sc){
  var W=256,H=512,t=dyn(TX,sc,'gfx-macro',W,H),c=t.getContext(),r=mulberry(5);
  c.fillStyle='#d9d9d2';c.fillRect(0,0,W,H);
  var cols=[[255,255,238],[196,208,170],[228,236,200],[170,190,150],[250,244,210]];
  for(var i=0;i<130;i++){var x=r()*W,y=r()*H,rad=14+r()*46,col=cols[(r()*cols.length)|0];
    var g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,rgba(col,.42));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2)}
  t.wrapU=t.wrapV=0;t.update(true);return t}
function asphaltTex(TX,sc){
  var S=256,t=dyn(TX,sc,'gfx-asphalt',S,S),c=t.getContext(),r=mulberry(23);
  c.fillStyle='#e6e6e6';c.fillRect(0,0,S,S);
  blotches(c,S,r,40,20,60,[[255,255,255],[200,200,205],[170,172,178]],.22);
  var id=c.getImageData(0,0,S,S),d=id.data;
  for(var i=0;i<d.length;i+=4){var n=(r()-.5)*34;d[i]+=n;d[i+1]+=n;d[i+2]+=n}
  c.putImageData(id,0,0);
  for(i=0;i<260;i++){var x=r()*S,y=r()*S;c.fillStyle=r()<.5?'rgba(255,255,255,.5)':'rgba(120,120,125,.5)';c.fillRect(x,y,1+r()*2,1+r()*1.5)}
  /* тонкие трещинки */
  c.strokeStyle='rgba(90,90,96,.35)';c.lineWidth=.8;
  for(i=0;i<5;i++){var px=r()*S,py=r()*S;c.beginPath();c.moveTo(px,py);for(var k=0;k<7;k++){px+=(r()-.5)*26;py+=(r()-.3)*22;c.lineTo(px,py)}c.stroke()}
  t.update(true);return t}
function pavingTex(TX,sc){
  var S=512,n=4,cell=S/n,t=dyn(TX,sc,'gfx-paving',S,S),c=t.getContext(),r=mulberry(31);
  for(var gx=0;gx<n;gx++)for(var gy=0;gy<n;gy++){var v=236+((r()-.5)*22);c.fillStyle='rgb('+(v|0)+','+((v-1)|0)+','+((v-4)|0)+')';c.fillRect(gx*cell,gy*cell,cell,cell);
    var g=c.createLinearGradient(gx*cell,gy*cell,gx*cell+cell,gy*cell+cell);g.addColorStop(0,'rgba(255,255,255,.10)');g.addColorStop(1,'rgba(0,0,0,.07)');c.fillStyle=g;c.fillRect(gx*cell,gy*cell,cell,cell)}
  var id=c.getImageData(0,0,S,S),d=id.data;for(var i=0;i<d.length;i+=4){var q=(r()-.5)*14;d[i]+=q;d[i+1]+=q;d[i+2]+=q}c.putImageData(id,0,0);
  c.strokeStyle='rgba(128,120,108,.42)';c.lineWidth=2.4;
  for(i=0;i<=n;i++){c.beginPath();c.moveTo(i*cell,0);c.lineTo(i*cell,S);c.stroke();c.beginPath();c.moveTo(0,i*cell);c.lineTo(S,i*cell);c.stroke()}
  c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1.4;
  for(i=0;i<=n;i++){c.beginPath();c.moveTo(i*cell+2.5,0);c.lineTo(i*cell+2.5,S);c.stroke();c.beginPath();c.moveTo(0,i*cell+2.5);c.lineTo(S,i*cell+2.5);c.stroke()}
  t.update(true);return t}
function sandTex(TX,sc){
  var S=256,t=dyn(TX,sc,'gfx-sand',S,S),c=t.getContext(),r=mulberry(41);
  c.fillStyle='#f0ece0';c.fillRect(0,0,S,S);
  blotches(c,S,r,30,20,60,[[255,250,232],[226,214,190],[240,232,208]],.28);
  var id=c.getImageData(0,0,S,S),d=id.data;for(var i=0;i<d.length;i+=4){var q=(r()-.5)*26;d[i]+=q;d[i+1]+=q;d[i+2]+=q*.9}c.putImageData(id,0,0);
  t.update(true);return t}
function tuftTex(TX,sc){
  var W=128,H=128,t=dyn(TX,sc,'gfx-tuft',W,H),c=t.getContext(),r=mulberry(7);
  c.clearRect(0,0,W,H);
  var n=17;
  for(var i=0;i<n;i++){var bx=18+r()*92,h=46+r()*70,lean=(r()-.5)*44,w=3+r()*4.2,g=c.createLinearGradient(0,H,0,H-h);
    var k=r();g.addColorStop(0,'rgb('+(96+k*20|0)+','+(150+k*22|0)+','+(66+k*10|0)+')');g.addColorStop(1,'rgb('+(168+k*44|0)+','+(214+k*26|0)+','+(104+k*20|0)+')');
    c.fillStyle=g;c.beginPath();c.moveTo(bx-w,H);c.quadraticCurveTo(bx-w*.3+lean*.3,H-h*.55,bx+lean,H-h);c.quadraticCurveTo(bx+w*.4+lean*.3,H-h*.5,bx+w,H);c.closePath();c.fill()}
  t.hasAlpha=true;t.update(true);return t}
function flowerTex(TX,sc){
  var S=64,t=dyn(TX,sc,'gfx-flower',S,S),c=t.getContext();
  c.clearRect(0,0,S,S);
  c.strokeStyle='rgb(72,132,60)';c.lineWidth=2.2;c.beginPath();c.moveTo(32,S);c.quadraticCurveTo(30,44,32,26);c.stroke();
  c.fillStyle='rgb(70,130,58)';c.beginPath();c.ellipse(26,46,7,2.6,-.6,0,6.283);c.fill();c.beginPath();c.ellipse(39,42,7,2.6,.6,0,6.283);c.fill();
  for(var i=0;i<6;i++){var a=i*Math.PI/3;c.fillStyle='rgb(255,255,255)';c.beginPath();c.ellipse(32+Math.cos(a)*7.5,20+Math.sin(a)*7.5,6.2,4.2,a,0,6.283);c.fill()}
  c.fillStyle='rgb(255,214,60)';c.beginPath();c.arc(32,20,4.2,0,6.283);c.fill();
  t.hasAlpha=true;t.update(true);return t}
function blobTex(TX,sc){
  var S=64,t=dyn(TX,sc,'gfx-blob',S,S,true),c=t.getContext();
  c.fillStyle='#000';c.fillRect(0,0,S,S);
  var g=c.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(255,255,255,.80)');g.addColorStop(.55,'rgba(255,255,255,.38)');g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g;c.fillRect(0,0,S,S);t.getAlphaFromRGB=true;t.update(true);return t}

/* ---------- геометрия ---------- */
function crossMesh(sc,Mesh,name,w,h,planes,yUp){
  var m=new Mesh(name,sc),pos=[],nor=[],uv=[],idx=[];
  for(var p=0;p<planes;p++){var a=p*Math.PI/planes,cx=Math.cos(a)*w/2,cz=Math.sin(a)*w/2,b=p*4;
    pos.push(-cx,0,-cz,cx,0,cz,cx,h,cz,-cx,h,-cz);for(var k=0;k<4;k++)nor.push(0,1,0);
    uv.push(0,0,1,0,1,1,0,1);idx.push(b,b+1,b+2,b,b+2,b+3,b,b+2,b+1,b,b+3,b+2)}
  m.setVerticesData('position',pos);m.setVerticesData('normal',nor);m.setVerticesData('uv',uv);m.setIndices(idx);return m}
function quadMesh(sc,Mesh,name){
  var m=new Mesh(name,sc);m.setVerticesData('position',[-.5,0,-.5,.5,0,-.5,.5,0,.5,-.5,0,.5]);m.setVerticesData('normal',[0,1,0,0,1,0,0,1,0,0,1,0]);
  m.setVerticesData('uv',[0,0,1,0,1,1,0,1]);m.setIndices([0,2,1,0,3,2]);return m}
function worldUV(m,kx,kz){
  var p=m.getVerticesData('position');if(!p)return false;
  m.computeWorldMatrix(true);var w=m.getWorldMatrix().m,n=p.length/3,uv=new Float32Array(n*2);
  for(var i=0;i<n;i++){var x=p[i*3],y=p[i*3+1],z=p[i*3+2];uv[i*2]=(x*w[0]+y*w[4]+z*w[8]+w[12])*kx;uv[i*2+1]=(x*w[2]+y*w[6]+z*w[10]+w[14])*kz}
  m.setVerticesData('uv',uv,false);return true}

/* ---------- основная часть ---------- */
function apply(g,prof){
  var sc=g.scene,world=g.world,skyM=sc.getMeshByName('sky'),groundM=sc.getMeshByName('ground');
  if(!skyM||!groundM)return;
  prof=Object.assign({},prof);(CFG.skip||[]).forEach(function(k){prof[k]=false});
  var TX=skyM.material.emissiveTexture.constructor,MAT=groundM.material.constructor,MESH=groundM.constructor,rep={};

  /* 1. цвет */
  if(prof.grade){
    var ipc=sc.imageProcessingConfiguration,C3=skyM.material.diffuseColor.constructor;
    ipc.isEnabled=true;ipc.toneMappingEnabled=true;ipc.toneMappingType=ipc.constructor.TONEMAPPING_ACES;
    ipc.contrast=CFG.contrast||1.18;
    window.__gfxExp=CFG.exposure||1.32;
    ipc.vignetteEnabled=true;ipc.vignetteWeight=CFG.vignette==null?1.15:CFG.vignette;ipc.vignetteStretch=.2;ipc.vignetteCameraFov=.9;
    ipc.vignetteColor=new ipc.vignetteColor.constructor(.05,.07,.1,0);
    ipc.vignetteBlendMode=ipc.constructor.VIGNETTEMODE_MULTIPLY;
    var cc=ipc.colorCurves;
    if(cc){cc.globalSaturation=CFG.sat==null?14:CFG.sat;cc.highlightsHue=44;cc.highlightsDensity=14;cc.highlightsSaturation=8;cc.shadowsHue=222;cc.shadowsDensity=16;cc.shadowsSaturation=-4;cc.midtonesExposure=2;ipc.colorCurvesEnabled=true}
    rep.grade=1}

  /* 2. мягче тени */
  try{var sun=sc.lights.filter(function(l){return l.name==='sun'})[0],sg=sun&&sun.getShadowGenerator&&sun.getShadowGenerator();
    if(sg&&prof.shadowDark!==false){sg.setDarkness(prof.shadowDark);rep.shadow=1}}catch(e){}

  /* 3. поверхности */
  if(prof.surfaces){
    var tex={grass:grassTex(TX,sc),asphalt:asphaltTex(TX,sc),paving:pavingTex(TX,sc),sand:sandTex(TX,sc)},macro=macroTex(TX,sc),cache={},cnt={};
    function matFor(kind,orig){
      var key=kind+'|'+orig.name;if(cache[key])return cache[key];
      var nm=new MAT('gfx-'+kind+'-'+orig.name,sc);
      nm.diffuseTexture=tex[kind];nm.diffuseColor=orig.diffuseColor.clone();
      nm.specularColor=orig.specularColor?orig.specularColor.clone():nm.specularColor;nm.specularPower=orig.specularPower||64;
      if(orig.maxSimultaneousLights)nm.maxSimultaneousLights=orig.maxSimultaneousLights;
      nm.backFaceCulling=orig.backFaceCulling;nm.twoSidedLighting=orig.twoSidedLighting;
      nm.ambientColor=orig.ambientColor?orig.ambientColor.clone():nm.ambientColor;
      if(kind==='grass'){nm.diffuseColor=new orig.diffuseColor.constructor(1,1,1);if(orig.name.indexOf('#a6cf7a')<0){nm.diffuseColor=new orig.diffuseColor.constructor(.84,.97,.88)}
        nm.lightmapTexture=macro;nm.useLightmapAsShadowmap=true;macro.level=1.12}
      cache[key]=nm;return nm}
    var kinds={'#a6cf7a':['grass',1/7,1/7],'#78b35f':['grass',1/7,1/7],'#343b40':['asphalt',1/5,1/5],
      '#d8d0bf':['paving',1/8,1/8],'#eadfc3':['paving',1/8,1/8],'#cdbf9f':['paving',1/8,1/8],'#efe3c6':['paving',1/8,1/8],'#e8dcc0':['paving',1/8,1/8],
      '#d9ccae':['paving',1/8,1/8],'#ecdcb0':['paving',1/8,1/8],'#efe6d2':['paving',1/8,1/8],
      '#d6c9ae':['sand',1/6,1/6],'#e9d7a2':['sand',1/6,1/6],'#e6d19b':['sand',1/6,1/6],'#cdb98a':['sand',1/6,1/6]};
    var ms=sc.meshes,n=0;
    for(var i=0;i<ms.length;i++){var m=ms[i];
      if(!m.material||m.getClassName()!=='Mesh'||!m.getTotalVertices||m.getTotalVertices()===0)continue;
      var mat=m.material;if(mat.getClassName()!=='StandardMaterial'||mat.diffuseTexture&&mat.diffuseTexture.name.indexOf('sev-grass')<0)continue;
      var hx=mat.diffuseColor.toHexString().toLowerCase(),k=kinds[hx];if(!k)continue;
      if(m.geometry&&m.geometry.meshes&&m.geometry.meshes.length>1)continue;
      var e=m.getBoundingInfo().boundingBox.extendSizeWorld;if(e.y*2>0.35)continue;
      if(!worldUV(m,k[1],k[2]))continue;
      m.material=matFor(k[0],mat);cnt[k[0]]=(cnt[k[0]]||0)+1;n++}
    rep.surfaces=cnt}

  /* 4. карта занятости (где можно сыпать траву) */
  var occ=null,OX=-170,OZ=-180,OW=340,OH=1060,OC=1;
  function buildOcc(){
    var gw=Math.ceil(OW/OC),gh=Math.ceil(OH/OC),o=new Uint8Array(gw*gh),ms=sc.meshes,SKIP=/^(sky|sea|ground|far-hill|coin|atm|marker|halo|ripple|gfx|c-glow|c-band|aq|pool|boat|npc)/i;
    for(var i=0;i<ms.length;i++){var m=ms[i];
      if(!m.isVisible||m.getClassName()!=='Mesh'||SKIP.test(m.name)||!m.getTotalVertices||m.getTotalVertices()===0)continue;
      if(/-lawn|green-base/.test(m.name))continue;
      var bb=m.getBoundingInfo().boundingBox,e=bb.extendSizeWorld,mn=bb.minimumWorld,mx=bb.maximumWorld;
      if(mx.x<OX||mn.x>OX+OW||mx.z<OZ||mn.z>OZ+OH||mn.y>1.2||e.y*2>2.2)continue;
      var p=m.getVerticesData('position'),ix=m.getIndices();if(!p||!ix)continue;
      m.computeWorldMatrix(true);var w=m.getWorldMatrix().m;
      for(var t=0;t<ix.length;t+=3){
        var a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3;
        var ax=p[a]*w[0]+p[a+1]*w[4]+p[a+2]*w[8]+w[12],ay=p[a]*w[1]+p[a+1]*w[5]+p[a+2]*w[9]+w[13],az=p[a]*w[2]+p[a+1]*w[6]+p[a+2]*w[10]+w[14];
        var bx=p[b]*w[0]+p[b+1]*w[4]+p[b+2]*w[8]+w[12],by=p[b]*w[1]+p[b+1]*w[5]+p[b+2]*w[9]+w[13],bz=p[b]*w[2]+p[b+1]*w[6]+p[b+2]*w[10]+w[14];
        var cx=p[c]*w[0]+p[c+1]*w[4]+p[c+2]*w[8]+w[12],cy=p[c]*w[1]+p[c+1]*w[5]+p[c+2]*w[9]+w[13],cz=p[c]*w[2]+p[c+1]*w[6]+p[c+2]*w[10]+w[14];
        if(Math.max(ay,by,cy)>1.3)continue;
        var x0=Math.max(0,Math.floor((Math.min(ax,bx,cx)-OX)/OC)),x1=Math.min(gw-1,Math.floor((Math.max(ax,bx,cx)-OX)/OC));
        var z0=Math.max(0,Math.floor((Math.min(az,bz,cz)-OZ)/OC)),z1=Math.min(gh-1,Math.floor((Math.max(az,bz,cz)-OZ)/OC));
        if(x1<x0||z1<z0||(x1-x0+1)*(z1-z0+1)>40000)continue;
        var d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9){continue}
        for(var zz=z0;zz<=z1;zz++)for(var xx=x0;xx<=x1;xx++){
          var px=OX+(xx+.5)*OC,pz=OZ+(zz+.5)*OC,l1=((bz-cz)*(px-cx)+(cx-bx)*(pz-cz))/d,l2=((cz-az)*(px-cx)+(ax-cx)*(pz-cz))/d,l3=1-l1-l2;
          if(l1>=-.12&&l2>=-.12&&l3>=-.12)o[zz*gw+xx]=1}}}
    return {o:o,gw:gw,gh:gh}}
  if(prof.tufts){try{occ=buildOcc()}catch(e){window.__gfxErr='occ '+e.stack}}
  function free(x,z){if(!occ)return true;var xi=Math.floor((x-OX)/OC),zi=Math.floor((z-OZ)/OC);if(xi<0||zi<0||xi>=occ.gw||zi>=occ.gh)return false;return !occ.o[zi*occ.gw+xi]}

  /* 5. трава и цветы вокруг игрока: одна сетка, пересобирается при движении (thin instances в этой сборке Babylon вырезаны) */
  if(prof.tufts){
    var tm=new MESH('fxTuft',sc),fm=new MESH('fxFlower',sc),tmat=new MAT('gfxTuftMat',sc),fmat=new MAT('gfxFlowerMat',sc),C3=tmat.diffuseColor.constructor;
    [[tmat,tuftTex(TX,sc)],[fmat,flowerTex(TX,sc)]].forEach(function(q){var m=q[0],t=q[1];m.diffuseTexture=t;m.useAlphaFromDiffuseTexture=true;m.transparencyMode=1;m.alphaCutOff=.42;m.backFaceCulling=false;
      m.twoSidedLighting=false;m.specularColor=new C3(0,0,0);m.diffuseColor=new C3(1,1,1)});
    tm.material=tmat;fm.material=fmat;
    [tm,fm].forEach(function(m){m.isPickable=false;m.alwaysSelectAsActiveMesh=true;m.receiveShadows=true;m.checkCollisions=false;m.setEnabled(false)});
    /* строит геометрию пучков: каждый пучок — planes вертикальных квадов, повёрнутых друг к другу */
    function fill(mesh,list,planes,w,h){
      var n=list.length/8;if(!n){mesh.setEnabled(false);return}
      var V=n*planes*4,pos=new Float32Array(V*3),nor=new Float32Array(V*3),uv=new Float32Array(V*2),col=new Float32Array(V*4),idx=new Uint32Array(n*planes*6),vi=0,ii=0;
      for(var i=0;i<n;i++){var o=i*8,x=list[o],z=list[o+1],s=list[o+2],a=list[o+3];
        for(var p=0;p<planes;p++){var an=a+p*Math.PI/planes,cx=Math.cos(an)*w*s*.5,cz=Math.sin(an)*w*s*.5,b=vi,y1=h*s;
          pos.set([x-cx,.01,z-cz,x+cx,.01,z+cz,x+cx,.01+y1,z+cz,x-cx,.01+y1,z-cz],vi*3);
          for(var k=0;k<4;k++){nor[(vi+k)*3+1]=1;col.set([list[o+4],list[o+5],list[o+6],1],(vi+k)*4)}
          uv.set([0,0,1,0,1,1,0,1],vi*2);
          idx.set([b,b+1,b+2,b,b+2,b+3],ii);vi+=4;ii+=6}}
      mesh.setVerticesData('position',pos,true);mesh.setVerticesData('normal',nor,true);mesh.setVerticesData('uv',uv,true);mesh.setVerticesData('color',col,true);
      mesh.setIndices(idx,V,true);mesh.refreshBoundingInfo();mesh.setEnabled(true)}
    var R=MOB?30:40,CELL=MOB?2.6:2.0,lastX=1e9,lastZ=1e9,surf=world.surfaceAt;
    var rebuild=function(px,pz){
      var x0=Math.floor((px-R)/CELL),x1=Math.floor((px+R)/CELL),z0=Math.floor((pz-R)/CELL),z1=Math.floor((pz+R)/CELL),tl=[],fl=[];
      for(var zi=z0;zi<=z1;zi++)for(var xi=x0;xi<=x1;xi++){
        var x=(xi+hash2(xi,zi,1))*CELL,z=(zi+hash2(xi,zi,2))*CELL,dx=x-px,dz=z-pz,d=Math.sqrt(dx*dx+dz*dz);if(d>R)continue;
        var fall=d>R-14?(R-d)/14:1;
        if(!free(x,z)||surf(x,z)!=='grass')continue;
        var nz=vnoise(x/11,z/11,9),dens=.5+.5*nz;if(hash2(xi,zi,3)>dens)continue;
        var s=(.7+hash2(xi,zi,4)*.7)*fall,dry=vnoise(x/23,z/23,17),k=.9+hash2(xi,zi,6)*.28;
        tl.push(x,z,s,hash2(xi,zi,5)*6.283,k*(.92+dry*.2),k,k*(.9-dry*.14),0);
        var fn=vnoise(x/6.5,z/6.5,31),zone=vnoise(x/40,z/40,41);
        if(fn>.6&&zone>.4&&hash2(xi,zi,7)<.6){
          var fx=x+(hash2(xi,zi,8)-.5)*CELL,fz=z+(hash2(xi,zi,9)-.5)*CELL;
          if(free(fx,fz)){var fs=(.8+hash2(xi,zi,10)*.6)*fall,pick=hash2(xi,zi,12),c=pick<.34?[1,1,1]:pick<.6?[1,.93,.35]:pick<.8?[1,.62,.82]:[.78,.72,1];
            fl.push(fx,fz,fs,hash2(xi,zi,11)*6.283,c[0],c[1],c[2],0)}}}
      fill(tm,tl,3,.9,.6);fill(fm,fl,2,.34,.42);rep.tufts=tl.length/8;rep.flowers=fl.length/8};
    sc.onBeforeRenderObservable.add(function(){
      var c=g.player&&g.player.collider;if(!c)return;var p=c.position;
      if(p.y>14){if(tm.isEnabled()){tm.setEnabled(false);fm.setEnabled(false)}lastX=1e9;return}if(Math.abs(p.x-lastX)+Math.abs(p.z-lastZ)>8){lastX=p.x;lastZ=p.z;try{rebuild(p.x,p.z)}catch(e){window.__gfxErr='tuft '+e.stack}}})}

  /* 6. контактные тени: одна статичная сетка из плоских квадов-пятен */
  if(prof.blobs){
    var bt=blobTex(TX,sc),bm=new MESH('fxBlob',sc),bmat=new MAT('gfxBlobMat',sc),C=bmat.diffuseColor.constructor;
    bmat.diffuseColor=new C(0,0,0);bmat.emissiveColor=new C(.02,.03,.02);bmat.specularColor=new C(0,0,0);bmat.disableLighting=true;bmat.opacityTexture=bt;
    bmat.zOffset=-2;bmat.backFaceCulling=false;bm.material=bmat;bm.isPickable=false;bm.receiveShadows=false;
    var items=[],names=/^(pine|cypress|poplar|pshrub|pbin|promBench|agave)/;
    for(var j=0;j<sc.meshes.length;j++){var q=sc.meshes[j];if(!names.test(q.name)||!q.isVisible)continue;
      var bb2=q.getBoundingInfo().boundingBox,ex=bb2.extendSizeWorld,ce=bb2.centerWorld;if(ex.y*2<.3||ex.x>14||ex.z>14)continue;
      var tree=/^(pine|cypress|poplar)/.test(q.name);items.push(ce.x,ce.z,ex.x*(tree?1.3:1.4),ex.z*(tree?1.3:1.4))}
    var N=items.length/4;
    if(N){var bp=new Float32Array(N*12),bn=new Float32Array(N*12),bu=new Float32Array(N*8),bi=new Uint32Array(N*6);
      for(var u=0;u<N;u++){var x=items[u*4],z=items[u*4+1],rx=items[u*4+2],rz=items[u*4+3],v=u*4;
        bp.set([x-rx,.05,z-rz,x+rx,.05,z-rz,x+rx,.05,z+rz,x-rx,.05,z+rz],v*3);for(var k=0;k<4;k++)bn[(v+k)*3+1]=1;
        bu.set([0,0,1,0,1,1,0,1],v*2);bi.set([v,v+2,v+1,v,v+3,v+2],u*6)}
      bm.setVerticesData('position',bp);bm.setVerticesData('normal',bn);bm.setVerticesData('uv',bu);bm.setIndices(bi);bm.alwaysSelectAsActiveMesh=true;rep.blobs=N}
    else bm.setEnabled(false)}

  window.__gfxReport=rep;cur=g}

function bind(){
  if(!ENABLED)return;
  var g=window.__sevGame;
  if(!g||g===cur||!g.scene||!g.def||!g.world||!g.player||!g.player.collider)return;
  var prof=PROFILES[g.def.id];if(!prof||CFG.off)return;
  if(!window.__lsStat||g.scene.meshes.length<1500)return;
  if(g.__gfxPending)return;g.__gfxPending=1;
  setTimeout(function(){try{apply(g,prof)}catch(e){window.__gfxErr=e.stack;console.error('[gfx]',e)}},700)}
window.__gfx={off:function(){CFG.off=1},report:function(){return window.__gfxReport}};
(function poll(){try{bind()}catch(e){window.__gfxErr=e.stack}requestAnimationFrame(poll)})();
})();
