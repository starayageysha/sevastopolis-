/* Севастополис — рыбалка: FishingLoot (v185) */
(function () {
  'use strict';
  var F = window.SevFish = window.SevFish || {}, DB = F.DB;
  var C = F.Collection;

  /* ================= FishingLoot: что клюнуло ================= */
  F.Loot = {
    roll: function (zone, bait, ctx) {
      var B = DB.baits[bait] || DB.baits.bread, rod = DB.rods.filter(function (r) { return r.id === C.s.eq.rod; })[0] || DB.rods[0];
      var luck = (B.luck || 1) * (rod.luck || 1), list = [], tot = 0;
      DB.species.forEach(function (sp) {
        var w = (sp.zones[zone] || 0) * (sp.bait[bait] || 1);
        if (sp.r !== 'common') w *= luck;
        if (ctx.night && sp.k === 'fish') w *= sp.id === 'kambala' || sp.id === 'lobang' ? 1.6 : .9;
        if (ctx.rain && sp.k === 'fish') w *= 1.2;
        if (sp.map && C.s.maps.some(function (m) { return !m.found; })) w *= .2; // одна неразгаданная карта — новые реже
        if (w > 0) { list.push([w, sp]); tot += w; }
      });
      var r = Math.random() * tot, sp = list[list.length - 1][1];
      for (var i = 0; i < list.length; i++) { r -= list[i][0]; if (r <= 0) { sp = list[i][1]; break; } }
      var t = Math.pow(Math.random(), 1.7); // крупные реже
      var w = +(sp.w[0] + (sp.w[1] - sp.w[0]) * t).toFixed(2), l = Math.round(sp.l[0] + (sp.l[1] - sp.l[0]) * Math.pow(t, .8));
      return { id: sp.id, sp: sp, w: w, l: l };
    }
  };
})();
