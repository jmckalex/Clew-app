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

test('as CommonMark (marked) reads them: a backtick run with a backtick after it opens nothing; a closer holds nothing but its run', () => {
	// Clew-boss's catch, 2026-11-27: the demo's Features/Queries.md starts a
	// paragraph with an inline code span, and the first version read it as a
	// four-backtick fence, hiding the note to the next such line — its
	// "## Tasks across the vault" heading among it.
	const queries = [
		'# Queries', '', '```` ```query ```` filters notes by their fields.', '',
		'```query', 'from: Notes', '```', '',
		'## Tasks across the vault', '', '```` ```tasks ```` gathers every task.', '',
	];
	assert.deepEqual(fenced(queries), [4, 5, 6], 'only the real fence');
	assert.equal(maskMarkdownCode(queries.join('\n')).split('\n')[8], '## Tasks across the vault', 'the scanner keeps the heading');
	assert.deepEqual(fenced(['```', 'a', '```js', 'b', '```', 'after']), [0, 1, 2, 3, 4], '"```js" closes nothing');
	assert.deepEqual(fenced(['~~~ `x` ~~~', 'code', '~~~', 'after']), [0, 1, 2], 'a tilde opener may hold backticks');
	assert.deepEqual(fenced(['```', 'a', '  ```  ', 'after']), [0, 1, 2], 'a closer indented, spaces after it');
});

test('maskFences blanks fenced lines and keeps every offset; maskMarkdownCode masks the same lines', () => {
	const text = 'a\n  ```\n  @end(x)\n  ```\nb `c` d';
	const masked = maskFences(text);
	assert.equal(masked.length, text.length);
	assert.deepEqual(masked.split('\n'), ['a', '     ', '         ', '     ', 'b `c` d'], 'inline code is not its business');
	assert.deepEqual(maskMarkdownCode(text).split('\n').slice(0, 4), masked.split('\n').slice(0, 4));
	assert.equal(maskFences('no fences'), 'no fences');
});
