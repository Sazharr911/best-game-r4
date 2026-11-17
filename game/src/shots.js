// shots.js — deterministic staged scenes for the maker's screenshots (shots.json) and the
// play-test accelerator. These are not cheats or composites: each scene arranges the
// game's own live state — real enemies, real HUD values, the real beam — and the normal
// render loop draws it, exactly as a player could reach.
//
//   ?shot=cover&seed=8   Night 8, mid-fight, relics & blessings owned, beam firing
//   ?shot=start&seed=1   the title screen over a haunted forest floor
//   ?shot=play&seed=3    Night 3, mid-fight, an elite in the threat queue
//   ?shot=end&seed=10    the victory screen as dawn breaks
//   ?fast=1              short nights for input-driven play tests (see TESTS.md)
//   ?cover=1             alias for ?shot=cover

import { spawnEnemyAt } from './entities.js';

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
    spawnEnemyAt(G, 'wraith', 830, 620);
    G.pickups.push({ x: 560, y: 560, t: 0, life: 22, kind: 'oil' });
    G.input.mouse.x = 700; G.input.mouse.y = 470;
    G.stageFire = true;
    G.nightTime = 18;
  } else if (name === 'cover') {
    api.startNight(8);
    G.relics.push('lens', 'wick');
    G.blessings.push('bright', 'steady', 'fleet');
    api.recompute();
    G.spawnQueue = ['shade', 'shade', 'howler', 'wraith', 'stalker'];
    G.nightTotal = 33;
    G.score = 8450; G.embers = 137; G.kills = 96;
    p.light = 64; p.hp = 78;
    p.x = 545; p.y = 435;
    spawnEnemyAt(G, 'elite', 955, 285);
    spawnEnemyAt(G, 'shade', 865, 520);
    spawnEnemyAt(G, 'shade', 775, 625);
    spawnEnemyAt(G, 'howler', 845, 205);
    spawnEnemyAt(G, 'wraith', 720, 285);
    spawnEnemyAt(G, 'stalker', 1055, 585);
    spawnEnemyAt(G, 'shade', 330, 620);
    G.pickups.push({ x: 655, y: 590, t: 0, life: 22, kind: 'oil' });
    G.input.mouse.x = 865; G.input.mouse.y = 520;
    G.stageFire = true;
    G.nightTime = 26;
  } else if (name === 'end') {
    api.startNight(10);
    G.score = 12340; G.embers = 212; G.kills = 148;
    p.light = 47; p.hp = 63;
    G.enemies.length = 0;
    G.spawnQueue = [];
    api.victory(true);
  }
}
