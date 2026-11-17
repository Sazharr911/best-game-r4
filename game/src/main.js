// main.js — EMBERWARD's state machine and frame loop. Owns the shared game state G that
// every other module reads and writes: title → playing (the run from DAY 90 to the dawn
// of DAY 100, ten nights of spawn, beam and burn) → intermission blessing drafts →
// victory at dawn or the dark taking the keeper.
//
// The loop is a plain requestAnimationFrame with a clamped dt; all simulation lives in
// entities.js / waves.js, all drawing in render.js, all DOM in hud.js.

import { INTERMISSION_SECONDS, TOTAL_NIGHTS } from './config.js';
import { makeRng, pick, shuffle } from './random.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import {
  castSkill, makePlayer, spawnEnemy, tryDash,
  updateBeam, updateEnemies, updateParticles, updatePickups, updatePlayer, updateProjectiles,
} from './entities.js';
import { buildQueue, directorStep, totalForNight } from './waves.js';
import { BLESSINGS, FILLER_CARDS, RELICS, computeStats } from './upgrades.js';
import { parseParams, stage } from './shots.js';

const NIGHT_LINES = [
  'The dark arrives hungry.',
  'They have learned your scent.',
  'Something big stirs in the trees.',
  'The wraiths come out of the fog.',
  'A husk of old fire walks again.',
  'Stalkers — slow in the light. Do not let it die.',
  'The wood itself seems to lean closer.',
  'Three nights stand between you and the dawn.',
  'The dark sends everything it has left.',
  'The last night. Hold until dawn.',
];

