
(function(){
'use strict';
var KEY='sevatm1',TODS=['morning','day','evening','night'];
/* ключевые состояния суток: небо, туман, свет, море, фонари, окна */
var K={
 morning:{sky:[.74,.81,.88],fog:[.88,.85,.80],hk:.9,hc:[1,.94,.86],sk:.78,sc:[1,.84,.66],dir:[-.55,-.42,-.45],sea:[1,.96,.93],lamp:.15,win:0,lvl:1,warm:.15},
 day:{sky:[.56,.80,.98],fog:[.80,.91,.98],hk:1.1,hc:[1,1,.97],sk:1.3,sc:[1,.97,.9],dir:null,sea:[1,1,1],lamp:0,win:0,lvl:1,warm:0},
 evening:{sky:[.96,.55,.33],fog:[.96,.66,.48],hk:.85,hc:[1,.78,.62],sk:.95,sc:[1,.58,.3],dir:[.78,-.2,.62],sea:[1,.72,.55],lamp:1,win:.7,lvl:.95,warm:.85},
 night:{sky:[.10,.14,.33],fog:[.13,.18,.36],hk:.88,hc:[.64,.72,1],sk:.55,sc:[.66,.74,1],dir:[-.35,-.7,.55],sea:[.42,.52,.82],lamp:1,win:1,lvl:.55,warm:.6}
};
var W={
 sunny:{cl:0,gr:0,lt:1,fg:1,rain:0,sn:0,wind:.15},
 light:{cl:.4,gr:.1,lt:.96,fg:1,rain:0,sn:0,wind:.3},
 cloudy:{cl:.9,gr:.4,lt:.82,fg:.9,rain:0,sn:0,wind:.4},
 rain:{cl:1,gr:.5,lt:.78,fg:.78,rain:1,sn:0,wind:.5},
 snow:{cl:.95,gr:.4,lt:.88,fg:.8,rain:0,sn:1,wind:.2},
 wind:{cl:.3,gr:.08,lt:.98,fg:1,rain:0,sn:0,wind:1}
};
var TN={morning:['🌅','Утро'],day:['☀️','День'],evening:['🌇','Вечер'],night:['🌙','Ночь'],auto:['🔄','Авто']};
var WN={sunny:['☀️','Солнечно'],light:['🌤','Лёгкая облачность'],cloudy:['☁️','Облачно'],rain:['🌦','Лёгкий дождь'],wind:['🌬','Морской ветер'],snow:['❄️','Снег']};
var st={tod:(/[?&]tod=(morning|day|evening|night)/.exec(location.search)||[0,'auto'])[1],wx:'sunny'};var CYC=2400,wxAuto=true,wxT=120+Math.random()*80,snowC=0;

function save(){}
function mx(a,b,t){return a+(b-a)*t}
var game=null,sc=null,base=null,cur=null,T=1,wet=0,started=0,last=performance.now(),autoT=Math.random()*4;
var deco=[],decoMats=null,decoOn=false,decoCnt=0,fly=[],flyOn=false,halos=[],glassM=[],bulbM=[],warmM=[],seaM=[],flags=[],trees=[],facM=[],nightTex=new Map(),discoverAt=0,wetM=[];
function vec(t){ /* t∈[0,4): интерполяция между ключами */
 var i=Math.floor(t)%4,j=(i+1)%4,f=t-Math.floor(t);f=Math.min(1,Math.max(0,(f-.25)/.5));f=f*f*(3-2*f);var a=K[TODS[i]],b=K[TODS[j]],B=base,o={};
 function g(k,key){var v=k[key];return v||B[key]}
 ['sky','fog','sc','hc','sea'].forEach(function(key){var x=g(a,key),y=g(b,key);o[key]=[mx(x[0],y[0],f),mx(x[1],y[1],f),mx(x[2],y[2],f)]});
 var da=a.dir||B.dir,db=b.dir||B.dir;o.dir=[mx(da[0],db[0],f),mx(da[1],db[1],f),mx(da[2],db[2],f)];
 ['hk','sk','lamp','win','lvl','warm'].forEach(function(key){o[key]=mx(a[key],b[key],f)});return o}
function bind(){
 var g=window.__sevGame;if(!g||!g.scene||g===game)return;game=g;sc=g.scene;started=performance.now();
 var hemi=sc.lights.filter(function(l){return l.name==='hemi'})[0],sun=sc.lights.filter(function(l){return l.name==='sun'})[0];
 var cc=sc.clearColor,fc=sc.fogColor;
 base={sky:[cc.r,cc.g,cc.b],fog:fc?[fc.r,fc.g,fc.b]:[.83,.93,.97],fs:sc.fogStart,fe:sc.fogEnd,hemi:hemi,sun:sun,
  hI:hemi?hemi.intensity:.5,hD:hemi?[hemi.diffuse.r,hemi.diffuse.g,hemi.diffuse.b]:[1,1,1],hG:hemi&&hemi.groundColor?[hemi.groundColor.r,hemi.groundColor.g,hemi.groundColor.b]:null,
  sI:sun?sun.intensity:.6,sD:sun?[sun.diffuse.r,sun.diffuse.g,sun.diffuse.b]:[1,1,1],dir:sun?[sun.direction.x,sun.direction.y,sun.direction.z]:[-.5,-.8,-.4],sc:[1,1,1],hc:[1,1,1],sea:[1,1,1]};
 var d=base.dir,l=Math.hypot(d[0],d[1],d[2])||1;base.dir=[d[0]/l,d[1]/l,d[2]/l];
 K.day.dir=base.dir;
 deco=[];decoMats=null;decoOn=false;decoCnt=0;fly=[];flyOn=false;halos=[];glassM=[];bulbM=[];warmM=[];seaM=[];flags=[];trees=[];facM=[];wetM=[];nightTex=new Map();cur=null;discoverAt=performance.now()+1500;
}
function discover(){
 if(!sc)return;var seenM=new Set(),bulbSrc=null;
 sc.meshes.forEach(function(m){var n=m.name,mat=m.material;
  if(/^lampBulb/.test(n)){if(!bulbSrc)bulbSrc=m;if(mat&&mat.emissiveColor&&bulbM.indexOf(mat)<0){bulbM.push(mat);mat.__e0=mat.emissiveColor.clone()}if(!m.__atmH){m.__atmH=1;halos.push({m:m,x:null})}}
  else if(/^(gLan|plan2?).*-glass$/.test(n)){if(mat&&mat.emissiveColor&&glassM.indexOf(mat)<0){glassM.push(mat);mat.__e0=mat.emissiveColor.clone()}if(!m.__atmH){m.__atmH=1;halos.push({m:m,x:null})}}
  else if(/^(col-(?!collider)|graf-pav|graf-entab|graf-attic|graf-cornice|graf-stairwall|graf-parapet)/.test(n)&&mat&&mat.emissiveColor&&!seenM.has(mat)){seenM.add(mat);warmM.push(mat);mat.__e0=mat.emissiveColor.clone()}
  else if(n==='c9-glass'){if(mat&&mat.emissiveColor&&glassM.indexOf(mat)<0){glassM.push(mat);mat.__e0=mat.emissiveColor.clone()}}
   else if(n==='sea'||n==='seaWaves'){if(mat&&mat.diffuseColor&&seaM.indexOf(mat)<0){seaM.push(mat);mat.__d0=mat.diffuseColor.clone()}}
  else if(n==='flag'||/^graf-flag/.test(n)){m.unfreezeWorldMatrix&&m.unfreezeWorldMatrix();flags.push({m:m,r:m.rotation.y,ph:Math.random()*6})}
  else if(/^(cypress|plane|palm|planeCol|pine|poplar)/.test(n)&&!/Col$/.test(n)){trees.push({m:m,ph:Math.random()*6,on:false,r:[m.rotation.x,m.rotation.z]})}
  else if(n==='ground'||n==='road'||n==='graf-cobble'){if(mat&&mat.specularColor&&wetM.indexOf(mat)<0){wetM.push(mat);mat.__s0=mat.specularColor.clone();mat.__p0=mat.specularPower;mat.__em0=mat.emissiveColor?mat.emissiveColor.clone():null}}
 });
 if(!base.c9){base.c9=1;if(sc.getMeshByName('c9-glass'))(window.__c9Lamps||[]).forEach(function(p){halos.push({m:{getAbsolutePosition:function(){return {x:p[0],y:p[1],z:p[2]}}},x:null})})}
 if(!base.amb&&sc.ambientColor){base.amb=[sc.ambientColor.r,sc.ambientColor.g,sc.ambientColor.b]}
 if(!sc.__seaDim){var sw0=sc.getMeshByName('seaWaves');if(sw0){var dm=new sc.materials[0].constructor('seaDimM',sc);dm.disableLighting=true;dm.diffuseColor.set(0,0,0);dm.specularColor.set(0,0,0);dm.emissiveColor.set(.02,.05,.14);dm.alpha=0;dm.backFaceCulling=false;dm.freeze&&0;var pl=sw0.constructor.CreateGround?null:null;var dsm=sc.getMeshByName('sea')||sw0;var mk=dsm.clone('seaDim');mk.material=dm;mk.isPickable=false;mk.checkCollisions=false;mk.receiveShadows=false;mk.position.y=(sc.getMeshByName('sea')||sw0).position.y+.05;mk.scaling.x=Math.max(mk.scaling.x,1);mk.setEnabled(false);sc.__seaDim=mk;sc.__seaDimM=dm}}
 sc.materials.forEach(function(mt){var t=mt.diffuseTexture;if(t&&t.name&&(/^facade-/.test(t.name)&&t.__p||t.__night)&&mt.emissiveColor&&facM.indexOf(mt)<0){facM.push(mt);mt.__day=t;mt.__e0=mt.emissiveColor.clone()}});
 /* ореолы фонарей: клоны шара-лампочки, без света, полупрозрачные */
 if(bulbSrc&&halos.length&&!halos[0].h){
  var hm=bulbSrc.material.clone('lampHaloM');hm.disableLighting=true;hm.emissiveColor.set(1,.78,.4);hm.diffuseColor.set(0,0,0);hm.specularColor.set(0,0,0);hm.alpha=.34;hm.backFaceCulling=false;
  halos.forEach(function(o,i){var h=bulbSrc.clone('lampHalo'+i);h.material=hm;h.isPickable=false;h.checkCollisions=false;h.unfreezeWorldMatrix&&h.unfreezeWorldMatrix();var p=o.m.getAbsolutePosition();h.position.copyFrom(p);h.scaling.setAll(3.4);h.setEnabled(false);h.receiveShadows=false;o.h=h})}
 makeDeco();
}
function makeDeco(){
 if(base.deco||!sc)return;
 var lms=[];try{lms=(game&&game.world&&game.world.landmarks)||[]}catch(e){}
 base.dt=(base.dt||0)+1;
 if(!halos.length&&!lms.length&&base.dt<8)return;
 var M=null,SM=null,i,q;
 for(i=0;i<sc.meshes.length;i++){q=sc.meshes[i];if(q.getClassName&&q.getClassName()==='Mesh'&&q.getTotalVertices&&q.getTotalVertices()>0){M=q.constructor;break}}
 for(i=0;i<sc.materials.length;i++){q=sc.materials[i];if(q.getClassName&&q.getClassName()==='StandardMaterial'){SM=q.constructor;break}}
 if(!M||!SM){if(base.dt>=8)base.deco=1;return}
 base.deco=1;
 var pos=[],nor=[],idx=[],nu=10,nv=6,j,x,y,z,th,ph,r,a0,b0;
 for(j=0;j<=nv;j++){th=Math.PI*j/nv;y=Math.cos(th);r=Math.sin(th);for(i=0;i<=nu;i++){ph=2*Math.PI*i/nu;x=r*Math.cos(ph);z=r*Math.sin(ph);pos.push(x*.5,y*.5,z*.5);nor.push(x,y,z)}}
 for(j=0;j<nv;j++)for(i=0;i<nu;i++){a0=j*(nu+1)+i;b0=a0+nu+1;idx.push(a0,b0,a0+1,a0+1,b0,b0+1)}
 var cols=[[1,.8,.38],[1,.45,.72],[.38,.95,.92],[.72,.58,1],[1,.72,.36]],srcs=[];decoMats=[];
 cols.forEach(function(c,k){var s=new M('atmOrb'+k,sc);s.setVerticesData('position',pos,false);s.setVerticesData('normal',nor,false);s.setIndices(idx);
  var mt=new SM('atmOrbM'+k,sc);mt.disableLighting=true;mt.diffuseColor.set(0,0,0);mt.specularColor.set(0,0,0);mt.emissiveColor.set(c[0],c[1],c[2]);mt.alpha=0;mt.alphaMode=1;mt.backFaceCulling=false;mt.fogEnabled=false;
  s.material=mt;s.isPickable=false;s.checkCollisions=false;s.receiveShadows=false;s.isVisible=false;s.position.set(0,-500,0);srcs.push(s);decoMats.push(mt)});
 function mk(si,px,py,pz,sx,sy,sz){if(decoCnt>900)return null;var m=srcs[si].createInstance('atmI'+decoCnt);decoCnt++;m.position.set(px,py,pz);m.scaling.set(sx,sy,sz);m.isPickable=false;m.checkCollisions=false;m.receiveShadows=false;m.setEnabled(false);deco.push(m);return m}
 var cells={},spots=[];
 halos.forEach(function(o){var p;try{p=o.m.getAbsolutePosition()}catch(e){return}if(!p)return;var k=Math.round(p.x/8)+','+Math.round(p.z/8);if(cells[k])return;cells[k]=1;spots.push({x:p.x,y:p.y,z:p.z})});
 if(spots.length>110)spots.length=110;
 spots.forEach(function(s,n){
  if(s.y<6){mk(4,s.x,.08,s.z,6.5,.05,6.5);
   for(var k=0;k<3;k++){var an=n*1.7+k*2.09,rr=1.3+((n+k)%3)*.5;mk((n+k)%4,s.x+Math.cos(an)*rr,s.y-.5-((n+k)%3)*.55,s.z+Math.sin(an)*rr,.3,.3,.3)}
  }else mk(n%4,s.x,s.y,s.z,.35,.35,.35)});
 lms.forEach(function(lm,li){if(!lm.position)return;var rr=Math.max(2.2,Math.min(6,(lm.radius||4)*.6)),by=((lm.marker&&lm.marker.base)||0)+.7,nb=10;
  for(var k=0;k<nb;k++){var an=k/nb*6.283;mk((k+li)%4,lm.position.x+Math.cos(an)*rr,by,lm.position.z+Math.sin(an)*rr,.28,.28,.28)}});
 for(i=0;i<30;i++){var fm=mk(i%4,0,-500,0,.16,.16,.16);if(fm){deco.pop();fly.push({m:fm,a:Math.random()*6.28,r:3+Math.random()*13,s:(.08+Math.random()*.25)*(i%2?1:-1),h:.3+Math.random()*2.4})}}
 spots.forEach(function(s,n){
  if(s.y>=6)return;var c2=0;
  for(var k=n-1;k>=0&&c2<1;k--){var o=spots[k];if(o.y>=6)continue;var dx=o.x-s.x,dz=o.z-s.z,d=Math.hypot(dx,dz);if(d<5||d>18)continue;c2++;
   var nb=Math.max(3,Math.floor(d/1.5)),sag=Math.min(1.3,d*.08);
   for(var b=1;b<nb;b++){var t=b/nb;mk((b+n)%4,s.x+dx*t,mx(s.y,o.y,t)-.2-sag*4*t*(1-t),s.z+dz*t,.2,.2,.2)}}});
}
function nightOf(mt){
 var t=mt.__day;if(t&&t.__night)return t.__night;if(!t||!t.__p)return null;var k=t.name;var n=nightTex.get(k);if(!n&&window.__sevFacadeNight){try{n=window.__sevFacadeNight(t);nightTex.set(k,n)}catch(e){n=null}}return n}
/* UI */
var css=document.createElement('style');css.textContent=
"#atmBtn{font-size:22px}#atmPanel{position:fixed;right:10px;top:66px;width:min(300px,calc(100vw - 20px));z-index:9100;background:#fff8e4;border:3px solid #e0b04a;border-radius:18px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.45);color:#4a2f12;animation:atIn .25s ease-out}#atmPanel[hidden]{display:none}@keyframes atIn{from{opacity:0;transform:translateY(-8px)}}"+
"#atmPanel h4{margin:6px 0 6px;font-size:15px}.atmRow{display:flex;flex-wrap:wrap;gap:6px}.atmC{border:2px solid #d8b66a;background:#fff;border-radius:12px;padding:7px 9px;font:700 13px/1.1 inherit;color:#4a2f12}.atmC.on{background:linear-gradient(#ffe38a,#f0b83c);border-color:#a8742a}.atmE{width:100%;margin-top:10px;padding:10px;border:3px solid #a8742a;border-radius:14px;background:linear-gradient(#ffb57a,#e0663a);color:#fff;font:800 15px/1 inherit}"+
"#atmClouds{position:fixed;left:0;top:0;width:100%;height:42%;pointer-events:none;z-index:2;overflow:hidden;opacity:0;transition:opacity 2s}#atmClouds i{position:absolute;display:block;border-radius:50%;background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,.95),rgba(255,255,255,0) 70%);filter:blur(10px);animation:atDr linear infinite}@keyframes atDr{from{transform:translateX(-70vw)}to{transform:translateX(120vw)}}"+
"#atmRain{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;opacity:0;transition:opacity 1.5s}#atmVig{position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;transition:opacity 2s;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(5,10,30,.5) 100%)}";
document.head.appendChild(css);
var clouds=document.createElement('div');clouds.id='atmClouds';
[[8,24,18,95],[26,40,14,125],[3,30,22,150],[18,52,12,110],[34,36,16,170]].forEach(function(c){var e=document.createElement('i');e.style.cssText='top:'+c[0]+'%;width:'+c[1]+'vw;height:'+c[2]+'vh;animation-duration:'+c[3]+'s;animation-delay:-'+(c[3]*c[0]/40)+'s';clouds.appendChild(e)});
document.body.appendChild(clouds);
var vig=document.createElement('div');vig.id='atmVig';document.body.appendChild(vig);
var rc=document.createElement('canvas');rc.id='atmRain';document.body.appendChild(rc);
var panel=document.createElement('div');panel.id='atmPanel';panel.hidden=true;document.body.appendChild(panel);
var btn=null;
function build(){
 panel.innerHTML='<h4>🕒 Время суток</h4><div class="atmRow" id="atmT"></div><h4>🌦 Погода</h4><div class="atmRow" id="atmW"></div><button class="atmE" type="button" id="atmEve">🌇 Вечерняя прогулка</button>';
 var tr=panel.querySelector('#atmT'),wr=panel.querySelector('#atmW');
 ['morning','day','evening','night','auto'].forEach(function(k){var b=document.createElement('button');b.type='button';b.className='atmC'+(st.tod===k?' on':'');b.textContent=TN[k][0]+' '+TN[k][1];b.onclick=function(){st.tod=k;if(k==='auto')autoT=cur&&typeof cur.t==='number'?cur.t:1;save();build();icon()};tr.appendChild(b)});
 Object.keys(WN).forEach(function(k){var b=document.createElement('button');b.type='button';b.className='atmC'+(st.wx===k?' on':'');b.textContent=WN[k][0]+' '+WN[k][1];b.onclick=function(){st.wx=k;save();build();icon()};wr.appendChild(b)});
 panel.querySelector('#atmEve').onclick=function(){st.tod='evening';st.wx=st.wx==='rain'?'light':st.wx;save();build();icon();panel.hidden=true};
}
function icon(){if(btn)btn.textContent=(st.tod==='auto'?'🔄':TN[st.tod][0])}
function mount(){return;var m=document.getElementById('btnMusic');if(!m)return;
 btn=m.cloneNode(false);btn.id='atmBtn';btn.removeAttribute('title');btn.setAttribute('aria-label','Время суток и погода');btn.onclick=function(e){e.stopPropagation();build();panel.hidden=!panel.hidden};
 m.parentNode.insertBefore(btn,document.getElementById('btnBack')||m.nextSibling);icon();
}
document.addEventListener('pointerdown',function(e){if(!panel.hidden&&!panel.contains(e.target)&&e.target!==btn)panel.hidden=true},true);
/* дождь */
var drops=[],rctx=rc.getContext('2d'),rw=0,rh=0;
function rsize(){rw=rc.width=Math.max(160,Math.round(innerWidth/2));rh=rc.height=Math.max(280,Math.round(innerHeight/2))}rsize();addEventListener('resize',rsize);
for(var i=0;i<110;i++)drops.push({x:Math.random(),y:Math.random(),l:.03+Math.random()*.05,s:.9+Math.random()*.8});
var rainOn=false,flakes=[];
for(var fi=0;fi<70;fi++)flakes.push({x:Math.random(),y:Math.random(),r:.8+Math.random()*1.5,s:.05+Math.random()*.09,ph:Math.random()*6});
function drawSnow(dt,wind,k){
 rctx.fillStyle='rgba(255,255,255,.8)';var tt=performance.now()/1000;
 for(var i=0;i<flakes.length;i++){var f=flakes[i];if(i/flakes.length>k)continue;f.y+=f.s*dt*1.3;f.x+=(Math.sin(tt*.8+f.ph)*.02-wind*.03)*dt;if(f.y>1.03){f.y=-.03;f.x=Math.random()}if(f.x<-.05)f.x=1.05;if(f.x>1.05)f.x=-.05;
  rctx.beginPath();rctx.arc(f.x*rw,f.y*rh,f.r,0,6.283);rctx.fill()}
}
window.__sevSetWx=function(w){if(W[w]){st.wx=w;wxT=900}};var WP=[['sunny',3],['light',3],['cloudy',2],['rain',1.5],['snow',1.2],['wind',1]];
function pickWx(){if(window.__sevRealWx&&W[window.__sevRealWx]){st.wx=window.__sevRealWx;wxT=900;return}var tot=0,i;WP.forEach(function(w){if(w[0]!==st.wx)tot+=w[1]});var r=Math.random()*tot;for(i=0;i<WP.length;i++){if(WP[i][0]===st.wx)continue;r-=WP[i][1];if(r<=0)break}if(i>=WP.length)i=0;st.wx=WP[i][0];wxT=(st.wx==='rain'||st.wx==='snow')?90+Math.random()*90:180+Math.random()*150}
function drawRain(dt,wind){
 rctx.clearRect(0,0,rw,rh);rctx.strokeStyle='rgba(205,225,245,.42)';rctx.lineWidth=1.2;rctx.beginPath();
 var sl=.12+wind*.25;
 for(var i=0;i<drops.length;i++){var d=drops[i];d.y+=d.s*dt*1.6;d.x-=d.s*dt*sl*.8;if(d.y>1){d.y=-.05;d.x=Math.random()*1.2}if(d.x<-.1)d.x=1.05;
  var x=d.x*rw,y=d.y*rh;rctx.moveTo(x,y);rctx.lineTo(x-d.l*rh*sl,y+d.l*rh)}
 rctx.stroke();
}
/* главный цикл */
function frame(now){
 var dt=Math.min(.1,(now-last)/1000);last=now;
 try{bind();mount();
 if(sc&&!sc.isDisposed&&base){
  if(discoverAt&&now>discoverAt){discoverAt=now+4000;discover();if(!base.found){base.found=1}}
  var tgtT=TODS.indexOf(st.tod);
  if(st.tod==='auto'){autoT=(autoT+dt*4/CYC)%4;tgtT=autoT}
  if(wxAuto){wxT-=dt;if(wxT<=0)pickWx()}
  var tv=vec(tgtT<0?1:tgtT),wv=W[st.wx]||W.sunny;
  window.__sevAtmCur=function(){return cur};if(!cur){cur={v:tv,cl:wv.cl,gr:wv.gr,lt:wv.lt,fg:wv.fg,rain:wv.rain,sn:wv.sn,wind:wv.wind,t:tgtT}}
  var a=1-Math.exp(-dt/(st.tod==='auto'?.4:2.6)),b=1-Math.exp(-dt/5);
  var v=cur.v;
  ['sky','fog','sc','hc','sea','dir'].forEach(function(k){for(var i=0;i<3;i++)v[k][i]=mx(v[k][i],tv[k][i],a)});
  ['hk','sk','lamp','win','lvl','warm'].forEach(function(k){v[k]=mx(v[k],tv[k],a)});
  ['cl','gr','lt','fg','rain','sn','wind'].forEach(function(k){cur[k]=mx(cur[k],wv[k],b)});cur.t=tgtT;
  wet=Math.max(0,Math.min(1,wet+(cur.rain>.5?dt/18:-dt/110)));snowC=Math.max(0,Math.min(1,snowC+(cur.sn>.5?dt/45:-dt/160)));
  /* небо, туман */
  var gcol=[.62,.65,.69],lum=.5+.5*Math.min(1,(v.hk*.6+v.sk*.4)),gr=cur.gr;
  var sk=[0,1,2].map(function(i){return mx(v.sky[i],gcol[i]*lum*Math.min(1,Math.max(.22,(v.lvl-.3)/.65)),gr)}),fg=[0,1,2].map(function(i){return mx(v.fog[i],gcol[i]*lum*Math.min(1,Math.max(.22,(v.lvl-.3)/.65))*1.05,gr)});
  sc.clearColor.r=sk[0];sc.clearColor.g=sk[1];sc.clearColor.b=sk[2];sc.clearColor.a=1;
  if(sc.fogColor){sc.fogColor.r=fg[0];sc.fogColor.g=fg[1];sc.fogColor.b=fg[2]}
  if(base.fe){sc.fogStart=base.fs*cur.fg;sc.fogEnd=base.fe*cur.fg}
  var skyM=sc.getMeshByName('sky');if(skyM&&skyM.material&&skyM.material.emissiveTexture)skyM.material.emissiveTexture.level=mx(v.lvl,Math.min(v.lvl,.55),gr*.6);
  /* свет и тени */
  var L=cur.lt;
  if(base.hemi){var h=base.hemi;h.intensity=base.hI*v.hk*L;h.diffuse.r=Math.min(1,base.hD[0]*v.hc[0]);h.diffuse.g=Math.min(1,base.hD[1]*v.hc[1]);h.diffuse.b=Math.min(1,base.hD[2]*v.hc[2]);if(base.hG&&h.groundColor){h.groundColor.r=base.hG[0]*mx(1,v.hc[0],.7);h.groundColor.g=base.hG[1]*mx(1,v.hc[1],.7);h.groundColor.b=base.hG[2]*mx(1,v.hc[2],.7)}}
  if(base.sun){var s=base.sun;s.intensity=base.sI*v.sk*L*(1-gr*.55);s.diffuse.r=Math.min(1,base.sD[0]*v.sc[0]);s.diffuse.g=Math.min(1,base.sD[1]*v.sc[1]);s.diffuse.b=Math.min(1,base.sD[2]*v.sc[2]);
   var d=v.dir,ln=Math.hypot(d[0],d[1],d[2])||1;s.direction.x=d[0]/ln;s.direction.y=d[1]/ln;s.direction.z=d[2]/ln}
  /* море */
  seaM.forEach(function(m){var d0=m.__d0;m.diffuseColor.r=d0.r*mx(v.sea[0],.78,gr*.5);m.diffuseColor.g=d0.g*mx(v.sea[1],.82,gr*.5);m.diffuseColor.b=d0.b*mx(v.sea[2],.86,gr*.5)});
  var sw=sc.getMeshByName('seaWaves');if(sw&&sw.material&&sw.material.diffuseTexture&&cur.wind>.25){var tx=sw.material.diffuseTexture;tx.uOffset=(tx.uOffset||0)+dt*.01*cur.wind*cur.wind;tx.vOffset=(tx.vOffset||0)+dt*.006*cur.wind}
  var nn=Math.max(0,Math.min(1,(1-v.lvl)/.8)),ww=Math.min(1,v.warm);
  if(sc.__seaDim){var dmm=sc.__seaDimM,al=Math.max(nn*.5,ww*.2*(1-nn));dmm.alpha=al;sc.__seaDim.setEnabled(al>.01);dmm.emissiveColor.r=mx(.95,.02,nn);dmm.emissiveColor.g=mx(.45,.05,nn);dmm.emissiveColor.b=mx(.22,.14,nn)}
  if(base.amb){var ak=mx(1,.62,nn);sc.ambientColor.r=base.amb[0]*ak;sc.ambientColor.g=base.amb[1]*ak;sc.ambientColor.b=base.amb[2]*mx(ak,1,.15)}
  sc.imageProcessingConfiguration.exposure=mx(1,.92,nn)*(window.__gfxExp||1);
  /* фонари */
  var lamp=Math.max(v.lamp,cur.gr*.9),fl=1+Math.sin(now/230)*.04;
  bulbM.forEach(function(m){var e=m.__e0;m.emissiveColor.r=mx(e.r,1,lamp);m.emissiveColor.g=mx(e.g,.82,lamp);m.emissiveColor.b=mx(e.b,.42,lamp)});
  glassM.forEach(function(m){var e=m.__e0,k=.25+.75*lamp;m.emissiveColor.r=e.r*k;m.emissiveColor.g=e.g*k;m.emissiveColor.b=e.b*k});
  var hal=lamp>.04;halos.forEach(function(o){if(!o.h)return;if(o.h.isEnabled()!==hal)o.h.setEnabled(hal);if(hal){var q=lamp*fl*(1+.18*Math.sin(now/700+o.h.position.x));o.h.scaling.setAll(3.4+1.8*q)}});
  /* яркие огоньки, гирлянды и светлячки */
  if(decoMats){var don=lamp>.04;if(don!==decoOn){decoOn=don;deco.forEach(function(d){d.setEnabled(don)})}
   if(don){decoMats.forEach(function(dm,k){var tw=.86+.14*Math.sin(now/430+k*1.9);dm.alpha=Math.min(1,lamp)*(k===4?.22:.8*tw)})}
   var fon=lamp>.08&&cur.rain<.5;if(fon!==flyOn){flyOn=fon;fly.forEach(function(f){f.m.setEnabled(fon)})}
   if(fon&&game.player&&game.player.collider){var pp2=game.player.collider.position,t2=now/1000;fly.forEach(function(f){var an=f.a+t2*f.s;f.m.position.set(pp2.x+Math.cos(an)*f.r,pp2.y-.3+f.h+Math.sin(t2*.9+f.a*3)*.35,pp2.z+Math.sin(an*1.13)*f.r)})}}
  /* вечерняя подсветка колоннады и окон */
  var wm=v.warm;warmM.forEach(function(m){var e=m.__e0;m.emissiveColor.r=mx(e.r,1,wm*.2);m.emissiveColor.g=mx(e.g,.74,wm*.2);m.emissiveColor.b=mx(e.b,.42,wm*.2)});
  var lit=v.win>.35;facM.forEach(function(mt){var nt=lit?nightOf(mt):null,want=nt||mt.__day;if(mt.diffuseTexture!==want)mt.diffuseTexture=want;var e=mt.__e0,k=mx(1,.35,Math.min(1,(1-v.lvl)*1.1));mt.emissiveColor.r=e.r*k;mt.emissiveColor.g=e.g*k;mt.emissiveColor.b=e.b*k});
  /* мокрые поверхности */
  wetM.forEach(function(m){var k=wet;m.specularColor.r=mx(m.__s0.r,.32,k);m.specularColor.g=mx(m.__s0.g,.34,k);m.specularColor.b=mx(m.__s0.b,.38,k);m.specularPower=mx(m.__p0,56,k);if(m.__em0&&m.emissiveColor){var sk2=.3*snowC*Math.min(1,v.hk*cur.lt);m.emissiveColor.r=m.__em0.r+sk2;m.emissiveColor.g=m.__em0.g+sk2;m.emissiveColor.b=m.__em0.b+sk2}});
  /* ветер: флаги и ближние деревья */
  var wd=cur.wind,tt=now/1000;
  flags.forEach(function(o){o.m.rotation.y=o.r+Math.sin(tt*(3+wd*4)+o.ph)*(.12+.5*wd)});
  if(!window.__atmTreeT||now-window.__atmTreeT>1000){window.__atmTreeT=now;var pp=game.player&&game.player.collider&&game.player.collider.position;if(pp&&trees.length){trees.forEach(function(o){var m=o.m,dx=m.position.x-pp.x,dz=m.position.z-pp.z,near=dx*dx+dz*dz<3600&&wd>.2;if(near&&!o.on){o.on=true;m.unfreezeWorldMatrix&&m.unfreezeWorldMatrix()}else if(!near&&o.on){o.on=false;m.rotation.x=o.r[0];m.rotation.z=o.r[1];m.freezeWorldMatrix&&m.freezeWorldMatrix()}})}}
  trees.forEach(function(o){if(o.on){o.m.rotation.z=o.r[1]+Math.sin(tt*(1.2+wd*1.6)+o.ph)*.035*wd;o.m.rotation.x=o.r[0]+Math.cos(tt*(1.0+wd)+o.ph)*.02*wd}});
  /* экранные эффекты */
  clouds.style.opacity=Math.min(.95,cur.cl*Math.min(1,Math.max(.2,(v.lvl-.3)/.65))*(v.lvl>.5?1:.4)).toFixed(2);clouds.style.filter='brightness('+(1-cur.gr*.4-(1-v.lvl)*.3).toFixed(2)+')';
  vig.style.opacity=Math.max(0,(1-v.lvl)*.45+(cur.gr*.15)).toFixed(2);
  var fxA=Math.max(cur.rain,cur.sn),ron=fxA>.05;if(ron!==rainOn){rainOn=ron;if(!ron){rctx.clearRect(0,0,rw,rh)}}
  rc.style.opacity=Math.min(.85,fxA).toFixed(2);if(ron){rctx.clearRect(0,0,rw,rh);if(cur.rain>.05)drawRain(dt,wd);if(cur.sn>.05)drawSnow(dt,wd,cur.sn)}
 }}catch(e){if(!window.__atmErr){window.__atmErr=e.stack}}
 requestAnimationFrame(frame);
}
/* ночные текстуры окон для фасадов — создаются только когда нужны */
window.__atmState=function(){return {st:st,cur:cur&&{lamp:cur.v.lamp,win:cur.v.win,rain:cur.rain,gr:cur.gr}}};
window.__atmSnap=function(){cur=null};window.__atmSet=function(t,w){if(t)st.tod=t;if(w){st.wx=w;wxAuto=false}save();icon()};
requestAnimationFrame(frame);
})();
