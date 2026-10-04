// An OLD copy of the demo vault for demo-sync-scenario.js:
//   node smoke/make-demo-sync-target.mjs <dir> [commit]
// <dir>/copy is demo-vault exactly as the build from <commit> shipped it
// (default 77b0bea, dev.6 — a copy with no `.clew/demo-files.json`), with
// Welcome.md edited by "you"; <dir>/vault a scratch vault for the window the
// scenario starts in.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [dir, commit = '77b0bea'] = process.argv.slice(2);
if (!dir) throw new Error('usage: node smoke/make-demo-sync-target.mjs <dir> [commit]');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.rmSync(dir, { recursive: true, force: true });
const unpack = path.join(dir, 'unpack');
fs.mkdirSync(unpack, { recursive: true });
const tar = execFileSync('git', ['archive', commit, 'demo-vault'], { cwd: repo, maxBuffer: 256 * 1024 * 1024 });
execFileSync('tar', ['-x', '-C', unpack], { input: tar });
const copy = path.join(dir, 'copy');
fs.cpSync(path.join(unpack, 'demo-vault'), copy, { recursive: true, filter: (src) => !src.split(path.sep).includes('.clew') });
fs.rmSync(unpack, { recursive: true, force: true });
fs.appendFileSync(path.join(copy, 'Welcome.md'), '\nMY OWN EDIT.\n');
fs.mkdirSync(path.join(dir, 'vault'), { recursive: true });
fs.writeFileSync(path.join(dir, 'vault', 'Start.md'), '# Start\n');
console.log(`demo sync target: ${copy} (as of ${commit})`);
