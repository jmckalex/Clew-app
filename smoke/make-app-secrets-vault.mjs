// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The fixture for app-secrets-scenario.js (an app's secrets on this device,
// main/app-secrets.js, frame-bridge.md §9c):
//   node smoke/make-app-secrets-vault.mjs <dir>
// <dir>/vault — Keeper.md holding two apps:
//   Keeper (note.read + app.secrets): on load, and on every change of its
//     note, reads the note's `phase:` line — `set` keeps a secret, anything
//     else only looks — and logs `smoke-keeper: …` with whether a secret is
//     there, NEVER its value. The value is joined from two halves at run
//     time, so no file holds it whole: a search of the vault, the profile
//     and the run log for it says where it did not go.
//   Nosy (note.read only): asks for a secret anyway, both ways → `denied`.
// <dir>/ud — a fresh userData (the vault is restricted and undecided).
// Prints the vault's REAL path, which is the key Forget names.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-app-secrets-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const vault = path.join(dir, 'vault');
const put = (rel, text) => {
	fs.mkdirSync(path.dirname(path.join(vault, rel)), { recursive: true });
	fs.writeFileSync(path.join(vault, rel), text);
};
const page = (name) => `<!doctype html><html><head><meta charset="utf-8"><title>${name}</title></head><body><p id="out">${name}</p><script src="app.js"></script></body></html>\n`;

put('Keeper.md', '# Keeper\n\nphase: idle\n\n@app+[Apps/Keeper]{height=60}\n\n@app+[Apps/Nosy]{height=60}\n');
put('Apps/Keeper/clew-app.json', JSON.stringify({ id: 'keeper', name: 'Keeper', capabilities: ['note.read', 'app.secrets'] }, null, '\t'));
put('Apps/Keeper/index.html', page('Keeper'));
put('Apps/Keeper/app.js', `
const VALUE = ['S3CR3T', 'VALUE', '7f3a'].join('-');
const log = (s) => console.log('smoke-keeper: ' + s);
const code = (e) => e?.code ?? 'error';
async function act() {
	const phase = /phase: (\\w+)/.exec(await clew.notes.read())?.[1] ?? 'idle';
	if (phase === 'set') log('set=' + await clew.secrets.set('api-key', VALUE).then(() => 'ok', code));
	const got = await clew.secrets.get('api-key').then((v) => (v === VALUE ? 'present' : v === null ? 'none' : 'other'), code);
	log('phase=' + phase + ' got=' + got);
}
(async () => {
	await clew.ready;
	await act();
	clew.on('note-changed', () => act());
})();
`);
put('Apps/Nosy/clew-app.json', JSON.stringify({ id: 'nosy', name: 'Nosy', capabilities: ['note.read'] }, null, '\t'));
put('Apps/Nosy/index.html', page('Nosy'));
put('Apps/Nosy/app.js', `
(async () => {
	await clew.ready;
	const code = (p) => p.then(() => 'answered', (e) => e?.code ?? 'error');
	const get = await code(clew.secrets.get('api-key'));
	const set = await code(clew.secrets.set('api-key', 'nosy'));
	console.log('smoke-nosy: get=' + get + ' set=' + set);
})();
`);
fs.mkdirSync(path.join(dir, 'ud'), { recursive: true });
console.log(fs.realpathSync(vault));
