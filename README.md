# 💩 Poopopulous

*The premier AI-developed indie poop simulator — in continuous development since April 2023.*

Poopopulous is a long-running experiment in building a game with AI, started
back when "vibe coding" meant copy-pasting snippets between a ChatGPT browser
tab and a text editor, four thousand tokens at a time. This repo contains all
three generations of the game, plus the original chat transcripts that wrote
the first two.

## The three generations

### 1.0 — The Phaser original (April 2023) · [`v1-phaser/`](v1-phaser/)

An isometric grid where poo emojis fall from the sky, plop, and spread —
written with **GPT-3.5 and GPT-4 via pure copy-paste**. No agents, no tool
use, no project context: every file in there was pasted out of a chat window.
The source was never committed at the time; in 2026 it was rescued by
extracting the original code from the source maps still deployed on the web
server, including five earlier builds showing the game's evolution.

**Play it:** [bonewitz.net/poo](http://bonewitz.net/poo/)

### 2.0 — The Unity rewrite (2023) · [`Assets/`](Assets/) (repo root)

The 3D era: real physics poos that pile up (with LOD models and a
freeze-after-settling trick to keep the framerate alive), an **"Unleash the
Poos!"** button, an in-game ChatGPT chat ("PooGPT"), and the crown jewel —
**karaoke mode**, which plays *Never Gonna Poop You Up* with per-word
synchronized lyrics parsed from an Aegisub subtitle file.

The commit history from this era is its own artifact — several commit
messages were written by GPT-4 in rhyme, and some include the full prompts
that generated the code.

**Play it:** [bonewitz.net/poopopulous](http://bonewitz.net/poopopulous/)

### 3000 — The revival (2026) · [`poopopulous-3000/`](poopopulous-3000/)

The modern era: a **Three.js + Rapier** web rewrite built agentically with
Claude Code. Everything charming about 2.0 — the 3D poop models, the physics
piling, the karaoke, the plop sounds — rescued from the Unity project and
running in a browser with no engine install required. The name is a nod to
SimCity 3000, the game's spiritual grandparent.

```sh
cd poopopulous-3000
npm install
npm run dev
```

## The archive

- [`chatGPT/`](chatGPT/) — the original 2023 chat transcripts: the first
  brainstorm ("how about a sewage manager game, has that been done before?"),
  debugging sessions, the karaoke implementation, and the
  [original README](chatGPT/original_README_by_GPT4.md), written by GPT-4
  itself, explaining how its human assistants mostly just got in the way.
- [`prompts/`](prompts/) — early prompt experiments, including the request for
  "British sarcastic and pun-filled game code."
- [`v1-phaser/archive/`](v1-phaser/archive/) — earlier 1.0 builds recovered
  from source maps, from the first monolithic `game.js` to the modular final.

## Why this repo exists

Partly because watching poo emojis pile up is timelessly funny. Partly as a
time capsule: three snapshots of what "building software with AI" looked like
in 2023 versus 2026, from copy-paste archaeology to autonomous agents — with
the same poop jokes holding it all together.
