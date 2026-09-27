import { COLORS, OBS, bikeLanePos, F } from '../shared/sim.js';

const TAU = Math.PI * 2;
const OUT = '#2a2140';
const FONT = "'Fredoka', 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif";

export function hash(i, s = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(s | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const PAL = {
  meadow: { skyTop: '#5dbcf7', skyBot: '#d9f2ff', laneA: '#7fd155', laneB: '#72c64a', div: 'rgba(255,255,255,0.4)', tuft: '#57a838', edge: '#4f9a33' },
  ice: { skyTop: '#86bde8', skyBot: '#eef8ff', laneA: '#d3ecff', laneB: '#c2e3fb', div: 'rgba(255,255,255,0.95)', tuft: '#ffffff', edge: '#9ccbee' },
  night: { skyTop: '#070b26', skyBot: '#3a2b5e', laneA: '#4b4459', laneB: '#433d51', div: 'rgba(255,214,150,0.22)', tuft: '#5a5369', edge: '#2e2839' },
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function fs(ctx, fill, stroke, lw) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function star(ctx, x, y, r, pts = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * TAU - Math.PI / 2;
    const rad = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------- hats
export function drawHat(ctx, hat, color, t) {
  ctx.lineJoin = 'round';
  switch (hat) {
    case 'tophat':
      rr(ctx, -10, -25, 20, 24, 2); fs(ctx, '#1f1b2e', OUT, 2.5);
      ctx.fillStyle = color; ctx.fillRect(-10, -9, 20, 5);
      rr(ctx, -16, -3, 32, 5, 2.5); fs(ctx, '#1f1b2e', OUT, 2.5);
      break;
    case 'party': {
      ctx.save(); ctx.rotate(0.18);
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineTo(0, -30); ctx.closePath();
      fs(ctx, color, null);
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3.5;
      for (let i = -3; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-20, i * 9); ctx.lineTo(20, i * 9 - 12); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineTo(0, -30); ctx.closePath();
      fs(ctx, null, OUT, 2.5);
      ell(ctx, 0, -31, 5, 5); fs(ctx, '#fff27a', OUT, 2);
      ctx.restore();
      break;
    }
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.lineTo(14, -17); ctx.lineTo(7, -8); ctx.lineTo(0, -20); ctx.lineTo(-7, -8); ctx.lineTo(-14, -17); ctx.closePath();
      fs(ctx, '#ffc93c', OUT, 2.5);
      ell(ctx, 0, -5, 3, 3); fs(ctx, '#ff3b6b');
      ell(ctx, -8, -4, 2.2, 2.2); fs(ctx, '#3b8bff');
      ell(ctx, 8, -4, 2.2, 2.2); fs(ctx, '#35d07f');
      ell(ctx, 0, -20, 2.5, 2.5); fs(ctx, '#fff', OUT, 1.5);
      break;
    case 'cowboy':
      ctx.beginPath();
      ctx.moveTo(-10, -3); ctx.bezierCurveTo(-11, -22, -3, -17, 0, -20); ctx.bezierCurveTo(3, -17, 11, -22, 10, -3); ctx.closePath();
      fs(ctx, '#a0662f', OUT, 2.5);
      ctx.fillStyle = '#5b3517'; ctx.fillRect(-10, -8, 20, 4);
      ctx.beginPath(); ctx.moveTo(-24, -6); ctx.quadraticCurveTo(0, 6, 24, -6); ctx.quadraticCurveTo(0, 0, -24, -6); ctx.closePath();
      fs(ctx, '#b87333', OUT, 2.5);
      break;
    case 'beanie':
      ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI, 0); ctx.closePath(); fs(ctx, color, OUT, 2.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      for (let i = -8; i <= 8; i += 4) { ctx.beginPath(); ctx.moveTo(i, -3); ctx.lineTo(i * 0.8, -12); ctx.stroke(); }
      rr(ctx, -14, -5, 28, 7, 3); fs(ctx, '#f7f3ea', OUT, 2.5);
      ell(ctx, 0, -17, 5.5, 5.5); fs(ctx, '#fff', OUT, 2.2);
      break;
    case 'chef':
      ell(ctx, -7, -17, 8, 8); fs(ctx, '#fff', OUT, 2.5);
      ell(ctx, 7, -17, 8, 8); fs(ctx, '#fff', OUT, 2.5);
      ell(ctx, 0, -22, 9, 9); fs(ctx, '#fff', OUT, 2.5);
      rr(ctx, -10, -11, 20, 11, 2); fs(ctx, '#fff', OUT, 2.5);
      ctx.fillStyle = '#fff'; ctx.fillRect(-8.5, -14, 17, 5);
      break;
    case 'viking':
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * 9, -6); ctx.quadraticCurveTo(d * 22, -8, d * 20, -26); ctx.quadraticCurveTo(d * 16, -13, d * 6, -12); ctx.closePath();
        fs(ctx, '#f4ead2', OUT, 2.5);
      }
      ctx.beginPath(); ctx.arc(0, -1, 12, Math.PI, 0); ctx.closePath(); fs(ctx, '#a9b3c2', OUT, 2.5);
      rr(ctx, -13, -4, 26, 5, 2); fs(ctx, '#c79a3a', OUT, 2);
      for (const d of [-6, 0, 6]) { ell(ctx, d, -1.5, 1.3, 1.3); fs(ctx, '#7a5a1a'); }
      break;
    case 'propeller': {
      ctx.beginPath(); ctx.arc(0, -1, 12, Math.PI, 0); ctx.closePath(); fs(ctx, color, OUT, 2.5);
      ctx.save(); ctx.beginPath(); ctx.arc(0, -1, 12, Math.PI, 0); ctx.clip();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-4, -14, 8, 14);
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, -1, 12, Math.PI, 0); ctx.closePath(); fs(ctx, null, OUT, 2.5);
      ctx.beginPath(); ctx.moveTo(8, -1); ctx.lineTo(19, 0); ctx.lineTo(9, 2); fs(ctx, color, OUT, 2);
      ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, -19); ctx.stroke();
      const sp = Math.cos(t * 28) * 14;
      ell(ctx, 0, -20, Math.abs(sp) + 1, 2.5); fs(ctx, '#ff4d5e', OUT, 1.8);
      ell(ctx, 0, -20, 2, 2); fs(ctx, '#fff', OUT, 1.5);
      break;
    }
    case 'tulip':
      ctx.strokeStyle = '#2f8f3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(2, -10, 0, -18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(10, -8, 11, -16); ctx.quadraticCurveTo(4, -12, 0, -6); fs(ctx, '#3fb34f', OUT, 1.5);
      ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(-4, -24); ctx.lineTo(0, -32); ctx.lineTo(4, -24); ctx.lineTo(8, -30); ctx.quadraticCurveTo(9, -18, 0, -17); ctx.quadraticCurveTo(-9, -18, -8, -30); ctx.closePath();
      fs(ctx, '#ff3b5c', OUT, 2.2);
      break;
    case 'wizard': {
      ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(12, -2); ctx.quadraticCurveTo(4, -20, 10, -38); ctx.quadraticCurveTo(-2, -24, -12, -2); ctx.closePath();
      fs(ctx, '#5b3fd0', OUT, 2.5);
      ctx.fillStyle = '#ffe066';
      star(ctx, -2, -12, 3.5); ctx.fill(); star(ctx, 5, -22, 2.5); ctx.fill();
      ell(ctx, 0, -1, 18, 4); fs(ctx, '#4a31b0', OUT, 2.5);
      break;
    }
  }
}

