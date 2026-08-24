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
import { scanMentions } from '../src/main/search.js';

test('finds word-bounded mentions case-insensitively', () => {
	const text = 'Read the design note.\nThe DESIGN matters.\nRedesign everything.\n';
	const hits = scanMentions(text, ['Design']);
	assert.deepEqual(hits.map((h) => [h.line, h.column]), [[1, 9], [2, 4]]);
	assert.equal(hits[0].length, 6);
});

test('mentions inside wikilinks are excluded', () => {
	const text = 'See [[Design]] and design and ![[Design#h|d]] too.\n';
	const hits = scanMentions(text, ['Design']);
	assert.equal(hits.length, 1);
	assert.equal(hits[0].column, 19);
});

test('tags and word-embedded matches are excluded', () => {
	const hits = scanMentions('#design is a tag, redesigned is a word, design is a hit\n', ['design']);
	assert.equal(hits.length, 1);
	assert.equal(hits[0].column, 40);
});

test('multiple names (aliases) all match', () => {
	const hits = scanMentions('The frontmatter block and the Properties panel.\n', ['Properties', 'Frontmatter']);
	assert.equal(hits.length, 2);
	assert.deepEqual(hits.map((h) => h.name).sort(), ['Frontmatter', 'Properties']);
});

test('respects the match cap', () => {
	const text = Array(30).fill('design').join('\n');
	assert.equal(scanMentions(text, ['design'], 10).length, 10);
});

test('mentions inside code, fences, and script blocks are ignored', () => {
	const text = [
		'A real design mention.',
		'Inline `design` code.',
		'```',
		'const design = 1;',
		'```',
		'<script>',
		'openNote("design");',
		'</script>',
		'And design again.',
	].join('\n');
	const hits = scanMentions(text, ['design']);
	assert.deepEqual(hits.map((h) => h.line), [1, 9]);
	assert.equal(hits[1].snippet, 'And design again.');
});
