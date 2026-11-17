// shots.mjs — takes the entry's screenshots (shots.json) in headless Chrome: each staged
// scene (?shot=... in game/src/shots.js) is a live render of the game's own state, left to
// run briefly so particles, glows and closing enemies are mid-motion, then captured as a
// JPEG at 1280x800. If a capture exceeds the gate's 256 KiB it is retaken at lower quality.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameUrl, launchChrome, Page } from './cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const GAME_ROOT = join(REPO, 'game');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SETTLE = { cover: 700, play: 1000, start: 700, end: 1100 };

const shots = JSON.parse(readFileSync(join(REPO, 'shots.json'), 'utf8'));
const { proc, base } = await launchChrome(9361);
try {
  for (const shot of shots) {
    const kind = new URLSearchParams(shot.query).get('shot') || 'cover';
    const page = await Page.open(base, gameUrl(GAME_ROOT, shot.query));
    await page.waitFor('window.__shotReady === true');
    await sleep(SETTLE[kind] ?? 900);
    let quality = 84, buf = null;
    for (;;) {
      const b64 = await page.screenshotBase64(quality);
      buf = Buffer.from(b64, 'base64');
      if (buf.length <= 262144 || quality <= 50) break;
      quality -= 12;
    }
    const out = join(REPO, 'screenshots', shot.name);
    writeFileSync(out, buf);
    console.log(`${shot.name}: ${buf.length} bytes @ q${quality}, console problems: ${page.problems().length}`);
    if (page.problems().length) console.log('  ', page.problems().join(' | ').slice(0, 300));
    page.ws.close();
  }
} finally {
  proc.kill();
}
