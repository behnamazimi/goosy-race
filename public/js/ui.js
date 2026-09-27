import * as S from '../shared/sim.js';
import * as A from './audio.js';
import { drawGooseIcon } from './render.js';

export const $ = (s, el = document) => el.querySelector(s);
export function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function gooseCanvas(lane, hat, cls = 'gicon', opts = {}) {
  const c = h('canvas', cls);
  requestAnimationFrame(() => drawGooseIcon(c, lane, hat, opts));
  return c;
}

let bannerTimer = null;
export function banner(root, title, sub = '', opts = {}) {
  let b = $('.banner', root);
  if (b) b.remove();
  b = h('div', 'banner ' + (opts.cls || ''));
  b.style.setProperty('--bc', opts.color || '#ff4d5e');
  b.innerHTML = `<div class="banner-in">${opts.icon ? `<div class="b-icon">${opts.icon}</div>` : ''}<div class="b-title">${title}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}</div>`;
  root.appendChild(b);
  clearTimeout(bannerTimer);
  if (opts.ms !== 0) bannerTimer = setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, opts.ms || 2600);
  return b;
}
export function clearBanner(root) {
  const b = $('.banner', root);
  if (b) { b.classList.add('out'); setTimeout(() => b.remove(), 400); }
}

export function bigText(root, text, cls = '') {
  const e = h('div', 'bigtext ' + cls, text);
  root.appendChild(e);
  setTimeout(() => e.remove(), 1000);
}

export function toast(text, ms = 2200) {
  let t = $('#toast');
  if (!t) { t = h('div', '', ''); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), ms);
}

// Round intro card
export function introCard(root, m, meLane) {
  const th = S.THEMES[m.theme];
  const el = h('div', 'intro');
  el.innerHTML = `
    <div class="intro-card theme-${m.theme}">
      <div class="intro-round">Round ${m.round + 1} of ${m.totalRounds}${m.double ? ' · <b>DOUBLE POINTS</b>' : ''}</div>
      <div class="intro-emoji">${th.emoji}</div>
      <div class="intro-name">${th.name}</div>
      <div class="intro-tip">${th.tip}</div>
      ${meLane != null ? `<div class="intro-you" style="--c:${S.COLORS[meLane]}">You're the <b>${S.COLOR_NAMES[meLane]}</b> scarf goose</div>` : ''}
    </div>`;
  root.appendChild(el);
  return el;
}

// Results between rounds: first the round order, then rows glide into overall standings.
export function resultsView(root, m, meId, opts = {}) {
  const el = h('div', 'panel results');
  const th = S.THEMES[m.theme];
  const nextTh = m.next ? S.THEMES[m.next] : null;
  el.innerHTML = `
    <div class="p-head"><div class="p-kicker">${th.emoji} ${th.name}${m.double ? ' · x2' : ''}</div><div class="p-title">Round ${m.round + 1} results</div></div>
    <div class="rows"></div>
    <div class="p-foot">
      <div class="next">${nextTh ? `Next up: <b>${nextTh.emoji} ${nextTh.name}</b>${m.round + 1 === m.totalRounds - 1 ? ' · <b class="dbl">DOUBLE POINTS</b>' : ''}` : '<b>🏆 Final ceremony next…</b>'} <span class="cd"></span></div>
      <div class="p-btns"></div>
    </div>`;
  const rowsEl = $('.rows', el);
  const H = opts.rowH || 46;
  rowsEl.style.height = m.rows.length * H + 'px';
  const rowEls = {};
  m.rows.forEach((r, i) => {
    const tot = m.totals.find((t) => t.id === r.id);
    const re = h('div', 'row' + (r.id === meId ? ' me' : ''));
    re.style.setProperty('--c', S.COLORS[r.lane]);
    re.style.transform = `translateY(${i * H}px)`;
    re.style.height = H - 6 + 'px';
    re.innerHTML = `<div class="rk">${medal(r.place)}</div><div class="gi"></div><div class="nm">${esc(r.name)}${r.bot ? ' <span class="bot">🤖</span>' : ''}</div>
      <div class="pts"><span class="plus">+${r.pts}</span><span class="tot">${tot ? tot.total : r.pts}</span></div>`;
    $('.gi', re).appendChild(gooseCanvas(r.lane, r.hat, 'gicon', { happy: r.place <= 3 }));
    rowsEl.appendChild(re);
    rowEls[r.id] = re;
    re.style.animationDelay = (m.rows.length - i) * 0.12 + 's';
  });
  setTimeout(() => {
    $('.p-title', el).textContent = 'Overall standings';
    el.classList.add('overall');
    m.totals.forEach((t, i) => {
      const re = rowEls[t.id];
      if (!re) return;
      re.style.transform = `translateY(${i * H}px)`;
      $('.rk', re).textContent = i + 1;
    });
  }, 3800);
  const cd = $('.cd', el);
  const iv = setInterval(() => {
    if (!el.isConnected) return clearInterval(iv);
    const s = Math.max(0, Math.ceil((m.until - Date.now()) / 1000));
    cd.textContent = `· ${s}s`;
  }, 250);
  root.appendChild(el);
  return el;
}

function medal(p) { return p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : p; }

export function finalView(root, m, meId, opts = {}) {
  const el = h('div', 'panel final');
  const st = m.standings;
  el.innerHTML = `
    <div class="p-head"><div class="p-kicker">Goosy Race · Grand Final</div><div class="p-title">The Golden Goose is…</div></div>
    <div class="podium"></div>
    <div class="awards"><div class="aw-title">🎖️ Everyone gets an award</div><div class="aw-list"></div></div>
    <div class="p-btns"></div>`;
  const pod = $('.podium', el);
  const order = [1, 0, 2];
  order.forEach((idx, k) => {
    const s = st[idx];
    if (!s) return;
    const step = h('div', `step s${idx + 1}`);
    step.style.setProperty('--c', S.COLORS[s.lane]);
    step.innerHTML = `<div class="who"><div class="gi"></div><div class="nm">${esc(s.name)}</div><div class="sc">${s.total} pts</div></div><div class="block">${idx + 1}</div>`;
    $('.gi', step).appendChild(gooseCanvas(s.lane, s.hat, 'gicon big', { happy: true }));
    step.style.animationDelay = [1.4, 0.1, 2.8][k] * 1 + 's';
    pod.appendChild(step);
  });
  A.drumroll(2.6);
  setTimeout(() => { A.cheer(); el.classList.add('revealed'); opts.onReveal && opts.onReveal(); }, 3000);

  const list = $('.aw-list', el);
  const ids = st.map((s) => s.id);
  const sorted = [...ids].sort((a, b) => (a === meId ? -1 : b === meId ? 1 : 0));
  sorted.forEach((id, i) => {
    const s = st.find((q) => q.id === id);
    const a = m.awards[id];
    if (!a) return;
    const card = h('div', 'award' + (id === meId ? ' me' : ''));
    card.style.setProperty('--c', S.COLORS[s.lane]);
    card.style.animationDelay = 3.6 + i * 0.35 + 's';
    card.innerHTML = `<div class="aw-icon">${a.icon}</div><div class="aw-body"><div class="aw-name">${esc(s.name)}${id === meId ? ' (you)' : ''}</div><div class="aw-t">${a.title}</div><div class="aw-s">${esc(a.sub)}</div></div>`;
    list.appendChild(card);
  });
  root.appendChild(el);
  return el;
}
