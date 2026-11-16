
/* ===== Севастополис v103: звуки на заставке и картах =====
   Раньше на картах был только фон; нажатия, волны и кнопки молчали. Синтезируем звуки сами
   (файлов не нужно) и уважаем кнопку 🎵: выключила музыку — звуки нажатий тоже молчат. */
(function(){
  'use strict';
  let ac=null,noiseBuf=null,lastRip=0,lastTick=0;
  function allowed(){
    try{const s=Object.assign({snd:true,mus:true},JSON.parse(localStorage.getItem('sevset')||'{}'));if(!(s.snd&&s.mus))return false}catch(e){}
    if(document.hidden||window.__radioOn)return false;
    return !!document.querySelector('.screen--map.on,.screen--splash.on');
  }
  function ctx(){
    if(!ac){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;try{ac=new AC()}catch(e){return null}
      try{noiseBuf=ac.createBuffer(1,Math.floor(ac.sampleRate*.5),ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}catch(e){}}
    if(ac.state==='suspended')try{ac.resume()}catch(e){}
    return ac;
  }
  function tone(f0,f1,t0,dur,vol,type){
    const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+t0;
    o.type=type||'sine';o.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(1e-4,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(1e-4,t+dur);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+.05);
  }
  function noise(t0,dur,freq,q,vol){
    if(!noiseBuf)return;const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain(),t=ac.currentTime+t0;
    s.buffer=noiseBuf;f.type='bandpass';f.frequency.value=freq;f.Q.value=q;
    g.gain.setValueAtTime(1e-4,t);g.gain.exponentialRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(1e-4,t+dur);
    s.connect(f);f.connect(g);g.connect(ac.destination);s.start(t,Math.random()*.2,dur+.05);
  }
  const SFX={
    start(){[523,659,784,1047].forEach((f,i)=>tone(f,f,i*.09,.5,.16,'triangle'));tone(262,262,0,.7,.08,'sine')},       // «Играть»
    city(){tone(784,784,0,.5,.15,'triangle');tone(1175,1175,.08,.6,.12,'sine');tone(1568,1568,.16,.5,.07,'sine')},     // нажала на город
    place(){tone(659,659,0,.4,.14,'triangle');tone(988,988,.07,.5,.12,'sine')},                                       // нажала на место
    open(){tone(440,880,0,.22,.1,'sine');noise(0,.18,2400,.8,.05)},                                                   // карточка места открылась
    go(){[392,523,659,784].forEach((f,i)=>tone(f,f,i*.07,.35,.13,'triangle'))},                                       // «Отправиться»
    back(){tone(660,330,0,.2,.1,'sine')},
    tick(){tone(900,700,0,.06,.07,'square')},
    water(){tone(900,260,0,.16,.12,'sine');tone(1300,500,.05,.14,.06,'sine');noise(0,.35,1500,.6,.07);noise(.08,.4,700,.7,.05)} // капля/плеск
  };
  function play(k){if(!allowed())return;if(!ctx())return;try{SFX[k]()}catch(e){}}
  document.addEventListener('pointerdown',function(e){
    const t=e.target&&e.target.closest?e.target:null;if(!t)return;
    if(t.closest('.splash__hot'))return play('start');
    const pin=t.closest('.pin');
    if(pin)return play(pin.classList.contains('pin--city')?'city':'place');
    if(t.closest('.sheet__go'))return play('go');
    if(t.closest('.sheet__x,.map__back'))return play('back');
    if(t.closest('.map__zoom [data-z]')){const n=performance.now();if(n-lastTick>80){lastTick=n;play('tick')}}
  },true);
  // карточка места открывается — тихий «шорох»
  new MutationObserver(function(ms){
    for(const m of ms){
      if(m.type==='attributes'&&m.target.classList&&m.target.classList.contains('sheet')&&!m.target.hidden&&m.oldValue!==null&&/hidden/.test(m.attributeName)){play('open');return}
      for(const n of m.addedNodes||[]){
        if(n.nodeType===1&&n.classList&&(n.classList.contains('rip')||n.classList.contains('sl-rp'))){const t=performance.now();if(t-lastRip>250){lastRip=t;play('water')}}
      }
    }
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden'],attributeOldValue:true});
  // звуковой контекст надо «разбудить» первым касанием
  ['pointerup','touchend','click','keydown'].forEach(ev=>document.addEventListener(ev,function(){if(allowed())ctx()},{passive:true,capture:true}));
  window.__sevMapSfx={play};
})();

