import * as S from '../shared/sim.js';
import * as A from './audio.js';

// Client-side mirror of the race: other geese via snapshots, plus all the eye/ear candy for events.
export class World {
  constructor(renderer, net, opts = {}) {
    this.r = renderer;
    this.net = net;
    this.tv = !!opts.tv;
    this.meLane = null;
    this.reset();
  }

  reset() {
    this.phase = 'lobby';
    this.course = null;
    this.theme = 'meadow';
    this.racers = new Array(S.LANES).fill(null);
    this.snaps = [];
    this.hist = [];
    this.removed = [];
    this.extras = [];
    for (let l = 0; l < S.LANES; l++) { this.removed.push({ taken: {}, knocked: {} }); this.extras.push([]); }
    this.leg = new Array(S.LANES).fill(0);
    this.prevX = new Array(S.LANES).fill(0);
    this.honkT = new Array(S.LANES).fill(0);
    this.finPlace = {};
    this.farmerX = null;
    this.farmerLeaving = false;
    this.left = null;
    this.frozen = false;
    this.startAt = 0;
  }

  onRace(m) {
    const same = this.course && this.seed === m.seed;
    if (!same) {
      this.reset();
      this.course = S.makeCourse(m.theme, m.seed, m.len);
      this.seed = m.seed;
    }
    this.phase = 'race';
    this.theme = m.theme;
    this.round = m.round;
    this.totalRounds = m.totalRounds;
    this.double = m.double;
    this.startAt = m.startAt;
    this.racers = m.racers;
  }

  raceT() { return (this.net.now() - this.startAt) / 1000; }

  onSnap(m) {
    this.snaps.push(m);
    if (this.snaps.length > 40) this.snaps.shift();
    this.left = m.left;
    if (m.fm != null) { if (this.farmerX == null) this.farmerX = m.fm - 2; this.farmerTarget = m.fm; }
    else this.farmerTarget = null;
    // Per-goose history keyed by the time the position was *measured* (a phone's own clock for humans),
    // so uneven network delivery doesn't turn into stutter.
    for (let l = 0; l < m.g.length; l++) {
      const row = m.g[l];
      if (!row) continue;
      const ts = row[5] != null ? row[5] : m.t;
      const h = this.hist[l] || (this.hist[l] = []);
      const last = h[h.length - 1];
      if (last && ts <= last.t + 0.001) { last.flags = row[3]; last.cu = row[4]; continue; }
      h.push({ t: ts, x: row[0], z: row[1], vx: row[2], flags: row[3], cu: row[4] });
      if (h.length > 40) h.shift();
    }
  }

  // Smoothly interpolated state for a lane, rendered a little in the past so there's always data on both sides.
  sample(lane, t) {
    const h = this.hist[lane];
    if (!h || !h.length) return null;
    const rt = t - 0.16;
    let i = h.length - 1;
    while (i > 0 && h[i].t > rt) i--;
    const a = h[i], b = h[i + 1];
    let x, z;
    if (rt < a.t) { x = a.x; z = a.z; }
    else if (b) {
      const q = (rt - a.t) / Math.max(0.001, b.t - a.t);
      x = Math.abs(b.x - a.x) > 6 ? (q < 0.5 ? a.x : b.x) : a.x + (b.x - a.x) * q;
      z = a.z + (b.z - a.z) * q;
    } else {
      // ran out of data: coast briefly on the last known speed
      x = a.x + a.vx * Math.min(0.25, rt - a.t);
      z = a.z;
    }
    return { x, z: Math.max(0, z), vx: b ? (b.x - a.x) / Math.max(0.001, b.t - a.t) : a.vx, flags: a.flags, cu: a.cu };
  }

  latest(lane) {
    const s = this.snaps[this.snaps.length - 1];
    return s && s.g[lane];
  }

