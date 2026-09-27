// One private game: its players, bots, race state and timers. server.js owns the sockets and routing;
// everything here only talks to the sockets attached to this room.
import crypto from 'node:crypto';
import * as S from '../public/shared/sim.js';

const DEV = process.env.NODE_ENV !== 'production';
const FAST = process.env.GOOSY_FAST === '1'; // test runs: short intros/results/courses
export const TIMING = {
  INTRO_MS: FAST ? 1200 : 7200,
  RESULTS_MS: FAST ? 1500 : 10000,
  HURRY_S: FAST ? 6 : 20,
  LEN_SCALE: FAST ? 0.25 : 1,
};

const rnd = Math.random;
const r2 = (v) => Math.round(v * 100) / 100;
const pick = (a) => a[Math.floor(rnd() * a.length)];

function newStats() {
  return { bonks: 0, flaps: 0, food: 0, honks: 0, items: 0, yeets: 0, splats: 0, dunks: 0, hits: 0, bikes: 0, tramps: 0, reflexMs: 0, wins: 0 };
}

export function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
}

const BLOCKED = /(fuck|shit|cunt|nigg|fag|kanker|hoer|kut|nazi|hitler)/i;
export function cleanName(s) {
  const n = String(s || '').replace(/[<>]/g, '').replace(/[\u0000-\u001f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return BLOCKED.test(n.replace(/[^a-z]/gi, '')) ? '' : n;
}

const AWARDS = [
  { key: 'bonks', icon: '💥', title: 'Professional Fence Inspector', fmt: (v) => `bonked into things ${v}×` },
  { key: 'yeets', icon: '🧹', title: "The Farmer's Favourite", fmt: (v) => `got yeeted by the broom ${v}×` },
  { key: 'food', icon: '🍞', title: 'Snack Connoisseur', fmt: (v) => `ate ${v} snacks mid-race` },
  { key: 'flaps', icon: '🪽', title: 'Frequent Flyer', fmt: (v) => `flapped ${v} times` },
  { key: 'honks', icon: '📯', title: 'Loudest Honker', fmt: (v) => `honked ${v} times` },
  { key: 'splats', icon: '🥚', title: 'Egg on Face', fmt: (v) => `got egged ${v}×` },
  { key: 'dunks', icon: '🧊', title: 'Polar Plunger', fmt: (v) => `fell through the ice ${v}×` },
  { key: 'hits', icon: '🎯', title: 'Agent of Chaos', fmt: (v) => `sabotaged ${v} geese` },
  { key: 'bikes', icon: '🚲', title: 'Bike Lane Menace', fmt: (v) => `ran into ${v} Dutch cyclists` },
  { key: 'tramps', icon: '🤸', title: 'Trampoline Champion', fmt: (v) => `bounced sky-high ${v} times` },
  { key: 'reflex', icon: '⚡', title: 'Lightning Reflexes', fmt: (v, s) => `reacted in ${s.reflexMs} ms` },
];

export class Room {
  constructor(code, log = () => {}) {
    this.code = code;
    this.log = (msg) => log(`[${code}] ${msg}`);
    this.sockets = new Set();
    this.players = new Map(); // id -> human player
    this.joinCounter = 0;
    this.locked = false;
    this.emptySince = Date.now();
    this.dead = false;
    this.game = {
      phase: 'lobby', round: -1, fillBots: true,
      racers: new Array(S.LANES).fill(null), // lane -> player or bot
      geese: [], course: null, theme: null, seed: 0, startAt: 0,
      finish: [], firstFinT: null, endAt: 0,
      events: [], farmer: null, reflex: null,
      lastResults: null, lastFinal: null, timer: null, lastTick: Date.now(),
    };
  }

  // ---------------------------------------------------------------- sockets
  attach(ws) {
    this.sockets.add(ws);
    ws.room = this;
    send(ws, this.lobbyMsg()); // lets the join screen show what's going on before anyone joins
  }

  detach(ws) {
    this.sockets.delete(ws);
    if (!this.sockets.size) this.emptySince = Date.now();
    if (ws.tv) setTimeout(() => this.broadcastLobby(), 50);
    const p = ws.pid ? this.players.get(ws.pid) : null;
    if (p && p.ws === ws) {
      p.connected = false;
      p.discAt = Date.now();
      p.ws = null;
      if (this.game.phase === 'race' && this.game.racers[p.lane] === p && p.ai) p.ai = null;
      this.broadcastLobby();
    }
  }

  destroy() {
    this.dead = true;
    clearTimeout(this.game.timer);
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const ws of this.sockets) send(ws, s);
  }
  broadcastExcept(except, msg) {
    const s = JSON.stringify(msg);
    for (const ws of this.sockets) if (ws !== except) send(ws, s);
  }

  // ---------------------------------------------------------------- lobby
  activeHumans() {
    return [...this.players.values()].filter((p) => !p.pending).sort((a, b) => a.joinedAt - b.joinedAt);
  }
  hostId() {
    const h = this.activeHumans().find((p) => p.connected) || this.activeHumans()[0];
    return h ? h.id : null;
  }
  freeLane() {
    const used = new Set([...this.players.values()].map((p) => p.lane));
    const order = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => rnd() - 0.5);
    for (const l of order) if (!used.has(l)) return l;
    return null;
  }
  lobbyMsg() {
    const game = this.game;
    return {
      type: 'lobby', room: this.code, hostId: this.hostId(), fillBots: game.fillBots, locked: this.locked, phase: game.phase,
      tv: [...this.sockets].some((ws) => ws.tv && ws.readyState === 1),
      round: game.round, totalRounds: S.ROUNDS.length, theme: game.theme, full: this.players.size >= S.LANES,
      players: [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => ({
        id: p.id, name: p.name, lane: p.lane, hat: p.hat, connected: p.connected, pending: !!p.pending,
      })),
    };
  }
  broadcastLobby() { this.broadcast(this.lobbyMsg()); }

  racersInfo() {
    return this.game.racers.map((r) => r && { id: r.id, name: r.name, lane: r.lane, hat: r.hat, bot: !!r.bot });
  }
  raceMsg(forPlayer) {
    const game = this.game;
    const m = {
      type: 'phase', phase: 'race', round: game.round, totalRounds: S.ROUNDS.length, theme: game.theme,
      seed: game.seed, len: game.course.len, startAt: game.startAt, racers: this.racersInfo(), double: game.round === S.ROUNDS.length - 1,
    };
    if (forPlayer && game.racers[forPlayer.lane] === forPlayer) {
      const g = game.geese[forPlayer.lane];
      m.you = { x: g.x, fin: g.fin, held: forPlayer.held || null };
    }
    return m;
  }
  sendCurrentPhase(ws, p) {
    const game = this.game;
    if (game.phase === 'lobby') send(ws, { type: 'phase', phase: 'lobby' });
    else if (game.phase === 'race') send(ws, this.raceMsg(p));
    else if (game.phase === 'results') send(ws, game.lastResults);
    else if (game.phase === 'final') send(ws, game.lastFinal);
  }

  pruneDisconnected(graceMs) {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.players) {
      if (!p.connected && now - p.discAt > graceMs) { this.players.delete(id); changed = true; }
    }
    if (changed) this.broadcastLobby();
  }

  // ---------------------------------------------------------------- game flow
  startGame() {
    const game = this.game;
    game.round = DEV ? Math.min(S.ROUNDS.length - 1, Number(process.env.START_ROUND) || 0) : 0; // START_ROUND: dev shortcut
    for (const p of this.players.values()) { p.pending = false; p.score = 0; p.stats = newStats(); p.held = null; }
    const humansByLane = new Array(S.LANES).fill(null);
    for (const p of this.players.values()) humansByLane[p.lane] = p;
    const botNames = [...S.BOT_NAMES].sort(() => rnd() - 0.5);
    const usedHats = new Set([...this.players.values()].map((p) => p.hat));
    game.racers = humansByLane.map((p, lane) => {
      if (p) return p;
      if (!game.fillBots) return null;
      const freeHats = S.HATS.filter((h) => !usedHats.has(h));
      const hat = freeHats.length ? pick(freeHats) : pick(S.HATS);
      usedHats.add(hat);
      return {
        id: 'bot-' + lane, name: botNames.pop(), lane, hat, bot: true, score: 0, stats: newStats(), held: null,
        skill: 0.35 + rnd() * 0.6,
      };
    });
    this.log(`game started: ${this.activeHumans().length} players`);
    this.startRound();
  }

  startRound() {
    const game = this.game;
    clearTimeout(game.timer);
    const key = S.ROUNDS[game.round];
    game.theme = key;
    game.seed = Math.floor(rnd() * 1e9);
    game.course = S.makeCourse(key, game.seed, Math.round(S.THEMES[key].len * TIMING.LEN_SCALE));
    game.startAt = Date.now() + TIMING.INTRO_MS;
    game.geese = game.racers.map((r, lane) => (r ? S.newGoose(lane) : null));
    for (const g of game.geese) if (g) { g.flags = 0; g.repX = 0; g.repAt = game.startAt; }
    for (const r of game.racers) if (r) { r.held = null; r.ai = null; r.stunImmune = 0; r.splatImmune = 0; }
    game.finish = []; game.firstFinT = null; game.endAt = 0;
    game.farmer = null; game.reflex = null;
    const plans = [['reflex', 'bread'], ['eggs', 'farmer'], [pick(['reflex', 'bread', 'eggs']), 'farmer']];
    game.events = plans[game.round].map((k, i) => ({ k, at: i === 0 ? 10 + rnd() * 3 : 22 + rnd() * 4, done: false }));
    game.phase = 'race';
    for (const ws of this.sockets) send(ws, this.raceMsg(this.players.get(ws.pid)));
    this.broadcastLobby();
  }

  recordFinish(lane, t) {
    const game = this.game;
    if (game.finish.some((f) => f.lane === lane)) return;
    const g = game.geese[lane];
    g.fin = true; g.finT = t;
    game.finish.push({ lane, t });
    game.finish.sort((a, b) => a.t - b.t);
    if (game.firstFinT == null) game.firstFinT = t;
    const place = game.finish.findIndex((f) => f.lane === lane) + 1;
    this.broadcast({ type: 'ev', k: 'fin', lane, place, t: r2(t) });
  }

  endRace() {
    const game = this.game;
    if (game.phase !== 'race') return;
    const last = game.round === S.ROUNDS.length - 1;
    const mult = last ? 2 : 1;
    const done = game.finish.map((f) => f.lane);
    const rest = game.geese.map((g, lane) => (g && !done.includes(lane) ? lane : null)).filter((l) => l != null)
      .sort((a, b) => game.geese[b].x - game.geese[a].x);
    const order = [...done, ...rest];
    const rows = order.map((lane, i) => {
      const r = game.racers[lane];
      const pts = S.POINTS[i] * mult;
      r.score += pts;
      if (i === 0) r.stats.wins++;
      const f = game.finish.find((q) => q.lane === lane);
      return { lane, id: r.id, name: r.name, hat: r.hat, bot: !!r.bot, place: i + 1, time: f ? r2(f.t) : null, pts };
    });
    const totals = game.racers.filter(Boolean).map((r) => ({ lane: r.lane, id: r.id, name: r.name, hat: r.hat, bot: !!r.bot, total: r.score }))
      .sort((a, b) => b.total - a.total);
    game.phase = 'results';
    game.farmer = null;
    game.lastResults = {
      type: 'results', round: game.round, totalRounds: S.ROUNDS.length, theme: game.theme, rows, totals,
      next: last ? null : S.ROUNDS[game.round + 1], until: Date.now() + TIMING.RESULTS_MS, double: last,
    };
    this.broadcast(game.lastResults);
    this.broadcastLobby();
    game.timer = setTimeout(() => {
      if (this.dead) return;
      if (!this.activeHumans().some((p) => p.connected)) return this.backToLobby();
      if (last) this.finalScreen();
      else { game.round++; this.startRound(); }
    }, TIMING.RESULTS_MS);
  }

  computeAwards(standings) {
    const racers = this.game.racers.filter(Boolean);
    const out = {};
    const winner = standings[0];
    out[winner.id] = { icon: '👑', title: 'The Golden Goose', sub: `champion with ${winner.total} points` };
    const val = (r, a) => (a.key === 'reflex' ? (r.stats.reflexMs ? Math.max(1, 1000 - r.stats.reflexMs) : 0) : r.stats[a.key]);
    const assign = (pool) => {
      const cands = [];
      for (const a of AWARDS) {
        const max = Math.max(0, ...racers.map((r) => val(r, a)));
        if (!max) continue;
        for (const r of pool) {
          const v = val(r, a);
          if (v > 0) cands.push({ r, a, score: v / max + v * 0.01 });
        }
      }
      cands.sort((x, y) => y.score - x.score);
      const usedA = new Set(Object.values(out).map((o) => o.key));
      for (const c of cands) {
        if (out[c.r.id] || usedA.has(c.a.key)) continue;
        out[c.r.id] = { key: c.a.key, icon: c.a.icon, title: c.a.title, sub: c.a.fmt(val(c.r, c.a), c.r.stats) };
        usedA.add(c.a.key);
      }
    };
    assign(racers.filter((r) => !r.bot));
    assign(racers.filter((r) => r.bot));
    const lastOne = standings[standings.length - 1];
    if (!out[lastOne.id]) out[lastOne.id] = { icon: '🐌', title: 'Scenic Route Enjoyer', sub: 'took time to smell the tulips' };
    const fallback = [
      { icon: '🦢', title: 'Most Elegant Waddle', sub: 'pure grace, zero drama' },
      { icon: '😇', title: 'Perfectly Polite Goose', sub: 'never hurt a fly (or a goose)' },
      { icon: '🎩', title: 'Best Dressed', sub: 'that hat though' },
      { icon: '🧘', title: 'Zen Master', sub: 'unbothered. moisturised. in its lane.' },
      { icon: '🎈', title: 'Good Vibes Only', sub: 'here for the fun' },
      { icon: '🥈', title: 'Almost Famous', sub: 'so close you could taste the bread' },
    ];
    for (const r of racers) if (!out[r.id]) out[r.id] = fallback.shift() || { icon: '🪿', title: 'Certified Goose', sub: 'honk honk' };
    return out;
  }

  finalScreen() {
    const game = this.game;
    const standings = game.racers.filter(Boolean).map((r) => ({
      lane: r.lane, id: r.id, name: r.name, hat: r.hat, bot: !!r.bot, total: r.score, wins: r.stats.wins,
    })).sort((a, b) => b.total - a.total || b.wins - a.wins);
    game.phase = 'final';
    game.lastFinal = { type: 'final', standings, awards: this.computeAwards(standings) };
    this.broadcast(game.lastFinal);
    this.broadcastLobby();
    this.log(`game finished: winner ${standings[0] && standings[0].name}`);
  }

  backToLobby() {
    const game = this.game;
    clearTimeout(game.timer);
    game.phase = 'lobby';
    game.round = -1;
    game.racers = new Array(S.LANES).fill(null);
    game.geese = [];
    for (const p of this.players.values()) p.pending = false;
    this.pruneDisconnected(0);
    this.broadcast({ type: 'phase', phase: 'lobby' });
    this.broadcastLobby();
  }

  // ---------------------------------------------------------------- items & effects
  isAuto(lane) {
    const r = this.game.racers[lane];
    return r && (r.bot || !r.connected);
  }

  fx(lane, m) {
    const game = this.game;
    const g = game.geese[lane];
    if (!g) return;
    if (this.isAuto(lane)) {
      S.applyFx(g, m, game.course.len);
      if (m.k === 'yeet') g.flags = 0;
    } else {
      // positions the server moved on purpose are exempt from the speed sanity check
      if (m.k === 'tp') { g.x = m.x; g.repX = m.x; }
      if (m.k === 'yeet') g.exemptUntil = Date.now() + 2000;
      send(game.racers[lane].ws, { type: 'fx', ...m });
    }
  }

  rankFrac(lane) {
    const game = this.game;
    const alive = game.geese.map((g, l) => (g && !g.fin ? l : null)).filter((l) => l != null)
      .sort((a, b) => game.geese[b].x - game.geese[a].x);
    if (alive.length <= 1) return 0;
    return Math.max(0, alive.indexOf(lane)) / (alive.length - 1);
  }

  rollItem(lane) {
    const f = this.rankFrac(lane);
    const w = {
      bread: 3 - f * 1.2, honk: 2.4 - f * 0.6, rotten: 0.4 + f * 2.6,
      wings: 0.3 + f * 2.4, swap: f > 0.25 ? f * 2.2 : 0,
    };
    let total = 0;
    for (const v of Object.values(w)) total += v;
    let v = rnd() * total;
    for (const [k, x] of Object.entries(w)) { v -= x; if (v <= 0) return k; }
    return 'bread';
  }

  giveItem(lane) {
    const game = this.game;
    const r = game.racers[lane];
    if (!r || r.held) return;
    r.held = this.rollItem(lane);
    if (this.isAuto(lane)) r.ai && (r.ai.useAt = (Date.now() - game.startAt) / 1000 + 1.5 + rnd() * 3);
    else send(r.ws, { type: 'item', item: r.held });
  }

  useItem(lane) {
    const game = this.game;
    const r = game.racers[lane];
    const g = game.geese[lane];
    if (!r || !r.held || !g) return;
    const item = r.held;
    r.held = null;
    r.stats.items++;
    const alive = (l) => game.geese[l] && !game.geese[l].fin && l !== lane;
    let to = [];
    if (item === 'bread') this.fx(lane, { k: 'boost', d: 2.6 });
    else if (item === 'wings') this.fx(lane, { k: 'fly', d: 3.2 });
    else if (item === 'honk') {
      const now = Date.now();
      for (let l = 0; l < S.LANES; l++) {
        if (!alive(l) || Math.abs(l - lane) > 2) continue;
        const dx = game.geese[l].x - g.x;
        const vr = game.racers[l];
        if (dx > -3 && dx < 14 && !(vr.stunImmune > now)) {
          to.push(l);
          vr.stunImmune = now + 4000;
          this.fx(l, { k: 'stun', d: 1.1, why: 'honk' });
        }
      }
      r.stats.hits += to.length;
      r.stats.honks++;
    } else if (item === 'rotten') {
      const now = Date.now();
      const cands = [0, 1, 2, 3, 4, 5, 6, 7].filter((l) => alive(l) && !(game.racers[l].splatImmune > now))
        .sort((a, b) => game.geese[b].x - game.geese[a].x);
      if (cands.length) {
        to = [cands[0]];
        const victim = game.racers[cands[0]];
        victim.splatImmune = now + 12000;
        victim.stats.splats++;
        r.stats.hits++;
        setTimeout(() => !this.dead && game.phase === 'race' && this.fx(cands[0], { k: 'splat', d: 5 }), 650);
      } else this.fx(lane, { k: 'boost', d: 2.6 });
    } else if (item === 'swap') {
      const ahead = [0, 1, 2, 3, 4, 5, 6, 7].filter((l) => alive(l) && game.geese[l].x > g.x)
        .sort((a, b) => game.geese[a].x - game.geese[b].x);
      if (ahead.length) {
        const l2 = ahead[0];
        const x1 = g.x, x2 = game.geese[l2].x;
        to = [l2];
        this.fx(lane, { k: 'tp', x: x2 });
        this.fx(l2, { k: 'tp', x: x1 });
        r.stats.hits++;
      } else this.fx(lane, { k: 'boost', d: 2.6 });
    }
    this.broadcast({ type: 'ev', k: 'item', item, from: lane, to });
  }

  // ---------------------------------------------------------------- bots
  botThink(lane, g, dt, t, cu) {
    const game = this.game;
    const r = game.racers[lane];
    if (!r.ai) {
      const sk = r.bot ? r.skill : 0.45;
      r.ai = { cad: 4.4 + sk * 2.0, next: 0, plan: {}, sk, useAt: null, phase: rnd() * 6 };
    }
    const ai = r.ai;
    const th = S.THEMES[game.theme];
    if (S.canRun(g)) {
      ai.next -= dt;
      if (ai.next <= 0) {
        S.stepFoot(g, g.foot === 1 ? 2 : 1, th, cu);
        const wave = 1 + 0.12 * Math.sin(t * 0.7 + ai.phase);
        const cad = g.fin ? 2.5 : ai.cad * wave;
        ai.next = 1 / (cad * (0.85 + rnd() * 0.3));
      }
    }
    const d = S.nextHazard(g, game.course, t);
    if (d < Math.max(0.35, g.vx * 0.2 + 0.2) && d > -0.15) {
      const key = Math.round((g.x + d) * 4);
      if (ai.plan[key] == null) ai.plan[key] = rnd() < 0.55 + ai.sk * 0.4;
      if (ai.plan[key]) S.flap(g);
    }
    if (r.held && ai.useAt != null && t >= ai.useAt) this.useItem(lane);
    if (r.held && ai.useAt == null) ai.useAt = t + 1.5 + rnd() * 3;
  }

  // ---------------------------------------------------------------- surprise events
  startEvent(ev, t) {
    const game = this.game;
    ev.done = true;
    if (ev.k === 'reflex') {
      for (const g of game.geese) if (g) g.frozen = true;
      game.reflex = { ph: 'wait', goAt: Date.now() + 2200 + rnd() * 2200, res: {} };
      this.broadcast({ type: 'ev', k: 'reflex', ph: 'wait' });
    } else if (ev.k === 'bread') {
      this.broadcast({ type: 'ev', k: 'bread', seed: Math.floor(rnd() * 1e6) });
      for (let l = 0; l < S.LANES; l++) if (game.geese[l] && this.isAuto(l)) game.geese[l].boost = 2.6;
    } else if (ev.k === 'eggs') {
      this.broadcast({ type: 'ev', k: 'eggs' });
      for (let l = 0; l < S.LANES; l++) if (game.geese[l] && this.isAuto(l)) this.giveItem(l);
    } else if (ev.k === 'farmer') {
      const xs = game.geese.filter((g) => g && !g.fin).map((g) => g.x);
      if (!xs.length) return;
      game.farmer = { x: Math.min(...xs) - 10, v: 8.6, until: t + 8.5, hit: {}, leaving: false };
      this.broadcast({ type: 'ev', k: 'farmer' });
    }
  }

  tickReflex() {
    const game = this.game;
    const rf = game.reflex;
    if (!rf) return;
    const now = Date.now();
    if (rf.ph === 'wait' && now >= rf.goAt) {
      rf.ph = 'go';
      rf.goRealAt = now;
      this.broadcast({ type: 'ev', k: 'reflex', ph: 'go' });
      for (let l = 0; l < S.LANES; l++) {
        const g = game.geese[l];
        if (!g || !this.isAuto(l)) continue;
        const ms = Math.round(260 + rnd() * 420);
        rf.res[l] = ms;
        setTimeout(() => { g.frozen = false; }, ms);
      }
    } else if (rf.ph === 'go' && now >= rf.goRealAt + 2600) {
      rf.ph = 'done';
      const list = Object.entries(rf.res).map(([l, ms]) => ({ lane: +l, ms })).sort((a, b) => {
        if (a.ms < 0) return 1;
        if (b.ms < 0) return -1;
        return a.ms - b.ms;
      });
      const boosts = [3.6, 2.8, 2.2];
      let n = 0;
      for (const e of list) {
        const r = game.racers[e.lane];
        if (e.ms < 0) { this.fx(e.lane, { k: 'stun', d: 1.1, why: 'early' }); continue; }
        if (!r.stats.reflexMs || e.ms < r.stats.reflexMs) r.stats.reflexMs = e.ms;
        this.fx(e.lane, { k: 'boost', d: boosts[n] || 1.3 });
        n++;
      }
      for (const g of game.geese) if (g) g.frozen = false;
      this.broadcast({ type: 'ev', k: 'reflex', ph: 'res', list });
      game.reflex = null;
    }
  }

  tickFarmer(t, dt) {
    const game = this.game;
    const fm = game.farmer;
    if (!fm) return;
    const prev = fm.x;
    fm.x += fm.v * dt;
    const alive = game.geese.filter((g) => g && !g.fin);
    const maxX = alive.length ? Math.max(...alive.map((g) => g.x)) : fm.x;
    if (!fm.leaving && (t > fm.until || fm.x > maxX + 6)) {
      fm.leaving = true;
      this.broadcast({ type: 'ev', k: 'farmerEnd' });
    }
    if (fm.leaving) {
      fm.v = 11;
      if (fm.x > maxX + 40 || t > fm.until + 5) game.farmer = null;
      return;
    }
    for (let l = 0; l < S.LANES; l++) {
      const g = game.geese[l];
      if (!g || g.fin || fm.hit[l] || g.yeet > 0) continue;
      if (fm.x >= g.x - 0.35 && prev < g.x + 0.8) {
        fm.hit[l] = true;
        game.racers[l].stats.yeets++;
        this.fx(l, { k: 'yeet', d: 12 + rnd() * 3 });
        this.broadcast({ type: 'ev', k: 'smack', lane: l });
      }
    }
  }

  // ---------------------------------------------------------------- main tick (called for every room by server.js)
  tick(now) {
    const game = this.game;
    const dt = Math.min(0.1, (now - game.lastTick) / 1000);
    game.lastTick = now;
    if (game.phase !== 'race') return;
    const t = (now - game.startAt) / 1000;
    if (t < 0) return;
    const th = S.THEMES[game.theme];
    const course = game.course;

    const alive = game.geese.filter((g) => g && !g.fin);
    const leadX = Math.max(0, ...game.geese.filter(Boolean).map((g) => g.x));
    const cus = game.geese.map((g) => (g ? 1 + Math.min(1, Math.max(0, (leadX - g.x) / 35)) * 0.24 : 1));

    for (let l = 0; l < S.LANES; l++) {
      const g = game.geese[l];
      if (!g || !this.isAuto(l)) continue;
      const r = game.racers[l];
      for (let s = 0; s < 2; s++) {
        const sdt = dt / 2;
        this.botThink(l, g, sdt, t, cus[l]);
        const out = [];
        S.simGoose(g, sdt, th, course, cus[l], t, out);
        for (const e of out) {
          if (e.e === 'fin') this.recordFinish(l, e.t);
          else if (e.e === 'egg') this.giveItem(l);
          else if (e.e === 'bonk') { r.stats.bonks++; this.broadcast({ type: 'ev', k: 'pk', lane: l, i: e.i, kind: 'knock' }); }
          else if (e.e === 'food') { r.stats.food++; this.broadcast({ type: 'ev', k: 'pk', lane: l, i: e.i, kind: 'take' }); }
          else if (e.e === 'dunk') r.stats.dunks++;
          else if (e.e === 'bike') r.stats.bikes++;
          else if (e.e === 'tramp') { r.stats.tramps++; this.broadcast({ type: 'ev', k: 'pk', lane: l, i: e.i, kind: 'knock' }); }
        }
      }
      g.flags = S.packFlags(g) | (r.bot ? S.F.bot : 0);
    }

    for (const ev of game.events) {
      if (!ev.done && t >= ev.at && !game.reflex && !game.farmer && game.firstFinT == null && alive.length) this.startEvent(ev, t);
    }
    this.tickReflex();
    this.tickFarmer(t, dt);

    const humansRacing = game.racers.filter((r, l) => r && !r.bot && r.connected && game.geese[l] && !game.geese[l].fin);
    const anyHuman = game.racers.some((r) => r && !r.bot);
    if ((!humansRacing.length || !alive.length) && !game.endAt && (anyHuman || !alive.length)) game.endAt = now + 2600;
    if (game.firstFinT != null && t > game.firstFinT + TIMING.HURRY_S && !game.endAt) game.endAt = now;
    if (t > 170 && !game.endAt) game.endAt = now;

    this.broadcast({
      type: 'snap', t: Math.round(t * 1000) / 1000,
      g: game.geese.map((g, l) => (g ? [r2(g.x), r2(g.z), r2(g.vx), g.flags | 0, r2(cus[l]), Math.round((this.isAuto(l) ? t : g.ts ?? t) * 1000) / 1000] : null)),
      fm: game.farmer ? r2(game.farmer.x) : null,
      left: game.firstFinT != null ? Math.max(0, Math.ceil(game.firstFinT + TIMING.HURRY_S - t)) : null,
    });

    if (game.endAt && now >= game.endAt) this.endRace();
  }

  // ---------------------------------------------------------------- messages
  onMessage(ws, m) {
    const game = this.game;
    const p = ws.pid ? this.players.get(ws.pid) : null;
    const isHost = p && p.id === this.hostId();
    switch (m.type) {
      case 'hello': this.onHello(ws, m); break;
      case 'hat': if (p) {
        const i = S.HATS.indexOf(p.hat);
        p.hat = S.HATS[(i + 1) % S.HATS.length];
        if (game.racers[p.lane] === p) this.broadcast({ type: 'ev', k: 'hat', lane: p.lane, hat: p.hat });
        this.broadcastLobby();
      } break;
      case 'bots': if (isHost && game.phase === 'lobby') { game.fillBots = !!m.on; this.broadcastLobby(); } break;
      case 'lock': if (isHost && game.phase === 'lobby') { this.locked = !!m.on; this.broadcastLobby(); } break;
      case 'start': if (isHost && game.phase === 'lobby') this.startGame(); break;
      case 'again': if (isHost && game.phase === 'final') this.backToLobby(); break;
      case 'kick': if (isHost && game.phase === 'lobby' && m.id !== p.id) {
        const victim = this.players.get(m.id);
        if (!victim) break;
        this.players.delete(victim.id);
        if (victim.ws) {
          send(victim.ws, { type: 'kicked', by: p.name });
          victim.ws.pid = null; // keep the socket (they still see the lobby status) but it no longer controls a goose
        }
        this.broadcastLobby();
      } break;
      case 'skip': if (isHost && game.phase === 'results') {
        clearTimeout(game.timer);
        if (game.round >= S.ROUNDS.length - 1) this.finalScreen(); else { game.round++; this.startRound(); }
      } break;
      case 'honk': if (p) {
        const now = Date.now();
        if (now - (p.lastHonk || 0) < 250) break;
        p.lastHonk = now;
        if (p.stats) p.stats.honks++;
        this.broadcast({ type: 'ev', k: 'honk', lane: p.lane, id: p.id });
      } break;
      default: if (p) this.onRaceMsg(ws, p, m);
    }
  }

  onHello(ws, m) {
    const game = this.game;
    if (m.tv) {
      ws.tv = true;
      send(ws, { type: 'welcome', spectator: true, tv: true, room: this.code });
      this.broadcastLobby();
      this.sendCurrentPhase(ws, null);
      return;
    }
    let p = typeof m.id === 'string' ? this.players.get(m.id) : null;
    if (p) {
      if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch {} }
      p.ws = ws; p.connected = true;
      const nm = cleanName(m.name);
      if (nm) p.name = nm;
    } else {
      if (this.locked && game.phase === 'lobby') { send(ws, { type: 'locked' }); return; }
      const lane = this.freeLane();
      if (lane == null) {
        send(ws, { type: 'welcome', spectator: true, full: true, room: this.code });
        send(ws, this.lobbyMsg());
        this.sendCurrentPhase(ws, null);
        return;
      }
      const usedHats = new Set([...this.players.values()].map((q) => q.hat));
      const freeHats = S.HATS.filter((h) => !usedHats.has(h));
      p = {
        id: crypto.randomBytes(8).toString('hex'),
        name: cleanName(m.name) || pick(['Sir Honksalot', 'Lady Gooseworth', 'Captain Beak', 'Waddles', 'Goosinator', 'Honkette']),
        lane, hat: freeHats.length ? pick(freeHats) : pick(S.HATS), ws, connected: true, joinedAt: ++this.joinCounter,
        pending: game.phase !== 'lobby', score: 0, stats: newStats(), held: null,
      };
      this.players.set(p.id, p);
    }
    ws.pid = p.id;
    send(ws, { type: 'welcome', id: p.id, lane: p.lane, name: p.name, hat: p.hat, pending: !!p.pending, room: this.code });
    this.broadcastLobby();
    this.sendCurrentPhase(ws, p);
  }

  onRaceMsg(ws, p, m) {
    const game = this.game;
    if (game.phase !== 'race' || game.racers[p.lane] !== p) return;
    const lane = p.lane;
    const g = game.geese[lane];
    const now = Date.now();
    const t = (now - game.startAt) / 1000;
    switch (m.type) {
      case 's': {
        if (typeof m.x !== 'number' || !isFinite(m.x)) return;
        // Client-authoritative movement, but no faster than a goose can possibly go (boost + wings + trampoline),
        // except right after the server itself moved the goose (farmer yeet, swap).
        const elapsed = Math.max(0.05, (now - (g.repAt || now)) / 1000);
        const maxStep = (S.THEMES[game.theme].maxV * 1.25 + 5) * elapsed * 1.5 + 0.5;
        const exempt = g.exemptUntil > now;
        const from = g.repX || 0;
        g.x = exempt ? m.x : Math.max(from - 4, Math.min(m.x, from + maxStep));
        g.repX = g.x; g.repAt = now;
        g.z = Math.max(0, Math.min(6, +m.z || 0)); g.vx = Math.max(-5, Math.min(25, +m.vx || 0)); g.flags = m.f & 0xffff;
        g.ts = typeof m.t === 'number' && isFinite(m.t) ? Math.min(m.t, t + 0.3) : t;
        g.stun = 0; g.yeet = 0; g.dunk = 0;
        break;
      }
      case 'fin':
        // only believe a finish from a goose we have actually seen near the line
        if (!g.fin && g.x >= game.course.len - 1.5) this.recordFinish(lane, Math.max(0, Math.min(t + 0.3, +m.t || t)));
        break;
      case 'egg': this.giveItem(lane); break;
      case 'use': this.useItem(lane); break;
      case 'reflex': {
        const rf = game.reflex;
        if (!rf || rf.res[lane] != null) return;
        if (rf.ph === 'wait') rf.res[lane] = -1;
        else if (rf.ph === 'go') rf.res[lane] = Math.max(80, Math.min(3000, m.ms | 0));
        break;
      }
      case 'stat': if (typeof m.k === 'string' && p.stats[m.k] != null && m.k !== 'reflexMs' && m.k !== 'wins') p.stats[m.k]++; break;
      case 'pk':
        if (Number.isInteger(m.i) && (m.kind === 'take' || m.kind === 'knock')) this.broadcastExcept(ws, { type: 'ev', k: 'pk', lane, i: m.i, kind: m.kind });
        break;
    }
  }
}
