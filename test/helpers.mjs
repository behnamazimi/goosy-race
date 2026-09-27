// Test helpers: boot a real server in fast mode and drive it with scripted phones.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function startServer(port, env = {}) {
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), GOOSY_FAST: '1', NODE_ENV: 'test', ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.logs = '';
  proc.stdout.on('data', (d) => { proc.logs += d; });
  proc.stderr.on('data', (d) => { proc.logs += d; });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return { proc, base, port }; } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  proc.kill();
  throw new Error('server did not start:\n' + proc.logs);
}

export async function stopServer(srv) {
  if (!srv || srv.proc.exitCode != null) return;
  await new Promise((r) => { srv.proc.once('exit', r); srv.proc.kill('SIGTERM'); });
}

export async function createRoom(base) {
  const r = await fetch(`${base}/api/rooms`, { method: 'POST' });
  const j = await r.json();
  if (!r.ok) throw new Error('create failed ' + r.status);
  return j.code;
}

export class Phone {
  constructor(port, room, name) {
    this.name = name;
    this.room = room;
    this.msgs = [];
    this.waiters = [];
    this.ws = new WebSocket(`ws://localhost:${port}/ws?room=${room}`);
    this.opened = new Promise((res, rej) => { this.ws.once('open', res); this.ws.once('error', rej); });
    this.ws.on('message', (d) => {
      const m = JSON.parse(d);
      this.msgs.push(m);
      if (m.type === 'welcome' && m.id) this.id = m.id;
      if (m.type === 'phase' && m.phase === 'race') this.race = m;
      if (m.type === 'item') setTimeout(() => this.send({ type: 'use' }), 200);
      this.waiters = this.waiters.filter((w) => !(w.pred(m) && (w.res(m), true)));
    });
  }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  waitFor(pred, ms = 20000, label = 'message') {
    const found = this.msgs.find(pred);
    if (found) return Promise.resolve(found);
    return new Promise((res, rej) => {
      const w = { pred, res: (m) => { clearTimeout(timer); res(m); } };
      const timer = setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); rej(new Error(`${this.name}: timed out waiting for ${label}`)); }, ms);
      this.waiters.push(w);
    });
  }
  // Runs like an honest phone: steady speed, reports position with a timestamp, finishes at the line.
  autoRace(speed = 7) {
    clearInterval(this.racer);
    let x = 0, seed = null, fin = false;
    this.racer = setInterval(() => {
      const r = this.race;
      if (!r) return;
      if (r.seed !== seed) { seed = r.seed; x = 0; fin = false; }
      const t = (Date.now() - r.startAt) / 1000;
      if (t < 0 || fin) return;
      x += speed * 0.05;
      this.send({ type: 's', t, x, z: 0, vx: speed, f: 0 });
      if (x >= r.len) { fin = true; this.send({ type: 'fin', t }); }
    }, 50);
  }
  close() { clearInterval(this.racer); try { this.ws.close(); } catch {} }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
