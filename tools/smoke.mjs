// smoke.mjs — a 20-second sanity drive: load, start, move, fire, read state, count errors.
// Not the full suite (that is playtest.mjs); this exists to fail fast during development.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameUrl, launchChrome, Page } from './cdp.mjs';

const GAME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'game');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { proc, base } = await launchChrome(9334);
try {
  const page = await Page.open(base, gameUrl(GAME_ROOT, '?seed=1'));
  await page.waitFor('window.__shotReady === true');
  let snap = await page.evaluate('window.EMBERWARD.snapshot()');
  console.log('title screen:', snap.screen);

  const btn = await page.evaluate(`(() => { const r = document.getElementById('btn-start').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.click(btn.x, btn.y);
  await sleep(1200);
  snap = await page.evaluate('window.EMBERWARD.snapshot()');
  console.log('after start:', JSON.stringify(snap));

  // Hold D and the beam for two seconds.
  await page.key('KeyD', 'd', true);
  await page.mouse(1000, 400, 'mouseMoved', 'none');
  await page.mouse(1000, 400, 'mousePressed');
  await sleep(2000);
  await page.mouse(1000, 400, 'mouseReleased');
  await page.key('KeyD', 'd', false);
  snap = await page.evaluate('window.EMBERWARD.snapshot()');
  console.log('after move+fire:', JSON.stringify(snap));
  console.log('console problems:', JSON.stringify(page.problems()));
} finally {
  proc.kill();
}
