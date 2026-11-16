
/* ===== Летопись Парка Победы: страницы-находки и приз — волшебная книга ===== */
(function(){
var LIONIMG="assets/images/chronicle/lionimg.webp",GSPREAD="assets/images/chronicle/gspread.webp";var FOX="assets/images/chronicle/fox.webp";var COVER="assets/images/chronicle/cover.webp",SPREAD="assets/images/chronicle/spread.webp";
var INTRO={icon:"🌊",title:"До того, как здесь вырос Парк Победы",
 short:"Во время обороны Севастополя в 1941–1942 годах бои шли по всему городу и его берегам, а в бухтах работали корабли и катера Черноморского флота. Город освободили 9 мая 1944 года. А 9 мая 1975 года, к 30-летию Победы, здесь открыли Парк Победы — символ памяти и благодарности героям.",
 more:"Подвиг Ивана Голубца\n25 марта 1942 года в Стрелецкой бухте Севастополя на одном из кораблей начался пожар, и возникла угроза взрыва глубинных бомб. Старший матрос Иван Голубец стал сбрасывать бомбы за борт, пока одна из них не взорвалась. Он погиб, но спас другие корабли и людей. Звание Героя Советского Союза ему присвоили посмертно 14 июня 1942 года.",
 why:"«Знаешь ли ты? Парк Победы был открыт 9 мая 1975 года!»"};
var P=[
 ["stalingrad","⚔️","Сталинград","Сталинградская битва шла с июля 1942 по февраль 1943 года. Это одна из самых больших битв Великой Отечественной войны, после неё в войне наступил перелом. Звание города-героя Сталинград получил в 1965 году.","Бои шли в самом городе: за отдельные дома и заводские цеха. Победа под Сталинградом, завершившаяся 2 февраля 1943 года, вдохновила всю страну.","Эту находку я принёс первой: защитники Сталинграда показали, что можно выстоять, когда за спиной родной дом. Севастополь знает, что такое стойкость."],
 ["odessa","⚓","Одесса","Оборона Одессы длилась 73 дня, с августа по октябрь 1941 года. Потом защитников Одессы на кораблях привезли в Севастополь, и они продолжили борьбу уже здесь. Звание города-героя Одесса получила в 1965 году.","Город защищали бойцы Приморской армии, моряки и сами одесситы. В октябре 1941 года их организованно вывезли на кораблях Черноморского флота.","Видишь, как связаны наши города? Одесситы пришли на помощь Севастополю. Настоящая дружба городов начинается с общего дела."],
 ["moscow","🌟","Москва","Зимой 1941 года под Москвой немецкое наступление остановили, а в начале декабря началось контрнаступление Красной армии. Это стало первым крупным поражением вермахта во Второй мировой войне. Москва получила звание города-героя в 1965 году.","Фронт подходил к столице совсем близко, а 7 ноября 1941 года на Красной площади всё равно прошёл парад: бойцы шли прямо на фронт.","Эта находка напоминает: даже когда очень трудно, нельзя терять веру. Победа складывается из смелости многих людей."],
 ["kerch","🕯️","Керчь","Весной и летом 1942 года в Аджимушкайских каменоломнях под Керчью почти полгода держали оборону бойцы и жители. Звание города-героя Керчь получила в 1973 году.","Подземный гарнизон держался с мая по октябрь 1942 года. Сегодня в каменоломнях работает музей обороны.","Я храню эту находку особенно бережно. Подвиг под землёй почти не был виден, но именно такие истории нельзя забывать."],
 ["tula","🛠️","Тула","Осенью 1941 года враг не смог взять Тулу. Тульские заводы делали оружие для фронта, а жители строили оборону. Звание города-героя Тула получила в 1976 году.","Из рабочих и жителей города собрали Тульский рабочий полк, который встал на защиту Тулы.","Не только бойцы совершали подвиги: мастера, рабочие и жители тоже защищали Родину. Память хранит всех."],
 ["sevastopol","🗼","Севастополь","Героическая оборона Севастополя в Великую Отечественную войну длилась 250 дней, с октября 1941 по июль 1942 года. Город освободили 9 мая 1944 года. Звание города-героя Севастополь получил в 1965 году.","На защиту города встали моряки Черноморского флота, бойцы Приморской армии и сами севастопольцы.","Это наш с тобой город! Теперь ты знаешь, почему парк называется Парком Победы: здесь хранят память о тех, кто подарил нам мирное небо."]
];
var GRAF={icon:"🏛",title:"Графская пристань — парадные ворота Севастополя",
 fact:"В 1783 году здесь появился небольшой причал для шлюпок. В 1787 году, к приезду императрицы Екатерины II, пристань благоустроили и назвали Екатерининской. Но народ запомнил её как Графскую: от неё любил отплывать граф Марко Войнович, командующий Севастопольской эскадрой. А в 1846 году пристань получила знаменитый облик: белую колоннаду, широкую лестницу и мраморных львов.",
 more:"Во время Крымской войны Графская пристань стала важным местом переправы на Северную сторону: через неё доставляли раненых и помогали защитникам и жителям осаждённого города.\n\nАртефакт главы: «Золотой лев» — символ мудрости, силы и верности исторической памяти.\n\nДевиз главы: «Город начинается с моря, а его история живёт в памяти!»",
 why:"Знаешь ли ты? Название «Графская» появилось благодаря графу Войновичу, который отплывал от этой пристани. А два каменных льва охраняют её парадную лестницу."};
function lionsDone(){try{return !!JSON.parse(localStorage.getItem("sevlions1")||"{}").f}catch(e){return false}}
var ORD=["первую","вторую","третью","четвёртую","пятую","последнюю"];
var MAP={};P.forEach(function(p,i){MAP[p[0]]={n:i+1,icon:p[1],title:p[2],fact:p[3],more:p[4],why:p[5]}});
window.__SEV_FOX=FOX;window.__SEV_CHRON={pages:MAP,order:P.map(function(p){return p[0]}),cover:COVER};
function hunt(){try{return (JSON.parse(localStorage.getItem("sevlis1")||"{}").hunt)||{}}catch(e){return {}}}
function got(){return hunt().got||{}}
function cnt(){var g=got(),n=0;P.forEach(function(p){if(g[p[0]])n++});return n}
function bar(n){var h="";for(var i=0;i<P.length;i++)h+='<i class="'+(i<n?"on":"")+'"></i>';return '<div class="chr__bar" aria-label="Прогресс">'+h+'</div>'}
function esc(t){return String(t).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})}
var css=document.createElement("style");css.textContent=
"#btnChron{position:fixed;right:calc(12px + var(--safe-r));top:calc(var(--safe-t) + 112px);z-index:6;width:42px;height:42px;font-size:22px}body[data-mode=map] #btnChron{display:none!important}"+
".chr__cover{width:100%;border-radius:12px;display:block;margin:0 0 10px}.chr__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 0 12px}"+
".chr__pg{cursor:pointer;color:var(--ink);background:linear-gradient(#ffe9a8,#f0c260);border:2px solid #7a4a10;border-radius:10px;padding:8px 6px;font:800 13px/1.15 inherit;text-align:left}.chr__pg[disabled]{cursor:default;opacity:.55;background:#d9ccb0;border-color:#8a7a5a}.chr__pg.on{outline:3px solid #2f7fc1}.chr__pg.wide{grid-column:1/-1}"+
".chr__body{background:#fff;border:2px solid #d9b46a;border-radius:12px;padding:12px;font-size:15px;line-height:1.45;white-space:pre-line}.chr__body b{display:block;font-size:17px;margin-bottom:6px}.chr__why{margin-top:10px;padding:8px 10px;background:#eaf3ff;border-left:4px solid #2f7fc1;border-radius:8px;font-size:14px}"+
".chr__more{margin-top:10px;padding:8px 10px;background:#fff6dc;border-radius:8px;font-size:14px;white-space:pre-line}.chr__btn{margin-top:10px;cursor:pointer;color:var(--ink);background:linear-gradient(#ffe08a,#e0a030);border:2px solid #7a4a10;border-radius:10px;padding:8px 12px;font:800 14px/1.2 inherit}.chr__btn[disabled]{opacity:.5;cursor:default}"+
".chr__bar{display:flex;gap:5px;margin:6px 0 8px}.chr__bar i{flex:1;height:10px;border-radius:5px;background:#d9ccb0;border:1px solid #8a7a5a}.chr__bar i.on{background:linear-gradient(#ffe36e,#f0a020);border-color:#a36b00}"+
".chr__spread{width:100%;border-radius:10px;display:block;margin:0 0 8px}"+
"#chrFx{position:fixed;inset:0;z-index:90;background:radial-gradient(circle at 50% 38%,rgba(40,70,140,.84),rgba(5,10,30,.94));display:flex;align-items:center;justify-content:center;padding:12px;overflow:hidden}#chrFx[hidden]{display:none}"+
".fx__stage{position:relative;width:min(440px,100%);height:min(580px,90vh)}"+
".fx__ban{position:absolute;left:0;right:0;top:4%;text-align:center;background:linear-gradient(#fff8e4,#f6e0a0);border:3px solid #e0b04a;border-radius:16px;padding:12px 14px;font:800 18px/1.25 inherit;color:var(--ink);opacity:0;transform:translateY(-30px) scale(.9);animation:fxBan .6s ease-out .3s forwards;box-shadow:0 6px 24px #0008}@keyframes fxBan{to{opacity:1;transform:none}}"+
".fx__fox{position:absolute;left:0;bottom:0;width:150px;transform:translateX(-170%);animation:fxIn 1.3s ease-out .2s forwards,fxBob .45s ease-in-out .2s 3}@keyframes fxIn{to{transform:translateX(0)}}@keyframes fxBob{50%{margin-bottom:10px}}.fx__bub{position:absolute;left:140px;bottom:90px;right:0;background:#fff8e4;border:3px solid #e0b04a;border-radius:16px;padding:10px 12px;font:800 15px/1.3 inherit;color:var(--ink);opacity:0;transform:scale(.7);transform-origin:0 100%;animation:fxPop .4s ease-out 1.4s forwards}@keyframes fxPop{to{opacity:1;transform:scale(1)}}.fx__art{position:absolute;left:50%;top:48%;width:140px;height:140px;margin:-70px 0 0 -70px;border-radius:50%;background:#fff3c4 center/cover no-repeat;border:4px solid #ffd54a;animation:fxGlow 1.1s ease-in-out infinite,fxArt .8s ease-out both;transition:transform .7s,opacity .7s}.fx__art.out{transform:scale(.2) rotate(240deg);opacity:0}"+
"@keyframes fxArt{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}"+
"@keyframes fxGlow{0%,100%{box-shadow:0 0 18px 6px #ffd54a99,0 0 50px 16px #ffd54a55}50%{box-shadow:0 0 34px 14px #ffe98acc,0 0 90px 36px #ffd54a77}}"+
".fx__ray{position:absolute;left:50%;top:48%;width:360px;height:360px;margin:-180px 0 0 -180px;border-radius:50%;background:repeating-conic-gradient(rgba(255,226,120,.35) 0 10deg,transparent 10deg 30deg);animation:fxSpin 8s linear infinite;-webkit-mask:radial-gradient(circle,#000 20%,transparent 68%);mask:radial-gradient(circle,#000 20%,transparent 68%)}@keyframes fxSpin{to{transform:rotate(360deg)}}"+
".fx__sheet{position:absolute;left:50%;top:48%;width:170px;height:210px;margin:-105px 0 0 -85px;border-radius:10px;background:linear-gradient(135deg,#fff3c8,#e8c47a);border:3px solid #b98a3a;display:flex;align-items:center;justify-content:center;font-size:70px;transform:scale(.2) rotate(-20deg);opacity:0;transition:transform .7s,opacity .5s;box-shadow:0 0 40px 10px #ffd54a88}.fx__sheet.on{transform:scale(1) rotate(0);opacity:1}.fx__sheet.flip{transform:rotateY(90deg);opacity:0}"+
".fx__spk{position:absolute;font-size:22px;opacity:0;animation:fxSpk 2.4s ease-in-out infinite}@keyframes fxSpk{0%{opacity:0;transform:translateY(10px) scale(.4)}40%{opacity:1}100%{opacity:0;transform:translateY(-40px) scale(1.1)}}"+
".fx__book{position:absolute;left:50%;top:50%;width:min(340px,86%);transform:translate(-50%,-50%) scale(.2) rotate(-12deg);opacity:0;border-radius:14px;box-shadow:0 0 50px 14px #ffd54a99;transition:transform .9s cubic-bezier(.2,1.3,.4,1),opacity .6s}.fx__book.on{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}.fx__book.flip{transform:translate(-50%,-50%) perspective(700px) rotateY(90deg);opacity:0;transition:transform .6s,opacity .5s}"+
".fx__cap{position:absolute;left:0;right:0;bottom:6%;text-align:center;font:800 20px/1.25 inherit;color:#fff3c4;text-shadow:0 2px 8px #000;opacity:0;animation:fxBan .7s ease-out 1.2s forwards}"+
".fx__page{position:absolute;inset:0;overflow:auto;background:linear-gradient(#fff8e4,#f6e7c0);border:4px solid var(--gold);border-radius:18px;padding:16px;display:none;box-shadow:0 12px 40px #000a;color:var(--ink)}.fx__page.on{display:block;animation:fxFlip .6s ease-out}"+
"@keyframes fxFlip{from{transform:perspective(900px) rotateY(-80deg);opacity:0}to{transform:perspective(900px) rotateY(0);opacity:1}}"+
".fx__page h3{margin:4px 0 8px;font-size:22px;line-height:1.15}.fx__page p{margin:0 0 8px;font-size:16px;line-height:1.45}.fx__rew{margin:10px 0;padding:8px 10px;background:#fff3c4;border:2px dashed #e0a030;border-radius:10px;font-weight:800;font-size:14px}.fx__lab{font-weight:800;color:#8a5a10;margin:0 0 4px}"+
".fx__skip{position:absolute;right:6px;top:-2px;z-index:2;color:#ffe9c0;background:#0006;border:1px solid #ffe9c055;border-radius:10px;padding:4px 10px;font:700 12px/1 inherit;cursor:pointer}";
document.head.appendChild(css);
var box=document.createElement("div");box.id="chron";box.className="card";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");
box.innerHTML='<div class="card__panel"><button class="card__close" type="button" aria-label="Закрыть" id="chrX">×</button><img class="chr__cover" alt="Летопись Севастополя" src="'+COVER+'"><h2 class="card__title" style="margin-top:0">📖 Летопись Севастополя</h2><p class="card__text" id="chrCnt" style="margin-bottom:0"></p><div id="chrBar"></div><div class="chr__grid" id="chrGrid"></div><div class="chr__body" id="chrBody"></div><button class="card__ok" type="button" id="chrOk" style="margin-top:12px">Закрыть</button></div>';
var btn=document.createElement("button");btn.id="btnChron";btn.className="hud__btn";btn.type="button";btn.title="Летопись Севастополя";btn.setAttribute("aria-label","Летопись Севастополя");btn.textContent="📖";btn.hidden=true;
function sync(){btn.hidden=!hunt().prize}
function showPage(d,head,spread){var body=document.getElementById("chrBody");
 body.innerHTML=(spread?'<img class="chr__spread" alt="" src="'+SPREAD+'">':"")+"<b>"+head+"</b>"+esc(d.fact||d.short)+'<div class="chr__why">🦊 '+(d.fact?"Севастик: ":"")+esc(d.why)+'</div><div class="chr__more" hidden>'+esc(d.more)+'</div><button type="button" class="chr__btn">Читать дальше</button>';
 var mb=body.querySelector(".chr__btn"),mo=body.querySelector(".chr__more");mb.onclick=function(){mo.hidden=!mo.hidden;mb.textContent=mo.hidden?"Читать дальше":"Свернуть"}}
