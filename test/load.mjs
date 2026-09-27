// Load check: N rooms × M scripted phones racing at once against any server.
//   npm run load -- https://goosy-race.fly.dev 40 8
// The target must allow that many rooms/sockets from one IP, e.g. temporarily:
//   fly secrets set GOOSY_CREATE_LIMIT=1000 GOOSY_SOCKETS_PER_IP=1000   (unset them afterwards)
import WebSocket from 'ws';

const [base = 'http://localhost:3333', nRooms = '10', perRoom = '8'] = process.argv.slice(2);
const wsBase = base.replace(/^http/, 'ws');
let snaps = 0, maxGap = 0, finals = 0, errors = 0;

async function room(i) {
  const r = await fetch(`${base}/api/rooms`, { method: 'POST' });
  if (!r.ok) { errors++; console.log('create failed', r.status); return; }
  const { code } = await r.json();
  for (let p = 0; p < +perRoom; p++) {
    const ws = new WebSocket(`${wsBase}/ws?room=${code}`);
    let race = null, x = 0, seed = null, lastSnap = 0;
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', name: `L${i}-${p}` }));
      // everyone presses Start; only the real host's press counts
      setTimeout(() => ws.send(JSON.stringify({ type: 'start' })), 1500);
    });
    ws.on('error', () => { errors++; });
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.type === 'phase' && m.phase === 'race') race = m;
      if (m.type === 'final') { finals++; ws.close(); }
      if (m.type === 'snap' && p === 0) {
        snaps++;
        const now = Date.now();
        if (lastSnap) maxGap = Math.max(maxGap, now - lastSnap);
        lastSnap = now;
      }
    });
    const speed = 5 + Math.random() * 2;
    setInterval(() => {
      if (!race || ws.readyState !== 1) return;
      if (race.seed !== seed) { seed = race.seed; x = 0; }
      const t = (Date.now() - race.startAt) / 1000;
      if (t < 0 || x >= race.len) return;
      x += speed * 0.05;
      ws.send(JSON.stringify({ type: 's', t, x, z: 0, vx: speed, f: 0 }));
      if (x >= race.len) ws.send(JSON.stringify({ type: 'fin', t }));
    }, 50);
  }
}

console.log(`load: ${nRooms} rooms × ${perRoom} phones → ${base}`);
for (let i = 0; i < +nRooms; i++) room(i);
const t0 = Date.now();
const iv = setInterval(() => {
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s  snaps/s(room0-hosts): ${snaps}  worst snapshot gap: ${maxGap} ms  games finished: ${finals / +perRoom}/${nRooms}  errors: ${errors}`);
  snaps = 0; maxGap = 0;
  if (finals >= +nRooms * +perRoom) { clearInterval(iv); process.exit(0); }
}, 5000);
