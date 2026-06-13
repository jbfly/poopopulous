// Karaoke mode: a port of v2's LyricsSynchronizer.cs.
// Parses the original Aegisub .ass file with per-word {\kNN} timing
// (centiseconds) and highlights words in sync with the song.

function parseAssTime(t) {
  const [h, m, s] = t.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function parseAss(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.startsWith('Dialogue:')) continue;
    const fields = raw.slice('Dialogue:'.length).split(',');
    if (fields.length < 10) continue;
    const start = parseAssTime(fields[1].trim());
    const end = parseAssTime(fields[2].trim());
    const body = fields.slice(9).join(',');

    const words = [];
    let t = start;
    for (const m of body.matchAll(/\{\\k(\d+)\}([^{]*)/g)) {
      const dur = Number(m[1]) / 100;
      const word = m[2].trim();
      if (word) words.push({ word, start: t, end: t + dur });
      t += dur;
    }
    if (words.length) lines.push({ start, end, words });
  }
  return lines;
}

export function createKaraoke() {
  const container = document.getElementById('karaoke');
  const lineEl = document.getElementById('karaokeLine');
  const nextEl = document.getElementById('karaokeNext');
  const song = new Audio('assets/audio/Never-Gonna-Poop-You-Up.mp3');

  let lines = null;
  let playing = false;

  async function ensureLyrics() {
    if (lines) return;
    const res = await fetch('assets/lyrics/Never-Gonna-Poop-You-Up.ass');
    lines = parseAss(await res.text());
  }

  async function start() {
    await ensureLyrics();
    container.style.display = 'block';
    song.currentTime = 0;
    await song.play();
    playing = true;
  }

  function stop() {
    song.pause();
    playing = false;
    container.style.display = 'none';
  }

  function update() {
    if (!playing || !lines) return;
    if (song.ended) { stop(); return; }
    const t = song.currentTime;

    const idx = lines.findIndex((l) => t < l.end);
    const line = idx >= 0 && t >= lines[idx].start - 0.7 ? lines[idx] : null;

    if (line) {
      lineEl.innerHTML = line.words
        .map((w) => `<span class="${t >= w.start ? 'sung' : ''}">${w.word}</span>`)
        .join(' ');
      const next = lines[idx + 1];
      nextEl.textContent = next ? next.words.map((w) => w.word).join(' ') : '';
    } else {
      lineEl.innerHTML = '🎵';
      nextEl.textContent = idx >= 0 ? lines[idx].words.map((w) => w.word).join(' ') : '';
    }
  }

  return {
    start, stop, update,
    seek(t) { song.currentTime = t; },
    get playing() { return playing; },
  };
}
