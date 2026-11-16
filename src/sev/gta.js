/* =====================================================================
   Севастополис — свободная посадка в транспорт «как в GTA» (v183)
   • Весь транспорт бесплатный: самокат, машинки, танк, вертолёт, лодка,
     яхта сразу доступны в боковой панели — покупать не нужно.
   • Машины, которые ездят по городу: подошёл — кнопка «Сесть в машину»,
     лисёнок садится за руль и едет. Вышел — машина остаётся стоять там,
     где ты её оставил (в неё можно сесть снова). Когда уедешь далеко,
     она вернётся в поток.
   ===================================================================== */
(function () {
  'use strict';
  var VEH = ['scooter', 'kidcar', 'car', 'tank', 'heli', 'boat', 'yacht'];
  var cur = null, btn = null, parked = [];
  function G() { return window.__sevGame; }
  function F() { return window.__sevVehicleStore; }

  function freeAll() {
    var f = F(); if (!f || !f.owned) return;
    var add = false; VEH.forEach(function (id) { if (!f.owned.has(id) && f.item(id)) { f.owned.add(id); add = true; } });
    if (add) { try { f._save(); f._emit(); } catch (e) { } }
  }

  function ui() {
    if (btn) return btn;
    btn = document.createElement('button'); btn.id = 'sevGtaBtn'; btn.type = 'button'; btn.hidden = true;
    var st = document.createElement('style');
    st.textContent = '#sevGtaBtn{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(178px + env(safe-area-inset-bottom,0px));z-index:56;font:900 17px Nunito,Arial,sans-serif;color:#fff;padding:11px 22px;' +
      'background:linear-gradient(180deg,#7fd6ff,#1f86e6 60%,#0d5bb8);border:3px solid #fff;border-radius:999px;box-shadow:0 0 0 2px #0b4fa8,0 6px 16px rgba(0,0,0,.35),inset 0 2px 2px rgba(255,255,255,.7);text-shadow:0 1px 2px rgba(0,30,80,.6)}' +
      '#sevGtaBtn[hidden]{display:none}body:not([data-mode="scene"]) #sevGtaBtn{display:none!important}';
    document.head.appendChild(st); document.body.appendChild(btn);
    btn.addEventListener('click', function () { if (btn._car) board(btn._car); });
    return btn;
  }
  function toast(h) { var t = document.getElementById('sevToast'); if (t) { t.innerHTML = h; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2400); } }

  function board(c) {
    var g = G(), f = F(); if (!g || !f || f.riding) return;
    var P = g.player, kind = c.ty === 'bus' ? 'car' : 'car';
    f.selectVehicle(kind);
    // сначала проверка «болит живот» внутри toggleRide (loot.js)
    P.position.x = c.x; P.position.z = c.z;
    var ok = f.toggleRide(); if (!ok && !f.riding) return;
    try { g._syncRideBtn && g._syncRideBtn(); } catch (e) { }
    c.stolen = true; c.m.setEnabled(false); c.v = 0;
    var hx = c.hx, hz = c.hz; c.x = 1e6; c.z = 1e6; // не мешает потоку, пока мы едем
    try { P.heading = Math.atan2(hx, hz); } catch (e) { }
    cur = c; parked = parked.filter(function (q) { return q !== c; });
    toast('🚗 Лисёнок сел за руль!<br><small>Выйти — кнопка транспорта</small>');
  }
  function leave() {
    var g = G(), c = cur; cur = null; if (!c || !g) return;
    var P = g.player, h = P.heading || 0, side = 2.6;
    // машина остаётся там, где вышли (чуть сбоку от лисёнка)
    c.x = P.position.x + Math.cos(h) * side; c.z = P.position.z - Math.sin(h) * side; c.hx = Math.sin(h); c.hz = Math.cos(h);
    c.m.position.set(c.x, c.m.position.y > 5 || c.m.position.y < -1 ? 0 : c.m.position.y, c.z);
    c.m.rotation.y = h; if (c.m.rotationQuaternion) c.m.rotationQuaternion = null;
    c.m.setEnabled(true); c.v = 0; parked.push(c);
  }

  var wasRiding = false, acc = 0;
  setInterval(function () {
    var g = G(), f = F(); if (!g || !g.player || !f) return;
    freeAll(); ui();
    if (wasRiding && !f.riding && cur) leave();
    wasRiding = f.riding;
    var P = g.player.position, cars = window.__sevCoastCars || [];
    // вернуть в поток давно оставленные машины
    parked = parked.filter(function (c) { if (Math.hypot(c.x - P.x, c.z - P.z) > 220) { c.stolen = false; return false; } return true; });
    if (f.riding || document.body.dataset.mode !== 'scene') { btn.hidden = true; btn._car = null; return; }
    var best = null, bd = 4.6;
    cars.forEach(function (c) { if (!c.m || !c.m.isEnabled()) return; var d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd && Math.abs(P.y) < 3) { bd = d; best = c; } });
    if (best) { btn._car = best; btn.textContent = best.ty === 'bus' ? '🚌 Сесть в автобус' : best.ty === 'police' ? '🚓 Сесть в машину' : '🚗 Сесть в машину'; btn.hidden = false; }
    else { btn.hidden = true; btn._car = null; }
  }, 250);
  window.__sevGta = { board: board, get current() { return cur; }, get parked() { return parked; } };
})();
