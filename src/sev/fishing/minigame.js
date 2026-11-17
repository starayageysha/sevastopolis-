/* Севастополис — рыбалка: FishingMinigame (v185) */
(function () {
  'use strict';
  var F = window.SevFish = window.SevFish || {}, DB = F.DB;
  var C = F.Collection;

  /* ================= FishingMinigame: вываживание ================= */
  F.Minigame = function (catchObj, gear, ev) {
    var sp = catchObj.sp, wk = Math.min(1.6, .5 + Math.sqrt(catchObj.w) * .45);
    this.S0 = Math.max(.25, sp.p * wk); this.S = this.S0;
    this.dist = 100; this.tension = 15; this.over = 0; this.t = 0;
    this.burst = 0; this.next = 1 + Math.random() * 1.5; this.pull = .3;
    this.reel = gear.reel; this.str = gear.str * gear.tough; this.ev = ev || {}; this.state = 'fight';
  };
  F.Minigame.prototype.update = function (dt, reeling) {
    if (this.state !== 'fight') return this.state;
    this.t += dt;
    // рыба то спокойна, то рвётся
    this.next -= dt;
    if (this.burst > 0) { this.burst -= dt; if (this.burst <= 0) this.next = .8 + Math.random() * 2.2; }
    else if (this.next <= 0) this.burst = .5 + Math.random() * 1.1 * this.S;
    var target = this.burst > 0 ? (.9 + Math.random() * .5) * this.S : .25 * this.S;
    this.pull += (target - this.pull) * Math.min(1, dt * 6);
    if (reeling) {
      this.dist -= this.reel * 15 * dt * (1 - Math.min(.75, this.pull * .55));
      this.tension += (this.pull * 85 + 6 - this.tension * .22) * dt;
    } else {
      this.tension -= (40 + this.tension * .3) * dt;
      this.dist += this.pull * 10 * dt;
    }
    this.tension = Math.max(0, this.tension);
    this.S = Math.max(this.S0 * .4, this.S - this.S0 * .03 * dt * (reeling ? 1.4 : .6)); // рыба устаёт
    if (this.tension > this.str) { this.over += dt; if (this.over > .35) return (this.state = 'snap'); } else this.over = Math.max(0, this.over - dt);
    if (this.ev.snapAt && this.dist < 100 * (1 - this.ev.snapAt) && this.burst > 0) return (this.state = 'snap');
    if (this.dist >= 135) return (this.state = 'escape');
    if (this.dist <= 0) return (this.state = 'won');
    return this.state;
  };
  // «зелёная зона» натяжения для подсказки: в ней тянуть безопасно
  F.Minigame.prototype.zone = function () { return [Math.min(35, this.str * .25), this.str * .78]; };
})();
