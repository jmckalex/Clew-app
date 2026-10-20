// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// A list's indentation column in live edit (src/renderer/editor/live/
// columns.js): the font's space as an em, and live-edit.css counting every
// list line's columns in it — a nested item's first line draws its
// whitespace, so its quote and its later lines, indented by CSS, line up with
// its text only in that unit (a fixed 0.3em left them 2px right in Avenir
// Next, Clew-iOS 2026-10-20). The lines' positions are measured by
// smoke/live-list-quote-scenario.js, in Avenir Next and in Menlo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { columnEm } from '../src/renderer/editor/live/columns.js';

test('a column is the space\'s width as an em of the font\'s size', () => {
	assert.equal(columnEm(4, 16), '0.25em', 'Avenir Next at 16px');
	assert.equal(columnEm(9.6328, 16), '0.6021em', 'Menlo, as measured');
	assert.equal(columnEm(5, 20), '0.25em', 'the size does not matter');
	for (const [w, s] of [[0, 16], [4, 0], [NaN, 16], [4, NaN], [-1, 16]]) assert.equal(columnEm(w, s), null);
});

test('live-edit.css counts every list line\'s columns in --le-col, never a fixed em', () => {
	const css = fs.readFileSync(path.resolve('src/renderer/styles/live-edit.css'), 'utf8');
	const uses = css.match(/var\(--le-indent[^)]*\)\s*\*\s*[^)+;]+\)?/g) ?? [];
	assert.ok(uses.length >= 3, `the hang, the quote in an item, the list in a callout: ${uses.length}`);
	for (const use of uses) assert.match(use, /\*\s*var\(--le-col\b/, use);
});
