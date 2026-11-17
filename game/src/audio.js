// audio.js — a pocket WebAudio synth: every sound is an oscillator or a noise burst, so
// the game ships zero audio files. Everything is guarded: if the browser has no
// AudioContext (or it is still locked), the game simply plays silent.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, { type = 'sine', vol = 0.5, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise(dur, { vol = 0.4, delay = 0, freq = 1200 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  hit() { this.noise(0.05, { vol: 0.12, freq: 2400 }); }
  kill() { this.tone(320, 0.16, { type: 'triangle', vol: 0.35, slide: -220 }); this.noise(0.12, { vol: 0.2, freq: 900 }); }
  hurt() { this.tone(140, 0.18, { type: 'sawtooth', vol: 0.3, slide: -60 }); }
  pickup() { this.tone(660, 0.09, { type: 'sine', vol: 0.25 }); this.tone(990, 0.12, { vol: 0.2, delay: 0.05 }); }
  ember() { this.tone(1180, 0.05, { type: 'sine', vol: 0.08 }); }
  dash() { this.noise(0.14, { vol: 0.18, freq: 1600 }); }
  nova() { this.tone(180, 0.4, { type: 'sawtooth', vol: 0.3, slide: 500 }); this.noise(0.3, { vol: 0.3, freq: 700 }); }
  surge() { this.tone(420, 0.2, { type: 'sine', vol: 0.3, slide: 260 }); }
  ward() { this.tone(520, 0.3, { type: 'sine', vol: 0.25 }); this.tone(780, 0.3, { vol: 0.18, delay: 0.06 }); }
  draft() { this.tone(523, 0.12, { vol: 0.25 }); this.tone(659, 0.12, { vol: 0.25, delay: 0.09 }); this.tone(784, 0.2, { vol: 0.25, delay: 0.18 }); }
  relic() { this.tone(392, 0.14, { vol: 0.3 }); this.tone(523, 0.14, { vol: 0.3, delay: 0.1 }); this.tone(659, 0.14, { vol: 0.3, delay: 0.2 }); this.tone(1046, 0.3, { vol: 0.3, delay: 0.3 }); }
  dawn() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { vol: 0.25, delay: i * 0.13 })); }
  doom() { this.tone(220, 0.7, { type: 'sawtooth', vol: 0.3, slide: -160 }); this.tone(110, 0.9, { vol: 0.25, delay: 0.15, slide: -50 }); }
}
