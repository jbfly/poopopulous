# Poopopulous 1.0 — The Phaser.js Original (2023)

This is the rescued source of the original Poopopulous: an isometric "sewage
simulator" built in **April 2023** with Phaser 3, written almost entirely by
copy-pasting code between a browser tab running ChatGPT (GPT-3.5, then GPT-4)
and a text editor. No agents, no tool use, a ~4k-token context window — just
two humans and a chatbot passing snippets back and forth. The full chat
transcripts from that process are preserved in [`../chatGPT/`](../chatGPT/).

It is still playable at [bonewitz.net/poo](http://bonewitz.net/poo/).

## The rescue

The original source was never committed to version control — it lived only on
the web server as Parcel-built bundles. In June 2026 the source was recovered
by extracting the `sourcesContent` embedded in the deployed `.js.map`
source maps. Bundles, source maps, and duplicate-hashed assets were left
behind; everything original was kept.

## Layout

- **`src/`** — the final version, as served live: a 50×50 isometric grid where
  poo emojis 💩 fall from the sky with a tween animation, plop with a sound
  effect, and spread cell by cell. Camera zoom buttons and the beginnings of a
  pipe-placement tool (featuring a certain familiar green pipe sprite).
  - `main.js` / `gameConfig.js` / `isoScene.js` / `utilities.js`
- **`assets/`** — `poo.mp3` (the plop), `mariopipe.png`, `test.png`
- **`archive/`** — earlier builds recovered from older source maps still on the
  server, deduplicated by content. Inferred order of evolution:
  1. `index.07376fc7/`, `index.caf73b14/` — single-file `game.js`: grid,
     emoji spread, hover highlight
  2. `index.905f6534/` — adds the falling-poo tween animation
  3. `game.7bbe06d5/` — adds the plop sound
  4. `main.bb01da66/` — the big modularization (one file → four)
  5. `main.bd2b8b8e/` — adds camera zoom
  6. `src/` (final) — adds the pipe tool

## Running it

The source used Parcel with ES-module asset imports. To run it today:

```sh
npm init -y && npm i phaser parcel
# wire src/ + assets/ into an index.html, then:
npx parcel index.html
```

Or just play the deployed build at bonewitz.net/poo.

## What came after

- **2.0** — the Unity rewrite at the root of this repo (3D physics poos,
  karaoke mode, PooGPT)
- **3000** — [`../poopopulous-3000/`](../poopopulous-3000/), the modern
  Three.js revival
