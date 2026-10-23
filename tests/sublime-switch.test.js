// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The guard for the owner's switch. jmarkdown's src/index.js puts a Sublime
// ⌘-click script into every full HTML page it writes — a click handler that
// sends `kmtrigger://macro=Open%20file%20in%20sublime&value=<the note's
// absolute path>:<line>` — unless the page is a fragment, LaTeX, stdin or a
// book. The owner's hunk (`ENABLE_SUBLIME_INVERSE_SEARCH = false`, kept by
// their decision of 2026-10-23, via Clew-boss) turns it off. It is in no
// jmarkdown commit: it lives in the master's working tree only, and
// `npm run sync-engine` copies whatever is there, so a sync from a tree
// without it would bring the script back and nothing else would notice — the
// engine's own tests pin the ∎, nothing pinned this (Clew-boss's mutation:
// 2ae14b8's own index.js passed every test). Held here through the real
// engine, both ways Clew runs it on a note: a single note's HTML export
// (export-worker.mjs) and the preview's render (its watch-worker in file
// mode, as reading view, the reading-view PDF and a site export are).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'clew-sublime-switch-')));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');

const NOTE = '# A heading\n\nA paragraph.\n\nAnother paragraph.\n';

/** NOTE built as a full HTML page by `workerPath` in a folder of its own (an
 *  empty HOME, so no user config): the page and the note's absolute path. */
function build(workerPath, { name, config = null, args = [] }) {
	const dir = path.join(root, name);
	const home = path.join(dir, 'home');
	fs.mkdirSync(home, { recursive: true });
	if (config) {
		fs.mkdirSync(path.join(dir, '.jmarkdown'), { recursive: true });
		fs.writeFileSync(path.join(dir, '.jmarkdown', 'config.json'), JSON.stringify(config));
	}
	fs.writeFileSync(path.join(dir, 'Note.md'), NOTE);
	const worker = fork(workerPath, args, {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file: 'Note.md', options: { to: 'html', output: 'Note.html' } });
			else if (msg?.type === 'done') { worker.kill(); resolve({ html: fs.readFileSync(path.join(dir, 'Note.html'), 'utf8'), note: path.join(dir, 'Note.md') }); }
			else if (msg?.type === 'error') { worker.kill(); reject(new Error(msg.message)); }
		});
		worker.on('error', reject);
	});
}

function assertNoInverseSearch({ html, note }, where) {
	// The page is the one the script is put into: a full document, its blocks
	// stamped with their source lines (which stay on — Clew's own ⌘-click and
	// scroll sync read them).
	assert.match(html, /<\/body>/, `${where}: a full page`);
	assert.match(html, /data-source-line="3"/, `${where}: source lines stamped`);
	assert.ok(!html.includes('kmtrigger:'), `${where}: no kmtrigger:// link`);
	assert.ok(!html.includes('Open%20file%20in%20sublime'), `${where}: no Sublime macro`);
	assert.ok(!/<script>[\s\S]*?closest\('\[data-source-line\]'\)[\s\S]*?<\/script>/.test(html), `${where}: no ⌘-click handler`);
	assert.ok(!html.includes(note), `${where}: the note's absolute path is not in the page`);
}

test('the owner\'s switch: a single note\'s HTML export carries no Sublime ⌘-click script', async () => {
	assertNoInverseSearch(await build(path.join(repo, 'src', 'engine', 'export-worker.mjs'), { name: 'export', args: [watchWorker] }), 'HTML export');
});

test('the owner\'s switch: the preview\'s render (reading view) carries none either', async () => {
	assertNoInverseSearch(await build(watchWorker, { name: 'preview', config: { 'Header style': 'fenced' } }), 'preview');
});
