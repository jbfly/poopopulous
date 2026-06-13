# Poopopulous 3000

The third generation of Poopopulous: a Three.js + Rapier rewrite of the Unity
version, running entirely in the browser. All the original creative assets —
the 3D emoji poop models, the plop sounds, *Never Gonna Poop You Up* and its
karaoke timing file — were rescued straight from the 2023 Unity project.

## Features

- 💩 **Physics poop rain** — poos fall onto an isometric tile world and pile
  up with real rigid-body physics (Rapier/WASM). Rendered as a single
  instanced mesh, so the pile can grow into the thousands. Settled poos are
  frozen to keep the simulation fast — the same trick 2.0 used.
- 🌊 **Unleash the Poos!** — the legendary button returns.
- 🎤 **Karaoke mode** — plays *Never Gonna Poop You Up* with per-word lyric
  highlighting, parsed from the original Aegisub `.ass` file.
- 🟩 Tile hover highlight and +/− zoom buttons, in tribute to 1.0.

## Develop

```sh
npm install
npm run dev      # dev server
npm run build    # static build in dist/
npm run preview  # serve the build locally
```

The build is fully static with relative paths — deploy by rsyncing `dist/`
anywhere, true to the `deploy_poop.sh` tradition.

### Smoke test

```sh
node scripts/smoke-test.mjs
```

Drives the game in headless Chrome (requires `google-chrome-stable`), checks
for console errors, and screenshots normal, unleashed, and karaoke modes to
`/tmp/poop-*.png`. A debug handle is exposed at `window.__game`.

## Layout

- `src/world.js` — scene, isometric ortho camera, lights, tile grid, hover
- `src/physics.js` — Rapier world and ground
- `src/poops.js` — model loading (OBJ/MTL → vertex-colored instanced mesh),
  spawning, settling/freezing
- `src/karaoke.js` — `.ass` karaoke parser + synced lyric display
- `src/audio.js` — plop sound pool
- `public/assets/` — the rescued 2023 assets

## Where it's going

The plan is to grow this from a toy into an actual game, with
Factorio-flavored gameplay: sewage as a flow to route, process, and scale —
pipes, pumps, treatment, throughput. The 50×50 grid and pipe tool of 1.0
were pointing here all along.
