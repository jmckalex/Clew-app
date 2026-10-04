// An OLD copy of the demo vault for demo-sync-scenario.js:
//   node smoke/make-demo-sync-target.mjs <dir>
// <dir>/copy is demo-vault as a 1 October copy had it — no Apps/, no
// Features/App Gallery.md, no Reading/ — with Welcome.md edited by "you";
// <dir>/vault a scratch vault for the window the scenario starts in.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-demo-sync-target.mjs <dir>');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.rmSync(dir, { recursive: true, force: true });
const copy = path.join(dir, 'copy');
fs.cpSync(path.join(repo, 'demo-vault'), copy, { recursive: true, filter: (src) => !src.split(path.sep).includes('.clew') });
for (const rel of ['Apps', 'Features/App Gallery.md', 'Reading']) fs.rmSync(path.join(copy, rel), { recursive: true, force: true });
fs.appendFileSync(path.join(copy, 'Welcome.md'), '\nMY OWN EDIT.\n');
fs.mkdirSync(path.join(dir, 'vault'), { recursive: true });
fs.writeFileSync(path.join(dir, 'vault', 'Start.md'), '# Start\n');
console.log(`demo sync target: ${copy}`);
