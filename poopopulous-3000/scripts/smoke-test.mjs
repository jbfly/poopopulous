// Drives the game in headless Chrome: collects console errors and takes
// screenshots of the pile, the unleash mode, and karaoke mode.
import puppeteer from 'puppeteer-core';

// Defaults to Vite's dev-server port (`npm run dev`). Override with GAME_URL
// to test a `npm run preview` build or the live site.
const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('canvas', { timeout: 15000 });
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

const counter = await page.$eval('#counter', (el) => el.textContent);
console.log('counter:', counter);
console.log('console errors:', errors.length ? errors : 'none');

await browser.close();
