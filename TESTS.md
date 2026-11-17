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
twenty-four staged on the field plus the queue behind them), a Flare Nova ring
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

## EMBERWARD v2 (2026-11-17) — prisms, the three-phase Pyre, feedback

A mechanics round aimed at the winners' grammar: a signature geometry, a named
boss, and feedback that shouts. Everything not named below stayed untouched —
balance numbers, wave tables, relic and blessing effects, the DAY 90→100
framing and the HUD layout are as they were. (Scenario A's kill line moved
only because the boss now summons help: see below.)

### Prism Shards

Wraiths drop a Prism Shard at **35%** on death; Pyre Husks always drop one.
Walking over a shard carries it (max **2**; hotbar slot 4 reads **PRISM ×N**).
**Right-click / E** sets a carried shard at the aim point, clamped to 260 px
from the keeper and inside the arena; up to **3** may stand at once, each for
**25 s**, then it shatters in a burst of sparks. When the fired beam's first
intersection is a set prism, the beam stops there and **splits into two beams
at ±26°** from the incoming direction, each dealing **65%** of normal beam
damage, each travelling the remaining beam length and burning the first shape
on its path (phased wraiths are passed over, as with the main beam). One split
level only — the daughters never re-split. They render in the main beam's
thin-core style, a touch dimmer and cooler, with a bright flash on the prism,
and they cut their own narrower cones through the darkness sheet. The win-path
bot never touches a prism: they are power, not a requirement.

### The Dread Pyre, three phases

The tenth night's elite — and only it — is a boss. At **66%** and **33%**
health it rages: the banner reads **THE DREAD PYRE RAGES — PHASE II**, then
**PHASE III — LAST EMBERS**; it summons shades around itself and fires a ring
volley of ember bolts, on top of its existing orbit and aimed bolts. Regular
Husks stay single-phase. (As shipped in this round: 3 shades, 8 bolts, 12 in
phase III — **softened in the fix round below to 2 shades and 5 / 7 bolts**;
the current numbers live there.) While any Husk lives,
a **boss bar** sits under the DAY header — name (**PYRE HUSK** / **THE DREAD
PYRE**), health bar, and for the Pyre three phase pips read off the same
thresholds — and the Threat Queue keeps listing it.

### Floating feedback

Score popups (already floating off kills) are now pooled and capped at 40.
Kills stack a **CHAIN**: a kill within **2.5 s** of the previous one increments
it; the score block shows **CHAIN ×N** from ×3 up, and every tenth step pops a
large mid-scene **CHAIN x10**. The chain multiplies nothing — it is pure
feedback. Toasts on the existing banner cover prism pickup (**PRISM SHARD
+1**), prism set, relic won, and the Pyre's phase changes.

### Scenario C — the prism — `node tools/playtest.mjs C`

The shard comes through a documented test hook,
`window.EMBERWARD.debugDropShard()`, which drops on the ground exactly the
pickup a wraith's death drops — the hook grants nothing by itself. The bot
walks over two dropped shards to collect them (carried 1, then 2), waits for
the night-1 field to populate, then kites the pack while it plans from live
snapshots: a placement point whose incoming ray is clear of enemies and whose
+26° or −26° daughter ray passes within striking distance of an enemy. It
places the prism with a **real right-click** (CDP `Input.dispatchMouseEvent`,
button `right`) and asserts, in order: the prism was placed; placing spent a
carried shard (**2 → 1**); the split counter the game exposes
(`snapshot().splits`, incremented once per refracting frame) **exceeded 0**
while firing through the prism; and at least one enemy's health dropped inside
the firing window. Latest run: **ALL CHECKS PASSED** — splits **151**, enemies
damaged in the window **1–2** across runs (it varies as the pack moves; the
first v2 run caught two at once), zero console errors.

### Re-verified after the round (2026-11-17)

- **Smoke:** clean.
- **Scenario A** (`?fast=1`, bot, no prisms): **ALL CHECKS PASSED**, run twice
  on the final build — victory "DAY 100 — DAWN BREAKS", **148 kills** both
  times (the old 142 plus the Pyre's six phase-summoned shades: both phase
  events fired on the way down). Scores 5,009 and 4,972; finished HP 1 and 20 —
  the boss fight is now the run's sharpest moment by a wide margin, and the
  bot survives it, sometimes barely.
