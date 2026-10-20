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
// Next, Clew-iOS 2026-10-20). A numbered item's lines hang by its number's
// width in the same way, its digits and delimiter measured beside the space
// (a fixed 1.4em left a quote in `1.` 6px left of its text in Menlo, in `10.`
// 5px in Avenir Next). The lines' positions are measured by
// smoke/live-list-quote-scenario.js, in Avenir Next and in Menlo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { columnEm, numberWidth, tabbedIndent } from '../src/renderer/editor/live/columns.js';

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

test('an item\'s indentation holding a tab is a box of its own; spaces alone are left as they are', () => {
	assert.deepEqual(tabbedIndent('\t'), { from: 0, to: 1 });
	assert.deepEqual(tabbedIndent('\t\t'), { from: 0, to: 2 });
	assert.deepEqual(tabbedIndent(' \t'), { from: 0, to: 2 }, 'a space then a tab: one run, its tab to the stop');
	assert.equal(tabbedIndent('    '), null, 'spaces alone: drawn as always');
	assert.equal(tabbedIndent(''), null);
	// In a quote, counted from the end of its `>`s, as --le-indent is.
	assert.deepEqual(tabbedIndent('> \t'), { from: 2, to: 3 });
	assert.deepEqual(tabbedIndent('>\t\t'), { from: 2, to: 3 }, 'the tab after `>` is the quote\'s own');
	assert.equal(tabbedIndent('>   '), null);
});

test('a numbered item\'s marker box: its number, delimiter and spaces as measured, never narrower than a bullet\'s', () => {
	assert.equal(numberWidth('1. '), 'max(1.4em, var(--le-d1) + var(--le-dot) + var(--le-col))');
	assert.equal(numberWidth('10) '), 'max(1.4em, var(--le-d1) + var(--le-d0) + var(--le-paren) + var(--le-col))');
	assert.equal(numberWidth('9.  '), 'max(1.4em, var(--le-d9) + var(--le-dot) + var(--le-col) + var(--le-col))', 'every space after it');
	assert.equal(numberWidth('1.\t'), null, 'a tab: to its stop, the bullet\'s box as before');
	assert.equal(numberWidth(''), null);
	// The CSS: the hang and the number's box count it, a bullet's 1.4em without.
	const css = fs.readFileSync(path.resolve('src/renderer/styles/live-edit.css'), 'utf8');
	const hangs = css.match(/--le-hang:[^;]+;/g) ?? [];
	assert.equal(hangs.length, 2, 'a list line\'s, a quote in an item\'s');
	for (const hang of hangs) assert.match(hang, /\+ var\(--le-mark, 1\.4em\)\)/, hang);
	assert.match(css, /\.le-num \{[^}]*min-width: var\(--le-mark, 1\.4em\)/);
});
