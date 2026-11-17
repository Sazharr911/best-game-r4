// world.js — the forest floor. The ground is painted once onto an offscreen canvas at the
// seeded layout for the run: dark textured earth, scattered stones and grass tufts, nine
// faint cyan ritual rings, and a silhouetted tree line closing the arena. Rune positions
// are exported so the renderer can wake them as the lantern passes.

import { ARENA, PALETTE, VIEW_H, VIEW_W } from './config.js';
import { range } from './random.js';

export class World {
  constructor(rng) {
    this.runes = [];
    this.trees = [];
    this.ground = document.createElement('canvas');
    this.ground.width = VIEW_W;
    this.ground.height = VIEW_H;
    this.paint(rng);
  }

  paint(rng) {
    const ctx = this.ground.getContext('2d');
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Mottled earth: soft darker and lighter patches.
    for (let i = 0; i < 90; i++) {
      const x = range(rng, 0, VIEW_W), y = range(rng, 0, VIEW_H), r = range(rng, 40, 150);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = rng() > 0.5 ? '255,255,255' : '0,0,0';
      g.addColorStop(0, `rgba(${tone},${range(rng, 0.015, 0.045)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Speckle: dirt, pebbles, fallen leaves.
    for (let i = 0; i < 2600; i++) {
      const x = range(rng, 0, VIEW_W), y = range(rng, 0, VIEW_H);
      ctx.fillStyle = rng() > 0.86 ? 'rgba(120,110,80,0.20)' : 'rgba(200,210,255,0.05)';
      ctx.fillRect(x, y, range(rng, 1, 2.6), range(rng, 1, 2.6));
    }

    // Grass tufts: three-stroke blades in deep green.
    for (let i = 0; i < 260; i++) {
      const x = range(rng, ARENA.x, ARENA.x + ARENA.w), y = range(rng, ARENA.y, ARENA.y + ARENA.h);
      ctx.strokeStyle = 'rgba(38,74,52,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let b = -1; b <= 1; b++) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + b * 3.4, y - range(rng, 5, 10));
      }
      ctx.stroke();
    }

    // Ritual rings: a broken circle, an inner polygon and radial ticks, all faint cyan.
    for (let i = 0; i < 9; i++) {
      const x = range(rng, ARENA.x + 90, ARENA.x + ARENA.w - 90);
      const y = range(rng, ARENA.y + 90, ARENA.y + ARENA.h - 90);
      const r = range(rng, 30, 58);
      this.runes.push({ x, y, r, seed: rng() * Math.PI * 2 });
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.runes[i].seed);
      ctx.strokeStyle = 'rgba(55,224,216,0.10)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, r, 0.3, Math.PI * 1.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.62, Math.PI * 0.9, Math.PI * 2.2); ctx.stroke();
      ctx.beginPath();
      const sides = 3 + Math.floor(rng() * 3);
      for (let sIdx = 0; sIdx <= sides; sIdx++) {
        const a = (sIdx / sides) * Math.PI * 2;
        const px = Math.cos(a) * r * 0.45, py = Math.sin(a) * r * 0.45;
        if (sIdx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      for (let t = 0; t < 8; t++) {
        const a = (t / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Tree line: layered canopy silhouettes around the rim, trunks below them.
    const rim = [];
    for (let x = 6; x < VIEW_W; x += range(rng, 26, 44)) { rim.push({ x, y: range(rng, 2, 26) }); rim.push({ x, y: VIEW_H - range(rng, 2, 26) }); }
    for (let y = 10; y < VIEW_H; y += range(rng, 26, 44)) { rim.push({ x: range(rng, 2, 24), y }); rim.push({ x: VIEW_W - range(rng, 2, 24), y }); }
    for (const t of rim) {
      const r = range(rng, 20, 40);
      this.trees.push({ x: t.x, y: t.y, r });
      ctx.fillStyle = '#04040a';
      ctx.fillRect(t.x - 2.5, t.y - 4, 5, 16);
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.arc(t.x + range(rng, -r * 0.4, r * 0.4), t.y + range(rng, -r * 0.3, r * 0.3), r * range(rng, 0.5, 0.8), 0, Math.PI * 2);
        ctx.fillStyle = c === 0 ? '#060612' : '#050510';
        ctx.fill();
      }
    }
  }
}
