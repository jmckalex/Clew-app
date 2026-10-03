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
import { cleanPdfText, escapeProse, citation, quoteBlock, placeQuote } from '../src/shared/pdf-quote.js';

test('a PDF selection becomes one paragraph', () => {
	assert.equal(cleanPdfText(['The evo-\nlutionary dynamics of\nsignalling games']), 'The evolutionary dynamics of signalling games');
	// Across pages, too.
	assert.equal(cleanPdfText(['ends one page', 'begins the next']), 'ends one page begins the next');
	// Soft hyphens and the engine's marker for them are dropped.
	assert.equal(cleanPdfText('equi­librium and equi￾librium'), 'equilibrium and equilibrium');
	// A hyphen before a capital (a name) or a digit is the author's.
	assert.equal(cleanPdfText('Lewis-\nSkyrms and 1990-\n1995'), 'Lewis- Skyrms and 1990- 1995');
	assert.equal(cleanPdfText(''), '');
	assert.equal(cleanPdfText(null), '');
});

test('prose that would be markup is escaped', () => {
	assert.equal(escapeProse('x^2 and H_2O and a*b*c'), 'x\\^2 and H\\_2O and a\\*b\\*c');
	assert.equal(escapeProse('costs $5 and $10'), 'costs \\\\\\$5 and \\\\\\$10');
	assert.equal(escapeProse('see /tmp/ here'), 'see \\/tmp/ here');
	assert.equal(escapeProse('==mark=='), '\\=\\=mark\\=\\=');
	assert.equal(escapeProse('<b>bold</b>'), '\\<b>bold\\</b>');
	assert.equal(escapeProse('a \\cite{x}'), 'a \\\\cite{x}');
	assert.equal(escapeProse('ask @skyrms (@lewis) or me@example.com'), 'ask \\@skyrms (\\@lewis) or me@example.com');
	assert.equal(escapeProse('Note:: thing and a::b'), 'Note\\:\\: thing and a\\:\\:b');
	assert.equal(escapeProse('::: not a fence'), '\\:\\:\\: not a fence');
});

test('a bracket is never backslashed: `\\[` is display maths', () => {
	assert.equal(escapeProse('[sic] and [p. 4]'), '[sic] and [p. 4]');
	assert.equal(escapeProse('[[Link]] and [@key, p. 3]'), '&#91;[Link]] and &#91;@key, p. 3]');
});

test('ordinary prose is left alone', () => {
	const prose = 'Signalling and/or convention: see https://example.com/a/b, 1/2 of them — “quoted”.';
	assert.equal(escapeProse(prose), prose);
});

test('a slash only matters in the dialect', () => {
	assert.equal(escapeProse('see /tmp/ here', { normalSyntax: true }), 'see /tmp/ here');
});

test('a first line that would be another block is escaped', () => {
	assert.equal(escapeProse('# not a heading'), '\\# not a heading');
	assert.equal(escapeProse('- not a list'), '\\- not a list');
	assert.equal(escapeProse('2. not a list'), '2\\. not a list');
	assert.equal(escapeProse('3) nor this'), '3\\) nor this');
	assert.equal(escapeProse('| not a table'), '\\| not a table');
	assert.equal(escapeProse('2.5 per cent'), '2.5 per cent');
});

test('the citation follows the vault', () => {
	assert.equal(citation('skyrms:1996', 12), '\\cite[p. 12]{skyrms:1996}');
	assert.equal(citation('skyrms:1996', 12, { pandoc: true }), '[@skyrms:1996, p. 12]');
	assert.equal(citation(null, 12), '');
});

test('the block: quote, then citation and back-link', () => {
	assert.equal(
		quoteBlock({ text: 'Conventions are equilibria.', page: 3, link: 'Lewis 1969.pdf', key: 'lewis:1969' }),
		'> Conventions are equilibria.\n>\n> \\cite[p. 3]{lewis:1969} · [[Lewis 1969.pdf#page=3|PDF p. 3]]',
	);
	assert.equal(
		quoteBlock({ text: 'Text.', page: 7, link: 'Papers/x.pdf', key: 'k', pandoc: true }),
		'> Text.\n>\n> [@k, p. 7] · [[Papers/x.pdf#page=7|PDF p. 7]]',
	);
	assert.equal(
		quoteBlock({ text: 'Text.', page: 7, link: 'x.pdf' }),
		'> Text.\n>\n> [[x.pdf#page=7|PDF p. 7]]',
	);
});

const apply = (doc, pos, block = 'Q') => {
	const p = placeQuote(doc, pos, block);
	return { text: doc.slice(0, p.from) + p.insert + doc.slice(p.to), cursor: p.cursor };
};

test('placed on an empty note', () => {
	assert.deepEqual(apply('', 0), { text: 'Q\n', cursor: 2 });
});

test('placed on a blank line between paragraphs', () => {
	const doc = 'one\n\ntwo\n';
	const r = apply(doc, 4);
	assert.equal(r.text, 'one\n\nQ\n\ntwo\n');
	assert.equal(r.text.slice(r.cursor), '\ntwo\n');
});

test('the cursor at the end of the note', () => {
	assert.equal(apply('one\n', 4).text, 'one\n\nQ\n');
});

test('placed after the block the cursor is in, never inside it', () => {
	// A paragraph over two lines: after both.
	assert.equal(apply('a sentence in\nprogress here\n\nnext\n', 5).text, 'a sentence in\nprogress here\n\nQ\n\nnext\n');
	// An earlier quote: after the whole of it, not after its first line.
	const quoted = '> text\n>\n> \\cite{k}\n\nmore\n';
	assert.equal(apply(quoted, 3).text, '> text\n>\n> \\cite{k}\n\nQ\n\nmore\n');
	// The start of a block's second line is still inside it.
	assert.equal(apply('first\nsecond\n', 6).text, 'first\nsecond\n\nQ\n');
});

test('a heading is a block of its own line', () => {
	assert.equal(apply('# Title\nText under it.\n', 3).text, '# Title\n\nQ\n\nText under it.\n');
});

test('placed before a block the cursor starts', () => {
	assert.equal(apply('first\n\nsecond\n', 7).text, 'first\n\nQ\n\nsecond\n');
	assert.equal(apply('only\n', 0).text, 'Q\n\nonly\n');
});

test('placed at the end of a note without a final newline', () => {
	const r = apply('last line', 9);
	assert.equal(r.text, 'last line\n\nQ\n');
	assert.equal(r.cursor, r.text.length);
});

test('two quotes in a row land in order', () => {
	let doc = 'para\n';
	let p = placeQuote(doc, 4, 'A');
	doc = doc.slice(0, p.from) + p.insert + doc.slice(p.to);
	p = placeQuote(doc, p.cursor, 'B');
	doc = doc.slice(0, p.from) + p.insert + doc.slice(p.to);
	assert.equal(doc, 'para\n\nA\n\nB\n');
});

test('a blank line holding spaces is replaced, not kept', () => {
	assert.equal(apply('one\n   \ntwo', 5).text, 'one\n\nQ\n\ntwo');
});
