import * as S from '../shared/sim.js';
import * as A from './audio.js';
import { Net } from './net.js';
import { Renderer } from './render.js';
import { World } from './world.js';
import * as U from './ui.js';
import { ROOM, fmtCode } from './room.js';

const { $, h, esc } = U;
const cv = $('#cv');
const R = new Renderer(cv, { tv: true });
const net = new Net(onMsg);
const W = new World(R, net, { tv: true });
const overlay = $('#overlay');
const panels = $('#panels');

let mode = 'lobby';
let lobby = null;
let started = false;
let introEl = null;
let lastCount = null;
const popIn = {};

let welcomed = false; // once we've been in this room, we may bring it back after a server restart
$('#tvQr').src = `/qr.svg?room=${ROOM}`;
$('#tvCode').textContent = fmtCode(ROOM);
fetch(`/info?room=${ROOM}`).then((r) => r.json()).then((j) => { $('#tvUrl').textContent = j.url.replace(/^https?:\/\//, ''); }).catch(() => {});

$('#tvWake').addEventListener('click', () => { $('#tvSleep').classList.add('hidden'); net.resume(); });
$('#tvStart').addEventListener('click', () => {
  A.unlock();
  started = true;
  $('#tvStart').classList.add('hidden');
  if (mode === 'lobby') A.playMusic('lobby');
  else if (mode === 'race') A.playMusic(W.theme);
});
net.onOpen = () => net.send({ type: 'hello', tv: true, rejoin: welcomed });

function onMsg(m) {
  switch (m.type) {
    case 'welcome': welcomed = true; $('#tvNoRoom').classList.add('hidden'); break;
    case 'noroom': if (!welcomed) $('#tvNoRoom').classList.remove('hidden'); break;
    case 'sleep': net.stop(); $('#tvSleep').classList.remove('hidden'); break;
    case 'roomfull': net.stop(); $('#tvNoRoom').textContent = 'Too many screens are connected to this room right now.'; $('#tvNoRoom').classList.remove('hidden'); break;
    case 'lobby': {
      const before = lobby ? new Set(lobby.players.map((p) => p.id)) : new Set();
      lobby = m;
      for (const p of m.players) if (!before.has(p.id)) { popIn[p.lane] = 1; A.pop(); R.burst('poof', -0.8, p.lane, 12, { h: 0.6, speed: 2, life: 0.8, grav: 0 }); }
      renderLobby();
      break;
    }
    case 'phase':
      if (m.phase === 'lobby') enterLobby();
      else if (m.phase === 'race') enterRace(m);
      break;
    case 'snap': W.onSnap(m); break;
    case 'ev': onEvent(m); break;
    case 'results': enterResults(m); break;
    case 'final': enterFinal(m); break;
  }
}

function enterLobby() {
  mode = 'lobby';
  W.reset();
  panels.innerHTML = ''; panels.classList.add('hidden');
  overlay.innerHTML = '';
  $('#tvLobby').classList.remove('hidden');
  $('#tvHud').classList.add('hidden');
  if (started) A.playMusic('lobby');
  renderLobby();
}

function renderLobby() {
  if (!lobby) return;
  const ps = lobby.players.filter((p) => !p.pending);
  const host = lobby.players.find((p) => p.id === lobby.hostId);
  $('#tvCount').innerHTML = ps.length ? `<b>${ps.length}</b>/8 geese in the pond` : 'Waiting for geese…';
  $('#tvWait').innerHTML = ps.length
    ? `<b>${esc(host ? host.name : '')}</b> 👑 starts the race from their phone${lobby.fillBots && ps.length < 8 ? ` · ${8 - ps.length} bot${8 - ps.length > 1 ? 's' : ''} will fill in` : ''}`
    : 'Scan the code to be the first goose!';
}

function enterRace(m) {
  const was = mode;
  W.onRace(m);
  mode = 'race';
  $('#tvLobby').classList.add('hidden');
  $('#tvHud').classList.remove('hidden');
  panels.innerHTML = ''; panels.classList.add('hidden');
  overlay.innerHTML = '';
  lastCount = null;
  introEl = W.raceT() < -3.3 ? U.introCard(overlay, m, null) : null;
  if (started && was !== 'race') A.playMusic(m.theme);
  A.setMusicRate(1);
  const th = S.THEMES[m.theme];
  $('#tvRound').innerHTML = `${th.emoji} ${th.name} <span>Round ${m.round + 1}/${m.totalRounds}${m.double ? ' · x2 points' : ''}</span>`;
  R.camX = -8; R.ppu = R.w / 20;
}

function onEvent(m) {
  const t = W.raceT();
  const geese = mode === 'race' ? W.geese(t, null, 0) : null;
  W.onEvent(m, geese);
  const name = (l) => (W.racers[l] ? esc(W.racers[l].name) : '?');
  switch (m.k) {
    case 'honk':
      if (mode === 'lobby') { W.honkT[m.lane] = 0.5; }
      break;
    case 'fin':
      if (m.place === 1) U.banner(overlay, `🥇 ${name(m.lane)} wins the round!`, 'Everyone else: 20 seconds to cross the line!', { color: '#ffc93c', ms: 3000, cls: 'win' });
      break;
    case 'reflex':
      if (m.ph === 'wait') { W.frozen = true; U.banner(overlay, '🦢 MOTHER GOOSE SAYS… FREEZE!', "Don't move! Tap the moment she says GO", { color: '#4fb3ff', ms: 0 }); A.alarm(); }
      else if (m.ph === 'go') { W.frozen = false; U.clearBanner(overlay); U.bigText(overlay, 'GO! TAP!', 'count go'); A.honk(1.1, 0.7, true); R.flash = 0.8; }
      else if (m.ph === 'res') {
        const best = m.list.filter((e) => e.ms > 0).slice(0, 3);
        if (best.length) U.banner(overlay, `⚡ ${name(best[0].lane)} — ${best[0].ms} ms`, best.map((e, i) => `${['🥇', '🥈', '🥉'][i]} ${name(e.lane)} ${e.ms}ms`).join('   '), { color: '#ffc93c', ms: 3200 });
        const early = m.list.filter((e) => e.ms < 0);
        if (early.length) setTimeout(() => U.toast(`🙈 Too early: ${early.map((e) => W.racers[e.lane] ? W.racers[e.lane].name : '?').join(', ')}`), 3300);
      }
      break;
    case 'farmer': U.banner(overlay, '🧑‍🌾 THE FARMER IS FURIOUS!', 'Anyone he catches gets yeeted with the broom 🧹', { color: '#ff8a1f', ms: 3200 }); break;
    case 'farmerEnd': U.toast('The farmer ran out of breath 😮‍💨'); break;
    case 'bread': U.banner(overlay, '🍞 BREAD RAIN!', 'Snacks for everyone — gobble them for speed!', { color: '#e3a14f', ms: 2600 }); break;
    case 'eggs': U.banner(overlay, '🥚 GOLDEN EGG HUNT!', 'A mystery item for every goose!', { color: '#ffc93c', ms: 2600 }); break;
    case 'item': {
      const it = S.ITEMS[m.item];
      let txt = `${it.emoji} ${name(m.from)} used ${it.name}`;
      if (m.item === 'rotten' && m.to.length) txt = `🥚 ${name(m.from)} egged ${name(m.to[0])}!`;
      if (m.item === 'swap' && m.to.length) txt = `🔀 ${name(m.from)} swapped with ${name(m.to[0])}!`;
      if (m.item === 'honk') txt = `📯 ${name(m.from)} MEGA-HONKED ${m.to.length} geese!`;
      feed(txt);
      break;
    }
    case 'smack': feed(`🧹 ${name(m.lane)} got yeeted!`); break;
  }
}

function feed(text) {
  const f = $('#tvFeed');
  const e = h('div', 'feed-item', text);
  f.prepend(e);
  while (f.children.length > 4) f.lastChild.remove();
  setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 500); }, 4500);
}

