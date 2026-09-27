// Shared game rules — imported by both the server (bots, validation) and the phone (own goose).
// World units: 1 unit ≈ one goose length. Geese run toward +x.

export const LANES = 8;
export const COLORS = ['#ff4d5e', '#ff9f1c', '#ffd23f', '#35d07f', '#22c7e6', '#4f7cff', '#a95cff', '#ff6fb5'];
export const COLOR_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink'];
export const HATS = ['tophat', 'party', 'crown', 'cowboy', 'beanie', 'chef', 'viking', 'propeller', 'tulip', 'wizard'];
export const HAT_LABELS = {
  tophat: 'Top Hat', party: 'Party Hat', crown: 'Royal Crown', cowboy: 'Cowboy Hat', beanie: 'Cosy Beanie',
  chef: 'Chef Toque', viking: 'Viking Helmet', propeller: 'Propeller Cap', tulip: 'Dutch Tulip', wizard: 'Wizard Hat',
};
export const BOT_NAMES = ['Sir Waddles', 'Goosey Lady', 'Mother Goose', 'Quackers (a duck)', 'Captain Honk',
  'Lady Featherbottom', 'Professor Plume', 'Admiral Beak', 'Sergeant Squawk', 'Duchess Dabble', 'Gary the Grey', 'Waddlesworth'];

export const PHYS = { gravity: 26, flapV: 8, bodyHalf: 0.42 };

export const THEMES = {
  meadow: {
    key: 'meadow', name: 'Windmill Meadow', emoji: '🌷', len: 190,
    accel: 1.45, drag: 1.7, maxV: 7,
    food: 'bread', solid: 'fence', obs: { fence: 4, hay: 1.5, puddle: 2, bread: 2.2, tramp: 1.3 },
    tip: 'Tap the glowing foot — left, right, left, right! FLAP over fences, and run onto trampolines to fly 🤸',
  },
  ice: {
    key: 'ice', name: 'Frozen Canal', emoji: '❄️', len: 215,
    accel: 0.8, drag: 0.6, maxV: 8.2,
    food: 'oliebol', solid: 'snowman', obs: { hole: 3.5, snowman: 2.2, oliebol: 2, tramp: 1.1 },
    tip: 'Ice is slippery — you glide! FLAP over the holes or take a cold bath.',
  },
  night: {
    key: 'night', name: 'Maastricht by Night', emoji: '🌙', len: 235,
    accel: 1.4, drag: 1.55, maxV: 7.3,
    food: 'vlaai', solid: 'bollard', obs: { bollard: 3, puddle: 1.2, vlaai: 2, cross: 2.6, tramp: 1.1 },
    tip: 'Bikes have right of way! 🚲 Hop when you hear the bell. DOUBLE POINTS!',
  },
};
export const ROUNDS = ['meadow', 'ice', 'night'];

export const OBS = {
  fence: { kind: 'solid', w: 0.35 },
  hay: { kind: 'solid', w: 0.8 },
  snowman: { kind: 'solid', w: 0.6 },
  bollard: { kind: 'solid', w: 0.3 },
  puddle: { kind: 'mud', w: 2.2 },
  hole: { kind: 'hole', w: 1.4 },
  bread: { kind: 'food' },
  oliebol: { kind: 'food' },
  vlaai: { kind: 'food' },
  egg: { kind: 'egg' },
  tramp: { kind: 'tramp', w: 0.9 },
};

export const ITEMS = {
  bread: { emoji: '🚀', name: 'Turbo Bread', desc: 'Zoom!' },
  honk: { emoji: '📯', name: 'MEGA HONK', desc: 'Stuns geese near you' },
  rotten: { emoji: '🥚', name: 'Rotten Egg', desc: 'Splat the leader' },
  wings: { emoji: '🪽', name: 'Wings', desc: 'Fly over everything' },
  swap: { emoji: '🔀', name: 'Swap', desc: 'Trade places with the goose ahead' },
};

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(r, weights) {
  const entries = Object.entries(weights);
  let total = 0;
  for (const [, w] of entries) total += w;
  let v = r() * total;
  for (const [k, w] of entries) { v -= w; if (v <= 0) return k; }
  return entries[entries.length - 1][0];
}

