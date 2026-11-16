(function(){
var K={danceFun:'dance',danceDisco:'dance',danceCute:'dance',spin:'dance',danceJump:'dance',danceArms:'dance',danceWin:'dance',wave:'wave',hello:'hello',bye:'bye',point:'point',direction:'path',clap:'clap',cheer:'cheer',thumb:'cool',shrug:'shrug',cheerup:'encourage',joy:'cheer',laugh:'cheer',delight:'cheer'};
function hear(kind){try{var pl=window.__sevGame&&window.__sevGame.player;if(pl&&window.SevNPC&&window.SevNPC.hear)window.SevNPC.hear(pl.position.x,pl.position.z,kind)}catch(e){}}
var tries=0,tm=setInterval(function(){if(++tries>200){clearInterval(tm);return}var A=window.SevAnim;if(!A||!A.emote||A.__npcHook)return;clearInterval(tm);A.__npcHook=1;
var orig=A.emote,rep=null;
A.emote=function(name,pl){var ok=orig.apply(this,arguments);if(ok&&K[name]){var kind=K[name];setTimeout(function(){hear(kind)},500);clearInterval(rep);if(kind==='dance'){rep=setInterval(function(){if(A.active&&A.active())hear('dance');else clearInterval(rep)},3500)}}return ok};
},300)})();
