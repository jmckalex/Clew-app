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
import { inNavBand } from '../src/preview-client/pdf-quiet-nav.js';

// The pill as measured in a PDF tab: 150×42 at the bottom centre.
const pill = { left: 550, right: 700, top: 760, bottom: 802, width: 150 };
const viewer = { bottom: 826 };

test('the band: just above the pill, a little wider, down to the viewer\'s bottom', () => {
	assert.equal(inNavBand({ x: 625, y: 781 }, pill, viewer), true, 'on the pill');
	assert.equal(inNavBand({ x: 665, y: 730 }, pill, viewer), true, '30px above it');
	assert.equal(inNavBand({ x: 470, y: 790 }, pill, viewer), true, 'beside it, within the sides');
	assert.equal(inNavBand({ x: 625, y: 820 }, pill, viewer), true, 'below it, above the viewer\'s edge');
	assert.equal(inNavBand({ x: 625, y: 690 }, pill, viewer), false, 'too far above: the page being read');
	assert.equal(inNavBand({ x: 400, y: 790 }, pill, viewer), false, 'too far to the side');
});

test('no pill, no band', () => {
	assert.equal(inNavBand({ x: 1, y: 1 }, null, viewer), false);
	assert.equal(inNavBand({ x: 1, y: 1 }, { left: 0, right: 0, top: 0, bottom: 0, width: 0 }, viewer), false);
});