// Every lane gets the same hazards at the same spot (fair, like athletics hurdles);
// pickups wobble a little per lane so it looks organic.
export function makeCourse(themeKey, seed, len) {
  const th = THEMES[themeKey];
  const r = rng(seed);
  const L = len || th.len;
  const base = [];
  const cross = [];
  let x = 13;
  let nextEgg = 24;
  let last = null;
  while (x < L - 9) {
    if (x >= nextEgg) {
      base.push({ x, t: 'egg' });
      nextEgg = x + 40 + r() * 14;
      x += 4 + r() * 2;
      continue;
    }
    let t = pickWeighted(r, th.obs);
    if (t === last && OBS[t] && OBS[t].kind === 'food') t = pickWeighted(r, th.obs);
    if (t === 'cross') {
      cross.push({ x: x + 0.8, phase: r() * 11, speed: 4.6 + r() * 1.2 });
      x += 9 + r() * 5;
    } else if (t === 'tramp') {
      // a trampoline, then something worth flying over
      base.push({ x, t });
      base.push({ x: x + 5.5, t: th.solid });
      x += 12 + r() * 4;
    } else {
      base.push({ x, t });
      const kind = OBS[t].kind;
      if (kind === 'food') {
        // little trail of treats
        const n = r() < 0.5 ? 2 : 1;
        for (let i = 1; i <= n; i++) base.push({ x: x + i * 1.4, t });
        x += 4 + n * 1.4 + r() * 3;
      } else if (kind === 'mud') x += 7 + r() * 4;
      else x += 6.5 + r() * 5;
    }
    last = t;
  }
  const lanes = [];
  for (let lane = 0; lane < LANES; lane++) {
    const lr = rng(seed * 31 + lane * 7919 + 13);
    lanes.push(base.map((o) => {
      const kind = OBS[o.t].kind;
      const j = kind === 'food' || kind === 'egg' ? (lr() - 0.5) * 0.9 : 0;
      return { x: o.x + j, t: o.t, v: Math.floor(lr() * 1000) };
    }));
  }
  return { theme: themeKey, seed, len: L, lanes, cross };
}

// Position (in lanes, 0 = far lane) of bike k at a crossing at race time t. Values outside -1..8 are off-track.
export function bikeLanePos(c, t, k) {
  const cyc = 11;
  let f = (t * c.speed + c.phase + k * 5.5) % cyc;
  if (f < 0) f += cyc;
  return f - 1.5;
}

export function newGoose(lane) {
  return {
    lane, x: 0, vx: 0, z: 0, vz: 0,
    stun: 0, boost: 0, fly: 0, inv: 0, wobble: 0, splat: 0,
    yeet: 0, yeetT: 0, yeetFrom: 0, yeetTo: 0,
    dunk: 0, dunkX: 0, mud: false, frozen: false,
    foot: 0, steps: 0, pend: 0, tramp: 0, fin: false, finT: 0,
    taken: {}, knocked: {}, extra: [],
  };
}

export function canRun(g) {
  return g.stun <= 0 && g.yeet <= 0 && g.dunk <= 0 && !g.frozen;
}

// foot: 1 = left, 2 = right. Returns 1 for a good step, -1 for the same foot twice, 0 if blocked.
export function stepFoot(g, foot, th, cu = 1) {
  if (!canRun(g)) return 0;
  if (foot === g.foot) { g.wobble = 0.25; return -1; }
  g.foot = foot;
  g.steps++;
  let a = th.accel * cu;
  if (g.mud) a *= 0.45;
  if (g.z > 0.05 && g.fly <= 0) a *= 0.4;
  g.pend += a; // blended in over ~0.1s by simGoose so each tap feels like a push, not a jolt
  return 1;
}

export function flap(g) {
  if (g.z <= 0.02 && g.vz <= 0 && g.stun <= 0 && g.yeet <= 0 && g.dunk <= 0 && g.fly <= 0 && !g.frozen) {
    g.vz = PHYS.flapV;
    return true;
  }
  return false;
}

export function startYeet(g, dist, len) {
  if (g.fin) return;
  g.yeet = 1; g.yeetT = 0; g.yeetFrom = g.x;
  g.yeetTo = Math.min(g.x + dist, len - 2.5);
  g.stun = 0; g.dunk = 0; g.vz = 0; g.pend = 0;
}

function obstaclesOf(course, g) {
  return g.extra.length ? course.lanes[g.lane].concat(g.extra) : course.lanes[g.lane];
}

