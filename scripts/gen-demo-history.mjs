#!/usr/bin/env node
// Every version of every demo-vault file git has ever held, by its sha256:
// src/main/demo-history.json — how the demo vault's update (main/
// demo-sync.js) knows that a file in someone's copy is one Clew shipped and
// they never changed, even in a copy made before Clew recorded what it gave
// (a dev.6 copy: no record at all). Each version carries WHEN it first
// shipped: the position, from 1, of the first commit to hold it among the
// commits that changed demo-vault/ — so a copy with no record can be dated by
// its untouched files, and a note it lacks told deleted from never given.
// Appending commits never renumbers the old ones. Dot paths (.clew/) are left
// out, as the sync leaves them. `--check` compares instead of writing and fails when the
// file is out of date (scripts/package.js runs it: a build must ship the
// history it was made from). Run `npm run gen-demo-history` after changing
// demo-vault/ and commit the result.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src', 'main', 'demo-history.json');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

const history = {};   // rel → hash → the position of the first commit holding it
const pairs = git('log', '--reverse', '--format=@%H', '--name-only', '--', 'demo-vault').toString().split('\n');
let commit = null;
let position = 0;
for (const line of pairs) {
	if (line.startsWith('@')) { commit = line.slice(1); position += 1; continue; }
	if (!line.startsWith('demo-vault/')) continue;
	const rel = line.slice('demo-vault/'.length);
	if (rel.split('/').some((part) => part.startsWith('.'))) continue;
	let bytes;
	try { bytes = git('show', `${commit}:${line}`); } catch { continue; }   // deleted in that commit
	const hash = crypto.createHash('sha256').update(bytes).digest('hex');
	(history[rel] ??= {})[hash] ??= position;   // oldest first: the first holds
}
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const text = JSON.stringify(sorted(Object.fromEntries(Object.entries(history).map(([rel, v]) => [rel, sorted(v)]))), null, '\t') + '\n';
if (process.argv.includes('--check')) {
	const now = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
	if (now !== text) {
		console.error('gen-demo-history: src/main/demo-history.json is out of date — run `npm run gen-demo-history` and commit it.');
		process.exit(1);
	}
	console.log('gen-demo-history: up to date');
} else {
	fs.writeFileSync(out, text);
	console.log(`gen-demo-history: ${Object.keys(history).length} files, ${Object.values(history).reduce((n, v) => n + Object.keys(v).length, 0)} versions from ${position} commits → src/main/demo-history.json`);
}
