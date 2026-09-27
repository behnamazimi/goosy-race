// Everything you hear is synthesized — no audio files.
let ctx = null, master, sfxBus, musicBus, noiseBuf;
let muted = false;
try { muted = localStorage.getItem('goosy-muted') === '1'; } catch {}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicAllowed ? 0.32 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('goosy-muted', m ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}

const ok = () => ctx && ctx.state === 'running';

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(type, f0, f1, dur, vol = 0.3, when = 0, bus = sfxBus) {
  if (!ok()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.008, vol, dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, f0, f1, vol = 0.3, q = 1, type = 'bandpass', when = 0) {
  if (!ok()) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.005, vol, dur);
  s.connect(f); f.connect(g); g.connect(sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// A goose honk: nasal buzzy saw through a formant filter, pitch sagging.
export function honk(pitch = 1, vol = 0.5, long = false) {
  if (!ok()) return;
  const t = ctx.currentTime;
  const dur = long ? 0.5 : 0.24;
  const out = ctx.createGain();
  env(out, t, 0.015, vol, dur);
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1150 * pitch; f1.Q.value = 2.5;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2600 * pitch; f2.Q.value = 4;
  const mix = ctx.createGain(); mix.gain.value = 1;
  f1.connect(out); f2.connect(out); out.connect(sfxBus);
  for (const [type, det] of [['sawtooth', 0], ['square', 7], ['sawtooth', -11]]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = det;
    const base = 390 * pitch;
    o.frequency.setValueAtTime(base * 0.8, t);
    o.frequency.linearRampToValueAtTime(base, t + 0.03);
    o.frequency.linearRampToValueAtTime(base * 0.86, t + dur);
    o.connect(f1); o.connect(f2);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

export function megaHonk() {
  honk(0.7, 0.8, true);
  setTimeout(() => honk(0.62, 0.8, true), 180);
  tone('sawtooth', 110, 70, 0.7, 0.25);
}

let lastStep = 0;
export function step(foot) {
  if (!ok()) return;
  const now = ctx.currentTime;
  if (now - lastStep < 0.03) return;
  lastStep = now;
  const f = foot === 1 ? 900 : 1150;
  noise(0.05, f * 1.6, f, 0.35, 3);
  tone('sine', 190 + (foot === 1 ? 0 : 30), 120, 0.07, 0.25);
}
export function wrongStep() { tone('square', 180, 150, 0.08, 0.08); }
export function flap() { noise(0.22, 700, 2600, 0.3, 1.2); noise(0.18, 600, 2000, 0.2, 1.2, 'bandpass', 0.09); }
export function land() { noise(0.08, 500, 200, 0.25, 1, 'lowpass'); }
export function bonk() {
  tone('sine', 520, 70, 0.35, 0.5);
  noise(0.12, 900, 200, 0.4, 1, 'lowpass');
  tone('triangle', 260, 240, 0.4, 0.12, 0.05);
}
export function boing() { if (!ok()) return; const t = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(180, t); for (let i = 0; i < 6; i++) o.frequency.linearRampToValueAtTime(i % 2 ? 150 : 260, t + 0.05 * (i + 1)); env(g, t, 0.01, 0.3, 0.4); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.45); }
export function pickup() { [880, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.12, 0.2, i * 0.05)); }
export function egg() { [660, 880, 1100, 1320, 1760].forEach((f, i) => tone('square', f, f, 0.09, 0.09, i * 0.045)); }
export function itemReady() { tone('sine', 1320, 1760, 0.15, 0.2); tone('sine', 1760, 2350, 0.15, 0.15, 0.08); }
export function whoosh() { noise(0.5, 300, 3000, 0.35, 0.8); }
export function splash() { noise(0.6, 3500, 300, 0.45, 0.7, 'lowpass'); tone('sine', 300, 900, 0.18, 0.2); }
export function splat() { noise(0.25, 1200, 150, 0.6, 0.6, 'lowpass'); tone('sine', 200, 60, 0.3, 0.4); }
export function mud() { noise(0.3, 400, 150, 0.35, 2); }
export function yeet() {
  tone('sine', 400, 1800, 0.7, 0.25);
  noise(0.1, 1600, 300, 0.5, 1, 'lowpass');
  tone('square', 150, 60, 0.15, 0.2);
}
export function bell() {
  [0, 0.16].forEach((w) => { tone('sine', 2637, 2637, 0.35, 0.18, w); tone('sine', 3951, 3951, 0.25, 0.08, w); });
}
export function beep(n) { tone('square', n > 0 ? 660 : 1320, n > 0 ? 660 : 1320, n > 0 ? 0.18 : 0.5, 0.18); }
export function fanfare() {
  const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]];
  seq.forEach(([f, w]) => { tone('square', f, f, 0.2, 0.12, w); tone('triangle', f / 2, f / 2, 0.2, 0.15, w); });
}
export function sadTrombone() { [392, 370, 349, 330].forEach((f, i) => tone('sawtooth', f, i === 3 ? f * 0.9 : f, i === 3 ? 0.7 : 0.28, 0.1, i * 0.3)); }
export function alarm() { for (let i = 0; i < 3; i++) { tone('square', 880, 660, 0.18, 0.12, i * 0.22); } }
export function drumroll(dur = 1.2) { for (let i = 0; i < dur / 0.05; i++) noise(0.04, 1800, 900, 0.12, 1.5, 'bandpass', i * 0.05); }
export function pop() { tone('sine', 600, 1400, 0.08, 0.2); }
export function cheer() {
  for (let i = 0; i < 10; i++) noise(0.5 + Math.random() * 0.4, 1200 + Math.random() * 800, 700, 0.07, 0.6, 'bandpass', Math.random() * 0.4);
  fanfare();
}

