// upgrades.js — RELICS (won from Pyre Husks, kept for the run) and BLESSINGS (one of three
// drafted between nights). Both are data: a name, a glyph, a line of flavour, and a `mod`
// that rewrites a fresh copy of BASE_STATS. computeStats() folds the owned lists over the
// base, so effects always compose in a fixed order and never drift.

import { BASE_STATS } from './config.js';

export const RELICS = [
  {
    id: 'lens', name: 'Widened Lens', glyph: '◎',
    desc: 'Beam +60% wider, +10% damage.',
    mod: (s) => { s.beamHalfWidth *= 1.6; s.beamDps *= 1.1; },
  },
  {
    id: 'wick', name: 'Siphon Wick', glyph: '♨',
    desc: 'The lantern sips oil: light drain −25%.',
    mod: (s) => { s.drainMult *= 0.75; },
  },
  {
    id: 'boots', name: 'Swiftwick Boots', glyph: '≫',
    desc: '+12% move speed, dash recharges 25% faster.',
    mod: (s) => { s.moveSpeed *= 1.12; s.dashCooldown *= 0.75; },
  },
  {
    id: 'reservoir', name: 'Deep Reservoir', glyph: '⬣',
    desc: '+30 max Light, and +30 Light on pickup.',
    mod: (s) => { s.maxLight += 30; },
  },
  {
    id: 'halo', name: 'Thorn Halo', glyph: '✹',
    desc: 'A crown of ember-thorns: things that bite you take 10 damage.',
    mod: (s) => { s.thorns = 10; },
  },
  {
    id: 'charm', name: 'Greedy Charm', glyph: '♦',
    desc: 'Ember magnet more than doubled; embers drop 25% richer.',
    mod: (s) => { s.magnetRadius *= 2.1; s.emberMult = 1.25; },
  },
];

export const BLESSINGS = [
  {
    id: 'heart', name: 'Kindled Heart', glyph: '♥',
    desc: '+20 max Light.',
    mod: (s) => { s.maxLight += 20; },
  },
  {
    id: 'steady', name: 'Steady Flame', glyph: '♜',
    desc: 'Light drain −15%.',
    mod: (s) => { s.drainMult *= 0.85; },
  },
  {
    id: 'bright', name: 'Bright Beam', glyph: '☀',
    desc: 'Beam damage +25%.',
    mod: (s) => { s.beamDps *= 1.25; },
  },
  {
    id: 'long', name: 'Long Beam', glyph: '➶',
    desc: 'Beam reach +25%.',
    mod: (s) => { s.beamLength *= 1.25; },
  },
  {
    id: 'fleet', name: 'Fleet Foot', glyph: '»',
    desc: 'Move speed +10%.',
    mod: (s) => { s.moveSpeed *= 1.1; },
  },
  {
    id: 'hands', name: 'Quick Hands', glyph: '✋',
    desc: 'All skill cooldowns −20%.',
    mod: (s) => { s.skillCooldownMult *= 0.8; },
  },
  {
    id: 'baron', name: 'Oil Baron', glyph: '♛',
    desc: 'Oil drops far more often, and each flask holds +6 more.',
    mod: (s) => { s.oilChance += 0.16; s.oilValue += 6; },
  },
  {
    id: 'vampire', name: 'Vampire Wick', glyph: '☾',
    desc: 'Every kill feeds the flame: +0.6 Light per kill.',
    mod: (s) => { s.lightPerKill = 0.6; },
  },
  {
    id: 'wind', name: 'Second Wind', glyph: '➤',
    desc: 'Dashing costs no stamina and recharges 30% faster.',
    mod: (s) => { s.dashCost = 0; s.dashCooldown *= 0.7; },
  },
  {
    id: 'skin', name: 'Thick Skin', glyph: '⬢',
    desc: '+25 max Health, and mend 25 now.',
    mod: (s) => { s.maxHp += 25; },
  },
];

// Repeatable draft fillers, offered when the blessing pool runs dry.
export const FILLER_CARDS = [
  { id: 'cache', name: 'Ember Cache', glyph: '♦', desc: '+30 Embers, right now.', instant: 'cache' },
  { id: 'flask', name: 'Kindled Flask', glyph: '✚', desc: '+30 Light, right now.', instant: 'flask' },
];

export function computeStats(ownedRelics, ownedBlessings) {
  const stats = { ...BASE_STATS };
  for (const r of RELICS) if (ownedRelics.includes(r.id)) r.mod(stats);
  for (const b of BLESSINGS) if (ownedBlessings.includes(b.id)) b.mod(stats);
  return stats;
}

export function relicById(id) { return RELICS.find((r) => r.id === id); }
export function blessingById(id) { return BLESSINGS.find((b) => b.id === id); }
