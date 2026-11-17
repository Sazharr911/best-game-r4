// entities.js — everything that moves: the lantern keeper, the five things that hunt them,
// ember bolts, oil flasks, ember orbs, particles and floating score text. All updates take
// the shared game state G (built in main.js) and a dt in seconds. Combat numbers come from
// config.js and G.stats (the relic/blessing-folded copy from upgrades.js).

import { ARENA, ENEMIES, LIGHT, SKILLS, VIEW_H, VIEW_W } from './config.js';
import { intRange, range } from './random.js';

export function makePlayer() {
  return {
    x: VIEW_W / 2, y: VIEW_H / 2 + 60, vx: 0, vy: 0, radius: 14,
    hp: 100, light: LIGHT.max, stamina: 100,
    aim: 0, dashT: 0, dashCdT: 0, dashDirX: 1, dashDirY: 0,
    iframes: 0, wardT: 0, hurtT: 0, stepT: 0,
  };
}

export function lightRadius(G) {
  const p = G.player;
  const frac = Math.max(0, p.light / G.stats.maxLight);
  const flicker = Math.sin(G.time * 11) * 2.6 + Math.sin(G.time * 23 + 1.7) * 1.9;
  return Math.max(58, 118 + frac * 152 + flicker);
}

// ---------- particles & text ----------

export function burst(G, x, y, { n = 10, color = '#ffd97a', speed = 120, size = 2.4, life = 0.5, up = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2;
    const v = speed * (0.3 + G.rng() * 0.9);
    G.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up,
      life: life * (0.5 + G.rng() * 0.8), maxLife: life,
      size: size * (0.6 + G.rng() * 0.9), color, drag: 0.88,
    });
  }
}

export function floatText(G, x, y, text, color = '#ffd97a', size = 15) {
  G.texts.push({ x, y, vy: -34, life: 0.9, maxLife: 0.9, text, color, size });
}

export function updateParticles(G, dt) {
  const ps = G.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { ps.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const d = Math.pow(p.drag, dt * 60);
    p.vx *= d; p.vy *= d;
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i];
    t.life -= dt; t.y += t.vy * dt;
    if (t.life <= 0) G.texts.splice(i, 1);
  }
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const r = G.rings[i];
    r.t += dt;
    r.r = r.maxR * (1 - Math.pow(1 - Math.min(1, r.t / r.dur), 3));
    if (r.t >= r.dur) G.rings.splice(i, 1);
  }
}

// ---------- spawning ----------

function spawnPoint(G) {
  const p = G.player;
  let best = null, bestD = -1;
  for (let tries = 0; tries < 9; tries++) {
    const edge = Math.floor(G.rng() * 4);
    let x, y;
    if (edge === 0) { x = range(G.rng, ARENA.x + 8, ARENA.x + ARENA.w - 8); y = ARENA.y + 10; }
    else if (edge === 1) { x = range(G.rng, ARENA.x + 8, ARENA.x + ARENA.w - 8); y = ARENA.y + ARENA.h - 10; }
    else if (edge === 2) { x = ARENA.x + 10; y = range(G.rng, ARENA.y + 8, ARENA.y + ARENA.h - 8); }
    else { x = ARENA.x + ARENA.w - 10; y = range(G.rng, ARENA.y + 8, ARENA.y + ARENA.h - 8); }
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > bestD) { bestD = d; best = { x, y }; }
    if (d >= 250) break;
  }
  return best;
}

function makeEnemy(G, type, x, y) {
  const def = ENEMIES[type];
  const hpScale = 1 + 0.09 * (G.night - 1) + (type === 'elite' && G.night === 10 ? 0.35 : 0);
  return {
    type, x, y, vx: 0, vy: 0, kbx: 0, kby: 0,
    hp: def.hp * hpScale, maxHp: def.hp * hpScale,
    radius: def.radius, dmg: def.contactDamage,
    atkCd: 0, flash: 0, t: G.rng() * 10, shootCd: range(G.rng, 1, 2),
    mode: 'stalk', modeT: 0, coolT: 0, phaseT: G.rng() * 3.9, solid: true,
    orbitDir: G.rng() > 0.5 ? 1 : -1, dead: false,
  };
}

