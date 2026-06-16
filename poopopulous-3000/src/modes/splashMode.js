import { createPoops } from '../poops.js';

const NORMAL_INTERVAL = 950;   // ms between poos, same cadence as 2.0
const UNLEASHED_INTERVAL = 16; // v2's zero-interval unleash: one turd per frame

export async function createSplashMode({ world, physics, audio, karaoke, setCounter, onUnleashChange }) {
  world.setSplashVisible(true);
  world.setCameraHome({ position: [20, 20, 20], target: [0, 0, 0], zoom: 1 });

  let unleashed = false;
  let lastSpawn = 0;

  const poops = await createPoops(world.splashGroup, physics, {
    camera: world.camera,
    onSpawn: () => audio.plop({ storm: unleashed }),
    onCount: (n) => { setCounter(`💩 × ${n.toLocaleString()}`); },
  });

  setCounter('💩 × 0');

  function setUnleashed(value) {
    unleashed = value;
    onUnleashChange?.(unleashed);
  }

  function update({ now }) {
    const interval = unleashed ? UNLEASHED_INTERVAL : NORMAL_INTERVAL;
    const onKaraokeBeat = !unleashed && karaoke?.consumeBeat?.();
    if (onKaraokeBeat || (!karaoke?.playing && now - lastSpawn >= interval) || (unleashed && now - lastSpawn >= interval)) {
      poops.spawn();
      lastSpawn = now;
    }

    poops.update(world.camera);
  }

  function dispose() {
    poops.dispose();
  }

  return {
    name: 'splash',
    update,
    dispose,
    setUnleashed,
    get unleashed() { return unleashed; },
    get poops() { return poops; },
  };
}