- **Scenario B:** **ALL CHECKS PASSED** — game over in 23.3 s, Light exactly 0.
- **Scenario C:** **ALL CHECKS PASSED** (above).
- **Screenshots** recaptured with zero console problems: cover **105,739 B**,
  start 92,935 B, play 87,077 B, end 62,727 B. The cover was probe-verified,
  not just eyeballed: during its settle the split counter fired (25 events),
  the Pyre burned **404 → 369 HP** down the −26° daughter and the stalker
  **76 → 41** down the +26° one, the boss bar read **PHASE II at 50%**, the
  INCOMING panel still showed the true 49-strong Night-10 table, and the boss
  bar clears the night line beneath the DAY header (one staging lesson banked:
  a staged boss's phase field must be set with its staged health, or the
  first burn tick fires the phase event into the portrait).
- **Entry program:** `MAKEFUN_OUTPUT_DIR=out node main.ts` writes a dossier of
  **605,589 bytes** (limit 1,572,864) and reports no error.
- The keeper is now drawn at **1.35×** — draw scale only; collision, reach and
  every other logic number are unchanged — so the character reads at cover
  size.

## Fix round (2026-11-17) — a fairer Pyre, a readable Pyre, a denser right half

Three fixes on top of the v2 build, nothing else touched.

### 1. The boss fight is softened — phase events only

The v2 Scenario A bot once won at **HP 1**: the Pyre's rages were nearly
lethal. Only the phase events changed — banners, thresholds (66% / 33%),
boss bar, bolt speed and bolt damage are exactly as they were:

- Phase summons: **3 shades → 2**.
- Phase ring volley: **8 bolts → 6**, phase III **12 → 9** (first softening);
  then, per the acceptance rule below, **once more: 6 → 5, 9 → 7**.

Scenario A was run in batches of three at each step. **Every run is recorded
— no batch was re-rolled or cherry-picked:**

At 6 / 9 bolts, 2 shades:

- **Victory** — 146 kills (142 + the Pyre's 2×2 summoned shades; both phase
  events fired), score **5,016**, end HP **21**, end Light 101.
