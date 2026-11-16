
(function(){
'use strict';
var G=null,S=null,btn=null,tip=null,lastT=performance.now(),tipTxt='';
var NAMES={bin:'урну',barrel:'бочку',cone:'конус',fence:'заборчик',decor:'табличку',crate:'ящик',npc:'жителя',car:'машину'};
function clamp(v,a,b){return v<a?a:v>b?b:v}
/* ---------- UI ---------- */
var css=document.createElement('style');
css.textContent='#btnGrab{position:fixed;right:calc(158px + var(--safe-r,0px));bottom:calc(18px + var(--safe-b,0px));z-index:14;width:58px;height:58px;border-radius:50%;padding:0;font-size:28px;box-shadow:0 3px 12px #0008;touch-action:none;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;opacity:.55;transition:opacity .2s,transform .15s}'+
'#btnGrab.near{opacity:1;animation:grabPulse 1.1s ease-in-out infinite}#btnGrab.held{opacity:1;background:linear-gradient(#ffb57a,#e0663a)}#btnGrab:active{transform:scale(.93)}'+
'@keyframes grabPulse{50%{box-shadow:0 0 0 7px #ffe38a99,0 3px 12px #0008}}'+
'#grabTip{position:fixed;right:calc(76px + var(--safe-r,0px));bottom:calc(82px + var(--safe-b,0px));z-index:13;max-width:150px;background:#fff3d6f2;border:2px solid #7b4c24;border-radius:12px;padding:5px 9px;font:700 12px/1.2 sans-serif;color:#4a2f12;pointer-events:none;text-align:center}#grabTip[hidden]{display:none}'+
'body:not([data-mode="scene"]) #btnGrab,body:not([data-mode="scene"]) #grabTip{display:none!important}';
document.head.appendChild(css);
btn=document.createElement('button');btn.id='btnGrab';btn.className='hud__btn';btn.type='button';btn.title='Лассо: захватить, тянуть и бросить';btn.setAttribute('aria-label','Лассо: захватить, тянуть и бросить предмет или жителя');btn.textContent='🪢';document.body.appendChild(btn);
tip=document.createElement('div');tip.id='grabTip';tip.hidden=true;document.body.appendChild(tip);
function say(t,ms){tip.textContent=t;tip.hidden=!t;tipTxt=t;if(ms){S&&(S.tipUntil=performance.now()+ms)}}
/* ---------- геометрия для «резиновой руки» ---------- */
function classes(){
 var sc=G.scene,M=null,SM=null,i,q;
 for(i=0;i<sc.meshes.length;i++){q=sc.meshes[i];if(q.getClassName&&q.getClassName()==='Mesh'&&q.getTotalVertices&&q.getTotalVertices()>0){M=q.constructor;break}}
 for(i=0;i<sc.materials.length;i++){q=sc.materials[i];if(q.getClassName&&q.getClassName()==='StandardMaterial'){SM=q.constructor;break}}
 return M&&SM?{M:M,SM:SM}:null}
function mkMesh(C,name,pos,nor,idx,rgb,em){
 var s=new C.M(name,G.scene);s.setVerticesData('position',pos,false);s.setVerticesData('normal',nor,false);s.setIndices(idx);
 var mt=new C.SM(name+'M',G.scene);mt.diffuseColor.set(rgb[0],rgb[1],rgb[2]);mt.specularColor.set(.1,.1,.1);mt.emissiveColor.set(em[0],em[1],em[2]);mt.backFaceCulling=false;
 s.material=mt;s.isPickable=false;s.checkCollisions=false;s.receiveShadows=false;s.setEnabled(false);return s}
function buildViz(){
 var C=classes();if(!C)return null;
 var pos=[],nor=[],idx=[],ns=10,i,a;
 for(i=0;i<=ns;i++){a=6.2832*i/ns;var cx=Math.cos(a)*.5,cy=Math.sin(a)*.5;pos.push(cx,cy,0,cx,cy,1);nor.push(cx*2,cy*2,0,cx*2,cy*2,0)}
 for(i=0;i<ns;i++){var b=i*2;idx.push(b,b+1,b+2,b+2,b+1,b+3)}
 var arm=mkMesh(C,'grabArm',pos,nor,idx,[.42,.22,.09],[.12,.055,.018]);
 var sp=[],sn=[],si=[],nu=18,nv=7,j,x,y,z,th,ph,major=.34,minor=.065;
 for(j=0;j<=nv;j++){th=6.2832*j/nv;for(i=0;i<=nu;i++){ph=6.2832*i/nu;x=(major+minor*Math.cos(ph))*Math.cos(th);y=(major+minor*Math.cos(ph))*Math.sin(th);z=minor*Math.sin(ph);sp.push(x,y,z);sn.push(Math.cos(ph)*Math.cos(th),Math.cos(ph)*Math.sin(th),Math.sin(ph))}}
 for(j=0;j<nv;j++)for(i=0;i<nu;i++){var a0=j*(nu+1)+i,b0=a0+nu+1;si.push(a0,b0,a0+1,a0+1,b0,b0+1)}
 var glove=mkMesh(C,'grabGlove',sp,sn,si,[.88,.62,.22],[.22,.12,.025]);
 return {arm:arm,glove:glove,V:G.player.collider.position.constructor,tgt:new (G.player.collider.position.constructor)(0,0,0)}}
/* ---------- кандидаты ---------- */
function cands(){
 var out=[],K=G._bumpK();
 (G._tankProps||[]).forEach(function(p){if(p.gone||!p.root||p.root.isDisposed())return;var k=K[p.kind];if(!k)return;if(S.held&&S.held.o===p)return;out.push({o:p,t:'p',x:p.root.position.x,z:p.root.position.z,r:k.r,k:k,kind:p.kind})});
 (G._crates||[]).forEach(function(c){if(!c.alive||c.held||c.__fly)return;out.push({o:c,t:'c',x:c.x,z:c.z,r:c.s*.5,k:{h:(c.sy||c.s),m:2.5,heavy:c.s>2.3,r:c.s*.5,v:3,fr:3.2,bounce:.25},kind:'crate'})});
 try{(window.SevNPC&&window.SevNPC.getAll?window.SevNPC.getAll():[]).forEach(function(n){if(!n||!n.vis||n.talking||n.ex&&(n.ex.lassoHold||n.ex.lassoFlight)||n._vehicleDeadUntil)return;out.push({o:n,t:'n',x:n.x,z:n.z,r:.58,k:{h:1.15,m:1.8,heavy:false,r:.58,v:2.8,fr:2.5,bounce:.2},kind:'npc'})})}catch(e){}try{(window.__sevCarNpcs||[]).forEach(function(n){if(!n||!n.vis||n.ex.lassoHold||n.ex.lassoFlight||n.ex.vehiclePassenger)return;out.push({o:n,t:'n',x:n.x,z:n.z,r:1.9,k:{h:1.3,m:3,heavy:true,r:1.9,v:2.2,fr:2.2,bounce:.15},kind:'car'})})}catch(e){}
 return out}
function nearest(){
 var pp=G.player.position,best=null,bd=1e9;
 cands().forEach(function(c){var d=Math.hypot(c.x-pp.x,c.z-pp.z)-c.r;if(d<5.5&&d<bd){bd=d;best=c}});
 return best}
/* ---------- захват ---------- */
function setColl(p,on){p.parts.forEach(function(m){m.checkCollisions=on})}
function tryGrab(){
 var pl=G.player;if(!pl||pl.riding||G.ferris||S.held)return;
 var c=nearest();if(!c){say('Подойди ближе, чтобы зацепить лассо',1800);return}
 var o=c.o,ch,rad=c.r,C0;
 if(c.t==='p'){if(!o.pv)G._bumpWrap(o,c.k);o.bm=false;o._lying=false;o.pv.rotation.set(0,0,0);o.root.position.y=0;setColl(o,false);ch=c.k.h;o._bc=1}
 else if(c.t==='c'){o.held=true;o.__fly=false;o.mesh.rotation.x=0;o.mesh.rotation.z=0;ch=(o.sy||o.s)/2;o.y=Math.max(0,o.y)}
 else {o.ex.lassoHold=true;o.ex.lassoFlight=null;o.speed=0;o.mode='idle';o.collider.checkCollisions=false;ch=c.k.h}
 var by=c.t==='p'?o.root.position.y:(c.t==='c'?o.y:o.y);
 S.held={o:o,t:c.t,k:c.k,kind:c.kind,ch:ch,rad:rad,L:1.3+rad*.7,C:{x:c.x,y:by+ch+.25,z:c.z},V:{x:0,y:2,z:0},Ap:null,yaw:0,heavy:!!c.k.heavy};
 if(!S.viz)S.viz=buildViz();
 try{G._bumpSound(520,.09);G._bumpFx(c.x,c.z,.5,false)}catch(e){}
 if(!S.hinted){S.hinted=1;say('🪢 Лассо: отпусти, чтобы швырнуть · удерживай, чтобы отпустить аккуратно',5000)}
}
function anchor(){
 var pl=G.player,pp=pl.position,h=pl.heading,fx=Math.sin(h),fz=Math.cos(h),rx=fz,rz=-fx;
 return {x:pp.x+rx*.55+fx*.35,y:pp.y+.85,z:pp.z+rz*.55+fz*.35}}
function release(mode){
 var H=S.held;if(!H)return;S.held=null;
 var pl=G.player,pv=pl.velocity,h=pl.heading,fx=Math.sin(h),fz=Math.cos(h),vx,vy,vz;
 var Va=S.Va||{x:0,y:0,z:0},rel={x:H.V.x-Va.x,y:H.V.y-Va.y,z:H.V.z-Va.z};
 if(mode==='throw'){
  var s=(H.heavy?6:9.5);vx=pv.x+fx*s+rel.x*.55;vz=pv.z+fz*s+rel.z*.55;vy=(H.heavy?4.5:6.5)+clamp(rel.y*.4,-2,3);
  var hs=Math.hypot(vx,vz),mx=H.heavy?11:17;if(hs>mx){vx*=mx/hs;vz*=mx/hs}
  try{G._bumpSound(260,.12)}catch(e){}
 }else{vx=pv.x*.4+fx*1.2;vz=pv.z*.4+fz*1.2;vy=1.6;try{G._bumpSound(150,.08)}catch(e){}}
 var nx=vx,nz=vz,hl=Math.hypot(nx,nz)||1;nx/=hl;nz/=hl;
 var by=H.C.y-H.ch;by=Math.max(0,by);
 if(H.t==='p'){
  var p=H.o;p.root.position.y=by;p.bm=true;p._bc=.7;p.bvx=vx;p.bvz=vz;p.bvy=vy;p.bsp=mode==='throw'?9:2;p.bax=Math.abs(nx)>Math.abs(nz)?'z':'x';p.bsg=p.bax==='z'?-Math.sign(nx||1):Math.sign(nz||1);p._lying=false;p.sx=void 0;p.sz=void 0;
  S.thrown.push({p:p,t:0,big:mode==='throw'});
 }else if(H.t==='c'){
  var c=H.o;c.__fly=true;c.held=false;c.x=H.C.x;c.z=H.C.z;c.y=by;S.cr.push({c:c,vx:vx,vy:vy,vz:vz,t:0,sp:mode==='throw'?6:1,big:mode==='throw'})
 }else{
  var n=H.o;n.x=H.C.x;n.z=H.C.z;n.y=by;n.ex.lassoHold=false;n.ex.lassoFlight={t:0,vx:vx,vy:vy,vz:vz};n.collider.position.set(n.x,n.y,n.z);n.collider.checkCollisions=false;n.speed=Math.hypot(vx,vz);n.gesture('hop');
 }
 if(mode==='throw')scare(H.C.x,H.C.z,6.5,true);
}
function scare(x,z,r,big){try{window.SevNPC&&window.SevNPC.scold&&window.SevNPC.scold(x,z,{r:r,big:!!big})}catch(e){}}
/* ---------- кадр ---------- */
function frame(now){
 var dt=Math.min(.05,(now-lastT)/1000);lastT=now;
 try{
  var g=window.__sevGame;
  if(g!==G){G=g;S=null}
  if(G&&G.scene&&!G.scene.isDisposed&&G.player&&G.player.collider){
   if(!S){S={held:null,thrown:[],cr:[],viz:null,acc:0,hinted:0,tipUntil:0,Va:{x:0,y:0,z:0}};say('')}
   update(dt,now)
  }
 }catch(e){if(!window.__grabErr)window.__grabErr=e.stack}
 requestAnimationFrame(frame)}
function update(dt,now){
 var pl=G.player,pp=pl.position,hide=pl.riding||G.ferris||(G.card&&G.card.isOpen)||document.body.classList.contains('in-shop')||pl._swimming;
 btn.style.display=hide?'none':'';
 if(hide&&S.held){if(S.held.t==='n'&&pl.riding){var __passenger=S.held.o;__passenger.ex=__passenger.ex||{};__passenger.ex.vehiclePassenger=true;__passenger.ex.lassoHold=true;__passenger.ex.lassoFlight=null;__passenger.speed=0;__passenger.mode='idle';if(__passenger.collider)__passenger.collider.checkCollisions=false;S.held=null;S.Ap=null;}else release('drop');}
 /* подсказка и состояние кнопки */
 var nr=(!S.held&&!hide)?nearest():null;
 btn.classList.toggle('near',!!nr);btn.classList.toggle('held',!!S.held);btn.textContent=S.held?'🪢':'🪢';
 if(now>S.tipUntil){var want=S.held?'':(nr?'🪢 Захватить '+(NAMES[nr.kind]||'предмет'):'');if(want!==tipTxt)say(want)}
 /* удерживаемый предмет */
 var H=S.held,viz=S.viz;
 if(H){
  var A=anchor(),Va=S.Ap?{x:(A.x-S.Ap.x)/Math.max(dt,.001),y:(A.y-S.Ap.y)/Math.max(dt,.001),z:(A.z-S.Ap.z)/Math.max(dt,.001)}:{x:0,y:0,z:0};
  S.Ap=A;S.Va=Va;
  var C=H.C,V=H.V,n=2,sub=dt/n,i;
  for(i=0;i<n;i++){
   V.y-=16*sub;C.x+=V.x*sub;C.y+=V.y*sub;C.z+=V.z*sub;
   if(C.y<H.ch){C.y=H.ch;if(V.y<0)V.y=0;var gf=Math.exp(-2.6*sub);V.x*=gf;V.z*=gf}
   var dx=C.x-A.x,dy=C.y-A.y,dz=C.z-A.z,d=Math.hypot(dx,dy,dz)||1e-3;
   if(d>H.L){var ux=dx/d,uy=dy/d,uz=dz/d;C.x=A.x+ux*H.L;C.y=Math.max(H.ch,A.y+uy*H.L);C.z=A.z+uz*H.L;
    var vr=(V.x-Va.x)*ux+(V.y-Va.y)*uy+(V.z-Va.z)*uz;if(vr>0){V.x-=ux*vr;V.y-=uy*vr;V.z-=uz*vr}
    /* поводок тянет вслед за рукой */
    var pk=Math.min(1,sub*(H.heavy?5:9));V.x+=(Va.x-V.x)*pk*.35;V.z+=(Va.z-V.z)*pk*.35}
   var dm=Math.exp(-(H.heavy?.9:.4)*sub);V.x*=dm;V.y*=dm;V.z*=dm}
  var hd=Math.hypot(C.x-A.x,C.z-A.z),by=C.y-H.ch;if(hd>.3)H.yaw=Math.atan2(C.x-A.x,C.z-A.z);
  var tx=clamp((V.z-Va.z)*.045,-.55,.55),tz=clamp(-(V.x-Va.x)*.045,-.55,.55);
  if(H.t==='p'){var R=H.o.root;R.position.set(C.x,Math.max(0,by),C.z);R.rotation.y=H.yaw;H.o.pv.rotation.x=tx;H.o.pv.rotation.z=tz;H.o._bc=1;H.o.x=C.x;H.o.z=C.z}
  else if(H.t==='c'){var c2=H.o;c2.x=C.x;c2.z=C.z;c2.y=Math.max(0,by);c2.mesh.position.set(C.x,Math.max(c2.sy/2,C.y),C.z);c2.mesh.rotation.y=H.yaw;c2.mesh.rotation.x=tx;c2.mesh.rotation.z=tz}
  else{var n2=H.o;n2.x=C.x;n2.z=C.z;n2.y=Math.max(0,by);n2.heading=H.yaw;n2.rig.root.position.set(C.x,n2.y,C.z);n2.rig.root.rotation.y=H.yaw;n2.collider.position.set(C.x,n2.y,C.z);n2.rig.root.rotation.x=tx;n2.rig.root.rotation.z=tz}
  /* резиновая рука */
  if(viz){var ex=C.x,ey=C.y+H.rad*.2,ez=C.z,ax=A.x-ex,ay=A.y-ey,az=A.z-ez,al=Math.hypot(ax,ay,az)||1,k=H.rad*.5/al;ex+=ax*k;ey+=ay*k;ez+=az*k;
   var mx=(A.x+ex)/2,my=(A.y+ey)/2,mz=(A.z+ez)/2,len=Math.hypot(A.x-ex,A.y-ey,A.z-ez);
   viz.arm.setEnabled(len>.05);viz.glove.setEnabled(true);
   viz.arm.position.set(mx,my,mz);viz.arm.scaling.set(.16,.16,Math.max(.05,len));viz.tgt.set(ex,ey,ez);viz.arm.lookAt(viz.tgt);
   viz.glove.position.set(ex,ey,ez);viz.glove.scaling.setAll(.34)}
  /* жители пугаются размахивания */
  var sp=Math.hypot(V.x-Va.x,V.y-Va.y,V.z-Va.z);S.acc+=dt;
  if(S.acc>.2){S.acc=0;if(sp>6)scare(C.x,C.z,4.5,false)}
 }else{S.Ap=null;if(viz){viz.arm.setEnabled(false);viz.glove.setEnabled(false)}}
 /* брошенные предметы-реквизит: ждём остановки, потом возвращаем коллизии */
 for(var q=S.thrown.length-1;q>=0;q--){var e=S.thrown[q],p=e.p;e.t+=dt;
  var spd=Math.hypot(p.bvx||0,p.bvz||0);
  if(p.bm&&spd>2.2&&e.t<6){e.sc=(e.sc||0)+dt;if(e.sc>.2){e.sc=0;scare(p.root.position.x,p.root.position.z,5,false)}}
  if(!p.bm||e.t>8){
   if(p.bm){p.bm=false;p.pv.rotation.set(0,0,0);p.root.position.y=0}
   setColl(p,true);fixObst(p.root.position,Math.max(.5,(G._bumpK()[p.kind]||{r:.6}).r));p.x=p.root.position.x;p.z=p.root.position.z;S.thrown.splice(q,1)}}
 /* брошенные ящики: своя простая физика */
 for(q=S.cr.length-1;q>=0;q--){var f=S.cr[q],c=f.c;f.t+=dt;
  f.vy-=16*dt;c.y+=f.vy*dt;c.x+=f.vx*dt;c.z+=f.vz*dt;
  var on=false;if(c.y<=0){c.y=0;on=true;if(f.vy<-2.2){f.vy=-f.vy*.25;try{G._bumpSound(90,.06);G._bumpFx(c.x,c.z,.5,false)}catch(e2){}}else f.vy=0}
  var gm=Math.exp(-(on?3.4:.25)*dt);f.vx*=gm;f.vz*=gm;
  var m=c.mesh;m.position.set(c.x,c.y+(c.sy||c.s)/2,c.z);
  if(on){m.rotation.x*=Math.exp(-9*dt);m.rotation.z*=Math.exp(-9*dt)}else{m.rotation.x+=f.sp*dt;m.rotation.z+=f.sp*.6*dt}
  var fs=Math.hypot(f.vx,f.vz);
  if(fs>2.2&&f.t<6){f.sc=(f.sc||0)+dt;if(f.sc>.2){f.sc=0;scare(c.x,c.z,5,false)}}
  if(on&&fs<.35&&Math.abs(f.vy)<.5||f.t>8){var qq={x:c.x,z:c.z};fixObstXZ(qq,c.s*.5);c.x=qq.x;c.z=qq.z;m.position.set(c.x,(c.sy||c.s)/2,c.z);m.rotation.x=0;m.rotation.z=0;c.y=0;c.vy=0;c.__fly=false;S.cr.splice(q,1)}}
}
function fixObst(pos,r){var q={x:pos.x,z:pos.z};fixObstXZ(q,r);pos.x=q.x;pos.z=q.z}
function fixObstXZ(q,r){try{var ob=G.world&&G.world.ctx&&G.world.ctx.obstacles;if(ob&&ob.resolve)ob.resolve(q,r)}catch(e){}}
/* ---------- ввод ---------- */
var pdown=false,lpT=0,lpDone=false;
btn.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();if(!S||!G)return;pdown=true;lpDone=false;clearTimeout(lpT);lpT=setTimeout(function(){if(pdown&&S&&S.held){lpDone=true;release('drop')}},450)});
function up(e){if(e)e.preventDefault();clearTimeout(lpT);if(!pdown)return;pdown=false;if(lpDone||!S||!G)return;if(S.held)release('throw');else tryGrab()}
btn.addEventListener('pointerup',up);
['pointercancel','pointerleave'].forEach(function(ev){btn.addEventListener(ev,function(){clearTimeout(lpT);pdown=false})});
window.addEventListener('keydown',function(e){if(!S||!G||e.repeat)return;if(e.code==='KeyH'){if(S.held)release('throw');else tryGrab()}else if(e.code==='KeyQ'&&S.held)release('drop')});
window.__grabState=function(){return S&&{held:!!S.held,thrown:S.thrown.length,cr:S.cr.length}};
requestAnimationFrame(frame);
})();