const params = parseParams();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function loadBest() {
  try { return Number(window.localStorage.getItem('emberward-best')) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { window.localStorage.setItem('emberward-best', String(v)); } catch { /* sandbox */ }
}

const G = {
  rng: makeRng(params.seed ?? (Date.now() % 2147483647)),
  time: 0,
  screen: 'title',
  paused: false,
  fast: params.fast,
  staged: false,
  stageFire: false,
  night: 1,
  nightTime: 0,
  nightTotal: 0,
  spawnQueue: [],
  spawnTimer: 0,
  interT: 0,
  draft: [],
  player: makePlayer(),
  stats: computeStats([], []),
  relics: [],
  blessings: [],
  embers: 0,
  score: 0,
  kills: 0,
  best: loadBest(),
  enemies: [],
  projectiles: [],
  pickups: [],
  orbs: [],
  particles: [],
  texts: [],
  rings: [],
  skills: { nova: { t: 0 }, surge: { t: 0 }, ward: { t: 0 } },
  beam: { firing: false, target: null, hitX: 0, hitY: 0, length: 0 },
  shake: 0,
  emberAcc: 0,
  hitAcc: 0,
  lastHitSfx: 0,
  lastEmberSfx: 0,
  dawnT: 0,
  endReason: '',
  input: null,
  sfx: new Sfx(),
  world: null,
  spawnEnemyOf: null,
  endRun: null,
  onEliteDown: null,
};

G.input = new Input(canvas);
G.world = new World(G.rng);
const renderer = new Renderer();
const hud = new Hud();

G.spawnEnemyOf = (type) => spawnEnemy(G, type);

function recompute() {
  G.stats = computeStats(G.relics, G.blessings);
  const p = G.player;
  p.hp = Math.min(p.hp, G.stats.maxHp);
  p.light = Math.min(p.light, G.stats.maxLight);
}
G.recompute = recompute;

G.onEliteDown = () => {
  const unowned = RELICS.filter((r) => !G.relics.includes(r.id));
  if (unowned.length === 0) {
    G.embers += 40;
    hud.toast('THE HUSK BURNS DOWN', '+40 embers — every relic is already yours');
    return;
  }
  const relic = pick(G.rng, unowned);
  G.relics.push(relic.id);
  recompute();
  if (relic.id === 'reservoir') G.player.light = Math.min(G.stats.maxLight, G.player.light + 30);
  hud.toast(`RELIC WON — ${relic.name.toUpperCase()}`, relic.desc);
  G.sfx.relic();
};

G.endRun = (reason) => {
  if (G.screen === 'gameover' || G.screen === 'victory') return;
  G.screen = 'gameover';
  G.endReason = reason;
  G.beam.firing = false;
  if (G.score > G.best) { G.best = G.score; saveBest(G.best); }
  hud.showEnd({ victory: false, reason, G });
  G.sfx.doom();
};

function victory(staged = false) {
  if (G.screen === 'victory') return;
  G.screen = 'victory';
  G.beam.firing = false;
  if (!staged) G.score += Math.round(G.player.light) * 5 + Math.round(G.player.hp) * 2;
  if (G.score > G.best) { G.best = G.score; saveBest(G.best); }
  hud.showEnd({ victory: true, reason: '', G });
  G.sfx.dawn();
}
G.victory = victory;

function startNight(n) {
  G.night = n;
  G.nightTime = 0;
  G.nightTotal = totalForNight(n, G.fast);
  G.spawnQueue = buildQueue(n, G.fast, G.rng);
  G.spawnTimer = 0.7;
  hud.toast(`DAY ${89 + n}`, NIGHT_LINES[n - 1]);
}

function beginRun() {
  G.player = makePlayer();
  G.relics = [];
  G.blessings = [];
  recompute();
  G.embers = 0;
  G.score = 0;
  G.kills = 0;
  G.enemies = [];
  G.projectiles = [];
  G.pickups = [];
  G.orbs = [];
  G.particles = [];
  G.texts = [];
  G.rings = [];
  G.skills = { nova: { t: 0 }, surge: { t: 0 }, ward: { t: 0 } };
  G.dawnT = 0;
  G.endReason = '';
  G.screen = 'playing';
  hud.hideTitle();
  hud.hideEnd();
  hud.hideDraft();
  startNight(1);
}

function rollDraft() {
  const pool = shuffle(G.rng, BLESSINGS.filter((b) => !G.blessings.includes(b.id)));
  const cards = pool.slice(0, 3);
  const fillers = shuffle(G.rng, FILLER_CARDS);
  let i = 0;
  while (cards.length < 3) cards.push(fillers[i++ % fillers.length]);
  return cards;
}

function enterIntermission() {
  G.screen = 'intermission';
  G.interT = G.fast ? 3 : INTERMISSION_SECONDS;
  G.beam.firing = false;
  hud.toast(`DAY ${89 + G.night} SURVIVED`, 'The dark pulls back to breathe. Choose.');
  G.draft = rollDraft();
  hud.showDraft(G.draft, pickBlessing);
  G.sfx.draft();
}

function pickBlessing(card) {
  if (G.screen !== 'intermission') return;
  if (card.instant === 'cache') {
    G.embers += 30;
    hud.toast('EMBER CACHE', '+30 embers');
  } else if (card.instant === 'flask') {
    G.player.light = Math.min(G.stats.maxLight, G.player.light + 30);
    hud.toast('KINDLED FLASK', '+30 light');
  } else {
    G.blessings.push(card.id);
    recompute();
    if (card.id === 'heart') G.player.light = Math.min(G.stats.maxLight, G.player.light + 20);
    if (card.id === 'skin') G.player.hp = Math.min(G.stats.maxHp, G.player.hp + 25);
    hud.toast(`BLESSED — ${card.name.toUpperCase()}`, card.desc);
  }
  G.sfx.pickup();
  hud.hideDraft();
  G.screen = 'playing';
  startNight(G.night + 1);
}

function togglePause(force) {
  if (G.screen !== 'playing') return;
  G.paused = force !== undefined ? force : !G.paused;
  hud.showPause(G.paused);
}

function handleEvents() {
  for (const ev of G.input.drainEvents()) {
    if (ev.type !== 'keydown') continue;
    if (ev.code === 'Escape' || ev.code === 'KeyP') togglePause();
    if (ev.code === 'KeyM') {
      G.sfx.muted = !G.sfx.muted;
      hud.toast(G.sfx.muted ? 'SOUND OFF' : 'SOUND ON');
    }
    if (G.screen !== 'playing' || G.paused) continue;
    if (ev.code === 'Space') tryDash(G);
    if (ev.code === 'Digit1') castSkill(G, 'nova');
    if (ev.code === 'Digit2') castSkill(G, 'surge');
    if (ev.code === 'Digit3') castSkill(G, 'ward');
  }
}

function update(dt) {
  G.time += dt;
  handleEvents();
  if (G.paused) return;

  if (G.screen === 'playing') {
    G.nightTime += dt;
    for (const k of Object.keys(G.skills)) G.skills[k].t = Math.max(0, G.skills[k].t - dt);
    G.beam.firing = G.input.mouse.down || G.stageFire;
    if (!G.staged) directorStep(G, dt);
    updatePlayer(G, dt);
    updateBeam(G, dt);
    updateEnemies(G, dt);
    updateProjectiles(G, dt);
    updatePickups(G, dt);
    updateParticles(G, dt);
    if (G.screen === 'playing' && !G.staged && G.spawnQueue.length === 0 && G.enemies.length === 0) {
      if (G.night >= TOTAL_NIGHTS) victory();
      else enterIntermission();
    }
  } else if (G.screen === 'intermission') {
    G.interT -= dt;
    hud.setDraftTimer(`DAY ${89 + G.night + 1} AT DUSK IN ${Math.max(0, Math.ceil(G.interT))} — OR CLICK A BLESSING`);
    updatePlayer(G, dt);
    updatePickups(G, dt);
    updateParticles(G, dt);
    if (G.interT <= 0 && G.draft.length > 0) pickBlessing(G.draft[0]);
  } else if (G.screen === 'victory') {
    G.dawnT = Math.min(1, G.dawnT + dt * 0.45);
    updateParticles(G, dt);
  } else if (G.screen === 'gameover') {
    updateParticles(G, dt);
  }

  G.shake *= Math.pow(0.001, dt);
  if (G.shake < 0.05) G.shake = 0;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
  last = now;
  update(dt);
  ctx.save();
  if (G.shake > 0) {
    ctx.translate((Math.random() * 2 - 1) * G.shake, (Math.random() * 2 - 1) * G.shake);
  }
  renderer.render(G, ctx);
  ctx.restore();
  if (G.screen !== 'title') hud.update(G);
  requestAnimationFrame(frame);
}

// Buttons. Each blurs itself afterwards, so a later Space (dash) can never re-click it.
document.getElementById('btn-start').addEventListener('click', (e) => { e.currentTarget.blur(); G.sfx.unlock(); beginRun(); });
document.getElementById('btn-restart').addEventListener('click', (e) => { e.currentTarget.blur(); G.sfx.unlock(); beginRun(); });
document.getElementById('btn-resume').addEventListener('click', (e) => { e.currentTarget.blur(); togglePause(false); });
canvas.addEventListener('mousedown', () => G.sfx.unlock());

// Staged screenshot scenes (shots.js) arrange live state, then the loop draws it.
if (params.shot) {
  G.staged = params.shot === 'cover' || params.shot === 'play';
  stage(G, { beginRun, startNight, recompute, victory }, params.shot);
  if (params.shot !== 'start' && params.shot !== 'end') hud.hideTitle();
  if (params.shot === 'end') hud.hideTitle();
}

requestAnimationFrame(frame);
requestAnimationFrame(() => { window.__shotReady = true; });

// Read-only snapshot for the input-driven play tests (tools/playtest.mjs).
window.EMBERWARD = {
  snapshot() {
    return {
      screen: G.screen, paused: G.paused, night: G.night, score: G.score,
      embers: G.embers, kills: G.kills,
      light: Math.round(G.player.light * 10) / 10, hp: Math.round(G.player.hp),
      player: { x: Math.round(G.player.x), y: Math.round(G.player.y) },
      queue: G.spawnQueue.length,
      stamina: Math.round(G.player.stamina),
      skills: { nova: G.skills.nova.t, surge: G.skills.surge.t, ward: G.skills.ward.t },
      pickups: G.pickups.map((pk) => ({ x: Math.round(pk.x), y: Math.round(pk.y) })),
      enemies: G.enemies.map((e) => ({ type: e.type, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), solid: e.type !== 'wraith' || e.solid })),
    };
  },
};