  // Build the list of geese for the renderer. `local` is the phone's own simulated goose.
  geese(t, local, dt) {
    const out = [];
    for (let l = 0; l < S.LANES; l++) {
      const rc = this.racers[l];
      if (!rc) continue;
      let st;
      if (local && l === this.meLane) {
        st = { x: local.x, z: local.z, vx: local.vx, flags: S.packFlags(local) };
      } else {
        st = this.sample(l, t);
        if (!st) st = { x: 0, z: 0, vx: 0, flags: 0 };
      }
      const dx = st.x - this.prevX[l];
      if (!(local && l === this.meLane)) this.leg[l] += Math.max(0, Math.min(1.5, dx)) * 2.6;
      this.prevX[l] = st.x;
      this.honkT[l] = Math.max(0, this.honkT[l] - dt);
      out.push({
        lane: l, x: st.x, z: st.z, vx: st.vx, flags: st.flags, hat: rc.hat, name: rc.name, bot: rc.bot,
        me: l === this.meLane, phase: local && l === this.meLane ? local.legPhase : this.leg[l],
        honk: this.honkT[l], wob: local && l === this.meLane ? local.wobble : 0,
      });
    }
    return out;
  }

  // Rank lanes: finishers by place, then by distance.
  ranking(geese) {
    const fins = Object.entries(this.finPlace).map(([l, p]) => ({ l: +l, p })).sort((a, b) => a.p - b.p).map((e) => e.l);
    const rest = geese.filter((g) => !fins.includes(g.lane)).sort((a, b) => b.x - a.x).map((g) => g.lane);
    return [...fins, ...rest];
  }

  tickFarmer(dt) {
    if (this.farmerTarget == null) {
      if (this.farmerX != null) { this.farmerX += 12 * dt; this.farmerGone = (this.farmerGone || 0) + dt; if (this.farmerGone > 3) this.farmerX = null; }
      return;
    }
    this.farmerGone = 0;
    this.farmerX += (this.farmerTarget - this.farmerX) * Math.min(1, dt * 8) + 8.6 * dt * 0.5;
  }

  // Your own lane is always the bottom (nearest, biggest) row on your phone; everyone else stacks above.
  laneOrder() {
    const all = [0, 1, 2, 3, 4, 5, 6, 7];
    if (this.meLane == null) return all;
    return all.filter((l) => l !== this.meLane).concat(this.meLane);
  }

  scene(t, clock, geese, extra = {}) {
    return {
      theme: this.theme, course: this.course, t, clock, lanes: this.laneOrder(),
      geese, meLane: this.meLane, removed: this.removed, extras: this.extras,
      farmerX: this.farmerX, farmerLeaving: this.farmerLeaving, frozen: this.frozen, ...extra,
    };
  }

  posOf(lane, geese) {
    const g = geese && geese.find((q) => q.lane === lane);
    if (g) return g.x;
    const s = this.latest(lane);
    return s ? s[0] : 0;
  }

