// config.js — every balance number, palette entry and content table for EMBERWARD lives
// here, so tuning never hunts through logic. The night tables below are the single source
// the wave director spawns from AND the HUD's INCOMING panel previews, so the two can
// never disagree.

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const ARENA = { x: 52, y: 52, w: VIEW_W - 104, h: VIEW_H - 104 };

export const TOTAL_NIGHTS = 10;
export const NIGHT_SECONDS = 45; // assault window per night; the field must then be cleared
export const SPAWN_WINDOW = 40; // spawns are spread across the first 40 s of a night
export const INTERMISSION_SECONDS = 14;

export const PALETTE = {
  ground: '#0a0a12',
  groundPatch: '#0d0d18',
  rune: '#37e0d8',
  lantern: '#ffd97a',
  lanternCore: '#fff3c4',
  beam: '#ffb347',
  playerCloak: '#2e4a67',
  playerTrim: '#ffd97a',
  hp: '#ff5a5a',
  light: '#ffc94d',
  stamina: '#57e6c9',
  ember: '#ff9d45',
  text: '#cfd6e4',
};

// The lantern economy. Light drains at DRAIN_PER_SECOND at all times during a night;
// holding the beam open burns extra. Oil pickups are the only way back up.
export const LIGHT = {
  max: 100,
  drainPerSecond: 1.9,
  fireDrainPerSecond: 2.5,
  oilValue: 14,
  oilDropChance: 0.26,
};

// Enemy archetypes. `cost` is only flavour for the director; composition is tabled below.
// hp scales by (1 + 0.09 * (night - 1)) at spawn; elites also gain a night-10 bonus.
export const ENEMIES = {
  shade: {
    name: 'Shade', hp: 30, speed: 94, radius: 13, contactDamage: 8,
    score: 10, embers: [1, 2], color: '#b388ff', glow: '#8a5cff',
  },
  howler: {
    name: 'Howler', hp: 16, speed: 152, radius: 10, contactDamage: 6,
    score: 15, embers: [2, 2], color: '#ff7a45', glow: '#ff6d00',
  },
  wraith: {
    name: 'Wraith', hp: 24, speed: 106, radius: 12, contactDamage: 9,
    score: 20, embers: [2, 3], color: '#d8f7ff', glow: '#6fe3ff',
  },
  stalker: {
    name: 'Stalker', hp: 42, speedLit: 56, speedDark: 210, radius: 13, contactDamage: 11,
    score: 25, embers: [3, 3], color: '#cf4b8f', glow: '#f43f9e',
  },
  elite: {
    name: 'Pyre Husk', hp: 340, speed: 60, radius: 27, contactDamage: 16,
    score: 150, embers: [22, 28], color: '#ff7043', glow: '#ff3d00',
    boltDamage: 10, boltSpeed: 215, boltEvery: 2.3,
  },
};

// What each night sends, in counts per type. The tenth night's (DAY 99's) elite is
// the Dread Pyre. Player-facing copy counts days (DAY 90 + night - 1); these tables
// stay keyed by night index.
export const NIGHT_TABLE = [
  { shade: 6 },
  { shade: 9, howler: 2 },
  { shade: 10, howler: 4, elite: 1 },
  { shade: 11, howler: 5, wraith: 3 },
  { shade: 12, howler: 6, wraith: 4, elite: 1 },
  { shade: 13, howler: 7, wraith: 5, stalker: 3 },
  { shade: 14, howler: 8, wraith: 6, stalker: 4, elite: 1 },
  { shade: 16, howler: 9, wraith: 7, stalker: 5 },
  { shade: 17, howler: 10, wraith: 8, stalker: 6, elite: 1 },
  { shade: 20, howler: 12, wraith: 9, stalker: 7, elite: 1 },
];

export const ORDER = ['shade', 'howler', 'wraith', 'stalker', 'elite'];

// Player base stats; relics and blessings rewrite a copy of this (see upgrades.js).
export const BASE_STATS = {
  beamDps: 55,
  beamLength: 470,
  beamHalfWidth: 15,
  moveSpeed: 238,
  maxHp: 100,
  maxLight: LIGHT.max,
  maxStamina: 100,
  dashCost: 30,
  dashCooldown: 1.05,
  dashTime: 0.16,
  dashSpeed: 760,
  magnetRadius: 52,
  oilChance: LIGHT.oilDropChance,
  oilValue: LIGHT.oilValue,
  emberMult: 1,
  skillCooldownMult: 1,
  drainMult: 1,
  thorns: 0,
  lightPerKill: 0,
};

// Prism Shards — the signature refraction. A wraith's facets sometimes survive its
// burning (35%); a Pyre Husk's always do. Carried shards are set into the dark
// (right-click / E), and a beam that strikes a set prism splits into two daughter
// beams at ±26°, each at 65% strength, each travelling what is left of the reach.
export const PRISM = {
  radius: 13,
  wraithDropChance: 0.35,
  carryMax: 2,
  placedMax: 3,
  placeRange: 260,
  lifeSeconds: 25,
  splitAngle: (26 * Math.PI) / 180,
  splitDamage: 0.65,
};

export const SKILLS = {
  nova: { key: '1', name: 'Flare Nova', glyph: '✷', cooldown: 14, radius: 195, damage: 70, knockback: 300 },
  surge: { key: '2', name: 'Oil Surge', glyph: '✚', cooldown: 20, emberCost: 15, lightGain: 25 },
  ward: { key: '3', name: 'Mirror Ward', glyph: '◈', cooldown: 24, duration: 6, reflectDamage: 18 },
};
