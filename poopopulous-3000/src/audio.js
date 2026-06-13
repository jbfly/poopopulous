// Plop sounds, straight from the 2023 asset folder.
const POOL_SIZE = 6;
const MIN_GAP_MS = 70; // don't machine-gun the plops when unleashed

export function createAudio() {
  const pool = Array.from({ length: POOL_SIZE }, () => new Audio('assets/audio/poo_shortened.mp3'));
  let next = 0;
  let lastPlay = 0;
  let muted = false;

  function plop() {
    if (muted) return;
    const now = performance.now();
    if (now - lastPlay < MIN_GAP_MS) return;
    lastPlay = now;
    const a = pool[next];
    next = (next + 1) % POOL_SIZE;
    a.currentTime = 0;
    a.volume = 0.5;
    a.play().catch(() => {}); // browsers block audio until first user gesture
  }

  return {
    plop,
    get muted() { return muted; },
    setMuted(m) { muted = m; },
  };
}
