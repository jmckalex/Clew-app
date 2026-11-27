// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Live edit pairs `@begin(name)` and `@end(name)` as the ENGINE does (the
// owner's rule, 2026-11-27: by name, nested like well-formed parentheses —
// `@end(b)` never closes `@begin(a)`, and what pairs with nothing is text).
// Each note here is built by the real watch-worker, the preview's engine; the
// environments that form in its HTML — name, opener line, depth — must be the
// ones the scanner (jmd/jmarkdown-scan.js, which live edit draws from) pairs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { scanJmarkdown } from '../src/renderer/editor/jmd/jmarkdown-scan.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-env-pairing-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');

/** `note` built to HTML by the engine in a folder of its own (an empty HOME). */
function engineHtml(name, note) {
	const dir = path.join(root, name);
	fs.mkdirSync(path.join(dir, 'home'), { recursive: true });
	fs.mkdirSync(path.join(dir, '.jmarkdown'), { recursive: true });
	fs.writeFileSync(path.join(dir, '.jmarkdown', 'config.json'), JSON.stringify({ 'Header style': 'fenced' }));
	fs.writeFileSync(path.join(dir, 'Note.md'), note);
	const worker = fork(watchWorker, [], {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: path.join(dir, 'home') },
	});
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file: 'Note.md', options: { to: 'html', output: 'Note.html' } });
			else if (msg?.type === 'done') { worker.kill(); resolve(fs.readFileSync(path.join(dir, 'Note.html'), 'utf8')); }
			else if (msg?.type === 'error') { worker.kill(); reject(new Error(msg.message)); }
		});
		worker.on('error', reject);
	});
}

/** The engine's environments: each generic `<div class="name">` with its
 *  opener's line, how many such divs hold it, and the line of the first
 *  element after it (where it ENDS: a closer has no element of its own). */
function engineEnvironments(html) {
	const body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
	const out = [];
	const open = [];
	let ended = [];
	for (const m of body.matchAll(/<[a-z][a-z0-9]*\b[^>]*?data-source-line="(\d+)"[^>]*>|<div\b[^>]*>|<\/div>/g)) {
		if (m[0] === '</div>') {
			const env = open.pop();
			if (env) ended.push(env);
			continue;
		}
		if (m[1]) {
			for (const env of ended) env[3] = Number(m[1]);
			ended = [];
		}
		const generic = /^<div data-source-line="(\d+)" class="([a-z]+)">$/.exec(m[0]);
		if (!m[0].startsWith('<div')) continue;
		const env = generic ? [generic[2], Number(generic[1]), open.filter(Boolean).length, null] : null;
		if (env) out.push(env);
		open.push(env);
	}
	return out;
}

/** The scanner's: each environment's name, opener line, how many hold it,
 *  and the first line after its closer that is neither blank nor a closer. */
function scannerEnvironments(note) {
	const lines = note.split('\n');
	const line = (o) => note.slice(0, o).split('\n').length;
	const envs = scanJmarkdown(note).constructs.filter((c) => c.kind === 'environment' && c.close);
	const closers = new Set(envs.map((c) => line(c.close.start)));
	return envs.map((c) => {
		let next = line(c.close.start) + 1;
		while (next <= lines.length && (!lines[next - 1].trim() || closers.has(next))) next += 1;
		return [note.slice(c.name.start, c.name.end), line(c.start),
			envs.filter((o) => o !== c && o.start < c.start && o.end >= c.end).length, next <= lines.length ? next : null];
	});
}

const NOTES = {
	// live-env-nesting-scenario.js's note, the cases the owner's rule decides.
	nesting: [
		'# Nesting', '',
		'@begin(aa)', 'one', '@begin(bb)', 'two', '@end(aa)', 'three', '@end(bb)', '',
		'four', '',
		'@begin(aa)', 'five', '@end(bb)', 'six', '',
		'@begin(aa)', 'seven', '@begin(aa)', 'eight', '@end(aa)', 'nine', '',
		'@begin(aa)', 'ten', '@begin(bb)', 'eleven', '@begin(aa)', 'twelve', '@end(bb)', 'thirteen', '@end(aa)', 'fourteen', '@end(aa)', '',
		'fifteen', '',
	],
	// Well nested, same names nested, spaces and sigils, a closer in fenced
	// code (code, not a closer — the engine's too since jmarkdown fd9df17,
	// the owner's ask 2026-11-27; until then it closed there and broke the
	// fence), a closer with text after it (none).
	nested: [
		'# Nested', '',
		'@begin(aa)', 'one', '@begin(bb)', 'two', '@begin(cc)', 'three', '@end(cc)', '@end(bb)', '@end(aa)', '',
		'@begin( aa )', 'four', '@begin(.aa)', 'five', '@end( aa )', '@end(aa)', '',
		'@begin(bb)', '', '```', '@end(bb)', '```', '', '@end(bb)', '',
		'@begin(cc)', 'six', '@end(cc) and more', '', 'seven', '',
	],
};

for (const [name, lines] of Object.entries(NOTES)) {
	test(`the scanner pairs as the engine does: ${name}`, async () => {
		const note = lines.join('\n');
		const engine = engineEnvironments(await engineHtml(name, note));
		assert.ok(engine.length > 0, 'the engine drew environments');
		assert.deepEqual(scannerEnvironments(note), engine);
	});
}