// ---------------------------------------------------------------- goose
// o: {size, color, hat, phase, run(0..1), air, fly, stun, yeet, spin, honk, fin, frozen, splat, wob, t, dunk}
export function drawGoose(ctx, x, y, o) {
  const k = o.size / 100;
  const t = o.t;
  ctx.save();
  ctx.translate(x, y);
  // shadow
  if (!o.dunk) {
    const sh = 1 / (1 + (o.zUnits || 0) * 0.7);
    ctx.fillStyle = 'rgba(20,10,40,0.22)';
    ell(ctx, 0, 0, 38 * k * sh, 9 * k * sh); ctx.fill();
  }
  ctx.translate(0, -(o.zPx || 0));
  ctx.scale(o.flip ? -k : k, k);
  if (o.dunk) {
    // head poking out of the water, shivering
    ctx.save();
    ctx.beginPath(); ctx.rect(-80, -200, 200, 200); ctx.clip();
    ctx.translate(Math.sin(t * 60) * 1.5, 40 + Math.max(0, 1 - o.dunk) * 10);
  }
  if (o.yeet) { ctx.translate(0, -48); ctx.rotate(o.spin); ctx.translate(0, 48); }
  const run = o.run || 0;
  const bob = o.air || o.fly ? 0 : Math.abs(Math.sin(o.phase)) * 5 * run;
  ctx.translate(0, -bob);
  if (o.wob) ctx.rotate(Math.sin(t * 50) * 0.08);
  ctx.rotate(-0.1 * run);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // legs
  const legs = (back) => {
    let a;
    if (o.fly || o.yeet) a = back ? -1.1 + Math.sin(t * 30) * 0.4 : -0.9 + Math.cos(t * 30) * 0.4;
    else if (o.air) a = back ? -0.7 : -0.4;
    else if (o.frozen || o.stun) a = back ? -0.15 : 0.15;
    else a = Math.sin(o.phase + (back ? Math.PI : 0)) * (0.2 + run * 0.55);
    // a foot is lifted while it swings forward (cos > 0) and planted while it pushes back
    const lift = !o.air && !o.fly ? Math.max(0, Math.cos(o.phase + (back ? Math.PI : 0))) * 9 * run : 6;
    const hx = back ? -3 : 6, hy = -28;
    const fx = hx + Math.sin(a) * 26, fy = hy + Math.cos(a) * 28 - lift;
    const col = back ? '#e07a10' : '#ff9a1f';
    ctx.strokeStyle = OUT; ctx.lineWidth = 8.5;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - 4, fy - 2); ctx.lineTo(fx + 14, fy + 1); ctx.lineTo(fx + 10, fy + 4); ctx.lineTo(fx - 3, fy + 3); ctx.closePath();
    fs(ctx, col, OUT, 2.5);
  };
  legs(true);

  // tail
  ctx.beginPath(); ctx.moveTo(-28, -60); ctx.quadraticCurveTo(-46, -66, -54, -74); ctx.quadraticCurveTo(-46, -52, -30, -40); ctx.closePath();
  fs(ctx, '#f4f6fb', OUT, 3.5);
  // body
  ell(ctx, 0, -48, 38, 25, -0.08); fs(ctx, '#ffffff', OUT, 3.5);
  ctx.save(); ell(ctx, 0, -48, 38, 25, -0.08); ctx.clip();
  ctx.fillStyle = '#e6eaf2'; ell(ctx, 6, -26, 40, 12); ctx.fill();
  ctx.restore();
  legs(false);

  // neck + head position
  let hx = 30 + run * 12, hy = -100 + run * 14;
  if (o.honk > 0) { hx = 50; hy = -84; }
  if (o.stun) { hx = 30 + Math.sin(t * 9) * 5; hy = -94; }
  if (o.frozen) { hx = 28; hy = -106; }
  if (o.fin) { hy -= 4 + Math.abs(Math.sin(t * 6)) * 5; }
  if (o.fly) { hx = 44; hy = -86; }
  const nbx = 20, nby = -60;
  ctx.strokeStyle = OUT; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(nbx, nby); ctx.quadraticCurveTo(nbx + 6, (nby + hy) / 2 - 6, hx - 2, hy + 4); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 15;
  ctx.beginPath(); ctx.moveTo(nbx, nby); ctx.quadraticCurveTo(nbx + 6, (nby + hy) / 2 - 6, hx - 2, hy + 4); ctx.stroke();
  // body patch over neck root
  ell(ctx, 16, -56, 12, 10); fs(ctx, '#fff');

  // wing
  if (o.fly || o.air || o.yeet) {
    const fl = o.fly || o.yeet ? Math.sin(t * 26) : Math.sin(t * 18) * 0.6;
    ctx.save(); ctx.translate(2, -58); ctx.rotate(-0.9 - fl * 0.7);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-20, -30, -44, -28); ctx.quadraticCurveTo(-34, -14, -38, -6); ctx.quadraticCurveTo(-20, 4, 0, 0); ctx.closePath();
    fs(ctx, '#eef1f7', OUT, 3);
    ctx.restore();
  } else {
    const flutter = o.wob ? Math.sin(t * 40) * 0.2 : 0;
    ctx.save(); ctx.translate(-6, -50); ctx.rotate(-0.18 + flutter - run * 0.1);
    ctx.beginPath(); ctx.moveTo(22, -6); ctx.quadraticCurveTo(0, -18, -26, -4); ctx.quadraticCurveTo(-8, 10, 22, -6); ctx.closePath();
    fs(ctx, '#eef1f7', OUT, 3);
    ctx.strokeStyle = '#c9cfdb'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(-6, 0); ctx.moveTo(-12, -8); ctx.lineTo(2, -5); ctx.stroke();
    ctx.restore();
  }

  // scarf
  const sc = o.color;
  const sx = nbx + 5, sy = nby - 10;
  const wave = Math.sin(t * 14 + o.phase) * 5;
  const trail = 10 + run * 16;
  ctx.beginPath();
  ctx.moveTo(sx - 4, sy + 2);
  ctx.quadraticCurveTo(sx - trail * 0.6, sy + 4 + wave, sx - trail - 6, sy + 6 - wave);
  ctx.lineTo(sx - trail - 4, sy + 14 - wave);
  ctx.quadraticCurveTo(sx - trail * 0.5, sy + 12 + wave, sx - 2, sy + 10);
  ctx.closePath();
  fs(ctx, sc, OUT, 2.5);
  ctx.save(); ctx.translate(sx + 2, sy + 2); ctx.rotate(0.35);
  rr(ctx, -11, -6, 22, 11, 5); fs(ctx, sc, OUT, 2.8);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-6, 3); ctx.moveTo(1, -4); ctx.lineTo(1, 3); ctx.stroke();
  ctx.restore();

  // head
  ell(ctx, hx, hy, 14, 13); fs(ctx, '#ffffff', OUT, 3.5);
  // beak
  const open = o.honk > 0 ? 0.35 + Math.sin(t * 40) * 0.1 : 0;
  ctx.save(); ctx.translate(hx + 10, hy + 1);
  ctx.save(); ctx.rotate(-open);
  ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(12, -6, 22, 0); ctx.lineTo(-1, 2); ctx.closePath();
  fs(ctx, '#ff9a1f', OUT, 2.8);
  ctx.restore();
  ctx.save(); ctx.rotate(open * 0.7);
  ctx.beginPath(); ctx.moveTo(-1, 1); ctx.lineTo(19, 2); ctx.quadraticCurveTo(10, 7, -2, 6); ctx.closePath();
  fs(ctx, '#f07c0c', OUT, 2.5);
  ctx.restore();
  ell(ctx, 0, -6, 4.5, 4); fs(ctx, '#ff9a1f', OUT, 2.2);
  ctx.restore();
  if (o.honk > 0) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = clamp(o.honk * 1.5 - i * 0.15, 0, 1);
      ctx.beginPath(); ctx.arc(hx + 34, hy, 6 + i * 7, -0.6, 0.6); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // eye
  const ex = hx + 4, ey = hy - 3;
  if (o.stun) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(ex - 3.5, ey - 3.5); ctx.lineTo(ex + 3.5, ey + 3.5); ctx.moveTo(ex + 3.5, ey - 3.5); ctx.lineTo(ex - 3.5, ey + 3.5); ctx.stroke();
  } else if (o.fin) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ex, ey + 2, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  } else {
    const big = o.frozen || o.yeet ? 1.35 : 1;
    ell(ctx, ex, ey, 5 * big, 5 * big); fs(ctx, '#fff', OUT, 1.8);
    ell(ctx, ex + 1, ey, 2.8 * big, 3 * big); fs(ctx, OUT);
    ell(ctx, ex + 1.8, ey - 1.2, 1, 1); fs(ctx, '#fff');
    if (run > 0.55 && !o.frozen && !o.yeet) {
      ctx.strokeStyle = OUT; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(ex - 5, ey - 9); ctx.lineTo(ex + 6, ey - 5); ctx.stroke();
    }
  }
  // blush
  ctx.fillStyle = 'rgba(255,120,150,0.35)'; ell(ctx, hx - 3, hy + 5, 4, 2.5); ctx.fill();

  // egg yolk on face
  if (o.splat) {
    ctx.fillStyle = '#ffd21f'; ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const r = 11 + (i % 2) * 4; ctx.lineTo(hx + 2 + Math.cos(a) * r, hy - 2 + Math.sin(a) * r * 0.9); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb000'; ell(ctx, hx + 3, hy - 3, 5, 5); ctx.fill();
  }

  // hat
  if (o.hat) {
    ctx.save(); ctx.translate(hx - 1, hy - 10); ctx.rotate(-0.12 + (o.stun ? Math.sin(t * 9) * 0.2 : 0));
    drawHat(ctx, o.hat, o.color, t);
    ctx.restore();
  }
  // dizzy stars
  if (o.stun) {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * TAU) / 3;
      star(ctx, hx + Math.cos(a) * 20, hy - 28 + Math.sin(a) * 6, 5.5);
      fs(ctx, '#ffe34d', OUT, 1.8);
    }
  }
  if (o.dunk) ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- farmer
