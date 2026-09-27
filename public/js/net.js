// WebSocket with auto-reconnect and a server clock estimate.
import { ROOM } from './room.js';

export class Net {
  constructor(onMsg) {
    this.onMsg = onMsg;
    this.offset = 0;
    this.bestRtt = Infinity;
    this.ws = null;
    this.onOpen = null;
    this.onClose = null;
    this.open = false;
    this.stopped = false;
    this.connect();
    setInterval(() => this.ping(), 2500);
  }
  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws${ROOM ? `?room=${ROOM}` : ''}`);
    this.ws = ws;
    ws.onopen = () => {
      this.open = true;
      for (let i = 0; i < 5; i++) setTimeout(() => this.ping(), i * 120);
      this.onOpen && this.onOpen();
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'pong') {
        const rtt = Date.now() - m.c;
        this.bestRtt *= 1.03;
        if (rtt <= this.bestRtt) {
          this.bestRtt = rtt;
          this.offset = m.s + rtt / 2 - Date.now();
        }
        this.rtt = rtt;
        return;
      }
      if (m.type !== 'noroom') this.backoff = 0;
      this.onMsg(m);
    };
    ws.onclose = () => {
      const was = this.open;
      this.open = false;
      if (was && this.onClose) this.onClose();
      if (this.stopped) return; // e.g. the room fell asleep: wait for resume()
      this.backoff = Math.min(10000, (this.backoff || 700) * 1.5);
      setTimeout(() => this.connect(), this.backoff);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  // Stop reconnecting (the server put the room to sleep / is full) until resume() is called.
  stop() { this.stopped = true; try { this.ws && this.ws.close(); } catch {} }
  resume() { if (!this.stopped) return; this.stopped = false; this.backoff = 0; this.connect(); }
  ping() { this.send({ type: 'ping', c: Date.now() }); }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  now() { return Date.now() + this.offset; }
}
