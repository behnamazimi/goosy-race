# AGENTS.md

Notes for AI coding agents and contributors working on Goosy Race. Player-facing information is in [README.md](README.md).

## What this is

A real-time multiplayer party race for up to 8 phones per room, with bots filling empty lanes. The stack is plain Node.js (≥ 26) with the `ws` and `qrcode` packages on the server, and vanilla ES modules in the browser: **no build step, no frameworks, no image or audio files**. Everything is drawn on a `<canvas>` and synthesized with Web Audio.

It's live at https://goosy-race.fly.dev: a single Fly.io machine in Amsterdam (`ams`).

## Commands

```bash
npm install
npm start                 # http://localhost:3333 (PORT to change); prints a LAN QR code in dev
npm test                  # unit tests + two-room end-to-end games (~45 s)
npm run load -- <url> <rooms> <phones>   # load check, e.g. npm run load -- http://localhost:3333 40 8
```

Dev shortcuts:
- `START_ROUND=2 npm start` starts games at round 3. It's ignored in production.
- `GOOSY_FAST=1` gives short intros, results screens and courses. The e2e tests use it.
- Opening a phone page with `?debug` (for example `/r/ABCDE?debug`) exposes `window.__goosy` with `{ st, W, R, S, onMsg, step(n, dt) }`. **Hidden browser tabs throttle `requestAnimationFrame`**, so in automated browser testing call `__goosy.step(n)` to advance frames, and use `onMsg` to inject server messages (for example `{type:'fx', k:'splat', d:5}`).

## Layout

| Path | Role |
|---|---|
| `server.js` | HTTP routes, static files (ETag + gzip), security headers/CSP, WebSocket entry, room registry, per-IP limits, tick loop, `/healthz`, graceful `SIGTERM` |
| `server/room.js` | `Room` class: one private game. Players and host, lobby, bots (`botThink`), race flow, items, surprise events, scoring and awards, message handling |
| `public/shared/sim.js` | **Shared** rules: course generation (seeded), goose physics, collisions, items (`applyFx`), constants. Imported by both server and browser |
| `public/js/render.js` | Canvas renderer: backgrounds, lanes, obstacles, geese, hats, farmer, bikes, particles |
| `public/js/world.js` | Client-side race mirror: snapshot interpolation, lane order, event visuals and sounds, pack camera |
| `public/js/phone.js` | Phone app: join screen, lobby/practice, controls, local goose sim, HUD, results and final panels |
| `public/js/tv.js` | Big-screen view |
| `public/js/landing.js`, `public/landing.html` | Home page: create a room or join by code |
| `public/js/net.js` | WebSocket with reconnect/backoff and server-clock sync |
| `public/js/room.js` | Room code from the URL, code formatting, `createAndGo()` |
| `public/js/audio.js` | Synth SFX and chiptune music |
| `public/js/ui.js` | Overlays: banners, countdown, results, podium and awards |
| `test/` | `sim.test.mjs` (unit), `rooms.e2e.mjs` and `idle.e2e.mjs` (real server), `helpers.mjs`, `load.mjs` |

Routes: `/` is the landing page, `/r/CODE` a phone, `/r/CODE/tv` the big screen. `POST /api/rooms` creates a room. The socket connects to `/ws?room=CODE`. `/qr.svg?room=` and `/info?room=` serve the QR code and share URL.

## How it works (and the rules to keep)

- **Rooms live in memory. Never run more than one server instance.** A second Fly machine would split rooms. Deploying restarts the process: clients reconnect automatically, and a `hello` with `rejoin: true` recreates their room (in the lobby). A race in progress is lost.
- **Room lifecycle** (all state is in memory, so everything below is also what keeps memory bounded):
  - 5-character codes from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
  - An **empty room** (no sockets) is deleted after 5 minutes.
  - An **idle room** falls asleep after 60 minutes without gameplay input (`Room.lastActivity`), even with screens still open. The server sends `{type:'sleep'}`, hangs up with close code 4000 and deletes the room. Clients call `net.stop()` (no auto-reconnect) and show "Wake it up". Waking calls `net.resume()`, and the `hello` with `rejoin: true` recreates the room. Pings and a TV's own `hello` don't count as activity; otherwise a TV left on overnight would keep the room, and the Fly machine, awake forever.
  - Disconnected players are pruned after 45 s in the lobby or final screen. During a race they're kept, driven by a bot, until the game returns to the lobby.
  - Dead sockets are dropped by a ping/pong heartbeat (about 20 s).
  - Per-IP rate-limit windows expire after 10 minutes.
  - Caps: 300 rooms, 30 sockets per room (`{type:'roomfull'}`), and 60 sockets per IP.
  - An unknown code gets `{type:'noroom'}`. Only someone who was in, or has seen, the room (`rejoin`) may recreate it; random codes never create rooms.
  - The host is the earliest-joined connected, non-pending player.