function enterResults(m) {
  mode = 'results';
  U.clearBanner(overlay);
  panels.innerHTML = ''; panels.classList.remove('hidden');
  U.resultsView(panels, m, null, { rowH: 64 });
  if (started) A.playMusic('lobby');
  A.fanfare();
}

function enterFinal(m) {
  mode = 'final';
  U.clearBanner(overlay);
  $('#tvHud').classList.add('hidden');
  panels.innerHTML = ''; panels.classList.remove('hidden');
  A.stopMusic();
  const el = U.finalView(panels, m, null, {
    onReveal: () => {
      R.burst('confetti', R.camX + R.w / R.ppu / 2, 3, 200, { h: 5, speed: 8, up: 1.5, life: 4, grav: 2, colors: S.COLORS });
      setTimeout(() => started && A.playMusic('lobby'), 2500);
    },
  });
  $('.p-btns', el).innerHTML = '<div class="wait">The host can start a new game from their phone 🔁</div>';
}

// ------------------------------------------------------------------ frames
function lobbyFrame(dt) {
  R.ppu = R.w / 17;
  R.camX = -6.5;
  const geese = [];
  if (lobby) {
    for (const p of lobby.players) {
      if (p.pending) continue;
      const l = p.lane;
      W.honkT[l] = Math.max(0, (W.honkT[l] || 0) - dt);
      // geese mill about the pond while they wait
      const a = clock * 0.55 + l * 1.7;
      const x = 1.6 + (l % 3) * 2.8 + Math.sin(a) * 1.4;
      const vx = Math.cos(a) * 0.77;
      const honking = W.honkT[l] > 0;
      W.leg[l] += Math.abs(vx) * dt * 5 * (honking ? 0 : 1);
      geese.push({ lane: l, x, z: 0, vx: Math.abs(vx) * 2, flags: 0, hat: p.hat, name: p.name, phase: W.leg[l], honk: W.honkT[l], me: false, flip: vx < 0 && !honking });
    }
  }
  R.update(dt);
  R.draw({ theme: 'meadow', course: null, t: null, clock, lanes: [0, 1, 2, 3, 4, 5, 6, 7], geese, meLane: null, removed: W.removed, extras: [] });
}

