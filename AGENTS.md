# AGENTS.md — Poopopulous

Guidance for AI coding agents (Codex, pi, Claude, etc.) working in this repo.
Start here, then read the README files linked below. This file captures the
operational knowledge that isn't obvious from the code alone.

## What this repo is

Poopopulous is a long-running "build a game with AI" experiment, in continuous
development since April 2023. The repo holds **three generations** of the game
plus the original ChatGPT transcripts. It doubles as a portfolio piece showing
the evolution of AI-assisted coding from 2023 copy-paste to 2026 agents — so
**the historical material is load-bearing, not clutter.**

### Ground rules

- **Never delete or "clean up" the historical artifacts.** That means the
  Unity project at the repo root (`Assets/`, `ProjectSettings/`, `Packages/`),
  `v1-phaser/`, `chatGPT/`, and `prompts/`. They are intentionally preserved.
- **Active development happens in `poopopulous-3000/`.** Unity is retired — do
  not resume Unity work or suggest reinstalling it. The owner deliberately
  moved to web tech so the game can be run, tested, and screenshotted by agents
  directly.
- This is a fun, irreverent project. Poop puns in commit messages and UI copy
  are on-brand and welcome. The repo has a tradition of colorful (sometimes
  GPT-written, sometimes rhyming) commit messages.

## Layout

| Path | What it is | Status |
|------|-----------|--------|
| `poopopulous-3000/` | **The active game.** Three.js + Rapier + Vite, runs in-browser. | Develop here |
| `Assets/`, `ProjectSettings/`, `Packages/` | Poopopulous 2.0 — the Unity project (3D physics poos, karaoke, PooGPT). | Frozen artifact |
| `v1-phaser/` | Poopopulous 1.0 — the original Phaser game, rescued from production source maps. | Frozen artifact |
| `chatGPT/` | The 2023 ChatGPT transcripts that wrote 1.0 and 2.0. | Frozen artifact |
| `prompts/` | Early prompt experiments. | Frozen artifact |
| `deploy_poop.sh` | The original 2.0 deploy script. **Obsolete** (old `/srv/http` path). | Reference only |

See the READMEs for narrative detail: [`README.md`](README.md) (overview of all
three generations), [`poopopulous-3000/README.md`](poopopulous-3000/README.md),
[`v1-phaser/README.md`](v1-phaser/README.md).

## Working in poopopulous-3000

Stack: **Three.js** (rendering), **@dimforge/rapier3d-compat** (WASM physics),
**Vite** (dev server + build). Node 25 / npm 11 were used; any recent Node works.

```sh
cd poopopulous-3000
npm install
npm run dev      # dev server (Vite)
npm run build    # static build -> dist/
npm run preview  # serve the built dist/ locally
```

### Source map

- `src/main.js` — entry point + game loop. Spawns poos on an interval (normal
  950 ms, "unleashed" 45 ms), steps physics at a fixed 60 Hz, wires the HUD
  buttons. Exposes `window.__game = { world, physics, poops, karaoke, audio }`
  for debugging and tests.
- `src/world.js` — Three scene, **isometric orthographic camera**, lights,
  ground + grid, tile hover highlight, OrbitControls, +/- zoom buttons.
  `GRID_SIZE` and `TILE_SIZE` are exported and used by physics.
- `src/physics.js` — Rapier world init + ground collider (must stay aligned
  with the visual ground in `world.js`).
- `src/poops.js` — the core. Loads the OBJ/MTL poop model, **bakes material
  colors into vertex colors so the whole pile is one `InstancedMesh`** (one
  draw call for thousands of poos). Spawns falling rigid bodies; freezes them
  to `Fixed` once they sleep or after `SETTLE_SECONDS` (the perf trick ported
  from 2.0's `DisablePhysicsAfterTime.cs`). `MAX_POOPS` caps instances;
  `MAX_DYNAMIC` caps simultaneously-simulated bodies.
- `src/karaoke.js` — parses the original Aegisub `.ass` subtitle file
  (per-word `{\kNN}` centisecond timing) and highlights lyrics in sync with
  the song. Port of 2.0's `LyricsSynchronizer.cs`.
- `src/audio.js` — pooled `Audio` elements for the plop sound.
- `public/assets/` — the rescued 2023 assets (poop LOD models, sounds, song,
  `.ass` lyrics). **Asset paths are relative** (`assets/...`, no leading `/`)
  so the build works under a subdirectory like `/poopopulous-3000/`.

### Verifying changes (do this — it's the whole point of the web rewrite)

```sh
cd poopopulous-3000
node scripts/smoke-test.mjs
```

Drives the game in headless Chrome (needs `google-chrome-stable` at
`/usr/bin/google-chrome-stable`; the script uses `puppeteer-core` against the
system Chrome — no browser download). It checks for console errors and writes
screenshots to `/tmp/poop-1-normal.png`, `/tmp/poop-2-unleashed.png`,
`/tmp/poop-3-karaoke.png`. By default it hits `http://localhost:5173/` (Vite's
`npm run dev` port) — so run `npm run dev` in one shell and the smoke test in
another. Set `GAME_URL` to point it at a `npm run preview` build or the live
site instead. Look at the screenshots — this is how you confirm the 3D actually
renders, not just that JS didn't throw.

## Deployment

The production server moved since 2023; `deploy_poop.sh` is obsolete.

- Reach the server via the SSH alias **`ssh bonewitz`** (works from the owner's
  machine; SSH to the bare domain fails because bonewitz.net is Cloudflare-
  proxied). Other agents/machines may not have this alias or the keys.
- Production is a dockerized stack at **`/opt/bonewitz-server-dev`** (Caddy +
  Apache). Site content is bind-mounted from `www/`, so `www/<name>/` is served
  at `bonewitz.net/<name>/`. The `www/` dir is owned by `jbfly` and writable —
  no permission fixups needed.
- **Deploy with `poopopulous-3000/deploy.sh`** (runs `npm run build`, then
  rsyncs `dist/` to `bonewitz:/opt/bonewitz-server-dev/www/poopopulous-3000/`).

All three generations are live side by side:
`bonewitz.net/poo` (1.0), `bonewitz.net/poopopulous` (2.0),
`bonewitz.net/poopopulous-3000` (3000).

## Roadmap / direction

The current build is a **toy/demo**: poos rain and pile, you can unleash them,
and there's karaoke mode. The intended next phase is to turn it into an actual
game with **Factorio-inspired gameplay** — treat sewage as a flow to route,
process, and scale: pipes, pumps, treatment, throughput, upgrades. The 50×50
grid and pipe-placement tool in 1.0 were already pointing in this direction.

Shelved but liked for later: **PooGPT** — an in-game LLM chat (2.0 had a
prototype using the OpenAI API). If revived in 3000, do it via a small
server-side proxy so no API key ships in the client bundle. (2.0 stored a key
in `Assets/scripts/APIKey.asset`; it is currently blank — keep it that way and
never commit a real key.)

## Conventions

- Match the surrounding code style; keep the comments that explain *why*
  (e.g. the vertex-color baking and the settle-and-freeze trick).
- Keep asset paths relative so subdirectory deploys keep working.
- After meaningful changes to the game, run the smoke test and look at the
  screenshots before declaring success.
