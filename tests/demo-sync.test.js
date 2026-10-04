// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The bundled demo vault brought up to date in the user's copy
// (main/demo-sync.js): new files added, nothing overwritten, no code slipped
// into .clew, a deleted demo note left deleted.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listFiles, demoFilesToAdd, syncDemoVault, demoSyncNotice } from '../src/main/demo-sync.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-demo-sync-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const put = (root, rel, text) => {
	fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
	fs.writeFileSync(path.join(root, rel), text);
};
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (root, rel) => fs.existsSync(path.join(root, rel));

test('the plan: a copy from before the list counts what it holds as given', () => {
	const bundled = ['Apps/Ticker/app.js', 'Features/App Gallery.md', 'Welcome.md'];
	assert.deepEqual(demoFilesToAdd({ bundled, existing: new Set(['Welcome.md']), delivered: null }),
		{ add: ['Apps/Ticker/app.js', 'Features/App Gallery.md'], delivered: ['Apps/Ticker/app.js', 'Features/App Gallery.md', 'Welcome.md'] });
	// With the list: what was given before is not given again, though missing.
	assert.deepEqual(demoFilesToAdd({ bundled, existing: new Set(['Welcome.md']), delivered: new Set(['Welcome.md', 'Features/App Gallery.md']) }).add,
		['Apps/Ticker/app.js']);
});

test('an old copy gets the new files; nothing it has is touched; .clew is never written into', () => {
	const source = path.join(tmpRoot, 'bundle-1');
	const target = path.join(tmpRoot, 'copy-1');
	put(source, 'Welcome.md', 'Welcome, from the bundle.\n');
	put(source, 'Features/App Gallery.md', '# App Gallery\n');
	put(source, 'Apps/Ticker/app.js', '// ticker\n');
	put(source, '.clew/plugins/p/main.js', '// a plugin: code\n');
	put(source, '.clew/vault-settings.json', '{}');
	put(target, 'Welcome.md', 'Welcome — and my own edit.\n');
	put(target, 'Mine.md', 'A note of my own.\n');
	assert.deepEqual(listFiles(source), ['Apps/Ticker/app.js', 'Features/App Gallery.md', 'Welcome.md']);
	const added = syncDemoVault(source, target);
	assert.deepEqual(added, ['Apps/Ticker/app.js', 'Features/App Gallery.md']);
	assert.equal(read(target, 'Welcome.md'), 'Welcome — and my own edit.\n', 'never over a file');
	assert.equal(read(target, 'Mine.md'), 'A note of my own.\n');
	assert.equal(has(target, '.clew/plugins/p/main.js'), false, 'no code slipped into .clew');
	assert.equal(has(target, '.clew/vault-settings.json'), false);
	assert.deepEqual(JSON.parse(read(target, '.clew/demo-files.json')).files,
		['Apps/Ticker/app.js', 'Features/App Gallery.md', 'Mine.md', 'Welcome.md']);
	// Opened again: nothing new.
	assert.deepEqual(syncDemoVault(source, target), []);
});

test('a demo note deleted stays deleted; a file new in the bundle arrives', () => {
	const source = path.join(tmpRoot, 'bundle-2');
	const target = path.join(tmpRoot, 'copy-2');
	put(source, 'Welcome.md', 'w\n');
	put(source, 'Guide/Old.md', 'old\n');
	fs.cpSync(source, target, { recursive: true });
	assert.deepEqual(syncDemoVault(source, target), [], 'a fresh copy only records what it holds');
	fs.rmSync(path.join(target, 'Guide/Old.md'));
	put(source, 'Guide/New.md', 'new\n');
	assert.deepEqual(syncDemoVault(source, target), ['Guide/New.md']);
	assert.equal(has(target, 'Guide/Old.md'), false);
});

test('never over a folder of that name', () => {
	const source = path.join(tmpRoot, 'bundle-3');
	const target = path.join(tmpRoot, 'copy-3');
	put(source, 'Notes', 'a file in the bundle\n');
	fs.mkdirSync(path.join(target, 'Notes'), { recursive: true });
	assert.deepEqual(syncDemoVault(source, target), []);
	assert.equal(fs.statSync(path.join(target, 'Notes')).isDirectory(), true);
});

test('the notice names the notes first', () => {
	assert.equal(demoSyncNotice([]), null);
	assert.equal(demoSyncNotice(['Apps/Ticker/app.js', 'Apps/Ticker/index.html', 'Features/App Gallery.md', 'Reading/A.md']),
		'The demo vault has new things from this version of Clew: Features/App Gallery, Reading/A, and 2 more files.');
	assert.equal(demoSyncNotice(['Apps/T/app.js']), 'The demo vault has new things from this version of Clew: 1 file.');
});
