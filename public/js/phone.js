import * as S from '../shared/sim.js';
import * as A from './audio.js';
import { Net } from './net.js';
import { Renderer, drawGooseIcon } from './render.js';
import { World } from './world.js';
import * as U from './ui.js';
import { ROOM, fmtCode, roomUrl, bindCodeInput, normCode, createAndGo } from './room.js';

const { $, h, esc } = U;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const cv = $('#cv');
const R = new Renderer(cv);
const net = new Net(onMsg);
const W = new World(R, net);
const stage = $('#stage');
const overlay = $('#overlay');
const panels = $('#panels');

const ID_KEY = `goosy-id:${ROOM}`; // one identity per room

const st = {
  id: store.get(ID_KEY), roomErr: null, name: store.get('goosy-name') || '', lane: null, hat: null,
  joined: false, spectator: false, pending: false, lobby: null,
  mode: 'none', me: null, meSeed: null, racing: false, held: null, myPlace: null, finAt: 0,
  practice: null, lastSend: 0, reflex: null, lastCount: null, introEl: null, yolk: 0,
  hint: 0, goodSteps: 0, flaps: 0, lastPanel: null,
};

// ------------------------------------------------------------------ join screen
const nameIn = $('#nameIn');
if (ROOM) $('.tvlink').href = `/r/${ROOM}/tv`;
// Room code + invite right on the join screen, so whoever created the room can share it immediately.
const freshRoom = new URLSearchParams(location.search).has('new');
if (freshRoom) history.replaceState(null, '', location.pathname);
if (ROOM) {
  $('#roomCodeTxt').textContent = fmtCode(ROOM);
  $('#roomChip').classList.remove('hidden');
  $('#roomChip').classList.toggle('fresh', freshRoom);
}
$('#joinShare').addEventListener('click', () => shareRoom());
bindCodeInput($('#retryCode'));
$('#retryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = normCode($('#retryCode').value);
  if (c.length !== 5) { U.toast('Room codes have 5 characters, like KQ7-PZ'); return; }
  location.href = `/r/${c}`;
});
nameIn.value = st.name;
if (st.id) $('#joinBtn').textContent = 'Waddle back in! 🪿';
const hero = $('#heroGoose');
let heroT = 0;
function heroLoop() {
  if (st.joined) return;
  heroT += 1 / 60;
  const lane = Math.floor(heroT / 1.6) % 8;
  drawGooseIcon(hero, lane, S.HATS[lane % S.HATS.length], { run: 0.8, phase: heroT * 12, t: heroT, honk: (heroT % 1.6) < 0.3 ? 1 : 0 });
  requestAnimationFrame(heroLoop);
}
heroLoop();
let looping = false;

$('#joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (st.roomErr || !ROOM) {
    const err = ROOM_ERRORS[st.roomErr];
    if (err && err.create) {
      const btn = $('#joinBtn');
      btn.disabled = true; btn.textContent = 'Building a pond…';
      createAndGo().then((status) => { if (status) location.href = '/'; }).catch(() => { location.href = '/'; });
    } else location.href = '/';
    return;
  }
  A.unlock();
  A.honk(1, 0.5);
  st.name = nameIn.value.trim().slice(0, 14);
  store.set('goosy-name', st.name);
  st.joined = true;
  $('#join').classList.add('hidden');
  $('#game').classList.remove('hidden');
  R.resize();
  hello();
  wakeLock();
  if (!looping) { looping = true; requestAnimationFrame(frame); }
});
nameIn.addEventListener('focus', () => A.unlock());

// `rejoin` = "I've been in this room before": lets the server bring the room back after a restart or deploy.
function hello() { net.send({ type: 'hello', id: st.id, name: st.name, rejoin: !!st.id }); }
net.onOpen = () => { $('#conn').classList.add('hidden'); if (st.joined) hello(); };
net.onClose = () => { if (st.joined) $('#conn').classList.remove('hidden'); };

let wl = null;
async function wakeLock() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wl = await navigator.wakeLock.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.joined) { wakeLock(); A.unlock(); } });

$('#mute').addEventListener('click', () => {
  A.setMuted(!A.isMuted());
  $('#mute').textContent = A.isMuted() ? '🔇' : '🔊';
});
$('#mute').textContent = A.isMuted() ? '🔇' : '🔊';

// ------------------------------------------------------------------ messages
function leaveToJoinScreen(toast) {
  st.joined = false; st.mode = 'none'; st.me = null; st.racing = false;
  W.reset(); W.meLane = null;
  A.stopMusic();
  $('#game').classList.add('hidden');
  $('#join').classList.remove('hidden');
  renderJoinStatus(st.lobby);
  heroLoop();
  if (toast) U.toast(toast, 4000);
}

