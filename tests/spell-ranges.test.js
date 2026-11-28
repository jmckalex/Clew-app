// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What the spell checker is kept off (src/renderer/editor/spell-ranges.js),
// over the REAL dialect scanner and the REAL markdown parser: every word of
// a note below is either prose — checked — or not, and each misspelt
// "word" is placed so the test says which. The words are generic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { noteMarkdown } from '../src/renderer/editor/jmd/markdown-config.js';
import { scanJmarkdown } from '../src/renderer/editor/jmd/jmarkdown-scan.js';
import { noSpellRanges, NO_SPELL_NODES } from '../src/renderer/editor/spell-ranges.js';

/** The ranges for `text`, as editor/spellcheck.js computes them. */
function rangesOf(text, within) {
	const state = EditorState.create({ doc: text, extensions: [noteMarkdown({})] });
	const tree = ensureSyntaxTree(state, text.length, 5000);
	const nodes = [];
	tree.iterate({ enter: (n) => { if (NO_SPELL_NODES.has(n.name)) { nodes.push({ name: n.name, from: n.from, to: n.to }); return false; } } });
	return noSpellRanges(scanJmarkdown(text), nodes, (a, b) => text.slice(a, b), within);
}
/** Whether every character of `word`'s first occurrence after `after` is excluded. */
function excluded(text, word, after = '') {
	const at = text.indexOf(word, after ? text.indexOf(after) : 0);
	assert.ok(at >= 0, `${word} is in the note`);
	const ranges = rangesOf(text);
	return ranges.some(([a, b]) => a <= at && at + word.length <= b);
}
/** Whether any character of it is. */
function touched(text, word, after = '') {
	const at = text.indexOf(word, after ? text.indexOf(after) : 0);
	return rangesOf(text).some(([a, b]) => a < at + word.length && b > at);
}

const NOTE = `---
title: Notse on the wether
tags: [drafft, revew]
---
# A headding with wrods

Prose with a misspelt wrod, /italc text/, ==hilighted text== and **strnog text**.
Some \`inlnecode\` and $\\alpha + \\betta$ and \\(\\gamma_{idx}\\) in a line.
A citation \\cite{Smithh:2001} and [[Foldr/Notte#Sectoin|an aliass here]] and #tagg here.
An embed ![[picc.png]] and a footnote[^fn: with a bodyy] and {{varr}} too.
A link [linkk text](http://exmple.com/pathh) and a bare https://bare.exmple.org/x.
A directive @note[its contnt is prose] and @reveal[http://localhst/prezz/] and @image[pics/phto.png].
An entity &nbsp; and <spann class="clss">html textt</spann> here ^blokid

\`\`\`js
let varible = 1;
\`\`\`

@begin(theorem)
A theorm body is prose.
@end(theorem)

@begin(TeX)
\\noindnt raw tex
@end(TeX)

<!-- a commnt -->

[reff]: http://reff.exmple.org
`;

test('prose is checked: headings, paragraphs, italics, highlights, strong, a wikilink\'s alias, a footnote\'s text, a directive\'s bracket, an environment\'s body', () => {
	for (const [word, after] of [['headding'], ['wrod', 'misspelt'], ['italc'], ['hilighted'], ['strnog'],
		['aliass'], ['bodyy'], ['contnt'], ['theorm'], ['linkk']]) {
		assert.equal(touched(NOTE, word, after), false, `${word} is prose`);
	}
});

test('not prose: front matter, code, maths, citations, link targets, tags, embeds, mustaches, URLs, literal directives, HTML, entities, block ids, TeX bodies, comments, reference definitions', () => {
	for (const [word, after] of [
		['Notse'], ['drafft'], ['revew'],                          // the front matter, keys and values
		['inlnecode'], ['varible'],                                 // a code span, a fence
		['betta'], ['idx'],                                         // $…$, \(…\)
		['Smithh'], ['cite{'],                                      // a citation and its command
		['Foldr'], ['Notte'], ['Sectoin'],                          // a wikilink's target and heading
		['tagg'], ['picc'], ['varr'],                               // a tag, an embed, a {{var}}
		['exmple.com/pathh'], ['bare.exmple.org'],                  // a link's URL, a bare URL
		['localhst'], ['phto'],                                     // @reveal[…], @image[…]
		['@note'], ['nbsp'], ['spann'], ['clss'], ['blokid'],       // a directive's name, an entity, a tag's markup, a block id
		['noindnt'], ['commnt'], ['reff]'],                         // a TeX body, an HTML comment, a reference definition
	]) {
		assert.equal(excluded(NOTE, word, after), true, `${word} is not prose`);
	}
	// The text between an HTML element's tags is prose.
	assert.equal(touched(NOTE, 'textt'), false, 'html textt is prose');
});

test('sorted, merged, and clipped to a window when asked', () => {
	const all = rangesOf(NOTE);
	for (let i = 1; i < all.length; i++) assert.ok(all[i][0] > all[i - 1][1], 'disjoint and in order');
	const line = NOTE.indexOf('A citation');
	const within = { from: line, to: NOTE.indexOf('\n', line) };
	const some = rangesOf(NOTE, within);
	assert.ok(some.length > 0 && some.length < all.length);
	for (const [a, b] of some) assert.ok(b >= within.from && a <= within.to, 'each touches the window');
});

test('nothing to scan, nothing excluded', () => {
	assert.deepEqual(noSpellRanges(null, [], () => ''), []);
	assert.deepEqual(rangesOf('Just plain wrods.'), []);
});
