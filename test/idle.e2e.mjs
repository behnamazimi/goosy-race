// End-to-end: idle rooms fall asleep (even with screens still open) and can be woken; per-room socket cap.
// Uses tiny limits so it runs in seconds.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, createRoom, Phone, sleep } from './helpers.mjs';

const PORT = 43000 + Math.floor(Math.random() * 2000);
const SLEEP_MS = 1500;
let srv;
const phones = [];
const phone = (room, name) => { const p = new Phone(PORT, room, name); phones.push(p); return p; };
const join = async (p, extra = {}) => { await p.opened; p.send({ type: 'hello', name: p.name, ...extra }); return p.waitFor((m) => m.type === 'welcome', 5000, 'welcome'); };
const rooms = async () => (await (await fetch(`${srv.base}/healthz`)).json()).rooms;

before(async () => { srv = await startServer(PORT, { GOOSY_IDLE_CLOSE_MS: String(SLEEP_MS), GOOSY_SOCKETS_PER_ROOM: '3' }); });
after(async () => { for (const p of phones) p.close(); await stopServer(srv); });

test('an idle room falls asleep even with a screen open, and can be woken', async () => {
  const R = await createRoom(srv.base);
  const p = phone(R, 'Dozy');
  await join(p);
  const before = await rooms();
  await p.waitFor((m) => m.type === 'sleep', SLEEP_MS + 4000, 'sleep');
  await sleep(200);
  assert.equal(p.closeCode, 4000, 'server hung up with the "asleep" code');
  assert.equal(await rooms(), before - 1, 'room removed from memory');

  const again = phone(R, 'Dozy');
  const w = await join(again, { id: p.id, rejoin: true });
  assert.equal(w.room, R, 'waking brings the same room code back');
  again.close();
});

test('gameplay activity keeps a room awake', async () => {
  const R = await createRoom(srv.base);
  const p = phone(R, 'Busy');
  await join(p);
  const honker = setInterval(() => p.send({ type: 'honk' }), 400);
  await sleep(SLEEP_MS * 2.5);
  clearInterval(honker);
  assert.ok(!p.msgs.some((m) => m.type === 'sleep'), 'no sleep while someone is playing');
  await p.waitFor((m) => m.type === 'sleep', SLEEP_MS + 4000, 'sleep once they stop');
  p.close();
});

test('a TV on its own does not keep a room awake', async () => {
  const R = await createRoom(srv.base);
  const tv = phone(R, 'TV');
  await tv.opened;
  tv.send({ type: 'hello', tv: true });
  await tv.waitFor((m) => m.type === 'sleep', SLEEP_MS + 4000, 'sleep');
  tv.close();
});

test('a room accepts a limited number of screens', async () => {
  const R = await createRoom(srv.base);
  const three = [phone(R, 'A'), phone(R, 'B'), phone(R, 'C')];
  for (const p of three) await join(p);
  const fourth = phone(R, 'D');
  await fourth.waitFor((m) => m.type === 'roomfull', 3000, 'roomfull');
  for (const p of [...three, fourth]) p.close();
});