export function spawnEnemy(G, type) {
  const pos = spawnPoint(G);
  const e = makeEnemy(G, type, pos.x, pos.y);
  G.enemies.push(e);
  burst(G, e.x, e.y, { n: 8, color: ENEMIES[type].glow, speed: 60, size: 2, life: 0.4 });
  return e;
}

// Place an enemy at exact coordinates — used by the staged screenshot scenes (shots.js).
export function spawnEnemyAt(G, type, x, y) {
  const e = makeEnemy(G, type, x, y);
  G.enemies.push(e);
  return e;
}

// ---------- damage & death ----------

export function damageEnemy(G, e, dmg, kbx = 0, kby = 0) {
  if (e.dead) return;
  if (e.type === 'wraith' && !e.solid) return; // the beam passes through a phased wraith
  e.hp -= dmg;
  e.flash = 0.09;
  e.kbx += kbx; e.kby += kby;
  if (e.hp <= 0) killEnemy(G, e);
}

export function killEnemy(G, e) {
  e.dead = true;
  const def = ENEMIES[e.type];
  G.kills += 1;
  const mult = 1 + 0.1 * (G.night - 1);
  const gained = Math.round(def.score * mult);
  G.score += gained;
  floatText(G, e.x, e.y - e.radius - 4, `+${gained}`, '#ffe9a8', e.type === 'elite' ? 22 : 14);
  burst(G, e.x, e.y, { n: e.type === 'elite' ? 42 : 14, color: def.glow, speed: e.type === 'elite' ? 240 : 150, size: 2.8, life: 0.6 });
  G.sfx.kill();

  // Embers fly out as orbs; the magnet gathers them.
  const emberCount = Math.max(1, Math.round(intRange(G.rng, def.embers[0], def.embers[1]) * G.stats.emberMult));
  for (let i = 0; i < emberCount; i++) {
    const a = G.rng() * Math.PI * 2, v = range(G.rng, 30, 110);
    G.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, value: 1, t: 0 });
  }

  // Oil: a chance per kill, guaranteed (twice) from an elite.
  const oilRolls = e.type === 'elite' ? 2 : (G.rng() < G.stats.oilChance ? 1 : 0);
  for (let i = 0; i < oilRolls; i++) {
    G.pickups.push({
      x: e.x + range(G.rng, -16, 16), y: e.y + range(G.rng, -16, 16),
      t: 0, life: 22, kind: 'oil',
    });
  }

  if (G.stats.lightPerKill > 0) {
    G.player.light = Math.min(G.stats.maxLight, G.player.light + G.stats.lightPerKill);
  }

  if (e.type === 'elite') {
    G.shake = Math.max(G.shake, 7);
    G.rings.push({ x: e.x, y: e.y, r: 0, maxR: 160, t: 0, dur: 0.55, color: '#ff7043' });
    G.onEliteDown(e);
  }
}

export function hurtPlayer(G, dmg, fromX, fromY) {
  const p = G.player;
  if (p.iframes > 0 || G.screen !== 'playing') return;
  if (p.wardT > 0) return; // the ward eats it; the attacker pays at the contact site
  p.hp -= dmg;
  p.hurtT = 0.3;
  p.iframes = Math.max(p.iframes, 0.35); // a breath after any hit: a pile-up cannot melt in one frame
  G.shake = Math.max(G.shake, 5);
  G.sfx.hurt();
  burst(G, p.x, p.y, { n: 10, color: '#ff5a5a', speed: 130, size: 2.4, life: 0.4 });
  if (p.hp <= 0) { p.hp = 0; G.endRun('hp'); }
}

// ---------- player ----------

