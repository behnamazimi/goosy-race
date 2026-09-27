// Unit tests for the shared game rules (public/shared/sim.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../public/shared/sim.js';

const tap = (g, th) => S.stepFoot(g, g.foot === 1 ? 2 : 1, th, 1);

test('courses are deterministic for a seed', () => {
  for (const theme of S.ROUNDS) {
    assert.deepEqual(S.makeCourse(theme, 42), S.makeCourse(theme, 42));
  }
});

test('hazards sit at the same spot in every lane (fair like hurdles)', () => {
  for (const theme of S.ROUNDS) {
    const c = S.makeCourse(theme, 7);
    const solids = (lane) => c.lanes[lane].filter((o) => ['solid', 'hole', 'mud', 'tramp'].includes(S.OBS[o.t].kind)).map((o) => `${o.t}@${o.x}`);
    for (let l = 1; l < S.LANES; l++) assert.deepEqual(solids(l), solids(0), `${theme} lane ${l}`);
  }
});

test('a trampoline launches the goose over the obstacle placed after it', () => {
  for (const theme of S.ROUNDS) {
    const th = S.THEMES[theme];
    const c = S.makeCourse(theme, 12345);
    const tramp = c.lanes[0].find((o) => o.t === 'tramp');
    assert.ok(tramp, `${theme} has a trampoline`);
    const g = S.newGoose(0);
    g.x = tramp.x - 3; g.vx = 5.5;
    const events = [];
    for (let f = 0; f < 60 * 1.6; f++) {
      if (f % 10 === 0) tap(g, th);
      const out = [];
      S.simGoose(g, 1 / 60, th, c, 1, 100, out);
      events.push(...out.map((e) => e.e));
    }
    assert.ok(events.includes('tramp'), `${theme}: bounced`);
    assert.ok(!events.includes('bonk'), `${theme}: cleared the ${th.solid} after the trampoline`);
    assert.ok(g.x > tramp.x + 5.5 + 1, `${theme}: landed past it`);
  }
});

test('a goose that only taps (never flaps) still finishes — knocked-over hazards let you through', () => {
  const th = S.THEMES.meadow;
  const c = S.makeCourse('meadow', 99);
  const g = S.newGoose(0);
  let t = 0;
  for (let f = 0; f < 60 * 180 && !g.fin; f++) {
    if (f % 9 === 0) tap(g, th);
    t += 1 / 60;
    S.simGoose(g, 1 / 60, th, c, 1, t, []);
  }
  assert.ok(g.fin, `finished (x=${g.x.toFixed(1)} of ${c.len})`);
});

test('tap blending keeps the same average speed but removes the jolt', () => {
  const th = S.THEMES.meadow;
  const course = { len: 1e9, lanes: [[], [], [], [], [], [], [], []], cross: [] };
  const run = (blend) => {
    const g = S.newGoose(0);
    const vs = [];
    for (let f = 0; f < 60 * 6; f++) {
      if (f % 9 === 0) { tap(g, th); if (!blend) { g.vx += g.pend; g.pend = 0; } }
      S.simGoose(g, 1 / 60, th, course, 1, f / 60, []);
      if (f > 180) vs.push(g.vx);
    }
    const avg = vs.reduce((a, b) => a + b) / vs.length;
    const jolt = Math.max(...vs.slice(1).map((v, i) => Math.abs(v - vs[i]) * 60));
    return { avg, jolt };
  };
  const instant = run(false), blended = run(true);
  assert.ok(Math.abs(blended.avg - instant.avg) / instant.avg < 0.02, 'same average speed');
  assert.ok(blended.jolt < instant.jolt / 3, 'much smaller jolt per tap');
});

test('finish is detected at the course length', () => {
  const c = S.makeCourse('ice', 3, 40);
  const g = S.newGoose(0);
  g.x = 39.9; g.vx = 5;
  const out = [];
  S.simGoose(g, 0.05, S.THEMES.ice, c, 1, 10, out);
  assert.ok(g.fin && out.some((e) => e.e === 'fin'));
});
