// Plop sounds, straight from the 2023 asset folder.
// Normal mode is polite. Unleashed mode is deliberately not: Unity 2.0 used
// AudioSource.PlayOneShot while spawning every frame, so the poo clip stacked
// into an accidental brown-noise storm.
const NORMAL_POOL_SIZE = 6;
const STORM_POOL_SIZE = 36;
const NORMAL_GAP_MS = 70;
const STORM_GAP_MS = 10;

function makePool(size, src) {
  return Array.from({ length: size }, () => {
    const a = new Audio(src);
    a.preload = 'auto';
    return a;
  });
}

export function createAudio() {
  const normalPool = makePool(NORMAL_POOL_SIZE, 'assets/audio/poo_shortened.mp3');
  const stormPool = makePool(STORM_POOL_SIZE, 'assets/audio/poo.mp3');
  let normalNext = 0;
  let stormNext = 0;
  let lastPlay = 0;
  let muted = false;

  function playFromPool(pool, index, storm) {
    const a = pool[index];
    a.pause();
    a.currentTime = 0;
    a.volume = storm ? 0.35 + Math.random() * 0.35 : 0.5;
    a.playbackRate = storm ? 0.82 + Math.random() * 0.38 : 1;
    a.preservesPitch = !storm;
    a.play().catch(() => {}); // browsers block audio until first user gesture
  }

  function plop({ storm = false } = {}) {
    if (muted) return;
    const now = performance.now();
    const gap = storm ? STORM_GAP_MS : NORMAL_GAP_MS;
    if (now - lastPlay < gap) return;
    lastPlay = now;

    if (storm) {
      playFromPool(stormPool, stormNext, true);
      stormNext = (stormNext + 1) % STORM_POOL_SIZE;
      return;
    }

    playFromPool(normalPool, normalNext, false);
    normalNext = (normalNext + 1) % NORMAL_POOL_SIZE;
  }

  return {
    plop,
    get muted() { return muted; },
    setMuted(m) { muted = m; },
  };
}