// ---------------------------------------------------------------- music
const n = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = {
  lobby: {
    bpm: 104, lead: 'triangle',
    mel: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 74, 0, 72, 0, 0, 0, 74, 0, 77, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0],
    bass: [48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 60, 0, 53, 0, 60, 0, 50, 0, 57, 0, 55, 0, 62, 0, 48, 0, 55, 0, 43, 0, 55, 0],
  },
  meadow: {
    bpm: 138, lead: 'square', drums: true,
    mel: [72, 76, 79, 76, 77, 81, 79, 76, 74, 77, 76, 72, 74, 0, 67, 0, 72, 76, 79, 84, 83, 79, 81, 77, 79, 76, 74, 71, 72, 0, 72, 0],
    bass: [48, 0, 55, 0, 48, 0, 55, 0, 43, 0, 50, 0, 43, 0, 50, 0, 48, 0, 55, 0, 53, 0, 57, 0, 43, 0, 50, 0, 48, 0, 43, 0],
  },
  ice: {
    bpm: 126, lead: 'triangle', bell: true, drums: true,
    mel: [77, 0, 81, 84, 82, 81, 79, 0, 76, 79, 82, 79, 77, 0, 0, 0, 74, 77, 81, 77, 76, 74, 72, 0, 70, 74, 77, 76, 77, 0, 0, 0],
    bass: [41, 0, 48, 0, 41, 0, 48, 0, 36, 0, 43, 0, 36, 0, 43, 0, 46, 0, 53, 0, 46, 0, 53, 0, 36, 0, 43, 0, 41, 0, 48, 0],
  },
  night: {
    bpm: 150, lead: 'square', drums: true,
    mel: [69, 72, 76, 72, 74, 72, 71, 67, 69, 72, 76, 79, 77, 76, 74, 0, 72, 76, 81, 76, 79, 77, 76, 74, 72, 71, 69, 71, 69, 0, 64, 0],
    bass: [45, 57, 45, 57, 45, 57, 45, 57, 41, 53, 41, 53, 43, 55, 43, 55, 45, 57, 45, 57, 41, 53, 41, 53, 43, 55, 43, 55, 45, 57, 40, 52],
  },
};

let song = null, songStep = 0, nextNoteT = 0, sched = null, songRate = 1;

let musicAllowed = true;
// Phones go quiet on music when a big screen is playing it (eight unsynced phones = chaos).
export function allowMusic(on) {
  musicAllowed = on;
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.2);
}
export function playMusic(name, rate = 1) {
  if (!ctx) return;
  songRate = rate;
  if (song === SONGS[name]) return;
  song = SONGS[name] || null;
  songStep = 0;
  nextNoteT = ctx.currentTime + 0.1;
  if (!sched) sched = setInterval(schedule, 40);
}
export function setMusicRate(r) { songRate = r; }
export function stopMusic() { song = null; }

function schedule() {
  if (!song || !ok()) return;
  const stepDur = 60 / (song.bpm * songRate) / 2;
  while (nextNoteT < ctx.currentTime + 0.15) {
    const i = songStep % song.mel.length;
    const m = song.mel[i], b = song.bass[i];
    if (m) {
      tone(song.lead, n(m), n(m), stepDur * 0.9, song.lead === 'square' ? 0.07 : 0.14, nextNoteT - ctx.currentTime, musicBus);
      if (song.bell) tone('sine', n(m + 12), n(m + 12), stepDur * 1.6, 0.05, nextNoteT - ctx.currentTime, musicBus);
    }
    if (b) tone('triangle', n(b), n(b), stepDur * 0.95, 0.24, nextNoteT - ctx.currentTime, musicBus);
    if (song.drums) {
      const w = nextNoteT - ctx.currentTime;
      if (i % 4 === 0) {
        const t = nextNoteT;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        env(g, t, 0.003, 0.5, 0.14); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.16);
      }
      if (i % 2 === 1) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        const g = ctx.createGain(); env(g, nextNoteT, 0.002, 0.12, 0.04);
        s.connect(f); f.connect(g); g.connect(musicBus); s.start(nextNoteT, Math.random() * 0.5); s.stop(nextNoteT + 0.06);
      }
      if (i % 8 === 4) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
        const g = ctx.createGain(); env(g, nextNoteT, 0.002, 0.22, 0.12);
        s.connect(f); f.connect(g); g.connect(musicBus); s.start(nextNoteT, Math.random() * 0.5); s.stop(nextNoteT + 0.14);
        void w;
      }
    }
    nextNoteT += stepDur;
    songStep++;
  }
}

export function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}
