
(function(){
 'use strict';
 var passenger=null, owner=null, kind=null, lastGame=null;
 function detach(){
  if(!passenger)return;
  var n=passenger;
  try{
   n.ex=n.ex||{};n.ex.vehiclePassenger=false;n.ex.lassoHold=false;n.ex.lassoFlight=null;
   n.speed=0;n.mode='idle';n.timer=1.2;
   if(n.collider){n.collider.checkCollisions=!!n.vis;n.collider.position.set(n.x,n.y,n.z)}
   if(n.rig&&n.rig.root){n.rig.root.position.set(n.x,n.y,n.z);n.rig.root.rotation.y=n.heading||0}
  }catch(e){}
  passenger=null;owner=null;kind=null;
 }
 function findHeld(){
  try{
   var a=window.SevNPC&&window.SevNPC.getAll?window.SevNPC.getAll():[];
   for(var i=0;i<a.length;i++){var n=a[i];if(n&&n.vis&&n.ex&&n.ex.lassoHold&&n.rig&&n.rig.root&&n.collider)return n;}
  }catch(e){}
  return null;
 }
 function sync(){
  try{
   var game=window.__sevGame, pl=game&&game.player, store=window.__sevVehicleStore;
   if(game!==lastGame){detach();lastGame=game}
   var riding=!!(pl&&pl.riding&&pl.collider&&pl.scooter&&pl.scooter.root);
   if(passenger&&(!riding||owner!==pl)){detach()}
   if(riding&&!passenger){
    var n=findHeld();
    if(n){passenger=n;owner=pl;kind=store&&store.currentVehicle?store.currentVehicle():pl.vehKind||'scooter';n.ex.vehiclePassenger=true;n.ex.lassoHold=true;n.ex.lassoFlight=null;n.speed=0;n.mode='idle';n.collider.checkCollisions=false;}
   }
   if(passenger&&riding){
    var n=passenger, h=pl.heading||0, type=store&&store.currentVehicle?store.currentVehicle():kind;
    var side,back;
    if(type==='scooter'){side=0;back=-0.88;}
    else if(type==='boat'||type==='yacht'){side=1.05;back=0.02;}
    else if(type==='kidcar'){side=0.72;back=0.02;}
    else {side=0.88;back=0.02;}
    var c=Math.cos(h), sn=Math.sin(h), px=pl.collider.position.x, pz=pl.collider.position.z;
    var x=px+c*side+sn*back, z=pz-sn*side+c*back;
    var y=pl.collider.position.y;
    n.x=x;n.y=y;n.z=z;n.heading=h;n.speed=0;n.mode='idle';
    n.collider.position.set(x,y,z);n.rig.root.position.set(x,y,z);n.rig.root.rotation.y=h;
   }
  }catch(e){if(!window.__sevPassengerErr)window.__sevPassengerErr=e.stack||String(e)}
  requestAnimationFrame(sync);
 }
 window.addEventListener('pagehide',detach);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){requestAnimationFrame(sync)});else requestAnimationFrame(sync);
})();
