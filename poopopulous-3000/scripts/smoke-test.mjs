// Drives the game in headless Chrome: collects console errors and takes
// screenshots of the pile, unleash mode, karaoke mode, and Level 1 flow.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

// Defaults to Vite's dev-server port (`npm run dev`). Override with GAME_URL
// to test a `npm run preview` build or the live site.
const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = chromeCandidates.find((path) => existsSync(path));

if (!executablePath) {
  throw new Error(`No Chrome/Chromium executable found. Checked: ${chromeCandidates.join(', ')}`);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--window-size=1280,800',
    '--autoplay-policy=no-user-gesture-required',
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
  ],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => window.__game?.mode === 'splash', { timeout: 15000 });
  await sleep(8000); // let some poos fall and settle
  await page.screenshot({ path: '/tmp/poop-1-normal.png' });

  await page.click('#unleashBtn');
  await sleep(6000);
  await page.screenshot({ path: '/tmp/poop-2-unleashed.png' });

  await page.click('#unleashBtn'); // calm the poos
  await page.click('#karaokeBtn');
  // jump the song to the first verse so we don't wait through the intro
  await page.evaluate(() => window.__game.karaoke.seek(20));
  await sleep(3000);
  await page.screenshot({ path: '/tmp/poop-3-karaoke.png' });
  await page.click('#karaokeBtn');

  await page.click('#startLevelBtn');
  await page.waitForFunction(() => window.__game?.mode === 'level1', { timeout: 15000 });
  await sleep(3000);
  await page.screenshot({ path: '/tmp/poop-4-level1-dry.png' });
  const dryMetrics = await page.evaluate(() => window.__game.level1.getMetrics());

  await page.click('#unleashBtn');
  await sleep(10000);
  await page.screenshot({ path: '/tmp/poop-5-level1-flow-10s.png' });
  await sleep(8000);
  await page.screenshot({ path: '/tmp/poop-6-level1-flow-18s.png' });

  const counter = await page.$eval('#counter', (el) => el.textContent);
  const metrics = await page.evaluate(() => window.__game.level1.getMetrics());
  console.log('counter:', counter);
  console.log('level1 dry metrics:', JSON.stringify(dryMetrics, null, 2));
  console.log('level1 metrics:', JSON.stringify(metrics, null, 2));
  console.log('console errors:', errors.length ? errors : 'none');

  if (errors.length) {
    throw new Error(`Console/page errors:\n${errors.join('\n')}`);
  }

  if (metrics.activeParticles < 1200) {
    throw new Error(`Expected Level 1 fluid to emit at least 1200 particles, got ${metrics.activeParticles}`);
  }

  if (dryMetrics.prePooCount < 1) {
    throw new Error(`Expected dry Level 1 to spawn physical poos, got ${dryMetrics.prePooCount}`);
  }

  if (metrics.maxNodeDegree > 4 || metrics.overfullNodes > 0 || metrics.junctionOverfull > 0) {
    throw new Error(`Pipe routing produced invalid crossing nodes: ${JSON.stringify(metrics)}`);
  }

  if (metrics.junctionCorners < 1 || metrics.junctionTees < 1 || metrics.junctionCrosses < 1) {
    throw new Error(`Expected corner, tee, and cross pipe nodes: ${JSON.stringify(metrics)}`);
  }

  if (metrics.renderedFittings !== metrics.junctionCorners) {
    throw new Error(`Expected only corner nodes to render elbow fittings: ${JSON.stringify(metrics)}`);
  }

  if (metrics.drainedParticles < 1) {
    throw new Error(`Expected Level 1 fluid to drain off-screen, got ${metrics.drainedParticles}`);
  }

  if (metrics.multiPathTransferCount < 1 || metrics.offPrimaryTransferCount < 1) {
    throw new Error(`Expected fluid to use visible alternate pipe paths: ${JSON.stringify(metrics)}`);
  }

  if (metrics.flowDragPairCount < 1 || metrics.flowDragImpulse <= 0 || metrics.entrainmentImpulse <= 0) {
    throw new Error(`Expected moving and stagnant fluid to exchange drag: ${JSON.stringify(metrics)}`);
  }

  if (metrics.exitSignPoopulation !== metrics.drainedParticles || !metrics.exitSignText.startsWith('Poopulation ')) {
    throw new Error(`Exit sign did not track drained particles: ${JSON.stringify(metrics)}`);
  }

  const outsideRatio = metrics.outsidePipeCount / Math.max(metrics.activeParticles, 1);
  if (outsideRatio > 0.01 || metrics.maxOutsideDistance > 0.18) {
    throw new Error(`Fluid escaped pipe bounds: ${JSON.stringify(metrics)}`);
  }
} finally {
  await browser.close();
}