- **Victory** — 146 kills, score **5,263**, end HP **67**, end Light 132.1.
- **Defeat on night 9** — game over by bites with the lantern at 75.3 light:
  a swarm pile-up before the boss exists. The phase events cannot fire on
  night 9 (only the tenth night's elite is a boss), so this death is the
  win bot's known late-swarm flakiness, not the boss fight.

The batch did not meet the acceptance bar (three wins), so the volley was
softened once more, to **5 / 7**, and the batch re-run on the final build:

- **Defeat on night 10** — 135 kills, end Light 134.7, run minimum HP 9: the
  bot reached the last night already battered and died in the swarm with a
  full lantern.
- **Victory** — 146 kills, score **5,052**, end HP **49**, end Light 97.
- **Defeat on night 6** — 54 kills, run minimum Light 8.8: a mid-game death,
  five nights before the Pyre, in a composition this round never touched.

Honest verdict: the softening did its named job — across both batches, every
run that beat the Pyre did so at **HP 21–67** (before the fix: 1 and 20), and
no defeat was a boss-fight blowout. But the win bot is a mediocre keeper and
still loses roughly half its campaigns to swarm pile-ups and light
mismanagement on nights the fix never touched (6, 9, and a night-10 swarm).
Three clean wins in a row could not be honestly claimed, and no further
balance was changed to chase them: the brief for this round was the phase
events, and they are fixed.

### 2. The Pyre reads on the cover

On the v2 cover the Dread Pyre rendered as a plain bright orb — white body
gradient + white-hot core + a 0.38 hit flash, under its own beam, blew the
silhouette out. Elite-only render changes (the other hunters are untouched):

- Body gradient: hot amber → ember-red (`#ff9a4d` → `#ff7043` → deep shade)
  instead of the shared white core.
- Molten core: smaller (0.42 → 0.34 of the body radius) and cooler
  (amber, not white-hot).
- Hit-flash cap for elites: **0.38 → 0.15**.
- Halo: tighter and thinner (2.6 → 2.2 radii, alpha 0.5 → 0.38) so it stops
  washing the crown out.
- The crown itself: near-black shards (`#260b01`), wider (±9.5 px) and longer
  (to 1.66 radii), front tips rimmed brighter (alpha 1.0, width 2).
- Draw scale for elites: **1.6 → 1.8** (draw only; collision radius is
  unchanged, as ever).
- Staging: the Pyre moved from 230 px to **190 px** up the prism's −26° ray,
  closer to the fan and larger in frame.

The regenerated cover was inspected at full size and at a 3× crop: the
sixteen shards read as a spiked silhouette all around an amber, molten body,
its eyes visible, the beam's bite a bright point on its rim — a burning
sphere, not a moon. The staged boss still burns during the settle (Threat
Queue read 386 HP at capture) and the boss bar still reads PHASE II.

### 3. The cover's right half carries its share

Four more staged hunters on the right, at varied ranges, none over the split
fan or the Pyre: a **shade (1010, 140)** inside the dawn light at the
northern tree line, and three glow leaks in the dark — a **shade (1180,
350)**, a **wraith (975, 470)** (it drifts onto the +26° daughter during the
settle and burns there), a **stalker (1200, 520)**. Staged counts updated to
match (shade 9, wraith 5, stalker 5; 24 on the field), so the spawn queue
and the INCOMING panel still tell the true Night-10 story.

### Re-verified after the round (2026-11-17, final build)

- **Smoke:** clean, zero console problems.
- **Scenario A:** six runs recorded above — 3 victories (end HP **21, 67,
  49**; scores 5,016 / 5,263 / 5,052; **146 kills** each — the new kill line
  with 2-shade summons), 3 defeats (nights 6, 9, 10 — none a boss blowout),
  zero console errors in all six.
- **Scenario B:** **ALL CHECKS PASSED** — game over in 23.3 s, Light exactly
  0, "THE LIGHT DIES", zero console errors.
- **Scenario C:** **ALL CHECKS PASSED** — splits **138**, enemies damaged in
  the firing window **2**, zero console errors.
- **Screenshots** recaptured with zero console problems: cover **105,886 B**,
  start 92,900 B, play 87,827 B, end 62,692 B.
- **Entry program:** `MAKEFUN_OUTPUT_DIR=out node main.ts` writes a dossier
  of **608,198 bytes** (limit 1,572,864) and reports no error.

## Fix round 2 (2026-11-17) — the run itself is survivable now

The fix round above made the boss fair and stopped there; its own honest
verdict was that the win bot still lost half its campaigns to the *run* —
swarm pile-ups and light mismanagement on nights 6, 9 and 10. This round is
the targeted balance pass at that defect, diagnosed before any number moved.

### Diagnosis — instrumented replays (`tools/diag.mjs`)

A telemetry twin of the Scenario A bot (same seed, same decisions) recorded
every HP drop with its context, plus per-night HP/Light/contact stats, over
two baseline runs on the fix-round build (both victories, HP 32 and 67 —
the losses below are the mechanisms, seen live):

- **Pack bursts bite through the grace.** Night 8, run 1: four bites in
  3.6 s (−8, −8, −6, −9) with 1–5 shapes in close range. Each enemy bites on
  its own 0.8 s cadence and the keeper's post-hit grace was 0.35 s, so a
  phased pack lands a bite roughly every 0.8 s — about 10 HP/s while the
  keeper is in the pack.
- **Phantom bolts from last night's Husk.** Several −10 drops (exactly a
  bolt's damage) landed with *no enemy within 130 px* — on nights 4 and 6,
  which have no elite at all. Cause: `G.projectiles` was never cleared
  between nights; a bolt fired late in an elite night froze mid-air through
  the draft (projectiles only update while playing) and resumed into the
  next night. An invisible-source hit is not difficulty, it is a bug.
- **The light economy bottoms out mid-run.** Per-night light minimums ran
  32–51 on nights 3–6 in both runs (the fix round's night-6 death bottomed
  at 8.8): 22% oil variance plus flask expiry, exactly where the swarm
  starts mixing stalkers in. Low light also shrinks the lantern radius,
  which is what stalkers key their speed to.

### Adjustment 1 — three small fairness changes

- **Post-hit grace 0.35 s → 0.5 s** (`hurtPlayer`). The genre-standard
  window; a pack can no longer chain bites at its full cadence.
- **A dead night's bolts die with it** (`enterIntermission` now clears
  `G.projectiles`). No more cross-night phantom hits.
