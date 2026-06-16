import { createWorld } from './world.js';
import { createPhysics } from './physics.js';
import { createAudio } from './audio.js';
import { createKaraoke } from './karaoke.js';
import { createSplashMode } from './modes/splashMode.js';
import { createLevel1Mode } from './modes/level1Mode.js';

const PHYSICS_DT = 1 / 60;

const world = createWorld(document.getElementById('app'));
const physics = await createPhysics();
const audio = createAudio();
const karaoke = createKaraoke();

const counterEl = document.getElementById('counter');
const startLevelBtn = document.getElementById('startLevelBtn');
const backBtn = document.getElementById('backBtn');
const regenBtn = document.getElementById('regenBtn');
const unleashBtn = document.getElementById('unleashBtn');
const muteBtn = document.getElementById('muteBtn');
const karaokeBtn = document.getElementById('karaokeBtn');

let activeMode = null;
let activeModeName = 'splash';
let accumulator = 0;
let lastTime = performance.now();

function setCounter(text) {
  counterEl.textContent = text;
}

function setButtonHidden(button, hidden) {
  button.classList.toggle('hidden', hidden);
}

function syncUnleashButton() {
  const unleashed = activeMode?.unleashed ?? false;
  unleashBtn.classList.toggle('active', unleashed);
  unleashBtn.textContent = unleashed ? '🧘 Calm the Poos!' : '🌊 Unleash the Poos!';
}

function syncHud() {
  const inLevel = activeModeName === 'level1';
  setButtonHidden(startLevelBtn, inLevel);
  setButtonHidden(backBtn, !inLevel);
  setButtonHidden(regenBtn, !inLevel);
  syncUnleashButton();
}

async function switchMode(next) {
  activeMode?.dispose();
  activeMode = null;

  async function startSplashMode() {
    activeModeName = 'splash';
    activeMode = await createSplashMode({
      world,
      physics,
      audio,
      setCounter,
      onUnleashChange: syncUnleashButton,
    });
  }

  try {
    if (next === 'level1') {
      activeModeName = 'level1';
      activeMode = await createLevel1Mode({
        world,
        physics,
        audio,
        setCounter,
        onUnleashChange: syncUnleashButton,
      });
    } else {
      await startSplashMode();
    }
  } catch (error) {
    console.error(`Failed to start ${next} mode`, error);
    activeMode?.dispose?.();
    activeMode = null;
    await startSplashMode();
  }

  syncHud();
}

startLevelBtn.addEventListener('click', () => { switchMode('level1'); });
backBtn.addEventListener('click', () => { switchMode('splash'); });
regenBtn.addEventListener('click', () => { switchMode('level1'); });

unleashBtn.addEventListener('click', () => {
  activeMode?.setUnleashed?.(!activeMode.unleashed);
  syncUnleashButton();
});

muteBtn.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  muteBtn.textContent = audio.muted ? '🔇 Sound Off' : '🔊 Sound On';
});

karaokeBtn.addEventListener('click', async () => {
  if (karaoke.playing) {
    karaoke.stop();
    karaokeBtn.classList.remove('active');
  } else {
    await karaoke.start();
    karaokeBtn.classList.add('active');
  }
});

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  accumulator += dt;
  while (accumulator >= PHYSICS_DT) {
    physics.world.step();
    accumulator -= PHYSICS_DT;
  }

  activeMode?.update({ now, dt });
  karaoke.update();
  world.controls.update();
  world.renderer.render(world.scene, world.camera);
}

await switchMode('splash');
requestAnimationFrame(loop);

// Handle for automated tests and console tinkering.
window.__game = {
  get mode() { return activeModeName; },
  world,
  physics,
  karaoke,
  audio,
  get splash() { return activeModeName === 'splash' ? activeMode : null; },
  get level1() { return activeModeName === 'level1' ? activeMode : null; },
};
