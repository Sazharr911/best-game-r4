// shots.js — deterministic staged scenes for the maker's screenshots (shots.json) and the
// play-test accelerator. These are not cheats or composites: each scene arranges the
// game's own live state — real enemies, real HUD values, the real beam — and the normal
// render loop draws it, exactly as a player could reach.
//
//   ?shot=cover&seed=8   DAY 99, the last night: dawn breaking at the tree line, the
//                        keeper's beam splitting on a set prism — one daughter on
//                        the Dread Pyre (PHASE II), the other on a stalker
//   ?shot=start&seed=1   the title screen over a haunted forest floor
//   ?shot=play&seed=3    DAY 92, mid-fight, an elite in the threat queue
//   ?shot=end&seed=10    the victory screen as dawn breaks
//   ?fast=1              short nights for input-driven play tests (see TESTS.md)
//   ?cover=1             alias for ?shot=cover

import { burst, spawnEnemyAt } from './entities.js';
import { countsForNight, totalForNight } from './waves.js';

export function parseParams() {
  const q = new URLSearchParams(window.location.search);
  let shot = q.get('shot');
  if (q.get('cover') === '1') shot = 'cover';
  return {
    shot,
    seed: Number(q.get('seed') || 0) || null,
    fast: q.get('fast') === '1',
  };
}

function placeRing(G) {
  // A staged closing ring for the title backdrop: shapes waiting in the trees.
  spawnEnemyAt(G, 'shade', 240, 210);
  spawnEnemyAt(G, 'shade', 1060, 240);
  spawnEnemyAt(G, 'howler', 1010, 590);
  spawnEnemyAt(G, 'wraith', 300, 610);
  spawnEnemyAt(G, 'stalker', 660, 150);
}