function drawFarmer(ctx, x, footY, H, t, leaving) {
  const k = H / 220;
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ph = t * 11;
  ctx.fillStyle = 'rgba(20,10,40,0.25)'; ell(ctx, 0, 0, 60, 12); ctx.fill();
  const bob = Math.abs(Math.sin(ph)) * 6;
  ctx.translate(0, -bob);
  const leg = (s, col) => {
    const a = Math.sin(ph + s) * 0.7;
    ctx.save(); ctx.translate(0, -95); ctx.rotate(a);
    rr(ctx, -11, 0, 22, 70, 9); fs(ctx, col, OUT, 4);
    ctx.translate(0, 72); ctx.rotate(-a * 0.6);
    rr(ctx, -12, -8, 36, 20, 8); fs(ctx, '#5a3a22', OUT, 4);
    ctx.restore();
  };
  leg(Math.PI, '#2f5fa8');
  // broom (behind)
  const sw = leaving ? -0.4 + Math.sin(t * 4) * 0.2 : Math.sin(t * 9) * 0.9 - 0.2;
  ctx.save(); ctx.translate(18, -150); ctx.rotate(1.1 + sw);
  ctx.strokeStyle = OUT; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 120); ctx.stroke();
  ctx.strokeStyle = '#a86b32'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 120); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 115); ctx.lineTo(8, 115); ctx.lineTo(30, 175); ctx.lineTo(-30, 175); ctx.closePath();
  fs(ctx, '#f1c24b', OUT, 4);
  ctx.strokeStyle = '#c8962a'; ctx.lineWidth = 2.5;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 2, 120); ctx.lineTo(i * 9, 172); ctx.stroke(); }
  rr(ctx, -10, 110, 20, 10, 3); fs(ctx, '#c0392b', OUT, 3);
  ctx.restore();
  leg(0, '#3a6fc0');
  // torso: plaid shirt + overalls
  rr(ctx, -34, -170, 68, 84, 26); fs(ctx, '#d8433a', OUT, 4.5);
  ctx.save(); rr(ctx, -34, -170, 68, 84, 26); ctx.clip();
  ctx.strokeStyle = 'rgba(80,10,20,0.35)'; ctx.lineWidth = 5;
  for (let i = -40; i < 40; i += 14) { ctx.beginPath(); ctx.moveTo(i, -175); ctx.lineTo(i, -80); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-40, -170 + (i + 40)); ctx.lineTo(40, -170 + (i + 40)); ctx.stroke(); }
  ctx.restore();
  rr(ctx, -30, -130, 60, 50, 12); fs(ctx, '#3a6fc0', OUT, 4);
  ctx.strokeStyle = '#3a6fc0'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-22, -128); ctx.lineTo(-18, -168); ctx.moveTo(22, -128); ctx.lineTo(18, -168); ctx.stroke();
  ell(ctx, -20, -126, 4, 4); fs(ctx, '#ffd23f', OUT, 2); ell(ctx, 20, -126, 4, 4); fs(ctx, '#ffd23f', OUT, 2);
  rr(ctx, -12, -115, 24, 16, 4); fs(ctx, '#2f5fa8', OUT, 3);
  // arms
  const arm = (a, front) => {
    ctx.save(); ctx.translate(front ? 22 : -24, -158); ctx.rotate(a);
    rr(ctx, -10, 0, 20, 58, 10); fs(ctx, '#d8433a', OUT, 4);
    ell(ctx, 0, 62, 11, 11); fs(ctx, '#f6c29b', OUT, 4);
    ctx.restore();
  };
  arm(Math.sin(ph) * 0.9, false);
  arm(-0.9 - sw * 0.6, true);
  // head
  ell(ctx, 4, -196, 30, 30); fs(ctx, '#f6c29b', OUT, 4.5);
  // beard
  ctx.beginPath(); ctx.moveTo(-22, -196); ctx.quadraticCurveTo(-24, -150, 8, -150); ctx.quadraticCurveTo(38, -152, 34, -196); ctx.quadraticCurveTo(10, -176, -22, -196); ctx.closePath();
  fs(ctx, '#d9622b', OUT, 4);
  // mouth yelling
  ell(ctx, 16, -178, 9, 7 + Math.abs(Math.sin(t * 14)) * 3); fs(ctx, '#5a1020', OUT, 3);
  // moustache
  ctx.beginPath(); ctx.moveTo(0, -186); ctx.quadraticCurveTo(14, -196, 30, -186); ctx.quadraticCurveTo(38, -178, 42, -186); ctx.quadraticCurveTo(30, -174, 16, -184); ctx.quadraticCurveTo(4, -176, -8, -184); ctx.closePath();
  fs(ctx, '#c24f1e', OUT, 3);
  // nose
  ell(ctx, 28, -196, 9, 8); fs(ctx, '#ff8c7a', OUT, 3.5);
  // eyes & angry brows
  ell(ctx, 14, -206, 4.5, 5); fs(ctx, '#fff', OUT, 2); ell(ctx, 16, -205, 2.2, 2.6); fs(ctx, OUT);
  ell(ctx, 32, -207, 4, 4.5); fs(ctx, '#fff', OUT, 2); ell(ctx, 34, -206, 2, 2.4); fs(ctx, OUT);
  ctx.strokeStyle = OUT; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(6, -218); ctx.lineTo(22, -212); ctx.moveTo(28, -213); ctx.lineTo(40, -218); ctx.stroke();
  // straw hat
  ell(ctx, 4, -222, 50, 11, -0.08); fs(ctx, '#f4d06f', OUT, 4);
  ctx.beginPath(); ctx.moveTo(-22, -224); ctx.quadraticCurveTo(-18, -256, 6, -254); ctx.quadraticCurveTo(28, -256, 30, -226); ctx.closePath();
  fs(ctx, '#f4d06f', OUT, 4);
  ctx.fillStyle = '#c0392b'; ctx.fillRect(-21, -234, 50, 8);
  ctx.restore();
}

