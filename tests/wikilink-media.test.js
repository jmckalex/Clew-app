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
import { parseMediaAlias } from '../src/engine/wikilinks.js';

test('no alias → no alt, no size', () => {
	assert.deepEqual(parseMediaAlias(null), { alt: null, width: null, height: null });
	assert.deepEqual(parseMediaAlias(''), { alt: null, width: null, height: null });
});

test('pure width', () => {
	assert.deepEqual(parseMediaAlias('300'), { alt: null, width: 300, height: null });
});

test('width x height', () => {
	assert.deepEqual(parseMediaAlias('300x200'), { alt: null, width: 300, height: 200 });
});

test('plain alt text is not a size', () => {
	assert.deepEqual(parseMediaAlias('A caption'), { alt: 'A caption', width: null, height: null });
});

test('alt then size', () => {
	assert.deepEqual(parseMediaAlias('A caption|300'), { alt: 'A caption', width: 300, height: null });
	assert.deepEqual(parseMediaAlias('A caption|320x60'), { alt: 'A caption', width: 320, height: 60 });
});

test('multiple pipes: only the last segment can be the size', () => {
	assert.deepEqual(parseMediaAlias('a|b|300'), { alt: 'a|b', width: 300, height: null });
});

test('malformed sizes stay alt text', () => {
	assert.deepEqual(parseMediaAlias('300x'), { alt: '300x', width: null, height: null });
	assert.deepEqual(parseMediaAlias('x200'), { alt: 'x200', width: null, height: null });
	assert.deepEqual(parseMediaAlias('30f'), { alt: '30f', width: null, height: null });
});

test('whitespace around segments is trimmed', () => {
	assert.deepEqual(parseMediaAlias('A caption | 300'), { alt: 'A caption', width: 300, height: null });
});
