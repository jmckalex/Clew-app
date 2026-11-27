// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Which lines are fenced code (shared/code-fences.js): the one rule live
// edit's scanner, its numbering, the note index and the engine's
// @begin/@end pairing all read code by.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fencedLines, maskFences } from '../src/shared/code-fences.js';
import { maskMarkdownCode } from '../src/renderer/editor/jmd/math-segments.js';

const fenced = (lines) => [...fencedLines(lines)];

test('a fence: three or more backticks or tildes after any indentation, closed by the same character at least as long', () => {
	assert.deepEqual(fenced(['a', '```', 'code', '```', 'b']), [1, 2, 3]);
	assert.deepEqual(fenced(['~~~js', 'x', '~~~']), [0, 1, 2]);
	assert.deepEqual(fenced(['- item', '  ```', '  code', '  ```', 'after']), [1, 2, 3], 'indented (a list item\'s)');
	assert.deepEqual(fenced(['````md', '```', 'inner', '```', '````', 'after']), [0, 1, 2, 3, 4], 'a longer fence holds a shorter');
	assert.deepEqual(fenced(['```', 'x', '~~~', 'y', '```']), [0, 1, 2, 3, 4], 'the other character does not close it');
	assert.deepEqual(fenced(['text', '```', 'never closed', 'still code']), [1, 2, 3], 'unclosed: to the end');
	assert.deepEqual(fenced(['`` not a fence', 'text']), []);
});

test('maskFences blanks fenced lines and keeps every offset; maskMarkdownCode masks the same lines', () => {
	const text = 'a\n  ```\n  @end(x)\n  ```\nb `c` d';
	const masked = maskFences(text);
	assert.equal(masked.length, text.length);
	assert.deepEqual(masked.split('\n'), ['a', '     ', '         ', '     ', 'b `c` d'], 'inline code is not its business');
	assert.deepEqual(maskMarkdownCode(text).split('\n').slice(0, 4), masked.split('\n').slice(0, 4));
	assert.equal(maskFences('no fences'), 'no fences');
});
