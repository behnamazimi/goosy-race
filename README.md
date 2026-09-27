# 🪿 Goosy Race

A party racing game for up to **8 players on their phones**. There's nothing to install on the phones: everyone scans a QR code and plays in the browser. Empty spots are filled with bots, so it also works with 2–3 people.

**Play online:** https://goosy-race.fly.dev. Create a room, share the link, and race.

## Run it locally

```bash
npm install
npm start
```

Open the address the terminal prints (for example `http://192.168.1.153:3333`) and tap **Create a room**.

- **Phones:** join with the room's invite link or QR code. For local play, everyone must be on the **same Wi-Fi** as the computer running the server.
- **Big screen (optional, recommended):** open the room's `/r/CODE/tv` page on a laptop or TV (there's a link on the join screen) and click once to turn the sound on. It shows the QR code, the whole race, live standings and the ceremony. When a big screen is connected, the music plays only there.

The first person in a room is the host 👑. They get **Start race**, can switch bots on or off, **lock** the room 🔒 and remove players.

## Deploy (Fly.io)

The app runs as a single machine in Amsterdam. Rooms live in memory, so **never scale above one machine**.

```bash
fly deploy --ha=false
```

- `fly.toml` is set up for low traffic: the machine sleeps when nobody is connected and wakes in a second or two on the next visit. For always-on, set `auto_stop_machines = "off"` and `min_machines_running = 1`.
- A deploy restarts the server. Players reconnect automatically and land back in their room's lobby, but a race in progress is lost, so deploy when nobody is mid-game.
- Health check: `https://goosy-race.fly.dev/healthz`. Logs: `fly logs` (room created and closed, games started and finished, errors, slow ticks).
- Before every deploy, run `npm test` (unit tests, plus two full games in separate rooms at the same time, lock and kick, anti-cheat, and restart recovery).
- Load check: `npm run load -- https://goosy-race.fly.dev 40 8`. First raise the limits with `fly secrets set GOOSY_CREATE_LIMIT=1000 GOOSY_SOCKETS_PER_IP=1000`, and afterwards remove them with `fly secrets unset GOOSY_CREATE_LIMIT GOOSY_SOCKETS_PER_IP`.

## How to play (tell your friends this 👇)

- **Tap the glowing foot:** left, right, left, right. The faster you alternate, the faster your goose runs.
- **FLAP** hops over fences, puddles, ice holes and bikes. The button glows gold when something is coming.
- **🤸 Trampolines:** run onto one to get launched sky-high and float over whatever comes next.
- Your goose is always in the **bottom lane** on your own phone, right above your thumbs.
- **Golden ? eggs** give you a mystery item. Tap the item bubble to use it.
- Everyone can practise in the lobby while they wait.

### Three rounds

| Round | Stage | Twist |
|---|---|---|
| 1 | 🌷 Windmill Meadow | Fences, hay bales, mud |
| 2 | ❄️ Frozen Canal | Slippery ice: you glide. Fall in a hole and you get a cold bath |
| 3 | 🌙 Maastricht by Night | Dutch cyclists cross the track, and the finish is at the Vrijthof. **Double points** |

### Surprises 🤫

- **🧑‍🌾 The farmer:** a furious giant farmer chases the pack and whacks geese *forward* with his broom.
- **🦢 Mother Goose says freeze:** everyone stops. Wait for GO and tap first to win a boost. If you tap too early, you trip.
- **🍞 Bread rain:** snacks fall from the sky, and each one is a speed boost.
- **🥚 Golden egg hunt:** everyone gets an item.
- **Items:**
  - 📯 Mega Honk stuns nearby geese.
  - 🥚 Rotten Egg splats the leader's *actual phone screen*, and they have to rub it off.
  - 🪽 Wings let you fly over everything.
  - 🔀 Swap trades places with the goose ahead.
  - 🚀 Turbo Bread gives you a burst of speed.
- **🏆 Ceremony:** a podium for the top three, and every player gets a silly award.

Being behind makes your goose slightly faster, and the best items go to the geese at the back. First-timers can still win.

## Config

| Env var | Default | What it does |
|---|---|---|
| `PORT` | `3333` | Server port |
| `PUBLIC_URL` | LAN address | The site address used in QR codes and share links |
| `ALLOWED_ORIGINS` | none | Extra origins allowed to open game sockets (comma-separated), for example a custom domain |
| `GOOSY_MAX_ROOMS` | `300` | Room cap per machine |
| `GOOSY_CREATE_LIMIT` | `15` | Rooms one IP may create per 10 minutes |
| `GOOSY_SOCKETS_PER_IP` | `60` | Simultaneous connections per IP |
| `START_ROUND` | `0` | Dev only: start the game at round 0, 1 or 2 |
| `GOOSY_FAST` | off | Tests only: short intros and courses |

## How it's built

- `server.js`: HTTP, routing, rooms, security (limits, origin check, CSP) and health checks.
- `server/room.js`: one private game: players, bots, race clock, surprise events, items and scoring.
- `public/shared/sim.js`: goose physics and course generation, shared by the server (for the bots) and the phones. Each phone simulates its own goose, so tapping feels instant.
- `public/js/render.js`: everything you see, hand-drawn on a canvas (no image files).
- `public/js/audio.js`: every sound, synthesized with Web Audio (no audio files).
- `public/js/phone.js`, `public/js/tv.js`: the phone controller and the big-screen view.