function showGraf(){var body=document.getElementById("chrBody");body.innerHTML='<img class="chr__spread" alt="" src="'+GSPREAD+'"><b>'+GRAF.icon+" "+esc(GRAF.title)+"</b>"+esc(GRAF.fact)+'<div class="chr__why">🦊 Севастик: '+esc(GRAF.why)+'</div><div class="chr__more" hidden>'+esc(GRAF.more)+'</div><button type="button" class="chr__btn">Читать дальше</button>';var mb=body.querySelector(".chr__btn"),mo=body.querySelector(".chr__more");mb.onclick=function(){mo.hidden=!mo.hidden;mb.textContent=mo.hidden?"Читать дальше":"Свернуть"}}
function render(sel){var g=got(),n=cnt(),grid=document.getElementById("chrGrid");grid.innerHTML="";
 var all=[],b0=document.createElement("button");b0.type="button";b0.className="chr__pg wide";b0.textContent="🌊 Первая страница: "+INTRO.title;grid.appendChild(b0);all.push(b0);
 b0.onclick=function(){all.forEach(function(c){c.classList.remove("on")});b0.classList.add("on");showPage(INTRO,"🌊 "+INTRO.title,true)};
 P.forEach(function(p,i){var ok=!!g[p[0]];var b=document.createElement("button");b.type="button";b.className="chr__pg";b.disabled=!ok;all.push(b);
  b.textContent=ok?p[1]+" "+p[2]:"🔒 Страница "+(i+2);b.onclick=function(){all.forEach(function(c){c.classList.remove("on")});b.classList.add("on");var d=MAP[p[0]];showPage(d,d.icon+" Страница "+(d.n+1)+": "+d.title)};grid.appendChild(b)});
 var gb=document.createElement("button");gb.type="button";gb.className="chr__pg wide";var gok=lionsDone();gb.disabled=!gok;gb.textContent=gok?"🏛 Глава 2: Графская пристань":"🔒 Глава 2: Графская пристань";all.push(gb);gb.onclick=function(){all.forEach(function(c){c.classList.remove("on")});gb.classList.add("on");showGraf()};grid.appendChild(gb);
 document.getElementById("chrCnt").textContent="Открыто страниц: "+(n+1)+" из "+(P.length+1)+(gok?" · Глава 2: Графская пристань ✓":"");document.getElementById("chrBar").innerHTML=bar(n);
 if(sel==="graf"&&gok)gb.click();else if(sel==="intro")b0.click();else if(sel&&MAP[sel]&&g[sel])all[MAP[sel].n].click();else b0.click()}
