import { createWorld } from './world.js';
import { createPhysics } from './physics.js';
import { createPoops } from './poops.js';
import { createAudio } from './audio.js';
import { createKaraoke } from './karaoke.js';

const NORMAL_INTERVAL = 950;   // ms between poos, same cadence as 2.0
const UNLEASHED_INTERVAL = 45; // "Let Loose the Poos of War!"

const world = createWorld(document.getElementById('app'));
const physics = await createPhysics();
const audio = createAudio();
const karaoke = createKaraoke();

const counterEl = document.getElementById('counter');
const poops = await createPoops(world.scene, physics, {
  onSpawn: () => audio.plop(),
  onCount: (n) => { counterEl.textContent = `💩 × ${n.toLocaleString()}`; },
});

// --- UI ---
let unleashed = false;
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
  if (now - lastSpawn >= interval) {
    poops.spawn();
    lastSpawn = now;
  }

  accumulator += dt;
  while (accumulator >= PHYSICS_DT) {
    physics.world.step();
    accumulator -= PHYSICS_DT;
  }

  poops.update();
  karaoke.update();
  world.controls.update();
  world.renderer.render(world.scene, world.camera);
}

requestAnimationFrame(loop);

// Handle for automated tests and console tinkering
window.__game = { world, physics, poops, karaoke, audio };
