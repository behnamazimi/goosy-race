// End-to-end: a real server (fast mode) with scripted phones. Checks that rooms are isolated and that the
// lobby controls, anti-cheat and restart recovery work.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, createRoom, Phone, sleep } from './helpers.mjs';

const PORT = 41000 + Math.floor(Math.random() * 2000);
let srv;
const phones = [];
const phone = (room, name) => { const p = new Phone(PORT, room, name); phones.push(p); return p; };
const join = async (p, extra = {}) => { await p.opened; p.send({ type: 'hello', name: p.name, ...extra }); return p.waitFor((m) => m.type === 'welcome', 5000, 'welcome'); };

before(async () => { srv = await startServer(PORT); });
after(async () => { for (const p of phones) p.close(); await stopServer(srv); });

test('two rooms play full games at the same time without seeing each other', { timeout: 120000 }, async () => {
  const [A, B] = [await createRoom(srv.base), await createRoom(srv.base)];
  assert.notEqual(A, B);
  const a1 = phone(A, 'Anna'), a2 = phone(A, 'Aart'), b1 = phone(B, 'Bea'), b2 = phone(B, 'Bram');
  for (const p of [a1, a2, b1, b2]) await join(p);

  const lobbyA = await a2.waitFor((m) => m.type === 'lobby' && m.players.length === 2, 5000, 'lobby A with 2');
  assert.equal(lobbyA.room, A);
  assert.deepEqual(lobbyA.players.map((p) => p.name).sort(), ['Aart', 'Anna']);
  assert.equal(lobbyA.hostId, a1.id, 'first joiner hosts');

  for (const p of [a1, a2, b1, b2]) p.autoRace(6 + Math.random() * 2);
  a1.send({ type: 'start' });
  b1.send({ type: 'start' });

  const [finA, finB] = await Promise.all([
    a1.waitFor((m) => m.type === 'final', 110000, 'final A'),
    b1.waitFor((m) => m.type === 'final', 110000, 'final B'),
  ]);
  const namesA = finA.standings.filter((s) => !s.bot).map((s) => s.name).sort();
  const namesB = finB.standings.filter((s) => !s.bot).map((s) => s.name).sort();
  assert.deepEqual(namesA, ['Aart', 'Anna']);
  assert.deepEqual(namesB, ['Bea', 'Bram']);
  assert.equal(finA.standings.length, 8, 'bots fill the empty lanes');
  assert.equal(Object.keys(finA.awards).length, 8, 'everyone gets an award');

  for (const [p, room] of [[a1, A], [a2, A], [b1, B], [b2, B]]) {
    const foreign = p.msgs.filter((m) => (m.type === 'lobby' || m.type === 'welcome') && m.room && m.room !== room);
    assert.equal(foreign.length, 0, `${p.name} only ever hears about room ${room}`);
    const racers = p.msgs.filter((m) => m.type === 'phase' && m.phase === 'race').flatMap((m) => m.racers.filter((r) => r && !r.bot).map((r) => r.name));
    for (const n of racers) assert.ok((room === A ? namesA : namesB).includes(n), `${p.name} never races against ${n}`);
  }
  for (const p of [a1, a2, b1, b2]) p.close();
});

test('unknown codes do not create rooms; a returning player can bring one back', async () => {
  const ghost = phone('QQQQQ', 'Ghost');
  await ghost.opened;
  await ghost.waitFor((m) => m.type === 'noroom', 3000, 'noroom');
  ghost.send({ type: 'hello', name: 'Ghost' });
  await sleep(200);
  assert.ok(!ghost.msgs.some((m) => m.type === 'welcome'), 'a random visitor cannot conjure a room');
  const health = await (await fetch(`${srv.base}/healthz`)).json();

  const back = phone('QQQQQ', 'Returning');
  const w = await join(back, { id: 'someoldid', rejoin: true });
  assert.equal(w.room, 'QQQQQ');
  const health2 = await (await fetch(`${srv.base}/healthz`)).json();
  assert.equal(health2.rooms, health.rooms + 1);
  ghost.close(); back.close();
});

test('host can lock the room and kick players', async () => {
  const R = await createRoom(srv.base);
  const host = phone(R, 'Host'), guest = phone(R, 'Guest');
  await join(host); await join(guest);
  host.send({ type: 'kick', id: guest.id });
  await guest.waitFor((m) => m.type === 'kicked', 3000, 'kicked');
  host.send({ type: 'lock', on: true });
  await host.waitFor((m) => m.type === 'lobby' && m.locked, 3000, 'locked lobby');
  const late = phone(R, 'Late');
  await late.opened;
  late.send({ type: 'hello', name: 'Late' });
  await late.waitFor((m) => m.type === 'locked', 3000, 'locked reply');
  // a non-host cannot unlock
  guest.send({ type: 'hello', name: 'Guest' });
  await sleep(150);
  guest.send({ type: 'lock', on: false });
  await sleep(150);
  const last = host.msgs.filter((m) => m.type === 'lobby').at(-1);
  assert.equal(last.locked, true);
  for (const p of [host, guest, late]) p.close();
});

test('teleporting and fake finishes are ignored', { timeout: 30000 }, async () => {
  const R = await createRoom(srv.base);
  const cheat = phone(R, 'Cheater');
  await join(cheat);
  cheat.send({ type: 'start' });
  const race = await cheat.waitFor((m) => m.type === 'phase' && m.phase === 'race', 5000, 'race');
  const lane = race.racers.findIndex((r) => r && r.name === 'Cheater');
  await sleep(Math.max(0, race.startAt - Date.now()) + 300);
  cheat.send({ type: 's', t: 0.3, x: 999, z: 0, vx: 99, f: 0 });
  cheat.send({ type: 'fin', t: 0.4 });
  await sleep(300);
  const snap = cheat.msgs.filter((m) => m.type === 'snap').at(-1);
  assert.ok(snap.g[lane][0] < 20, `position capped (got ${snap.g[lane][0]})`);
  assert.ok(!cheat.msgs.some((m) => m.type === 'ev' && m.k === 'fin' && m.lane === lane), 'fake finish rejected');
  cheat.close();
});

test('after a server restart, players land back in the same room', { timeout: 30000 }, async () => {
  const R = await createRoom(srv.base);
  const p = phone(R, 'Sticky');
  await join(p);
  const oldId = p.id;
  p.close();
  await stopServer(srv);
  srv = await startServer(PORT);
  const again = phone(R, 'Sticky');
  await again.opened;
  await again.waitFor((m) => m.type === 'noroom', 3000, 'noroom after restart');
  const w = await join(again, { id: oldId, rejoin: true });
  assert.equal(w.room, R);
  const lobby = await again.waitFor((m) => m.type === 'lobby' && m.players.length === 1, 3000, 'lobby');
  assert.equal(lobby.hostId, again.id);
  again.close();
});
