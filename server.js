import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { Room, send } from './server/room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3333;
const PROD = process.env.NODE_ENV === 'production';
const TICK_MS = 50;

const envInt = (k, d) => (Number.isFinite(Number(process.env[k])) && process.env[k] !== '' && process.env[k] != null ? Number(process.env[k]) : d);
const LIMITS = {
  rooms: envInt('GOOSY_MAX_ROOMS', 300),                    // total rooms on this machine
  socketsPerIp: envInt('GOOSY_SOCKETS_PER_IP', 60),         // a whole party / campus can share one IP
  createPer10MinPerIp: envInt('GOOSY_CREATE_LIMIT', 15),    // room creation (raise temporarily for load tests)
  missesPer10MinPerIp: 40,    // looking up codes that don't exist (guessing)
  msgBurst: 120, msgPerSec: 60, // per-socket token bucket
  roomIdleMs: 5 * 60 * 1000,  // delete rooms nobody has been in for this long
};

// Room codes: 5 chars without look-alikes (no I, O, 0, 1) → ~33 million combinations.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function lanIP() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254')) return a.address;
    }
  }
  return 'localhost';
}
const BASE_URL = (process.env.PUBLIC_URL || `http://${lanIP()}:${PORT}`).replace(/\/$/, '');
const ALLOWED_ORIGINS = new Set([BASE_URL, ...(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)]);

// A browser WebSocket must come from a page on this same site (blocks other websites from driving the game).
function originOk(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (tests, curl) don't send one
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return new URL(origin).host === host;
  } catch { return false; }
}

function log(msg) { console.log(`${new Date().toISOString()} ${msg}`); }

function baseUrlFor(req) {
  if (process.env.PUBLIC_URL) return BASE_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  if (!host || /^(localhost|127\.|\[::1\])/.test(host)) return BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

function clientIp(req) {
  return String(req.headers['fly-client-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '?').trim();
}

// Fixed-window counters per IP (creation, failed lookups).
const windows = new Map();
function hit(kind, ip, max) {
  const key = kind + ':' + ip;
  const now = Date.now();
  let w = windows.get(key);
  if (!w || now - w.start > 10 * 60 * 1000) { w = { start: now, n: 0 }; windows.set(key, w); }
  w.n++;
  return w.n <= max;
}
setInterval(() => { const now = Date.now(); for (const [k, w] of windows) if (now - w.start > 10 * 60 * 1000) windows.delete(k); }, 60 * 1000).unref();

// ---------------------------------------------------------------- rooms
const rooms = new Map();

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let c = '';
    const bytes = crypto.randomBytes(5);
    for (const b of bytes) c += ALPHABET[b % ALPHABET.length];
    if (!rooms.has(c)) return c;
  }
  return null;
}
function createRoom(code) {
  if (rooms.size >= LIMITS.rooms) return null;
  const room = new Room(code, log);
  rooms.set(code, room);
  log(`[${code}] room created (${rooms.size} rooms)`);
  return room;
}

let slowWarnAt = 0;
setInterval(() => {
  const now = Date.now();
  const t0 = performance.now();
  for (const room of rooms.values()) {
    try { room.tick(now); } catch (e) { log(`[${room.code}] tick error: ${e.stack || e}`); }
  }
  const ms = performance.now() - t0;
  if (ms > 25 && now - slowWarnAt > 10000) { slowWarnAt = now; log(`slow tick: ${ms.toFixed(1)} ms for ${rooms.size} rooms, ${wss.clients.size} sockets`); }
}, TICK_MS);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    try {
      if (room.game.phase === 'lobby' || room.game.phase === 'final') room.pruneDisconnected(45000);
    } catch (e) { log(`[${code}] prune error: ${e.stack || e}`); }
    if (!room.sockets.size && now - room.emptySince > LIMITS.roomIdleMs) {
      room.destroy();
      rooms.delete(code);
      log(`[${code}] room closed (idle) (${rooms.size} rooms)`);
    }
  }
}, 5000).unref();

// ---------------------------------------------------------------- static files
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt']);
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  // inline style *attributes* are used for per-goose colours; no inline scripts anywhere
  'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

// File cache keyed by mtime: ETag + pre-gzipped body. Phones revalidate (no-cache) so a deploy is picked up
// on the next load, including ES module imports.
const fileCache = new Map();
function loadFile(file) {
  const st = fs.statSync(file);
  if (!st.isFile()) throw new Error('not a file');
  const hitC = fileCache.get(file);
  if (hitC && hitC.mtime === st.mtimeMs) return hitC;
  const raw = fs.readFileSync(file);
  const ext = path.extname(file);
  const entry = {
    mtime: st.mtimeMs, raw, ext,
    etag: '"' + crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 20) + '"',
    gz: COMPRESSIBLE.has(ext) ? zlib.gzipSync(raw, { level: 9 }) : null,
  };
  fileCache.set(file, entry);
  return entry;
}

function serveFile(req, res, rel) {
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  let f;
  try { f = loadFile(file); } catch { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
  const headers = { ...SECURITY_HEADERS, 'content-type': MIME[f.ext] || 'application/octet-stream', 'cache-control': 'no-cache', etag: f.etag, vary: 'accept-encoding' };
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, headers); return res.end(); }
  const gzipOk = f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gzipOk) headers['content-encoding'] = 'gzip';
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : gzipOk ? f.gz : f.raw);
}

