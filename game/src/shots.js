// shots.js — deterministic staged scenes for the maker's screenshots (shots.json) and the
// play-test accelerator. These are not cheats or composites: each scene arranges the
// game's own live state — real enemies, real HUD values, the real beam — and the normal
// render loop draws it, exactly as a player could reach.
//
//   ?shot=cover&seed=8   DAY 99, the last night: dawn breaking at the tree line, the
//                        Dread Pyre closing in, the keeper's beam on it
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
    // DAY 99 — the last night of the Long Dark. Dawn is already breaking at the
    // northern tree line (G.dawnSky) while the Dread Pyre makes its final approach
    // and the whole remaining host converges: twenty hunters on the field, the
    // rest in the queue behind them. The INCOMING panel shows the true Night-10
    // table either way. A Flare Nova has just gone off west of the keeper, a
    // shade is bursting apart in the lantern light, and the keeper's dash
    // ghosts still trail from the dodge that brought the beam onto the Pyre.
    api.startNight(10);
    G.relics.push('lens', 'wick', 'reservoir', 'halo');
    G.blessings.push('bright', 'steady', 'fleet', 'long');
    api.recompute();
    const staged = { elite: 1, shade: 7, howler: 4, wraith: 4, stalker: 4 };
    const counts = countsForNight(10, false);
    G.spawnQueue = [];
    for (const [type, n] of Object.entries(counts)) {
      for (let i = 0; i < n - (staged[type] || 0); i++) G.spawnQueue.push(type);
    }
    G.nightTotal = totalForNight(10, false);
    G.score = 21460; G.embers = 163; G.kills = 262;
    p.light = 92; p.hp = 71;
    p.x = 520; p.y = 445;
    const pyre = spawnEnemyAt(G, 'elite', 905, 315);
    pyre.hp = Math.round(pyre.maxHp * 0.62); // already burned down, still coming
    spawnEnemyAt(G, 'shade', 735, 590);
    spawnEnemyAt(G, 'shade', 350, 300);
    spawnEnemyAt(G, 'shade', 1085, 505);
    spawnEnemyAt(G, 'shade', 180, 470);
    spawnEnemyAt(G, 'shade', 640, 180);
    spawnEnemyAt(G, 'shade', 1150, 640);
    spawnEnemyAt(G, 'shade', 430, 700);
    const lunger = spawnEnemyAt(G, 'howler', 880, 650);
    lunger.mode = 'lunge'; lunger.modeT = 0.3; // caught mid-lunge at the keeper
    lunger.vx = -387; lunger.vy = -220;
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
    spawnEnemyAt(G, 'stalker', 210, 700);
    G.pickups.push({ x: 645, y: 590, t: 0, life: 22, kind: 'oil' });
    G.pickups.push({ x: 385, y: 470, t: 0, life: 22, kind: 'oil' });
    G.pickups.push({ x: 1015, y: 425, t: 0, life: 22, kind: 'oil' });
    // The second action beat: a Flare Nova ring still expanding west of the
    // keeper, its sparks flying, and a shade bursting apart in the light.
    G.rings.push({ x: 372, y: 486, r: 0, maxR: 300, t: 0, dur: 1.5, color: '#ffca6a' });
    burst(G, 372, 486, { n: 34, color: '#ffd97a', speed: 300, size: 2.6, life: 1.0 });
    G.rings.push({ x: 648, y: 302, r: 0, maxR: 95, t: 0, dur: 1.5, color: '#8a5cff' });
    burst(G, 648, 302, { n: 30, color: '#b388ff', speed: 180, size: 3, life: 1.15 });
    burst(G, 648, 302, { n: 12, color: '#ffd97a', speed: 120, size: 2.2, life: 0.9 });
    G.input.mouse.x = 905; G.input.mouse.y = 315;
    G.stageFire = true;
    G.dashGhostDir = { x: 0.947, y: -0.321 }; // the dodge that lined up the beam
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
