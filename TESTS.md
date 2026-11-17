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

- Victory reached — end screen title **“DAWN BREAKS”**.
- Score **4,819** from **142 kills**; nights advanced 1 → 10.
- Finished at HP 58 / Light 61.5 (run minimums: HP 58, Light 21.9).
- Blessing draft appeared between nights; zero console errors.

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

- Game over after **25.8 s**: Light hit exactly **0** (HP still 68 — the
  flame starved before the dark could bite through).
- End screen title **“THE LIGHT DIES”**. Zero console errors.

## Screenshots — `node tools/shots.mjs`

The four `screenshots/*.jpg` are staged deterministically with the
`?shot=cover|start|play|end` scenes in `game/src/shots.js` (fixed seeds),
settled, and captured with `Page.captureScreenshot` as JPEG (quality 84).
All four are 1280×800 and ≤ 262,144 bytes (actual: 52–75 KB), with zero
console problems during capture. `1-cover.jpg` is the staged Night-8 scene:
beam firing, an elite in the Threat Queue, relics and blessings owned,
INCOMING populated from the real Night-8 table.

## Entry program

`MAKEFUN_OUTPUT_DIR=out node main.ts` runs clean and writes a dossier of
**436,407 bytes** (limit 1,572,864), with `game/` (13 files) and all four
screenshots copied to the output directory. No file under `game/` references
the network.
