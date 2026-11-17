# EMBERWARD — a lantern survival

> You are the last lantern keeper of the Hollowood. Your flame is the only thing the dark
> still fears — but it drinks oil, and the night is long.

**EMBERWARD** is a top-down arena survival and resource-management game for the desktop
browser, written in vanilla JavaScript on a 2D canvas — no engine, no build step, no
network. Ten nights of escalating waves hunt your lantern through a ritual-scarred forest
clearing. Burn them with your beam, gather the embers they drop, keep the oil flowing, and
hold until dawn.

## Play it

```sh
node serve.ts        # then open http://localhost:8080
```

Any static file server pointed at `game/` works the same way. To hand the entry in
(make.fun best-game-01): `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## How to play

Your lantern is your life twice over. Its **Light** gauge drains at **−1.9 per second**,
always, and holding the beam open burns an extra **−2.5 per second**. Enemies sometimes
drop **oil flasks (+12 Light)** when they die, and the Oil Surge skill trades embers for
light — but if the gauge ever reaches zero, the dark takes you on the spot. Your **Health**
is the other way to die: things that reach you, bite.

Survive a night by destroying everything it sends. Between nights the dark rests and you
draft **one of three Blessings**. Clear Night 10 and dawn breaks: you win, with a bonus of
**+5 points per Light and +2 per Health** you held onto.

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
| Esc / P | Pause |
| M | Mute |

### What hunts you

- **Shade** — the standard hunger of the dark; steady, numerous, purple.
- **Howler** — fast and fragile; it crouches, flashes, and *lunges*.
- **Wraith** — phases in and out of the world. Your beam passes through it while it is
  ghosted; it can only bite — and burn — while solid.
- **Stalker** — slow as a shadow inside your light, *very* fast in the dark beyond it.
  Keeping your light radius wide is a weapon against it.
- **Pyre Husk** — a spiked elite that orbits and spits ember bolts. It appears on nights
  3, 5, 7, 9 and, grown huge, on night 10 as **the Dread Pyre**. Killing one wins a
  **Relic**. Live Husks are tracked in the **Threat Queue** on the right of the HUD.

### The light economy

- **Embers** are currency: every kill shakes some loose, and your lantern's magnet gathers
  the ones that drift close. Embers feed Oil Surge and nothing else — spend them before
  the dark spends you.
- **Oil flasks** drop from about one kill in five (guaranteed, twice, from a Husk). They
  are worth +12 Light each and expire after 22 seconds.
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

Top centre counts the night and fills a dawn bar with your campaign progress. Top left
tracks Health, Light (with its live burn rate) and Stamina above the **INCOMING** panel,
which previews the next night's exact composition between waves and counts what is still
in the dark during one. Top right keeps Score, Best and Embers. The right sidebar lists
the **Threat Queue** (live Husks, with health), your **Relics** and your **Blessings**.
The bottom hotbar shows the three skills and the dash with cooldown sweeps.

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
  lantern's radial light and the beam's cone; enemy glows leak through beyond it).
- `game/src/world.js` — the procedural forest floor: runes, grass, the tree line.
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
