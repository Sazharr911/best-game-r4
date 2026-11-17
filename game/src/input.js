// input.js — keyboard and mouse state for the game. Movement keys are read as a set each
// frame; the mouse is tracked in logical (1280x800) coordinates so aiming stays correct at
// any window size; one-shot actions (skills, dash, pause) are queued as events the main
// loop drains, so a press is never lost between frames.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.events = [];
    this.mouse = { x: 640, y: 330, down: false, inside: false };
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        this.events.push({ type: 'keydown', code: e.code });
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => {
      const p = this.toLogical(e);
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = true;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.events.push({ type: 'mousedown' }); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.canvas.width / r.width),
      y: (e.clientY - r.top) * (this.canvas.height / r.height),
    };
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  moveVector() {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { const s = Math.SQRT1_2; x *= s; y *= s; }
    return { x, y };
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
