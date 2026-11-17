// waves.js — the night director. countsForNight() is the one place a night's composition
// is decided: the spawn queue is built from it and the HUD's INCOMING panel prints it, so
// what the player is promised is exactly what the dark sends. In fast mode (play tests)
// nights are shorter and the counts are halved by the same function, so the promise stays
// true there too.

import { NIGHT_TABLE, ORDER, SPAWN_WINDOW, TOTAL_NIGHTS } from './config.js';
import { shuffle } from './random.js';

export function countsForNight(night, fast) {
  const table = NIGHT_TABLE[night - 1] || {};
  const counts = {};
  for (const type of ORDER) {
    const n = table[type] || 0;
    if (n <= 0) continue;
    counts[type] = fast ? Math.max(type === 'elite' ? 1 : 2, Math.ceil(n * 0.5)) : n;
  }
  return counts;
}

export function totalForNight(night, fast) {
  return Object.values(countsForNight(night, fast)).reduce((a, b) => a + b, 0);
}

export function buildQueue(night, fast, rng) {
  const counts = countsForNight(night, fast);
  const flat = [];
  for (const type of ORDER) {
    for (let i = 0; i < (counts[type] || 0); i++) flat.push(type);
  }
  // Elites arrive mid-night, never in the opening seconds: pin them past the first third.
  const elites = flat.filter((t) => t === 'elite');
  const rest = shuffle(rng, flat.filter((t) => t !== 'elite'));
  for (const e of elites) {
    const at = Math.floor(rest.length * (0.4 + rng() * 0.4));
    rest.splice(at, 0, e);
  }
  return rest;
}

// Spawns one enemy per interval until the queue is empty. Returns true while the night
// still has anything left to send.
export function directorStep(G, dt) {
  if (G.spawnQueue.length === 0) return false;
  G.spawnTimer -= dt;
  const total = Math.max(1, G.nightTotal);
  const interval = (G.fast ? 10 : SPAWN_WINDOW) / total;
  if (G.spawnTimer <= 0) {
    G.spawnTimer = Math.max(0.22, interval * (0.7 + G.rng() * 0.6));
    const type = G.spawnQueue.shift();
    G.spawnEnemyOf(type);
  }
  return true;
}

export function nightProgress(G) {
  // Fraction of the campaign complete, for the dawn bar: cleared nights plus the share of
  // this night's host already destroyed.
  const killed = G.nightTotal - G.spawnQueue.length - G.enemies.length;
  const frac = G.nightTotal > 0 ? Math.max(0, Math.min(1, killed / G.nightTotal)) : 0;
  return Math.min(1, ((G.night - 1) + frac) / TOTAL_NIGHTS);
}
