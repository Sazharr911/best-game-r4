// render.js — draws the world and then the dark. The scene is painted fully lit first
// (ground, runes, pickups, spheres, the keeper, the beam); then a darkness sheet with a
// radial hole at the lantern and a conical hole along the beam is laid over it; finally
// enemy glows leak back through the sheet, so what waits beyond the light is a smudge of
// colour, never a silhouette. Plain 2D canvas throughout — no WebGL.

import { ENEMIES, PALETTE, PRISM, VIEW_H, VIEW_W } from './config.js';
import { lightRadius } from './entities.js';

// Drawn body size per hunter, as a multiple of the (unchanged) collision radius.
const VIS_SCALE = { shade: 1.5, howler: 1.45, wraith: 1.5, stalker: 1.55, elite: 1.8 };

// The keeper is drawn at this scale; its collision radius and every logic number
// stay exactly as they were — only the drawing grew, so the character reads.
const KEEPER_SCALE = 1.35;

function makeGlow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color + 'aa');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

export class Renderer {
  constructor() {
    this.dark = document.createElement('canvas');
    this.dark.width = VIEW_W; this.dark.height = VIEW_H;
    this.glows = new Map();
    // Ambient visual-only life: drifting fireflies and embers shed by elites. These
    // live in the renderer, never in G, so they cannot touch the simulation.
    this.motes = [];
    for (let i = 0; i < 70; i++) {
      const roll = Math.random();
      this.motes.push({
        x: Math.random() * VIEW_W, y: Math.random() * VIEW_H,
        ph: Math.random() * Math.PI * 2, sp: 4 + Math.random() * 9,
        hue: roll > 0.5 ? '#ffca6a' : roll > 0.22 ? '#37e0d8' : '#b388ff',
      });
    }
    this.fx = [];
    this.lastT = 0;
    this.emberAcc = 0;
    this.vignette = document.createElement('canvas');
    this.vignette.width = VIEW_W; this.vignette.height = VIEW_H;
    const v = this.vignette.getContext('2d');
    const g = v.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = g;
    v.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  glow(color) {
    if (!this.glows.has(color)) this.glows.set(color, makeGlow(color));
    return this.glows.get(color);
  }

  drawGlow(ctx, color, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.glow(color), x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  render(G, ctx) {
    const p = G.player;
    const dt = Math.max(0, Math.min(0.05, G.time - this.lastT));
    this.lastT = G.time;
    this.updateFx(G, dt);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(G.world.ground, 0, 0);
    if (G.dawnSky) {
      // The staged finale's first light, soaking the northern tree line from below.
      const g = ctx.createLinearGradient(0, 0, 0, 280);
      g.addColorStop(0, 'rgba(52,160,146,0.28)');
      g.addColorStop(0.5, 'rgba(214,164,84,0.16)');
      g.addColorStop(1, 'rgba(214,164,84,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, 280);
    }
    this.drawRunes(G, ctx);
    this.drawBraziers(G, ctx);
    this.drawPickups(G, ctx);
    this.drawPrisms(G, ctx);
    for (const e of G.enemies) this.drawEnemy(G, ctx, e);
    this.drawProjectiles(G, ctx);
    this.drawPlayer(G, ctx);
    if (G.beam.firing && G.screen === 'playing') this.drawBeam(G, ctx);
    this.drawParticles(G, ctx);
    this.drawFx(G, ctx);
    this.drawDarkness(G, ctx);
    this.drawLeaks(G, ctx);
    // A warm wash breathing out of the lantern over the cut sheet, so the lit
    // pool reads as lamplight rather than a hole in the murk.
    if (G.screen !== 'victory') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.drawGlow(ctx, '#ff9d45', p.x, p.y, lightRadius(G) * 0.95, 0.08);
      ctx.restore();
    }
    if (G.dawnSky) this.drawDawnSky(G, ctx);
    if (G.beam.firing && G.screen === 'playing') this.drawBeamCore(G, ctx);
    this.drawTexts(G, ctx);
    ctx.drawImage(this.vignette, 0, 0);

    // Pain and peril: a red edge while hurt, a pulsing one while the light runs dry.
    if (p.hurtT > 0) this.edgeGlow(ctx, `rgba(255,40,40,${0.35 * (p.hurtT / 0.3)})`);
    if (G.screen === 'playing' && p.light < G.stats.maxLight * 0.22) {
      const pulse = 0.16 + 0.12 * Math.sin(G.time * 6);
      this.edgeGlow(ctx, `rgba(255,60,30,${pulse})`);
    }

    // Dawn, on victory: warm light swelling out of the lantern until it takes the frame.
    if (G.screen === 'victory') {
      const t = Math.min(1, G.dawnT);
      const r = 120 + t * 1050;
      const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,214,130,${0.55 * t})`);
      g.addColorStop(0.7, `rgba(255,170,80,${0.28 * t})`);
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  edgeGlow(ctx, style) {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, style);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Fireflies wander on slow sine paths; elites shed rising embers. Both are pure
  // decoration, updated from the frame clock and drawn under the darkness sheet.
  updateFx(G, dt) {
    for (const m of this.motes) {
      m.ph += dt * 0.4;
      m.x += Math.cos(m.ph * 1.7) * m.sp * dt + 3.5 * dt;
      m.y += Math.sin(m.ph * 2.3) * m.sp * dt;
      if (m.x > VIEW_W + 8) m.x = -8;
      if (m.x < -8) m.x = VIEW_W + 8;
      if (m.y > VIEW_H + 8) m.y = -8;
      if (m.y < -8) m.y = VIEW_H + 8;
    }
    this.emberAcc += dt;
    for (const e of G.enemies) {
      if (e.type !== 'elite' || e.dead) continue;
      while (this.emberAcc > 0.05) {
        this.emberAcc -= 0.05;
        this.fx.push({
          x: e.x + (Math.random() - 0.5) * e.radius * 1.6,
          y: e.y + (Math.random() - 0.5) * e.radius * 1.2,
          vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 26,
          life: 0.9 + Math.random() * 0.7, maxLife: 1.6,
          size: 1.4 + Math.random() * 1.8,
          color: Math.random() > 0.35 ? '#ff9d45' : '#ffd97a',
        });
      }
    }
    if (G.enemies.every((e) => e.type !== 'elite')) this.emberAcc = Math.min(this.emberAcc, 0.05);
    // The ward braziers breathe embers too, each on its own slow cadence.
    for (const b of G.world.braziers) {
      if (Math.random() < dt * 6) {
        this.fx.push({
          x: b.x + (Math.random() - 0.5) * 10, y: b.y - 26,
          vx: (Math.random() - 0.5) * 10, vy: -26 - Math.random() * 22,
          life: 0.8 + Math.random() * 0.8, maxLife: 1.6,
          size: 1.3 + Math.random() * 1.6,
          color: Math.random() > 0.35 ? '#ff9d45' : '#ffd97a',
        });
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      if (f.life <= 0) { this.fx.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
    }
    if (this.fx.length > 320) this.fx.splice(0, this.fx.length - 320);
  }

  drawFx(G, ctx) {
    for (const m of this.motes) {
      const tw = 0.35 + 0.3 * Math.sin(G.time * 2.1 + m.ph * 3);
      this.drawGlow(ctx, m.hue, m.x, m.y, 9, tw);
      ctx.fillStyle = m.hue;
      ctx.globalAlpha = Math.min(1, tw + 0.25);
      ctx.beginPath(); ctx.arc(m.x, m.y, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const f of this.fx) {
      const a = Math.max(0, f.life / f.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawRunes(G, ctx) {
    const p = G.player;
    const lit = lightRadius(G);
    for (const rune of G.world.runes) {
      const d = Math.hypot(rune.x - p.x, rune.y - p.y);
      const near = Math.max(0, 1 - d / (lit + rune.r));
      if (near <= 0) continue;
      // The etchings breathe: a slow pulse rides under the lantern's waking light.
      const pulse = 0.85 + 0.15 * Math.sin(G.time * 1.3 + rune.seed * 3);
      ctx.save();
      ctx.translate(rune.x, rune.y);
      ctx.rotate(rune.seed + G.time * 0.05);
      ctx.strokeStyle = `rgba(55,224,216,${0.52 * near * pulse})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, rune.r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, rune.r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      this.drawGlow(ctx, PALETTE.rune, rune.x, rune.y, rune.r * 1.3, 0.22 * near * pulse);
    }
  }

  // The ward braziers: a squat stone pillar and bowl, a flame that never sits
  // still, and a pool of warm light soaking the ground around it. Pure scenery —
  // the darkness sheet gets its own holes for them in drawDarkness, and their
  // bloom leaks back in drawLeaks.
  drawBraziers(G, ctx) {
    for (const b of G.world.braziers) {
      const flick = Math.sin(G.time * 9 + b.seed) * 0.5 + Math.sin(G.time * 23 + b.seed * 2.7) * 0.3;
      // Pooled lamplight on the ground.
      this.drawGlow(ctx, '#ff9d45', b.x, b.y + 4, 118 + flick * 9, 0.30);
      // Shadow, then the pillar: a tapered stone column on the painted plinth.
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 15, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
      const stone = ctx.createLinearGradient(b.x - 10, 0, b.x + 10, 0);
      stone.addColorStop(0, '#17171f');
      stone.addColorStop(0.45, '#33333f');
      stone.addColorStop(1, '#101018');
      ctx.fillStyle = stone;
      ctx.beginPath();
      ctx.moveTo(b.x - 10, b.y + 14);
      ctx.lineTo(b.x - 6.5, b.y - 14);
      ctx.lineTo(b.x + 6.5, b.y - 14);
      ctx.lineTo(b.x + 10, b.y + 14);
      ctx.closePath(); ctx.fill();
      // A rune notch glowing faintly on the shaft — the ward-mark.
      ctx.fillStyle = `rgba(55,224,216,${0.35 + 0.12 * Math.sin(G.time * 1.3 + b.seed * 3)})`;
      ctx.beginPath(); ctx.arc(b.x, b.y + 1, 1.8, 0, Math.PI * 2); ctx.fill();
      // The bowl.
      ctx.fillStyle = '#0c0c12';
      ctx.beginPath(); ctx.ellipse(b.x, b.y - 15, 13, 4.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,205,235,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(b.x, b.y - 15, 13, 4.6, 0, 0, Math.PI); ctx.stroke();
      // The flame: a halo, a teardrop, a white-hot heart.
      this.drawGlow(ctx, '#ffca6a', b.x, b.y - 24, 42 + flick * 6, 0.75);
      const fh = 15 + flick * 3;
      const flame = ctx.createRadialGradient(b.x, b.y - 20, 0.5, b.x, b.y - 20, fh);
      flame.addColorStop(0, '#fff6da');
      flame.addColorStop(0.4, '#ffc94d');
      flame.addColorStop(1, 'rgba(255,120,40,0.12)');
      ctx.fillStyle = flame;
      ctx.beginPath(); ctx.ellipse(b.x, b.y - 20, 6.4, fh * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); ctx.ellipse(b.x, b.y - 18, 2.4, fh * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // A dropped Prism Shard: a small turning crystal waiting to be carried.
  drawShard(G, ctx, pk) {
    const blink = pk.life - pk.t < 4 ? (Math.sin(G.time * 14) > 0 ? 1 : 0.25) : 1;
    const bob = Math.sin(G.time * 3 + pk.x) * 2.5;
    ctx.save();
    ctx.globalAlpha = blink;
    this.drawGlow(ctx, '#6fe3ff', pk.x, pk.y + bob, 24, 0.55);
    ctx.translate(pk.x, pk.y + bob);
    ctx.rotate(G.time * 1.4 + pk.x);
    ctx.fillStyle = '#dff6ff';
    ctx.strokeStyle = '#37e0d8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5.5, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // A set prism: a faceted crystal standing in the dark, slowly turning, its
  // heart flaring white while the beam is splitting on it.
  drawPrisms(G, ctx) {
    for (const pr of G.prisms) {
      const left = pr.life - pr.t;
      const pulse = left < 3
        ? (Math.sin(G.time * 16) > 0 ? 1 : 0.35)
        : 0.8 + 0.2 * Math.sin(G.time * 2.4 + pr.seed);
      this.drawGlow(ctx, '#37e0d8', pr.x, pr.y, 42, 0.4 * pulse);
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(G.time * 0.7 + pr.seed);
      const r = PRISM.radius + 5;
      const grad = ctx.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, 'rgba(230,250,255,0.95)');
      grad.addColorStop(0.5, 'rgba(140,225,245,0.75)');
      grad.addColorStop(1, 'rgba(70,160,220,0.85)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = `rgba(190,245,255,${0.9 * pulse})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.72, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.72, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(0, r);
      ctx.moveTo(-r * 0.72, 0); ctx.lineTo(r * 0.72, 0);
      ctx.stroke();
      ctx.restore();
      if (G.beam.splitFrom === pr) {
        this.drawGlow(ctx, '#ffffff', pr.x, pr.y, 34, 0.9);
        this.drawGlow(ctx, '#9be8ff', pr.x, pr.y, 60, 0.5);
      }
    }
  }

  drawPickups(G, ctx) {
    for (const pk of G.pickups) {
      if (pk.kind === 'shard') { this.drawShard(G, ctx, pk); continue; }
      const blink = pk.life - pk.t < 4 ? (Math.sin(G.time * 14) > 0 ? 1 : 0.25) : 1;
      const bob = Math.sin(G.time * 3 + pk.x) * 2.5;
      ctx.save();
      ctx.globalAlpha = blink;
      this.drawGlow(ctx, '#ffc94d', pk.x, pk.y + bob, 26, 0.5);
      ctx.fillStyle = '#7a4d12';
      ctx.strokeStyle = '#ffc94d';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(pk.x - 6, pk.y - 9 + bob, 12, 18, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(pk.x - 3.4, pk.y - 13 + bob, 6.8, 4.4);
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(pk.x - 3, pk.y - 3 + bob, 6, 7);
      ctx.restore();
    }
    for (const o of G.orbs) {
      this.drawGlow(ctx, '#ff9d45', o.x, o.y, 11, 0.55);
      ctx.fillStyle = '#ffc06a';
      ctx.beginPath(); ctx.arc(o.x, o.y, 3.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawEnemy(G, ctx, e) {
    const def = ENEMIES[e.type];
    const p = G.player;
    // Bodies are drawn larger than their collision radius (which never changes):
    // each hunter gets a visual scale and a silhouette of its own.
    const vr = e.radius * VIS_SCALE[e.type];
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    let alpha = 1;
    if (e.type === 'wraith') {
      const cyc = e.phaseT % 3.9;
      alpha = e.solid ? Math.min(1, (3.9 - cyc) > 1.7 ? 1 : 0.55 + cyc * 0.2) : 0.20;
    }
    ctx.save();
    ctx.globalAlpha = alpha;

    // The stalker's glow stays banked low until it is nearly on the keeper.
    let glowAlpha = 0.5;
    if (e.type === 'stalker') {
      const lit = lightRadius(G);
      const closeness = Math.max(0, Math.min(1, 1 - dist / (lit * 1.6)));
      glowAlpha = 0.14 + 0.5 * closeness;
    }
    // The Pyre's halo is kept tighter and thinner than the other hunters':
    // at full size and strength it washed the spiked crown out to a ball.
    const glowR = e.type === 'elite' ? vr * 2.2 : vr * 2.6;
    if (e.type === 'elite') glowAlpha = 0.38;
    this.drawGlow(ctx, def.glow, e.x, e.y, glowR, glowAlpha);

    const speed = Math.hypot(e.vx, e.vy);
    if (e.type === 'shade' && speed > 5) {
      // Smoky echoes trail behind the shade's motion.
      const ux = e.vx / speed, uy = e.vy / speed;
      for (let k = 3; k >= 1; k--) {
        ctx.globalAlpha = alpha * (0.13 - k * 0.028);
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(e.x - ux * k * 13, e.y - uy * k * 13 + Math.sin(G.time * 5 + k * 1.7) * 2, vr * (1 - k * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }
    if (e.type === 'howler' && speed > 20) {
      // Motion streaks shear off the howler as it runs.
      const ux = e.vx / speed, uy = e.vy / speed;
      ctx.strokeStyle = def.glow;
      ctx.lineWidth = 2;
      for (let sIdx = -1; sIdx <= 1; sIdx++) {
        const off = sIdx * vr * 0.45;
        const len = vr * (0.9 + 0.3 * Math.abs(Math.sin(G.time * 31 + sIdx)));
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.moveTo(e.x - ux * vr * 0.6 - uy * off, e.y - uy * vr * 0.6 + ux * off);
        ctx.lineTo(e.x - ux * (vr * 0.6 + len) - uy * off, e.y - uy * (vr * 0.6 + len) + ux * off);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    }

    if (e.type === 'elite') {
      // The Pyre: a great crown of blackened shards turning around a molten
      // heart. The shards are near-black and wide — silhouettes against the
      // husk's own smoulder, or they vanish into it.
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.t * 0.7);
      ctx.fillStyle = '#260b01';
      for (let i = 0; i < 16; i++) {
        ctx.rotate(Math.PI / 8);
        ctx.beginPath();
        ctx.moveTo(vr * 0.78, -9.5);
        ctx.lineTo(vr * 1.66, 0);
        ctx.lineTo(vr * 0.78, 9.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const grad = ctx.createRadialGradient(e.x - vr * 0.3, e.y - vr * 0.35, vr * 0.15, e.x, e.y, vr);
    if (e.type === 'elite') {
      // The Pyre's body must stay a burning husk, never a white moon: its
      // gradient runs hot amber into ember-red, not the white core the
      // smaller hunters get — between the white centre, the molten core and
      // the hit flash, the old body blew out to a plain bright orb.
      grad.addColorStop(0, '#ff9a4d');
      grad.addColorStop(0.35, def.color);
      grad.addColorStop(1, shadeColor(def.color, 0.26));
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, def.color);
      grad.addColorStop(1, e.type === 'stalker' ? shadeColor(def.color, 0.16) : shadeColor(def.color));
    }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(e.x, e.y, vr, 0, Math.PI * 2); ctx.fill();

    if (e.type === 'elite') {
      // A molten heart and glowing cracks across the husk — hot, but kept
      // amber rather than white-hot so the heart reads as fire, not glare.
      const core = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, vr * 0.34);
      core.addColorStop(0, 'rgba(255,200,130,0.85)');
      core.addColorStop(0.6, 'rgba(255,140,60,0.6)');
      core.addColorStop(1, 'rgba(255,120,50,0)');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(e.x, e.y, vr * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(e.x, e.y, vr, 0, Math.PI * 2); ctx.clip();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.t * 0.2);
      ctx.strokeStyle = 'rgba(255,205,110,0.8)';
      ctx.lineWidth = 1.7;
      for (const [sx, sy, bend] of [[-0.5, -0.55, 0.3], [0.42, -0.3, -0.5], [-0.15, 0.5, 0.42]]) {
        ctx.beginPath();
        ctx.moveTo(sx * vr, sy * vr);
        ctx.lineTo((sx + bend) * vr * 0.8, (sy + 0.28) * vr);
        ctx.lineTo((sx + bend * 0.4) * vr * 0.7, (sy + 0.62) * vr);
        ctx.stroke();
      }
      ctx.restore();
      // Ember-rimmed spike tips, so the crown reads against the dark.
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.t * 0.7);
      ctx.fillStyle = '#8a3408';
      ctx.strokeStyle = 'rgba(255,170,85,1)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        ctx.rotate(Math.PI / 8);
        ctx.beginPath();
        ctx.moveTo(vr * 1.18, -4.6);
        ctx.lineTo(vr * 1.68, 0);
        ctx.lineTo(vr * 1.18, 4.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    if (e.type === 'wraith') {
      // A translucent halo ring, its dashes crawling around the body.
      ctx.strokeStyle = `rgba(190,245,255,${0.38 * alpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -G.time * 22;
      ctx.beginPath(); ctx.arc(e.x, e.y, vr * 1.32, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(190,245,255,${0.16 * alpha})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, vr * 1.55, 0, Math.PI * 2); ctx.stroke();
    }

    if (e.type === 'howler') {
      ctx.fillStyle = def.color;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(e.x + s * vr * 0.55, e.y - vr * 0.6);
        ctx.lineTo(e.x + s * vr * 1.05, e.y - vr * 1.3);
        ctx.lineTo(e.x + s * vr * 0.15, e.y - vr * 0.95);
        ctx.closePath(); ctx.fill();
      }
      if (e.mode === 'windup') {
        ctx.strokeStyle = `rgba(255,80,60,${0.5 + 0.5 * Math.sin(G.time * 30)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, vr + 7, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Eyes track the keeper.
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    const ex = Math.cos(ang) * vr * 0.34, ey = Math.sin(ang) * vr * 0.3;
    ctx.fillStyle = '#0a0a12';
    const eyeR = e.type === 'stalker' ? 4.6 : e.type === 'elite' ? 3.6 : 3;
    if (e.type === 'stalker') {
      ctx.beginPath(); ctx.arc(e.x + ex, e.y + ey, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath(); ctx.arc(e.x + ex, e.y + ey, 1.8, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const s of [-1, 1]) {
        const px = e.x + ex + Math.cos(ang + Math.PI / 2) * s * vr * 0.32;
        const py = e.y + ey + Math.sin(ang + Math.PI / 2) * s * vr * 0.32;
        ctx.beginPath(); ctx.arc(px, py, eyeR, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (e.flash > 0) {
      // The Pyre is too big to flash full white — cap its flash hard so it
      // stays a burning husk, not a moon, while the beam is on it.
      const cap = e.type === 'elite' ? 0.15 : 0.85;
      ctx.globalAlpha = Math.min(cap, e.flash * 8) * alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(e.x, e.y, vr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();

    if (e.hp < e.maxHp) {
      const w = e.type === 'elite' ? 104 : vr * 2;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - vr - 13, w, 4.5);
      ctx.fillStyle = e.type === 'elite' ? '#ff7043' : '#c5f27a';
      ctx.fillRect(e.x - w / 2, e.y - vr - 13, w * frac, 4.5);
    }
  }

  drawProjectiles(G, ctx) {
    for (const b of G.projectiles) {
      this.drawGlow(ctx, '#ff3d00', b.x, b.y, 20, 0.65);
      ctx.fillStyle = '#ffb199';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7043';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Where the lantern hangs: out at the keeper's leading hand, toward the aim.
  // The keeper is DRAWN at KEEPER_SCALE (below); the lantern rides at the scaled
  // reach so hand, lantern and beam origin stay in agreement.
  lanternPos(G) {
    const p = G.player;
    const bob = Math.sin(G.time * 6) * 1.6;
    return {
      x: p.x + Math.cos(p.aim + 0.8) * 27,
      y: p.y + Math.sin(p.aim + 0.8) * 27 + bob,
      bob,
    };
  }

  drawPlayer(G, ctx) {
    const p = G.player;
    const bob = Math.sin(G.time * 6) * 1.6;
    const speed = Math.hypot(p.vx, p.vy);
    const moving = Math.min(1, speed / 200);
    // The hem sways harder the faster the keeper moves; the whole cloak leans into a strafe.
    const sway = Math.sin(G.time * (5 + moving * 6)) * (1 + moving * 2.4);
    const lean = Math.max(-0.14, Math.min(0.14, p.vx * 0.00045));

    // Dash trail: three fading ghosts of the cloak strung out behind the dash.
    // Staged scenes (shots.js) may set G.dashGhostDir to freeze the moment just
    // after a dash without touching the simulation.
    const gdx = p.dashT > 0 ? p.dashDirX : (G.dashGhostDir ? G.dashGhostDir.x : 0);
    const gdy = p.dashT > 0 ? p.dashDirY : (G.dashGhostDir ? G.dashGhostDir.y : 0);
    if (p.dashT > 0 || G.dashGhostDir) {
      for (let k = 3; k >= 1; k--) {
        ctx.save();
        ctx.translate(p.x - gdx * k * 17, p.y - gdy * k * 17);
        ctx.rotate(Math.atan2(gdy, gdx) + Math.PI / 2);
        ctx.scale(KEEPER_SCALE, KEEPER_SCALE);
        ctx.globalAlpha = 0.20 / k;
        ctx.fillStyle = '#7fb2d9';
        ctx.beginPath();
        ctx.moveTo(0, -17);
        ctx.bezierCurveTo(12, -8, 15, 9, 10, 19);
        ctx.lineTo(-10, 19);
        ctx.bezierCurveTo(-15, 9, -12, -8, 0, -17);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.scale(KEEPER_SCALE, KEEPER_SCALE);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.ellipse(0, 21 - bob, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.aim + Math.PI / 2 + lean);
    // Cloak: a tall hooded teardrop in deep blue, hem swinging with the sway.
    const grad = ctx.createLinearGradient(0, -20, 0, 22);
    grad.addColorStop(0, '#466e96');
    grad.addColorStop(0.55, '#33506f');
    grad.addColorStop(1, PALETTE.playerCloak);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.bezierCurveTo(13, -11, 16, 6, 12 + sway * 0.4, 19);
    ctx.quadraticCurveTo(sway, 24, -12 + sway * 0.4, 19);
    ctx.bezierCurveTo(-16, 6, -13, -11, 0, -19);
    ctx.fill();
    // Gold trim along the hem, following the sway.
    ctx.strokeStyle = PALETTE.playerTrim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-12 + sway * 0.4, 19);
    ctx.quadraticCurveTo(sway, 24, 12 + sway * 0.4, 19);
    ctx.stroke();
    // Shoulder mantle and a gold clasp at the throat.
    ctx.fillStyle = 'rgba(16,26,38,0.55)';
    ctx.beginPath(); ctx.ellipse(0, -6, 11.5, 6.5, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = PALETTE.playerTrim;
    ctx.beginPath(); ctx.arc(0, -3.5, 1.7, 0, Math.PI * 2); ctx.fill();
    // Hood: a deep cowl, its rim caught by lantern light on the leading side.
    const hood = ctx.createRadialGradient(-2, -14, 2, 0, -11, 11);
    hood.addColorStop(0, '#2c4258');
    hood.addColorStop(1, '#131e2a');
    ctx.fillStyle = hood;
    ctx.beginPath(); ctx.arc(0, -11, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,122,0.75)';
    ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.arc(0, -11, 10, -0.5, 1.15); ctx.stroke();
    // Face lost in shadow, two faint embers for eyes.
    ctx.fillStyle = '#06060c';
    ctx.beginPath(); ctx.arc(0, -10, 6.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,190,90,0.55)';
    ctx.beginPath(); ctx.arc(-2.3, -10.5, 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.3, -10.5, 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // The lantern itself: a caged flame riding at the keeper's leading hand.
    const l = this.lanternPos(G);
    const flick = Math.sin(G.time * 9) * 2.5 + Math.sin(G.time * 23) * 1.4;
    this.drawGlow(ctx, '#ffca6a', l.x, l.y, 44 + flick, 0.8);
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.scale(KEEPER_SCALE, KEEPER_SCALE);
    ctx.fillStyle = '#241a08';
    ctx.fillRect(-2, -13, 4, 3.4); // hanger
    ctx.beginPath(); ctx.arc(0, -13.5, 2.4, 0, Math.PI * 2); ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 1.2; ctx.stroke();
    const cage = ctx.createLinearGradient(0, -10, 0, 10);
    cage.addColorStop(0, '#4a3512');
    cage.addColorStop(1, '#2c1f08');
    ctx.fillStyle = cage;
    ctx.beginPath(); ctx.roundRect(-6.5, -10, 13, 19, 3); ctx.fill();
    const flame = ctx.createRadialGradient(0, 1, 0.5, 0, 1, 6);
    flame.addColorStop(0, '#fffbe8');
    flame.addColorStop(0.45, PALETTE.lanternCore);
    flame.addColorStop(1, 'rgba(255,160,60,0.15)');
    ctx.fillStyle = flame;
    ctx.beginPath(); ctx.ellipse(0, 1 + flick * 0.14, 3.6, 5.6 + flick * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a87f28';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.roundRect(-6.5, -10, 13, 19, 3); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2.2, -9); ctx.lineTo(-2.2, 8);
    ctx.moveTo(2.2, -9); ctx.lineTo(2.2, 8);
    ctx.stroke();
    ctx.restore();

    if (p.wardT > 0) {
      ctx.strokeStyle = `rgba(155,232,255,${0.55 + 0.3 * Math.sin(G.time * 10)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 43 + Math.sin(G.time * 5) * 1.6, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.iframes > 0 && p.dashT > 0) {
      ctx.strokeStyle = 'rgba(155,232,255,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 35, 0, Math.PI * 2); ctx.stroke();
    }
  }

  beamOrigin(G) {
    const l = this.lanternPos(G);
    return { x: l.x, y: l.y };
  }

  drawBeam(G, ctx) {
    // The beam's body of light, painted under the darkness sheet: two nested cones —
    // a wide, faint wash and a narrower, stronger one — never a solid capsule.
    const o = this.beamOrigin(G);
    const b = G.beam;
    const p = G.player;
    const len = Math.max(24, Math.hypot(b.hitX - o.x, b.hitY - o.y));
    const flick = 0.9 + 0.07 * Math.sin(G.time * 37) + 0.05 * Math.sin(G.time * 13.7);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(p.aim);
    const cone = (halfWidth, a0, a1) => {
      const half = Math.atan2(halfWidth, len);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `rgba(255,186,92,${a0 * flick})`);
      g.addColorStop(0.6, `rgba(255,160,60,${a1 * flick})`);
      g.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, len, -half, half);
      ctx.closePath();
      ctx.fill();
    };
    cone(G.stats.beamHalfWidth * 2.6, 0.16, 0.05);
    cone(G.stats.beamHalfWidth * 1.35, 0.30, 0.10);
    ctx.restore();

    // The daughters: cooler, dimmer cones fanning out of the prism.
    for (const sp of G.beam.splits) {
      const slen = Math.max(24, sp.len);
      const half = Math.atan2(G.stats.beamHalfWidth * 1.35, slen);
      ctx.save();
      ctx.translate(sp.x1, sp.y1);
      ctx.rotate(sp.ang);
      const g2 = ctx.createLinearGradient(0, 0, slen, 0);
      g2.addColorStop(0, `rgba(190,235,255,${0.20 * flick})`);
      g2.addColorStop(0.6, `rgba(150,210,255,${0.08 * flick})`);
      g2.addColorStop(1, 'rgba(150,210,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, slen, -half, half);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawBeamCore(G, ctx) {
    // Over the darkness: a thin brilliant core, a white-hot centre thread, and the
    // impact point flaring with spark streaks where the light bites.
    const o = this.beamOrigin(G);
    const b = G.beam;
    const flick = 0.9 + 0.07 * Math.sin(G.time * 37) + 0.05 * Math.sin(G.time * 13.7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,240,196,${0.9 * flick})`;
    ctx.lineWidth = 3.1;
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(b.hitX, b.hitY); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,250,0.95)';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(b.hitX, b.hitY); ctx.stroke();

    // Impact flare.
    this.drawGlow(ctx, '#ffd97a', b.hitX, b.hitY, 40, 0.85 * flick);
    this.drawGlow(ctx, '#ffffff', b.hitX, b.hitY, 13, 0.9);
    // Spark streaks: short bright shards flying off the bite point, re-rolled fast.
    const roll = Math.floor(G.time * 24);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) {
      const h = Math.sin(roll * 127.1 + i * 311.7) * 43758.5453;
      const frac = h - Math.floor(h);
      const ang = frac * Math.PI * 2;
      const dist = 7 + frac * 15;
      ctx.strokeStyle = `rgba(255,222,150,${0.75 * (1 - frac * 0.5)})`;
      ctx.beginPath();
      ctx.moveTo(b.hitX + Math.cos(ang) * 3, b.hitY + Math.sin(ang) * 3);
      ctx.lineTo(b.hitX + Math.cos(ang) * dist, b.hitY + Math.sin(ang) * dist);
      ctx.stroke();
    }

    // The daughters' cores: the same thin thread, a touch dimmer and cooler,
    // with their own flare where they bite.
    for (const sp of G.beam.splits) {
      ctx.strokeStyle = `rgba(230,248,255,${0.75 * flick})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(sp.x1, sp.y1); ctx.lineTo(sp.x2, sp.y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sp.x1, sp.y1); ctx.lineTo(sp.x2, sp.y2); ctx.stroke();
      if (sp.target) {
        this.drawGlow(ctx, '#dff6ff', sp.x2, sp.y2, 30, 0.8 * flick);
        this.drawGlow(ctx, '#ffffff', sp.x2, sp.y2, 10, 0.85);
      }
    }
    ctx.restore();
  }

  drawParticles(G, ctx) {
    for (const r of G.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, 1 - r.t / r.dur) * 0.8;
      ctx.lineWidth = 3.5;
      // r.r can dip a hair below zero on the very first frame (the rAF clock
      // can predate the module clock), and arc() throws on a negative radius.
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(0, r.r), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const pt of G.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawDarkness(G, ctx) {
    const d = this.dark.getContext('2d');
    const p = G.player;
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = 'source-over';
    d.fillStyle = 'rgba(3,3,11,0.94)';
    d.fillRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = 'destination-out';

    const lit = lightRadius(G);
    let g = d.createRadialGradient(p.x, p.y, lit * 0.34, p.x, p.y, lit);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.88)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g;
    d.beginPath(); d.arc(p.x, p.y, lit, 0, Math.PI * 2); d.fill();

    // Each ward brazier holds back its own pool of dark.
    for (const b of G.world.braziers) {
      const flick = Math.sin(G.time * 9 + b.seed) * 4;
      const br = 118 + flick;
      g = d.createRadialGradient(b.x, b.y - 12, 10, b.x, b.y - 12, br);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(b.x, b.y - 12, br, 0, Math.PI * 2); d.fill();
    }

    // The beam cuts a hard cone through the sheet — only as far as the light
    // actually travels, which is the prism when one takes the beam.
    if (G.beam.firing && G.screen === 'playing') {
      const len = G.beam.length + 46;
      const half = 0.17;
      d.save();
      d.translate(p.x, p.y);
      d.rotate(p.aim);
      const cg = d.createLinearGradient(0, 0, len, 0);
      cg.addColorStop(0, 'rgba(0,0,0,0.95)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = cg;
      d.beginPath();
      d.moveTo(0, 0);
      d.arc(0, 0, len, -half, half);
      d.closePath();
      d.fill();
      d.restore();

      // The refracted daughters cut their own narrower, weaker cones.
      for (const sp of G.beam.splits) {
        const slen = sp.len + 30;
        d.save();
        d.translate(sp.x1, sp.y1);
        d.rotate(sp.ang);
        const sg = d.createLinearGradient(0, 0, slen, 0);
        sg.addColorStop(0, 'rgba(0,0,0,0.8)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = sg;
        d.beginPath();
        d.moveTo(0, 0);
        d.arc(0, 0, slen, -0.12, 0.12);
        d.closePath();
        d.fill();
        d.restore();
      }
    }

    // A set prism glints through the dark around itself.
    for (const pr of G.prisms) {
      g = d.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, 30);
      g.addColorStop(0, 'rgba(0,0,0,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(pr.x, pr.y, 30, 0, Math.PI * 2); d.fill();
    }

    // Oil flasks and elites smoulder through the dark.
    for (const pk of G.pickups) {
      g = d.createRadialGradient(pk.x, pk.y, 1, pk.x, pk.y, 30);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(pk.x, pk.y, 30, 0, Math.PI * 2); d.fill();
    }
    for (const e of G.enemies) {
      if (e.type !== 'elite') continue;
      g = d.createRadialGradient(e.x, e.y, 4, e.x, e.y, 56);
      g.addColorStop(0, 'rgba(0,0,0,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(e.x, e.y, 56, 0, Math.PI * 2); d.fill();
    }

    ctx.drawImage(this.dark, 0, 0);
  }

  drawLeaks(G, ctx) {
    const p = G.player;
    const lit = lightRadius(G);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of G.enemies) {
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist < lit * 0.8) continue;
      const def = ENEMIES[e.type];
      let pulse = 0.13 + 0.05 * Math.sin(G.time * 3 + e.t * 2);
      if (e.type === 'wraith' && !e.solid) pulse *= 0.4;
      if (e.type === 'stalker') pulse *= 0.45; // it hides its light until it is close
      this.drawGlow(ctx, def.glow, e.x, e.y, e.radius * VIS_SCALE[e.type] * 2.2, pulse);
    }
    // Fireflies shine straight through the dark, faintly.
    for (const m of this.motes) {
      this.drawGlow(ctx, m.hue, m.x, m.y, 7, 0.10 + 0.05 * Math.sin(G.time * 2.1 + m.ph * 3));
    }
    // Set prisms leak a cool glint, so their geometry stays readable in the dark.
    for (const pr of G.prisms) {
      this.drawGlow(ctx, '#37e0d8', pr.x, pr.y, 26, 0.12 + 0.04 * Math.sin(G.time * 2.4 + pr.seed));
    }
    // Brazier flames bloom over the sheet's edge, so their pools feel lit
    // from inside rather than merely uncovered.
    for (const b of G.world.braziers) {
      const flick = Math.sin(G.time * 9 + b.seed) * 0.5 + Math.sin(G.time * 23 + b.seed * 2.7) * 0.3;
      this.drawGlow(ctx, '#ff9d45', b.x, b.y - 22, 56 + flick * 6, 0.34);
      ctx.fillStyle = 'rgba(255,243,196,0.85)';
      ctx.beginPath(); ctx.arc(b.x, b.y - 20, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // Mushrooms glimmer along the tree line, and the rune circles shimmer
    // at the edge of hearing — never full light, just a promise of it.
    for (const m of G.world.mushrooms) {
      const tw = 0.10 + 0.06 * Math.sin(G.time * 1.7 + m.ph);
      this.drawGlow(ctx, m.hue, m.x, m.y, m.r * 4.5, tw);
      ctx.fillStyle = m.hue;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const rune of G.world.runes) {
      const pulse = 0.85 + 0.15 * Math.sin(G.time * 1.3 + rune.seed * 3);
      this.drawGlow(ctx, PALETTE.rune, rune.x, rune.y, rune.r * 1.1, 0.05 * pulse);
    }
    ctx.restore();
  }

  drawDawnSky(G, ctx) {
    // Dawn breaking through the canopy at the top edge — a teal-to-gold band laid
    // over the darkness itself, with pale rays fanning down through the trees.
    // Only the staged cover scene sets G.dawnSky; ordinary nights stay dark.
    const pulse = 0.92 + 0.08 * Math.sin(G.time * 0.9);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, `rgba(120,240,214,${0.44 * pulse})`);
    g.addColorStop(0.35, `rgba(255,214,130,${0.27 * pulse})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, 300);
    // The horizon band: a warm seam of light where the sky meets the trees.
    const band = ctx.createLinearGradient(0, 40, 0, 235);
    band.addColorStop(0, 'rgba(255,196,110,0)');
    band.addColorStop(0.55, `rgba(255,196,110,${0.13 * pulse})`);
    band.addColorStop(1, 'rgba(255,196,110,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 40, VIEW_W, 195);
    ctx.translate(VIEW_W / 2, -30);
    for (const [ang, w, a] of [[-0.62, 54, 0.06], [-0.5, 60, 0.075], [-0.18, 95, 0.10], [0.14, 72, 0.085], [0.44, 52, 0.065]]) {
      ctx.save();
      ctx.rotate(ang);
      const rg = ctx.createLinearGradient(0, 0, 0, 440);
      rg.addColorStop(0, `rgba(255,226,160,${a * pulse})`);
      rg.addColorStop(1, 'rgba(255,226,160,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
      ctx.lineTo(w * 1.5, 440); ctx.lineTo(-w * 1.5, 440);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawTexts(G, ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of G.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = `700 ${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}

// Darken a #rrggbb colour toward black for body shading.
function shadeColor(hex, f = 0.32) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * f);
  const g = Math.floor(((n >> 8) & 255) * f);
  const b = Math.floor((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}