- **Movement is client-authoritative** for your own goose, so taps feel instant. The phone runs `sim.js` locally and sends `{type:'s', t, x, z, vx, f}` at 20 Hz. The server (`Room.onRaceMsg`) **caps speed**: `tp` and `yeet` effects are exempt. It also accepts `fin` only near the finish line.
- **Treat every client message as untrusted.** Validate the type and range in `room.js` before using it.
- **Bots and disconnected players** are simulated on the server with the same `sim.js` (`isAuto(lane)`).
- **Courses are deterministic:** the server sends `seed` and `len`, and clients call `makeCourse(theme, seed, len)`. If you change generation, both sides change together, since the code is shared. Hazards sit at the same x in every lane (fairness); pickups jitter.
- **Snapshots** go out at 20 Hz: `g[lane] = [x, z, vx, flags, catchup, timestamp]`. The timestamp is when the position was *measured* (the phone's race clock for humans). `World.sample()` renders others 0.16 s in the past with interpolation. Don't go back to snapshot-arrival timing: it caused visible stutter.
- **Tap physics:** `stepFoot` adds to `g.pend`, which `simGoose` blends into speed over about 0.1 s. Average speed is unchanged, and the jolt is removed (there's a test for this).
- **Rendering conventions:**
  - Your own lane is the **bottom row** on your phone (`World.laneOrder()`).
  - Bikes are drawn per lane row, so their arrival matches the collision timing.
  - Particles store lane ids, which the renderer maps to rows.
  - Hazards are drawn at goose scale, but positioned exactly.
  - Build repeated textures as one path per draw call (performance on phones).
- **Audio:** music plays only on the TV when one is connected (`lobby.tv`), so eight phones don't play it out of sync.
- **Security constraints:**
  - CSP is `default-src 'self'`, with inline style *attributes* allowed (per-goose colours) and **no inline scripts**.
  - Fonts are self-hosted (`public/fonts/`, OFL). Adding any CDN or external asset needs a CSP change, so prefer not to.
  - WebSocket origins must match the page host (or `PUBLIC_URL`/`ALLOWED_ORIGINS`).
- **UX principle:** many players aren't gamers. Keep controls big and obvious, hint with glow and pulse rather than text walls, and make failure funny rather than punishing (knocked-over fences let you through; catch-up helps the back of the pack).

## Testing

- `npm test` must pass before merging. The e2e suite boots a real server (`GOOSY_FAST=1`, random port) and covers:
  - two rooms playing full 3-round games at the same time, with no cross-room messages;
  - `noroom` and rejoin;
  - lock and kick;
  - speed-cap and fake-finish rejection;
  - restart recovery;
  - (`idle.e2e.mjs`, with tiny limits) idle rooms falling asleep and waking, activity keeping a room awake, a lone TV not keeping it awake, and the per-room socket cap.
- Add a unit test to `test/sim.test.mjs` for rule changes, and an e2e case for new server messages.
- For visual changes, check a phone viewport (375×812) and a short phone (375×600), and the TV at 1280×720.
- Measured baseline: 40 simultaneous rooms × 8 phones used about 8–20% of one core and about 31 MB of RAM.

## Deploy and CI

- `.github/workflows/test.yml` runs `npm test` on PRs to `main`.
- `.github/workflows/deploy.yml` runs on **every push to `main`** (merged PRs included), or manually via "Run workflow". It runs the tests, then `flyctl deploy --remote-only --ha=false`, then a `/healthz` check. Deploys never overlap (concurrency group).
- The secret `FLY_API_TOKEN` is an app-scoped deploy token named "github-actions goosy-race". It **expires 2027‑09‑27**; renew it with:
  ```bash
  fly tokens create deploy -a goosy-race -x 8760h | gh secret set FLY_API_TOKEN -R behnamazimi/goosy-race
  ```
- To deploy by hand:
  ```bash
  fly deploy --ha=false
  ```
- **`fly.toml`:** low-traffic setup with 256 MB and `auto_stop_machines = "stop"`. The machine sleeps when nobody is connected and wakes in 1–2 s. For always-on, set `auto_stop_machines = "off"` and `min_machines_running = 1`.
- **Logs:** `fly logs` shows room created/closed, games started/finished, errors, and `slow tick` warnings when a tick takes over 25 ms.
- **Load test against production:** temporarily raise the limits, run the load script, then remove them:
  ```bash
  fly secrets set GOOSY_CREATE_LIMIT=1000 GOOSY_SOCKETS_PER_IP=1000
  npm run load -- https://goosy-race.fly.dev 40 8
  fly secrets unset GOOSY_CREATE_LIMIT GOOSY_SOCKETS_PER_IP
  ```

## Configuration

| Env var | Default | What it does |
|---|---|---|
| `PORT` | `3333` | Server port (`8080` on Fly) |
| `NODE_ENV` | none | `production` disables dev shortcuts and the terminal QR code |
| `PUBLIC_URL` | LAN address | The site address used in QR codes and share links (`https://goosy-race.fly.dev` in production) |
| `ALLOWED_ORIGINS` | none | Extra origins allowed to open game sockets (comma-separated) |
| `GOOSY_MAX_ROOMS` | `300` | Room cap per machine |
| `GOOSY_CREATE_LIMIT` | `15` | Rooms one IP may create per 10 minutes |
| `GOOSY_SOCKETS_PER_IP` | `60` | Simultaneous sockets per IP (a whole party can share one IP) |
| `GOOSY_SOCKETS_PER_ROOM` | `30` | Sockets per room: 8 players plus TVs and spectators |
| `GOOSY_IDLE_CLOSE_MS` | `3600000` | A room falls asleep after this long without gameplay (1 hour) |
| `START_ROUND` | `0` | Dev only: first round index (0–2) |
| `GOOSY_FAST` | off | Tests only: short intros, results and courses |

## Code style

- ES modules everywhere, 2-space indent, single quotes, semicolons.
- Comments explain *why*, not *what*.
- Match the surrounding code. Keep functions small and named after game concepts (goose, lane, room).
- No new dependencies without a strong reason: the whole client is dependency-free.
