(function(){
'use strict';
var A=window.SevAnim={},B=null,S={t:0,state:'idle',forced:null,gait:0,landT:0,wasAir:false,lastY:null,seq:null,spin:-1,hdg:0,cur:null,lastOff:0,lastAssigned:null,log:''};
var KEYS=['aLx','aRx','aLz','aRz','lLx','lRx','lLz','lRz','lean','roll','y','hx','hy','hz','yaw','walkW','amp'];
function zero(){return{aLx:0,aRx:0,aLz:0,aRz:0,lLx:0,lRx:0,lLz:0,lRz:0,lean:0,roll:0,y:0,hx:0,hy:0,hz:0,yaw:0,walkW:1,amp:1}}
S.cur=zero();
function boneMap(root){var m={};try{root.getChildTransformNodes(false).forEach(function(t){if(!m[t.name])m[t.name]=t})}catch(e){}return m}
function loc(root,node){node.computeWorldMatrix(true);var inv=root.getWorldMatrix().clone();inv.invert();return root.position.constructor.TransformCoordinates(node.getAbsolutePosition(),inv)}
function calibBones(B,root,bm){try{var V=root.position.constructor,sh=[bm['shoulder.L'],bm['shoulder.R']],th=[bm['thigh.L'],bm['thigh.R']],hd=bm['head'],jw=bm['jaw'];if(!sh[0]||!sh[1]||!th[0]||!hd||!jw||!sh[0].rotationQuaternion)return false;var Q=sh[0].rotationQuaternion.constructor;root.computeWorldMatrix(true);
function meas(b,c,ax){var p0=loc(root,c),sv=b.rotationQuaternion.clone();b.rotationQuaternion=sv.multiply(Q.RotationAxis(ax,.3));b.computeWorldMatrix(true);var p1=loc(root,c);b.rotationQuaternion=sv;b.computeWorldMatrix(true);loc(root,c);return{dx:p1.x-p0.x,dy:p1.y-p0.y,dz:p1.z-p0.z}}
var X=new V(1,0,0),Y=new V(0,1,0),Z=new V(0,0,1),cal={arm:{},leg:{}};
[[sh[0],'elbow.'+(bm['shoulder.L']===sh[0]?'L':'R')],[sh[1],'elbow.R']].forEach(function(x,i){});
['L','R'].forEach(function(s){var b=bm['shoulder.'+s],c=bm['elbow.'+s];if(!b||!c)return;var px=loc(root,b).x,side=px>0?1:-1,mx=meas(b,c,X),mz=meas(b,c,Z);cal.arm[side>0?'R':'L']={b:b,fx:mx.dz>0?-1:1,fz:(mz.dx*side>0?1:-1),Q:Q,X:X,Z:Z}});
['L','R'].forEach(function(s){var b=bm['thigh.'+s],c=bm['foot.'+s];if(!b||!c)return;var px=loc(root,b).x,side=px>0?1:-1,mx=meas(b,c,X);cal.leg[side>0?'R':'L']={b:b,fx:mx.dz>0?-1:1,Q:Q,X:X}});
var mhx=meas(hd,jw,X),mhy=meas(hd,jw,Y),e1=bm['ear.L'],e2=bm['ear.R'],dxe=0;if(e1&&e2){var a1=meas(hd,e1,Z),a2=meas(hd,e2,Z);dxe=(a1.dx+a2.dx)/2}else dxe=meas(hd,jw,Z).dx;
cal.head={b:hd,fx:mhx.dy<0?1:-1,fy:mhy.dx>0?1:-1,fz:dxe>0?1:-1,Q:Q,X:X,Y:Y,Z:Z};B.cal=cal;return!!(cal.arm.L&&cal.arm.R&&cal.leg.L&&cal.leg.R)}catch(e){S.log='калибровка: '+e.message;return false}}
function applyBones(B,P){var cal=B.cal;if(!cal)return;function mul(b,q){b.rotationQuaternion=b.rotationQuaternion.multiply(q)}
['L','R'].forEach(function(s){var ar=cal.arm[s],lg=cal.leg[s],k=s==='R'?1:-1;
if(ar){var ax=P['a'+s+'x']*ar.fx,az=P['a'+s+'z']*k*ar.fz;if(Math.abs(ax)+Math.abs(az)>1e-4){mul(ar.b,ar.Q.RotationAxis(ar.X,ax).multiply(ar.Q.RotationAxis(ar.Z,az)))}}
if(lg){var lx=P['l'+s+'x']*lg.fx;if(Math.abs(lx)>1e-4)mul(lg.b,lg.Q.RotationAxis(lg.X,lx))}});
var h=cal.head;if(h){var hx=P.hx*h.fx,hy=P.hy*h.fy,hz=P.hz*h.fz;if(Math.abs(hx)+Math.abs(hy)+Math.abs(hz)>1e-4){mul(h.b,h.Q.RotationAxis(h.X,hx).multiply(h.Q.RotationAxis(h.Y,hy)).multiply(h.Q.RotationAxis(h.Z,hz)))}}}
function bind(pl){var root=pl.model&&pl.model.root;if(!root)return null;if(B&&B.root===root)return B;
var mdl=pl.model,bm0=boneMap(root);
if(mdl.playClip||bm0['shoulder.L']){B={root:root,mode:'bones',n:{armL:1},base:{},bm:bm0};if(!calibBones(B,root,bm0)){B.mode='none'}else{try{var sc=root.getScene();B.obs=sc.onAfterAnimationsObservable.add(function(){if(B&&B.pose&&B.applied)applyBones(B,B.pose)})}catch(e){}}return B}
if(mdl.setPose){B={root:root,mode:'glb9',n:{armL:1},base:{}};return B}
var n={};try{root.getChildTransformNodes(false).forEach(function(t){if(!n[t.name]&&(t.name==='armL'||t.name==='armR'||t.name==='legL'||t.name==='legR'||t.name==='head'))n[t.name]=t})}catch(e){}
if(!n.head&&pl.kind==='fox'){try{var TN=root.constructor,sc=root.getScene(),H=new TN('foxHead',sc);H.parent=root;H.position.set(0,1.4,0);var names={'fox-head':1,'cream-muzzle':1,'nose':1,'pointed-ear':1,'inner-ear':1,'eye':1,'pupil':1,'adventurer-hat-brim':1,'adventurer-hat-crown':1,'hat-band':1};root.getChildMeshes(true).forEach(function(m){if(names[m.name]&&m.parent===root){m.parent=H;m.position.y-=1.4}});n.head=H}catch(e){}}
B={root:root,n:n,base:{},mode:'nodes'};return B}
function stateFor(pl,dt){
if(S.forced)return S.forced;
if(pl._swimming){if(pl._diveT>0)return'dive';if(S.enterT>0)return'enter';if(S.surfT>0)return'surface';return(pl.speed||0)>.22?'swim':'tread'}
if(S.exitT>0)return'exit';
var sp=pl.speed||0;
if(S.landT>0)return'land';
if(pl._jumping)return(pl._vy||0)>.6?'rise':'air';
if(S.fall)return'fall';
if(sp>9.5)return'sprint';if(sp>6.2)return'run';if(sp>.4)return'walk';return'idle'}
function target(st,t,g,pl){var T=zero(),f=Math.sin(g),f2=Math.cos(g);
switch(st){
case'idle':T.walkW=1;break;
case'walk':T.walkW=1;T.lean=.04;break;
case'run':T.walkW=1;T.amp=1.15;T.lean=.16;T.aLz=-.1;T.aRz=.1;break;
case'sprint':T.walkW=1;T.amp=1.4;T.lean=.27;T.aLz=-.16;T.aRz=.16;T.hx=-.08;break;
case'rise':T.walkW=0;T.aLx=-1.9;T.aRx=-1.9;T.aLz=-.25;T.aRz=.25;T.lLx=-.6;T.lRx=.3;T.lean=.1;T.y=0;T.hx=-.12;break;
case'air':T.walkW=0;T.aLx=-.4;T.aRx=-.4;T.aLz=-1.1;T.aRz=1.1;T.lLx=-.2;T.lRx=.2;T.lLz=-.22;T.lRz=.22;T.lean=0;T.hx=.05;break;
case'fall':T.walkW=0;T.aLx=-.5+f*.55;T.aRx=-.5-f*.55;T.aLz=-1.0;T.aRz=1.0;T.lLx=f*.7;T.lRx=-f*.7;T.lean=-.04;break;
case'land':T.walkW=.4;T.y=-.15;T.lean=.28;T.aLx=.55;T.aRx=.55;T.aLz=-.2;T.aRz=.2;T.lLx=-.35;T.lRx=-.35;T.hx=.12;break;
case'back':T.walkW=0;T.aLx=-f*.4;T.aRx=f*.4;T.lLx=f*.5;T.lRx=-f*.5;T.lean=-.07;T.y=Math.abs(f)*.03;break;
case'sideL':case'sideR':{var s=st==='sideL'?-1:1;T.walkW=0;T.lLz=s*(.25+.2*f);T.lRz=s*(.25-.2*f);T.lLx=0;T.lRx=0;T.aLz=-.25;T.aRz=.25;T.aLx=.1;T.aRx=.1;T.roll=s*.07;T.y=Math.abs(f)*.025;break}
case'wwalk':T.walkW=0;T.aLx=f*.6;T.aRx=-f*.6;T.lLx=-f*.6;T.lRx=f*.6;T.lean=.04;T.y=Math.abs(f)*.03;break;
case'wrun':T.walkW=0;T.aLx=f*.95;T.aRx=-f*.95;T.lLx=-f*.95;T.lRx=f*.95;T.lean=.17;T.aLz=-.1;T.aRz=.1;T.y=Math.abs(f)*.05;break;
case'wsprint':T.walkW=0;T.aLx=f*1.2;T.aRx=-f*1.2;T.lLx=-f*1.2;T.lRx=f*1.2;T.lean=.28;T.aLz=-.16;T.aRz=.16;T.hx=-.08;T.y=Math.abs(f)*.07;break;
case'swim':{T.walkW=0;var sp_=g*.62,sa=Math.sin(sp_),ca=Math.cos(sp_);T.aLx=-1.35+.6*sa;T.aRx=-1.35-.6*sa;T.aLz=-.3-.25*Math.max(0,ca);T.aRz=.3+.25*Math.max(0,-ca);T.lLx=Math.sin(sp_*2)*.42;T.lRx=-Math.sin(sp_*2)*.42;T.lean=.32;T.roll=0;T.hx=-.42;T.y=.03*Math.sin(sp_*2);break}
case'tread':T.walkW=0;T.aLz=-.8+.25*f;T.aRz=.8-.25*f;T.aLx=-.3;T.aRx=-.3;T.lLx=Math.sin(g*1.4)*.45;T.lRx=-Math.sin(g*1.4)*.45;T.lean=0;break;
case'dive':T.walkW=0;T.aLx=-2.9;T.aRx=-2.9;T.aLz=-.12;T.aRz=.12;T.lLx=Math.sin(g*1.6)*.35;T.lRx=-Math.sin(g*1.6)*.35;T.lean=1.35;T.hx=0;break;
case'surface':T.walkW=0;T.aLx=-1.4+f*.9;T.aRx=-1.4-f*.9;T.aLz=-.4;T.aRz=.4;T.lLx=Math.sin(g*1.8)*.4;T.lRx=-Math.sin(g*1.8)*.4;T.lean=.45;T.hx=-.3;break;
case'enter':T.walkW=0;T.aLx=-2.0;T.aRx=-2.0;T.aLz=-.5;T.aRz=.5;T.lLx=-.4;T.lRx=.2;T.lean=.12;break;
case'exit':T.walkW=.3;T.aLx=-.7;T.aRx=-.7;T.aLz=-.15;T.aRz=.15;T.lLx=f*.4;T.lRx=-f*.4;T.lean=.3;T.y=-.04;T.hx=.1;break;
case'spin':T.walkW=0;T.aLz=-1.2;T.aRz=1.2;T.lLz=-.1;T.lRz=.1;T.y=.02;break;
default:break}
return T}

var PI=Math.PI,sin=Math.sin,cos=Math.cos,ab=Math.abs;
var EM={
danceFun:{n:'Весёлый танец',i:'💃',c:'d',dur:7,fn:function(t){var g=t*8,f=sin(g);return{y:ab(sin(g))*.13,aLx:-1.1+f*.8,aRx:-1.1-f*.8,aLz:-.4,aRz:.4,lLx:f*.45,lRx:-f*.45,roll:sin(g/2)*.1,hz:sin(g/2)*.12,lean:.05}}},
danceDisco:{n:'Диско',i:'🪩',c:'d',dur:8,fn:function(t){var g=t*6,ph=Math.floor(t*2)%2,sw=sin(g);return{y:ab(sin(g))*.07,aLx:ph?-.5:-2.7,aRx:ph?-2.7:-.5,aLz:ph?-.2:-.7,aRz:ph?.7:.2,lLz:-.2+sw*.2,lRz:.2+sw*.2,roll:sw*.16,hz:sw*.1,lean:-.05}}},
danceCute:{n:'Милый танец',i:'🧸',c:'d',dur:7,fn:function(t){var g=t*5,f=sin(g);return{y:ab(sin(g*2))*.06,aLx:-.85+f*.35,aRx:-.85-f*.35,aLz:.2+cos(g)*.2,aRz:-.2-cos(g)*.2,roll:f*.2,hz:-f*.2,lLx:ab(f)*.15,lRx:ab(f)*.15}}},
spin:{n:'Вращение',i:'🌀',c:'d',dur:3,fn:function(t){var p=Math.min(1,t/2.4),e=p*p*(3-2*p);return{yaw:e*PI*4,aLz:-1.3,aRz:1.3,aLx:-.1,aRx:-.1,y:Math.max(0,sin(Math.min(1,t/2.4)*PI))*.1,lLx:-.2,lRx:.2}}},
danceJump:{n:'Прыжки под музыку',i:'🎵',c:'d',dur:7,fn:function(t){var g=t*PI*2*1.4,h=Math.max(0,sin(g)),up=h>.1;return{y:h*.6,aLx:up?-2.6:-.3,aRx:up?-2.6:-.3,aLz:up?-.35:-.2,aRz:up?.35:.2,lLx:up?-.7:0,lRx:up?-.4:0,lean:up?-.05:.12,hx:up?-.15:.1}}},
danceArms:{n:'Танец руками',i:'🙌',c:'d',dur:7,fn:function(t){var g=t*5,f=sin(g);return{aLz:-(1.2+.95*sin(g)),aRz:1.2+.95*sin(g+PI/2),aLx:-.5*cos(g),aRx:-.5*sin(g),roll:sin(g/2)*.12,hz:sin(g)*.12,y:ab(sin(g))*.05,lLx:f*.2,lRx:-f*.2}}},
danceWin:{n:'Победный танец',i:'🏆',c:'d',dur:6,fn:function(t){var g=t*PI*2*1.2,h=Math.max(0,sin(g)),sh=sin(t*30)*.12;return{y:h*.5,aLx:-2.7+sh,aRx:-2.7-sh,aLz:-.45,aRz:.45,lLx:-.5*h,lRx:-.3*h,hx:-.2,lean:-.06,yaw:t>4.2?Math.min(1,(t-4.2)/1.4)*PI*2:0}}},
wave:{n:'Помахать',i:'👋',c:'g',dur:2.4,clip:'Wave',speed:1,fn:function(t){return{aRz:2.45+sin(t*10)*.35,aRx:-.1,hz:.08,hx:-.05}}},
hello:{n:'Поздороваться',i:'🙋',c:'g',dur:2.6,clip:'Wave',speed:1.2,fn:function(t){return{aRx:-2.2,aRz:.5+sin(t*9)*.3,hx:sin(t*4)*.12-.05,lean:.04}}},
bye:{n:'Попрощаться',i:'🫡',c:'g',dur:2.8,clip:'Wave',speed:.75,fn:function(t){return{aRz:2.6+sin(t*5.5)*.55,aRx:-.15,aLz:-.15,hz:sin(t*2.7)*.15,lean:.03}}},
point:{n:'Показать пальцем',i:'👉',c:'g',dur:2.0,fn:function(t){return{aRx:-1.5,aRz:.1,hx:-.06,lean:.06}}},
direction:{n:'Указать путь',i:'➡️',c:'g',dur:2.4,fn:function(t){return{aRx:-.35,aRz:1.65,hy:-.5,lean:.04,aLz:-.1}}},
clap:{n:'Хлопать',i:'👏',c:'g',dur:3.2,fn:function(t){var f=sin(t*15);return{aLx:-1.25,aRx:-1.25,aLz:.05+f*.28,aRz:-.05-f*.28,y:ab(f)*.015,hx:.05}}},
cheer:{n:'Ура!',i:'🙌',c:'g',dur:2.6,fn:function(t){var g=t*PI*2*1.3,h=Math.max(0,sin(g));return{aLx:-2.85,aRx:-2.85,aLz:-.3,aRz:.3,y:h*.28,hx:-.2,lean:-.04}}},
thumb:{n:'Класс!',i:'👍',c:'g',dur:2.2,fn:function(t){return{aRx:-1.35,aRz:.45,hx:sin(t*8)*.12+.02,lean:.04}}},
shrug:{n:'Пожать плечами',i:'🤷',c:'g',dur:2.0,fn:function(t){var p=sin(Math.min(1,t/.5)*PI/2);return{aLz:-.55*p,aRz:.55*p,aLx:-.15*p,aRx:-.15*p,y:.04*p*(1+sin(t*6)*.3),hz:.16*p,hx:.05*p}}},
cheerup:{n:'Подбодрить',i:'💪',c:'g',dur:2.6,fn:function(t){return{aRx:-1.8+sin(t*9)*.35,aRz:.25,aLz:-.2,hx:sin(t*4.5)*.14,lean:.08}}},
joy:{n:'Радость',i:'😊',c:'e',dur:3,clip:'Emo_Happy',speed:1,fn:function(t){return{y:ab(sin(t*6))*.06,aLx:-.5,aRx:-.5,aLz:-.5,aRz:.5,hx:-.1,lean:-.03,roll:sin(t*3)*.05}}},
surprise:{n:'Удивление',i:'😮',c:'e',dur:2.6,clip:'Emo_Surprised',speed:1,fn:function(t){var p=Math.min(1,t*6);return{lean:-.18*p,aLx:-.9*p,aRx:-.9*p,aLz:-.6*p,aRz:.6*p,hx:-.25*p,y:p*.05,lLx:-.2*p,lRx:.1*p}}},
sad:{n:'Грусть',i:'😢',c:'e',dur:3.5,clip:'Emo_Sad',speed:1,fn:function(t){return{hx:.35,lean:.12,aLx:.1,aRx:.1,aLz:-.08,aRz:.08,roll:sin(t*1.5)*.03,y:-.03}}},
shy:{n:'Смущение',i:'😳',c:'e',dur:3,clip:'Emo_Smirk',speed:.8,fn:function(t){return{hx:.25,hz:.18,aLx:-.9,aRx:-.9,aLz:.3,aRz:-.3,lLx:.15,lRx:-.1,roll:sin(t*2)*.06,lean:.05}}},
delight:{n:'Восторг',i:'🤩',c:'e',dur:3,clip:'Emo_Happy',speed:1.6,root:function(t){return{y:ab(sin(t*7))*.15}},fn:function(t){return{y:ab(sin(t*7))*.2,aLx:-2.7,aRx:-2.7,aLz:-.5,aRz:.5,hx:-.25,lean:-.05}}},
displeased:{n:'Недовольство',i:'😠',c:'e',dur:3,clip:'Emo_Angry',speed:1,fn:function(t){return{aLx:-1.2,aRx:-1.2,aLz:.55,aRz:-.55,hy:sin(t*5)*.35,hx:.1,lean:.06}}},
scared:{n:'Испуг',i:'😱',c:'e',dur:3,clip:'Emo_Surprised',speed:1.7,root:function(t){return{lean:-.12,roll:sin(t*38)*.04,y:-.03}},fn:function(t){return{y:-.08,lean:-.2,aLx:-1.1,aRx:-1.1,aLz:-.4,aRz:.4,hx:-.15,roll:sin(t*38)*.05,lLx:sin(t*30)*.1,lRx:-sin(t*30)*.1}}},
thinking:{n:'Задумчивость',i:'🤔',c:'e',dur:3.5,clip:'Emo_Smirk',speed:.45,root:function(t){return{roll:.05}},fn:function(t){return{aRx:-1.9,aRz:.25,aLx:.1,hx:.08,hz:.2,hy:-.2,lean:.03,roll:.05}}},
laugh:{n:'Смех',i:'😂',c:'e',dur:3.5,clip:'Emo_Happy',speed:2.2,root:function(t){return{y:ab(sin(t*14))*.04,roll:sin(t*14)*.05}},fn:function(t){return{y:ab(sin(t*14))*.05,hx:-.3,lean:-.1,aLx:-.9,aRx:-.9,aLz:.2,aRz:-.2,roll:sin(t*14)*.06}}},
sleepy:{n:'Сонливость',i:'😴',c:'e',dur:4,clip:'Sit',speed:1,fn:function(t){return{hx:.3+sin(t*1.6)*.08,lean:.1,aLx:.05,aRx:.05,aLz:-.1,aRz:.1,roll:sin(t*1.2)*.05,y:-.02}}}
};
A.active=function(){return!!S.emote};
var ORDER=['danceFun','danceDisco','danceCute','spin','danceJump','danceArms','danceWin','wave','hello','bye','point','direction','clap','cheer','thumb','shrug','cheerup','joy','surprise','sad','shy','delight','displeased','scared','thinking','laugh','sleepy'];
function canEmote(pl){return pl&&pl.model&&!pl.riding&&!pl._swimming&&!pl._jumping&&!S.fall&&!(S.landT>0)&&!(S.exitT>0)}
function beat(sec){try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;var ac=window.__sevAnimAC=window.__sevAnimAC||new AC();ac.resume();var n=0,tm=setInterval(function(){var t=ac.currentTime;if(n%2===0){var o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(45,t+.14);g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.2)}var o2=ac.createOscillator(),g2=ac.createGain();o2.type='triangle';o2.frequency.value=[440,523,659,587][n%4];g2.gain.setValueAtTime(.03,t);g2.gain.exponentialRampToValueAtTime(.001,t+.14);o2.connect(g2);g2.connect(ac.destination);o2.start(t);o2.stop(t+.15);n++;if(n>sec*4||!S.emote)clearInterval(tm)},250)}catch(e){}}
function clapSnd(){try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;var ac=window.__sevAnimAC=window.__sevAnimAC||new AC(),n=ac.sampleRate*.06|0,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);var s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=1800;g.gain.value=.3;s.connect(f);f.connect(g);g.connect(ac.destination);s.start()}catch(e){}}
A.emote=function(name,pl){var e=EM[name];if(!e)return false;pl=pl||(window.__sevGame&&window.__sevGame.player);if(!canEmote(pl))return false;S.emote={k:name,t:0,e:e,clap:0,clip:false};if(e.clip&&pl.model.playClip){S.emote.clip=!!pl.model.playClip(e.clip,e.speed||1)}S.forced=null;S.seq=null;if(e.c==='d')beat(e.dur);return true};
A.stopEmote=function(){S.emote=null};
A.emotes=function(){return ORDER.map(function(k){return{k:k,n:EM[k].n,i:EM[k].i,c:EM[k].c}})};

