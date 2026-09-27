# 🪿 Goosy Race

A silly party race for up to **8 players on their phones**. There's no app and no account: one person creates a room, everyone else opens the link, and you tap your goose to the finish line. Empty spots are filled with bots if you prefer, so it's fun with just 2 or 3 people too.

**▶ Play now: https://goosy-race.fly.dev**

## Wait, why does this exist? 🤔

We (**Maastricht‑1**) knew Claude Opus could build a multiplayer game in one go. We just wanted to watch it happen. Then we played it, had way too much fun, and figured: why not put it online? Just geese. 🪿

## How to play

1. **Create a room** on the home page, then tap **Invite friends** to share the link (or show the QR code).
2. Everyone picks a goose name and waddles in. The first person in is the host 👑 and presses **Start race**.
3. Race!
   - **Tap the glowing foot:** left, right, left, right. The faster you alternate, the faster you run.
   - **FLAP** hops over fences, puddles, ice holes and bikes. The button glows gold when something is coming.
   - **🤸 Trampolines** launch you sky-high, so you float over whatever comes next.
   - **Golden ? eggs** give you a mystery item. Tap the item bubble to use it.
   - Your goose is always in the **bottom lane** on your own phone, right above your thumbs.

Waiting for friends? You can practise running and flapping in the lobby.

**Got a laptop or TV?** Open the room's big-screen page (there's a link on the join screen). It shows the whole race, live standings and the award ceremony, and plays the music, so the phones don't have to.

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
- **🏆 Ceremony:** a podium for the top three, and a silly award for everyone.

Being behind makes your goose slightly faster, and the best items go to the geese at the back. First-timers can win too.

### Host powers 👑

Turn bots on or off, **lock** the room 🔒 so no one new can join, and remove players (tap ✕ twice).

## Run it yourself

You need [Node.js](https://nodejs.org) 26 or newer.

```bash
npm install
npm start
```

Open the address the terminal prints (for example `http://192.168.1.153:3333`) on your phone and create a room. For local play, everyone must be on the same Wi-Fi as the computer running it.

Want to change the game or deploy your own copy? Everything technical lives in **[AGENTS.md](AGENTS.md)**.

## Privacy

There are no accounts and no tracking. Your goose name only lives in the server's memory while you play. Your phone keeps a random ID so you can rejoin your room.

---

Hatched for fun by **Maastricht‑1** 🪿 · Built with Claude Opus via Claude Code.