export function stage(G, api, name) {
  if (name === 'start') {
    placeRing(G);
    return;
  }
  api.beginRun();
  const p = G.player; // beginRun() replaces the player object — read it after the reset
  if (name === 'play') {
    api.startNight(3);
    G.spawnQueue = ['shade', 'howler', 'wraith'];
    G.nightTotal = 14;
    G.score = 1260; G.embers = 41; G.kills = 17;
    p.light = 71; p.hp = 86;
    p.x = 470; p.y = 430;
    spawnEnemyAt(G, 'elite', 930, 300);
    spawnEnemyAt(G, 'howler', 700, 470);
    spawnEnemyAt(G, 'shade', 790, 560);
    spawnEnemyAt(G, 'shade', 350, 250);
    spawnEnemyAt(G, 'shade', 600, 190);
    spawnEnemyAt(G, 'wraith', 830, 620);
    G.pickups.push({ x: 560, y: 560, t: 0, life: 22, kind: 'oil' });
    G.input.mouse.x = 700; G.input.mouse.y = 470;
    G.stageFire = true;
    G.dashGhostDir = { x: 0.962, y: -0.272 }; // frozen mid-dash toward the husk
    G.nightTime = 18;
  } else if (name === 'cover') {
    // DAY 99 — the last night of the Long Dark, and the money shot is the
    // GEOMETRY: the keeper stands left of centre and fires into a set prism;
    // the beam splits there, one daughter burning the Dread Pyre (at 55%, its
    // boss bar in PHASE II) up the −26° ray, the other a stalker down the +26°
    // ray. Dawn is already breaking at the northern tree line (G.dawnSky), a
    // Flare Nova has just gone off west of the keeper, a CHAIN x6 and a +150
    // hang mid-rise, and twenty-two more hunters converge around the fan while
    // the rest wait in the queue — the INCOMING panel shows the true Night-10
    // table either way. The geometry is exact, not painted: keeper (430,445),
    // prism (667,380) on the aim line, splits at −41.3° and +10.7°, the Pyre
    // 190px up the first ray, the stalker 210px down the second.
    api.startNight(10);
    G.relics.push('lens', 'wick', 'reservoir', 'halo');
    G.blessings.push('bright', 'steady', 'fleet', 'long');
    api.recompute();
    const staged = { elite: 1, shade: 9, howler: 4, wraith: 5, stalker: 5 };
    const counts = countsForNight(10, false);
    G.spawnQueue = [];
    for (const [type, n] of Object.entries(counts)) {
      for (let i = 0; i < n - (staged[type] || 0); i++) G.spawnQueue.push(type);
    }
    G.nightTotal = totalForNight(10, false);
    G.score = 21460; G.embers = 163; G.kills = 262;
    p.light = 92; p.hp = 71;
    p.x = 430; p.y = 445;
    // The prism, set mid-frame on the aim line; one shard still in hand.
    G.prisms.push({ x: 667, y: 380, t: 0, life: 25, seed: 3.3 });
    G.prismCarried = 1;
    const pyre = spawnEnemyAt(G, 'elite', 810, 255);
    pyre.hp = Math.round(pyre.maxHp * 0.55); // PHASE II, still coming
    pyre.phase = 2; // keep the phase field honest with the staged health, or the
    // first burn tick would fire the phase event into the portrait
    spawnEnemyAt(G, 'stalker', 873, 419); // the second daughter's mark
    spawnEnemyAt(G, 'shade', 735, 590);
    spawnEnemyAt(G, 'shade', 350, 300);
    spawnEnemyAt(G, 'shade', 1085, 505);
    spawnEnemyAt(G, 'shade', 180, 470);
    spawnEnemyAt(G, 'shade', 640, 180);
    spawnEnemyAt(G, 'shade', 1150, 640);
    spawnEnemyAt(G, 'shade', 250, 620);
    const lunger = spawnEnemyAt(G, 'howler', 880, 650);
    lunger.mode = 'lunge'; lunger.modeT = 0.3; // caught mid-lunge at the keeper
    lunger.vx = -405; lunger.vy = -185;
    spawnEnemyAt(G, 'howler', 255, 578);
    const winder = spawnEnemyAt(G, 'howler', 770, 110);
    winder.mode = 'windup'; winder.modeT = 0.55; // crouched, flashing, about to spring
    spawnEnemyAt(G, 'howler', 150, 330);
    spawnEnemyAt(G, 'wraith', 755, 185);
    spawnEnemyAt(G, 'wraith', 1125, 235);
    spawnEnemyAt(G, 'wraith', 300, 120);
    spawnEnemyAt(G, 'wraith', 620, 700);
    spawnEnemyAt(G, 'stalker', 175, 235);
    spawnEnemyAt(G, 'stalker', 1010, 600);
    spawnEnemyAt(G, 'stalker', 1130, 430);
    // The right half carries its share: one shade inside the dawn light at
    // the northern tree line, the rest as glow leaks in the dark at varied
    // ranges — none of them over the split fan or the Pyre.
    spawnEnemyAt(G, 'shade', 1010, 140);
    spawnEnemyAt(G, 'shade', 1180, 350);
    spawnEnemyAt(G, 'wraith', 975, 470);
    spawnEnemyAt(G, 'stalker', 1200, 520);
    G.pickups.push({ x: 555, y: 590, t: 0, life: 22, kind: 'oil' });
    G.pickups.push({ x: 385, y: 470, t: 0, life: 22, kind: 'oil' });
    G.pickups.push({ x: 1015, y: 425, t: 0, life: 22, kind: 'oil' });
    // Feedback, frozen mid-rise: the chain the HUD counts, and a score popup
    // off the Pyre. Their long staged lives survive the capture settle.
    G.chain = { n: 6, last: 0 };
    G.texts.push({ x: 700, y: 300, vy: -20, life: 1.5, maxLife: 1.5, text: 'CHAIN x6', color: '#7dfcd8', size: 26 });
    G.texts.push({ x: 818, y: 210, vy: -20, life: 1.5, maxLife: 1.5, text: '+150', color: '#ffe9a8', size: 15 });
    // The second action beat: a Flare Nova ring still expanding west of the
    // keeper, its sparks flying, and a shade bursting apart in the light.
    G.rings.push({ x: 282, y: 486, r: 0, maxR: 300, t: 0, dur: 1.5, color: '#ffca6a' });
    burst(G, 282, 486, { n: 34, color: '#ffd97a', speed: 300, size: 2.6, life: 1.0 });
    G.rings.push({ x: 558, y: 302, r: 0, maxR: 95, t: 0, dur: 1.5, color: '#8a5cff' });
    burst(G, 558, 302, { n: 30, color: '#b388ff', speed: 180, size: 3, life: 1.15 });
    burst(G, 558, 302, { n: 12, color: '#ffd97a', speed: 120, size: 2.2, life: 0.9 });
    G.input.mouse.x = 667; G.input.mouse.y = 380;
    G.stageFire = true;
    G.dashGhostDir = { x: 0.964, y: -0.264 }; // the dodge that lined up the prism
    G.dawnSky = true;
    G.nightTime = 31;
  } else if (name === 'end') {
    api.startNight(10);
    G.score = 12340; G.embers = 212; G.kills = 148;
    p.light = 47; p.hp = 63;
    G.enemies.length = 0;
    G.spawnQueue = [];
    api.victory(true);
  }
}