function json(res, status, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }

    if (p === '/healthz') return json(res, 200, { ok: true, rooms: rooms.size, sockets: wss.clients.size });

    if (p === '/api/rooms' && req.method === 'POST') {
      if (!hit('create', clientIp(req), LIMITS.createPer10MinPerIp)) return json(res, 429, { error: 'slow down' });
      const code = rooms.size < LIMITS.rooms ? newCode() : null;
      if (!code) return json(res, 503, { error: 'busy' });
      createRoom(code);
      return json(res, 201, { code });
    }

    if (p === '/qr.svg' || p === '/info') {
      const code = normCode(url.searchParams.get('room'));
      const target = CODE_RE.test(code) ? `${baseUrlFor(req)}/r/${code}` : baseUrlFor(req);
      if (p === '/info') return json(res, 200, { url: target });
      const svg = await QRCode.toString(target, { type: 'svg', margin: 1, color: { dark: '#1d1238', light: '#ffffff' } });
      res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
      return res.end(svg);
    }

    if (p === '/') return serveFile(req, res, '/landing.html');
    if (p === '/tv' || p === '/tv/') { res.writeHead(302, { location: '/' }); return res.end(); }
    const m = p.match(/^\/r\/([^/]+)(\/tv)?\/?$/);
    if (m) {
      const code = normCode(m[1]);
      if (m[1] !== code) { res.writeHead(302, { location: `/r/${code}${m[2] || ''}` }); return res.end(); }
      return serveFile(req, res, m[2] ? '/tv.html' : '/index.html');
    }
    if (p.endsWith('.html')) { res.writeHead(404); return res.end('Not found'); }
    return serveFile(req, res, p);
  } catch (e) {
    log(`http error ${req.url}: ${e.stack || e}`);
    try { res.writeHead(500); res.end(); } catch {}
  }
});

// ---------------------------------------------------------------- sockets
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const socketsPerIp = new Map();

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  if (!originOk(req)) { ws.close(1008, 'origin'); return; }
  const n = (socketsPerIp.get(ip) || 0) + 1;
  if (n > LIMITS.socketsPerIp) { ws.close(1013, 'too many connections'); return; }
  socketsPerIp.set(ip, n);
  ws.ip = ip;
  ws.alive = true;
  ws.bucket = LIMITS.msgBurst;
  ws.bucketAt = Date.now();
  ws.drops = 0;

  const code = normCode(new URL(req.url, 'http://x').searchParams.get('room'));
  const validCode = CODE_RE.test(code);
  const existing = validCode ? rooms.get(code) : null;
  if (existing) existing.attach(ws);
  else {
    ws.wantCode = validCode ? code : null;
    if (!hit('miss', ip, LIMITS.missesPer10MinPerIp)) { send(ws, { type: 'noroom', limited: true }); ws.close(1008, 'slow down'); return; }
    send(ws, { type: 'noroom' });
  }

  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf) => {
    // token bucket: ~60 msgs/s sustained; persistent flooding closes the socket
    const now = Date.now();
    ws.bucket = Math.min(LIMITS.msgBurst, ws.bucket + ((now - ws.bucketAt) / 1000) * LIMITS.msgPerSec);
    ws.bucketAt = now;
    if (ws.bucket < 1) { if (++ws.drops > 300) ws.close(1008, 'flood'); return; }
    ws.bucket -= 1;

    let m;
    try { m = JSON.parse(buf); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
    if (m.type === 'ping') { send(ws, { type: 'pong', c: m.c, s: Date.now() }); return; }

    let room = ws.room;
    if (!room) {
      // Unknown code: only someone who was already in this room (e.g. before a server restart/deploy) may bring
      // it back. Random codes never conjure rooms.
      if (m.type !== 'hello' || !m.rejoin || !ws.wantCode) { if (m.type === 'hello') send(ws, { type: 'noroom' }); return; }
      if (!hit('create', ip, LIMITS.createPer10MinPerIp)) { send(ws, { type: 'noroom', limited: true }); return; }
      room = rooms.get(ws.wantCode) || createRoom(ws.wantCode);
      if (!room) { send(ws, { type: 'busy' }); return; }
      room.attach(ws);
    }
    try { room.onMessage(ws, m); } catch (e) { log(`[${room.code}] message error (${m.type}): ${e.stack || e}`); }
  });
  ws.on('close', () => {
    const left = (socketsPerIp.get(ip) || 1) - 1;
    if (left > 0) socketsPerIp.set(ip, left); else socketsPerIp.delete(ip);
    if (ws.room) { try { ws.room.detach(ws); } catch (e) { log(`[${ws.room.code}] detach error: ${e.stack || e}`); } }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    try { ws.ping(); } catch {}
  }
}, 10000).unref();

process.on('uncaughtException', (e) => log(`uncaught: ${e.stack || e}`));
process.on('unhandledRejection', (e) => log(`unhandled rejection: ${e && e.stack || e}`));

// Deploys: stop taking connections and let phones reconnect to the new machine; their room is re-created on hello.
function shutdown(sig) {
  log(`${sig}: shutting down (${rooms.size} rooms, ${wss.clients.size} sockets)`);
  server.close();
  for (const ws of wss.clients) { try { ws.close(1012, 'restarting'); } catch {} }
  setTimeout(() => process.exit(0), 800).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', async () => {
  log(`Goosy Race listening on :${PORT} (${PROD ? 'production' : 'dev'})`);
  if (!PROD) {
    console.log('\n  🪿  GOOSY RACE is running!\n');
    console.log(`  Open on your phone:  ${BASE_URL}`);
    console.log('  Create a room, then share the link or show the QR code on a big screen.\n');
    try { console.log(await QRCode.toString(BASE_URL, { type: 'terminal', small: true })); } catch {}
  }
});