function open(sel){render(sel);box.hidden=false}
function close(){box.hidden=true}
var fx=document.createElement("div");fx.id="chrFx";fx.hidden=true;var fxT=[],fxI=0,fxLock=false;
function fxClear(){fxT.forEach(clearTimeout);fxT=[]}
function fxEnd(){fxClear();clearInterval(fxI);fxLock=false;fx.hidden=true;fx.innerHTML=""}
function sparks(n){var h="";for(var i=0;i<n;i++)h+='<span class="fx__spk" style="left:'+(Math.random()*92+2)+'%;top:'+(Math.random()*80+8)+'%;animation-delay:'+(Math.random()*2.4).toFixed(2)+'s">'+(i%3?"✨":"⭐")+'</span>';return h}
/* десять секунд страница остаётся на экране: кнопки закрытия оживают после обратного отсчёта */
function hold(pg,sel){var els=[].slice.call(pg.querySelectorAll("[data-lock]")),labs=els.map(function(e){return e.textContent}),left=10;fxLock=true;
 els.forEach(function(e,i){e.disabled=true;e.textContent=labs[i]+" ("+left+")"});clearInterval(fxI);
 fxI=setInterval(function(){left--;if(left<=0){clearInterval(fxI);fxLock=false;els.forEach(function(e,i){e.disabled=false;e.textContent=labs[i]})}else els.forEach(function(e,i){e.textContent=labs[i]+" ("+left+")"})},1000)}
