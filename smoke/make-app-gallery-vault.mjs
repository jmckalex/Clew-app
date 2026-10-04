// A scratch copy of demo-vault for app-gallery-scenario.js:
//
//   node smoke/make-app-gallery-vault.mjs <dir> <case>
//
// <dir>/vault is demo-vault without its .clew (but its vault-settings.json),
// as the packaged demo ships; <dir>/ud-trusted lists it under recentVaults
// (a vault this device knew: trusted), <dir>/ud-restricted is empty (a vault
// never decided about: restricted). `case` goes to vault/gallery-case.txt:
// `gallery` opens Features/App Gallery.md; the others open a one-app note in
// Tests/ (so the app is on screen and the ONLY clew-frame, which is what
// frameClick's `match: 'clew-frame'` finds):
//   insert    Replicator, live edit — Insert result → the editor
//   timer     Lecture Timer — 0.05 min → a line appended to the note
//   picker    Seminar Picker — Spin, Copy name → the clipboard
//   progress  Writing Progress, live edit — typing → note-changed
//   ticker    Stock Ticker — Live ECB rates (run with CLEW_SMOKE_NET_LOG=1)
//   reading   Reading List — a click opens the note (links.open)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, kase = 'gallery'] = process.argv.slice(2);
if (!dir) throw new Error('usage: node smoke/make-app-gallery-vault.mjs <dir> <case>');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = path.join(dir, 'vault');
fs.rmSync(dir, { recursive: true, force: true });
fs.cpSync(path.join(repo, 'demo-vault'), vault, { recursive: true, filter: (src) => !src.split(path.sep).includes('.clew') });
fs.mkdirSync(path.join(vault, '.clew'), { recursive: true });
fs.copyFileSync(path.join(repo, 'demo-vault', '.clew', 'vault-settings.json'), path.join(vault, '.clew', 'vault-settings.json'));
for (const ud of ['ud-trusted', 'ud-restricted']) fs.mkdirSync(path.join(dir, ud), { recursive: true });
fs.writeFileSync(path.join(dir, 'ud-trusted', 'clew-settings.json'), JSON.stringify({ recentVaults: [vault] }));
fs.writeFileSync(path.join(vault, 'gallery-case.txt'), `${kase}\n`);

const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(vault, rel)), { recursive: true }); fs.writeFileSync(path.join(vault, rel), text); };
put('Tests/Insert.md', '@app+[Apps/Replicator]{height=780}\n\nThe result goes here:\n');
put('Tests/Timer.md', '@app+[Apps/Timer]{height=280}\n\nRuns:\n');
put('Tests/Picker.md', '@app+[Apps/Picker]{height=300}\n\n## Seminar\n\n- Ada\n- Ben\n- Chiara\n');
put('Tests/Progress.md', '@app+[Apps/Progress]{height=210}\n\nOne two three four five.\n');
put('Tests/Ticker.md', '@app+[Apps/Ticker]{height=200}\n\n| Symbol | Price |\n| --- | ---: |\n| CLEW | 128.40 |\n| STAG | 77.50 |\n');
put('Tests/Reading.md', '@app+[Apps/ReadingList]{height=340}\n');
console.log(`app gallery fixture: ${vault} (${kase})`);
