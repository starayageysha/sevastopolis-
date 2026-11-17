/* =====================================================================
   Севастополис — жители-рыбаки на волнорезах (v186)
   • Парк Победы: по двое на трёх волнорезах в конце набережной
     (западный, и два восточных; на центральном пирсе — Михалыч).
   • Бухта Омега и набережная Челнокова: строятся бетонные волнорезы
     (по настоящей береговой линии, коллизия как у пирсов) и на каждом —
     по 5 рыбаков.
   Рыбаки сидят на краю с удочками, поплавок качается на волнах,
   иногда клюёт — рыбак подсекает, рыбка летит в ведро рядом (в ведре
   видно улов). Соседи переговариваются (облачка с фразами). С каждым
   можно поговорить. Логика в def.post (хук в 13-npc-system.js).
   ===================================================================== */
(function () {
  'use strict';
  var NAMES = ['Василий', 'Пётр Семёныч', 'Гена', 'Толик', 'Борисыч', 'Аркадий', 'Лёха', 'Николай', 'Степан', 'Фёдор', 'Иваныч', 'Миша', 'Серёга', 'Палыч', 'Тимофей', 'Жора'];
  var BUILD = ['raccoon', 'turtle', 'rabbit', 'ducky', 'robot', 'mushroom', 'gull', 'octo'];
  var CHAT = [
    ['Клюёт сегодня?', 'Да так… бычок за бычком'], ['Ветер с моря — к хорошему клёву', 'Ага, кефаль подошла'],
    ['Видал, какую ставриду Палыч вытащил?', 'Небось сам купил на рынке!'], ['Тише, рыбу распугаешь', 'Молчу-молчу…'],
    ['Говорят, тут золотая рыбка водится', 'Мне бы хоть одну обычную!'], ['Опять чайка ведро караулит', 'Кыш, пернатая!'],
    ['Наживку на что ставишь?', 'На хлебушек, по-старинке'], ['Эх, красота какая, море!', 'Севастополь — одно слово'],
    ['Внук просил краба поймать', 'Краба — это к камням надо']];
  var TALK = ['Рыба любит тишину и терпение. Садись рядом, если хочешь.', 'Утром кефаль лучше клюёт, а под вечер — ставрида.',
    'Видишь поплавок? Как утонет — подсекай! А вот если только качнулся — жди.', 'Я тут сорок лет рыбачу. Море — оно всё помнит.',
    'Говорят, в бухтах можно и золотую рыбку поймать. Я вот пока не поймал.', 'Чайки — хитрющие! Только отвернёшься — и улова нет.',
    'Попробуй сама порыбачить: подойди к воде, кнопка «Рыбачить» появится.'];
  var GROUPS = []; // {id, pts:[{x,z,h}], made}
  // Парк Победы: края концевых площадок волнорезов (смотрим на север, в море)
  GROUPS.push({ id: 'pw1', pts: [{ x: -53.6, z: 913.1, h: 0 }, { x: -49.6, z: 913.1, h: 0 }] });
  GROUPS.push({ id: 'pe1', pts: [{ x: 56.6, z: 923.1, h: 0 }, { x: 60.6, z: 923.1, h: 0 }] });
  GROUPS.push({ id: 'pe2', pts: [{ x: 98.6, z: 903.1, h: 0 }, { x: 102.6, z: 903.1, h: 0 }] });
  // строим волнорезы и 5 рыбаков: якоря на набережных (точка берега ищется по карте)
  var BUILT = [{ id: 'omega', n: 'Бухта Омега', ax: -694, az: -321 }, { id: 'chel', n: 'Набережная Челнокова', ax: -566, az: -176 }];

  function J() { return window.__sevBJS; }
  var mats = {};
  function mat(sc, hex, em) { var k = hex + (em || ''); if (mats[k] && mats[k].getScene() === sc) return mats[k]; var Jb = J(), m = new Jb.Mat('fm-' + k, sc); m.diffuseColor = Jb.C3.FromHexString(hex); m.specularColor = new Jb.C3(.15, .15, .15); m.emissiveColor = Jb.C3.FromHexString(hex).scale(em == null ? .12 : em); return (mats[k] = m); }

  /* ---------- волнорез по береговой линии ---------- */
  function buildBreakwater(g, B) {
    var W = window.SevWater, M = W.computeMask(B.ax, B.az, 192, 256); if (!M) return null;
    var N = M.N, C = M.cell, best = null, bd = 1e18;
    for (var j = 1; j < N - 1; j++) for (var i = 1; i < N - 1; i++) { var c = j * N + i; if (M.land[c] || M.dW[c] * C > 1.2) continue; // вода у самой кромки
      var x = M.x0 + (i + .5) * C, z = M.z0 + (j + .5) * C, d = (x - B.ax) * (x - B.ax) + (z - B.az) * (z - B.az); if (d < bd) { bd = d; best = [i, j, x, z]; } }
    if (!best) return null;
    // направление в море — туда, где расстояние до суши растёт
    var i0 = best[0], j0 = best[1], gx = 0, gz = 0;
    for (var dj = -6; dj <= 6; dj++) for (var di = -6; di <= 6; di++) { var ii = i0 + di, jj = j0 + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; var cc = jj * N + ii, v = M.land[cc] ? -1 : M.dW[cc] * C; gx += di * v; gz += dj * v; }
    var L = Math.hypot(gx, gz) || 1; gx /= L; gz /= L;
    var sx = best[2] - gx * 3, sz = best[3] - gz * 3, len = 24, hd = Math.atan2(gx, gz), Jb = J(), sc = g.scene, cm = mat(sc, '#c4c4bb', .1), dark = mat(sc, '#8f8f88', .05);
    var root = Jb.MB.CreateBox('sev-breakwater-' + B.id + '-root', { size: .01 }, sc); root.isVisible = false;
    function slab(nm, w, h, d, ox, oy, oz, m) { var b = Jb.MB.CreateBox('sev-breakwater-' + B.id + '-' + nm, { width: w, height: h, depth: d }, sc); b.parent = root; b.position.set(ox, oy, oz); b.material = m; b.checkCollisions = true; b.receiveShadows = true; return b; }
    root.position.set(sx, 0, sz); root.rotation.y = hd;
    slab('walk', 4.2, 3.6, len, 0, -1.4, len / 2, cm);
    slab('end', 7.5, 3.6, 7.5, 0, -1.4, len + 2.6, cm);
    slab('curbL', .3, .25, len, -2.0, .5, len / 2, dark); slab('curbR', .3, .25, len, 2.0, .5, len / 2, dark);
    // камни-тетраподы у основания (без коллизии: они в воде)
    for (var k = 0; k < 10; k++) { var s = Jb.MB.CreateSphere('sev-breakwater-' + B.id + '-rock' + k, { diameter: 1.3, segments: 5 }, sc); s.parent = root; var side = k % 2 ? 1 : -1; s.position.set(side * (2.6 + Math.random() * .5), -.7, 3 + k * 2.6); s.scaling.set(1, .7, 1.2); s.rotation.y = k; s.material = dark; }
    root.getChildMeshes().forEach(function (m) { m.computeWorldMatrix(true); m.freezeWorldMatrix(); });
    if (W.state) W.state.dirty = true; // пена и мелководье вокруг нового волнореза
    // точки рыбаков: по краю конца и вдоль бортов
    var fx = Math.sin(hd), fz = Math.cos(hd), rx = Math.cos(hd), rz = -Math.sin(hd), tipZ = len + 6.1, pts = [];
    function P(along, side, face) { return { x: sx + fx * along + rx * side, z: sz + fz * along + rz * side, h: face }; }
    pts.push(P(tipZ, -2.2, hd), P(tipZ, 0, hd), P(tipZ, 2.2, hd), P(len - 4, 1.85, hd + Math.PI / 2), P(len - 10, -1.85, hd - Math.PI / 2));
    return { root: root, pts: pts };
  }

  /* ---------- облачко с фразой ---------- */
  function bubble(sc, n, text) {
    var Jb = J();
    if (!n._bub || n._bub.p.isDisposed()) {
      var t = new Jb.DT('fm-bub', { width: 512, height: 128 }, sc, false); t.hasAlpha = true;
      var m = new Jb.Mat('fm-bubm', sc); m.diffuseTexture = t; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new Jb.C3(1, 1, 1); m.disableLighting = true; m.backFaceCulling = false;
      var p = Jb.MB.CreatePlane('fm-bubble', { width: 3.8, height: .95 }, sc); p.material = m; p.billboardMode = 7; p.isPickable = false;
      n._bub = { p: p, t: t, m: m };
    }
    var g = n._bub.t.getContext(); g.clearRect(0, 0, 512, 128);
    g.fillStyle = 'rgba(255,255,255,.94)'; g.strokeStyle = '#1f86e6'; g.lineWidth = 6;
    var r = 40; g.beginPath(); g.moveTo(r, 8); g.arcTo(504, 8, 504, 112, r); g.arcTo(504, 112, 8, 112, r); g.arcTo(8, 112, 8, 8, r); g.arcTo(8, 8, 504, 8, r); g.fill(); g.stroke();
    g.fillStyle = '#0d3566'; var fs = 38; g.font = '800 ' + fs + 'px Nunito,Arial'; while (g.measureText(text).width > 470 && fs > 20) { fs -= 2; g.font = '800 ' + fs + 'px Nunito,Arial'; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 62); n._bub.t.update(true);
    n._bub.p.setEnabled(true); n._bubT = 3.6;
  }

  // реквизит (удочка, леска, поплавок, ведро, рыбки, облачко) живёт отдельно от модели жителя:
  // когда менеджер выгружает дальнего жителя, реквизит тоже убираем (а улов помним)
  var FS = {};
  function dropProps(f) { ['rod', 'bob', 'bucket', 'line'].forEach(function (k) { if (f[k] && !f[k].isDisposed()) f[k].dispose(); f[k] = null; }); (f.fish || []).forEach(function (m) { m.dispose(); }); f.fish = []; if (f.fly) { f.fly.m.dispose(); f.fly = null; } if (f.npc && f.npc._bub) { f.npc._bub.p.dispose(); f.npc._bub.t.dispose(); f.npc._bub.m.dispose(); f.npc._bub = null; } }
  function sweep() { var M = window.SevNPC && window.SevNPC.manager; if (!M) return; Object.keys(FS).forEach(function (id) { var f = FS[id], n = f.npc; if (!n || M.list.indexOf(n) < 0 || !n.rig || !n.rig.root || n.rig.root.isDisposed()) { if (f.rod) dropProps(f); } }); }

  /* ---------- поза и рыбалка (def.post) ---------- */
  function post(n, dt) {
    var g = window.__sevGame, sc = g && g.scene; if (!sc) return;
    var r = n.rig, N = r.nodes || {}, h = n.def.height || 2.2, f = n._fs || (n._fs = FS[n.id] && FS[n.id].npc === n ? FS[n.id] : { t: Math.random() * 20, next: 12 + Math.random() * 30, catches: (FS[n.id] && FS[n.id].catches) || 0, jerk: 0 });
    if (FS[n.id] !== f) { if (FS[n.id]) dropProps(FS[n.id]); FS[n.id] = f; } f.npc = n;
    n._seated = true;
    // сидит: ниже на пол-роста ног, ноги вперёд (свешены с края), руки держат удочку
    r.root.position.y = n.y - h * .2;
    if (N.legA) N.legA.rotation.x = -1.35; if (N.legB) N.legB.rotation.x = -1.35;
    if (!n.talking) { if (N.armA) { N.armA.rotation.x = -1.05 - f.jerk * .6; N.armA.rotation.z = .25; } if (N.armB) { N.armB.rotation.x = -1.05 - f.jerk * .6; N.armB.rotation.z = -.25; } }
    var hd = n.heading, fx = Math.sin(hd), fz = Math.cos(hd), rx = Math.cos(hd), rz = -Math.sin(hd), Jb = J();
    // удочка, леска, поплавок, ведро — создаются при первом показе
    if (!f.rod || f.rod.isDisposed()) {
      f.rod = Jb.MB.CreateCylinder('fm-rod', { diameterTop: .015, diameterBottom: .05, height: 2.6, tessellation: 6 }, sc); f.rod.material = mat(sc, '#6b4a2c'); f.rod.isPickable = false;
      f.bob = Jb.MB.CreateSphere('fm-bob', { diameter: .16, segments: 6 }, sc); f.bob.material = mat(sc, '#e32626', .4); f.bob.isPickable = false;
      f.bucket = Jb.MB.CreateCylinder('fm-bucket', { diameterTop: .5, diameterBottom: .38, height: .45, tessellation: 12 }, sc); f.bucket.material = mat(sc, '#2f8fd8', .15); f.bucket.isPickable = false;
      f.fish = []; f.line = null; f.pts = [];
      var V = sc.meshes[0].position.constructor; for (var i = 0; i < 8; i++) f.pts.push(new V(0, 0, 0));
      f.bpos = { x: n.x + fx * 5.2 + rx * (Math.random() - .5), z: n.z + fz * 5.2 + rz * (Math.random() - .5) };
    }
    var vis = n.vis !== false; [f.rod, f.bob, f.bucket].forEach(function (m) { if (m.isEnabled() !== vis) m.setEnabled(vis); }); if (f.line) f.line.setEnabled(vis);
    f.fish.forEach(function (m) { m.setEnabled(vis); });
    if (!vis) return;
    f.t += dt; f.jerk = Math.max(0, f.jerk - dt * 2);
    var by = window.SevWater ? window.SevWater.height(f.bpos.x, f.bpos.z) : -1;
    var hand = { x: n.x + fx * .45, y: r.root.position.y + h * .42, z: n.z + fz * .45 }, pitch = .62 + f.jerk * .7;
    var dx = fx * Math.cos(pitch), dy = Math.sin(pitch), dz = fz * Math.cos(pitch);
    f.rod.position.set(hand.x + dx * 1.2, hand.y + dy * 1.2, hand.z + dz * 1.2); f.rod.rotation.set(Math.acos(dy), Math.atan2(dx, dz), 0);
    var tip = { x: hand.x + dx * 2.5, y: hand.y + dy * 2.5, z: hand.z + dz * 2.5 };
    f.bucket.position.set(n.x + rx * .9 - fx * .2, n.y + .23, n.z + rz * .9 - fz * .2);
    // поклёвка → подсечка → рыбка в ведро
    f.next -= dt; var dip = 0;
    if (f.next < 1.4 && f.next > 0) dip = Math.sin(f.t * 20) * .05 + .08;
    if (f.next <= 0 && !f.fly) {
      f.jerk = 1; f.next = 15 + Math.random() * 45;
      if (Math.random() < .7) { // поймал!
        var fm = Jb.MB.CreateSphere('fm-fish', { diameter: .32, segments: 6 }, sc); fm.scaling.set(.45, .55, 1.2); fm.material = mat(sc, ['#9fb2bf', '#8a6d3b', '#e0705a', '#6c8fa8'][(Math.random() * 4) | 0], .25); fm.isPickable = false;
        f.fly = { m: fm, t: 0, a: { x: f.bpos.x, y: by, z: f.bpos.z } }; if (window.SevWater) window.SevWater.ring(f.bpos.x, f.bpos.z, 1.2);
      } else if (window.SevWater) window.SevWater.ring(f.bpos.x, f.bpos.z, .8);
    }
    if (f.fly) {
      var k = Math.min(1, f.fly.t / 1.1), b = f.bucket.position, a = f.fly.a; f.fly.t += dt;
      f.fly.m.position.set(a.x + (b.x - a.x) * k, a.y + (b.y + .3 - a.y) * k + Math.sin(k * Math.PI) * 2.4, a.z + (b.z - a.z) * k); f.fly.m.rotation.y += dt * 9; f.fly.m.rotation.z = Math.sin(f.t * 30) * .4;
      if (k >= 1) { f.catches++; var m2 = f.fly.m; f.fly = null; if (f.fish.length < 4) { m2.position.set(b.x + (Math.random() - .5) * .18, b.y + .14 + f.fish.length * .05, b.z + (Math.random() - .5) * .18); m2.rotation.set(0, Math.random() * 6, 1.4); m2.scaling.scaleInPlace(.7); f.fish.push(m2); } else m2.dispose(); if (Math.random() < .5) bubble(sc, n, ['Есть!', 'Вот это да!', 'Ещё одна!', 'В ведро её!'][(Math.random() * 4) | 0]); }
    }
    var bob = { x: f.bpos.x, y: by - dip + Math.sin(f.t * 1.7) * .02, z: f.bpos.z }; f.bob.position.set(bob.x, bob.y, bob.z);
    if (f.next > 1.4 && Math.random() < dt * .08 && window.SevWater) window.SevWater.ring(bob.x, bob.z, .35);
    // леска: от вершинки к поплавку с провисанием
    var P = f.pts, tgt = f.fly ? f.fly.m.position : bob;
    for (var q = 0; q < 8; q++) { var t = q / 7; P[q].set(tip.x + (tgt.x - tip.x) * t, tip.y + (tgt.y - tip.y) * t - Math.sin(t * Math.PI) * (f.fly ? 0 : .5), tip.z + (tgt.z - tip.z) * t); }
    if (!f.line || f.line.isDisposed()) { f.line = Jb.MB.CreateLines('fm-line', { points: P, updatable: true }, sc); f.line.color = Jb.C3.FromHexString('#eef4ff'); f.line.isPickable = false; }
    else Jb.MB.CreateLines('fm-line', { points: P, instance: f.line });
    // облачко над головой
    if (n._bub && !n._bub.p.isDisposed()) { n._bub.p.position.set(n.x, r.root.position.y + h * 1.15 + .4, n.z); if (n._bubT > 0) { n._bubT -= dt; if (n._bubT <= 0) n._bub.p.setEnabled(false); } }
  }

  /* ---------- разговоры соседей ---------- */
  var chatT = 6;
  function chatter(dt) {
    var g = window.__sevGame, M = window.SevNPC && window.SevNPC.manager; if (!g || !M) return; chatT -= dt; if (chatT > 0) return; chatT = 7 + Math.random() * 6;
    var P = g.player.position, cand = GROUPS.filter(function (G) { return G.made && G.npcs; }).map(function (G) { var a = G.npcs.map(function (id) { return M.list.filter(function (n) { return n.id === id; })[0]; }).filter(function (n) { return n && n.vis !== false; }); return a; })
      .filter(function (a) { return a.length >= 2 && Math.hypot(a[0].x - P.x, a[0].z - P.z) < 45; });
    if (!cand.length) return;
    var grp = cand[(Math.random() * cand.length) | 0], i = (Math.random() * (grp.length - 1)) | 0, A = grp[i], B = grp[i + 1], line = CHAT[(Math.random() * CHAT.length) | 0];
    bubble(g.scene, A, line[0]); try { A.gesture('shrug'); } catch (e) { }
    setTimeout(function () { if (B.rig) { bubble(g.scene, B, line[1]); try { B.gesture('laugh'); } catch (e) { } } }, 2400);
  }

  /* ---------- регистрация жителей ---------- */
  var made = false, ni = 0, bwScene = null;
  function register(G, sc) {
    var api = window.SevNPC, B = api.builders; G.npcs = [];
    G.pts.forEach(function (p, k) {
      var id = 'fisher-' + G.id + '-' + k, nm = NAMES[ni % NAMES.length], bl = B[BUILD[ni % BUILD.length]] || B.raccoon; ni++;
      try {
        api.register({ id: id, name: nm, title: 'Рыбак', scene: 'pobedy', build: bl, height: 2.2, radius: .45, speed: 0,
          spawn: { x: p.x, z: p.z, heading: p.h }, route: [{ x: p.x, z: p.z, wait: [60, 120], face: p.h }], loop: true, post: post,
          dialog: { start: [{ go: 'hi' }], nodes: { hi: { emote: 'wave', text: TALK[(k + ni) % TALK.length], choices: [{ label: '🐟 Как улов?', next: 'catch' }, { label: 'Удачи!', alt: true }] },
            catch: { text: function (nn) { var c = (FS[id] && FS[id].catches) || 0; return c ? 'Сегодня поймал ' + c + ' ' + (c % 10 === 1 && c % 100 !== 11 ? 'рыбку' : c % 10 >= 2 && c % 10 <= 4 && (c % 100 < 12 || c % 100 > 14) ? 'рыбки' : 'рыбок') + ' — всё в ведре! Сиди тихо, может, и при тебе клюнет.' : 'Пока ни одной… Но я терпеливый. Посиди со мной — увидишь, как клюёт!'; }, choices: [{ label: 'Пока!', alt: true }] } } } });
        G.npcs.push(id);
      } catch (e) { console.warn('[fishermen]', id, e); }
    });
    G.made = true;
  }
  var last = performance.now();
  setInterval(function () {
    var now = performance.now(), dt = Math.min(.5, (now - last) / 1000); last = now;
    var g = window.__sevGame, api = window.SevNPC; if (!g || !g.scene || !g.def || g.def.id !== 'pobedy' || !api || !api.builders || !J()) return;
    if (bwScene !== g.scene) { FS = {}; // волнорезы — заново в каждой новой сцене (жители зарегистрированы один раз)
      if (!window.SevWater || !window.SevWater.state || !window.SevWater.computeMask) return;
      bwScene = g.scene; mats = {};
      BUILT.forEach(function (Bw) { try { var r = buildBreakwater(g, Bw); if (!r) return; var G0 = GROUPS.filter(function (q) { return q.id === Bw.id; })[0]; if (!G0) GROUPS.push({ id: Bw.id, pts: r.pts, root: r.root }); else G0.root = r.root; } catch (e) { console.warn('[fishermen] волнорез', Bw.id, e); } });
      if (!made) { made = true; GROUPS.forEach(function (G) { register(G, g.scene); }); }
      window.__sevFishermen = { groups: GROUPS, state: function () { return FS; } };
    }
    chatter(dt); sweep();
  }, 250);
})();