// Advance one goose. Pushes gameplay events into `out` ({e, i, o}).
export function simGoose(g, dt, th, course, cu, t, out) {
  g.stun = Math.max(0, g.stun - dt);
  g.tramp = Math.max(0, g.tramp - dt);
  g.boost = Math.max(0, g.boost - dt);
  g.fly = Math.max(0, g.fly - dt);
  g.inv = Math.max(0, g.inv - dt);
  g.wobble = Math.max(0, g.wobble - dt);
  g.splat = Math.max(0, g.splat - dt);

  if (g.yeet > 0) {
    g.yeetT += dt;
    const p = Math.min(1, g.yeetT / 1.15);
    const e = 1 - Math.pow(1 - p, 2);
    g.x = g.yeetFrom + (g.yeetTo - g.yeetFrom) * e;
    g.z = Math.sin(Math.PI * p) * 4.2;
    if (p >= 1) { g.yeet = 0; g.z = 0; g.vx = Math.max(g.vx, 4); g.inv = 0.6; out.push({ e: 'land', big: true }); }
    checkFinish(g, course, t, out);
    return;
  }
  if (g.dunk > 0) {
    g.dunk -= dt;
    g.vx = 0;
    if (g.dunk <= 0) { g.dunk = 0; g.x = g.dunkX; g.vz = 6.5; g.z = 0.01; g.inv = 0.5; out.push({ e: 'popout' }); }
    return;
  }

  const air = g.z > 0 || g.vz > 0;
  if (g.fly > 0) {
    g.vx = Math.max(g.vx, 8.6);
    g.z += (1.9 - g.z) * Math.min(1, dt * 5);
    g.vz = 0;
    if (g.fly <= dt) g.vz = 0.5;
  } else if (air) {
    // after a trampoline launch the way down is floaty — that's the "flying" part
    g.vz -= PHYS.gravity * (g.tramp > 0 && g.vz < 0 ? 0.22 : 1) * dt;
    g.z += g.vz * dt;
    if (g.z <= 0) { g.z = 0; g.vz = 0; g.tramp = 0; out.push({ e: 'land' }); }
  }
  if (g.tramp > 0) g.vx = Math.max(g.vx, 8.2);

  if (g.pend > 0) {
    const take = g.pend * Math.min(1, dt * 14);
    g.vx += take; g.pend -= take;
  }
  if (g.frozen) { g.vx *= Math.max(0, 1 - dt * 10); g.pend = 0; }
  if (g.boost > 0) g.vx += 10 * dt;
  const drag = air ? th.drag * 0.35 : th.drag;
  g.vx -= g.vx * drag * dt;
  if (g.stun > 0) g.vx *= Math.max(0, 1 - dt * 5);
  const maxV = th.maxV * cu + (g.boost > 0 ? 3.4 : 0) + (g.fly > 0 || g.tramp > 0 ? 1.6 : 0);
  if (g.vx > maxV) g.vx = maxV;
  if (g.vx < -3) g.vx = -3;
  if (g.mud && g.vx > 2.4 && g.fly <= 0 && g.boost <= 0) g.vx = 2.4;

  const prevX = g.x;
  g.x += g.vx * dt;

  const grounded = g.z < 0.45 && g.fly <= 0;
  let inMud = false;
  const obs = obstaclesOf(course, g);
  const H = PHYS.bodyHalf;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.x < prevX - 3 || o.x > g.x + 3) continue;
    const def = OBS[o.t];
    const id = o.id != null ? o.id : i;
    if (def.kind === 'solid') {
      if (!grounded || g.knocked[id]) continue;
      const left = o.x - def.w / 2, right = o.x + def.w / 2;
      if (g.x + H >= left && prevX - H <= right) {
        g.knocked[id] = true;
        g.x = left - H - 0.02;
        g.vx = -2.4; g.stun = 0.85; g.inv = 1.2; g.pend = 0;
        out.push({ e: 'bonk', i: id, o });
      }
    } else if (def.kind === 'mud') {
      if (grounded && Math.abs(g.x - o.x) < def.w / 2) inMud = true;
    } else if (def.kind === 'hole') {
      if (grounded && g.inv <= 0 && Math.abs(g.x - o.x) < def.w / 2 - 0.3) {
        g.dunk = 1.15; g.dunkX = o.x + def.w / 2 + 0.55; g.x = o.x; g.vx = 0; g.boost = 0; g.pend = 0;
        out.push({ e: 'dunk', i: id, o });
        return;
      }
    } else if (def.kind === 'tramp') {
      if (g.taken[id] || g.fly > 0 || g.z > 0.35 || g.vz > 0.5) continue;
      if (Math.abs(g.x - o.x) < def.w / 2 + 0.2) {
        g.taken[id] = true;
        g.vz = 10.5; g.z = 0.05; g.tramp = 1.8; g.stun = 0; g.pend = 0;
        out.push({ e: 'tramp', i: id, o });
      }
    } else if (def.kind === 'food' || def.kind === 'egg') {
      if (g.taken[id]) continue;
      const lo = Math.min(prevX, g.x) - 0.6, hi = Math.max(prevX, g.x) + 0.6;
      if (o.x >= lo && o.x <= hi && g.z < 2.4) {
        g.taken[id] = true;
        if (def.kind === 'food') { g.boost = Math.max(g.boost, 1.3); out.push({ e: 'food', i: id, o }); }
        else out.push({ e: 'egg', i: id, o });
      }
    }
  }
  if (inMud && !g.mud) out.push({ e: 'mud' });
  g.mud = inMud;

  if (grounded && g.inv <= 0) {
    for (const c of course.cross) {
      if (Math.abs(g.x - c.x) > 0.75) continue;
      for (let k = 0; k < 2; k++) {
        if (Math.abs(bikeLanePos(c, t, k) - g.lane) < 0.6) {
          g.x = c.x - 0.8; g.vx = -2.6; g.stun = 0.9; g.inv = 1.6; g.pend = 0;
          out.push({ e: 'bike' });
          break;
        }
      }
    }
  }
  checkFinish(g, course, t, out);
}

