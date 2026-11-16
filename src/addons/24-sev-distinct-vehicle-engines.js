
(function(){
 'use strict';
 var ctx=null,nodes=null,activeType=null,gameRef=null,lastResume=0;
 // Мягкие низкоуровневые тона: никаких квадратных/пилообразных сигналов и резкой модуляции.
 var presets={
  boat:{wave:'sine',base:48,range:34,sub:72,level:.010},
  yacht:{wave:'triangle',base:62,range:38,sub:96,level:.009},
  car:{wave:'triangle',base:42,range:52,sub:64,level:.010},
  kidcar:{wave:'sine',base:105,range:42,sub:150,level:.006}
 };
 function soundOn(){try{return JSON.parse(localStorage.getItem('sevset')||'{}').snd!==false}catch(e){return true}}
 function make(){if(ctx)return;var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{
  ctx=new AC();var master=ctx.createGain();master.gain.value=.28;master.connect(ctx.destination);
  var a=ctx.createOscillator(),b=ctx.createOscillator(),ga=ctx.createGain(),gb=ctx.createGain();
  var filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;filter.Q.value=.55;
  a.connect(ga);b.connect(gb);ga.connect(filter);gb.connect(filter);filter.connect(master);
  ga.gain.value=0;gb.gain.value=0;a.start();b.start();nodes={a,b,ga,gb,filter,master};
 }catch(e){ctx=null;nodes=null}}
 function wake(){make();if(ctx&&ctx.state==='suspended')try{ctx.resume()}catch(e){}}
 function stop(){if(!ctx||!nodes)return;var t=ctx.currentTime;nodes.ga.gain.setTargetAtTime(0,t,.16);nodes.gb.gain.setTargetAtTime(0,t,.16);activeType=null}
 function update(){try{
  var game=window.__sevGame,pl=game&&game.player,store=window.__sevVehicleStore;
  if(game!==gameRef){stop();gameRef=game}
  var type=store&&store.currentVehicle?store.currentVehicle():pl&&pl.vehKind;
  if(!pl||!pl.riding||!presets[type]||!soundOn()){stop();requestAnimationFrame(update);return}
  if(!ctx)make();if(!ctx||!nodes){requestAnimationFrame(update);return}
  if(ctx.state==='suspended'&&performance.now()-lastResume>1400){lastResume=performance.now();try{ctx.resume()}catch(e){}}
  var p=presets[type],denom=type==='yacht'?15:type==='boat'?13:type==='kidcar'?9:16,speed=Math.max(0,Math.min(1,(pl.speed||0)/denom));
  var t=ctx.currentTime,f=p.base+p.range*(.08+speed*.92);
  if(activeType!==type){nodes.a.type=p.wave;nodes.b.type='sine';nodes.filter.frequency.setTargetAtTime(type==='kidcar'?760:520,t,.12);activeType=type}
  nodes.a.frequency.setTargetAtTime(f,t,.08);nodes.b.frequency.setTargetAtTime(p.sub*(.82+speed*.25),t,.09);
  nodes.ga.gain.setTargetAtTime(p.level*(.25+speed*.75),t,.14);nodes.gb.gain.setTargetAtTime(p.level*.22*(.2+speed),t,.14);
 }catch(e){}
 requestAnimationFrame(update)}
 window.addEventListener('pointerdown',wake,{passive:true});window.addEventListener('keydown',wake);
 window.addEventListener('pagehide',function(){try{stop();if(ctx)ctx.close()}catch(e){}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){requestAnimationFrame(update)});else requestAnimationFrame(update);
})();
