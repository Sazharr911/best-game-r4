# EMBERWARD — Play Tests

All tests drive the real game with real input. Nothing is mocked: a headless
Chrome (v157, `/opt/meta-chromium/chrome`) is remote-controlled over CDP
(`tools/cdp.mjs`), the game is loaded from `file://` (with
`--allow-file-access-from-files` so its ES modules load), and the driver sends
genuine `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` events — clicks
on the start button and on blessing cards, held WASD keys, mouse aim, held
left button for the beam, Space dashes, hotbar keys 1/2/3. Game state is only
*observed*, through the read-only debug handle `window.EMBERWARD.snapshot()`.
Console messages and page errors are collected throughout every run; each
scenario asserts there were none.

## Smoke test — `node tools/smoke.mjs`

Title screen → click **LIGHT THE LANTERN** → run starts. Verified live:

- Light drain while idling ≈ **1.9/s** (spec: −1.9/s).
- Light drain while holding the beam ≈ **4.4/s** (spec: −1.9 − 2.5/s).
- WASD input moves the keeper; the beam tracks the mouse.
- Zero console errors.

## Scenario A — the win path — `node tools/playtest.mjs A`

A full ten-night campaign is 7½ minutes of perfect play, so the test uses the
documented debug accelerator **`?fast=1`** (see `game/src/shots.js`): a night
ends as soon as its host is destroyed instead of at 45 s, spawn counts are
halved *inside the same `countsForNight()` that feeds the HUD's INCOMING
panel* (so the panel's promise stays true), and the spawn window compresses
to 10 s. Enemy HP, damage, speeds and the light economy are untouched.

The driver plays like a cautious keeper: it burns the nearest solid shape
(elites last, ghosted wraiths skipped), orbits a lone target at beam length,
flees the pack centroid when surrounded, dashes out of contact range, casts
Flare Nova / Oil Surge / Mirror Ward off their real cooldowns, runs for oil
flasks when the light drops, and clicks the first card of every blessing
draft.

**Final result (2026-11-17, `?fast=1&seed=7`): ALL CHECKS PASSED**

- Victory reached — end screen title **“DAY 100 — DAWN BREAKS”** (the original run's
  “DAWN BREAKS” wording predates the DAY reframe; the check matches the dawn title).
- Score **4,819** from **142 kills**; nights advanced 1 → 10.
- Finished at HP 58 / Light 61.5 (run minimums: HP 58, Light 21.9).
- Blessing draft appeared between nights; zero console errors.
- Re-run twice after the visual revision (below): victory both times with the
  same 142 kills; scores 5,010 and 4,800 — the kill score is identical, only the
  dawn bonus (end Light/Health) moves with the bot's path. The title assertion
  was updated to the reframed “DAY 100 — DAWN BREAKS”.

Development history, for honesty: earlier driver versions died on nights
9–10 (HP 0 with light to spare — pile-ups of spheres melted the keeper, each
enemy biting on its own 0.8 s cadence). Two balance changes came out of
those runs and shipped in the “Revision 2” commit: a 0.35 s post-hit grace
so a pile-up cannot burst in one frame, and the Night-10 Dread Pyre's bonus
HP reduced 0.50 → 0.35 after two runs died on its HP wall alone.

## Scenario B — the lose path — `node tools/playtest.mjs B`

Start a run, aim into the dark, and hold the beam open without moving —
the fastest way to starve a lantern.

**Result (2026-11-17): ALL CHECKS PASSED**

- Game over after **22.8 s** (the original run measured 25.8 s; the starve time is
  100 ÷ 4.4/s ≈ 22.7 s once the beam is open — the difference is the driver's
  start-up, not the economy): Light hit exactly **0** (HP still 76 — the
  flame starved before the dark could bite through).
- End screen title **“THE LIGHT DIES”**. Zero console errors.

## Screenshots — `node tools/shots.mjs`

The four `screenshots/*.jpg` are staged deterministically with the
`?shot=cover|start|play|end` scenes in `game/src/shots.js` (fixed seeds),
settled (the cover settles 700 ms, so its staged host is still mid-approach
rather than on top of the keeper), and captured with `Page.captureScreenshot`
as JPEG (quality 84). All four are 1280×800 and ≤ 262,144 bytes (actual:
62–102 KB), with zero console problems during capture. `1-cover.jpg` is the
staged **DAY 99** scene — the last night: dawn breaking through the northern
tree line, the keeper's beam on the Dread Pyre (Threat Queue), relics and
blessings owned, INCOMING populated from the real Night-10 table (49 shapes:
twenty staged on the field plus the queue behind them), a Flare Nova ring
still expanding west of the keeper and a shade bursting apart in the light.
`3-play.jpg` is the DAY 92 scene with the new rendering.

## Entry program

`MAKEFUN_OUTPUT_DIR=out node main.ts` runs clean and writes a dossier of
**564,995 bytes** (limit 1,572,864), with `game/` (13 files) and all four
screenshots copied to the output directory. No file under `game/` references
the network.

## Visual revision (2026-11-17) — what changed, what was re-verified

A look-and-feel pass only: the keeper became a drawn character (hooded,
lantern in hand, dash ghosts), the beam a layered cone with a thin bright
core and impact sparks, the floor gained moss/leaves/stones and brighter
pulsing rune circles, the hunters grew distinct silhouettes at 1.45–1.6×
their (unchanged) collision radii, fireflies and elite embers joined as
renderer-owned decoration, and the progression label was reframed from
“NIGHT X/10” to the Long Dark's calendar — **DAY 90 → DAWN AT DAY 100** —
with the cover restaged on DAY 99 under a dawn gradient. No balance number,
spawn table, radius, speed, or economy value changed. After the pass:
smoke test clean, Scenario A won again in both runs (same 142 kills;
scores 5,010 and 4,800, differing only in the dawn bonus), Scenario B
passed, all four screenshots
recaptured with zero console problems, and the entry program's dossier
rebuilt clean.

## Visual revision, round 2 (2026-11-17) — more light, more crowd

A second look-and-feel pass, again renderer and staging only
(`entities.js`, `waves.js` and `upgrades.js` are byte-identical to before
the round; `config.js` untouched this time). Four **ward braziers** —
standing stones with flickering flames — now burn around the clearing,
each cutting its own pool into the darkness sheet and shedding embers;
fireflies went 26 → 70 in amber, teal and violet; rune circles burn
brighter and shimmer faintly through the dark; mushroom clusters glimmer
at the tree line; the floor grew denser (820 grass tufts, 240 leaves, 140
stones, hanging moss); the lantern's pool gained a wider clear core and a
warm wash; the staged dawn stands taller, with a horizon band and longer
rays. The cover restaged busier still: twenty hunters on the field
(a howler caught mid-lunge, another in windup), the Deep Reservoir among
the relics so the lantern pool reads bigger, a Flare Nova ring expanding
west of the keeper, a shade bursting apart in the light, and dash ghosts
frozen behind the keeper (a renderer-only staging hook, `G.dashGhostDir`).

One real bug was found and fixed along the way: the first capture threw
an `IndexSizeError` — a staged ring present on the very first frame could
ease to a hair below radius zero (the rAF timestamp can predate the
module clock by a few ms) and `arc()` throws on a negative radius. The
renderer now clamps the ring radius at zero; the recapture is clean.

Re-verified after the pass (2026-11-17):

- Smoke test: clean, zero console problems.
- Scenario A (`?fast=1`): **ALL CHECKS PASSED** — victory, **142 kills**
  (identical to every earlier round; the simulation is untouched), score
  4,746, finished HP 29 / Light 59.4, “DAY 100 — DAWN BREAKS”, zero
  console errors.
- Scenario B: **ALL CHECKS PASSED** — game over in 22.7 s, Light exactly
  0, “THE LIGHT DIES”, zero console errors.
- All four screenshots recaptured at quality 84 with zero console
  problems: cover 102,143 B, start 86,128 B, play 82,928 B, end 61,794 B.
- Entry program dossier rebuilt: **564,995 bytes** (limit 1,572,864).
