// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { siteFiles, staticAppEmbeds } from '../src/main/site-files.js';
import { compileExcludes } from '../src/main/vault-excludes.js';

function vault(files) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-site-files-'));
	for (const [rel, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), text);
	}
	return root;
}
const walk = (root, settings = {}, trusted = true) => siteFiles(root, { excludes: compileExcludes(settings), trusted });

test('notes and attachments go out; Clew machinery does not', () => {
	const root = vault({
		'Welcome.md': '# Hi', 'Notes/A.md': 'a', 'Attachments/x.png': 'png',
		'.clew/vault-settings.json': '{}', '.obsidian/app.json': '{}', '.hidden': 'x',
	});
	const { notes, files } = walk(root);
	assert.deepEqual(notes.sort(), ['Notes/A.md', 'Welcome.md']);
	assert.deepEqual(files, ['Attachments/x.png']);
	fs.rmSync(root, { recursive: true, force: true });
});

test('shared state and app data are private by default', () => {
	const root = vault({
		'Welcome.md': '# Hi',
		'clewdata.json': '{"app:x:k": 1}',
		'Apps/Probe/clew-app.json': '{"id":"probe"}',
		'Apps/Probe/index.html': '<p>app</p>',
		'Apps/Probe/data/saves/a.txt': 'secret',
		// Not an app folder: a `data/` here is ordinary vault content.
		'Research/data/table.csv': '1,2',
		// Not the vault root: an ordinary file of that name.
		'Notes/clewdata.json': '{}',
	});
	const { files, withheld } = walk(root);
	assert.deepEqual(files.sort(), ['Apps/Probe/clew-app.json', 'Apps/Probe/index.html', 'Notes/clewdata.json', 'Research/data/table.csv']);
	assert.deepEqual(withheld.sort(), ['Apps/Probe/data', 'clewdata.json']);
	fs.rmSync(root, { recursive: true, force: true });
});

test('a hidden folder is not walked', () => {
	const root = vault({ 'Welcome.md': '# Hi', 'Archive/Old.md': 'old' });
	assert.deepEqual(walk(root, { hidden: ['Archive'] }).notes, ['Welcome.md']);
	fs.rmSync(root, { recursive: true, force: true });
});

test('a restricted vault is not followed out of itself', () => {
	const outside = vault({ 'Elsewhere.md': 'outside' });
	const root = vault({ 'Welcome.md': '# Hi' });
	fs.symlinkSync(outside, path.join(root, 'Linked'));
	assert.deepEqual(walk(root, {}, false).notes, ['Welcome.md']);
	assert.deepEqual(walk(root, {}, true).notes.sort(), ['Linked/Elsewhere.md', 'Welcome.md']);
	fs.rmSync(root, { recursive: true, force: true });
	fs.rmSync(outside, { recursive: true, force: true });
});

test('an @app in a static page says what it is, and loads nothing', () => {
	const html = '<p>before</p><clew-app-embed class="clew-app-embed" data-app="Apps/Flash &amp; Cards" style="width: 100%; height: 320px"><span class="clew-app-label">App: Apps/Flash &amp; Cards</span></clew-app-embed><p>after</p>';
	const out = staticAppEmbeds(html);
	assert.match(out, /data-static="1"/);
	assert.match(out, /Apps\/Flash &amp; Cards — an app that runs inside Clew, not on a website\./);
	assert.doesNotMatch(out, /iframe|clew-frame:/);
	assert.match(out, /^<p>before<\/p>.*<p>after<\/p>$/);
	assert.equal(staticAppEmbeds('<p>no apps</p>'), '<p>no apps</p>');
});