export function tryDash(G) {
  const p = G.player, s = G.stats;
  if (p.dashCdT > 0 || p.dashT > 0) return;
  if (p.stamina < s.dashCost) return;
  const mv = G.input.moveVector();
  let dx = mv.x, dy = mv.y;
  if (dx === 0 && dy === 0) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
  const len = Math.hypot(dx, dy) || 1;
  p.dashDirX = dx / len; p.dashDirY = dy / len;
  p.dashT = s.dashTime;
  p.dashCdT = s.dashCooldown;
  p.iframes = Math.max(p.iframes, s.dashTime + 0.06);
  p.stamina -= s.dashCost;
  G.sfx.dash();
}

export function updatePlayer(G, dt) {
  const p = G.player, s = G.stats;
  p.aim = Math.atan2(G.input.mouse.y - p.y, G.input.mouse.x - p.x);
  p.dashCdT = Math.max(0, p.dashCdT - dt);
  p.iframes = Math.max(0, p.iframes - dt);
  p.wardT = Math.max(0, p.wardT - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDirX * s.dashSpeed;
    p.vy = p.dashDirY * s.dashSpeed;
    G.particles.push({
      x: p.x, y: p.y + 6, vx: -p.dashDirX * 30, vy: -p.dashDirY * 30,
      life: 0.3, maxLife: 0.3, size: 3, color: '#9be8ff', drag: 0.9,
    });
  } else {
    const mv = G.input.moveVector();
    p.vx = mv.x * s.moveSpeed;
    p.vy = mv.y * s.moveSpeed;
    if (mv.x !== 0 || mv.y !== 0) {
      p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = 0.26; burst(G, p.x, p.y + 12, { n: 1, color: '#3a4a5a', speed: 16, size: 1.6, life: 0.3 }); }
    }
  }
  p.x = Math.min(ARENA.x + ARENA.w - p.radius, Math.max(ARENA.x + p.radius, p.x + p.vx * dt));
  p.y = Math.min(ARENA.y + ARENA.h - p.radius, Math.max(ARENA.y + p.radius, p.y + p.vy * dt));
  p.stamina = Math.min(s.maxStamina, p.stamina + (p.dashT > 0 ? 0 : 24 * dt));

  // The lantern burns during a night: base drain always, beam drain while firing.
  // (Between nights the keeper trims the wick — no drain while the draft is open.)
  if (G.screen === 'playing') {
    const firing = G.beam.firing;
    const drain = LIGHT.drainPerSecond * s.drainMult + (firing ? LIGHT.fireDrainPerSecond : 0);
    p.light -= drain * dt;
    if (p.light <= 0) { p.light = 0; G.endRun('light'); }
  }

  // Ambient ember sparks rise off the lantern.
  G.emberAcc += dt * 7;
  while (G.emberAcc >= 1) {
    G.emberAcc -= 1;
    G.particles.push({
      x: p.x + 13 + range(G.rng, -2, 2), y: p.y + 2,
      vx: range(G.rng, -6, 6), vy: range(G.rng, -26, -12),
      life: range(G.rng, 0.5, 1.1), maxLife: 1.1, size: range(G.rng, 1.2, 2.2),
      color: G.rng() > 0.4 ? '#ffca6a' : '#ff9d45', drag: 0.98,
    });
  }
}

// ---------- the beam ----------

export function updateBeam(G, dt) {
  const p = G.player, s = G.stats;
  const beam = G.beam;
  beam.target = null;
  beam.length = s.beamLength;
  if (!beam.firing || G.screen !== 'playing') return;
  const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
  let bestAlong = Infinity, best = null;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.type === 'wraith' && !e.solid) continue;
    const ex = e.x - p.x, ey = e.y - p.y;
    const along = ex * dx + ey * dy;
    if (along < 0 || along > s.beamLength) continue;
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp <= e.radius + s.beamHalfWidth && along - e.radius < bestAlong) {
      bestAlong = along - e.radius;
      best = e;
    }
  }
  if (best) {
    beam.target = best;
    beam.length = Math.max(20, bestAlong + best.radius * 0.6);
    damageEnemy(G, best, s.beamDps * dt);
    G.hitAcc += dt * 26;
    while (G.hitAcc >= 1) {
      G.hitAcc -= 1;
      burst(G, best.x + range(G.rng, -6, 6), best.y + range(G.rng, -6, 6), { n: 1, color: '#fff3c4', speed: 60, size: 2, life: 0.25 });
    }
    if (G.time - G.lastHitSfx > 0.09) { G.lastHitSfx = G.time; G.sfx.hit(); }
  }
  beam.hitX = p.x + dx * beam.length;
  beam.hitY = p.y + dy * beam.length;
}