// ---------------------------------------------------------------- bike (front view, riding toward camera)
function drawBike(ctx, x, gy, u, t, seed) {
  const k = u / 100;
  ctx.save(); ctx.translate(x, gy); ctx.scale(k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(20,10,40,0.25)'; ell(ctx, 0, 0, 30, 7); ctx.fill();
  const coat = ['#2f6fdf', '#e8553f', '#2aa876', '#8c5bd6', '#f2a43a'][Math.floor(hash(seed, 3) * 5)];
  const hair = ['#3a2a1a', '#e2b04a', '#7a3a1a', '#222'][Math.floor(hash(seed, 4) * 4)];
  const ped = Math.sin(t * 14);
  // legs
  ctx.strokeStyle = OUT; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(-9, -82); ctx.lineTo(-14, -40 + ped * 8); ctx.moveTo(9, -82); ctx.lineTo(14, -40 - ped * 8); ctx.stroke();
  ctx.strokeStyle = '#2b3a67'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-9, -82); ctx.lineTo(-14, -40 + ped * 8); ctx.moveTo(9, -82); ctx.lineTo(14, -40 - ped * 8); ctx.stroke();
  // wheel
  ell(ctx, 0, -30, 6, 30); fs(ctx, '#333', OUT, 3);
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -70); ctx.stroke();
  // basket with tulips
  rr(ctx, -16, -64, 32, 20, 4); fs(ctx, '#b07a3c', OUT, 3);
  ctx.strokeStyle = '#7d5220'; ctx.lineWidth = 1.5;
  for (let i = -10; i <= 10; i += 6) { ctx.beginPath(); ctx.moveTo(i, -63); ctx.lineTo(i, -46); ctx.stroke(); }
  for (let i = 0; i < 3; i++) { ell(ctx, -8 + i * 8, -69 - (i % 2) * 3, 4, 5); fs(ctx, ['#ff3b5c', '#ffd23f', '#ff7ab8'][i], OUT, 1.5); }
  // torso
  rr(ctx, -20, -125, 40, 50, 14); fs(ctx, coat, OUT, 3.5);
  // arms to handlebar
  ctx.strokeStyle = OUT; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(-16, -112); ctx.lineTo(-26, -80); ctx.moveTo(16, -112); ctx.lineTo(26, -80); ctx.stroke();
  ctx.strokeStyle = coat; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-16, -112); ctx.lineTo(-26, -80); ctx.moveTo(16, -112); ctx.lineTo(26, -80); ctx.stroke();
  // handlebar
  ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-32, -78); ctx.quadraticCurveTo(0, -86, 32, -78); ctx.stroke();
  // lamp
  ell(ctx, 0, -76, 6, 6); fs(ctx, '#fff6b0', OUT, 2.5);
  // head
  ell(ctx, 0, -142, 16, 17); fs(ctx, '#f6c29b', OUT, 3.5);
  ctx.beginPath(); ctx.arc(0, -146, 17, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(14, -150); ctx.quadraticCurveTo(0, -140, -14, -150); ctx.closePath(); fs(ctx, hair, OUT, 3);
  ell(ctx, -6, -140, 2.2, 2.6); fs(ctx, OUT); ell(ctx, 6, -140, 2.2, 2.6); fs(ctx, OUT);
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -134, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  // bell ring marks
  if (Math.sin(t * 7 + seed) > 0.3) {
    ctx.strokeStyle = '#ffe34d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(38, -92); ctx.lineTo(48, -100); ctx.moveTo(40, -80); ctx.lineTo(52, -80); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- obstacles
function drawObstacle(ctx, o, x, gy, u, laneH, t, knocked, theme, ur = u) {
  const bobT = t * 4 + o.x;
  switch (o.t) {
    case 'fence': {
      ctx.save(); ctx.translate(x, gy);
      if (knocked) { ctx.rotate(1.35); ctx.translate(0, -2); }
      const h = 0.7 * u, w = 0.54 * u;
      ctx.lineJoin = 'round';
      for (const px of [-w / 2, w / 2]) { rr(ctx, px - 0.06 * u, -h, 0.12 * u, h, 2); fs(ctx, '#c98b4b', OUT, 2); }
      for (const ry of [0.3, 0.62]) { rr(ctx, -w / 2 - 0.1 * u, -h * ry - 0.05 * u, w + 0.2 * u, 0.11 * u, 2); fs(ctx, '#e0a560', OUT, 2); }
      ctx.restore();
      break;
    }
    case 'hay': {
      ctx.save(); ctx.translate(x, gy);
      const w = 0.9 * u, h = (knocked ? 0.38 : 0.66) * u;
      rr(ctx, -w / 2, -h, w, h, 0.12 * u); fs(ctx, '#f2c14e', OUT, 2.2);
      ctx.strokeStyle = '#c99422'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { const yy = -h + (i + 0.5) * h / 5; ctx.beginPath(); ctx.moveTo(-w / 2 + 3, yy); ctx.lineTo(w / 2 - 3, yy + 1); ctx.stroke(); }
      ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w / 4, -h); ctx.lineTo(-w / 4, 0); ctx.moveTo(w / 4, -h); ctx.lineTo(w / 4, 0); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'puddle': {
      const rx = Math.max(1.1 * ur, 0.9 * u), ry = laneH * 0.22;
      const night = theme === 'night';
      ell(ctx, x, gy - ry * 0.3, rx, ry); fs(ctx, night ? '#26335e' : '#8a5a35', OUT, 2);
      ell(ctx, x - rx * 0.1, gy - ry * 0.4, rx * 0.8, ry * 0.6); fs(ctx, night ? '#34457a' : '#a36e45');
      ctx.fillStyle = night ? 'rgba(255,220,150,0.5)' : 'rgba(255,255,255,0.45)';
      ell(ctx, x - rx * 0.35, gy - ry * 0.55, rx * 0.25, ry * 0.18); ctx.fill();
      break;
    }
    case 'hole': {
      const rx = Math.max(0.72 * ur, 0.6 * u), ry = laneH * 0.26;
      ctx.save(); ctx.translate(x, gy - ry * 0.2);
      ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; const r = 1 + (hash(i, o.v) - 0.5) * 0.18; ctx.lineTo(Math.cos(a) * rx * r, Math.sin(a) * ry * r); }
      ctx.closePath(); fs(ctx, '#ffffff', '#8cc4ea', 2);
      ell(ctx, 0, ry * 0.1, rx * 0.82, ry * 0.72); fs(ctx, '#0f4c81');
      ctx.strokeStyle = 'rgba(160,220,255,0.7)'; ctx.lineWidth = 1.5;
      const rp = (t * 0.8 + o.x) % 1;
      ell(ctx, 0, ry * 0.1, rx * 0.7 * rp, ry * 0.6 * rp); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'snowman': {
      ctx.save(); ctx.translate(x, gy); ctx.scale(1.08, 1.08);
      if (knocked) {
        ell(ctx, -0.25 * u, -0.2 * u, 0.3 * u, 0.2 * u); fs(ctx, '#fff', OUT, 2);
        ell(ctx, 0.25 * u, -0.15 * u, 0.2 * u, 0.15 * u); fs(ctx, '#fff', OUT, 2);
        ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.moveTo(0.4 * u, -0.15 * u); ctx.lineTo(0.62 * u, -0.1 * u); ctx.lineTo(0.4 * u, -0.08 * u); ctx.fill();
      } else {
        ell(ctx, 0, -0.26 * u, 0.3 * u, 0.26 * u); fs(ctx, '#fff', OUT, 2);
        ell(ctx, 0, -0.66 * u, 0.22 * u, 0.2 * u); fs(ctx, '#fff', OUT, 2);
        ell(ctx, 0, -0.98 * u, 0.16 * u, 0.15 * u); fs(ctx, '#fff', OUT, 2);
        ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.moveTo(-0.02 * u, -0.98 * u); ctx.lineTo(-0.28 * u, -0.95 * u); ctx.lineTo(-0.02 * u, -0.93 * u); ctx.fill();
        ctx.fillStyle = OUT; ell(ctx, -0.06 * u, -1.03 * u, 0.025 * u, 0.025 * u); ctx.fill();
        rr(ctx, -0.13 * u, -1.28 * u, 0.26 * u, 0.18 * u, 2); fs(ctx, '#1f1b2e');
        ctx.fillRect(-0.2 * u, -1.12 * u, 0.4 * u, 0.04 * u);
        ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-0.18 * u, -0.66 * u); ctx.lineTo(-0.45 * u, -0.85 * u); ctx.moveTo(0.18 * u, -0.66 * u); ctx.lineTo(0.45 * u, -0.8 * u); ctx.stroke();
        ctx.fillStyle = '#e8453c'; ctx.fillRect(-0.18 * u, -0.84 * u, 0.36 * u, 0.06 * u);
      }
      ctx.restore();
      break;
    }
    case 'bollard': {
      ctx.save(); ctx.translate(x, gy);
      if (knocked) ctx.rotate(1.2);
      const w = 0.25 * u, h = 0.74 * u;
      rr(ctx, -w / 2, -h, w, h, w / 2); fs(ctx, '#8e1f2a', OUT, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2 + 1, -h * 0.8, w - 2, h * 0.14);
      ctx.fillRect(-w / 2 + 1, -h * 0.55, w - 2, h * 0.08);
      ctx.restore();
      break;
    }
    case 'bread': case 'oliebol': case 'vlaai': {
      const b = Math.sin(bobT) * 0.06 * u;
      const cy = gy - 0.52 * u + b;
      const r = 0.23 * u;
      ctx.fillStyle = 'rgba(20,10,40,0.15)'; ell(ctx, x, gy, r, r * 0.3); ctx.fill();
      ctx.save(); ctx.translate(x, cy);
      if (o.t === 'bread') {
        rr(ctx, -r * 1.2, -r * 0.8, r * 2.4, r * 1.6, r * 0.7); fs(ctx, '#e3a14f', OUT, 2);
        ctx.strokeStyle = '#b8742a'; ctx.lineWidth = 1.8;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.6 - r * 0.2, -r * 0.6); ctx.lineTo(i * r * 0.6 + r * 0.2, -r * 0.1); ctx.stroke(); }
      } else if (o.t === 'oliebol') {
        ell(ctx, 0, 0, r, r * 0.95); fs(ctx, '#b4722e', OUT, 2);
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 6; i++) { ell(ctx, (hash(i, o.v) - 0.5) * r * 1.2, -r * 0.4 + (hash(i + 9, o.v) - 0.5) * r * 0.6, r * 0.18, r * 0.12); ctx.fill(); }
      } else {
        ctx.beginPath(); ctx.moveTo(-r * 1.2, r * 0.5); ctx.lineTo(r * 1.2, r * 0.5); ctx.lineTo(0, -r * 1.1); ctx.closePath(); fs(ctx, '#e8b563', OUT, 2);
        ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.2); ctx.lineTo(r * 0.8, r * 0.2); ctx.lineTo(0, -r * 0.7); ctx.closePath(); fs(ctx, '#c8102e');
        ell(ctx, -r * 0.2, -r * 0.1, r * 0.15, r * 0.15); fs(ctx, '#ff4b5c');
      }
      ctx.restore();
      if (Math.sin(bobT * 2.3) > 0.7) { star(ctx, x + r * 1.1, cy - r, r * 0.4, 4); fs(ctx, '#fff8c4'); }
      break;
    }
    case 'tramp': {
      // round backyard trampoline, side view: legs, padded rim, springy mat
      const w = 0.62 * Math.max(u, ur * 1.1), h = 0.34 * u;
      const sq = Math.max(0, Math.sin(t * 9 + o.x)) * 0.04 * u;
      ctx.save(); ctx.translate(x, gy);
      ctx.fillStyle = 'rgba(20,10,40,0.18)'; ell(ctx, 0, 0, w * 1.05, laneH * 0.12); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      for (const lx of [-0.75, -0.25, 0.25, 0.75]) { ctx.beginPath(); ctx.moveTo(lx * w, -h * 0.55); ctx.lineTo(lx * w * 1.05, 0); ctx.stroke(); }
      ell(ctx, 0, -h + sq, w, h * 0.42); fs(ctx, '#1f1b2e');
      ctx.save(); ell(ctx, 0, -h + sq, w, h * 0.42); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.28, -h * 1.6); ctx.lineTo(i * w * 0.28, -h * 0.3); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth = Math.max(4, h * 0.34); ctx.strokeStyle = OUT;
      ell(ctx, 0, -h, w, h * 0.42); ctx.stroke();
      ctx.lineWidth = Math.max(2.5, h * 0.22);
      ctx.setLineDash([Math.max(4, w * 0.25), Math.max(4, w * 0.25)]);
      ctx.strokeStyle = '#ff4d5e'; ell(ctx, 0, -h, w, h * 0.42); ctx.stroke();
      ctx.lineDashOffset = Math.max(4, w * 0.25); ctx.strokeStyle = '#4fb3ff'; ell(ctx, 0, -h, w, h * 0.42); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      // bouncy arrows to say "land here"
      if (!knocked) {
        const b = Math.abs(Math.sin(t * 5 + o.x)) * 0.18 * u;
        ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-0.14 * u, -h - 0.35 * u - b); ctx.lineTo(0.14 * u, -h - 0.35 * u - b); ctx.lineTo(0, -h - 0.58 * u - b); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'egg': {
      const b = Math.sin(bobT * 1.3) * 0.08 * u;
      const cy = gy - 0.6 * u + b;
      const rx = 0.23 * u, ry = 0.3 * u;
      ctx.fillStyle = 'rgba(255,200,40,0.28)'; ell(ctx, x, cy, rx * 2.2, ry * 2); ctx.fill();
      ctx.fillStyle = 'rgba(20,10,40,0.15)'; ell(ctx, x, gy, rx, rx * 0.3); ctx.fill();
      ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.sin(bobT) * 0.2);
      ctx.beginPath(); ctx.moveTo(0, -ry); ctx.bezierCurveTo(rx * 1.3, -ry, rx * 1.2, ry, 0, ry); ctx.bezierCurveTo(-rx * 1.2, ry, -rx * 1.3, -ry, 0, -ry);
      const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#e89a00');
      fs(ctx, g, OUT, 2.2);
      ctx.fillStyle = OUT; ctx.font = `700 ${Math.round(ry * 1.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, ry * 0.08);
      ctx.restore();
      break;
    }
  }
}

// ---------------------------------------------------------------- backdrops
function drawCloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ell(ctx, x, y, 30 * s, 13 * s); ctx.fill();
  ell(ctx, x - 16 * s, y + 2 * s, 17 * s, 10 * s); ctx.fill();
  ell(ctx, x + 14 * s, y - 6 * s, 18 * s, 13 * s); ctx.fill();
  ell(ctx, x - 2 * s, y - 10 * s, 14 * s, 11 * s); ctx.fill();
}

function drawWindmill(ctx, x, base, h, t, i) {
  const w = h * 0.34;
  ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(x - w * 0.3, base - h); ctx.lineTo(x + w * 0.3, base - h); ctx.lineTo(x + w / 2, base); ctx.closePath();
  fs(ctx, '#8a5a44', OUT, 1.5);
  ctx.beginPath(); ctx.moveTo(x - w * 0.38, base - h); ctx.quadraticCurveTo(x, base - h * 1.35, x + w * 0.38, base - h); ctx.closePath(); fs(ctx, '#5e3a2b', OUT, 1.5);
  rr(ctx, x - w * 0.1, base - h * 0.28, w * 0.2, h * 0.28, 2); fs(ctx, '#3b2a22');
  const hx = x, hy = base - h * 0.98;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(t * (0.8 + hash(i, 5) * 0.6) + i);
  for (let b = 0; b < 4; b++) {
    ctx.rotate(TAU / 4);
    ctx.fillStyle = '#f5ecd9'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.fillRect(h * 0.04, -h * 0.05, h * 0.62, h * 0.1); ctx.strokeRect(h * 0.04, -h * 0.05, h * 0.62, h * 0.1);
    ctx.strokeStyle = 'rgba(80,50,30,0.5)';
    for (let j = 1; j < 5; j++) { ctx.beginPath(); ctx.moveTo(h * 0.04 + j * h * 0.12, -h * 0.05); ctx.lineTo(h * 0.04 + j * h * 0.12, h * 0.05); ctx.stroke(); }
  }
  ctx.restore();
  ell(ctx, hx, hy, h * 0.05, h * 0.05); fs(ctx, '#3b2a22');
}

function hillPath(ctx, w, base, amp, off, f, seed) {
  ctx.beginPath(); ctx.moveTo(0, base + 60);
  for (let x = 0; x <= w + 8; x += 8) {
    const X = x + off;
    const y = base - amp * (0.55 + 0.3 * Math.sin(X * f + seed) + 0.15 * Math.sin(X * f * 2.7 + seed * 2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, base + 60); ctx.closePath();
}
function hillY(X, base, amp, f, seed) {
  return base - amp * (0.55 + 0.3 * Math.sin(X * f + seed) + 0.15 * Math.sin(X * f * 2.7 + seed * 2));
}

function drawMeadowBack(ctx, w, H, cam, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PAL.meadow.skyTop); g.addColorStop(1, PAL.meadow.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, H + 2);
  const sr = Math.min(40, H * 0.16);
  const sx = w * 0.84, sy = H * 0.26;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.15);
  ctx.fillStyle = 'rgba(255,236,140,0.35)';
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(sr * 1.1, -sr * 0.18); ctx.lineTo(sr * 2.1, 0); ctx.lineTo(sr * 1.1, sr * 0.18); ctx.fill(); }
  ctx.restore();
  ell(ctx, sx, sy, sr, sr); fs(ctx, '#ffe066', '#ffc93c', 3);
  const cs = H / 160;
  const off1 = cam * 1.2 + t * 6;
  for (let i = Math.floor(off1 / 240) - 1; i < (off1 + w) / 240 + 1; i++) {
    drawCloud(ctx, i * 240 - off1 + hash(i, 1) * 100, H * (0.14 + hash(i, 2) * 0.22), cs * (0.7 + hash(i, 3) * 0.6));
  }
  const off2 = cam * 3;
  hillPath(ctx, w, H, H * 0.42, off2, 0.004, 1); fs(ctx, '#a8dd7c');
  const off3 = cam * 6;
  const sp = 380;
  for (let i = Math.floor(off3 / sp) - 1; i < (off3 + w) / sp + 1; i++) {
    const X = i * sp + hash(i, 7) * 160;
    const x = X - off3;
    drawWindmill(ctx, x, hillY(X, H, H * 0.3, 0.006, 3) + 4, H * (0.34 + hash(i, 8) * 0.12), t, i);
  }
  hillPath(ctx, w, H, H * 0.3, off3, 0.006, 3); fs(ctx, '#8fd05f');
  // tulip rows
  const off4 = cam * 16;
  const rows = [['#ff3b5c', 0.9], ['#ffd23f', 0.95], ['#ff7ab8', 1]];
  for (let rI = 0; rI < rows.length; rI++) {
    const y = H - 12 + rI * 4;
    ctx.fillStyle = rows[rI][0];
    const gap = 7;
    const blockW = 90;
    for (let x = -((off4 + rI * 30) % gap); x < w; x += gap) {
      const blk = Math.floor((x + off4) / blockW);
      if (hash(blk, rI) < 0.25) continue;
      ell(ctx, x, y, 2.6, 3); ctx.fill();
    }
  }
  ctx.fillStyle = '#5da33c'; ctx.fillRect(0, H - 2, w, 3);
}

function drawIceBack(ctx, w, H, cam, t, snow) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PAL.ice.skyTop); g.addColorStop(1, PAL.ice.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, H + 2);
  ell(ctx, w * 0.2, H * 0.25, H * 0.12, H * 0.12); fs(ctx, 'rgba(255,255,240,0.9)');
  const off1 = cam * 2;
  const sp = 160;
  for (let i = Math.floor(off1 / sp) - 1; i < (off1 + w) / sp + 2; i++) {
    const x = i * sp - off1;
    const mh = H * (0.4 + hash(i, 1) * 0.35);
    ctx.beginPath(); ctx.moveTo(x - 110, H); ctx.lineTo(x, H - mh); ctx.lineTo(x + 110, H); ctx.closePath(); fs(ctx, '#a9c6e0');
    ctx.beginPath(); ctx.moveTo(x - 32, H - mh + mh * 0.3); ctx.lineTo(x, H - mh); ctx.lineTo(x + 32, H - mh + mh * 0.3); ctx.lineTo(x + 12, H - mh + mh * 0.22); ctx.lineTo(x, H - mh + mh * 0.32); ctx.lineTo(x - 14, H - mh + mh * 0.22); ctx.closePath(); fs(ctx, '#fff');
  }
  // canal houses
  const off2 = cam * 7;
  const hw = 34;
  const cols = ['#b5523b', '#7d3b2b', '#d9c7a3', '#5a6e8c', '#9c4a3a', '#e3d6b8'];
  for (let i = Math.floor(off2 / hw) - 1; i < (off2 + w) / hw + 1; i++) {
    const x = i * hw - off2;
    const hh = H * (0.32 + hash(i, 2) * 0.22);
    const top = H - 8 - hh;
    ctx.fillStyle = cols[Math.floor(hash(i, 3) * cols.length)];
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, H - 8); ctx.lineTo(x, top);
    const gable = hash(i, 4);
    if (gable < 0.5) { ctx.lineTo(x + 5, top); ctx.lineTo(x + 5, top - 6); ctx.lineTo(x + 10, top - 6); ctx.lineTo(x + 10, top - 12); ctx.lineTo(x + hw - 10, top - 12); ctx.lineTo(x + hw - 10, top - 6); ctx.lineTo(x + hw - 5, top - 6); ctx.lineTo(x + hw - 5, top); }
    else ctx.lineTo(x + hw / 2, top - 14);
    ctx.lineTo(x + hw, top); ctx.lineTo(x + hw, H - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    if (gable < 0.5) ctx.fillRect(x + 9, top - 13, hw - 18, 3); else { ctx.beginPath(); ctx.moveTo(x + hw / 2, top - 15); ctx.lineTo(x + hw / 2 + 8, top - 9); ctx.lineTo(x + hw / 2 - 8, top - 9); ctx.fill(); }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const wy = top + 6 + r * (hh / 3.4);
      if (wy > H - 16) continue;
      ctx.fillStyle = hash(i * 7 + r * 3 + c, 5) > 0.4 ? '#ffe28a' : '#384a66';
      ctx.fillRect(x + 7 + c * 12, wy, 7, 9);
    }
  }
  // pines
  const off3 = cam * 12;
  const ps = 58;
  for (let i = Math.floor(off3 / ps) - 1; i < (off3 + w) / ps + 1; i++) {
    if (hash(i, 9) < 0.45) continue;
    const x = i * ps - off3 + hash(i, 6) * 30;
    const th = H * (0.28 + hash(i, 7) * 0.15);
    for (let l = 0; l < 3; l++) {
      const yb = H - 2 - l * th * 0.26, wd = th * (0.36 - l * 0.08);
      ctx.beginPath(); ctx.moveTo(x - wd, yb); ctx.lineTo(x, yb - th * 0.45); ctx.lineTo(x + wd, yb); ctx.closePath(); fs(ctx, '#2e7d5b', OUT, 1.2);
      ctx.beginPath(); ctx.moveTo(x - wd * 0.45, yb - th * 0.25); ctx.lineTo(x, yb - th * 0.45); ctx.lineTo(x + wd * 0.45, yb - th * 0.25); ctx.closePath(); fs(ctx, '#fff');
    }
  }
  ctx.fillStyle = '#e8f4ff'; ctx.fillRect(0, H - 4, w, 5);
  // snowfall (screen space)
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const s of snow) { ell(ctx, s.x, s.y, s.r, s.r); ctx.fill(); }
}

function drawSintServaas(ctx, x, base, h) {
  const c = '#241a45', win = '#ffcf6b';
  ctx.fillStyle = c;
  ctx.fillRect(x - h * 0.35, base - h * 0.45, h * 0.7, h * 0.45);
  for (const d of [-1, 1]) {
    const tx = x + d * h * 0.22;
    ctx.fillRect(tx - h * 0.09, base - h * 0.85, h * 0.18, h * 0.85);
    ctx.beginPath(); ctx.moveTo(tx - h * 0.1, base - h * 0.85); ctx.lineTo(tx, base - h * 1.02); ctx.lineTo(tx + h * 0.1, base - h * 0.85); ctx.fill();
    ctx.fillStyle = win; ctx.fillRect(tx - h * 0.025, base - h * 0.7, h * 0.05, h * 0.09); ctx.fillStyle = c;
  }
  ctx.fillRect(x - h * 0.06, base - h * 0.62, h * 0.12, h * 0.2);
  ctx.beginPath(); ctx.moveTo(x - h * 0.07, base - h * 0.62); ctx.lineTo(x, base - h * 1.12); ctx.lineTo(x + h * 0.07, base - h * 0.62); ctx.fill();
  ctx.fillStyle = win;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - h * 0.27 + i * h * 0.18, base - h * 0.25, h * 0.03, Math.PI, 0); ctx.rect(x - h * 0.3 + i * h * 0.18, base - h * 0.25, h * 0.06, h * 0.1); ctx.fill(); }
}
function drawSintJan(ctx, x, base, h) {
  ctx.fillStyle = '#6b2430';
  ctx.fillRect(x - h * 0.08, base - h * 0.9, h * 0.16, h * 0.9);
  ctx.fillStyle = '#7d2b38';
  ctx.fillRect(x - h * 0.065, base - h * 1.05, h * 0.13, h * 0.16);
  ctx.beginPath(); ctx.moveTo(x - h * 0.075, base - h * 1.05); ctx.lineTo(x, base - h * 1.3); ctx.lineTo(x + h * 0.075, base - h * 1.05); ctx.fill();
  ctx.fillStyle = '#241a45';
  ctx.fillRect(x - h * 0.35, base - h * 0.35, h * 0.3, h * 0.35);
  ctx.fillStyle = '#ffcf6b';
  ctx.fillRect(x - h * 0.02, base - h * 0.7, h * 0.04, h * 0.1);
  ell(ctx, x, base - h * 0.93, h * 0.035, h * 0.035); ctx.fill();
}

function drawNightBack(ctx, w, H, cam, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PAL.night.skyTop); g.addColorStop(1, PAL.night.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, H + 2);
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 1) * w, y = hash(i, 2) * H * 0.7;
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + hash(i, 3) * 2) + i));
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  const mx = w * 0.8, my = H * 0.22, mr = Math.min(26, H * 0.13);
  const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3);
  mg.addColorStop(0, 'rgba(255,240,200,0.35)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = mg; ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
  ell(ctx, mx, my, mr, mr); fs(ctx, '#fff4d6');
  ell(ctx, mx - mr * 0.3, my - mr * 0.2, mr * 0.18, mr * 0.18); fs(ctx, 'rgba(200,190,160,0.5)');
  ell(ctx, mx + mr * 0.3, my + mr * 0.3, mr * 0.12, mr * 0.12); ctx.fill();

  const riverTop = H * 0.8;
  // skyline
  const off = cam * 3;
  const base = riverTop;
  const hw = 26;
  for (let i = Math.floor(off / hw) - 1; i < (off + w) / hw + 1; i++) {
    const x = i * hw - off;
    const hh = H * (0.16 + hash(i, 4) * 0.14);
    ctx.fillStyle = '#2a1f4d';
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - hh); ctx.lineTo(x + hw / 2, base - hh - 9); ctx.lineTo(x + hw, base - hh); ctx.lineTo(x + hw, base); ctx.fill();
    for (let r = 0; r < 3; r++) {
      if (hash(i * 5 + r, 6) > 0.55) { ctx.fillStyle = '#ffcf6b'; ctx.fillRect(x + 6 + (r % 2) * 9, base - hh + 5 + r * 8, 4, 5); }
    }
  }
  const lsp = 700;
  for (let i = Math.floor(off / lsp) - 1; i < (off + w) / lsp + 1; i++) {
    const x = i * lsp - off + 200;
    if (i % 2 === 0) drawSintServaas(ctx, x, base, H * 0.62);
    else drawSintJan(ctx, x, base, H * 0.66);
  }
  // river Maas
  const rg = ctx.createLinearGradient(0, riverTop, 0, H);
  rg.addColorStop(0, '#1b2350'); rg.addColorStop(1, '#10163a');
  ctx.fillStyle = rg; ctx.fillRect(0, riverTop, w, H - riverTop + 2);
  for (let i = 0; i < 24; i++) {
    const x = ((hash(i, 8) * w + t * 12 * (hash(i, 9) + 0.3) - cam * 5) % w + w) % w;
    const y = riverTop + 3 + hash(i, 10) * (H - riverTop - 6);
    ctx.fillStyle = `rgba(255,${190 + Math.floor(hash(i, 11) * 60)},120,${0.3 + 0.4 * Math.abs(Math.sin(t * 2 + i))})`;
    ctx.fillRect(x, y, 6 + hash(i, 12) * 10, 1.5);
  }
  // Sint Servaasbrug arches
  const off2 = cam * 8;
  const as = 110;
  const deck = riverTop - H * 0.07;
  ctx.fillStyle = '#6d5a73';
  ctx.fillRect(0, deck, w, H * 0.035);
  for (let i = Math.floor(off2 / as) - 1; i < (off2 + w) / as + 1; i++) {
    const x = i * as - off2;
    ctx.fillStyle = '#5b4a63';
    ctx.beginPath(); ctx.moveTo(x, deck); ctx.lineTo(x + as, deck); ctx.lineTo(x + as, riverTop + 4);
    ctx.lineTo(x + as - 12, riverTop + 4); ctx.quadraticCurveTo(x + as / 2, deck - 2, x + 12, riverTop + 4); ctx.lineTo(x, riverTop + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a1f3a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#3a2f45'; ctx.fillRect(x + as - 4, deck - H * 0.09, 3, H * 0.09);
    const lg = ctx.createRadialGradient(x + as - 2.5, deck - H * 0.1, 1, x + as - 2.5, deck - H * 0.1, 12);
    lg.addColorStop(0, 'rgba(255,220,140,1)'); lg.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = lg; ctx.fillRect(x + as - 15, deck - H * 0.1 - 12, 25, 24);
  }
  ctx.fillStyle = '#2e2839'; ctx.fillRect(0, H - 3, w, 4);
}

// ---------------------------------------------------------------- renderer
export class Renderer {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.texts = [];
    this.snow = [];
    this.camX = 0;
    this.ppu = 40;
    this.shake = 0;
    this.flash = 0;
    this.tv = !!opts.tv;
    this.resize();
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.tv ? 1.5 : 1.6);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
    if (!this.snow.length) {
      for (let i = 0; i < 60; i++) this.snow.push({ x: Math.random() * 2000, y: Math.random() * 400, r: 0.8 + Math.random() * 1.8, v: 10 + Math.random() * 20 });
    }
  }

  layout(nLanes, single) {
    const skyH = Math.round(this.h * (single ? 0.52 : this.tv ? 0.3 : 0.2));
    const trackTop = skyH;
    const trackBot = this.h - (single ? this.h * 0.1 : 4);
    const laneH = (trackBot - trackTop) / nLanes;
    return { n: nLanes, skyH, trackTop, trackBot, laneH };
  }
  groundY(L, row) { return L.trackTop + L.laneH * (row + 0.78); }
  laneScale(L, row) { return L.n === 1 ? 1 : 0.84 + 0.16 * row / (L.n - 1); }
  sx(x) { return (x - this.camX) * this.ppu; }

  // --- particles (world x, lane row, height h in units)
  burst(type, x, row, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (opt.speed || 2) * (0.4 + Math.random() * 0.8);
      this.parts.push({
        type, x, row, h: opt.h != null ? opt.h : 0.2,
        vx: Math.cos(a) * sp + (opt.vx || 0), vh: Math.abs(Math.sin(a)) * sp * (opt.up || 1) + (opt.vh || 0),
        life: opt.life || 0.8, max: opt.life || 0.8, size: opt.size || 1, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12,
        color: opt.colors ? opt.colors[Math.floor(Math.random() * opt.colors.length)] : opt.color || '#fff',
        grav: opt.grav != null ? opt.grav : 6,
      });
    }
  }
  popText(text, x, row, color = '#fff', size = 1) {
    this.texts.push({ text, x, row, h: 1.6, life: 1.1, max: 1.1, color, size });
  }
  throwEgg(x0, r0, x1, r1) {
    this.parts.push({ type: 'eggfly', x: x0, row: r0, x0, r0, x1, r1, h: 1, life: 0.65, max: 0.65, rot: 0, vr: 14, vx: 0, vh: 0, grav: 0, size: 1 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.type === 'eggfly') {
        const q = 1 - p.life / p.max;
        p.x = p.x0 + (p.x1 - p.x0) * q; p.row = p.r0 + (p.r1 - p.r0) * q; p.h = 1 + Math.sin(Math.PI * q) * 4;
        p.rot += p.vr * dt;
        continue;
      }
      p.x += p.vx * dt; p.h += p.vh * dt; p.vh -= p.grav * dt; p.rot += p.vr * dt;
      if (p.type === 'feather' || p.type === 'confetti') { p.vx *= 0.97; if (p.vh < -1.2) p.vh = -1.2; }
      if (p.h < 0 && p.type !== 'ring') { p.h = 0; p.vh *= -0.3; p.vx *= 0.6; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const tx of this.texts) { tx.life -= dt; tx.h += dt * 1.2; }
    this.texts = this.texts.filter((tx) => tx.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.flash = Math.max(0, this.flash - dt * 2);
    for (const s of this.snow) {
      s.y += s.v * dt; s.x += Math.sin(s.y * 0.05) * 0.3 - dt * 8;
      if (s.y > this.h * 0.4) { s.y = -5; s.x = Math.random() * this.w; }
      if (s.x < 0) s.x += this.w;
    }
  }

  // scene: {theme, course, t, lanes:[laneIds], geese:[...], farmerX, meLane, removed:{lane:{taken,knocked}}, extras}
  draw(S) {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const single = S.lanes.length === 1;
    const L = this.layout(S.lanes.length, single);
    this.L = L;
    const rowOf = {};
    S.lanes.forEach((ln, i) => { rowOf[ln] = i; });
    this.rowOf = rowOf;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 10);
    const pal = PAL[S.theme] || PAL.meadow;
    const camRef = this.camX * 40 / 40;
    if (S.theme === 'ice') drawIceBack(ctx, w, L.skyH, camRef, S.clock, this.snow);
    else if (S.theme === 'night') drawNightBack(ctx, w, L.skyH, camRef, S.clock);
    else drawMeadowBack(ctx, w, L.skyH, camRef, S.clock);

    const x0 = this.camX - 2, x1 = this.camX + w / this.ppu + 2;
    const course = S.course;
    const len = course ? course.len : Infinity;

    // finish arch — back post & banner
    const fx = this.sx(len);
    const archVisible = fx > -120 && fx < w + 120;

    for (let row = 0; row < L.n; row++) {
      const lane = S.lanes[row];
      const top = L.trackTop + row * L.laneH;
      const gy = this.groundY(L, row);
      const sc = this.laneScale(L, row);
      const u = this.ppu * sc;
      // ground
      ctx.fillStyle = row % 2 ? pal.laneB : pal.laneA;
      ctx.fillRect(0, top, w, L.laneH + 1);
      if (S.meLane === lane && !single) {
        ctx.fillStyle = COLORS[lane] + '2e';
        ctx.fillRect(0, top, w, L.laneH + 1);
      }
      this.drawGroundTexture(ctx, S.theme, top, L.laneH, row, lane, x0, x1);
      ctx.fillStyle = pal.div; ctx.fillRect(0, top, w, 1.5);
      // start line
      const s0 = this.sx(0);
      if (s0 > -10 && s0 < w + 10) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(s0 - 2, top, 4, L.laneH); }
      // finish checker
      if (course && archVisible) {
        const cw = Math.max(4, L.laneH / 4);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#1f1b2e' : '#ffffff';
          ctx.fillRect(fx + c * cw - cw * 1.5, top + r * (L.laneH / 4), cw, L.laneH / 4 + 0.5);
        }
      }
      if (row === 0 && course && archVisible) this.drawArchBack(ctx, fx, L, S.theme);
      // draw hazards at the same visual scale as the geese (positions stay exact)
      const uv = single ? u : this.gooseSize(L, sc) / 1.25 * 0.85;
      if (course) this.drawLaneStuff(ctx, S, course, lane, row, top, gy, uv, L, x0, x1, single);
      // goose in this lane
      const g = S.geese.find((q) => q.lane === lane);
      if (g) this.drawGooseAt(ctx, g, gy, sc, S, L);
    }
    // front post of the arch
    if (course && archVisible) this.drawArchFront(ctx, fx, L, S.theme);
    this.drawOverlays(ctx, S, L, x0, x1, rowOf);
  }

  drawLaneStuff(ctx, S, course, lane, row, top, gy, u, L, x0, x1, single) {
    const w = this.w;
    const ur = this.ppu * this.laneScale(L, row);
    {
      // bike lanes
      for (const c of course.cross) {
        const cx = this.sx(c.x);
        if (cx < -80 || cx > w + 80) continue;
        const bw = 1.5 * this.ppu;
        ctx.fillStyle = '#a8433a'; ctx.fillRect(cx - bw / 2, top, bw, L.laneH + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(cx - bw / 2, top, 2, L.laneH + 1); ctx.fillRect(cx + bw / 2 - 2, top, 2, L.laneH + 1);
        if (row % 3 === 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
          const r = L.laneH * 0.14;
          ell(ctx, cx - r * 1.3, top + L.laneH * 0.55, r, r); ctx.stroke();
          ell(ctx, cx + r * 1.3, top + L.laneH * 0.55, r, r); ctx.stroke();
        }
      }
      // obstacles
      const rem = S.removed && S.removed[lane];
      const lst = course.lanes[lane];
      for (let i = 0; i < lst.length; i++) {
        const o = lst[i];
        if (o.x < x0 || o.x > x1) continue;
        const kind = OBS[o.t].kind;
        if ((kind === 'food' || kind === 'egg') && rem && rem.taken[i]) continue;
        drawObstacle(ctx, o, this.sx(o.x), gy, u, L.laneH, S.clock, rem && rem.knocked[i], S.theme, ur);
      }
      if (S.extras && S.extras[lane]) {
        for (const o of S.extras[lane]) {
          if (o.x < x0 || o.x > x1 || (rem && rem.taken[o.id])) continue;
          drawObstacle(ctx, o, this.sx(o.x), gy, u, L.laneH, S.clock, false, S.theme, ur);
        }
      }
      // bikes whose position rounds to this row
      if (S.t != null && !single) {
        for (let ci = 0; ci < course.cross.length; ci++) {
          const c = course.cross[ci];
          const cx = this.sx(c.x);
          if (cx < -80 || cx > w + 80) continue;
          for (let k = 0; k < 2; k++) {
            // draw each bike in the row of the lane it is crossing right now (rows can be reordered
            // so your own lane sits at the bottom; this keeps the bike's arrival exactly when it can hit you)
            const f = bikeLanePos(c, S.t, k);
            const off = f - lane;
            if (off < -0.5 || off >= 0.5) continue;
            const by = L.trackTop + L.laneH * (row + 0.78 + off);
            const seed = ci * 2 + k + Math.floor((S.t * c.speed + c.phase + k * 5.5) / 11) * 7;
            drawBike(ctx, cx, by, this.gooseSize(L, this.laneScale(L, row)) / 1.25 * 0.88, S.clock, seed);
          }
        }
      }
    }
  }

  drawOverlays(ctx, S, L, x0, x1, rowOf) {
    const { w, h } = this;
    // lanterns (night)
    if (S.theme === 'night') this.drawLights(ctx, L, x0, x1, S.clock);

    // farmer
    if (S.farmerX != null) {
      const fxs = this.sx(S.farmerX);
      if (fxs > -300 && fxs < w + 300) drawFarmer(ctx, fxs, L.trackBot - 2, Math.min(L.trackBot - L.trackTop + L.skyH * 0.5, this.h * 0.8), S.clock, S.farmerLeaving);
    }

    this.drawParticles(ctx, L);
    this.drawWarning(ctx, S, L);
    // name tags on top
    for (const g of S.geese) {
      const row = rowOf[g.lane];
      if (row == null) continue;
      this.drawTag(ctx, g, this.groundY(L, row), this.laneScale(L, row), S, L);
    }
    if (S.theme === 'night') {
      const vg = ctx.createRadialGradient(w / 2, h * 0.6, h * 0.3, w / 2, h * 0.6, h * 0.95);
      vg.addColorStop(0, 'rgba(10,5,30,0)'); vg.addColorStop(1, 'rgba(10,5,30,0.45)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    }
    if (S.frozen) { ctx.fillStyle = 'rgba(120,200,255,0.18)'; ctx.fillRect(0, 0, w, h); }
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  }

  drawGroundTexture(ctx, theme, top, lh, row, lane, x0, x1) {
    // each texture is built as ONE path and filled/stroked once — hundreds of tiny draw calls were the
    // main per-frame cost on phones
    const ppu = this.ppu;
    if (theme === 'meadow') {
      ctx.beginPath();
      const flowers = [];
      for (let i = Math.floor(x0 / 1.1); i < x1 / 1.1; i++) {
        const X = i * 1.1 + hash(i, lane) * 0.8;
        const x = this.sx(X), y = top + lh * (0.25 + hash(i, lane + 20) * 0.6);
        ctx.moveTo(x - 3, y); ctx.lineTo(x - 1, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + 2, y - 6); ctx.lineTo(x + 3, y); ctx.closePath();
        if (hash(i, lane + 40) > 0.85) flowers.push(x + 6, y - 2, hash(i, 3) > 0.5);
      }
      ctx.fillStyle = PAL.meadow.tuft; ctx.fill();
      for (let k = 0; k < flowers.length; k += 3) { ctx.fillStyle = flowers[k + 2] ? '#fff' : '#ffe14d'; ctx.fillRect(flowers[k] - 2, flowers[k + 1] - 2, 4, 4); }
    } else if (theme === 'ice') {
      ctx.beginPath();
      for (let i = Math.floor(x0 / 1.7); i < x1 / 1.7; i++) {
        const X = i * 1.7 + hash(i, lane) * 1.2;
        const x = this.sx(X), y = top + lh * (0.2 + hash(i, lane + 20) * 0.6);
        ctx.moveTo(x, y); ctx.lineTo(x + ppu * (0.4 + hash(i, 5) * 0.8), y + (hash(i, 6) - 0.5) * 4);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, top + lh * 0.1, this.w, 2);
    } else {
      const pitch = Math.max(0.36, 9 / ppu);
      const sw = pitch * ppu;
      const rowsN = 2;
      const rh = lh / rowsN;
      const round = !!ctx.roundRect;
      ctx.beginPath();
      for (let r = 0; r < rowsN; r++) {
        const offU = (r % 2) * pitch / 2;
        for (let i = Math.floor(x0 / pitch) - 1; i < x1 / pitch + 1; i++) {
          const x = this.sx(i * pitch + offU);
          if (round) ctx.roundRect(x + 1, top + r * rh + 1.5, sw - 2, rh - 3, Math.min(4, rh / 3));
          else ctx.rect(x + 1, top + r * rh + 1.5, sw - 2, rh - 3);
        }
      }
      ctx.fillStyle = PAL.night.tuft; ctx.fill();
    }
  }

  drawArchBack(ctx, fx, L, theme) {
    const top = L.trackTop - L.skyH * 0.55;
    ctx.fillStyle = '#e8e2f0'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.fillRect(fx - 5, top, 10, L.trackTop - top + L.laneH * 0.6); ctx.strokeRect(fx - 5, top, 10, L.trackTop - top + L.laneH * 0.6);
    const bw = Math.min(170, this.w * 0.46), bh = Math.max(20, L.skyH * 0.2);
    ctx.save(); ctx.translate(fx, top);
    rr(ctx, -bw / 2, -bh / 2, bw, bh, 6); fs(ctx, theme === 'night' ? '#c8102e' : '#ff4d5e', OUT, 2.5);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(bh * 0.62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(theme === 'night' ? '🏁 VRIJTHOF' : '🏁 FINISH', 0, 1);
    ctx.restore();
  }
  drawArchFront(ctx, fx, L) {
    ctx.fillStyle = '#e8e2f0'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    const y0 = L.trackBot - L.laneH * 2.5;
    ctx.fillRect(fx - 6, y0, 12, L.trackBot - y0); ctx.strokeRect(fx - 6, y0, 12, L.trackBot - y0);
  }

  drawLights(ctx, L, x0, x1, t) {
    const sp = 5;
    const y = L.trackTop + 2;
    const cols = ['#ff5a6e', '#ffd23f', '#4fe0ff', '#7dff8a', '#ff9ff3'];
    for (let i = Math.floor(x0 / sp) - 1; i < x1 / sp + 1; i++) {
      const a = this.sx(i * sp), b = this.sx((i + 1) * sp);
      ctx.strokeStyle = '#1b1530'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a, y); ctx.quadraticCurveTo((a + b) / 2, y + 22, b, y); ctx.stroke();
      for (let j = 1; j < 6; j++) {
        const q = j / 6;
        const bx = a + (b - a) * q, by = y + 2 * q * (1 - q) * 22 + 3;
        const col = cols[(i * 5 + j) % cols.length];
        const on = 0.6 + 0.4 * Math.sin(t * 3 + i + j);
        ctx.globalAlpha = on * 0.35; ctx.fillStyle = col; ell(ctx, bx, by, 7, 7); ctx.fill();
        ctx.globalAlpha = 1; ell(ctx, bx, by, 2.4, 3); ctx.fill();
      }
    }
  }

  // On phones the camera zooms out for look-ahead; keep geese sized by lane height so they stay readable.
  gooseSize(L, sc) {
    if (L.n === 1) return this.ppu * 1.35 * sc;
    const base = this.tv ? this.ppu * 1.25 : Math.max(this.ppu * 1.25, L.laneH * 1.5);
    return Math.min(base, L.laneH * 2.1) * sc;
  }

  // Pulsing chip at the right edge of your lane: "something's coming".
  drawWarning(ctx, S, L) {
    const wn = S.warn;
    const row = this.rowOf[S.meLane];
    if (!wn || row == null) return;
    const gy = this.groundY(L, row);
    const hgt = Math.max(34, Math.min(52, L.laneH * 1.25));
    const wd = hgt * 1.45;
    const pulse = 1 + Math.sin(S.clock * 12) * 0.06;
    const urgency = clamp(1 - (wn.d - 2) / 10, 0.45, 1);
    const cx = this.w - wd / 2 - 6, cy = gy - hgt * 0.45;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.55 + urgency * 0.45;
    rr(ctx, -wd / 2, -hgt / 2, wd, hgt, hgt / 2.4);
    fs(ctx, urgency > 0.8 ? '#ff5a4e' : '#ffc93c', OUT, 2.5);
    // chevron pointing back at the goose: it's coming toward you
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.moveTo(-wd / 2 + 6, 0); ctx.lineTo(-wd / 2 + 14, -7); ctx.lineTo(-wd / 2 + 14, 7); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath(); rr(ctx, -wd / 2 + 16, -hgt / 2 + 3, wd - 22, hgt - 6, hgt / 3); ctx.clip();
    const u = hgt * 0.62;
    if (wn.t === 'bike') drawBike(ctx, 6, hgt * 0.42, u * 0.5, S.clock, 3);
    else drawObstacle(ctx, { ...wn.o, x: 0 }, 6, hgt * (wn.t === 'puddle' || wn.t === 'hole' ? 0.1 : 0.4), u, hgt * 0.5, S.clock, false, S.theme);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawGooseAt(ctx, g, gy, sc, S, L) {
    const x = this.sx(g.x);
    if (x < -120 || x > this.w + 120) return;
    const size = this.gooseSize(L, sc);
    const fl = g.flags || 0;
    if (g.me && L.n > 1) {
      ctx.fillStyle = COLORS[g.lane] + '66';
      ell(ctx, x, gy, size * 0.55, size * 0.14); ctx.fill();
    }
    if ((fl & F.boost) && !(fl & F.fin)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const yy = gy - size * (0.2 + i * 0.16) - g.z * this.ppu;
        const off = ((S.clock * 30 + i * 13) % 20);
        ctx.beginPath(); ctx.moveTo(x - size * 0.6 - off, yy); ctx.lineTo(x - size * 0.6 - off - size * 0.4, yy); ctx.stroke();
      }
    }
    drawGoose(ctx, x, gy, {
      size, color: COLORS[g.lane], hat: g.hat, phase: g.phase || 0,
      run: clamp(g.vx / 7, 0, 1), zPx: g.z * this.ppu * sc, zUnits: g.z,
      air: g.z > 0.05 && !(fl & (F.fly | F.tramp)), fly: !!(fl & (F.fly | F.tramp)), stun: !!(fl & F.stun), yeet: !!(fl & F.yeet),
      spin: S.clock * 14, honk: g.honk || 0, flip: !!g.flip, fin: !!(fl & F.fin) && g.vx < 3, frozen: !!(fl & F.frozen),
      splat: !!(fl & F.splat), wob: g.wob > 0, t: S.clock + g.lane * 0.37, dunk: fl & F.dunk ? 0.5 : 0,
    });
    if (fl & F.dunk) {
      ctx.strokeStyle = 'rgba(200,235,255,0.9)'; ctx.lineWidth = 2;
      const r = (S.clock * 1.5) % 1;
      ell(ctx, x, gy - 2, size * (0.3 + r * 0.4), size * (0.06 + r * 0.06)); ctx.stroke();
    }
  }

  drawTag(ctx, g, gy, sc, S, L) {
    const x = this.sx(g.x);
    if (x < -100 || x > this.w + 100) return;
    const size = this.gooseSize(L, sc);
    const y = gy - size * 1.32 - g.z * this.ppu * sc - (g.hat ? size * 0.2 : 0);
    const col = COLORS[g.lane];
    if (g.me && !S.noYou) {
      const b = Math.sin(S.clock * 6) * 3;
      const fsz = Math.max(11, Math.round(size * 0.26));
      ctx.font = `700 ${fsz}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText('YOU').width + 14;
      ctx.save(); ctx.translate(x, y - 8 + b);
      rr(ctx, -tw / 2, -fsz * 0.75, tw, fsz * 1.5, fsz * 0.75); fs(ctx, col, OUT, 2.5);
      ctx.beginPath(); ctx.moveTo(-6, fsz * 0.72); ctx.lineTo(6, fsz * 0.72); ctx.lineTo(0, fsz * 0.72 + 8); ctx.closePath(); fs(ctx, col, OUT, 2.5);
      ctx.fillStyle = col; ctx.fillRect(-5, fsz * 0.6, 10, 3);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeText('YOU', 0, 1); ctx.fillText('YOU', 0, 1);
      ctx.restore();
      return;
    }
    if (S.hideNames) return;
    const fsz = Math.max(9, Math.round(Math.min(this.tv ? 24 : 15, size * 0.19)));
    ctx.font = `600 ${fsz}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = this.tv ? g.name + (g.bot ? ' 🤖' : '') : String(g.name).split(' ')[0].slice(0, 10);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,40,0.85)'; ctx.strokeText(label, x, y);
    ctx.fillStyle = col; ctx.fillText(label, x, y);
  }

  drawParticles(ctx, L) {
    const gy = (row) => (L.n === 1 ? this.groundY(L, 0) : L.trackTop + L.laneH * (row + 0.78));
    const rowOf = (l) => (this.rowOf && this.rowOf[l] != null ? this.rowOf[l] : l);
    for (const p of this.parts) {
      const x = this.sx(p.x);
      const pr = p.type === 'eggfly' ? rowOf(p.r0) + (rowOf(p.r1) - rowOf(p.r0)) * (1 - p.life / p.max) : rowOf(p.row);
      const y = gy(pr) - p.h * this.ppu;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = p.type === 'confetti' ? Math.min(1, a * 3) : a;
      const s = p.size * this.ppu;
      switch (p.type) {
        case 'dust': ell(ctx, x, y, s * 0.12 * (1.6 - a), s * 0.09 * (1.6 - a)); fs(ctx, p.color); break;
        case 'feather':
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ell(ctx, 0, 0, s * 0.14, s * 0.05); fs(ctx, '#fff', OUT, 1);
          ctx.restore(); break;
        case 'drop': ell(ctx, x, y, s * 0.05, s * 0.07); fs(ctx, p.color); break;
        case 'crumb': ctx.fillStyle = p.color; ctx.fillRect(x - 2, y - 2, 4, 4); break;
        case 'confetti':
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.fillRect(-s * 0.06, -s * 0.03, s * 0.12, s * 0.06 * Math.abs(Math.cos(p.rot * 2)) + 1);
          ctx.restore(); break;
        case 'spark': star(ctx, x, y, s * 0.12 * a + 2, 4); fs(ctx, p.color); break;
        case 'ring':
          ctx.strokeStyle = p.color; ctx.lineWidth = 4 * a;
          ell(ctx, x, y, s * (1 - a) * 4 * p.size, s * (1 - a) * 2.2 * p.size); ctx.stroke(); break;
        case 'poof': ell(ctx, x, y, s * 0.25 * (1.5 - a), s * 0.25 * (1.5 - a)); fs(ctx, 'rgba(255,255,255,0.85)'); break;
        case 'bread': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          rr(ctx, -s * 0.15, -s * 0.1, s * 0.3, s * 0.2, s * 0.08); fs(ctx, '#e3a14f', OUT, 1.5);
          ctx.restore(); break;
        }
        case 'eggfly': {
          ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ell(ctx, 0, 0, s * 0.16, s * 0.21); fs(ctx, '#e8ecd0', OUT, 2);
          ell(ctx, -s * 0.05, -s * 0.06, s * 0.04, s * 0.05); fs(ctx, '#8fa34a');
          ctx.restore(); break;
        }
      }
    }
    ctx.globalAlpha = 1;
    for (const tx of this.texts) {
      const x = this.sx(tx.x);
      const y = gy(rowOf(tx.row)) - tx.h * this.ppu;
      const a = clamp(tx.life / tx.max, 0, 1);
      const pop = 1 + Math.max(0, (tx.life - tx.max + 0.15) / 0.15) * 0.6;
      const fsz = Math.round(Math.max(14, this.ppu * 0.42) * tx.size * pop);
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `700 ${fsz}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(tx.text, x, y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}

// Stand-alone goose portrait for UI (lobby chips, podium, results).
export function drawGooseIcon(canvas, lane, hat, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const size = Math.min(w * 0.85, h * 0.6);
  drawGoose(ctx, w * 0.42, h * 0.96, {
    size, color: COLORS[lane], hat, phase: opts.phase || 0, run: opts.run || 0, t: opts.t || 0,
    honk: opts.honk || 0, fin: !!opts.happy, stun: !!opts.stun,
  });
}