function checkFinish(g, course, t, out) {
  if (!g.fin && g.x >= course.len) {
    g.fin = true; g.finT = t;
    out.push({ e: 'fin', t });
  }
}

// Effects sent by the server (items, farmer, reflex rewards). Returns false if it didn't land.
export function applyFx(g, m, len) {
  switch (m.k) {
    case 'boost': g.boost = Math.max(g.boost, m.d); break;
    case 'fly': g.fly = m.d; g.stun = 0; g.z = Math.max(g.z, 0.1); break;
    case 'stun':
      if (g.fly > 0 || g.yeet > 0 || g.fin) return false;
      g.stun = Math.max(g.stun, m.d); g.vx *= 0.2; g.pend = 0; break;
    case 'splat': g.splat = m.d; if (!g.fin) g.stun = Math.max(g.stun, 0.6); break;
    case 'tp': g.x = m.x; g.dunk = 0; g.yeet = 0; g.inv = 0.8; break;
    case 'yeet': startYeet(g, m.d, len); break;
    default: return false;
  }
  return true;
}

// Distance to the next thing worth hopping over (for the FLAP hint and bots).
export function nextHazard(g, course, t) {
  let best = Infinity;
  for (const o of obstaclesOf(course, g)) {
    const def = OBS[o.t];
    if (def.kind === 'food' || def.kind === 'egg' || def.kind === 'tramp') continue;
    const id = o.id != null ? o.id : course.lanes[g.lane].indexOf(o);
    if (def.kind === 'solid' && g.knocked[id]) continue;
    const d = o.x - (def.w || 0) / 2 - g.x;
    if (d > -0.2 && d < best) best = d;
  }
  for (const c of course.cross) {
    const d = c.x - 0.8 - g.x;
    if (d > -0.2 && d < best) {
      // only count it if a bike is somewhere near the lane
      const eta = Math.max(0, d) / Math.max(1, g.vx);
      for (let k = 0; k < 2; k++) {
        if (Math.abs(bikeLanePos(c, t + eta, k) - g.lane) < 2.2) { best = d; break; }
      }
    }
  }
  return best;
}

// Next hazard of any kind in the goose's lane (bike lanes always count) — drives the early-warning chip.
export function nextThreat(g, course) {
  let best = null;
  const obs = obstaclesOf(course, g);
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    const def = OBS[o.t];
    if (def.kind === 'food' || def.kind === 'egg' || def.kind === 'tramp') continue;
    const id = o.id != null ? o.id : i;
    if (def.kind === 'solid' && g.knocked[id]) continue;
    const d = o.x - (def.w || 0) / 2 - g.x;
    if (d > 0.3 && (!best || d < best.d)) best = { d, t: o.t, o };
  }
  for (const c of course.cross) {
    const d = c.x - 0.8 - g.x;
    if (d > 0.3 && (!best || d < best.d)) best = { d, t: 'bike', o: c };
  }
  return best;
}

// Flags packed into snapshots so other screens can draw what a goose is doing.
export const F = { stun: 1, fly: 2, yeet: 4, boost: 8, fin: 16, splat: 32, mud: 64, bot: 128, dunk: 256, frozen: 512, tramp: 1024 };

export function packFlags(g) {
  return (g.stun > 0 ? F.stun : 0) | (g.fly > 0 ? F.fly : 0) | (g.yeet > 0 ? F.yeet : 0) |
    (g.boost > 0 ? F.boost : 0) | (g.fin ? F.fin : 0) | (g.splat > 0 ? F.splat : 0) |
    (g.mud ? F.mud : 0) | (g.dunk > 0 ? F.dunk : 0) | (g.frozen ? F.frozen : 0) | (g.tramp > 0 ? F.tramp : 0);
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
