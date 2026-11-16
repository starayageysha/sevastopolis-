
(function(){
 'use strict';
 function clean(){
  try{
   var g=window.__sevGame, scene=g&&g.scene;
   if(!scene||!scene.meshes)return;
   scene.meshes.forEach(function(m){
    if(!m||!m.checkCollisions)return;
    // These four invisible world-edge barriers can trap boats beyond the quay.
    if(/^(wallW|wallE|wallN|wallS|bound-south|bound-north|bound-west|bound-east)$/.test(m.name))m.checkCollisions=false;
    // The hidden stair ramp intersects the boat's low hull at the waterline.
    if(m.name==='graf-stair-ramp')m.checkCollisions=false;
   });
  }catch(e){}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(clean,0);});
 else setTimeout(clean,0);
 var tries=0;function retry(){clean();if(++tries<120)requestAnimationFrame(retry)}requestAnimationFrame(retry);
})();