// ---------- skills ----------

export function castSkill(G, id) {
  const p = G.player, s = G.stats;
  const cd = G.skills[id];
  if (cd.t > 0 || G.screen !== 'playing') return;
  if (id === 'nova') {
    const def = SKILLS.nova;
    cd.t = def.cooldown * s.skillCooldownMult;
    G.rings.push({ x: p.x, y: p.y, r: 0, maxR: def.radius, t: 0, dur: 0.38, color: '#ffca6a' });
    for (const e of G.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d <= def.radius + e.radius) {
        const inv = 1 / Math.max(20, d);
        damageEnemy(G, e, def.damage, (e.x - p.x) * inv * def.knockback, (e.y - p.y) * inv * def.knockback);
      }
    }
    G.shake = Math.max(G.shake, 6);
    G.sfx.nova();
  } else if (id === 'surge') {
    const def = SKILLS.surge;
    if (G.embers < def.emberCost) return;
    G.embers -= def.emberCost;
    p.light = Math.min(s.maxLight, p.light + def.lightGain);
    cd.t = def.cooldown * s.skillCooldownMult;
    burst(G, p.x, p.y, { n: 18, color: '#ffc94d', speed: 70, size: 2.4, life: 0.7, up: 40 });
    floatText(G, p.x, p.y - 30, `+${def.lightGain} LIGHT`, '#ffc94d', 15);
    G.sfx.surge();
  } else if (id === 'ward') {
    const def = SKILLS.ward;
    cd.t = def.cooldown * s.skillCooldownMult;
    p.wardT = def.duration;
    G.rings.push({ x: p.x, y: p.y, r: 0, maxR: 44, t: 0, dur: 0.3, color: '#9be8ff' });
    G.sfx.ward();
  }
}

// ---------- enemies ----------

