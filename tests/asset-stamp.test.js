// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STAMP_FILES, assetStamp, stampChanged } from '../src/main/asset-stamp.js';

// One temp root for this file, removed when it is done: fixtures used to
// be left in the system's temp folder, thousands of them over the runs.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-stamp-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

test('the stamp follows the engines, the bundle indexes and the app version, and nothing else', () => {
	const dir = fs.mkdtempSync(path.join(tmpRoot, 'clew-stamp-'));
	fs.mkdirSync(path.join(dir, 'bundles'));
	for (const f of STAMP_FILES) fs.writeFileSync(path.join(dir, f), 'v1');
	fs.writeFileSync(path.join(dir, 'auto.js'), 'not part of the stamp');
	const first = assetStamp(dir, '0.9.0');
	assert.equal(assetStamp(dir, '0.9.0'), first, 'stable when nothing changed');
	fs.writeFileSync(path.join(dir, 'auto.js'), 'changed, but not a stamped file');
	assert.equal(assetStamp(dir, '0.9.0'), first);
	assert.notEqual(assetStamp(dir, '0.10.0'), first, 'an upgrade is a change even with the same files');
	// A rebuilt bundle index (a bundles-only rebuild upstream is a normal thing to do).
	const index = path.join(dir, 'bundles', 'index.json');
	fs.writeFileSync(index, 'v2 — longer');
	assert.notEqual(assetStamp(dir, '0.9.0'), first, 'a changed bundle index is a different build');
	// An absent tree still stamps (as "missing"), so a machine with no engines does not throw.
	assert.match(assetStamp(path.join(dir, 'nowhere'), '0.9.0'), /index\.js:-/);
	fs.rmSync(dir, { recursive: true, force: true });
});

test('stampChanged records the stamp and reports a change once', () => {
	const dir = fs.mkdtempSync(path.join(tmpRoot, 'clew-stamp-'));
	const record = path.join(dir, 'deeper', 'asset-stamp.txt');
	assert.equal(stampChanged(record, 'A'), true, 'no record yet: clear once');
	assert.equal(fs.readFileSync(record, 'utf8'), 'A');
	assert.equal(stampChanged(record, 'A'), false, 'same build: nothing to do');
	assert.equal(stampChanged(record, 'B'), true, 'a different build');
	assert.equal(stampChanged(record, 'B'), false);
	fs.rmSync(dir, { recursive: true, force: true });
});