function raceFrame(dt) {
  const t = W.raceT();
  if (introEl && t > -3.3) { const e = introEl; e.classList.add('out'); setTimeout(() => e.remove(), 400); introEl = null; }
  if (t < 0.9 && t > -3.05) {
    const c = Math.ceil(-t);
    if (c !== lastCount) {
      lastCount = c;
      if (c > 0 && c <= 3) { U.bigText(overlay, String(c), 'count'); A.beep(c); }
      else if (c <= 0) { U.bigText(overlay, 'HONK!', 'count go'); A.beep(0); A.honk(0.9, 0.5); }
    }
  }
  const geese = W.geese(t, null, dt);
  W.tickFarmer(dt);
  W.packCamera(geese, dt, R.w);
  R.update(dt);
  R.draw(W.scene(t, clock, geese, {}));
  standings(geese);
  const hu = $('#tvHurry');
  if (W.left != null) { hu.classList.remove('hidden'); hu.textContent = `⏱ ${W.left}s left!`; A.setMusicRate(1.18); } else hu.classList.add('hidden');
}

let rowEls = {};
function standings(geese) {
  if (!W.course) return;
  const box = $('#tvStand');
  const rank = W.ranking(geese);
  const rowH = Math.max(22, Math.round(R.h * 0.3 / 8.4));
  box.style.setProperty('--rh', rowH - 3 + 'px');
  if (Object.keys(rowEls).length !== geese.length) {
    box.innerHTML = '';
    rowEls = {};
    for (const g of geese) {
      const e = h('div', 'st-row');
      e.style.setProperty('--c', S.COLORS[g.lane]);
      e.innerHTML = `<span class="st-rk"></span><span class="st-nm">${esc(g.name)}${g.bot ? ' 🤖' : ''}</span><span class="st-bar"><i></i></span>`;
      box.appendChild(e);
      rowEls[g.lane] = e;
    }
  }
  rank.forEach((lane, i) => {
    const e = rowEls[lane];
    if (!e) return;
    const g = geese.find((q) => q.lane === lane);
    e.style.transform = `translateY(${i * rowH}px)`;
    e.querySelector('.st-rk').textContent = W.finPlace[lane] ? ['🥇', '🥈', '🥉'][W.finPlace[lane] - 1] || '🏁' : i + 1;
    e.querySelector('.st-bar i').style.width = Math.min(100, (g.x / W.course.len) * 100) + '%';
  });
  box.style.height = geese.length * rowH + 'px';
}

function idleFrame(dt) {
  const t = W.raceT();
  const geese = W.course ? W.geese(t, null, dt) : [];
  if (W.course) { W.packCamera(geese, dt, R.w); R.update(dt); R.draw(W.scene(t, clock, geese, {})); }
}

let last = performance.now();
let clock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock += dt;
  if (mode === 'lobby') lobbyFrame(dt);
  else if (mode === 'race') raceFrame(dt);
  else idleFrame(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('resize', () => R.resize());
