
(function(){
var KEY="sevlions1",POS=[[-11.6,42.3],[11.6,42.3]],R=7.5;
var QS=[
{t:"Лев 1 из 2",q:"Два мраморных льва охраняют парадную лестницу Графской пристани. Но почему для украшения главных морских ворот Севастополя выбрали именно львов, а не, например, орлов или дельфинов?",
 o:["Львы символизируют силу, мужество, достоинство и охрану важного места.","Львы были символом Черноморского флота и изображались на всех кораблях.","Львы указывали морякам направление входа в Севастопольскую бухту.","Львы были установлены, потому что Екатерина II особенно любила этих животных."],
 c:0,hint:"Подумай, какими качествами люди наделяют льва — царя зверей.",ok:"Верно! Лев — символ силы, мужества и достоинства. Поэтому каменные львы «охраняют» парадный вход в город со стороны моря."},
{t:"Лев 2 из 2",q:"Во время Крымской войны Севастополь оказался в осаде. Графская пристань была не только красивым парадным входом в город, но и имела важное значение для его защитников.\n\nКакую важную роль она выполняла во время обороны Севастополя?",
 o:["Служила местом проведения праздничных морских парадов.","Была важным пунктом переправы через бухту, помогая перевозить людей и раненых на Северную сторону.","Использовалась как место строительства новых военных кораблей.","Служила главным складом оружия и боеприпасов."],
 c:1,hint:"Вспомни страницу истории: через бухту нужно было переправляться на Северную сторону.",ok:"Верно! Графская пристань стала важным пунктом переправы через бухту: отсюда перевозили людей и раненых на Северную сторону."},
{t:"Последний вопрос",q:"Ты внимательно рассмотрел двух каменных львов. А какое историческое место они охраняют?",
 o:["Малахов курган","Графская пристань","Херсонес Таврический","Панорама «Оборона Севастополя»"],
 c:1,hint:"Ты стоишь у подножия её парадной лестницы с белой колоннадой 1846 года.",ok:"Верно! Львы — стражи Графской пристани, парадных морских ворот Севастополя."}];
function ld(){try{var s=JSON.parse(localStorage.getItem(KEY)||"{}");s.l=s.l||[0,0];s.f=s.f||0;return s}catch(e){return{l:[0,0],f:0}}}
function sv(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
window.__lionHud=function(){var s=ld();if(s.f)return null;var n=s.l[0]+s.l[1];return n<2?"🦁 Квест «Секрет Графской пристани»: найди двух каменных львов у подножия лестницы ("+n+"/2)":"🦁 Последний вопрос: подойди к любому льву"};
var css=document.createElement("style");css.textContent="#lionBtn{position:fixed;left:50%;bottom:205px;transform:translateX(-50%);z-index:60;padding:12px 20px;border:3px solid #e0b04a;border-radius:18px;background:linear-gradient(#fff3c4,#f3c75a);color:#5a3510;font:800 17px/1.1 inherit;box-shadow:0 5px 0 #a8742a,0 8px 18px rgba(0,0,0,.3);animation:lnPulse 1.1s ease-in-out infinite}#lionBtn[hidden]{display:none}@keyframes lnPulse{50%{transform:translateX(-50%) scale(1.07)}}"+
"#lionQ{position:fixed;inset:0;z-index:9000;background:rgba(20,16,10,.62);display:flex;align-items:center;justify-content:center;padding:14px}#lionQ[hidden]{display:none}"+
".lnc{position:relative;width:min(560px,100%);max-height:94vh;overflow:auto;background:#fff8e4;border:4px solid #e0b04a;border-radius:22px;padding:16px 16px 14px;box-shadow:0 12px 40px rgba(0,0,0,.5);color:#4a2f12;animation:lnIn .35s ease-out}@keyframes lnIn{from{transform:scale(.8);opacity:0}}"+
".lnc h3{margin:0 30px 6px 0;font-size:19px}.lnc .lnq{white-space:pre-line;font-size:16px;line-height:1.4;margin:6px 0 10px;font-weight:600}.lnx{position:absolute;right:10px;top:8px;border:0;background:none;font-size:22px;color:#8a5a20}"+
".lno{display:block;width:100%;text-align:left;margin:7px 0;padding:11px 12px;border:3px solid #d8b66a;border-radius:14px;background:#fff;color:#4a2f12;font:700 15px/1.3 inherit}.lno.ok{background:#d6f5c9;border-color:#4caf50}.lno.bad{background:#ffdcd6;border-color:#d9534f;animation:lnSh .35s}.lno:disabled{opacity:.85}@keyframes lnSh{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}"+
".lnf{margin:8px 0 2px;font-weight:700;font-size:15px;line-height:1.35}.lnn{display:block;margin:10px auto 0;padding:11px 26px;border:3px solid #a8742a;border-radius:16px;background:linear-gradient(#ffe38a,#f0b83c);color:#4a2f12;font:800 17px/1 inherit}"+
".lnr{text-align:center}.lnm{position:relative;width:170px;height:170px;margin:4px auto 6px;border-radius:50%;background:radial-gradient(circle,#fff5c2 0%,#f7c948 45%,#c8861e 100%);border:6px solid #fff0a8;box-shadow:0 0 40px 12px rgba(255,205,70,.8);display:flex;align-items:center;justify-content:center;font-size:92px;animation:lnGl 1.6s ease-in-out infinite alternate}@keyframes lnGl{to{box-shadow:0 0 70px 24px rgba(255,205,70,.95);transform:scale(1.05)}}"+
".lnrays{position:absolute;left:50%;top:70px;width:340px;height:340px;margin-left:-170px;background:repeating-conic-gradient(rgba(255,214,90,.35) 0 8deg,transparent 8deg 22deg);border-radius:50%;animation:lnSp 12s linear infinite;pointer-events:none}@keyframes lnSp{to{transform:rotate(360deg)}}";
document.head.appendChild(css);
var btn=document.createElement("button");btn.id="lionBtn";btn.hidden=true;document.body.appendChild(btn);
var ov=document.createElement("div");ov.id="lionQ";ov.hidden=true;document.body.appendChild(ov);
var cur=null,open=false;
function close(){ov.hidden=true;ov.innerHTML="";open=false}
function reward(){
 var s=ld();s.f=1;sv(s);
 try{window.__sevReward&&window.__sevReward("Артефакт «Золотой лев»",2)}catch(e){}
 if(window.__sevGrafDone){s.g=1;sv(s);close();window.__sevGrafDone();return}
 ov.innerHTML='<div class="lnc lnr" style="overflow:hidden"><div class="lnrays"></div><h3 style="margin:0;font-size:20px;position:relative">🎉 Квест пройден!</h3><div class="lnm" style="position:relative">🦁</div><h3 style="font-size:22px;margin:4px 0;position:relative">Артефакт «Золотой лев»</h3><div class="lnf" style="position:relative">Символ мудрости, силы и верности исторической памяти.<br>+2 ⭐ кристалла. Артефакт лежит в инвентаре.</div><button class="lnn" style="position:relative">Отлично!</button></div>';
 ov.querySelector(".lnn").onclick=close;
}
function show(i){
 var d=QS[i];open=true;ov.hidden=false;
 ov.innerHTML='<div class="lnc"><button class="lnx" aria-label="Закрыть">✕</button><h3>🦁 Секрет Графской пристани · '+d.t+'</h3><div class="lnq"></div><div class="lna"></div><div class="lnf"></div></div>';
 ov.querySelector(".lnq").textContent=d.q;
 var A=ov.querySelector(".lna"),F=ov.querySelector(".lnf"),done=false;
 ov.querySelector(".lnx").onclick=close;
 d.o.forEach(function(t,k){var b=document.createElement("button");b.className="lno";b.textContent="АБВГ"[k]+". "+t;
  b.onclick=function(){if(done)return;
   if(k===d.c){done=true;b.classList.add("ok");[].forEach.call(A.children,function(x){x.disabled=true});F.textContent="✅ "+d.ok;
    var n=document.createElement("button");n.className="lnn";n.textContent=i===2?"Забрать награду":"Дальше";F.appendChild(n);
    n.onclick=function(){var s=ld();if(i<2){s.l[i]=1;sv(s);close();if(s.l[0]&&s.l[1]&&!s.f)setTimeout(function(){show(2)},350)}else{reward()}};
   }else{b.classList.add("bad");b.disabled=true;F.textContent="Не совсем. Подумай ещё раз! 💡 "+d.hint}};
  A.appendChild(b)});
}
btn.onclick=function(){if(cur!==null)show(cur)};
function tick(){
 var g=window.__sevGame,s=ld(),t=null;
 try{
  if(g&&g.player&&g.scene&&g.scene.getMeshByName("graf-deck")&&!open){
   var p=g.player.collider.position,ok=!!(s.f===0);
   if(ok){for(var i=0;i<2;i++){var dx=p.x-POS[i][0],dz=p.z-POS[i][1];if(dx*dx+dz*dz<R*R){if(!s.l[i]){t=i;break}else if(s.l[0]&&s.l[1]){t=2;break}}}}
  }
 }catch(e){}
 if(s.f&&!s.g&&!open&&g&&g.scene&&g.scene.getMeshByName&&g.scene.getMeshByName("graf-deck")&&window.__sevGrafDone){s.g=1;sv(s);window.__sevGrafDone()}
 cur=t;btn.hidden=t===null||open;if(t!==null)btn.textContent=t===2?"🦁 Последний вопрос":"🦁 Осмотреть льва";
 try{var m=window.__lionMarks;if(m){var tm=Date.now()/400;m.forEach(function(o,i){var done=!!s.l[i]||s.f;o.ring.setEnabled(!done);o.gem.setEnabled(!done);o.gem.position.y=o.y+Math.sin(tm+i)*.3;o.gem.rotation.y=tm})}}catch(e){}
}
setInterval(tick,200);
})();
