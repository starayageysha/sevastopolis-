
/* ===== Севастополис v101: режим «Поиск» (GPS + камера + компас) =====
   Главная цель: следующая точка активного квеста, а если он пройден — старт следующего.
   Видно даже издалека: золотой световой столб на горизонте, бегущие мигающие стрелки
   по земле, золотые искры; когда телефон смотрит верно — появляется сундук-подсказка,
   а у самой цели — настоящий сундук. Квесты и награды берутся из window.__sevQuestApi
   (те же функции, что и в режиме 3D), поэтому награда выдаётся один раз. */
(function(){
  if(window.SevAR&&!window.SevARLegacy) window.SevARLegacy=window.SevAR; // старый AR-модуль из v91 сохранён, новый его заменяет в кнопке 📷
  const RAD=Math.PI/180, DEG=180/Math.PI, ER=6371008.8;
  const MAX_ACC=60;          // м: хуже — отметиться нельзя
  const STALE_MS=60000;      // старше — GPS «потерян» (стоящий телефон может не слать новых точек)
  const HOLD_MS=1500;        // сколько держаться внутри радиуса
  const TREASURE_R=25;       // м: радиус сокровища охоты
  const CAM_H=1.5;           // м: высота телефона над землёй
  const CHEST_SHOW_M=120;    // м: с этого расстояния на месте цели виден сам сундук
  const ALIGN_DEG=14;        // телефон смотрит на цель в пределах ±14° — «верное направление»
  const ALIGN_HOLD_MS=1100;  // сколько держаться на верном курсе, чтобы появился сундук-подсказка
  const HINT_DIST=9;         // м: на каком расстоянии перед тобой парит сундук-подсказка
  const GOLD='255,209,102';
  const st={on:false,stream:null,watch:null,pos:null,acc:null,fixT:0,gpsErr:'',camState:'',oriOK:false,
            oriAbs:false,basis:null,sel:0,raf:0,inSince:0,lastHud:0,fov:68,targets:[],iosAlpha:false,fixes:0,
            sp:[],bp:[],burst:[],lastT:0,spAcc:0,bpAcc:0,alignSince:0,hintAt:0,hintLostAt:0,
            chestVis:false,chestPopAt:0,chestHit:null,hintHit:null,tid:''};
  let ui={};

  /* ---------- геометрия ---------- */
  function hav(a,b,c,d){const p=(c-a)*RAD,q=(d-b)*RAD,
    h=Math.sin(p/2)**2+Math.cos(a*RAD)*Math.cos(c*RAD)*Math.sin(q/2)**2;return 2*ER*Math.asin(Math.sqrt(h));}
  function bear(a,b,c,d){const y=Math.sin((d-b)*RAD)*Math.cos(c*RAD),
    x=Math.cos(a*RAD)*Math.sin(c*RAD)-Math.sin(a*RAD)*Math.cos(c*RAD)*Math.cos((d-b)*RAD);return Math.atan2(y,x);}
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
  const fmt=m=>m<1000?Math.round(m)+' м':(m/1000).toFixed(m<10000?1:0)+' км';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const angDiff=(a,b)=>{let d=(a-b)%(2*Math.PI);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;return d;};

  /* ---------- цели ----------
     Первая в списке — ГЛАВНАЯ: следующая точка уже начатого квеста.
     Если начатых нет — старт первого ещё не пройденного квеста (по порядку в игре). */
  function buildTargets(){
    const A=window.__sevQuestApi,act=[],rest=[],again=[];
    if(!A) return [];
    let qs=[];try{qs=A.quests()}catch(e){}
    for(const q of qs){
      if(!q.modes||!q.modes.includes('real')||!q.geo) continue;
      let s;try{s=A.status(q)}catch(e){continue}
      if(q.type==='hunt'){
        const h=A.hunt();
        if(h.done){again.push({id:'again:'+q.id,kind:'replay',qid:q.id,icon:'🔁',title:q.title+' — пройти заново',place:q.geo.label,lat:q.geo.lat,lon:q.geo.lon,radius:q.radius,go:'🔁 Пройти заново'});continue}
        if(!h.started) rest.push({id:q.id,kind:'huntStart',icon:'🦊',title:q.title+' — старт',place:q.geo.label,lat:q.geo.lat,lon:q.geo.lon,radius:q.radius,go:'🦊 Начать охоту'});
        else if(h.next){const p=A.huntPoints.find(x=>x.id===h.next.id);
          if(p) act.push({id:'hunt:'+p.id,kind:'huntClaim',treasure:p.id,icon:'🎁',title:'Сокровище: '+p.name,place:'Знак города-героя '+p.name+' ('+(h.got+1)+' из '+h.total+')',lat:p.rlat!=null?p.rlat:p.lat,lon:p.rlon!=null?p.rlon:p.lon,radius:TREASURE_R,go:'🎁 Открыть сундук'});}
      }else if(q.type==='visit'){
        if(s.st==='done'){again.push({id:'again:'+q.id,kind:'replay',qid:q.id,icon:'🔁',title:q.title+' — пройти заново',place:q.geo.label,lat:q.geo.lat,lon:q.geo.lon,radius:q.radius,go:'🔁 Пройти заново'});continue}
        if(s.st==='lock') continue;
        (s.st==='active'?act:rest).push({id:q.id,kind:'visit',icon:'📍',title:q.title,place:q.geo.label,lat:q.geo.lat,lon:q.geo.lon,radius:q.radius,go:'🎁 Открыть сундук'});
      }
    }
    return act.concat(rest,again);
  }
  function distTo(t){return st.pos?hav(st.pos.lat,st.pos.lon,t.lat,t.lon):null;}

  /* ---------- UI ---------- */
  const CSS=`
#sevReal{position:fixed;inset:0;z-index:99990;background:#10202c;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden;touch-action:none;user-select:none}
#sevReal[hidden]{display:none}
#sevReal video,#sevReal canvas{position:absolute;inset:0;width:100%;height:100%}
#sevReal video{object-fit:cover}
#sevReal .sa-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:linear-gradient(#000a,#0000)}
#sevReal .sa-title{font-weight:700;font-size:16px;flex:1;text-shadow:0 1px 3px #000}
#sevReal .sa-chips{position:absolute;left:12px;right:12px;top:calc(54px + env(safe-area-inset-top,0px));display:flex;flex-wrap:wrap;gap:6px}
#sevReal .sa-chip{font-size:12px;padding:3px 8px;border-radius:99px;background:#000a;border:1px solid #fff3}
#sevReal .sa-chip.ok{border-color:#5be07a}#sevReal .sa-chip.bad{border-color:#ff6b6b}#sevReal .sa-chip.wait{border-color:#ffd166}
#sevReal .sa-x{width:40px;height:40px;border-radius:12px;border:2px solid #4a2a10;background:linear-gradient(#a06f3a,#7b4c24);color:#fff1cb;font-size:20px}
#sevReal .sa-bot{position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));background:#101820e6;border:1px solid #fff3;border-radius:16px;padding:12px}
#sevReal .sa-row{display:flex;align-items:center;gap:10px}
#sevReal .sa-arrow{width:46px;height:46px;flex:none;border-radius:50%;background:#ffd16622;border:2px solid #ffd166;display:flex;align-items:center;justify-content:center;font-size:26px;transition:transform .12s linear;animation:saBlink .9s ease-in-out infinite}
@keyframes saBlink{0%,100%{opacity:1;box-shadow:0 0 14px 3px #ffd166aa}50%{opacity:.35;box-shadow:0 0 2px 0 #ffd16600}}
#sevReal .sa-info{flex:1;min-width:0}
#sevReal .sa-tt{font-weight:700;font-size:15px}
#sevReal .sa-pl{font-size:12px;opacity:.8}
#sevReal .sa-dist{font-weight:800;font-size:20px;color:#ffd166;white-space:nowrap}
#sevReal .sa-nav{width:34px;height:34px;border-radius:10px;border:1px solid #fff4;background:#fff1;color:#fff;font-size:16px}
#sevReal .sa-go{margin-top:10px;width:100%;padding:12px;border-radius:12px;border:2px solid #2d6a3a;background:linear-gradient(#52c26a,#2f9e44);color:#fff;font-size:16px;font-weight:700}
#sevReal .sa-go[disabled]{background:#3a4652;border-color:#55616d;color:#b8c2cc}
#sevReal .sa-msg{margin-top:8px;font-size:12px;opacity:.85;min-height:15px}
#sevReal .sa-card{position:absolute;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px}
#sevReal .sa-card[hidden]{display:none}
#sevReal .sa-cardin{background:#fff4d8;color:#3b2410;border-radius:18px;padding:18px;max-width:420px;max-height:80vh;overflow:auto;border:3px solid #e0b04a}
#sevReal .sa-cardin h3{margin:0 0 8px;font-size:18px}#sevReal .sa-cardin p{margin:0 0 12px;white-space:pre-line;font-size:14px;line-height:1.35}
#sevReal .sa-cardin button{width:100%;padding:10px;border-radius:10px;border:2px solid #4a2a10;background:linear-gradient(#a06f3a,#7b4c24);color:#fff1cb;font-weight:700;font-size:15px}
#sevReal .sa-note{position:absolute;left:12px;right:12px;top:calc(92px + env(safe-area-inset-top,0px));font-size:12px;background:#4a1d1dcc;border:1px solid #ff6b6b;border-radius:10px;padding:8px;display:none}
`;
  function build(){
    if(ui.root) return;
    const st0=document.createElement('style');st0.id='sevReal-css';st0.textContent=CSS;document.head.appendChild(st0);
    const r=document.createElement('div');r.id='sevReal';r.hidden=true;
    r.innerHTML=`<video playsinline muted autoplay></video><canvas></canvas>
<div class="sa-top"><div class="sa-title">🧭 Поиск · реальный город</div><button class="sa-x" aria-label="Закрыть">✕</button></div>
<div class="sa-chips"><span class="sa-chip wait" data-c="gps">📡 GPS…</span><span class="sa-chip wait" data-c="ori">🧭 компас…</span><span class="sa-chip wait" data-c="cam">📷 камера…</span></div>
<div class="sa-note"></div>
<div class="sa-bot"><div class="sa-row"><button class="sa-nav" data-n="-1" aria-label="Предыдущая цель">◀</button>
<div class="sa-arrow">⬆</div><div class="sa-info"><div class="sa-tt"></div><div class="sa-pl"></div></div><div class="sa-dist">—</div>
<button class="sa-nav" data-n="1" aria-label="Следующая цель">▶</button></div>
<button class="sa-go" disabled>📍 Отметиться</button><div class="sa-msg"></div></div>
<div class="sa-card" hidden><div class="sa-cardin"><h3></h3><p></p><button>Закрыть</button></div></div>`;
    document.body.appendChild(r);
    ui={root:r,video:r.querySelector('video'),cv:r.querySelector('canvas'),ctx:r.querySelector('canvas').getContext('2d'),
      arrow:r.querySelector('.sa-arrow'),tt:r.querySelector('.sa-tt'),pl:r.querySelector('.sa-pl'),dist:r.querySelector('.sa-dist'),
      go:r.querySelector('.sa-go'),msg:r.querySelector('.sa-msg'),note:r.querySelector('.sa-note'),
      card:r.querySelector('.sa-card'),ct:r.querySelector('.sa-cardin h3'),cp:r.querySelector('.sa-cardin p'),
      chips:{gps:r.querySelector('[data-c=gps]'),ori:r.querySelector('[data-c=ori]'),cam:r.querySelector('[data-c=cam]')}};
    r.querySelector('.sa-x').addEventListener('click',close);
    r.querySelectorAll('.sa-nav').forEach(b=>b.addEventListener('click',()=>{if(st.targets.length){st.sel=(st.sel+Number(b.dataset.n)+st.targets.length)%st.targets.length;st.inSince=0;resetFx();}}));
    ui.go.addEventListener('click',checkIn);
    ui.cv.addEventListener('pointerdown',e=>{ // нажатие прямо на сундук
      const rc=ui.cv.getBoundingClientRect(),x=e.clientX-rc.left,y=e.clientY-rc.top,h=st.chestHit;
      if(h&&Math.hypot(x-h.x,y-h.y)<=h.r) checkIn();
    });
    r.querySelector('.sa-cardin button').addEventListener('click',()=>{ui.card.hidden=true;refreshTargets();});
  }
  function chip(k,cls,text){const c=ui.chips[k];c.className='sa-chip '+cls;c.textContent=text;}
  const notes={};
  function note(t,key){notes[key||'misc']=t||'';const all=Object.values(notes).filter(Boolean);ui.note.style.display=all.length?'block':'none';ui.note.textContent=all.join(' ');}
  function buzz(p){try{if(navigator.vibrate)navigator.vibrate(p)}catch(e){}}

  /* ---------- сенсоры ---------- */
  function onOri(e){
    if(e.type==='deviceorientation'&&st.oriAbs) return;
    if(e.type==='deviceorientationabsolute') st.oriAbs=true;
    let a=e.alpha;const b=e.beta,g=e.gamma;
    if(typeof e.webkitCompassHeading==='number'&&!st.oriAbs){a=360-e.webkitCompassHeading;st.iosAlpha=true;}
    if(a==null||b==null||g==null) return;
    st.oriOK=true;
    const cA=Math.cos(a*RAD),sA=Math.sin(a*RAD),cB=Math.cos(b*RAD),sB=Math.sin(b*RAD),cG=Math.cos(g*RAD),sG=Math.sin(g*RAD);
    let right=[cA*cG-sA*sB*sG, sA*cG+cA*sB*sG, -cB*sG];
    let up=[-sA*cB, cA*cB, sB];
    let fwd=[-(cA*sG+sA*sB*cG), -(sA*sG-cA*sB*cG), -(cB*cG)];
    const th=((screen.orientation&&screen.orientation.angle)||window.orientation||0)*RAD,c=Math.cos(th),s=Math.sin(th);
    const sr=[0,1,2].map(i=>right[i]*c+up[i]*s), su=[0,1,2].map(i=>up[i]*c-right[i]*s);
    const nb={f:fwd,r:sr,u:su};
    if(!st.basis) st.basis=nb;
    else{const k=.3;for(const key of ['f','r','u'])st.basis[key]=norm(st.basis[key].map((v,i)=>v+(nb[key][i]-v)*k));}
  }
  function heading(){
    const B=st.basis;if(!B) return null;
    const v=Math.abs(B.f[2])<.85?B.f:B.u;               // смотрим вниз/вверх — берём «верх» телефона
    return Math.atan2(v[0],v[1]);
  }
  function camAz(){ // куда смотрит камера (рад от севера), null — камера смотрит слишком вверх/вниз
    const B=st.basis;if(!B||Math.abs(B.f[2])>.6) return null;
    return Math.atan2(B.f[0],B.f[1]);
  }
  function onPos(p){
    const c=p.coords,np={lat:c.latitude,lon:c.longitude};
    if(st.pos&&c.accuracy>=st.acc*0.8&&hav(st.pos.lat,st.pos.lon,np.lat,np.lon)<Math.max(c.accuracy,10)*1.5){ // гасим только мелкое дрожание; большой скачок принимаем сразу
      const k=.5;np.lat=st.pos.lat+(np.lat-st.pos.lat)*k;np.lon=st.pos.lon+(np.lon-st.pos.lon)*k;}
    st.pos=np;st.acc=c.accuracy;st.fixT=Date.now();st.gpsErr='';st.fixes++;
  }
  function onPosErr(e){
    st.gpsErr=e.code===1?'denied':e.code===2?'unavailable':'timeout';
    if(e.code===1) note('Нет доступа к геолокации. Разреши «Местоположение» для сайта в настройках Chrome (значок замка рядом с адресом) и открой режим снова.','gps');
  }
  async function startSensors(){
    // iOS требует разрешения внутри жеста пользователя — вызываем первым
    let oriPerm=Promise.resolve('granted');
    try{if(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function') oriPerm=DeviceOrientationEvent.requestPermission();}catch(e){}
    window.addEventListener('deviceorientationabsolute',onOri,true);
    window.addEventListener('deviceorientation',onOri,true);
    oriPerm.catch(()=>{});
    if(!navigator.geolocation){st.gpsErr='unsupported';note('Этот браузер не поддерживает геолокацию.','gps');}
    else{st.watch=navigator.geolocation.watchPosition(onPos,onPosErr,{enableHighAccuracy:true,maximumAge:1000,timeout:20000});
      st.keep=setInterval(()=>{if(Date.now()-st.fixT>8000) navigator.geolocation.getCurrentPosition(onPos,()=>{},{enableHighAccuracy:true,maximumAge:0,timeout:10000});},4000);}
    if(!window.isSecureContext) note('Страница открыта не по HTTPS: GPS и камера могут быть заблокированы. Открой игру по https:// адресу.','sec');
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
      st.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      if(!st.on){st.stream.getTracks().forEach(t=>t.stop());st.stream=null;return;}
      ui.video.srcObject=st.stream;await ui.video.play().catch(()=>{});st.camState='ok';
    }catch(e){st.camState=(e&&e.name)||'error';}
  }
  function stopSensors(){
    window.removeEventListener('deviceorientationabsolute',onOri,true);
    window.removeEventListener('deviceorientation',onOri,true);
    if(st.watch!=null&&navigator.geolocation) navigator.geolocation.clearWatch(st.watch);
    st.watch=null;clearInterval(st.keep);
    if(st.stream){st.stream.getTracks().forEach(t=>t.stop());st.stream=null;}
    try{ui.video.srcObject=null;}catch(e){}
  }

  /* ---------- отметка ---------- */
  function status(t){
    if(!st.pos) return {ok:false,text:st.gpsErr?'GPS недоступен — проверь разрешение и сигнал':'Ждём сигнал GPS…'};
    if(Date.now()-st.fixT>STALE_MS) return {ok:false,text:'Сигнал GPS потерян, выйди на открытое место'};
    const d=distTo(t);
    if(st.acc>MAX_ACC) return {ok:false,text:'GPS неточен (±'+Math.round(st.acc)+' м) — выйди на открытое место',d};
    if(d>t.radius) return {ok:false,text:d>400?'Иди или езжай в сторону мигающих стрелок — по прямой ещё '+fmt(d):'Подойди ближе: ещё '+fmt(d-t.radius)+' до зоны ('+t.radius+' м)',d};
    return {ok:true,text:'Ты в зоне! Подтверждаем место…',d};
  }
  function checkIn(){
    const t=st.targets[st.sel];if(!t) return;
    const s=status(t);if(!s.ok||!st.inSince||Date.now()-st.inSince<HOLD_MS) return;
    const A=window.__sevQuestApi;let r;
    try{
      r=t.kind==='replay'?(A.reset?Object.assign(A.reset(t.qid),{title:'🔁 Квест сброшен',text:'Начни заново: теперь стрелки ведут к первой точке этого квеста. Награды за повторное прохождение выдаются снова.'}):{ok:false,text:'Повтор недоступен в этой версии.'}):t.kind==='visit'?A.visit(t.id,'real'):t.kind==='huntStart'?A.huntStart():A.huntClaim(t.treasure,'real');
    }catch(e){r={ok:false,text:'Ошибка выдачи награды: '+e.message};}
    ui.ct.textContent=r.title||(r.ok?'Готово!':'Пока нельзя');ui.cp.textContent=r.text||'';ui.card.hidden=false;
    st.inSince=0;buzz([60,40,60,40,120]);
    if(r.ok) burstAt(ui.cv.clientWidth/2,ui.cv.clientHeight*.4,70);
  }
  function resetFx(){st.sp.length=0;st.bp.length=0;st.alignSince=0;st.hintAt=0;st.chestVis=false;st.chestPopAt=0;st.chestHit=null;st.hintHit=null;}
  function refreshTargets(){
    const prev=st.targets[st.sel]&&st.targets[st.sel].id;
    st.targets=buildTargets();
    // после выполнения цели автоматически берём новую главную (первую в списке)
    const i=st.targets.findIndex(t=>t.id===prev);st.sel=i>=0?i:0;
    const nid=st.targets[st.sel]&&st.targets[st.sel].id;
    if(nid!==st.tid){st.tid=nid||'';resetFx();}
  }

  /* ---------- отрисовка AR ---------- */
  function resize(){
    const cv=ui.cv,dpr=Math.min(window.devicePixelRatio||1,2),w=cv.clientWidth,h=cv.clientHeight;
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
    ui.ctx.setTransform(dpr,0,0,dpr,0,0);return [w,h];
  }
  // v — вектор «восток, север, вверх» относительно камеры (длина не важна)
  function project(v,B,W,H,f){
    const pc=dot(v,B.f);
    const x=dot(v,B.r),y=dot(v,B.u);
    if(pc<=.02) return {behind:true,dx:-x,dy:y};
    return {x:W/2+x/pc*f,y:H/2-y/pc*f,dx:x,dy:y};
  }
  function vec(brg,el){const c=Math.cos(el);return [Math.sin(brg)*c,Math.cos(brg)*c,Math.sin(el)];}
  const onScreen=(p,W,H,m)=>p&&!p.behind&&p.x>-m&&p.x<W+m&&p.y>-m&&p.y<H+m;
  function pill(ctx,x,y,text,sub,sel){
    ctx.font='600 13px system-ui,sans-serif';const w=Math.max(ctx.measureText(text).width,ctx.measureText(sub).width)+18,h=38;
    ctx.fillStyle=sel?'#ffd166ee':'#101820dd';ctx.strokeStyle=sel?'#fff':'#ffffff66';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(x-w/2,y,w,h,10);ctx.fill();ctx.stroke();
    ctx.fillStyle=sel?'#3b2410':'#fff';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(text,x,y+16);
    ctx.font='12px system-ui,sans-serif';ctx.fillStyle=sel?'#3b2410':'#ffd166';ctx.fillText(sub,x,y+31);
  }
  function star(ctx,x,y,r){ // четырёхлучевая искорка
    ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.quadraticCurveTo(x,y,x,y+r);
    ctx.quadraticCurveTo(x,y,x-r,y);ctx.quadraticCurveTo(x,y,x,y-r);ctx.fill();
  }
  function spark(ctx,x,y,r,a){
    ctx.fillStyle='rgba('+GOLD+','+(a*.22).toFixed(3)+')';ctx.beginPath();ctx.arc(x,y,r*1.9,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,244,200,'+a.toFixed(3)+')';star(ctx,x,y,r*1.5);
  }
  function burstAt(x,y,n){for(let i=0;i<n;i++){const a=Math.random()*7,v=60+Math.random()*190;st.burst.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:0,max:.7+Math.random()*.9,r:2+Math.random()*3.5});}}
  function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

  /* сундук: (x,y) — середина основания, s — ширина в пикселях, rot — наклон по крену телефона */
  function drawChest(ctx,x,y,s,rot,glow,t){
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);
    const w=s,h=s*.8,bh=h*.55,lh=h-bh;
    let g=ctx.createRadialGradient(0,-h*.55,s*.08,0,-h*.55,s*1.15);
    g.addColorStop(0,'rgba(255,226,130,'+(.65*glow).toFixed(3)+')');g.addColorStop(1,'rgba(255,226,130,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,-h*.55,s*1.15,0,7);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(0,0,w*.58,w*.12,0,0,7);ctx.fill();
    // корпус
    const bg=ctx.createLinearGradient(0,-bh,0,0);bg.addColorStop(0,'#a8672a');bg.addColorStop(1,'#6d3a14');
    ctx.fillStyle=bg;ctx.strokeStyle='#3d2008';ctx.lineWidth=Math.max(1.5,s*.03);rrect(ctx,-w/2,-bh,w,bh,w*.04);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(60,30,8,.55)';ctx.lineWidth=Math.max(1,s*.015);
    for(let i=1;i<3;i++){const yy=-bh+bh*i/3;ctx.beginPath();ctx.moveTo(-w/2,yy);ctx.lineTo(w/2,yy);ctx.stroke();}
    // крышка
    const lg=ctx.createLinearGradient(0,-h,0,-bh);lg.addColorStop(0,'#c98236');lg.addColorStop(1,'#93551d');
    ctx.fillStyle=lg;ctx.strokeStyle='#3d2008';ctx.lineWidth=Math.max(1.5,s*.03);
    ctx.beginPath();ctx.moveTo(-w/2,-bh);ctx.lineTo(-w/2,-bh-lh*.35);ctx.quadraticCurveTo(-w/2,-h,0,-h);ctx.quadraticCurveTo(w/2,-h,w/2,-bh-lh*.35);ctx.lineTo(w/2,-bh);ctx.closePath();ctx.fill();ctx.stroke();
    // золотые полосы
    const gg=ctx.createLinearGradient(-w/2,0,w/2,0);gg.addColorStop(0,'#c99a1c');gg.addColorStop(.5,'#ffe27a');gg.addColorStop(1,'#c99a1c');
    ctx.fillStyle=gg;
    for(const bx of [-.34,.34]){const x0=w*bx-w*.055;ctx.fillRect(x0,-h*.93+Math.abs(bx)*h*.25,w*.11,h*.93-Math.abs(bx)*h*.25);}
    ctx.fillRect(-w/2,-bh-s*.03,w,s*.06);
    // замок
    ctx.fillStyle=gg;rrect(ctx,-w*.07,-bh-lh*.1,w*.14,lh*.45,w*.02);ctx.fill();ctx.strokeStyle='#3d2008';ctx.lineWidth=Math.max(1,s*.015);ctx.stroke();
    ctx.fillStyle='#3d2008';ctx.beginPath();ctx.arc(0,-bh+lh*.06,w*.018,0,7);ctx.fill();
    // блик, который бегает по сундуку
    const sh=((t/1400)%1)*1.6-.3;ctx.save();ctx.beginPath();ctx.rect(-w/2,-h,w,h);ctx.clip();
    ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.moveTo(w*(sh-.5)-w*.1,0);ctx.lineTo(w*(sh-.5)+w*.05,0);ctx.lineTo(w*(sh-.5)+w*.25,-h);ctx.lineTo(w*(sh-.5)+w*.1,-h);ctx.fill();ctx.restore();
    ctx.restore();
  }

  /* бегущие мигающие стрелки по земле — в сторону цели */
  function drawChevrons(ctx,B,W,H,f,br,d,now){
    const F=[Math.sin(br),Math.cos(br)],L=[Math.cos(br),-Math.sin(br)];
    const maxG=Math.min(d-3,46);if(maxG<5) return;
    const list=[];for(let g=5;g<=maxG;g+=4)list.push(g);
    const N=list.length,ph=(now/210)%(N+3);
    const poly=[[0,.8],[1,-.1],[1,-.55],[0,.35],[-1,-.55],[-1,-.1]];
    for(let i=N-1;i>=0;i--){
      const g=list[i],pts=[];let ok=true;
      for(const [u,w] of poly){
        const gg=g+w*1.9,uu=u*1.25;
        const p=project([F[0]*gg+L[0]*uu,F[1]*gg+L[1]*uu,-CAM_H],B,W,H,f);
        if(p.behind){ok=false;break}pts.push(p);
      }
      if(!ok) continue;
      let k=ph-i;if(k<0)k+=N+3;
      const lit=clamp(1-k/2.6,0,1),a=.38+.62*lit;
      ctx.beginPath();pts.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.lineJoin='round';
      ctx.strokeStyle='rgba('+GOLD+','+(a*.4).toFixed(3)+')';ctx.lineWidth=8+12*lit;ctx.stroke(); // свечение
      ctx.fillStyle='rgba('+(lit>.55?'255,236,160':GOLD)+','+a.toFixed(3)+')';ctx.fill();
      ctx.strokeStyle='rgba(120,70,0,'+(.55*a).toFixed(3)+')';ctx.lineWidth=1.5;ctx.stroke();
    }
  }

  /* золотые искры, летящие по земле в сторону цели */
  function pathSparks(ctx,B,W,H,f,br,d,dt){
    const F=[Math.sin(br),Math.cos(br)],L=[Math.cos(br),-Math.sin(br)];
    const maxG=Math.min(d-1,55);
    st.spAcc+=dt*(maxG>6?85:0);
    while(st.spAcc>=1&&st.sp.length<170){st.spAcc--;
      st.sp.push({g:2+Math.random()*10,l:(Math.random()-.5)*5.5,h:-CAM_H+Math.random()*2.3,vg:5+Math.random()*7,vh:.15+Math.random()*.6,life:0,max:1.4+Math.random()*1.4,s:.6+Math.random()*.9});}
    ctx.globalCompositeOperation='lighter';
    for(let i=st.sp.length-1;i>=0;i--){
      const p=st.sp[i];p.life+=dt;p.g+=p.vg*dt;p.h+=p.vh*dt;
      if(p.life>=p.max||p.g>maxG){st.sp.splice(i,1);continue}
      const pr=project([F[0]*p.g+L[0]*p.l,F[1]*p.g+L[1]*p.l,p.h],B,W,H,f);
      if(!onScreen(pr,W,H,10)) continue;
      const a=Math.sin(Math.PI*p.life/p.max)*(.55+.45*Math.sin(now_*.02+i));
      spark(ctx,pr.x,pr.y,clamp(f*.045*p.s/p.g,1.4,8),clamp(a,0,1));
    }
    ctx.globalCompositeOperation='source-over';
  }
  let now_=0;

  /* световой столб на цели: виден и с километров — высота столба подстраивается под расстояние */
  function drawBeacon(ctx,t,base,top,d,now,dt,W,H,f){
    const wpx=clamp(f*2.6/d,14,34),inR=d<=t.radius,calm=d<200?.55:1;
    const c=inR?'91,224,122':GOLD;
    const grad=ctx.createLinearGradient(base.x,base.y,top.x,top.y);
    grad.addColorStop(0,'rgba('+c+',.95)');grad.addColorStop(.55,'rgba('+c+',.5)');grad.addColorStop(1,'rgba('+c+',0)');
    ctx.save();ctx.lineCap='round';ctx.strokeStyle=grad;
    const pul=.75+.25*Math.sin(now/260);
    ctx.globalAlpha=.24*pul*calm;ctx.lineWidth=wpx*3.2;ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(top.x,top.y);ctx.stroke();
    ctx.globalAlpha=.55*calm;ctx.lineWidth=wpx*1.7;ctx.stroke();
    ctx.globalAlpha=calm;ctx.lineWidth=wpx*.7;ctx.stroke();
    ctx.restore();
    // кольцо у основания
    const rr=clamp(t.radius/d*f*.6,wpx*.9,150);
    ctx.strokeStyle='rgba('+c+','+(.5+.4*Math.sin(now/300)).toFixed(3)+')';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.ellipse(base.x,base.y,rr,rr*.32,0,0,7);ctx.stroke();
    // искры, поднимающиеся по столбу
    st.bpAcc+=dt*(d<200?28:55);
    while(st.bpAcc>=1&&st.bp.length<(d<200?60:110)){st.bpAcc--;st.bp.push({t:Math.random()*.25,o:(Math.random()-.5)*2,v:.18+Math.random()*.32,life:0,max:1.3+Math.random()*1.2,s:.6+Math.random()});}
    ctx.globalCompositeOperation='lighter';
    const ex=top.x-base.x,ey=top.y-base.y,len=Math.hypot(ex,ey)||1,nx=-ey/len,ny=ex/len;
    for(let i=st.bp.length-1;i>=0;i--){
      const p=st.bp[i];p.life+=dt;p.t+=p.v*dt;
      if(p.life>=p.max||p.t>1){st.bp.splice(i,1);continue}
      const x=base.x+ex*p.t+nx*p.o*wpx*1.4,y=base.y+ey*p.t+ny*p.o*wpx*1.4;
      spark(ctx,x,y,clamp(wpx*.24*p.s,1.6,6.5),clamp(Math.sin(Math.PI*p.life/p.max)*(1-p.t*.6)*(d<200?.8:1),0,1));
    }
    ctx.globalCompositeOperation='source-over';
  }

  /* мигающая стрелка у края экрана + подсвеченный край, когда цель за кадром */
  function drawEdge(ctx,t,top,d,now,W,H){
    let dx=top.dx,dy=top.dy;if(top.behind){dx=-dx;dy=-dy;}
    const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
    const botH=(ui.root.querySelector('.sa-bot')||{offsetHeight:230}).offsetHeight,top0=110,bot0=H-botH-70,cy=(top0+bot0)/2;
    const mx=W/2-44,my=Math.max(40,(bot0-top0)/2),k=Math.min(mx/Math.abs(dx||1e-6),my/Math.abs(dy||1e-6));
    const ex=W/2+dx*k,ey=cy-dy*k,blink=.35+.65*(.5+.5*Math.sin(now/130));
    // свечение у края
    const gx=W/2+dx*(k+44),gy=cy-dy*(k+44),gr=ctx.createRadialGradient(gx,gy,0,gx,gy,Math.max(W,H)*.45);
    gr.addColorStop(0,'rgba('+GOLD+','+(.5*blink).toFixed(3)+')');gr.addColorStop(1,'rgba('+GOLD+',0)');
    ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(ex,ey);ctx.rotate(Math.atan2(-dy,dx)+Math.PI/2);
    ctx.globalAlpha=blink;
    for(let i=0;i<3;i++){ // тройная стрелка: «беги» в эту сторону
      const o=-i*20;ctx.fillStyle='rgba('+GOLD+','+(1-i*.25)+')';ctx.strokeStyle='rgba(120,70,0,.8)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,-26+o);ctx.lineTo(24,2+o);ctx.lineTo(10,2+o);ctx.lineTo(0,-10+o);ctx.lineTo(-10,2+o);ctx.lineTo(-24,2+o);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();ctx.globalAlpha=1;
    ctx.font='700 13px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    const lab=(Math.abs(dx)>.35?(dx>0?'повернись вправо':'повернись влево'):(dy>0?'подними телефон':'опусти телефон'))+' · '+fmt(d);
    const tw=ctx.measureText(lab).width+16,lx=clamp(ex,tw/2+6,W-tw/2-6),ly=clamp(ey+(dy>=0?62:-62),top0,H-botH-24);
    ctx.fillStyle='#101820cc';ctx.beginPath();ctx.roundRect(lx-tw/2,ly-12,tw,24,12);ctx.fill();
    ctx.fillStyle='#ffe9a8';ctx.fillText(lab,lx,ly);ctx.textBaseline='alphabetic';
  }

  function drawAR(now,dt){
    const [W,H]=resize(),ctx=ui.ctx;ctx.clearRect(0,0,W,H);now_=now;
    st.chestHit=null;st.hintHit=null;
    const B=st.basis;if(!B||!st.pos) return;
    const f=(Math.max(W,H)/2)/Math.tan(st.fov*RAD/2);
    const roll=Math.atan2(B.r[2],B.u[2]);
    const main=st.targets[st.sel];
    // остальные цели — маленькие тусклые метки (только если в кадре)
    st.targets.forEach((t,i)=>{
      if(i===st.sel) return;
      const d=Math.max(distTo(t),1),br=bear(st.pos.lat,st.pos.lon,t.lat,t.lon);
      const top=project(vec(br,Math.atan2(Math.min(3+d*.03,150)-CAM_H,d)),B,W,H,f);
      if(!onScreen(top,W,H,-10)) return;
      ctx.globalAlpha=.7;ctx.fillStyle='#101820';ctx.strokeStyle='#ffffffaa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(top.x,top.y,18,0,7);ctx.fill();ctx.stroke();
      ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.icon,top.x,top.y+1);ctx.textBaseline='alphabetic';
      pill(ctx,top.x,top.y+24,t.title.length>26?t.title.slice(0,25)+'…':t.title,fmt(d),false);ctx.globalAlpha=1;
    });
    if(!main) return;
    const d=Math.max(distTo(main),1),br=bear(st.pos.lat,st.pos.lon,main.lat,main.lon),inR=d<=main.radius;
    const hgt=Math.max(12,d*.25); // столб: у цели ~12 м, вдали — всегда заметный угол над горизонтом
    const base=project(vec(br,-Math.atan2(CAM_H,d)),B,W,H,f);
    const top=project(vec(br,Math.atan2(hgt-CAM_H,d)),B,W,H,f);
    const baseOn=onScreen(base,W,H,40),topOn=onScreen(top,W,H,40);

    // 1) искры и бегущие стрелки по земле
    pathSparks(ctx,B,W,H,f,br,d,dt);
    if(!inR) drawChevrons(ctx,B,W,H,f,br,d,now);

    // 2) световой столб
    if(baseOn||topOn) drawBeacon(ctx,main,base.behind?top:base,top.behind?base:top,d,now,dt,W,H,f);
    else drawEdge(ctx,main,top.behind&&base.behind?top:(top.behind?base:top),d,now,W,H);

    // подпись цели под основанием столба
    const ttl=main.title.length>26?main.title.slice(0,25)+'…':main.title;
    if(d>CHEST_SHOW_M){if(topOn)pill(ctx,top.x,top.y-48,ttl,fmt(d),true);}   // вдали подпись над столбом, чтобы не закрывать стрелки
    else if(baseOn)pill(ctx,base.x,base.y+10,ttl,fmt(d),true);

    // 3) сундук на месте цели — «вдруг появляется», когда подошла ближе
    const near=d<=CHEST_SHOW_M;
    if(!near&&d>CHEST_SHOW_M*1.25) st.chestVis=false;
    if(near&&baseOn){
      if(!st.chestVis){st.chestVis=true;st.chestPopAt=now;burstAt(base.x,base.y-40,46);buzz([40,50,40]);}
      const age=(now-st.chestPopAt)/1000,pop=age<.7?(1-Math.pow(1-age/.7,3))*(1+.25*Math.sin(age/.7*Math.PI)):1;
      const s0=clamp(f*1.7/d,62,260)*pop,bob=Math.sin(now/420)*s0*.03;
      ctx.save();
      drawChest(ctx,base.x,base.y+bob,s0,roll,(inR?1:.75)*(.8+.2*Math.sin(now/220)),now);
      ctx.restore();
      st.chestHit={x:base.x,y:base.y-s0*.4,r:Math.max(s0*.8,44)};
      if(inR){
        ctx.font='700 14px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='#000a';ctx.lineWidth=4;
        const tx='✨ Нажми на сундук ✨';ctx.strokeText(tx,base.x,base.y-s0*1.12);ctx.fillText(tx,base.x,base.y-s0*1.12);
      }
    }

    // 4) подсказка «верное направление»: пока телефон смотрит на цель, перед тобой появляется сундучок
    const az=camAz(),aligned=az!=null&&Math.abs(angDiff(az,br))<ALIGN_DEG*RAD&&!near;
    if(aligned){if(!st.alignSince)st.alignSince=now;st.hintLostAt=0;}
    else{if(st.alignSince&&!st.hintLostAt)st.hintLostAt=now;if(st.hintLostAt&&now-st.hintLostAt>700){st.alignSince=0;st.hintAt=0;st.hintLostAt=0;}}
    if(st.alignSince&&now-st.alignSince>ALIGN_HOLD_MS&&!near){
      if(!st.hintAt){st.hintAt=now;buzz([30,40,30]);}
      const F=[Math.sin(br),Math.cos(br)],bob=Math.sin(now/380)*.12;
      const gp=project([F[0]*HINT_DIST,F[1]*HINT_DIST,-CAM_H+.05+Math.max(0,bob)],B,W,H,f);
      if(onScreen(gp,W,H,60)){
        const age=(now-st.hintAt)/1000,pop=age<.6?(1-Math.pow(1-age/.6,3))*(1+.3*Math.sin(age/.6*Math.PI)):1;
        if(age<.05)burstAt(gp.x,gp.y-30,34);
        const s1=clamp(f*1.1/HINT_DIST,60,150)*pop;
        drawChest(ctx,gp.x,gp.y,s1,roll,.9,now);
        st.hintHit={x:gp.x,y:gp.y-s1*.4,r:s1};
        ctx.font='700 14px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='alphabetic';
        const tx='✓ Верное направление · '+fmt(d);const tw=ctx.measureText(tx).width+18;
        ctx.fillStyle='#103a1ccc';ctx.strokeStyle='#5be07a';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(gp.x-tw/2,gp.y-s1*1.25-26,tw,26,13);ctx.fill();ctx.stroke();
        ctx.fillStyle='#d6ffe1';ctx.fillText(tx,gp.x,gp.y-s1*1.25-8);
      }
    }

    // 5) салют искр (при появлении сундука и награде)
    if(st.burst.length){
      ctx.globalCompositeOperation='lighter';
      for(let i=st.burst.length-1;i>=0;i--){
        const p=st.burst[i];p.life+=dt;if(p.life>=p.max){st.burst.splice(i,1);continue}
        p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=1-1.2*dt;
        spark(ctx,p.x,p.y,p.r,clamp(1-p.life/p.max,0,1));
      }
      ctx.globalCompositeOperation='source-over';
    }
  }
  function hud(){
    const now=Date.now();if(now-st.lastHud<200) return;st.lastHud=now;
    // чипы
    if(st.pos&&now-st.fixT<STALE_MS) chip('gps',st.acc<=MAX_ACC?'ok':'wait','📡 GPS ±'+Math.round(st.acc)+' м');
    else chip('gps',st.gpsErr?'bad':'wait',st.gpsErr?'📡 GPS: '+(st.gpsErr==='denied'?'запрещён':'нет сигнала'):'📡 GPS…');
    chip('ori',st.oriOK?'ok':'wait',st.oriOK?'🧭 компас'+(st.iosAlpha?' ≈':''):'🧭 нет датчика');
    note(!st.oriOK&&now-st.openT>3500?'Датчик ориентации не отвечает: метки не будут вращаться вместе с телефоном. На iPhone разреши «Движение и ориентация», в Chrome Android — доступ к датчикам для сайта.':'','ori');
    chip('cam',st.camState==='ok'?'ok':st.camState?'bad':'wait',st.camState==='ok'?'📷 камера':st.camState?'📷 без камеры':'📷 камера…');
    const t=st.targets[st.sel];
    if(!t){ui.tt.textContent='Все реальные задания выполнены 🎉';ui.pl.textContent='Новые появятся по мере прохождения 3D-локаций';ui.dist.textContent='';ui.go.disabled=true;ui.msg.textContent='';return;}
    ui.tt.textContent=(st.sel===0?'🎯 ':'')+t.title+(st.targets.length>1?'  ('+(st.sel+1)+'/'+st.targets.length+')':'');ui.pl.textContent=t.place||'';
    const s=status(t);ui.dist.textContent=s.d!=null?fmt(s.d):'—';
    if(s.ok){if(!st.inSince) st.inSince=now;} else st.inSince=0;
    const ready=s.ok&&st.inSince&&now-st.inSince>=HOLD_MS;
    ui.go.disabled=!ready;ui.go.textContent=t.go||'📍 Отметиться';
    ui.msg.textContent=s.ok&&!ready?'Ты в зоне! Подтверждаем место…':s.text;
    const h=heading();
    if(st.pos&&h!=null){const br=bear(st.pos.lat,st.pos.lon,t.lat,t.lon);ui.arrow.style.transform='rotate('+Math.round((br-h)*DEG)+'deg)';}
  }
  function loop(ts){
    if(!st.on) return;st.raf=requestAnimationFrame(loop);
    const now=ts||performance.now(),dt=st.lastT?Math.min((now-st.lastT)/1000,.1):.016;st.lastT=now;
    try{drawAR(now,dt);hud();}catch(e){console.warn('SevAR frame',e);}
  }

  /* ---------- API ---------- */
  function open(){
    build();if(st.on) return;
    st.on=true;st.pos=null;st.acc=null;st.basis=null;st.oriOK=false;st.oriAbs=false;st.camState='';st.gpsErr='';st.inSince=0;st.sel=0;st.fixes=0;st.lastT=0;st.tid='';
    resetFx();st.burst.length=0;
    for(const k in notes)delete notes[k];note('');ui.card.hidden=true;st.openT=Date.now();refreshTargets();ui.root.hidden=false;
    startSensors();st.raf=requestAnimationFrame(loop);
  }
  function close(){
    if(!st.on) return;st.on=false;cancelAnimationFrame(st.raf);stopSensors();ui.root.hidden=true;
  }
  window.SevAR={open,close,get isOpen(){return st.on;},
    state:()=>({pos:st.pos,acc:st.acc,cam:st.camState,gpsErr:st.gpsErr,ori:st.oriOK,targets:st.targets.map(t=>({id:t.id,kind:t.kind,d:distTo(t)})),sel:st.sel,heading:heading()!=null?heading()*DEG:null,
      chest:st.chestVis,hint:!!st.hintAt})};
})();

