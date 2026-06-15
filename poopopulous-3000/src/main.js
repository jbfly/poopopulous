import { createWorld } from './world.js';
import { createPhysics } from './physics.js';
import { createPoops } from './poops.js';
import { createAudio } from './audio.js';
import { createKaraoke } from './karaoke.js';

const NORMAL_INTERVAL = 950;   // ms between poos, same cadence as 2.0
const UNLEASHED_INTERVAL = 16; // v2's zero-interval unleash: one turd per frame

const world = createWorld(document.getElementById('app'));
const physics = await createPhysics();
const audio = createAudio();
const karaoke = createKaraoke();

const counterEl = document.getElementById('counter');
let unleashed = false;

const poops = await createPoops(world.scene, physics, {
  camera: world.camera,
  onSpawn: () => audio.plop({ storm: unleashed }),
  onCount: (n) => { counterEl.textContent = `💩 × ${n.toLocaleString()}`; },
});

// --- UI ---
const unleashBtn = document.getElementById('unleashBtn');
unleashBtn.addEventListener('click', () => {
  unleashed = !unleashed;
  unleashBtn.classList.toggle('active', unleashed);
  unleashBtn.textContent = unleashed ? '🧘 Calm the Poos!' : '🌊 Unleash the Poos!';
});

const muteBtn = document.getElementById('muteBtn');
muteBtn.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  muteBtn.textContent = audio.muted ? '🔇 Sound Off' : '🔊 Sound On';
});

const karaokeBtn = document.getElementById('karaokeBtn');
karaokeBtn.addEventListener('click', async () => {
  if (karaoke.playing) {
    karaoke.stop();
    karaokeBtn.classList.remove('active');
  } else {
    await karaoke.start();
    karaokeBtn.classList.add('active');
  }
});

// --- Main loop ---
const PHYSICS_DT = 1 / 60;
let accumulator = 0;
let lastTime = performance.now();
let lastSpawn = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const interval = unleashed ? UNLEASHED_INTERVAL : NORMAL_INTERVAL;
  const onKaraokeBeat = !unleashed && karaoke.consumeBeat();
  if (onKaraokeBeat || (!karaoke.playing && now - lastSpawn >= interval) || (unleashed && now - lastSpawn >= interval)) {
    poops.spawn();
    lastSpawn = now;
  }

  accumulator += dt;
  while (accumulator >= PHYSICS_DT) {
    physics.world.step();
    accumulator -= PHYSICS_DT;
  }

  world.controls.update();
  poops.update(world.camera);
  karaoke.update();
  world.renderer.render(world.scene, world.camera);
}

requestAnimationFrame(loop);

// Handle for automated tests and console tinkering
window.__game = { world, physics, poops, karaoke, audio };