function found(id,artSrc,final){var d=MAP[id];if(!d)return;fxClear();var n=cnt();
 fx.innerHTML='<div class="fx__stage"><button class="fx__skip" type="button">Пропустить</button>'+sparks(10)+
 '<div class="fx__ray"></div><img class="fx__fox" alt="Севастик" src="'+FOX+'"><div class="fx__bub">Отличная работа! Ты нашёл '+ORD[d.n-1]+' часть истории!</div>'+
 '<div class="fx__art" style="background-image:url('+(artSrc||"")+')"></div><div class="fx__sheet">📜</div>'+
 '<div class="fx__page"><p class="fx__lab">📜 Страница '+(d.n+1)+' из '+(P.length+1)+'</p>'+bar(n)+
 '<h3>'+d.icon+' '+esc(d.title)+'</h3><p>'+esc(d.fact)+'</p><div class="chr__why">🦊 Севастик: '+esc(d.why)+'</div><div class="chr__more" hidden>'+esc(d.more)+'</div>'+
 '<div class="fx__rew">🎁 Награда: +3 ⭐ и значок 🏅 «Хранитель страницы '+(d.n+1)+'»</div>'+
 '<button type="button" class="chr__btn" data-a="more">Читать дальше</button> <button type="button" class="chr__btn" data-a="ok" data-lock="1">'+(final?"Дальше":"Продолжить")+'</button></div></div>';
 fx.hidden=false;var st=fx.firstChild,art=st.querySelector(".fx__art"),sh=st.querySelector(".fx__sheet"),pg=st.querySelector(".fx__page"),shown=false;
 function page(){if(shown)return;shown=true;fxClear();[".fx__art",".fx__sheet",".fx__fox",".fx__bub",".fx__ray"].forEach(function(q){st.querySelector(q).style.display="none"});pg.classList.add("on");hold(pg)}
 st.querySelector(".fx__skip").onclick=page;
 fxT.push(setTimeout(function(){art.classList.add("out");sh.classList.add("on")},2800));
 fxT.push(setTimeout(function(){sh.classList.add("flip")},3900));fxT.push(setTimeout(page,4400));
 pg.addEventListener("click",function(e){var a=e.target&&e.target.getAttribute&&e.target.getAttribute("data-a");if(!a)return;
  if(a==="more"){var mo=pg.querySelector(".chr__more");mo.hidden=!mo.hidden;e.target.textContent=mo.hidden?"Читать дальше":"Свернуть"}
  else{fxEnd();if(final)prize()}})}