  // Visual + audio reactions to server events. Returns nothing; UI layers handle banners.
  onEvent(m, geese) {
    const r = this.r;
    const me = this.meLane;
    const pitch = (l) => 0.78 + (l || 0) * 0.07;
    switch (m.k) {
      case 'pk': {
        const rm = this.removed[m.lane];
        if (m.kind === 'take') rm.taken[m.i] = true; else rm.knocked[m.i] = true;
        break;
      }
      case 'honk':
        this.honkT[m.lane] = 0.45;
        A.honk(pitch(m.lane), m.lane === me ? 0.55 : 0.3);
        if (this.phase === 'race') r.burst('spark', this.posOf(m.lane, geese) + 0.8, m.lane, 3, { h: 1, color: '#fff', life: 0.4, grav: 0 });
        break;
      case 'fin': {
        this.finPlace[m.lane] = m.place;
        const x = this.course ? this.course.len : 0;
        r.burst('confetti', x, m.lane, m.place === 1 ? 50 : 22, { h: 1.2, speed: 4, up: 2, life: 2.4, grav: 3, colors: S.COLORS });
        r.popText(S.ordinal(m.place) + '!', x + 0.5, m.lane, m.place <= 3 ? '#ffd23f' : '#fff', m.place === 1 ? 1.5 : 1);
        if (m.lane !== me) A.pop();
        if (m.place === 1 && m.lane !== me) A.fanfare();
        break;
      }
      case 'item': {
        const fx = this.posOf(m.from, geese);
        if (m.item === 'honk') {
          A.megaHonk();
          this.honkT[m.from] = 1;
          for (let i = 0; i < 3; i++) setTimeout(() => r.burst('ring', fx + 0.6, m.from, 1, { h: 1, speed: 0, life: 0.7, grav: 0, color: S.COLORS[m.from], size: 1 }), i * 120);
          for (const l of m.to) {
            r.popText('HONKED!', this.posOf(l, geese), l, '#ff6fb5');
            r.burst('feather', this.posOf(l, geese), l, 6, { h: 0.8, speed: 2, life: 1.4, grav: 1.5 });
          }
          if (m.to.includes(me)) { r.shake = 1; A.buzz([60, 40, 60]); }
        } else if (m.item === 'rotten' && m.to.length) {
          const tl = m.to[0];
          r.throwEgg(fx, m.from, this.posOf(tl, geese) + 2, tl);
          A.whoosh();
          setTimeout(() => {
            A.splat();
            const tx = this.posOf(tl, geese);
            r.burst('drop', tx, tl, 16, { h: 1.1, speed: 3, life: 0.8, colors: ['#ffd21f', '#e8ecd0', '#b5c46a'] });
            r.popText('SPLAT!', tx, tl, '#ffd21f');
          }, 650);
        } else if (m.item === 'swap' && m.to.length) {
          A.whoosh();
          for (const l of [m.from, m.to[0]]) r.burst('poof', this.posOf(l, geese), l, 10, { h: 0.6, speed: 1.5, life: 0.8, grav: 0 });
          r.popText('SWAP!', this.posOf(m.to[0], geese), m.to[0], '#a95cff');
        } else if (m.item === 'bread') {
          r.burst('crumb', fx, m.from, 10, { h: 0.6, speed: 2, life: 0.8, colors: ['#e3a14f', '#b8742a'] });
          if (m.from !== me) r.popText('TURBO!', fx, m.from, '#ffd23f', 0.8);
        } else if (m.item === 'wings') {
          r.burst('feather', fx, m.from, 10, { h: 1, speed: 2.5, life: 1.2, grav: 1 });
          if (m.from !== me) r.popText('WINGS!', fx, m.from, '#fff', 0.8);
        }
        break;
      }
      case 'smack': {
        const x = this.posOf(m.lane, geese);
        r.popText(['WHACK!', 'YEET!', 'BONK!', 'SHOO!'][Math.floor(Math.random() * 4)], x, m.lane, '#ffd23f', 1.2);
        r.burst('feather', x, m.lane, 12, { h: 0.8, speed: 3, life: 1.6, grav: 1.2 });
        A.yeet();
        if (m.lane === me) { r.shake = 1.2; A.buzz([80, 30, 120]); }
        break;
      }
      case 'farmer':
        this.farmerLeaving = false;
        A.alarm();
        break;
      case 'farmerEnd':
        this.farmerLeaving = true;
        break;
      case 'bread': {
        // decorative bread raining over every lane
        const base = geese && geese.length ? Math.min(...geese.map((g) => g.x)) : 0;
        for (let i = 0; i < 40; i++) {
          const l = Math.floor(Math.random() * 8);
          setTimeout(() => r.burst('bread', base + Math.random() * 40, l, 1, { h: 6, speed: 0.3, life: 1.6, grav: 4 }), Math.random() * 3000);
        }
        break;
      }
      case 'hat':
        if (this.racers[m.lane]) this.racers[m.lane].hat = m.hat;
        break;
    }
  }

  // Pack camera: keep everyone still racing in view.
  packCamera(geese, dt, w) {
    const alive = geese.filter((g) => !this.finPlace[g.lane]);
    const set = alive.length ? alive : geese;
    if (!set.length) return;
    let min = Math.min(...set.map((g) => g.x)), max = Math.max(...set.map((g) => g.x));
    if (this.farmerX != null && this.farmerTarget != null) min = Math.min(min, this.farmerX - 1);
    const span = Math.min(w > 700 ? 34 : 26, Math.max(w > 700 ? 18 : 15, max - min + 8));
    const k = Math.min(1, dt * 2.5);
    this.r.ppu += (w / span - this.r.ppu) * k;
    const cam = (min + max) / 2 + 1 - w / this.r.ppu / 2;
    this.r.camX += (cam - this.r.camX) * k;
  }
}
