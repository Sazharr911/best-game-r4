// EMBERWARD — entry program for make.fun best-game-01 (Node 22, standard library only).
//
// The game itself is the static site in game/ (game/index.html plus its ES modules under
// game/src/); it needs no build step and loads nothing over the network. This program hands
// the entry in: it copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there with the kit's vendored buildDossier, so the
// dossier is exactly the bytes the scorer rebuilds and compares.
//
// Run it locally the same way the grader does, with MAKEFUN_OUTPUT_DIR standing in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });

// The playable game, copied whole: plain files only, as the gate requires.
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// Screenshots are optional to the copy (the gate counts them), so guard the folder.
const shotsDir = join(outputDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), shotsDir, { recursive: true });
}

// The caps below are the scorer's own (see the competition's gate reference): the dossier
// text is capped at 160 KiB, screenshots at 4 files of 256 KiB, game/ at 993 entries and
// 48 MiB with no path over 1,000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// A one-line summary for whoever ran the hand-in (the grader ignores stdout).
console.log(`EMBERWARD handed in: dossier.json ${Buffer.byteLength(dossier)} bytes -> ${outputDir}`);
