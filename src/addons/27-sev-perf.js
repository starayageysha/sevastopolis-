
(function(){
'use strict';
/* Производительность v1: динамическое разрешение (DRS). Если кадры дольше ~21 мс (меньше ~48 к/с), картинка рендерится с чуть меньшим
   разрешением (до 1.8× крупнее пиксель), и интерфейс не страдает; когда запас появляется — разрешение плавно возвращается.
   Выключить: ?drs=0. Дополнительно: дальняя плоскость камеры = конец тумана, без лишних проверок наведения. */
var QS=new URLSearchParams(location.search);
var NODRS=QS.get('drs')==='0';
var MOB=(window.matchMedia&&matchMedia('(pointer: coarse)').matches)||('ontouchstart' in window);
var MAXF=MOB?1.3:1.25,eng=null,base=1,f=1,orig=null,ema=16.7,last=performance.now(),tAdj=0,hold=6000,sceneRef=null,warm=0;
function apply(){if(eng&&orig)orig.call(eng,base*f)}
function hook(g){
  eng=g.engine;orig=eng.setHardwareScalingLevel;base=eng.getHardwareScalingLevel();f=1;ema=16.7;tAdj=performance.now()+4000;hold=6000;warm=0;
  var o=orig;eng.setHardwareScalingLevel=function(l){base=l;return o.call(eng,l*f)};orig=o;
  sceneRef=g.scene;
  try{g.scene.skipPointerMovePicking=true;var c=g.scene.activeCamera;if(c){var fe=(g.scene.fogEnd>0?g.scene.fogEnd:700)+60;if(c.maxZ>fe)c.maxZ=fe}}catch(e){}}

/* Мир кусками: всё, что дальше конца тумана (+запас), отключается и возвращается, когда игрок подходит.
   Берутся только статичные заморожённые объекты (склеенные куски мира, деревья, кусты, здания): они не двигаются, без столкновений. */
var cull=null;
function buildCull(g){
  var sc=g.scene,R=(sc.fogEnd>0?sc.fogEnd:600)+30,SKIP=/^(sky|sea|ground|far-hill|atm|fx|gfx|marker|halo|ripple|coin|cloud|npc|hero-|Fox|boat|ferris)/i,list=[],ms=sc.meshes;
  for(var i=0;i<ms.length;i++){var m=ms[i];
    if(!m.isVisible||m.checkCollisions||!m.isWorldMatrixFrozen||SKIP.test(m.name)||m.getTotalVertices&&m.getClassName()==='Mesh'&&m.getTotalVertices()===0)continue;
    var bs=m.getBoundingInfo().boundingSphere,r=bs.radiusWorld;if(r>260)continue;
    list.push({m:m,x:bs.centerWorld.x,z:bs.centerWorld.z,r:r,on:true})}
  cull={g:g,sc:sc,R:R,list:list,at:0,hidden:0}}
function cullTick(now){
  if(!cull||cull.sc.isDisposed||cull.g!==window.__sevGame){cull=null;return}
  if(now<cull.at)return;cull.at=now+350;
  var c=cull.g.player&&cull.g.player.collider,p=c&&c.position;if(!p)return;
  var R=cull.R,L=cull.list,hid=0;
  for(var i=0;i<L.length;i++){var o=L[i],dx=o.x-p.x,dz=o.z-p.z,d=Math.sqrt(dx*dx+dz*dz)-o.r,want=o.on?d<R+35:d<R;
    if(want!==o.on){o.on=want;try{o.m.setEnabled(want)}catch(e){}}
    if(!o.on)hid++}
  cull.hidden=hid;window.__cullStat={total:L.length,hidden:hid,R:R}}

/* LOD: упрощённые копии деревьев и зданий для дали (как в Genshin/Roblox: чем дальше, тем меньше полигонов).
   Вершины склеиваются сеткой (vertex clustering), материал и UV сохраняются. Строятся по 1 объекту за раз, пока игрок гуляет. */
var lodQ=null,lodStat={made:0,tris0:0,tris1:0};
var LOD_SKIP=/^(sky|sea|ground|far-hill|atm|fx|gfx|marker|halo|ripple|coin|cloud|npc|hero-|Fox|boat|ferris|vf-|blob)/i;
function decimate(m,frac,minCell){
  var P=m.getVerticesData('position'),I=m.getIndices();if(!P||!I||I.length<300)return null;
  var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],i,k;
  for(i=0;i<P.length;i+=3)for(k=0;k<3;k++){var v=P[i+k];if(v<mn[k])mn[k]=v;if(v>mx[k])mx[k]=v}
  var ext=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);if(!(ext>0))return null;
  var cell=Math.max(minCell||0,ext*frac),nv=P.length/3,kinds=[['position',3],['normal',3],['uv',2],['color',4],['uv2',2]],A=[];
  for(i=0;i<kinds.length;i++){var d=m.getVerticesData(kinds[i][0]);if(d&&d.length/kinds[i][1]===nv)A.push({k:kinds[i][0],s:kinds[i][1],d:d,sum:[]})}
  var sms=m.subMeshes&&m.subMeshes.length?m.subMeshes:[{indexStart:0,indexCount:I.length,materialIndex:0}];
  var cnt=[],nc=0,idx=[],subs=[],base=0;
  for(var si=0;si<sms.length;si++){var sm=sms[si],map=new Map(),rem=new Map(),i0=idx.length,s0=nc;
    for(i=sm.indexStart;i<sm.indexStart+sm.indexCount;i+=3){var t3=[I[i],I[i+1],I[i+2]],cs=[];
      for(var q=0;q<3;q++){var vi=t3[q],c=rem.get(vi);
        if(c===undefined){var key=Math.floor((P[vi*3]-mn[0])/cell)+Math.floor((P[vi*3+1]-mn[1])/cell)*4096+Math.floor((P[vi*3+2]-mn[2])/cell)*16777216;
          c=map.get(key);if(c===undefined){c=nc++;map.set(key,c);cnt.push(0);for(var a=0;a<A.length;a++)for(k=0;k<A[a].s;k++)A[a].sum.push(0)}
          rem.set(vi,c);cnt[c]++;
          for(var a2=0;a2<A.length;a2++){var S=A[a2].s,o=c*S;for(k=0;k<S;k++)A[a2].sum[o+k]+=A[a2].d[vi*S+k]}}
        cs.push(c)}
      if(cs[0]!==cs[1]&&cs[1]!==cs[2]&&cs[0]!==cs[2])idx.push(cs[0],cs[1],cs[2])}
    subs.push({mi:sm.materialIndex,vs:s0,vc:nc-s0,is:i0,ic:idx.length-i0})}
  if(idx.length<18||idx.length>I.length*.6)return null;
  var out={idx:idx,subs:subs,att:[]};
  for(var a3=0;a3<A.length;a3++){var S2=A[a3].s,arr=new Float32Array(nc*S2);for(var c2=0;c2<nc;c2++){for(k=0;k<S2;k++)arr[c2*S2+k]=A[a3].sum[c2*S2+k]/cnt[c2];
      if(A[a3].k==='normal'){var l=Math.hypot(arr[c2*3],arr[c2*3+1],arr[c2*3+2])||1;arr[c2*3]/=l;arr[c2*3+1]/=l;arr[c2*3+2]/=l}}
    out.att.push([A[a3].k,arr,S2])}
  return out}
