# EMBERWARD — a lantern survival

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Sazharr911/best-game-r4/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Sazharr911/best-game-r4/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

> You are the last lantern keeper of the Hollowood. The Long Dark has gripped the valley
> for ninety days, and your flame is the only thing it still fears — but it drinks oil,
> and the nights are long. Dawn breaks on DAY 100.

**EMBERWARD** is a top-down arena survival and resource-management game for the desktop
browser, written in vanilla JavaScript on a 2D canvas — no engine, no build step, no
network. You take up the lantern on **DAY 90**; ten nights of escalating waves hunt it
through a ritual-scarred forest clearing, each survived night striking one more day off
the Long Dark. Burn them with your beam, gather the embers they drop, keep the oil
flowing, and hold until dawn. Built for make.fun's best-game-01 bounty:
https://make.fun/bounty/best-game-01

You play a keeper, not a token: a hooded figure in a swaying gold-trimmed cloak, caged
lantern in hand, whose light is a thin brilliant beam with a white-hot core — and whose
forest floor is etched with glowing cyan rune circles, the game's signature, breathing
under the lantern light while fireflies drift and the things in the dark leak colour
long before they reach you.

## The shape of the fight

- **DAY 90 → DAY 100.** Ten nights stand between the keeper and the dawn; each night
  survived strikes one more day off the Long Dark.
- **5 hunter types.** Shade, Howler, Wraith, Stalker — and the Pyre Husk, whose death
  pays out a Relic.
- **Prism refraction — the signature mechanic.** Wraiths (35% on death) and Pyre Husks
  (always) drop **Prism Shards**. Carry up to **2**, set up to **3** into the dark
  (right-click / E; each holds 25 s): a beam that strikes a set prism **splits into two
  beams at ±26°**, each at **65% damage**, each travelling the rest of the beam's reach.
  One lantern, three lines of fire — the win needs none of it, and the dark hates all
  of it.
- **6 Relics** won from Husks, **10 Blessings** drafted one-of-three between nights.
- **The Dread Pyre, in three phases.** The last night's Husk is a boss: at **66%** and
  **33%** health it rages — a banner names the phase, two shades are called to its
  side, and it fires a ring volley of **5** ember bolts, then **7** — while a boss bar
  under the day tracker follows its health and lights its phase pips. Fell it, and
  DAY 100 dawns.

## Play it

```sh
node serve.ts        # then open http://localhost:8080
```

