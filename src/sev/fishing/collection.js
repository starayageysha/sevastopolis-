/* Севастополис — рыбалка: FishingCollection (v185) */
(function () {
  'use strict';
  var F = window.SevFish = window.SevFish || {}, DB = F.DB;

  /* ================= FishingCollection: альбом, прогресс, сохранение ================= */
  var KEY = 'sevfish';
  function fresh() { return { v: 1, catches: {}, total: 0, ach: {}, rods: ['basic'], lines: ['basic'], bobbers: ['red'], baits: { worm: 3, shrimp: 1 },
    eq: { rod: 'basic', line: 'basic', bobber: 'red', bait: 'bread' }, maps: [], rival: null, earned: 0, junk: {} }; }
  var C = F.Collection = {
    s: fresh(),
    load: function () { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.v === 1) { var d = fresh(); for (var k in d) if (o[k] === undefined) o[k] = d[k]; C.s = o; } } catch (e) { } return C.s; },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(C.s)); } catch (e) { } },
    // записать улов; вернуть, что нового
    add: function (item) {
      var s = C.s, sp = DB.byId[item.id], e = s.catches[item.id], res = { newSpecies: !e, recordW: false, recordL: false, ach: [] };
      if (!e) e = s.catches[item.id] = { n: 0, maxW: 0, maxL: 0, place: '', date: '' };
      e.n++; s.total++;
      if (item.w > e.maxW) { res.recordW = e.n > 1; e.maxW = item.w; e.place = item.place; e.date = item.date; }
      if (item.l > e.maxL) { res.recordL = e.n > 1; e.maxL = item.l; }
      if (sp.k === 'junk') s.junk[item.id] = 1;
      res.ach = C.checkAch(item, sp);
      C.save(); return res;
    },
    unlock: function (id) { var s = C.s; if (s.ach[id]) return false; s.ach[id] = new Date().toISOString().slice(0, 10); // награды за достижения
      DB.rods.forEach(function (r) { if (r.unlock === id && s.rods.indexOf(r.id) < 0) s.rods.push(r.id); });
      DB.bobbers.forEach(function (b) { if (b.unlock === id && s.bobbers.indexOf(b.id) < 0) s.bobbers.push(b.id); });
      if (id === 'c30') s.baits.lure = 1; // блесна — многоразовая
      C.save(); return true; },
    checkAch: function (item, sp) {
      var s = C.s, got = [];
      function u(id) { if (C.unlock(id)) got.push(id); }
      u('first'); if (s.total >= 5) u('c5'); if (s.total >= 10) u('c10'); if (s.total >= 30) u('c30');
      if (['bychok', 'kefal', 'stavrida', 'kambala', 'barabulka'].every(function (id) { return s.catches[id]; })) u('allc');
      if (sp.k === 'fish' && item.w >= 5) u('big'); if (sp.gold) u('gold'); if (sp.chest) u('chest');
      if (Object.keys(s.junk).length >= 3) u('junk3'); if (item.rain && sp.k === 'fish') u('rain'); if (item.night && sp.k === 'fish') u('night');
      if (DB.species.every(function (x) { return s.catches[x.id]; })) u('album');
      return got;
    },
    // соревнование дня с Михалычем: 3 вида и его рекорды (одинаковы весь день)
    rival: function () {
      var day = new Date().toISOString().slice(0, 10), s = C.s;
      if (!s.rival || s.rival.day !== day) {
        var seed = 0; for (var i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) >>> 0;
        var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        var pool = ['bychok', 'kefal', 'stavrida', 'kambala', 'barabulka', 'krab', 'gubanr'], t = [];
        while (t.length < 3) { var id = pool[(rnd() * pool.length) | 0]; if (t.some(function (q) { return q.id === id; })) continue; var sp = DB.byId[id]; t.push({ id: id, w: +(sp.w[0] + (sp.w[1] - sp.w[0]) * (.45 + rnd() * .35)).toFixed(2), beat: false }); }
        s.rival = { day: day, t: t, done: false }; C.save();
      }
      return s.rival;
    },
    rivalCheck: function (item) {
      var r = C.rival(), hit = null;
      r.t.forEach(function (q) { if (!q.beat && q.id === item.id && item.w > q.w) { q.beat = true; hit = q; } });
      var won = false; if (!r.done && r.t.every(function (q) { return q.beat; })) { r.done = true; won = true; C.unlock('rival'); }
      C.save(); return { hit: hit, won: won };
    }
  };
  C.load();
})();