function onMsg(m) {
  switch (m.type) {
    case 'noroom':
      // while joined we just re-sent hello with rejoin, which brings the room back; only visitors see this
      if (!st.joined || m.limited) { st.roomErr = m.limited ? 'limited' : 'noroom'; renderJoinStatus(st.lobby); }
      break;
    case 'locked':
      st.roomErr = 'locked';
      if (st.joined) leaveToJoinScreen('🔒 The host locked this room');
      else renderJoinStatus(st.lobby);
      break;
    case 'busy':
      st.roomErr = 'busy';
      if (st.joined) leaveToJoinScreen();
      else renderJoinStatus(st.lobby);
      break;
    case 'kicked': {
      st.joined = false; st.id = null; st.lane = null; st.hat = null; st.practice = null;
      st.mode = 'none'; st.me = null; st.racing = false;
      W.reset(); W.meLane = null;
      try { localStorage.removeItem(ID_KEY); } catch {}
      A.stopMusic();
      $('#game').classList.add('hidden');
      $('#join').classList.remove('hidden');
      $('#joinBtn').textContent = 'Waddle in! 🪿';
      if (st.lobby) renderJoinStatus(st.lobby);
      heroLoop();
      U.toast(`👋 ${m.by || 'The host'} removed you from the lobby`, 4000);
      break;
    }
    case 'welcome':
      if (m.spectator) {
        st.spectator = true;
        U.toast('The pond is full (8 geese) — you\'re watching this one 👀', 4000);
      } else {
        const first = st.lane == null;
        st.spectator = false;
        st.id = m.id; store.set(ID_KEY, m.id);
        st.roomErr = null;
        st.lane = m.lane; W.meLane = m.lane; st.hat = m.hat; st.pending = m.pending;
        if (first) U.toast(`You're the ${S.COLOR_NAMES[m.lane]} goose in a ${S.HAT_LABELS[m.hat]}!${m.pending ? ' Your race starts next game.' : ''}`, 3200);
      }
      renderLobby();
      break;
    case 'lobby': {
      st.lobby = m;
      if (st.roomErr === 'noroom' || st.roomErr === 'busy') st.roomErr = null;
      renderJoinStatus(m);
      A.allowMusic(!m.tv);
      if (st.spectator && st.joined && m.phase === 'lobby' && m.players.length < 8) { st.spectator = false; hello(); }
      const me = m.players.find((p) => p.id === st.id);
      if (me) {
        if (st.hat && me.hat !== st.hat && st.mode === 'lobby') U.toast(`New look: ${S.HAT_LABELS[me.hat]}!`, 1500);
        st.hat = me.hat; st.pending = me.pending;
      }
      renderLobby();
      break;
    }
    case 'phase':
      if (m.phase === 'lobby') enterLobby();
      else if (m.phase === 'race') enterRace(m);
      break;
    case 'snap': W.onSnap(m); break;
    case 'ev': onEvent(m); break;
    case 'fx': onFx(m); break;
    case 'item':
      st.held = m.item; showItem(); A.itemReady(); A.buzz(30);
      break;
    case 'results': enterResults(m); break;
    case 'final': enterFinal(m); break;
  }
}

// ------------------------------------------------------------------ "what's going on?" for visitors
function gameState(m) {
  const active = m.players.filter((p) => !p.pending && p.connected);
  const th = m.theme ? S.THEMES[m.theme] : null;
  const round = `Round ${m.round + 1} of ${m.totalRounds}${th ? ` · ${th.emoji} ${th.name}` : ''}`;
  const host = m.players.find((p) => p.id === m.hostId);
  if (m.full && !m.players.some((p) => p.id === st.id)) return { cls: 'full', title: 'The pond is full (8/8)', sub: 'You can still watch the race', btn: 'Watch the race 👀' };
  if (m.phase === 'race') return { cls: 'busy', title: `Race on! ${round}`, sub: "Join now — you'll race in the next game", btn: 'Join the next game 🪿' };
  if (m.phase === 'results') return { cls: 'busy', title: `Between rounds · ${round}`, sub: "Join now — you'll race in the next game", btn: 'Join the next game 🪿' };
  if (m.phase === 'final') return { cls: 'busy', title: 'Award ceremony 🏆', sub: 'A new game starts soon — hop in!', btn: 'Join the next game 🪿' };
  if (!active.length && freshRoom) return { cls: 'live', title: '🎉 Your room is ready!', sub: 'Invite friends now (or later from the lobby), then waddle in', btn: 'Waddle in! 🪿' };
  if (!active.length) return { cls: 'live', title: 'Lobby open', sub: 'Be the first goose in the pond!', btn: 'Waddle in! 🪿' };
  return { cls: 'live', title: `Lobby open · ${active.length}/8 geese waiting`, sub: host ? `${host.name} 👑 will start the race` : 'Join before the race starts!', btn: 'Waddle in! 🪿' };
}

const ROOM_ERRORS = {
  noroom: { cls: 'full', title: "This room doesn't exist (anymore)", sub: 'Check the code and try again, or start a fresh room', btn: 'Create a new room 🪿', retry: true, create: true },
  locked: { cls: 'full', title: 'This room is locked 🔒', sub: 'Ask the host to unlock it, or start your own room', btn: 'Create a new room 🪿', retry: true, create: true },
  busy: { cls: 'full', title: 'The pond is packed right now', sub: 'Too many races at once. Try again in a minute', btn: 'Back to start' },
  limited: { cls: 'full', title: 'Slow down, honker', sub: 'Too many attempts. Wait a few minutes and try again', btn: 'Back to start' },
};

function renderJoinStatus(m) {
  if (st.joined) { renderWatchbar(); return; }
  $('#roomChip').classList.toggle('hidden', !ROOM || !!st.roomErr);
  // No room to join: a name field makes no sense, offer another code or a fresh room instead.
  nameIn.classList.toggle('hidden', !!st.roomErr);
  $('.tvlink').classList.toggle('hidden', !!st.roomErr);
  $('#retryForm').classList.toggle('hidden', !(st.roomErr && ROOM_ERRORS[st.roomErr].retry));
  if (st.roomErr) {
    const e = ROOM_ERRORS[st.roomErr];
    const el = $('#joinStatus');
    el.className = 'jstatus ' + e.cls;
    el.innerHTML = `<b><i class="pulse"></i>${esc(e.title)}</b><span>${esc(e.sub)}</span>`;
    $('#joinBtn').textContent = e.btn;
    return;
  }
  if (!m) return;
  const g = gameState(m);
  const el = $('#joinStatus');
  el.className = 'jstatus ' + g.cls;
  el.innerHTML = `<b><i class="pulse"></i>${esc(g.title)}</b><span>${esc(g.sub)}</span>`;
  $('#joinBtn').textContent = st.id && m.players.some((p) => p.id === st.id) ? 'Waddle back in! 🪿' : g.btn;
}

// Persistent note for anyone watching instead of racing (joined mid-game, or the pond is full).
function renderWatchbar() {
  const el = $('#watchbar');
  const m = st.lobby;
  const watching = st.joined && m && (st.mode === 'race' || st.mode === 'results') && !st.racing;
  el.classList.toggle('hidden', !watching);
  if (!watching) return;
  const th = m.theme ? S.THEMES[m.theme] : null;
  const round = `round ${m.round + 1} of ${m.totalRounds}${th ? ` (${th.name})` : ''}`;
  el.innerHTML = st.spectator
    ? `👀 Watching ${round} · the pond is full, you'll get a spot when one frees up`
    : `👀 Watching ${round} · <b>you're in the next game!</b>`;
}