Any static file server pointed at `game/` works the same way. To hand the entry in
(make.fun best-game-01): `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## How to play

Your lantern is your life twice over. Its **Light** gauge drains at **−1.9 per second**,
always, and holding the beam open burns an extra **−2.5 per second**. Enemies sometimes
drop **oil flasks (+14 Light)** when they die, and the Oil Surge skill trades embers for
light — but if the gauge ever reaches zero, the dark takes you on the spot. Your **Health**
is the other way to die: things that reach you, bite.

Survive a night by destroying everything it sends. Between nights the dark rests and you
draft **one of three Blessings**. Clear the night of **DAY 99** and dawn breaks on
**DAY 100**: you win, with a bonus of **+5 points per Light and +2 per Health** you
held onto.

### Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Aim the lantern |
| Hold left mouse button | Fire the light beam (damages the first shape it touches) |
| Space | Dash — burst of speed, brief invulnerability, costs stamina |
| 1 | **Flare Nova** — radial burst: 70 damage + knockback to everything near (14 s cooldown) |
| 2 | **Oil Surge** — convert 15 Embers into +25 Light (20 s cooldown) |
| 3 | **Mirror Ward** — 6 s shield that reflects 18 damage to attackers (24 s cooldown) |
| Right-click / E | **Set Prism** — set a carried Prism Shard at the aim point; the beam refracts through it, splitting ±26° at 65% damage |
| Esc / P | Pause |
| M | Mute |

### What hunts you

- **Shade** — the standard hunger of the dark; steady, numerous, violet, trailing smoke.
- **Howler** — fast and fragile, orange-red, streaking as it runs; it crouches, flashes,
  and *lunges*.
- **Wraith** — phases in and out of the world inside a crawling halo ring. Your beam
  passes through it while it is ghosted; it can only bite — and burn — while solid.
- **Stalker** — a dark magenta shape that keeps its glow banked low until it is nearly
  on you. Slow as a shadow inside your light, *very* fast in the dark beyond it.
  Keeping your light radius wide is a weapon against it.
- **Pyre Husk** — a great spiked elite, crowned in blackened shards around a molten
  heart, shedding embers as it orbits and spits ember bolts. It appears on nights
  3, 5, 7, 9 and, grown huge, on the night of DAY 99 as **the Dread Pyre** — a
  three-phase boss that rages at 66% and 33% health, summoning shades and firing
  ring volleys while the boss bar under the day tracker burns down with it. Killing
  one wins a **Relic** and drops a **Prism Shard**, every time. Live Husks are also
  tracked in the **Threat Queue** on the right of the HUD.

### The light economy

- **Embers** are currency: every kill shakes some loose, and your lantern's magnet gathers
  the ones that drift close. Embers feed Oil Surge and nothing else — spend them before
  the dark spends you.
- **Oil flasks** drop from about one kill in four (guaranteed, twice, from a Husk). They
  are worth +14 Light each and expire after 22 seconds.
- **Stamina** powers the dash and refills on its own; the dash also grants i-frames, so a
  well-timed dash is a dodge, not just a sprint.

### Relics and Blessings

Relics are permanent, won only from Pyre Husks:

| Relic | Effect |
| --- | --- |
| Widened Lens | Beam +60% wider, +10% damage |
| Siphon Wick | Light drain −25% |
| Swiftwick Boots | +12% move speed, dash recharges 25% faster |
| Deep Reservoir | +30 max Light (+30 Light on pickup) |
| Thorn Halo | Things that bite you take 10 damage |
| Greedy Charm | Ember magnet more than doubled; embers drop 25% richer |

Blessings are drafted between nights — one of three, yours for the run:

| Blessing | Effect |
| --- | --- |
| Kindled Heart | +20 max Light |
| Steady Flame | Light drain −15% |
| Bright Beam | Beam damage +25% |
| Long Beam | Beam reach +25% |
| Fleet Foot | Move speed +10% |
| Quick Hands | All skill cooldowns −20% |
| Oil Baron | Oil drops far more often; each flask holds +6 more |
| Vampire Wick | +0.6 Light per kill |
| Second Wind | Dashing costs no stamina, recharges 30% faster |
| Thick Skin | +25 max Health, and mend 25 on the spot |

When every blessing is already yours, the draft offers an Ember Cache (+30 Embers) or a
Kindled Flask (+30 Light) instead.

### Scoring

Each kill pays its type's value — Shade 10, Howler 15, Wraith 20, Stalker 25, Pyre Husk
150 — multiplied by **1 + 10% per night survived so far**, plus the dawn bonus above. Your
best score is kept between sessions.

## The HUD

Top centre counts the day — **DAY 90** at the first dusk, **DAY 99** on the last night —
under a **DAWN AT DAY 100** sub-line with the seconds the dark has left, and fills a dawn
bar with your campaign progress. Top left tracks Health, Light (with its live burn rate)
and Stamina above the **INCOMING** panel, which previews the coming night's exact
composition between waves and counts what is still in the dark during one. Top right
keeps Score, Best and Embers — and a **CHAIN ×N** counter while kills land within
2.5 s of each other, with score popups floating off every kill. The right sidebar
lists the **Threat Queue** (live Husks, with health), your **Relics** and your
**Blessings**. The bottom hotbar shows the three skills, the **Prism** satchel
(slot 4, shards carried), and the dash with cooldown sweeps.

## Files

- `game/index.html` — the page, HUD overlays and all styling (hand-rolled, no CDN).
- `game/src/config.js` — every balance number and content table, including the night
  compositions the HUD previews and the director spawns from.
- `game/src/main.js` — the state machine and frame loop.
- `game/src/entities.js` — the keeper, the five hunters, the beam, skills, pickups,
  particles.
- `game/src/waves.js` — the night director.
- `game/src/upgrades.js` — relic and blessing definitions and stat folding.
- `game/src/render.js` — the scene and the dynamic lighting (a darkness sheet cut by the
  lantern's radial light and the beam's cone; enemy glows leak through beyond it), the
  keeper, the beam's layered cone and core, and the renderer's ambient fireflies and
  elite embers.
- `game/src/world.js` — the procedural forest floor: moss, leaves, stones, grass, the
  signature rune circles, the tree line, four burning ward braziers whose light pools
  hold back the dark, and glowing mushrooms along the trees.
- `game/src/hud.js` — every DOM readout.
- `game/src/input.js`, `game/src/audio.js`, `game/src/random.js` — controls, a zero-asset
  WebAudio synth, and the seeded RNG that makes screenshots and play tests reproducible.
- `game/src/shots.js` — the deterministic staged scenes behind the screenshots
  (`?shot=cover|start|play|end`), and `?fast=1`, the short-night mode the input-driven
  play tests in `TESTS.md` use.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output and
  writes `dossier.json` with the kit's vendored `buildDossier`.
- `vendor/makefun-game.ts` — the kit's library, unchanged.

## License

MIT — see `LICENSE`.
