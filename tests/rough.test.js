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
import { seededRand, roughLine, roughRect, roughEllipse, roughDiamond } from '../src/renderer/canvas/rough.js';

test('seededRand is deterministic per seed', () => {
	const a = seededRand('shape-1');
	const b = seededRand('shape-1');
	const c = seededRand('shape-2');
	const seqA = [a(), a(), a()];
	const seqB = [b(), b(), b()];
	assert.deepEqual(seqA, seqB);
	assert.notDeepEqual(seqA, [c(), c(), c()]);
	for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test('rough paths are stable for the same seed and valid SVG path strings', () => {
	const d1 = roughRect(0, 0, 100, 80, seededRand('id'));
	const d2 = roughRect(0, 0, 100, 80, seededRand('id'));
	assert.equal(d1, d2);
	for (const d of [
		roughLine(0, 0, 50, 50, seededRand('x')),
		d1,
		roughEllipse(50, 40, 50, 40, seededRand('x')),
		roughDiamond(0, 0, 100, 80, seededRand('x')),
	]) {
		assert.ok(d.startsWith('M '));
		assert.ok(d.includes('Q '));
		assert.ok(!/NaN|Infinity/.test(d));
	}
});