/* приз: волшебная книга и первая страница */
function prize(){fxClear();
 fx.innerHTML='<div class="fx__stage"><button class="fx__skip" type="button">Пропустить</button>'+sparks(16)+'<div class="fx__ray"></div>'+
 '<img class="fx__book" alt="Волшебная Летопись" src="'+COVER+'"><img class="fx__fox" alt="Севастик" src="'+FOX+'"><div class="fx__cap">🎁 Севастик дарит тебе волшебную Летопись!</div>'+
 '<div class="fx__page"><p class="fx__lab">📖 Первая страница Летописи</p><img class="chr__spread" alt="" src="'+SPREAD+'"><h3>🌊 '+esc(INTRO.title)+'</h3><p>'+esc(INTRO.short)+'</p><div class="chr__why">🦊 Севастик: '+esc(INTRO.why)+'</div><div class="chr__more" hidden>'+esc(INTRO.more)+'</div>'+
 '<div class="fx__rew">🎁 Награда: волшебная Летопись Парка Победы. Остальные страницы ты уже нашёл! Севастик ждёт тебя дальше.</div>'+
 '<button type="button" class="chr__btn" data-a="more">Читать дальше</button> <button type="button" class="chr__btn" data-a="book" data-lock="1">В Летопись</button> <button type="button" class="chr__btn" data-a="ok" data-lock="1">Закрыть</button></div></div>';
 fx.hidden=false;var st=fx.firstChild,bk=st.querySelector(".fx__book"),pg=st.querySelector(".fx__page"),shown=false;
 function page(){if(shown)return;shown=true;fxClear();[".fx__book",".fx__cap",".fx__fox",".fx__ray"].forEach(function(q){st.querySelector(q).style.display="none"});pg.classList.add("on");hold(pg)}
 st.querySelector(".fx__skip").onclick=page;
 fxT.push(setTimeout(function(){bk.classList.add("on")},300));fxT.push(setTimeout(function(){bk.classList.add("flip")},4200));fxT.push(setTimeout(page,4800));
 pg.addEventListener("click",function(e){var a=e.target&&e.target.getAttribute&&e.target.getAttribute("data-a");if(!a)return;
  if(a==="more"){var mo=pg.querySelector(".chr__more");mo.hidden=!mo.hidden;e.target.textContent=mo.hidden?"Читать дальше":"Свернуть"}
  else if(a==="book"){fxEnd();open("intro")}else fxEnd()})}
