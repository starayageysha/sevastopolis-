
/* Музыка заставки: играет по кругу, при нажатии «Играть» плавно затухает */
(function(){
  var FADE_IN=1.2, VOL=0.85, st={el:null,ctx:null,gain:null,active:false,unlock:false,timer:0};
  var EV=['pointerdown','touchstart','keydown'];
  function enabled(){try{var s=Object.assign({snd:true,mus:true},JSON.parse(localStorage.getItem('sevset')||'{}'));return !!(s.snd&&s.mus)&&!window.__radioOn&&!document.hidden}catch(e){return !document.hidden&&!window.__radioOn}}
  function build(){
    if(st.el||!window.SPLASH_AUDIO)return !!st.el;
    var a=new Audio();a.loop=true;a.preload='auto';a.setAttribute('playsinline','');a.src=window.SPLASH_AUDIO;st.el=a;
    var AC=window.AudioContext||window.webkitAudioContext;
    if(AC){try{st.ctx=new AC();st.gain=st.ctx.createGain();st.gain.gain.value=0;st.ctx.createMediaElementSource(a).connect(st.gain);st.gain.connect(st.ctx.destination)}catch(e){st.ctx=st.gain=null}}
    if(!st.gain)a.volume=0;
    return true;
  }
  function ramp(to,sec,done){
    clearInterval(st.timer);
    if(st.gain&&st.ctx){var t=st.ctx.currentTime,g=st.gain.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(to,t+sec);if(done)st.timer=setTimeout(done,sec*1000+80);return}
    var a=st.el,from=a.volume,t0=performance.now();
    st.timer=setInterval(function(){var k=Math.min(1,(performance.now()-t0)/(sec*1000));a.volume=from+(to-from)*k;if(k>=1){clearInterval(st.timer);if(done)done()}},40);
  }
  function removeUnlock(){if(!st.unlock)return;st.unlock=false;EV.forEach(function(n){document.removeEventListener(n,onGesture,true)})}
  function onGesture(e){
    if(!st.active)return removeUnlock();
    if(e&&e.target&&e.target.closest&&e.target.closest('.splash__hot'))return; /* нажали «Играть» — музыку уже не запускаем */
    play();
  }
  function armUnlock(){if(st.unlock)return;st.unlock=true;EV.forEach(function(n){document.addEventListener(n,onGesture,true)})}
  function play(){
    if(!st.active||!enabled()||!build())return;
    if(st.ctx&&st.ctx.state==='suspended'){try{st.ctx.resume()}catch(e){}}
    var p=st.el.play();
    var ok=function(){removeUnlock();ramp(VOL,FADE_IN)};
    if(p&&p.then)p.then(ok,armUnlock);else ok();
  }
  function stopNow(){clearInterval(st.timer);if(st.el){try{st.el.pause()}catch(e){}}}
  window.__splashMusic={
    start:function(){st.active=true;if(st.el){try{st.el.currentTime=0}catch(e){}}play()},
    fadeOut:function(sec){
      st.active=false;removeUnlock();
      if(!st.el||st.el.paused){stopNow();return}
      ramp(0,sec||2.2,function(){stopNow();try{st.el.currentTime=0}catch(e){}});
    },
    sync:function(){ /* вызывается после включения/выключения музыки в настройках заставки */
      if(!st.active)return;
      if(enabled())play();else ramp(0,.4,stopNow);
    }
  };
  document.addEventListener('visibilitychange',function(){
    if(!st.active)return;
    if(document.hidden){stopNow()}else{play()}
  });
})();
