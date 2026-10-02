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
import { sourceHashes, writeBuildStamp, staleSources } from '../src/main/build-stamp.js';

const checkout = () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-stamp-test-'));
	fs.mkdirSync(path.join(root, 'src', 'renderer'), { recursive: true });
	fs.writeFileSync(path.join(root, 'src', 'renderer', 'a.js'), 'export const a = 1;\n');
	fs.writeFileSync(path.join(root, 'src', 'b.css'), 'body {}\n');
	fs.writeFileSync(path.join(root, 'src', '.DS_Store'), 'ignored');
	return root;
};

test('a fresh build matches its sources', () => {
	const root = checkout();
	assert.deepEqual(Object.keys(sourceHashes(root)).sort(), ['src/b.css', 'src/renderer/a.js']);
	writeBuildStamp(root);
	assert.deepEqual(staleSources(root).changed, []);
});

test('edits, additions and removals since the build are named', () => {
	const root = checkout();
	writeBuildStamp(root);
	fs.appendFileSync(path.join(root, 'src', 'renderer', 'a.js'), '// edited\n');
	fs.writeFileSync(path.join(root, 'src', 'renderer', 'new.js'), '\n');
	fs.rmSync(path.join(root, 'src', 'b.css'));
	assert.deepEqual(staleSources(root).changed, ['-src/b.css', 'src/renderer/a.js', '+src/renderer/new.js']);
});

test('content, not time: a file rewritten unchanged is not stale', () => {
	const root = checkout();
	writeBuildStamp(root);
	const file = path.join(root, 'src', 'renderer', 'a.js');
	fs.writeFileSync(file, fs.readFileSync(file));
	fs.utimesSync(file, new Date(Date.now() + 60000), new Date(Date.now() + 60000));
	assert.deepEqual(staleSources(root).changed, []);
});

test('no stamp is not "fresh"', () => {
	assert.equal(staleSources(checkout()), null);
});
