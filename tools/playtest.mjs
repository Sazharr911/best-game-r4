// playtest.mjs — input-driven play tests for EMBERWARD, run against the real game in
// headless Chrome over CDP (tools/cdp.mjs). The bot plays with genuine Input events —
// key downs, mouse moves, mouse presses, clicks on the real buttons and blessing cards —
// and steers by the read-only window.EMBERWARD snapshot, the way a player reads the
// screen. Two scenarios:
//
//   A (win):  ?fast=1 shortens nights; the bot kites, aims the beam at the nearest
//             shape, dashes out of trouble, drafts blessings and must reach the
//             DAY 100 — DAWN BREAKS victory screen.
//   B (lose): the bot starts a normal run, holds the beam open and never feeds the
//             lantern; the light must starve to zero into THE LIGHT DIES.
//
// Both assert zero console errors. Usage: node tools/playtest.mjs [A|B|all]

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameUrl, launchChrome, Page } from './cdp.mjs';

const GAME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'game');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || 'all';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

async function clickElement(page, id) {
  const pt = await page.evaluate(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.click(pt.x, pt.y);
}

class Bot {
  constructor(page) {
    this.page = page;
    this.held = new Set();
    this.mouseDown = false;
  }

  async setKeys(want) {
    const codes = { w: ['KeyW', 'w'], a: ['KeyA', 'a'], s: ['KeyS', 's'], d: ['KeyD', 'd'] };
    for (const k of Object.keys(codes)) {
      const has = this.held.has(k), wants = want.has(k);
      if (wants && !has) { await this.page.key(codes[k][0], codes[k][1], true); this.held.add(k); }
      if (!wants && has) { await this.page.key(codes[k][0], codes[k][1], false); this.held.delete(k); }
    }
  }

  async setMouse(down) {
    if (down === this.mouseDown) return;
    this.mouseDown = down;
    await this.page.mouse(this.mx || 640, this.my || 400, down ? 'mousePressed' : 'mouseReleased');
  }

  async aim(x, y) {
    this.mx = x; this.my = y;
    await this.page.mouse(x, y, 'mouseMoved', 'none');
  }

  async releaseAll() {
    await this.setKeys(new Set());
    await this.setMouse(false);
  }
}

async function scenarioWin(port) {
  console.log('\n— Scenario A: survive to dawn (?fast=1) —');
  const { proc, base } = await launchChrome(port);
  try {
    const page = await Page.open(base, gameUrl(GAME_ROOT, '?fast=1&seed=7'));
    const bot = new Bot(page);
    await page.waitFor('window.__shotReady === true');
    await clickElement(page, 'btn-start');
    await sleep(600);

    const t0 = Date.now();
    let maxNight = 1, sawDraft = false, lastScore = 0, scoreGrew = false;
    let finalSnap = null;
    let orbitTick = 0, orbitDir = 1, minHp = 100, minLight = 100;
    while (Date.now() - t0 < 9 * 60 * 1000) {
      const s = await page.evaluate('window.EMBERWARD.snapshot()');
      finalSnap = s;
      maxNight = Math.max(maxNight, s.night);
      if (s.score > lastScore) scoreGrew = true;
      lastScore = Math.max(lastScore, s.score);
      if (s.screen === 'playing') { minHp = Math.min(minHp, s.hp); minLight = Math.min(minLight, s.light); }

      if (s.screen === 'victory' || s.screen === 'gameover') break;

      if (s.screen === 'intermission') {
        sawDraft = true;
        await bot.releaseAll();
        const card = await page.evaluate(`(() => { const c = document.querySelector('#draft-cards .card'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        if (card) await page.click(card.x, card.y);
        await sleep(400);
        continue;
      }
      if (s.screen !== 'playing') { await sleep(250); continue; }

      // Fight: aim at the nearest shape — but clear the swarm before the elite, and
      // only burn oil on the beam while the target is actually in reach.
      const p = s.player;
      let target = null, bestD = Infinity;
      for (const e of s.enemies) {
        if (e.type === 'elite' && s.enemies.length > 1) continue;
        if (e.solid === false && s.enemies.length > 1) continue; // a ghosted wraith cannot burn yet
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bestD) { bestD = d; target = e; }
      }
      if (!target && s.enemies.length > 0) {
        target = s.enemies[0];
        bestD = Math.hypot(target.x - p.x, target.y - p.y);
      }
      // Oil run when the flame gets low and a flask is on the ground.
      let goal = null;
      if (s.light < 55 && s.pickups.length > 0) {
        goal = s.pickups[0];
      }
      const want = new Set();
      if (goal) {
        if (goal.x < p.x - 14) want.add('a'); if (goal.x > p.x + 14) want.add('d');
        if (goal.y < p.y - 14) want.add('w'); if (goal.y > p.y + 14) want.add('s');
        await bot.aim(goal.x, goal.y);
        await bot.setMouse(false);
      } else if (target) {
        await bot.aim(target.x, target.y);
        await bot.setMouse(bestD < 500);
        const nearby = s.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 240);
        let vx = 0, vy = 0;
        if (nearby.length >= 2) {
          // Surrounded: run from the pack's centroid, biased back toward the arena heart,
          // so the dark stays on one side of the lantern.
          let cx = 0, cy = 0;
          for (const e of nearby) { cx += e.x; cy += e.y; }
          cx /= nearby.length; cy /= nearby.length;
          const fx = p.x - cx, fy = p.y - cy, fl = Math.hypot(fx, fy) || 1;
          vx = fx / fl + (640 - p.x) / 900;
          vy = fy / fl + (400 - p.y) / 900;
        } else {
          // One shape only: orbit it at beam's length, drifting steadily so the keeper
          // never stands still to be bitten.
          orbitTick++;
          if (orbitTick % 12 === 0) orbitDir = -orbitDir;
          const ux = (target.x - p.x) / (bestD || 1), uy = (target.y - p.y) / (bestD || 1);
          const radial = bestD < 190 ? -1 : bestD > 300 ? 1 : 0;
          vx = ux * radial + -uy * orbitDir * 0.8;
          vy = uy * radial + ux * orbitDir * 0.8;
        }
        if (vx > 0.3) want.add('d'); if (vx < -0.3) want.add('a');
        if (vy > 0.3) want.add('s'); if (vy < -0.3) want.add('w');
        const close = s.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 110).length;
        if ((bestD < 85 || close >= 2) && s.stamina >= 30) {
          await page.key('Space', ' ', true);
          await sleep(40);
          await page.key('Space', ' ', false);
        }
        const near = s.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 200).length;
        if (near >= 2 && s.skills.nova <= 0) { await page.key('Digit1', '1', true); await page.key('Digit1', '1', false); }
      } else {
        await bot.setMouse(false);
        // Nothing on the field: drift to centre and wait for the spawn.
        if (p.x < 620) want.add('d'); if (p.x > 660) want.add('a');
        if (p.y < 380) want.add('s'); if (p.y > 420) want.add('w');
      }
      if (s.light < 52 && s.embers >= 15 && s.skills.surge <= 0) {
        await page.key('Digit2', '2', true); await page.key('Digit2', '2', false);
      }
      if (s.hp < 65 && s.skills.ward <= 0) {
        await page.key('Digit3', '3', true); await page.key('Digit3', '3', false);
      }
      await bot.setKeys(want);
      await sleep(200);
    }
    await bot.releaseAll();

    check('A: reached an end screen', finalSnap && (finalSnap.screen === 'victory' || finalSnap.screen === 'gameover'), `screen=${finalSnap?.screen}`);
    check('A: VICTORY — survived all 10 nights', finalSnap?.screen === 'victory', `night=${finalSnap?.night} score=${finalSnap?.score} kills=${finalSnap?.kills} endHp=${finalSnap?.hp} endLight=${finalSnap?.light} minHp=${minHp} minLight=${minLight}`);
    check('A: night advanced past 1', maxNight > 1, `maxNight=${maxNight}`);
    check('A: score grew from kills', scoreGrew, `score=${finalSnap?.score}`);
    check('A: blessing draft appeared', sawDraft);
    if (finalSnap?.screen === 'victory') {
      const title = await page.evaluate(`document.getElementById('end-title').textContent`);
      check('A: victory screen says DAY 100 — DAWN BREAKS', title === 'DAY 100 — DAWN BREAKS', title);
    }
    check('A: zero console errors', page.problems().length === 0, page.problems().join(' | ').slice(0, 300));
  } finally {
    proc.kill();
  }
}

async function scenarioLose(port) {
  console.log('\n— Scenario B: starve the light (idle, beam held open) —');
  const { proc, base } = await launchChrome(port);
  try {
    const page = await Page.open(base, gameUrl(GAME_ROOT, '?seed=3'));
    const bot = new Bot(page);
    await page.waitFor('window.__shotReady === true');
    await clickElement(page, 'btn-start');
    await sleep(500);
    const t0 = Date.now();
    await bot.aim(1100, 200);
    await bot.setMouse(true); // beam open: burn is 1.9 + 2.5 per second
    let finalSnap = null;
    while (Date.now() - t0 < 90000) {
      const s = await page.evaluate('window.EMBERWARD.snapshot()');
      finalSnap = s;
      if (s.screen === 'gameover') break;
      await sleep(500);
    }
    await bot.releaseAll();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    check('B: run ended in game over', finalSnap?.screen === 'gameover', `after ${elapsed}s`);
    check('B: the light starved to zero', finalSnap?.light === 0, `light=${finalSnap?.light} hp=${finalSnap?.hp}`);
    const title = await page.evaluate(`document.getElementById('end-title').textContent`);
    check('B: end screen says THE LIGHT DIES', title === 'THE LIGHT DIES', title);
    check('B: zero console errors', page.problems().length === 0, page.problems().join(' | ').slice(0, 300));
  } finally {
    proc.kill();
  }
}

if (only === 'A' || only === 'all') await scenarioWin(9351);
if (only === 'B' || only === 'all') await scenarioLose(9352);
console.log(failures === 0 ? '\nALL PLAY TESTS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
