
(function(){
'use strict';
/* Свет и тени v1: все здания, памятники, деревья, транспорт, лодки, NPC и мелочь отбрасывают
   и принимают солнечные тени. Тень следует за игроком, учитывает время суток (направление солнца),
   карта теней привязана к сетке текселей (без «дрожания»), а кастеры отбираются по близости. */
var MOB=(window.matchMedia&&matchMedia('(pointer: coarse)').matches)||('ontouchstart' in window);
var HALF=MOB?56:72, DIST=160, FAR=DIST+160;
var CAP=MOB?260:650, SMALL_R=1.1, SMALL_D=MOB?26:40;
var game=null,sc=null,sun=null,hemi=null,sg=null,sm=null;
var cand=[],candSet=new Set(),forced=new Set();
var scanAt=0,listAt=0,lastCx=1e9,lastCz=1e9,lastDx=9,lastDy=9,lastDz=9;
var RX_SKIP=/^(sky|sea|ripple|atm|far-hill|marker|cloud|halo|glow|beam|spark|aura|fx|pool|water|aqWater|aqMWater|npcBlob|blob|rain|snow|confetti|trail|collider|barrier|hitbox|sensor|trigger|c-glow|c-band)|(-water|Water|-glass|-halo|-star)$/i;

function cls(m){
  if(!m.getTotalVertices||m.getTotalVertices()===0)return 0;
  if(RX_SKIP.test(m.name||''))return 0;
  var mat=m.material;if(!mat)return 0;
  if(mat.getClassName&&mat.getClassName()==='ShaderMaterial')return 0;
  if(mat.disableLighting)return 0;
  var e=m.getBoundingInfo().boundingBox.extendSizeWorld;
  if(e.y*2<0.45)return 1;               /* плоское: только принимает тень */
  if(mat.alpha<0.6)return 1;            /* стекло/плёнка: не отбрасывает */
  return 2;
}
function addCand(m,force){
  if(!m||candSet.has(m))return;
  candSet.add(m);if(force)forced.add(m);
  cand.push(m);
}
function scan(){
  var ms=sc.meshes,i,m,c;
  for(i=0;i<ms.length;i++){
    m=ms[i];
    if(m.__ls)continue;
    if(m.isVisible===false)continue;       /* скрытые перепроверим позже */
    c=cls(m);m.__ls=1;
    if(c>=1&&!m.receiveShadows)m.receiveShadows=true;
    if(c===2)addCand(m,false);
  }
}
function bind(){
  var g=window.__sevGame;
  if(!g||!g.scene||g===game)return;
  var s=g.scene,l=s.lights.filter(function(x){return x.name==='sun'})[0];
  if(!l||!l.getShadowGenerator)return;
  var gen=l.getShadowGenerator();if(!gen)return;
  game=g;sc=s;sun=l;sg=gen;sm=gen.getShadowMap();
  hemi=s.lights.filter(function(x){return x.name==='hemi'})[0];
  cand=[];candSet=new Set();forced=new Set();scanAt=0;lastCx=1e9;
  /* уже зарегистрированные кастеры считаем обязательными */
  (sm.renderList||[]).forEach(function(m){addCand(m,true)});
  sg.addShadowCaster=function(m,inc){addCand(m,true);if(inc!==false&&m&&m.getChildMeshes)m.getChildMeshes().forEach(function(c){addCand(c,true)});return sg};
  sg.removeShadowCaster=function(m,inc){candSet.delete(m);forced.delete(m);return sg};
  /* качество */
  var Q=sg.constructor;
  if(sg.usePercentageCloserFiltering)sg.filteringQuality=MOB?Q.QUALITY_LOW:Q.QUALITY_MEDIUM;
  sg.bias=6e-4;sg.normalBias=.03;sg.setDarkness(0);
  sg.frustumEdgeFalloff=.5;
  sun.autoUpdateExtends=false;sun.autoCalcShadowZBounds=false;
  sun.orthoLeft=-HALF;sun.orthoRight=HALF;sun.orthoTop=HALF;sun.orthoBottom=-HALF;
  sun.shadowMinZ=1;sun.shadowMaxZ=FAR;
  sm.refreshRate=1;
  sc.onBeforeRenderObservable.add(frame);
}
function frame(){
  if(!sun||!sg)return;
  var cam=sc.activeCamera;if(!cam)return;
  var t=cam.getTarget?cam.getTarget():cam.position;
  var d=sun.direction,L=Math.hypot(d.x,d.y,d.z)||1,ux=d.x/L,uy=d.y/L,uz=d.z/L;
  /* оси света (LookAtLH, up=Y) для привязки к текселям */
  var rx=uz,rz=-ux,rl=Math.hypot(rx,rz)||1;rx/=rl;rz/=rl;
  var yx=uy*rz,yy=uz*rx-ux*rz,yz=-uy*rx; /* cross(d,right) */
  var size=(sm.getSize&&sm.getSize().width)||2048,tex=2*HALF/size;
  var tx=t.x,ty=0,tz=t.z;
  var tr=tx*rx+tz*rz,tu=tx*yx+ty*yy+tz*yz;
  var dr=Math.round(tr/tex)*tex-tr,du=Math.round(tu/tex)*tex-tu;
  tx+=dr*rx+du*yx;ty+=du*yy;tz+=dr*rz+du*yz;
  sun.position.set(tx-ux*DIST,ty-uy*DIST,tz-uz*DIST);
  sun.shadowMinZ=1;sun.shadowMaxZ=FAR;
  var now=performance.now();
  if(now>scanAt){scanAt=now+(cand.length?1800:600);try{scan()}catch(e){window.__lsErr=e.stack}}
  var moved=Math.abs(t.x-lastCx)+Math.abs(t.z-lastCz);
  var dirCh=Math.abs(ux-lastDx)+Math.abs(uy-lastDy)+Math.abs(uz-lastDz);
  if(now>listAt&&(moved>4||dirCh>.01||now>listAt+900)){
    listAt=now+220;lastCx=t.x;lastCz=t.z;lastDx=ux;lastDy=uy;lastDz=uz;
    try{rebuild(tx,ty,tz,ux,uy,uz,t)}catch(e){window.__lsErr=e.stack}
  }
}
var out=[],dd=[];
function rebuild(tx,ty,tz,ux,uy,uz,pc){
  var LAT=HALF*1.43+3,i,m,c,bs,cx,cy,cz,dx,dy,dz,al,lx,ly,lz,lat,r,dist,k=0;
  out.length=0;dd.length=0;
  var px=pc.x,py=pc.y,pz=pc.z;
  for(i=cand.length-1;i>=0;i--){
    m=cand[i];
    if(m.isDisposed()){cand.splice(i,1);candSet.delete(m);forced.delete(m);continue}
    bs=m.getBoundingInfo().boundingSphere;c=bs.centerWorld;r=bs.radiusWorld;
    dx=c.x-tx;dy=c.y-ty;dz=c.z-tz;
    al=dx*ux+dy*uy+dz*uz;
    if(al-r>FAR-DIST-2||al+r<-DIST+2)continue;
    lx=dx-al*ux;ly=dy-al*uy;lz=dz-al*uz;
    lat=Math.sqrt(lx*lx+ly*ly+lz*lz);
    if(lat-r>LAT)continue;
    dx=c.x-px;dy=c.y-py;dz=c.z-pz;dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(r<SMALL_R&&dist-r>SMALL_D)continue;
    out.push(m);dd.push(dist);
  }
  if(out.length>CAP){
    var idx=out.map(function(_,j){return j});
    idx.sort(function(a,b){return dd[a]-dd[b]});
    var o2=[];for(k=0;k<CAP;k++)o2.push(out[idx[k]]);
    sm.renderList=o2;
  }else sm.renderList=out.slice();
  window.__lsStat={cand:cand.length,list:sm.renderList.length};
}
(function poll(){try{bind()}catch(e){window.__lsErr=e.stack}requestAnimationFrame(poll)})();
})();
