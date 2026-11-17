// render.js — draws the world and then the dark. The scene is painted fully lit first
// (ground, runes, pickups, spheres, the keeper, the beam); then a darkness sheet with a
// radial hole at the lantern and a conical hole along the beam is laid over it; finally
// enemy glows leak back through the sheet, so what waits beyond the light is a smudge of
// colour, never a silhouette. Plain 2D canvas throughout — no WebGL.

import { ENEMIES, PALETTE, VIEW_H, VIEW_W } from './config.js';
import { lightRadius } from './entities.js';

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
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(G.world.ground, 0, 0);
    this.drawRunes(G, ctx);
    this.drawPickups(G, ctx);
    for (const e of G.enemies) this.drawEnemy(G, ctx, e);
    this.drawProjectiles(G, ctx);
    this.drawPlayer(G, ctx);
    if (G.beam.firing && G.screen === 'playing') this.drawBeam(G, ctx);
    this.drawParticles(G, ctx);
    this.drawDarkness(G, ctx);
    this.drawLeaks(G, ctx);
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

  drawRunes(G, ctx) {
    const p = G.player;
    const lit = lightRadius(G);
    for (const rune of G.world.runes) {
      const d = Math.hypot(rune.x - p.x, rune.y - p.y);
      const near = Math.max(0, 1 - d / (lit + rune.r));
      if (near <= 0) continue;
      ctx.save();
      ctx.translate(rune.x, rune.y);
      ctx.rotate(rune.seed + G.time * 0.05);
      ctx.strokeStyle = `rgba(55,224,216,${0.30 * near})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, rune.r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, rune.r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      this.drawGlow(ctx, PALETTE.rune, rune.x, rune.y, rune.r * 1.15, 0.10 * near);
    }
  }

  drawPickups(G, ctx) {
    for (const pk of G.pickups) {
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
    let alpha = 1;
    if (e.type === 'wraith') {
      const cyc = e.phaseT % 3.9;
      alpha = e.solid ? Math.min(1, (3.9 - cyc) > 1.7 ? 1 : 0.55 + cyc * 0.2) : 0.20;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    this.drawGlow(ctx, def.glow, e.x, e.y, e.radius * 2.6, 0.5);

    if (e.type === 'elite') {
      // Spiked husk: a rotating crown of shards around a molten core.
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.t * 0.7);
      ctx.fillStyle = '#5a1602';
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath();
        ctx.moveTo(e.radius * 0.8, -5);
        ctx.lineTo(e.radius * 1.45, 0);
        ctx.lineTo(e.radius * 0.8, 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const grad = ctx.createRadialGradient(e.x - e.radius * 0.3, e.y - e.radius * 0.35, e.radius * 0.15, e.x, e.y, e.radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, def.color);
    grad.addColorStop(1, shadeColor(def.color));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();

    if (e.type === 'howler') {
      ctx.fillStyle = def.color;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(e.x + s * e.radius * 0.55, e.y - e.radius * 0.6);
        ctx.lineTo(e.x + s * e.radius * 1.05, e.y - e.radius * 1.3);
        ctx.lineTo(e.x + s * e.radius * 0.15, e.y - e.radius * 0.95);
        ctx.closePath(); ctx.fill();
      }
      if (e.mode === 'windup') {
        ctx.strokeStyle = `rgba(255,80,60,${0.5 + 0.5 * Math.sin(G.time * 30)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Eyes track the keeper.
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    const ex = Math.cos(ang) * e.radius * 0.34, ey = Math.sin(ang) * e.radius * 0.3;
    ctx.fillStyle = '#0a0a12';
    const eyeR = e.type === 'stalker' ? 3.4 : 2.1;
    if (e.type === 'stalker') {
      ctx.beginPath(); ctx.arc(e.x + ex, e.y + ey, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath(); ctx.arc(e.x + ex, e.y + ey, 1.3, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const s of [-1, 1]) {
        const px = e.x + ex + Math.cos(ang + Math.PI / 2) * s * e.radius * 0.32;
        const py = e.y + ey + Math.sin(ang + Math.PI / 2) * s * e.radius * 0.32;
        ctx.beginPath(); ctx.arc(px, py, eyeR, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(0.85, e.flash * 8) * alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();

    if (e.hp < e.maxHp) {
      const w = e.type === 'elite' ? 72 : e.radius * 2;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4.5);
      ctx.fillStyle = e.type === 'elite' ? '#ff7043' : '#c5f27a';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * frac, 4.5);
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

  drawPlayer(G, ctx) {
    const p = G.player;
    const bob = Math.sin(G.time * 6) * 1.2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 13 - bob, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.aim + Math.PI / 2);
    // Cloak: a hooded teardrop in deep blue with a gold trim hem.
    const grad = ctx.createLinearGradient(0, -14, 0, 16);
    grad.addColorStop(0, '#3d6186');
    grad.addColorStop(1, PALETTE.playerCloak);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.bezierCurveTo(11, -6, 13, 8, 8, 15);
    ctx.lineTo(-8, 15);
    ctx.bezierCurveTo(-13, 8, -11, -6, 0, -13);
    ctx.fill();
    ctx.strokeStyle = PALETTE.playerTrim;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, 15); ctx.lineTo(8, 15);
    ctx.stroke();
    // Hood and face shadow.
    ctx.fillStyle = '#16222e';
    ctx.beginPath(); ctx.arc(0, -6, 6.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath(); ctx.arc(0, -5, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // The lantern rides at the keeper's right hand, toward the aim.
    const lx = p.x + Math.cos(p.aim + 0.85) * 15;
    const ly = p.y + Math.sin(p.aim + 0.85) * 15 + bob;
    this.drawGlow(ctx, '#ffca6a', lx, ly, 30 + Math.sin(G.time * 9) * 2.5, 0.75);
    ctx.fillStyle = '#3a2c10';
    ctx.fillRect(lx - 4, ly - 6, 8, 11);
    ctx.fillStyle = PALETTE.lanternCore;
    ctx.fillRect(lx - 2.4, ly - 3.6, 4.8, 6.4);
    ctx.strokeStyle = '#8a6a20';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx - 4, ly - 6, 8, 11);

    if (p.wardT > 0) {
      ctx.strokeStyle = `rgba(155,232,255,${0.55 + 0.3 * Math.sin(G.time * 10)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(G.time * 5) * 1.6, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.iframes > 0 && p.dashT > 0) {
      ctx.strokeStyle = 'rgba(155,232,255,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.stroke();
    }
  }

  beamOrigin(G) {
    const p = G.player;
    return { x: p.x + Math.cos(p.aim + 0.85) * 15, y: p.y + Math.sin(p.aim + 0.85) * 15 };
  }

  drawBeam(G, ctx) {
    const o = this.beamOrigin(G);
    const b = G.beam;
    const grad = ctx.createLinearGradient(o.x, o.y, b.hitX, b.hitY);
    grad.addColorStop(0, 'rgba(255,220,150,0.95)');
    grad.addColorStop(1, 'rgba(255,150,50,0.55)');
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,160,60,0.30)';
    ctx.lineWidth = G.stats.beamHalfWidth * 2.1;
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(b.hitX, b.hitY); ctx.stroke();
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(5, G.stats.beamHalfWidth * 0.8);
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(b.hitX, b.hitY); ctx.stroke();
    ctx.restore();
    if (b.target) this.drawGlow(ctx, '#ffd97a', b.hitX, b.hitY, 30, 0.8);
  }

  drawBeamCore(G, ctx) {
    const o = this.beamOrigin(G);
    const b = G.beam;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,244,200,0.85)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(b.hitX, b.hitY); ctx.stroke();
    ctx.restore();
  }

  drawParticles(G, ctx) {
    for (const r of G.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, 1 - r.t / r.dur) * 0.8;
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
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
    let g = d.createRadialGradient(p.x, p.y, lit * 0.25, p.x, p.y, lit);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g;
    d.beginPath(); d.arc(p.x, p.y, lit, 0, Math.PI * 2); d.fill();

    // The beam cuts a hard cone through the sheet.
    if (G.beam.firing && G.screen === 'playing') {
      const len = G.stats.beamLength + 46;
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
      const pulse = 0.13 + 0.05 * Math.sin(G.time * 3 + e.t * 2);
      this.drawGlow(ctx, def.glow, e.x, e.y, e.radius * 2.2, e.type === 'wraith' && !e.solid ? pulse * 0.4 : pulse);
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
function shadeColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * 0.32);
  const g = Math.floor(((n >> 8) & 255) * 0.32);
  const b = Math.floor((n & 255) * 0.32);
  return `rgb(${r},${g},${b})`;
}