function mkLod(m,d,dist){
  var L=new m.constructor(m.name+'-lod',m.getScene());
  for(var i=0;i<d.att.length;i++)L.setVerticesData(d.att[i][0],d.att[i][1],false,d.att[i][2]);
  L.setIndices(d.idx);L.material=m.material;
  if(m.subMeshes&&m.subMeshes.length>1){var SM=m.subMeshes[0].constructor;L.subMeshes=[];for(i=0;i<d.subs.length;i++){var u=d.subs[i];if(u.ic>0)new SM(u.mi,u.vs,u.vc,u.is,u.ic,L)}}
  L.receiveShadows=m.receiveShadows;L.isPickable=false;L.checkCollisions=false;
  L.setEnabled(false);m.addLODLevel(dist,L);lodStat.made++;lodStat.tris0+=m.getTotalIndices()/3;lodStat.tris1+=d.idx.length/3;window.__lodStat=lodStat;return L}
function buildLodQueue(g){
  var q=[],ms=g.scene.meshes;
  for(var i=0;i<ms.length;i++){var m=ms[i];
    if(m.isAnInstance||LOD_SKIP.test(m.name)||/^(coast-|night-|street|sign|traffic|pcar|ccar|ctl|poi)/.test(m.name)||m.getTotalIndices()>90000||m.skeleton||m.getClassName()!=='Mesh'||m.getTotalIndices()<600)continue;
    var inst=m.instances&&m.instances.length>2,merged=/^merged/i.test(m.name)||m.isWorldMatrixFrozen;
    if(!inst&&!merged)continue;
    if(m.isVertexBufferUpdatable&&m.isVertexBufferUpdatable('position'))continue;
    q.push({m:m,inst:inst})}
  q.sort(function(a,b){return b.m.getTotalIndices()*(b.inst?b.m.instances.length:1)-a.m.getTotalIndices()*(a.inst?a.m.instances.length:1)});lodQ={g:g,q:q,i:0}}
function lodTick(){
  if(!lodQ||lodQ.g!==window.__sevGame){lodQ=null;return}
  var t0=performance.now();while(lodQ.i<lodQ.q.length&&performance.now()-t0<3){var o=lodQ.q[lodQ.i++],m=o.m;
    if(m.isDisposed()||(m._lodLevels&&m._lodLevels.length))continue;
    try{
      var d1=decimate(m,o.inst?1/12:0,o.inst?0:.9);
      if(d1){mkLod(m,d1,o.inst?85:130);
        var d2=decimate(m,o.inst?1/6:0,o.inst?0:2.6);if(d2){mkLod(m,d2,o.inst?200:260);if(o.inst){var d3=decimate(m,1/3,0);if(d3)mkLod(m,d3,330)}}}
    }catch(e){}
    }}
var cullWait=0;
function tick(now){
  var g=window.__sevGame;
  if(g&&g.engine&&g.scene&&g.running!==false){
    if(g.engine!==eng||g.scene!==sceneRef){hook(g);cull=null;lodQ=null;cullWait=now+2500}
    if(!cull&&cullWait&&now>cullWait&&g.scene.meshes.length>1000&&QS.get('cull')!=='0')buildCull(g);
    cullTick(now);
    if(!lodQ&&cullWait&&now>cullWait+1500&&g.scene.meshes.length>1000&&QS.get('lod')!=='0')buildLodQueue(g);
    lodTick();
    var dt=now-last;
    if(dt<250&&!document.hidden){
      ema+=(dt-ema)*.06;warm++;
      if(!NODRS&&warm>90&&now>tAdj){
        if(ema>25&&f<MAXF){f=Math.min(MAXF,f*1.14);apply();tAdj=now+1800;ema=17;window.__drsF=f}
        else if(ema<17.4&&f>1){tAdj=now+hold;var nf=Math.max(1,f/1.09);f=nf;apply();window.__drsF=f;ema=18}
      }
      if(f>1&&ema>21&&now-tAdj<-1e9){}
    }else ema=16.7;
  }
  last=now;requestAnimationFrame(tick)}
window.__drs=function(){return {f:f,ema:ema,base:base}};
requestAnimationFrame(tick);
})();
