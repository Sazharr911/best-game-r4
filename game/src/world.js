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
    this.braziers = [];
    this.mushrooms = [];
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

    // Moss patches: soft dark-green blooms soaking into the earth.
    for (let i = 0; i < 58; i++) {
      const x = range(rng, 0, VIEW_W), y = range(rng, 0, VIEW_H), r = range(rng, 26, 84);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(26,52,34,${range(rng, 0.14, 0.24)})`);
      g.addColorStop(1, 'rgba(26,52,34,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Speckle: dirt, pebbles, fallen leaves.
    for (let i = 0; i < 3200; i++) {
      const x = range(rng, 0, VIEW_W), y = range(rng, 0, VIEW_H);
      ctx.fillStyle = rng() > 0.86 ? 'rgba(120,110,80,0.20)' : 'rgba(200,210,255,0.05)';
      ctx.fillRect(x, y, range(rng, 1, 2.6), range(rng, 1, 2.6));
    }

    // Fallen leaves: small rusted ellipses, turned every which way.
    const leafTones = ['146,96,44', '110,84,40', '84,96,52', '128,64,44'];
    for (let i = 0; i < 240; i++) {
      const x = range(rng, ARENA.x, ARENA.x + ARENA.w), y = range(rng, ARENA.y, ARENA.y + ARENA.h);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = `rgba(${leafTones[Math.floor(rng() * leafTones.length)]},${range(rng, 0.18, 0.38)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, range(rng, 2.6, 4.4), range(rng, 1.4, 2.4), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Stones: grey-blue ellipses with a pale crown where the moon catches them.
    for (let i = 0; i < 140; i++) {
      const x = range(rng, ARENA.x, ARENA.x + ARENA.w), y = range(rng, ARENA.y, ARENA.y + ARENA.h);
      const rx = range(rng, 2.6, 6.4), ry = rx * range(rng, 0.55, 0.8);
      ctx.fillStyle = rng() > 0.5 ? '#23232f' : '#1b1b28';
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(190,200,230,0.21)';
      ctx.beginPath(); ctx.ellipse(x - rx * 0.18, y - ry * 0.34, rx * 0.55, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Grass tufts: five-stroke blades in two greens, some grown tall.
    for (let i = 0; i < 820; i++) {
      const x = range(rng, ARENA.x, ARENA.x + ARENA.w), y = range(rng, ARENA.y, ARENA.y + ARENA.h);
      const tall = rng() > 0.82;
      ctx.strokeStyle = rng() > 0.4 ? 'rgba(38,74,52,0.62)' : 'rgba(46,96,66,0.52)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let b = -2; b <= 2; b++) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + b * 2.6 + range(rng, -1, 1), y - range(rng, 5, tall ? 15 : 10));
      }
      ctx.stroke();
    }

    // Ritual rings: a broken circle, an inner polygon and radial ticks, etched in cyan
    // bright enough to read as the game's signature when the lantern wakes them.
    for (let i = 0; i < 9; i++) {
      const x = range(rng, ARENA.x + 90, ARENA.x + ARENA.w - 90);
      const y = range(rng, ARENA.y + 90, ARENA.y + ARENA.h - 90);
      const r = range(rng, 30, 58);
      this.runes.push({ x, y, r, seed: rng() * Math.PI * 2 });
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.runes[i].seed);
      // A breath of light pooled at the centre of the etching.
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      cg.addColorStop(0, 'rgba(55,224,216,0.11)');
      cg.addColorStop(1, 'rgba(55,224,216,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(55,224,216,0.27)';
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
      // Glyph dots on the rim, one per tick.
      ctx.fillStyle = 'rgba(55,224,216,0.32)';
      for (let t = 0; t < 8; t++) {
        const a = (t / 8) * Math.PI * 2 + 0.39;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Ward braziers: four standing stones of the Emberward, set asymmetric about
    // the clearing — never a grid. The floor keeps only the scorched ring and the
    // plinth; the renderer raises their flames and light pools every frame.
    const brazierSpots = [[228, 196], [1058, 232], [306, 626], [966, 672]];
    for (const [bx, by] of brazierSpots) {
      this.braziers.push({ x: bx, y: by, seed: rng() * Math.PI * 2 });
      const sg = ctx.createRadialGradient(bx, by, 2, bx, by, 32);
      sg.addColorStop(0, 'rgba(0,0,0,0.5)');
      sg.addColorStop(0.7, 'rgba(24,12,4,0.28)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(bx - 32, by - 32, 64, 64);
      ctx.fillStyle = '#191922';
      ctx.beginPath(); ctx.ellipse(bx, by + 14, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,205,235,0.10)';
      ctx.beginPath(); ctx.ellipse(bx - 3, by + 12, 9, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Glowing mushrooms crowd the tree line: pale fruiting dots in cyan and
    // violet. The floor keeps their bases; the renderer makes them shine
    // through the dark (see this.mushrooms).
    for (let c = 0; c < 13; c++) {
      const edge = Math.floor(rng() * 4);
      let cx, cy;
      if (edge === 0) { cx = range(rng, 60, VIEW_W - 60); cy = range(rng, 26, 64); }
      else if (edge === 1) { cx = range(rng, 60, VIEW_W - 60); cy = VIEW_H - range(rng, 26, 64); }
      else if (edge === 2) { cx = range(rng, 24, 58); cy = range(rng, 60, VIEW_H - 60); }
      else { cx = VIEW_W - range(rng, 24, 58); cy = range(rng, 60, VIEW_H - 60); }
      const hue = rng() > 0.5 ? '#37e0d8' : '#b388ff';
      const dots = 3 + Math.floor(rng() * 4);
      for (let dI = 0; dI < dots; dI++) {
        const mx = cx + range(rng, -18, 18), my = cy + range(rng, -12, 12);
        const mr = range(rng, 1.4, 2.8);
        this.mushrooms.push({ x: mx, y: my, r: mr, hue, ph: rng() * Math.PI * 2 });
        ctx.fillStyle = hue === '#37e0d8' ? 'rgba(55,224,216,0.28)' : 'rgba(179,136,255,0.28)';
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Tree line: layered canopy silhouettes around the rim, trunks below them.
    // `hang` says which way moss drapes toward the arena (+1 down from the top
    // rim, -1 up from the bottom rim, 0 on the sides where it is skipped).
    const rim = [];
    for (let x = 6; x < VIEW_W; x += range(rng, 18, 30)) { rim.push({ x, y: range(rng, 2, 26), hang: 1 }); rim.push({ x, y: VIEW_H - range(rng, 2, 26), hang: -1 }); }
    for (let y = 10; y < VIEW_H; y += range(rng, 18, 30)) { rim.push({ x: range(rng, 2, 24), y, hang: 0 }); rim.push({ x: VIEW_W - range(rng, 2, 24), y, hang: 0 }); }
    for (const t of rim) {
      const r = range(rng, 24, 46);
      this.trees.push({ x: t.x, y: t.y, r });
      ctx.fillStyle = '#04040a';
      ctx.fillRect(t.x - 2.5, t.y - 4, 5, 16);
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.arc(t.x + range(rng, -r * 0.4, r * 0.4), t.y + range(rng, -r * 0.3, r * 0.3), r * range(rng, 0.5, 0.8), 0, Math.PI * 2);
        ctx.fillStyle = c === 0 ? '#060612' : '#050510';
        ctx.fill();
      }
      // Hanging moss: pale strands draping off the canopy toward the clearing.
      if (t.hang !== 0 && rng() > 0.4) {
        ctx.strokeStyle = 'rgba(52,84,64,0.55)';
        ctx.lineWidth = 1.6;
        const strands = 1 + Math.floor(rng() * 3);
        for (let sIdx = 0; sIdx < strands; sIdx++) {
          const sx = t.x + range(rng, -r * 0.5, r * 0.5);
          const sy = t.y + r * 0.25;
          const len = range(rng, 13, 30) * t.hang;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + range(rng, -3, 3), sy + len * 0.55, sx + range(rng, -2, 2), sy + len);
          ctx.stroke();
        }
      }
    }
  }
}
