/* =====================================================================
   Севастополис — посадка в водный транспорт (v186)
   Раньше лодка/яхта искала «воду» по старой схеме из трёх прямоугольников
   и часто ставила лисёнка на сушу, где плыть нельзя. Теперь место
   ищется по настоящей береговой карте (SevWater.findWater): ближайшая к
   игроку вода, где лодке хватает места (лодки стали вдвое больше).
   Если воды рядом нет — посадка отменяется с подсказкой, на суше
   лисёнок не застревает.
   ===================================================================== */
(function () {
  'use strict';
  var CLEAR = { boat: 7, yacht: 9 };
  function toast(h) { var t = document.getElementById('sevToast'); if (t) { t.innerHTML = h; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2600); } }
  function place(g, type, x, z) {
    var pl = g.player, P = pl.collider.position, wy = window.__sevWave ? window.__sevWave.y : -1, dx = x - P.x, dz = z - P.z;
    pl.setRiding(!1, type);
    pl.collider.position.set(x, wy + .05, z); pl.collider.computeWorldMatrix(!0);
    pl.velocity && pl.velocity.set(0, 0, 0); pl.speed = 0; pl._vy = 0; pl._jumping = !1; pl._swimming = !1; pl._swimFx = 0;
    if (g.followCam) { var fc = g.followCam, c = fc.cam; fc.target.position.set(x, wy + 2.2, z); if (fc._sv) { fc._sv.pp = null; fc._sv.spd = 0; } if (Math.hypot(dx, dz) > 1) c.alpha = Math.atan2(-dz, -dx); }
    // лодка носом от берега
    var sh = window.SevWater.shoreAt(x, z); pl.heading = Math.atan2(dx, dz);
    return true;
  }
  function mine(type) {
    if (type !== 'boat' && type !== 'yacht') return false;
    var g = window.__sevGame, W = window.SevWater, F = window.__sevVehicleStore;
    if (!g || !g.player || !W || !W.findWater || !W.state) return orig ? orig(type) : false; // другие локации — прежний способ
    var P = g.player.collider.position, w = null;
    try { w = W.findWater(P.x, P.z, CLEAR[type], 2400); } catch (e) { console.warn('[boats]', e); }
    if (!w) { // воды нет — не оставляем лисёнка «в лодке на суше»
      if (F) { F.riding = false; try { F._emit(); } catch (e) { } try { g._syncRideBtn && g._syncRideBtn(); } catch (e) { } }
      toast('🌊 Рядом нет воды<br><small>Подойди ближе к морю и попробуй снова</small>'); return false;
    }
    last = null; place(g, type, w.x, w.z);
    var d = Math.round(Math.hypot(w.x - P.x, w.z - P.z));
    if (d > 15) toast((type === 'yacht' ? '⛵' : '🛥️') + ' Лисёнок у ближайшей воды — ' + d + ' м отсюда');
    return true;
  }
  /* Удержание на воде. Раньше ядро держало лодку в прямоугольнике
     x −520…−138, z −70…850 — часть его приходилась на сушу, а у парка
     и в бухтах плавать было нельзя. Теперь граница — настоящая
     береговая линия: лодка не заходит на сушу и мелководье ближе
     полкорпуса к берегу, а в любом месте моря плывёт свободно. */
  var HULL = { boat: 2.4, yacht: 3.4 }, last = null;
  function clamp(c, p, type) {
    var W = window.SevWater, g = window.__sevGame; if (!W || !W.state || !W.state.mask || !g || !g.def || g.def.id !== 'pobedy') return false;
    var x = c.position.x, z = c.position.z, s = W.shoreAt(x, z);
    if (!s) { last = { x: x, z: z }; return true; }              // за краем карты берега — открытое море
    if (s.water && s.toLand >= HULL[type]) { last = { x: x, z: z }; return true; }
    if (last && Math.hypot(last.x - x, last.z - z) < 12) {       // упёрлись в берег — стоп
      c.position.x = last.x; c.position.z = last.z; p.speed = 0; if (p.velocity) { p.velocity.x = 0; p.velocity.z = 0; }
    } else last = { x: x, z: z };                                // телепорт/посадка — не мешаем
    return true;
  }
  window.__sevBoatClamp = clamp;
  var orig = null;
  setInterval(function () {
    if (window.__sevWaterSpawn && window.__sevWaterSpawn !== mine) { orig = window.__sevWaterSpawn; window.__sevWaterSpawn = mine; }
  }, 500);
  window.__sevBoats = { spawn: mine };
})();
