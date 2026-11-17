/* Севастополис — рыбалка: FishingEvents (v185) */
(function () {
  'use strict';
  var F = window.SevFish = window.SevFish || {}, DB = F.DB;
  var C = F.Collection;

  /* ================= FishingEvents: случайные сюрпризы ================= */
  F.Events = {
    // до вываживания: что произойдёт по ходу
    plan: function (catchObj) {
      var sp = catchObj.sp, ev = {};
      if (sp.big || (sp.k === 'fish' && catchObj.w > 3) || Math.random() < .03) ev.pull = true; // тянет лисёнка к воде
      if (Math.random() < .03) ev.snapAt = .3 + Math.random() * .5;                               // внезапный обрыв
      if (sp.k === 'fish' && sp.r !== 'legend' && Math.random() < .07) ev.gull = true;              // чайка
      return ev;
    },
    bottle: function () { // что в бутылке
      var r = Math.random();
      if (r < .4) return { kind: 'map' };
      var notes = ['«Кто найдёт — тот молодец! Твой друг Михалыч»', '«Спасите! Я застрял на необитаемом пляже… шучу, тут кафе «Три пальмы»»',
        '«Сокровище — это друзья, которых ты встретил по пути»', '«Хочешь золотую рыбку? Ищи её в бухтах»', '«Чайки воруют рыбу — не зевай!»'];
      return { kind: 'note', text: notes[(Math.random() * notes.length) | 0], coins: 3 };
    },
    newMap: function () {
      var s = C.s, free = DB.secrets.filter(function (p) { return !s.maps.some(function (m) { return m.x === p.x && m.z === p.z && !m.found; }); });
      var p = free[(Math.random() * free.length) | 0]; if (!p) return null;
      var m = { x: p.x, z: p.z, n: p.n, found: false }; s.maps.push(m); C.save(); return m;
    }
  };
})();
