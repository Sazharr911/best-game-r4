// diag.mjs — diagnostic twin of Scenario A (tools/playtest.mjs): the SAME bot, the
// same seed, the same decisions — plus telemetry. Every loop sample records the
// keeper's HP/Light, the pack's proximity, and every HP drop is attributed to its
// context (how many shapes were within bite range, whether a Husk's bolts could
// have done it). Used to diagnose WHY the win bot dies, from evidence, before any
// balance number moves. Not part of the pass/fail suite.
//
// Usage: node tools/diag.mjs [runs]

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameUrl, launchChrome, Page } from './cdp.mjs';

const GAME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'game');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUNS = Number(process.argv[2] || 2);

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

async function diagRun(port, runIdx) {
  const { proc, base } = await launchChrome(port);
  try {
    const page = await Page.open(base, gameUrl(GAME_ROOT, '?fast=1&seed=7'));
    const bot = new Bot(page);
    await page.waitFor('window.__shotReady === true');
    await clickElement(page, 'btn-start');
    await sleep(600);

    const t0 = Date.now();
    let finalSnap = null;
    let orbitTick = 0, orbitDir = 1;
    let prev = null;
    const perNight = new Map(); // night -> stats
    const nightStat = (n) => {
      if (!perNight.has(n)) perNight.set(n, {
        hpStart: null, hpEnd: null, lightStart: null, lightMin: Infinity, hpLost: 0,
        lightGained: 0, samples: 0, contactSamples: 0, surroundedSamples: 0, drops: [],
      });
      return perNight.get(n);
    };
    let lastNight = 0;

    while (Date.now() - t0 < 9 * 60 * 1000) {
      const s = await page.evaluate('window.EMBERWARD.snapshot()');
      finalSnap = s;
      if (s.screen === 'victory' || s.screen === 'gameover') break;

      if (s.screen === 'intermission') {
        await bot.releaseAll();
        const card = await page.evaluate(`(() => { const c = document.querySelector('#draft-cards .card'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        if (card) await page.click(card.x, card.y);
        await sleep(400);
        prev = null;
        continue;
      }
      if (s.screen !== 'playing') { await sleep(250); continue; }

      // ---- telemetry ----
      const ns = nightStat(s.night);
      if (s.night !== lastNight) {
        ns.hpStart = s.hp; ns.lightStart = s.light;
        if (lastNight > 0) { const pn = nightStat(lastNight); pn.hpEnd = s.hp; }
        lastNight = s.night;
      }
      ns.samples += 1;
      ns.lightMin = Math.min(ns.lightMin, s.light);
      const p = s.player;
      const near = s.enemies.map((e) => ({ type: e.type, d: Math.hypot(e.x - p.x, e.y - p.y) }));
      const nContact = near.filter((e) => e.d < 60).length;
      const nClose = near.filter((e) => e.d < 110).length;
      if (nContact >= 1) ns.contactSamples += 1;
      if (nClose >= 2) ns.surroundedSamples += 1;
      if (prev && prev.night === s.night) {
        if (s.hp < prev.hp) {
          const drop = prev.hp - s.hp;
          ns.hpLost += drop;
          ns.drops.push({
            t: ((Date.now() - t0) / 1000).toFixed(1), drop, hp: s.hp, light: Math.round(s.light),
            nContact, nClose,
            nearTypes: near.filter((e) => e.d < 130).map((e) => `${e.type}@${Math.round(e.d)}`).join(','),
            eliteAlive: s.enemies.some((e) => e.type === 'elite'),
          });
        }
        if (s.light > prev.light + 0.5) ns.lightGained += s.light - prev.light;
      }
      prev = { hp: s.hp, light: s.light, night: s.night };

      // ---- the bot, verbatim from playtest.mjs Scenario A ----
      let target = null, bestD = Infinity;
      for (const e of s.enemies) {
        if (e.type === 'elite' && s.enemies.length > 1) continue;
        if (e.solid === false && s.enemies.length > 1) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bestD) { bestD = d; target = e; }
      }
      if (!target && s.enemies.length > 0) {
        target = s.enemies[0];
        bestD = Math.hypot(target.x - p.x, target.y - p.y);
      }
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
          let cx = 0, cy = 0;
          for (const e of nearby) { cx += e.x; cy += e.y; }
          cx /= nearby.length; cy /= nearby.length;
          const fx = p.x - cx, fy = p.y - cy, fl = Math.hypot(fx, fy) || 1;
          vx = fx / fl + (640 - p.x) / 900;
          vy = fy / fl + (400 - p.y) / 900;
        } else {
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
        const near2 = s.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 200).length;
        if (near2 >= 2 && s.skills.nova <= 0) { await page.key('Digit1', '1', true); await page.key('Digit1', '1', false); }
      } else {
        await bot.setMouse(false);
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

    let endSub = '';
    if (finalSnap && (finalSnap.screen === 'gameover' || finalSnap.screen === 'victory')) {
      endSub = await page.evaluate(`document.getElementById('end-sub').textContent`);
    }
    console.log(`\n===== DIAG RUN ${runIdx}: screen=${finalSnap?.screen} night=${finalSnap?.night} kills=${finalSnap?.kills} score=${finalSnap?.score} endHp=${finalSnap?.hp} endLight=${finalSnap?.light}`);
    console.log(`end-sub: ${endSub}`);
    for (const [n, st] of [...perNight.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  night ${n}: hpStart=${st.hpStart} hpLost=${st.hpLost} lightStart=${st.lightStart != null ? Math.round(st.lightStart) : '?'} lightMin=${st.lightMin === Infinity ? '?' : Math.round(st.lightMin)} lightGained=+${Math.round(st.lightGained)} contactTime=${(st.contactSamples * 0.2).toFixed(1)}s surroundedTime=${(st.surroundedSamples * 0.2).toFixed(1)}s drops=${st.drops.length}`);
      for (const d of st.drops.slice(0, 14)) {
        console.log(`    t=${d.t}s -${d.drop}hp -> ${d.hp} (light ${d.light}, contact ${d.nContact}, close ${d.nClose}, elite ${d.eliteAlive}) near: ${d.nearTypes}`);
      }
      if (st.drops.length > 14) console.log(`    ... and ${st.drops.length - 14} more drops`);
    }
    console.log(`console problems: ${page.problems().length} ${page.problems().join(' | ').slice(0, 200)}`);
  } finally {
    proc.kill();
  }
}

for (let i = 1; i <= RUNS; i++) await diagRun(9360 + i, i);