/* финал квеста Графской: Золотой лев → книга → глава 2 */
function grafDone(){fxClear();
 fx.innerHTML='<div class="fx__stage"><button class="fx__skip" type="button">Пропустить</button>'+sparks(16)+'<div class="fx__ray"></div><img class="fx__fox" alt="Севастик" src="'+FOX+'"><div class="fx__bub">Отлично! Ты прошёл квест Графской пристани и получил Золотого льва!</div>'+
 '<div class="fx__art" style="background-image:url('+LIONIMG+');background-size:contain;background-repeat:no-repeat;width:230px;height:230px;margin:-115px 0 0 -115px;border:0;border-radius:0;background-color:transparent;animation:fxArt .8s ease-out both;filter:drop-shadow(0 0 16px #ffd54a) drop-shadow(0 0 34px #ffd54acc)"></div>'+
 '<img class="fx__book" alt="Летопись" src="'+COVER+'"><div class="fx__cap">📖 В Летописи — новая глава!</div>'+
 '<div class="fx__page"><p class="fx__lab">📖 Глава 2 · Летопись Севастополя</p><img class="chr__spread" alt="" src="'+GSPREAD+'"><h3>'+GRAF.icon+' '+esc(GRAF.title)+'</h3><p>'+esc(GRAF.fact)+'</p><div class="chr__why">🦊 Севастик: '+esc(GRAF.why)+'</div><div class="chr__more" hidden>'+esc(GRAF.more)+'</div>'+
 '<div class="fx__rew">🎁 Награда: артефакт «Золотой лев» (символ мудрости, силы и верности исторической памяти), +2 ⭐ и новая глава Летописи.</div>'+
 '<div class="fx__rew" style="background:#dff5d0;border-color:#4caf50">✅ Графская пристань пройдена! Задание и квест выполнены. Остальные места Севастополя откроются позже.</div>'+
 '<button type="button" class="chr__btn" data-a="more">Читать дальше</button> <button type="button" class="chr__btn" data-a="book" data-lock="1">В Летопись</button> <button type="button" class="chr__btn" data-a="ok" data-lock="1">Закрыть</button></div></div>';
 fx.hidden=false;var st=fx.firstChild,art=st.querySelector(".fx__art"),bk=st.querySelector(".fx__book"),pg=st.querySelector(".fx__page"),shown=false;
 function page(){if(shown)return;shown=true;fxClear();[".fx__art",".fx__book",".fx__cap",".fx__fox",".fx__bub",".fx__ray"].forEach(function(q){st.querySelector(q).style.display="none"});pg.classList.add("on");hold(pg)}
 st.querySelector(".fx__skip").onclick=page;
 fxT.push(setTimeout(function(){art.classList.add("out");st.querySelector(".fx__bub").style.display="none";st.querySelector(".fx__fox").style.display="none";bk.classList.add("on")},3600));
 fxT.push(setTimeout(function(){bk.classList.add("flip")},6600));fxT.push(setTimeout(page,7200));
 pg.addEventListener("click",function(e){var a=e.target&&e.target.getAttribute&&e.target.getAttribute("data-a");if(!a)return;
  if(a==="more"){var mo=pg.querySelector(".chr__more");mo.hidden=!mo.hidden;e.target.textContent=mo.hidden?"Читать дальше":"Свернуть"}
  else if(a==="book"){fxEnd();open("graf")}else fxEnd()})}
window.__sevGrafDone=function(){setTimeout(grafDone,300)};
window.__sevFound=function(id,src,final){setTimeout(function(){found(id,src,final)},350)};
window.__sevChronOpen=open;
function init(){document.body.appendChild(box);document.body.appendChild(btn);document.body.appendChild(fx);btn.addEventListener("click",function(){open()});box.querySelector("#chrX").onclick=close;box.querySelector("#chrOk").onclick=close;box.addEventListener("pointerdown",function(e){if(e.target===box)close()});
 window.addEventListener("keydown",function(e){if(e.key==="Escape"){if(!fx.hidden){if(!fxLock)fxEnd()}else if(!box.hidden)close()}});sync();setInterval(sync,1000)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