function isHost() { return st.lobby && st.lobby.hostId === st.id; }

// ------------------------------------------------------------------ lobby + practice
function enterLobby() {
  st.mode = 'lobby';
  W.reset();
  W.meLane = st.lane;
  renderWatchbar();
  st.me = null; st.meSeed = null; st.held = null; showItem();
  clearPanels();
  overlay.innerHTML = '';
  $('#lobbyPanel').classList.remove('hidden');
  $('#controls').classList.remove('hidden', 'watching');
  $('#hud').classList.add('lobby');
  A.playMusic('lobby');
  if (!st.practice || st.practice.lane !== st.lane) makePractice();
  renderLobby();
  setHint(st.flaps > 0 ? 3 : 0);
}

function makePractice() {
  const c = S.makeCourse('meadow', 424242, 2000);
  for (const l of c.lanes) for (let i = 0; i < l.length; i++) if (l[i].t === 'egg') l[i] = { ...l[i], t: 'bread' };
  st.practice = { course: c, g: S.newGoose(st.lane ?? 0), lane: st.lane, removed: [] };
  for (let i = 0; i < 8; i++) st.practice.removed.push({ taken: {}, knocked: {} });
  st.practice.g.legPhase = 0;
}

function renderLobby() {
  const el = $('#lobbyPanel');
  const L = st.lobby;
  if (!L) return;
  const players = L.players.filter((p) => !p.pending || p.id === st.id);
  const host = L.players.find((p) => p.id === L.hostId);
  const canKick = isHost() && L.phase === 'lobby';
  const armed = st.kickArm && st.kickArm.until > Date.now() ? st.kickArm.id : null;
  const chips = players.map((p) => `
    <div class="chip ${p.id === st.id ? 'me' : ''} ${p.connected ? '' : 'off'} ${armed === p.id ? 'armed' : ''}" data-id="${p.id}" style="--c:${S.COLORS[p.lane]}">
      <canvas class="cg" data-lane="${p.lane}" data-hat="${p.hat}"></canvas>
      <span class="cn">${p.id === L.hostId ? '👑 ' : ''}${esc(p.name)}</span>
      ${canKick && p.id !== st.id ? `<button class="kick" data-kick="${p.id}" aria-label="Remove ${esc(p.name)}">${armed === p.id ? 'Kick?' : '✕'}</button>` : ''}
    </div>`).join('');
  const bots = L.fillBots ? Math.max(0, 8 - players.length) : 0;
  let action;
  if (st.spectator) action = `<div class="wait">The pond is full — enjoy the show 👀</div>`;
  else if (L.phase !== 'lobby') action = `<div class="wait">A race is on! You'll join the next one 🪿</div>`;
  else if (isHost()) {
    action = `<div class="host">
        <button id="botBtn" class="pill ${L.fillBots ? 'on' : ''}">🤖 Bots ${L.fillBots ? 'ON' : 'OFF'}</button>
        <button id="lockBtn" class="pill ${L.locked ? 'locked' : ''}" aria-label="${L.locked ? 'Unlock room' : 'Lock room'}">${L.locked ? '🔒' : '🔓'}</button>
        <button id="startBtn" class="go">Start race ▶</button>
      </div>
      <div class="sub">${players.length} player${players.length > 1 ? 's' : ''}${bots ? ` + ${bots} bot${bots > 1 ? 's' : ''}` : ''} · 3 rounds · ~3 min</div>`;
  } else action = `<div class="wait">Waiting for <b>${esc(host ? host.name : 'the host')}</b> to start… <span class="dots"><i>.</i><i>.</i><i>.</i></span></div>`;
  el.innerHTML = `
    <div class="lc-top"><span class="lc-title">🪿 ${players.length}/8 geese in the pond</span><button id="honkBtn" class="pill">📯 Honk</button></div>
    <div class="roomrow"><span class="rcode">Room <b>${fmtCode(ROOM)}</b>${L.locked ? ' · 🔒 locked' : ''}</span><button id="shareBtn" class="${players.length <= 1 ? 'go invite-nudge' : 'pill'}">🔗 Invite friends</button></div>
    <div class="roster">${chips}</div>
    <div class="lc-hint">Tap your goose to change hats${canKick && players.length > 1 ? ' · ✕ removes a player' : ''}</div>
    ${action}`;
  el.querySelectorAll('canvas.cg').forEach((c) => drawGooseIcon(c, +c.dataset.lane, c.dataset.hat, {}));
  const mine = el.querySelector('.chip.me');
  if (mine) mine.addEventListener('click', () => { net.send({ type: 'hat' }); A.pop(); });
  el.querySelectorAll('button.kick').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = b.dataset.kick;
    if (st.kickArm && st.kickArm.id === id && st.kickArm.until > Date.now()) {
      st.kickArm = null;
      net.send({ type: 'kick', id });
      A.pop();
    } else {
      st.kickArm = { id, until: Date.now() + 3000 };
      setTimeout(() => { if (st.kickArm && st.kickArm.id === id) { st.kickArm = null; renderLobby(); } }, 3050);
    }
    renderLobby();
  }));
  const hb = $('#honkBtn', el);
  hb && hb.addEventListener('click', honkCheer);
  const sb = $('#startBtn', el);
  sb && sb.addEventListener('click', () => { net.send({ type: 'start' }); sb.disabled = true; sb.textContent = 'Starting…'; });
  const lb = $('#lockBtn', el);
  lb && lb.addEventListener('click', () => net.send({ type: 'lock', on: !L.locked }));
  $('#shareBtn', el).addEventListener('click', shareRoom);
  const bb = $('#botBtn', el);
  bb && bb.addEventListener('click', () => net.send({ type: 'bots', on: !L.fillBots }));
}

