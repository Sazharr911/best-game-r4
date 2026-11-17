// hud.js — every DOM readout. Bars and numbers update each frame; the lists (INCOMING,
// THREAT QUEUE, RELICS, BLESSINGS) rebuild only when their content signature changes, so
// the DOM never thrashes. All counts are computed from the same tables and live state the
// game itself uses, so the HUD can only tell the truth.

import { ENEMIES, LIGHT, NIGHT_SECONDS, SKILLS, TOTAL_NIGHTS } from './config.js';
import { blessingById, relicById } from './upgrades.js';
import { countsForNight, nightProgress } from './waves.js';

const $ = (id) => document.getElementById(id);

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  constructor() {
    this.el = {
      nightLabel: $('night-label'), nightSub: $('night-sub'), dawnFill: $('dawn-fill'),
      hp: $('bar-hp'), light: $('bar-light'), stam: $('bar-stam'),
      numHp: $('num-hp'), numLight: $('num-light'), numStam: $('num-stam'),
      lightRate: $('light-rate'),
      score: $('score'), best: $('best'), embers: $('embers'),
      incoming: $('incoming-list'), incomingEta: $('incoming-eta'),
      threat: $('threat-list'), relics: $('relic-list'), blessings: $('blessing-list'),
      toast: $('toast'),
      slots: { nova: $('slot-nova'), surge: $('slot-surge'), ward: $('slot-ward'), dash: $('slot-dash') },
      draft: $('draft'), draftCards: $('draft-cards'), draftTimer: $('draft-timer'),
      title: $('screen-title'), pause: $('screen-pause'), end: $('screen-end'),
      endTitle: $('end-title'), endSub: $('end-sub'), endStats: $('end-stats'),
    };
    this.sigs = { incoming: '', threat: '', relics: '', blessings: '' };
    this.toastTimer = 0;
  }

  toast(title, sub = '') {
    const t = this.el.toast;
    t.querySelector('.t-title').textContent = title;
    t.querySelector('.t-sub').textContent = sub;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  update(G) {
    const p = G.player, s = G.stats;
    this.el.nightLabel.textContent = `NIGHT ${G.night}/${TOTAL_NIGHTS}`;
    this.el.dawnFill.style.width = `${(nightProgress(G) * 100).toFixed(1)}%`;

    if (G.screen === 'intermission') {
      this.el.nightSub.textContent = 'THE DARK RESTS';
    } else if (G.spawnQueue.length > 0 || G.nightTime < (G.fast ? 6 : NIGHT_SECONDS)) {
      this.el.nightSub.textContent = `THE DARK THINS IN ${fmtTime((G.fast ? 7 : NIGHT_SECONDS) - G.nightTime)}`;
    } else {
      this.el.nightSub.textContent = 'CLEAR THE FIELD';
    }

    this.el.hp.style.width = `${Math.max(0, (p.hp / s.maxHp) * 100)}%`;
    this.el.light.style.width = `${Math.max(0, (p.light / s.maxLight) * 100)}%`;
    this.el.stam.style.width = `${Math.max(0, (p.stamina / s.maxStamina) * 100)}%`;
    this.el.numHp.textContent = Math.ceil(p.hp);
    this.el.numLight.textContent = Math.ceil(p.light);
    this.el.numStam.textContent = Math.floor(p.stamina);
    const burn = LIGHT.drainPerSecond * s.drainMult + (G.beam.firing ? LIGHT.fireDrainPerSecond : 0);
    this.el.lightRate.textContent = `LANTERN BURN −${burn.toFixed(1)}/S`;

    this.el.score.textContent = G.score.toLocaleString('en-US');
    this.el.best.textContent = G.best.toLocaleString('en-US');
    this.el.embers.textContent = G.embers;

    this.updateIncoming(G);
    this.updateThreat(G);
    this.updateOwned(G);
    this.updateSlots(G);
  }

  updateIncoming(G) {
    let sig, rows, eta;
    if (G.screen === 'intermission' && G.night < TOTAL_NIGHTS) {
      const counts = countsForNight(G.night + 1, G.fast);
      sig = 'next' + JSON.stringify(counts);
      rows = Object.entries(counts).map(([t, n]) => `<li><span class="nm">${ENEMIES[t].name}</span><span class="cnt">×${n}</span></li>`).join('');
      eta = `NIGHT ${G.night + 1} IN ${fmtTime(G.interT)} — CHOOSE A BLESSING`;
    } else {
      const left = {};
      for (const t of G.spawnQueue) left[t] = (left[t] || 0) + 1;
      for (const e of G.enemies) left[e.type] = (left[e.type] || 0) + 1;
      sig = 'field' + JSON.stringify(left);
      rows = Object.keys(left).length
        ? Object.entries(left).map(([t, n]) => `<li><span class="nm">${ENEMIES[t].name}</span><span class="cnt">×${n}</span></li>`).join('')
        : '<li class="none">the field is clear</li>';
      const total = Object.values(left).reduce((a, b) => a + b, 0);
      eta = total > 0 ? `${total} STILL IN THE DARK` : 'NOTHING LEFT THAT BREATHES';
    }
    if (sig !== this.sigs.incoming) {
      this.sigs.incoming = sig;
      this.el.incoming.innerHTML = rows;
    }
    this.el.incomingEta.textContent = eta;
  }

  updateThreat(G) {
    const elites = G.enemies.filter((e) => e.type === 'elite');
    const sig = elites.map((e) => `${Math.round((e.hp / e.maxHp) * 20)}`).join('|') + '#' + elites.length;
    if (sig === this.sigs.threat) return;
    this.sigs.threat = sig;
    this.el.threat.innerHTML = elites.length
      ? elites.map((e) => `<li><div class="trow"><span>${e.type === 'elite' && G.night === 10 ? 'THE DREAD PYRE' : ENEMIES[e.type].name}</span><span class="cnt">${Math.ceil(e.hp)} HP</span></div><div class="tbar"><div style="width:${Math.max(0, (e.hp / e.maxHp) * 100)}%"></div></div></li>`).join('')
      : '<li class="none">no great shapes stir</li>';
  }

  updateOwned(G) {
    const rSig = G.relics.join(',');
    if (rSig !== this.sigs.relics) {
      this.sigs.relics = rSig;
      this.el.relics.innerHTML = G.relics.length
        ? G.relics.map((id) => { const r = relicById(id); return `<li><span>${r.glyph} ${r.name}</span></li>`; }).join('')
        : '<li class="none">none yet — fell a Pyre Husk</li>';
    }
    const bSig = G.blessings.join(',');
    if (bSig !== this.sigs.blessings) {
      this.sigs.blessings = bSig;
      this.el.blessings.innerHTML = G.blessings.length
        ? G.blessings.map((id) => { const b = blessingById(id); return `<li><span>${b.glyph} ${b.name}</span></li>`; }).join('')
        : '<li class="none">none yet — survive a night</li>';
    }
  }

  updateSlots(G) {
    const set = (slot, cdT, cdMax, extraBroke) => {
      const frac = cdMax > 0 ? Math.min(1, cdT / cdMax) : 0;
      slot.querySelector('.cd').style.height = `${frac * 100}%`;
      slot.querySelector('.cdnum').textContent = cdT > 0.05 ? Math.ceil(cdT) : '';
      slot.classList.toggle('broke', !!extraBroke);
    };
    set(this.el.slots.nova, G.skills.nova.t, SKILLS.nova.cooldown * G.stats.skillCooldownMult, false);
    set(this.el.slots.surge, G.skills.surge.t, SKILLS.surge.cooldown * G.stats.skillCooldownMult, G.embers < SKILLS.surge.emberCost);
    set(this.el.slots.ward, G.skills.ward.t, SKILLS.ward.cooldown * G.stats.skillCooldownMult, false);
    set(this.el.slots.dash, G.player.dashCdT, G.stats.dashCooldown, G.player.stamina < G.stats.dashCost);
  }

  showDraft(cards, onPick) {
    const wrap = this.el.draftCards;
    wrap.innerHTML = '';
    for (const card of cards) {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<div class="c-glyph">${card.glyph}</div><div class="c-name">${card.name}</div><div class="c-desc">${card.desc}</div>`;
      div.addEventListener('click', () => onPick(card));
      wrap.appendChild(div);
    }
    this.el.draft.classList.remove('hidden');
  }

  setDraftTimer(text) { this.el.draftTimer.textContent = text; }
  hideDraft() { this.el.draft.classList.add('hidden'); }

  showTitle() { this.el.title.classList.remove('hidden'); }
  hideTitle() { this.el.title.classList.add('hidden'); }
  showPause(on) { this.el.pause.classList.toggle('hidden', !on); }

  showEnd({ victory, reason, G }) {
    this.el.endTitle.textContent = victory ? 'DAWN BREAKS' : 'THE LIGHT DIES';
    this.el.endSub.textContent = victory
      ? 'Ten nights burned away. The Hollowood keeps its keeper — and its dawn.'
      : reason === 'light'
        ? 'The flame starved and went out, and the dark came in all at once.'
        : 'The shapes reached the keeper, and the lantern fell.';
    this.el.endStats.innerHTML =
      `SCORE <b>${G.score.toLocaleString('en-US')}</b> · BEST <b>${G.best.toLocaleString('en-US')}</b><br>` +
      `NIGHTS SURVIVED <b>${victory ? TOTAL_NIGHTS : G.night - 1}</b> · KILLS <b>${G.kills}</b> · EMBERS HELD <b>${G.embers}</b>`;
    this.el.end.classList.remove('hidden');
  }
  hideEnd() { this.el.end.classList.add('hidden'); }
}