- **Oil drop chance 0.22 → 0.26** (`LIGHT.oilDropChance`; README updated to
  "about one kill in four"). Variance relief where the economy pinches.

**Scenario A batch 1 on this build — 2 victories in 4** (acceptance was
≥3 of 4 and no death before night 9; **missed**, recorded in full):

- **Victory** — 146 kills, score 4,876, end HP **46** (run min HP 46).
- **Victory** — 146 kills, score 4,903, end HP **57** (run min HP 40).
- **Defeat on night 6** — bitten down with the lantern at 45.4 (min HP 3,
  min Light 13.1 on the way).
- **Defeat on night 10** — 141 kills, died in the last night's swarm at
  Light 52.6 after entering the endgame battered (run min HP 13).

Fresh diag on this build (one victory at HP 69, one night-6 death) found the
remaining mechanism, precisely: the night-6 death was **one shade glued to
the keeper, biting four times in 2.6 s on its bare 0.8 s cadence**
(t = 99.2–101.8, a single shape at 9–15 px in every sample). Nothing in the
game pushed a landed biter off — its attack cooldown was the only gate.
The same build's night 4 bled −58 HP in 4.7 s inside a pack that had
assembled while the keeper, entering at 18 Light, detoured for oil.

### Adjustment 2 — the biter pays for its bite

- **Bite recoil:** a landed bite now knocks the biter back (320, the same
  scale as Flare Nova's knockback). It must re-close the distance before it
  can bite again, and a pack's ring opens a gap with every bite. Damage
  numbers, attack cadence, spawn tables and the Pyre's phase events are
  untouched.
- **Oil flasks 12 → 14 Light** (`LIGHT.oilValue`; README updated) — a
  little more in each flask for the low-light entries that precede pile-ups.

### Scenario A batch 2 — the acceptance batch, reported as it fell

**4 victories in 4. No deaths at all, let alone before night 9.**

- **Victory** — 146 kills, score 4,829, end HP **30** (run min HP 30, min Light 33.2).
- **Victory** — 146 kills, score 4,846, end HP **11** (run min HP 11, min Light 30.9).
- **Victory** — 146 kills, score 5,079, end HP **15** (run min HP 15, min Light 33.1).
- **Victory** — 146 kills, score 4,897, end HP **54** (run min HP 54, min Light 46.7).

The game stays tense — two wins ended at HP 11 and 15, and light still
bottoms near 31 — but across this batch the keeper was never executed by a
glued-on biter or a ghost bolt, and every campaign reached the dawn.
Zero console errors in all four runs.

### Re-verified after the round (2026-11-17, final build)

- **Smoke:** clean, zero console problems.
- **Scenario B:** **ALL CHECKS PASSED** — the game is still losable: game
  over in 30.0 s, Light exactly 0, "THE LIGHT DIES", HP 60 (the starving
  keeper now keeps more HP on the way down — biters recoil — but the flame
  still starves on schedule).
- **Scenario C:** the prism chain passes end to end — shards collected by
  walking (1, then 2), prism placed by a real right-click, placing spent a
  shard (2 → 1), split events fired (8, then 7), an enemy took beam damage
  in the firing window, zero console errors. **One auxiliary check fails in
  both runs and is recorded, not hidden:** "night-1 field populated (3
  shades at once)". A probe on the same seed shows why: the third shade
  spawns at t ≈ 9.5 s, and the bot now lands its prism shot and registers
  split damage *before* that, so its success exit fires while only two
  shades have ever been alive at once. The check was written for a slower
  success path; the mechanic it guards is fully exercised. The check itself
  was not edited.
- **Screenshots** recaptured with zero console problems: cover **106,838 B**,
  start 93,027 B, play 88,647 B, end 63,027 B. The cover was viewed at full
  size: the Dread Pyre still reads as a spiked burning sphere — dark crown
  shards around an amber molten body at the end of the split fan, boss bar
  at PHASE II, Threat Queue 385 HP — the fix round's readability work is
  intact, and no staging changed this round.
- **Entry program:** `MAKEFUN_OUTPUT_DIR=out node main.ts` writes a dossier
  of **611,689 bytes** (limit 1,572,864) and reports no error.