export function updateEnemies(G, dt) {
  const p = G.player;
  const lit = lightRadius(G);
  for (const e of G.enemies) {
    if (e.dead) continue;
    const def = ENEMIES[e.type];
    e.t += dt;
    e.atkCd = Math.max(0, e.atkCd - dt);
    e.flash = Math.max(0, e.flash - dt);
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    let wantX = 0, wantY = 0, speed = def.speed;

    if (e.type === 'shade') {
      wantX = ux; wantY = uy;
    } else if (e.type === 'howler') {
      e.coolT -= dt;
      if (e.mode === 'stalk') {
        wantX = ux; wantY = uy;
        if (dist < 205 && e.coolT <= 0) { e.mode = 'windup'; e.modeT = 0.35; }
      } else if (e.mode === 'windup') {
        e.modeT -= dt;
        wantX = -ux * 0.15; wantY = -uy * 0.15;
        if (e.modeT <= 0) { e.mode = 'lunge'; e.modeT = 0.32; e.vx = ux * 445; e.vy = uy * 445; }
      } else if (e.mode === 'lunge') {
        e.modeT -= dt;
        if (e.modeT <= 0) { e.mode = 'stalk'; e.coolT = 1.6; }
      }
    } else if (e.type === 'wraith') {
      e.phaseT += dt;
      const cyc = e.phaseT % 3.9;
      e.solid = cyc < 2.2;
      wantX = ux; wantY = uy;
    } else if (e.type === 'stalker') {
      speed = dist < lit * 1.05 ? def.speedLit : def.speedDark;
      wantX = ux; wantY = uy;
    } else if (e.type === 'elite') {
      e.shootCd -= dt;
      if (dist > 330) { wantX = ux; wantY = uy; }
      else { wantX = -uy * e.orbitDir * 0.55; wantY = ux * e.orbitDir * 0.55; }
      if (e.shootCd <= 0 && dist < 580) {
        e.shootCd = def.boltEvery;
        G.projectiles.push({
          x: e.x, y: e.y, vx: ux * def.boltSpeed, vy: uy * def.boltSpeed,
          r: 5, dmg: def.boltDamage, t: 0, life: 4.5,
        });
        burst(G, e.x, e.y, { n: 5, color: '#ff7043', speed: 50, size: 2, life: 0.3 });
      }
    }

    if (e.mode !== 'lunge') { e.vx = wantX * speed; e.vy = wantY * speed; }
    e.x += (e.vx + e.kbx) * dt;
    e.y += (e.vy + e.kby) * dt;
    e.kbx *= Math.pow(0.0015, dt); e.kby *= Math.pow(0.0015, dt);
    e.x = Math.min(ARENA.x + ARENA.w - e.radius, Math.max(ARENA.x + e.radius, e.x));
    e.y = Math.min(ARENA.y + ARENA.h - e.radius, Math.max(ARENA.y + e.radius, e.y));

    // Contact.
    if (dist < e.radius + p.radius + 2 && e.atkCd <= 0) {
      if (e.type === 'wraith' && !e.solid) { /* passes through, harmless */ }
      else if (p.wardT > 0) {
        e.atkCd = 0.8;
        damageEnemy(G, e, SKILLS.ward.reflectDamage, ux * -160, uy * -160);
        burst(G, p.x, p.y, { n: 6, color: '#9be8ff', speed: 90, size: 2, life: 0.3 });
      } else if (p.iframes <= 0) {
        e.atkCd = 0.8;
        hurtPlayer(G, e.dmg, e.x, e.y);
        if (G.stats.thorns > 0) damageEnemy(G, e, G.stats.thorns, ux * -120, uy * -120);
      }
    }
  }

  // Gentle separation so spheres do not stack into one blob.
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius - 2;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
  }

  G.enemies = list.filter((e) => !e.dead);
}

// ---------- projectiles & pickups ----------

export function updateProjectiles(G, dt) {
  const p = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const b = G.projectiles[i];
    b.t += dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    let gone = b.t > b.life;
    if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.radius) {
      if (p.wardT <= 0) hurtPlayer(G, b.dmg, b.x, b.y);
      burst(G, b.x, b.y, { n: 7, color: '#ff7043', speed: 80, size: 2, life: 0.3 });
      gone = true;
    }
    if (b.x < ARENA.x || b.x > ARENA.x + ARENA.w || b.y < ARENA.y || b.y > ARENA.y + ARENA.h) gone = true;
    if (gone) G.projectiles.splice(i, 1);
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.t += dt;
    if (pk.t > pk.life) { G.pickups.splice(i, 1); continue; }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
      p.light = Math.min(G.stats.maxLight, p.light + G.stats.oilValue);
      floatText(G, pk.x, pk.y - 14, `+${G.stats.oilValue} OIL`, '#ffc94d', 14);
      burst(G, pk.x, pk.y, { n: 9, color: '#ffc94d', speed: 60, size: 2, life: 0.4 });
      G.sfx.pickup();
      G.pickups.splice(i, 1);
    }
  }
  for (let i = G.orbs.length - 1; i >= 0; i--) {
    const o = G.orbs[i];
    o.t += dt;
    const dx = p.x - o.x, dy = p.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < G.stats.magnetRadius) {
      const pull = 620 * (1 - d / (G.stats.magnetRadius * 1.6));
      o.vx += (dx / d) * pull * dt * 3.2;
      o.vy += (dy / d) * pull * dt * 3.2;
    }
    o.vx *= Math.pow(0.02, dt); o.vy *= Math.pow(0.02, dt);
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (d < 22) {
      G.embers += o.value;
      if (G.time - G.lastEmberSfx > 0.06) { G.lastEmberSfx = G.time; G.sfx.ember(); }
      G.orbs.splice(i, 1);
    } else if (o.t > 25) {
      G.orbs.splice(i, 1);
    }
  }
}