async function shareRoom() {
  const url = roomUrl();
  try {
    if (navigator.share) { await navigator.share({ title: 'Goosy Race', text: `Join my goose race! Room ${fmtCode(ROOM)} 🪿`, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch {}
  if (!ok) {
    // http (LAN) has no clipboard API: fall back to a selected textarea
    const ta = h('textarea', '', ''); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  U.toast(ok ? `🔗 Link copied: ${url}` : `Share this link: ${url}`, 3500);
}

function honkCheer() {
  A.unlock();
  net.send({ type: 'honk' });
  A.buzz(20);
}

const HINTS = [
  '👇 Tap the <b>glowing foot</b> to waddle!',
  'Left, right, left, right… <b>faster = faster!</b> 💨',
  'Fence ahead! Hit <b>FLAP</b> to hop over it ⬆️',
  "You're a natural 🪿 Keep practising while you wait!",
];
function setHint(i) {
  st.hint = i;
  const el = $('#hint');
  el.innerHTML = HINTS[i] || '';
  el.classList.toggle('hidden', !HINTS[i]);
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}

function practiceFrame(dt) {
  const P = st.practice;
  if (!P) return;
  const g = P.g;
  const out = [];
  S.simGoose(g, dt, S.THEMES.meadow, P.course, 1, 0, out);
  for (const e of out) localEvent(e, g, P.removed, true);
  g.legPhase += (g.steps * Math.PI - g.legPhase) * Math.min(1, dt * 14);
  if (g.x > 140) {
    R.burst('poof', g.x, 0, 12, { h: 0.5, speed: 2, life: 0.7, grav: 0 });
    g.x = 0; g.knocked = {}; g.taken = {};
    P.removed.forEach((r) => { r.taken = {}; r.knocked = {}; });
  }
  if (st.hint === 1 && g.vx > 4) setHint(2);
  const w = R.w;
  R.ppu = w / (w > R.h * 1.2 ? 12 : 7);
  const target = g.x - (w / R.ppu) * 0.3;
  R.camX += (target - R.camX) * Math.min(1, dt * 10);
  R.update(dt);
  const lane = st.lane ?? 0;
  const rem = []; rem[lane] = P.removed[lane];
  R.draw({
    theme: 'meadow', course: P.course, t: null, clock, lanes: [lane],
    geese: [{ lane, x: g.x, z: g.z, vx: g.vx, flags: S.packFlags(g), hat: st.hat, name: st.name, me: true, phase: g.legPhase, honk: W.honkT[lane] || 0, wob: g.wobble }],
    meLane: lane, removed: rem, extras: [],
  });
  W.honkT[lane] = Math.max(0, (W.honkT[lane] || 0) - dt);
  updateControls(g, P.course, 0);
}

// ------------------------------------------------------------------ race
function enterRace(m) {
  const wasMode = st.mode;
  W.onRace(m);
  st.mode = 'race';
  const mine = m.racers[st.lane];
  st.racing = !!(mine && mine.id === st.id && !st.spectator);
  W.meLane = st.racing ? st.lane : null;
  if (st.racing && st.meSeed !== m.seed) {
    st.me = S.newGoose(st.lane);
    st.me.legPhase = 0;
    st.me.extra = W.extras[st.lane];
    st.meSeed = m.seed;
    st.myPlace = null; st.finAt = 0;
    st.held = null;
    st.reflex = null;
    st.yolk = 0;
    if (m.you) { st.me.x = m.you.x; st.me.fin = m.you.fin; st.held = m.you.held; }
  } else if (st.racing && m.you && m.you.held) st.held = m.you.held;
  if (!st.racing) st.me = null;
  showItem();
  clearPanels();
  $('#lobbyPanel').classList.add('hidden');
  $('#hud').classList.remove('lobby');
  $('#controls').classList.toggle('hidden', !st.racing);
  $('#controls').classList.remove('watching');
  $('#hint').classList.add('hidden');
  overlay.innerHTML = '';
  st.lastCount = null;
  st.introEl = null;
  if (W.raceT() < -3.3) st.introEl = U.introCard(overlay, m, st.racing ? st.lane : null);
  renderWatchbar();
  if (wasMode !== 'race') A.playMusic(m.theme);
  A.setMusicRate(1);
  R.camX = st.me ? st.me.x - 3 : -3;
}

function raceFrame(dt) {
  const t = W.raceT();
  const th = S.THEMES[W.theme];
  // intro + countdown
  if (st.introEl && t > -3.3) { st.introEl.classList.add('out'); const e = st.introEl; setTimeout(() => e.remove(), 400); st.introEl = null; }
  if (t < 0.9) {
    const c = Math.ceil(-t);
    if (t > -3.05 && c !== st.lastCount) {
      st.lastCount = c;
      if (c > 0 && c <= 3) { U.bigText(overlay, String(c), 'count'); A.beep(c); }
      else if (c <= 0) { U.bigText(overlay, 'HONK!', 'count go'); A.beep(0); A.honk(0.9, 0.5); A.buzz(80); }
    }
  }
  const g = st.me;
  if (g) {
    g.frozen = t < 0 || W.frozen;
    const snap = W.latest(st.lane);
    const cu = snap ? snap[4] : 1;
    if (t >= 0 || g.x > 0) {
      const out = [];
      S.simGoose(g, dt, th, W.course, cu, Math.max(0, t), out);
      for (const e of out) localEvent(e, g, W.removed, false);
    }
    g.legPhase += (g.steps * Math.PI - g.legPhase) * Math.min(1, dt * 14);
    const now = performance.now();
    if (now - st.lastSend > 50) {
      st.lastSend = now;
      net.send({ type: 's', t: Math.round(t * 1000) / 1000, x: Math.round(g.x * 100) / 100, z: Math.round(g.z * 100) / 100, vx: Math.round(g.vx * 100) / 100, f: S.packFlags(g) });
    }
    if (st.reflex && st.reflex.ph === 'go' && !st.reflex.sent && now - st.reflex.goAt > 1800) { W.frozen = false; st.reflex.sent = true; }
    updateControls(g, W.course, t);
    // nudge anyone who hasn't figured out the controls yet
    const lost = t > 1.5 && t < 12 && g.steps < 4 && !g.fin;
    const hintEl = $('#hint');
    if (lost && hintEl.classList.contains('hidden')) setHint(0);
    else if (!lost && st.mode === 'race' && !hintEl.classList.contains('hidden')) hintEl.classList.add('hidden');
    st.yolk = Math.max(0, st.yolk - dt * 0.16);
    drawYolk();
  }
  const geese = W.geese(t, g, dt);
  W.tickFarmer(dt);
  const w = R.w;
  const follow = g && (!g.fin || performance.now() - st.finAt < 2500);
  let warn = null;
  if (follow) {
    // Zoom out as you speed up and keep your goose near the left edge: more road ahead to react to.
    // Fixed zoom (a speed-based zoom made the world "breathe" with every tap), goose near the left edge
    // so there's ~1.5s of road visible ahead at full speed.
    const land = w > R.h * 1.2;
    const v = Math.max(0, g.vx);
    const span = land ? 19 : 13.5;
    R.ppu += (w / span - R.ppu) * Math.min(1, dt * 3);
    const target = g.x - (w / R.ppu) * (land ? 0.22 : 0.2);
    // critically-damped follow: no lag at speed, no snapping on teleports
    const k = g.yeet > 0 ? 6 : 16;
    R.camX += (target - R.camX) * (1 - Math.exp(-dt * k));
    if (!g.fin && t > 0) {
      const th = S.nextThreat(g, W.course);
      const rightEdge = R.camX + w / R.ppu;
      if (th && g.x + th.d > rightEdge - 1.5 && th.d < Math.max(9, v * 2.8)) warn = th;
    }
  } else W.packCamera(geese, dt, w);
  R.update(dt);
  R.draw(W.scene(t, clock, geese, { warn }));
  // item bubble lives bottom-right, floating just above your own (bottom) lane so it never hides what's coming
  if (st.held && R.L) btnItem.style.bottom = Math.round(R.L.laneH + 6) + 'px';
  hud(geese, t);
}

function localEvent(e, g, removed, practice) {
  const lane = g.lane;
  const rm = removed[lane];
  const idOk = typeof e.i === 'number';
  switch (e.e) {
    case 'bonk':
      rm.knocked[e.i] = true;
      A.bonk(); A.buzz([40, 30, 40]); R.shake = 0.5;
      R.burst('feather', g.x + 0.3, practice ? 0 : lane, 7, { h: 0.7, speed: 2.5, life: 1.3, grav: 1.4 });
      R.burst('spark', g.x + 0.5, practice ? 0 : lane, 5, { h: 0.9, speed: 3, life: 0.5, color: '#ffe34d', grav: 0 });
      R.popText(['BONK!', 'OOF!', 'OUCH!', 'HONK?!'][Math.floor(Math.random() * 4)], g.x, practice ? 0 : lane, '#ff6b6b');
      if (!practice) { net.send({ type: 'stat', k: 'bonks' }); if (idOk) net.send({ type: 'pk', i: e.i, kind: 'knock' }); }
      else if (st.hint >= 2 && st.hint < 3) setHint(2);
      break;
    case 'bike':
      A.bell(); A.bonk(); A.buzz([60, 30, 60]); R.shake = 0.6;
      R.popText('TRING TRING!', g.x, lane, '#ffd23f');
      R.burst('feather', g.x, lane, 8, { h: 0.7, speed: 2.5, life: 1.3, grav: 1.4 });
      net.send({ type: 'stat', k: 'bikes' });
      break;
    case 'dunk':
      A.splash(); A.buzz(120);
      R.burst('drop', g.x, lane, 20, { h: 0.1, speed: 3.5, up: 2, life: 0.9, colors: ['#9bd4ff', '#ffffff', '#5fb0ea'] });
      R.popText('BRRRR!', g.x, lane, '#9bd4ff');
      net.send({ type: 'stat', k: 'dunks' });
      break;
    case 'popout':
      A.flap();
      R.burst('drop', g.x, lane, 10, { h: 0.2, speed: 2.5, life: 0.6, colors: ['#9bd4ff', '#ffffff'] });
      break;
    case 'mud':
      A.mud();
      R.burst('dust', g.x, practice ? 0 : lane, 6, { h: 0.1, speed: 1.5, life: 0.6, color: W.theme === 'night' && !practice ? '#6c7bb5' : '#8a5a35' });
      break;
    case 'food':
      rm.taken[e.i] = true;
      A.pickup(); A.buzz(15);
      R.burst('crumb', g.x + 0.4, practice ? 0 : lane, 8, { h: 0.5, speed: 2, life: 0.6, colors: ['#e3a14f', '#b8742a', '#fff'] });
      R.popText('+SPEED', g.x + 0.5, practice ? 0 : lane, '#ffd23f', 0.8);
      if (!practice) { net.send({ type: 'stat', k: 'food' }); if (idOk) net.send({ type: 'pk', i: e.i, kind: 'take' }); }
      break;
    case 'tramp':
      rm.knocked[e.i] = true;
      A.boing(); A.flap(); A.buzz([30, 30, 60]);
      R.burst('spark', g.x, practice ? 0 : lane, 12, { h: 0.4, speed: 3.5, up: 2, life: 0.7, colors: ['#ffd23f', '#4fb3ff', '#ff4d5e'], grav: 2 });
      R.popText('BOING! 🤸', g.x + 0.5, practice ? 0 : lane, '#4fb3ff', 1.1);
      if (!practice) { net.send({ type: 'stat', k: 'tramps' }); if (idOk) net.send({ type: 'pk', i: e.i, kind: 'knock' }); }
      break;
    case 'egg':
      rm.taken[e.i] = true;
      A.egg(); A.buzz(25);
      R.burst('spark', g.x + 0.4, lane, 10, { h: 0.6, speed: 2.5, life: 0.6, color: '#ffd23f', grav: 0 });
      if (!st.held) R.popText('MYSTERY ITEM!', g.x, lane, '#ffd23f', 0.8);
      net.send({ type: 'egg' });
      if (idOk) net.send({ type: 'pk', i: e.i, kind: 'take' });
      break;
    case 'land':
      if (e.big) { A.land(); R.shake = 0.7; A.buzz(60); }
      R.burst('dust', g.x, practice ? 0 : lane, e.big ? 12 : 4, { h: 0.05, speed: e.big ? 2.5 : 1.2, life: 0.5, color: 'rgba(255,255,255,0.8)', grav: 0 });
      if (practice && st.hint === 2) setHint(3);
      break;
    case 'fin':
      st.finAt = performance.now();
      net.send({ type: 'fin', t: e.t });
      A.fanfare(); A.buzz([100, 50, 100, 50, 200]);
      $('#controls').classList.add('watching');
      break;
  }
}

function onEvent(m) {
  const t = W.raceT();
  const geese = st.mode === 'race' ? W.geese(t, st.me, 0) : null;
  W.onEvent(m, geese);
  switch (m.k) {
    case 'fin':
      if (m.lane === st.lane && st.racing) {
        st.myPlace = m.place;
        const medal = ['🥇', '🥈', '🥉'][m.place - 1] || '🎉';
        U.banner(overlay, `${medal} ${S.ordinal(m.place)} place!`, m.place === 1 ? 'Fastest goose in the pond!' : 'Nice waddling! Cheer on the others 📯', { color: m.place === 1 ? '#ffc93c' : S.COLORS[st.lane], ms: 3200, cls: 'win' });
      }
      break;
    case 'reflex':
      if (m.ph === 'wait') {
        W.frozen = true;
        st.reflex = { ph: 'wait', sent: false };
        U.banner(overlay, '🦢 MOTHER GOOSE SAYS… FREEZE!', 'Don\'t move! When she says GO, tap as fast as you can', { color: '#4fb3ff', ms: 0, icon: '🧊' });
        A.alarm();
      } else if (m.ph === 'go') {
        if (st.reflex) { st.reflex.ph = 'go'; st.reflex.goAt = performance.now(); }
        U.clearBanner(overlay);
        U.bigText(overlay, 'GO! TAP!', 'count go');
        A.honk(1.1, 0.7, true); A.buzz(150);
        R.flash = 0.8;
        if (!st.racing) W.frozen = false;
      } else if (m.ph === 'res') {
        W.frozen = false;
        const best = m.list.filter((e) => e.ms > 0).slice(0, 3);
        const name = (l) => (W.racers[l] ? esc(W.racers[l].name) : '?');
        if (best.length) U.banner(overlay, `⚡ ${name(best[0].lane)} — ${best[0].ms} ms`, best.map((e, i) => `${['🥇', '🥈', '🥉'][i]} ${name(e.lane)}`).join(' · ') + ' — speed boost!', { color: '#ffc93c', ms: 3000 });
        st.reflex = null;
      }
      break;
    case 'farmer':
      U.banner(overlay, '🧑‍🌾 THE FARMER IS FURIOUS!', 'Run! …or get yeeted forward by his broom 🧹', { color: '#ff8a1f', ms: 3200 });
      A.buzz([100, 60, 100]);
      break;
    case 'farmerEnd': U.toast('The farmer ran out of breath 😮‍💨'); break;
    case 'bread': {
      U.banner(overlay, '🍞 BREAD RAIN!', 'Snacks falling from the sky — gobble them for speed!', { color: '#e3a14f', ms: 2600 });
      if (st.me && !st.me.fin) {
        const ex = W.extras[st.lane];
        for (let i = 0; i < 9; i++) ex.push({ x: st.me.x + 5 + i * 2.1, t: S.THEMES[W.theme].food, v: i, id: 'b' + m.seed + i });
      }
      break;
    }
    case 'eggs':
      U.banner(overlay, '🥚 GOLDEN EGG HUNT!', 'A mystery egg for every goose!', { color: '#ffc93c', ms: 2600 });
      if (st.me && !st.me.fin) W.extras[st.lane].push({ x: st.me.x + 5, t: 'egg', v: 1, id: 'e' + Math.floor(Math.random() * 1e6) });
      break;
    case 'item':
      if (m.to && m.to.includes(st.lane) && m.item === 'swap') U.toast(`🔀 ${W.racers[m.from] ? W.racers[m.from].name : 'Someone'} swapped places with you!`);
      break;
    case 'honk':
      if (st.mode === 'lobby' && m.lane !== st.lane) {
        const chip = document.querySelector(`.chip[data-id="${m.id}"]`);
        if (chip) { chip.classList.remove('honking'); void chip.offsetWidth; chip.classList.add('honking'); }
      }
      break;
  }
}

function onFx(m) {
  const g = st.me;
  if (!g || !W.course) return;
  const ok = S.applyFx(g, m, W.course.len);
  const lane = st.lane;
  switch (m.k) {
    case 'stun':
      if (!ok) R.popText('DODGED!', g.x, lane, '#35d07f');
      else if (m.why === 'early') { R.popText('TOO EARLY! 🙈', g.x, lane, '#ff6b6b'); A.sadTrombone(); }
      A.buzz(80);
      break;
    case 'splat':
      st.yolk = 1; A.buzz([50, 50, 200]);
      makeYolk();
      break;
    case 'boost': R.popText('BOOST!', g.x, lane, '#ffd23f'); A.whoosh(); break;
    case 'fly': R.popText('WINGS!', g.x, lane, '#fff'); A.flap(); break;
    case 'tp': R.burst('poof', g.x, lane, 10, { h: 0.6, speed: 1.5, life: 0.8, grav: 0 }); R.camX = g.x - 3; break;
    case 'yeet': break;
  }
}

// ------------------------------------------------------------------ egg on the screen (rub to wipe)
const yolkCv = $('#yolk');
let yolkBlobs = [];
function makeYolk() {
  yolkBlobs = [];
  for (let i = 0; i < 6; i++) yolkBlobs.push({ x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.7, r: 0.12 + Math.random() * 0.14, s: Math.random() * 100 });
  yolkCv.classList.add('on');
  A.splat();
}
function drawYolk() {
  if (st.yolk <= 0) { if (yolkCv.classList.contains('on')) yolkCv.classList.remove('on'); return; }
  const r = yolkCv.getBoundingClientRect();
  if (yolkCv.width !== Math.round(r.width)) { yolkCv.width = r.width; yolkCv.height = r.height; }
  const c = yolkCv.getContext('2d');
  const w = yolkCv.width, hh = yolkCv.height;
  c.clearRect(0, 0, w, hh);
  c.globalAlpha = Math.min(1, st.yolk * 1.3);
  const m = Math.min(w, hh);
  // egg whites first (smooth wobbly blobs), yolks on top
  for (const b of yolkBlobs) {
    const R0 = b.r * m * 1.5;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rr = R0 * (1 + 0.28 * Math.sin(i * 2.3 + b.s));
      pts.push([b.x * w + Math.cos(a) * rr, b.y * hh + Math.sin(a) * rr]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    c.beginPath();
    const s0 = mid(pts[9], pts[0]);
    c.moveTo(s0[0], s0[1]);
    for (let i = 0; i < 10; i++) { const q = mid(pts[i], pts[(i + 1) % 10]); c.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
    c.fillStyle = 'rgba(246,248,228,0.9)';
    c.fill();
    c.strokeStyle = 'rgba(210,214,180,0.9)'; c.lineWidth = 3; c.stroke();
  }
  for (const b of yolkBlobs) {
    const R0 = b.r * m * 0.65;
    const x = b.x * w, y = b.y * hh;
    c.fillStyle = '#ffb81f';
    c.beginPath(); c.arc(x, y, R0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e79400'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#ffd35c';
    c.beginPath(); c.arc(x - R0 * 0.1, y - R0 * 0.1, R0 * 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.ellipse(x - R0 * 0.35, y - R0 * 0.38, R0 * 0.22, R0 * 0.14, -0.6, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = Math.min(1, st.yolk * 2);
  c.font = `700 ${Math.round(Math.min(w, hh) * 0.09)}px Fredoka, system-ui`;
  c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = '#2a2140'; c.fillStyle = '#fff';
  c.strokeText('🧽 RUB TO WIPE!', w / 2, hh * 0.52); c.fillText('🧽 RUB TO WIPE!', w / 2, hh * 0.52);
}
let lastRub = null;
yolkCv.addEventListener('pointermove', (e) => {
  if (st.yolk <= 0) return;
  if (lastRub) st.yolk = Math.max(0, st.yolk - Math.hypot(e.clientX - lastRub.x, e.clientY - lastRub.y) * 0.0016);
  lastRub = { x: e.clientX, y: e.clientY };
});
yolkCv.addEventListener('pointerdown', (e) => { lastRub = { x: e.clientX, y: e.clientY }; });
yolkCv.addEventListener('pointerup', () => { lastRub = null; });

// ------------------------------------------------------------------ controls
const footL = $('#footL'), footR = $('#footR'), btnFlap = $('#btnFlap'), btnItem = $('#btnItem');

function activeGoose() { return st.mode === 'lobby' ? st.practice && st.practice.g : st.me; }
function activeTheme() { return st.mode === 'lobby' ? S.THEMES.meadow : S.THEMES[W.theme]; }

function press(el) { el.classList.remove('press'); void el.offsetWidth; el.classList.add('press'); }

function reflexTap() {
  const rf = st.reflex;
  if (!rf || rf.sent || !st.racing) return;
  if (rf.ph === 'wait') {
    rf.sent = true;
    net.send({ type: 'reflex', ms: -1 });
    U.bigText(overlay, 'TOO EARLY! 🙈', 'count bad');
  } else if (rf.ph === 'go') {
    rf.sent = true;
    const ms = Math.round(performance.now() - rf.goAt);
    net.send({ type: 'reflex', ms });
    W.frozen = false;
    U.bigText(overlay, `⚡ ${ms} ms`, 'count');
  }
}

function onFoot(f) {
  A.unlock();
  reflexTap();
  const g = activeGoose();
  if (!g) return;
  const snap = st.mode === 'race' ? W.latest(st.lane) : null;
  const res = S.stepFoot(g, f, activeTheme(), snap ? snap[4] : 1);
  const el = f === 1 ? footL : footR;
  press(el);
  if (res === 1) {
    A.step(f); A.buzz(6);
    R.burst('dust', g.x - 0.3, st.mode === 'lobby' ? 0 : g.lane, 2, { h: 0.02, speed: 0.8, vx: -1, life: 0.4, color: W.theme === 'ice' && st.mode === 'race' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)', grav: 0 });
    if (st.mode === 'lobby') {
      st.goodSteps++;
      if (st.hint === 0 && st.goodSteps >= 6) setHint(1);
    }
  } else if (res === -1) {
    A.wrongStep();
    el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong');
  }
}
function onFlap() {
  A.unlock();
  reflexTap();
  const g = activeGoose();
  if (!g) return;
  press(btnFlap);
  if (S.flap(g)) {
    A.flap(); A.buzz(12);
    st.flaps++;
    if (st.mode === 'race') net.send({ type: 'stat', k: 'flaps' });
  }
}
function onItem() {
  if (!st.held || st.mode !== 'race') return;
  net.send({ type: 'use' });
  press(btnItem);
  const it = st.held;
  st.held = null;
  showItem();
  if (it === 'honk') st.me && (W.honkT[st.lane] = 1);
}

function showItem() {
  if (st.held) {
    const it = S.ITEMS[st.held];
    btnItem.innerHTML = `<span class="ie">${it.emoji}</span><span class="il"><b>${it.name}</b><small>${it.desc} — tap!</small></span>`;
    btnItem.classList.remove('hidden');
  } else btnItem.classList.add('hidden');
}

function bindPress(el, fn) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindPress(footL, () => onFoot(1));
bindPress(footR, () => onFoot(2));
bindPress(btnFlap, onFlap);
bindPress(btnItem, onItem);
$('#controls').addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
$('#controls').addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const keys = {};
window.addEventListener('keydown', (e) => {
  if (!st.joined || e.repeat || document.activeElement === nameIn) return;
  const k = e.key.toLowerCase();
  if (keys[k]) return;
  keys[k] = true;
  if (k === 'a' || k === 'arrowleft') onFoot(1);
  else if (k === 'd' || k === 'arrowright') onFoot(2);
  else if (k === 'w' || k === 'arrowup' || k === ' ') { e.preventDefault(); onFlap(); }
  else if (k === 'e' || k === 'shift' || k === 'enter') onItem();
  else if (k === 'h') honkCheer();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function updateControls(g, course, t) {
  const canGo = S.canRun(g) && !g.fin;
  const next = g.foot === 1 ? 2 : 1;
  footL.classList.toggle('next', canGo && next === 1);
  footR.classList.toggle('next', canGo && next === 2);
  const d = S.nextHazard(g, course, t);
  const hot = g.z <= 0.02 && g.fly <= 0 && d < Math.max(1.4, g.vx * 0.5) && d > -0.2;
  btnFlap.classList.toggle('hot', hot && !g.fin);
  $('#controls').classList.toggle('dizzy', g.stun > 0 || g.dunk > 0 || g.yeet > 0);
}

// ------------------------------------------------------------------ HUD
const placeEl = $('#place'), dotsEl = $('#dots'), hurryEl = $('#hurry');
let dotEls = [];
function hud(geese, t) {
  if (!W.course) return;
  const rank = W.ranking(geese);
  const mine = rank.indexOf(st.lane);
  if (st.racing && mine >= 0) {
    placeEl.innerHTML = `${S.ordinal(mine + 1)}<small>/${rank.length}</small>`;
    placeEl.style.setProperty('--c', S.COLORS[st.lane]);
  } else placeEl.innerHTML = '👀';
  if (dotEls.length !== geese.length) {
    dotsEl.innerHTML = '';
    dotEls = geese.map((g) => { const d = h('div', 'dot' + (g.me ? ' me' : '')); d.style.background = S.COLORS[g.lane]; dotsEl.appendChild(d); return d; });
  }
  geese.forEach((g, i) => {
    const d = dotEls[i];
    d.className = 'dot' + (g.me ? ' me' : '');
    d.style.background = S.COLORS[g.lane];
    d.style.left = Math.min(100, Math.max(0, (g.x / W.course.len) * 100)) + '%';
  });
  if (W.left != null) {
    hurryEl.classList.remove('hidden');
    hurryEl.textContent = `⏱ ${W.left}`;
    A.setMusicRate(1.18);
  } else hurryEl.classList.add('hidden');
}

// ------------------------------------------------------------------ results / final
function clearPanels() { panels.innerHTML = ''; panels.classList.add('hidden'); }

function panelButtons(el, btns) {
  const box = $('.p-btns', el);
  for (const b of btns) {
    const e = h('button', b.cls || 'pill', b.label);
    e.addEventListener('click', b.fn);
    box.appendChild(e);
  }
}

function enterResults(m) {
  st.mode = 'results';
  renderWatchbar();
  $('#controls').classList.add('hidden');
  U.clearBanner(overlay);
  panels.innerHTML = '';
  panels.classList.remove('hidden');
  const el = U.resultsView(panels, m, st.id, { rowH: 44 });
  const btns = [{ label: '📯 Honk', fn: honkCheer }];
  if (isHost()) btns.push({ label: m.next ? 'Next round ▶' : 'Ceremony ▶', cls: 'go', fn: () => net.send({ type: 'skip' }) });
  panelButtons(el, btns);
  A.playMusic('lobby');
  const mine = m.rows.find((r) => r.id === st.id);
  if (mine && mine.place === 1) A.cheer();
}

function enterFinal(m) {
  st.mode = 'final';
  renderWatchbar();
  $('#controls').classList.add('hidden');
  $('#lobbyPanel').classList.add('hidden');
  U.clearBanner(overlay);
  panels.innerHTML = '';
  panels.classList.remove('hidden');
  A.stopMusic();
  const el = U.finalView(panels, m, st.id, {
    onReveal: () => {
      R.burst('confetti', R.camX + R.w / R.ppu / 2, 3, 120, { h: 4, speed: 6, up: 1.5, life: 3.5, grav: 2, colors: S.COLORS });
      setTimeout(() => A.playMusic('lobby'), 2500);
    },
  });
  const btns = [{ label: '📯 Honk', fn: honkCheer }];
  if (isHost()) btns.push({ label: 'Play again 🔁', cls: 'go', fn: () => net.send({ type: 'again' }) });
  else btns.push({ label: 'Waiting for host to restart…', cls: 'pill ghost', fn: () => {} });
  panelButtons(el, btns);
}

function idleFrame(dt) {
  const t = W.raceT();
  const geese = W.course ? W.geese(t, st.me, dt) : [];
  if (W.course) {
    W.packCamera(geese, dt, R.w);
    R.update(dt);
    R.draw(W.scene(t, clock, geese, {}));
  }
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
let clock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (st.mode === 'lobby') practiceFrame(dt);
  else if (st.mode === 'race') raceFrame(dt);
  else idleFrame(dt);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => R.resize());
new ResizeObserver(() => R.resize()).observe(stage);
if (document.fonts) document.fonts.ready.then(() => {});
if (new URLSearchParams(location.search).has('debug')) window.__goosy = {
  st, W, R, S, onMsg,
  // test hook: advance the game manually (the rAF loop is throttled in hidden tabs)
  step(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) {
      clock += dt;
      if (st.mode === 'lobby') practiceFrame(dt); else if (st.mode === 'race') raceFrame(dt); else idleFrame(dt);
    }
  },
};