var SEQ={jump:[['rise',.38],['air',.18],['fall',.2],['land',.34]],fallDemo:[['fall',1.2],['land',.4]]};
A.exitWater=function(){S.exitT=.55;S.surfT=0;S.enterT=0;if(B&&B.root){B.root.position.z=0}S.zOn=false};
A.play=function(name){
if(name==='auto'){S.forced=null;S.seq=null;S.spin=-1;return}
var map={walk:'wwalk',run:'wrun',sprint:'wsprint',idle:'idle',swim:'swim',tread:'tread',dive:'dive',surface:'surface',enter:'enter',exit:'exit'};
if(SEQ[name]){S.seq={list:SEQ[name],i:0,t:0};S.forced=SEQ[name][0][0];S.spin=-1;return}
if(name==='spin'){S.spin=0;S.seq=null;S.forced='spin';return}
S.seq=null;S.spin=-1;S.forced=map[name]||name};
A.step=function(pl,dt,fromSwim){try{
if(!pl||!pl.model||pl.riding||(pl._swimming&&!fromSwim)||(!pl._swimming&&fromSwim)){if(B&&B.applied&&!pl._swimming){reset();}if(!pl||pl.riding)S.lastY=null;return}
var b=bind(pl);if(!b||b.mode==='none'||(b.mode==='nodes'&&!b.n.armL))return;dt=Math.min(dt,.05);S.t+=dt;
var pp=pl.position;if(S.lastY!==null){var vy=(pp.y-S.lastY)/Math.max(dt,.001);S.fall=!pl._jumping&&vy<-3.5}S.lastY=pp.y;
if(pl._swimming&&!S.wasSwim)S.enterT=.45;if(!pl._swimming&&S.wasSwim){}
if(pl._swimming&&S.wasDive&&!(pl._diveT>0))S.surfT=.9;S.wasDive=pl._diveT>0;S.wasSwim=!!pl._swimming;if(S.enterT>0)S.enterT-=dt;if(S.surfT>0)S.surfT-=dt;if(S.exitT>0)S.exitT-=dt;
if(S.wasAir&&!pl._jumping&&!S.forced)S.landT=.3;S.wasAir=!!pl._jumping;if(S.landT>0)S.landT-=dt;
if(S.seq){S.seq.t+=dt;var cur=S.seq.list[S.seq.i];if(S.seq.t>=cur[1]){S.seq.i++;S.seq.t=0;if(S.seq.i>=S.seq.list.length){S.seq=null;S.forced=null}else S.forced=S.seq.list[S.seq.i][0]}}
if(S.spin>=0){S.spin+=dt/.8;pl.model.root.rotation.y=pl.heading+S.spin*Math.PI*2;if(S.spin>=1){S.spin=-1;S.forced=null;pl.model.root.rotation.y=pl.heading}}
var emoT=null;
if(S.emote){var E=S.emote;E.t+=dt;var clipEnd=E.clip&&E.t>.25&&!(pl.model.clipActive&&pl.model.clipActive());if(!canEmote(pl)&&!(E.k==='wave'||E.k==='hello'||E.k==='bye')||(pl.speed||0)>2.4||pl._jumping||pl.riding||pl._swimming||S.fall||E.t>=E.e.dur+(E.clip?1.5:0)||clipEnd){if(E.clip&&pl.model.stopClip)pl.model.stopClip();S.emote=null;C0wrap();pl.model.root.rotation.y=pl.heading+S.cur.yaw}else if(E.clip){emoT=zero();emoT.walkW=1;var ro=E.e.root&&E.e.root(E.t);if(ro)for(var rk in ro)emoT[rk]=ro[rk]}else{emoT=zero();var o=E.e.fn(E.t);for(var kk in o)emoT[kk]=o[kk];emoT.walkW=0;if(E.k==='clap'){var ph=Math.floor(E.t*15/(2*Math.PI)+.25);if(ph!==E.clap){E.clap=ph;clapSnd()}}}}
var st=stateFor(pl,dt),sp=pl.speed||0,fq=st==='wsprint'?18:st==='wrun'?14:st==='sideL'||st==='sideR'?7:st==='swim'?7:st==='tread'||st==='surface'?3.2:st==='dive'?4:8;S.gait+=dt*fq;S.state=st;
var T=emoT||target(st,S.t,S.gait,pl),k=1-Math.exp(-dt*(st==='land'?22:emoT?11:14)),C=S.cur;if(emoT&&S.emote)S.state='эмоция: '+S.emote.e.n+(S.emote.clip?' (клип)':'');
for(var i=0;i<KEYS.length;i++){var key=KEYS[i];C[key]+=(T[key]-C[key])*k}
// дыхание в покое
var br=0,hb=0;if(st==='idle'||st==='land'){br=Math.sin(S.t*1.7)*.025;hb=Math.sin(S.t*1.2)*.03}
var n=b.n,mdl=pl.model;if(b.mode==='bones'){b.pose={aLx:C.aLx+br,aRx:C.aRx+br,aLz:C.aLz,aRz:C.aRz,lLx:C.lLx,lRx:C.lRx,hx:C.hx+hb,hy:C.hy,hz:C.hz};b.applied=true;mdl.setHold&&mdl.setHold(1-C.walkW)}
else if(b.mode==='glb9'){if(C.walkW<.98||S.emote){mdl.setPose([C.aRx+br,C.aRz,C.aLx+br,C.aLz,C.lRx,C.lLx,C.hx+hb,C.hy,C.hz]);b.applied=true}else{mdl.setPose(null)}}
var pair=b.mode==='nodes'?[['armL','aLx','aLz',br],['armR','aRx','aRz',br],['legL','lLx','lLz',0],['legR','lRx','lRz',0]]:[];
for(var j=0;j<pair.length;j++){var nd=n[pair[j][0]];if(!nd)continue;nd.rotation.x=nd.rotation.x*C.walkW*C.amp+C[pair[j][1]]+pair[j][3];nd.rotation.z=C[pair[j][2]]}
if(b.mode==='nodes'&&n.head){n.head.rotation.x=C.hx+hb;n.head.rotation.y=C.hy;n.head.rotation.z=C.hz}
var r=pl.model.root;r.rotation.x=C.lean;if(!S.spin||S.spin<0)r.rotation.z=C.roll;if(S.emote||Math.abs(C.yaw)>.002){r.rotation.y=pl.heading+C.yaw}
if(pl._swimming){r.position.z=-Math.sin(C.lean)*.85;S.zOn=true}else if(S.zOn){r.position.z=0;S.zOn=false}
var cur=r.position.y,base=(S.lastAssigned!==null&&Math.abs(cur-S.lastAssigned)<1e-6)?cur-S.lastOff:cur;S.lastOff=C.y;S.lastAssigned=base+C.y;r.position.y=S.lastAssigned;b.applied=true}catch(e){S.log='ошибка: '+e.message}};
function C0wrap(){var c=S.cur;c.yaw=Math.atan2(Math.sin(c.yaw),Math.cos(c.yaw))}
function reset(){if(!B)return;var n=B.n||{};try{var mm=window.__sevGame&&window.__sevGame.player&&window.__sevGame.player.model;if(mm){mm.setHold&&mm.setHold(0);mm.setPose&&mm.setPose(null)}}catch(e){}B.pose=null;['armL','armR','legL','legR'].forEach(function(k){if(n[k])n[k].rotation.z=0});if(n.head)n.head.rotation.x=0;var r=B.root;if(r){r.rotation.x=0;r.rotation.z=0;r.position.y-=S.lastOff;S.lastOff=0;S.lastAssigned=null}B.applied=false;for(var k in S.cur)S.cur[k]=zero()[k]}
// панель проверки анимаций
var LIST=[['Покой','idle'],['Ходьба','walk'],['Бег','run'],['Спринт','sprint'],['Прыжок','jump'],['Падение','fallDemo'],['Приземление','land'],['Назад','back'],['Боком влево','sideL'],['Боком вправо','sideR'],['Поворот','spin'],['Плыть','swim'],['Отдых на воде','tread'],['Нырок','dive'],['Всплытие','surface'],['Вход в воду','enter'],['Выход из воды','exit']];
A.panel=function(){var p=document.getElementById('animPanel');if(!p){var st=document.createElement('style');st.textContent='#animPanel{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#fff3d6f2;border-top:3px solid #7b4c24;border-radius:16px 16px 0 0;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));max-height:56vh;overflow:auto;color:#5a3410;font-family:system-ui,sans-serif}#animPanel h3{margin:0 0 6px;font-size:15px}#animPanel .ap-g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}#animPanel button{padding:9px 4px;border:2px solid #4a2a10;border-radius:10px;background:linear-gradient(#a06f3a,#7b4c24);color:#ffe9c0;font-weight:800;font-size:13px}#animPanel button.on{background:linear-gradient(#9fe8ff,#3aa4d6);color:#123}#animPanel .ap-s{font-size:12px;margin:6px 0;opacity:.85}';document.head.appendChild(st);p=document.createElement('div');p.id='animPanel';document.body.appendChild(p);p.addEventListener('pointerdown',function(e){e.stopPropagation()})}
var h='<h3>🎛 Панель проверки анимаций</h3><div class="ap-s" id="apState"></div><div class="ap-g">';
h+='<button data-c="hero:cube">Герой: куб</button><button data-c="hero:fox">Герой: лиса</button><button data-c="auto" class="on">▶ Авто</button>';
LIST.forEach(function(x){h+='<button data-c="'+x[1]+'">'+x[0]+'</button>'});
A.emotes().forEach(function(x){h+='<button data-c="em:'+x.k+'">'+x.i+' '+x.n+'</button>'});h+='<button data-c="close">Закрыть</button></div>';p.innerHTML=h;p.hidden=false;
p.onclick=function(e){var c=e.target.getAttribute&&e.target.getAttribute('data-c');if(!c)return;
if(c==='close'){p.hidden=true;A.play('auto');return}
if(c.indexOf('hero:')===0){try{var g=window.__sevGame;g&&g.player&&g.player.setCharacter(c.slice(5));B=null}catch(er){}return}
if(c.indexOf('em:')===0){var ok=A.emote(c.slice(3));var s=document.getElementById('apState');if(s&&!ok)s.textContent='Сейчас нельзя: персонаж в воздухе, в воде или в транспорте';return}A.play(c);p.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-c')===c||(c==='land'&&false))})};
if(!A._tm)A._tm=setInterval(function(){var s=document.getElementById('apState');if(s&&!document.getElementById('animPanel').hidden)s.textContent='Состояние: '+S.state+(S.forced?' (вручную)':' (авто)')+(S.log?' · '+S.log:'')},300)};

(function(){var tries=0,tm=setInterval(function(){if(++tries>60){clearInterval(tm);return}var jb=document.getElementById('btnJump');if(!jb||document.getElementById('btnEmote'))return;clearInterval(tm);
var st=document.createElement('style');st.textContent='#btnEmote{position:fixed;right:calc(20px + var(--safe-r,0px));bottom:calc(92px + var(--safe-b,0px));z-index:9;width:48px;height:48px;border-radius:50%;padding:0;box-shadow:0 3px 10px #0008;touch-action:none;font-size:23px;display:flex;align-items:center;justify-content:center}#btnEmote[hidden]{display:none}#emotePop{position:fixed;right:calc(12px + var(--safe-r,0px));bottom:calc(150px + var(--safe-b,0px));z-index:30;background:#fff3d6f2;border:3px solid #7b4c24;border-radius:16px;padding:8px;width:min(300px,92vw);max-height:50vh;overflow:auto;box-shadow:0 6px 20px #0009}#emotePop[hidden]{display:none}#emotePop h4{margin:4px 4px 4px;font-size:13px;color:#5a3410}#emotePop .ep-g{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}#emotePop button{padding:7px 2px;border:2px solid #4a2a10;border-radius:10px;background:linear-gradient(#a06f3a,#7b4c24);color:#ffe9c0;font-weight:800;font-size:12px;line-height:1.15}#emotePop button span{display:block;font-size:20px}body:not([data-mode="scene"]) #btnEmote,body:not([data-mode="scene"]) #emotePop{display:none!important}';document.head.appendChild(st);
var b=document.createElement('button');b.id='btnEmote';b.className='hud__btn';b.type='button';b.title='Танцы и жесты';b.setAttribute('aria-label','Танцы и жесты');b.textContent='🕺';document.body.appendChild(b);
var p=document.createElement('div');p.id='emotePop';p.hidden=true;var TT={d:'Танцы',g:'Жесты и приветствия',e:'Эмоции'};var h='<h4>Танцы</h4><div class="ep-g">';var cur='d';A.emotes().forEach(function(x){if(x.c!==cur){cur=x.c;h+='</div><h4>'+TT[x.c]+'</h4><div class="ep-g">'}h+='<button data-e="'+x.k+'"><span>'+x.i+'</span>'+x.n+'</button>'});h+='</div>';p.innerHTML=h;document.body.appendChild(p);
['pointerdown','touchstart','wheel'].forEach(function(ev){[b,p].forEach(function(el){el.addEventListener(ev,function(e){e.stopPropagation()},{passive:true})})});
b.addEventListener('click',function(){p.hidden=!p.hidden});
p.addEventListener('click',function(e){var k=e.target.closest&&e.target.closest('button');if(!k)return;var n=k.getAttribute('data-e');if(n){A.emote(n);p.hidden=true}});
setInterval(function(){var g=window.__sevGame,pl=g&&g.player,veh=!!(pl&&pl.riding);b.hidden=jb.hidden||veh;if(b.hidden)p.hidden=true},150)},500)})();
})();
