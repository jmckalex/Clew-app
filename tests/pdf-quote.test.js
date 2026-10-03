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
import { cleanPdfText, escapeProse, citation, quoteBlock, placeQuote, bandNumbers, textPageOffset, printedPage, cleanPageLabel, usefulPageLabels, edgeRuns } from '../src/shared/pdf-quote.js';

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
	assert.equal(escapeProse('costs $5 and $10'), 'costs \\$5 and \\$10');
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

// ---- printed page numbers ---------------------------------------------------

test('a page number in a header or footer run', () => {
	assert.deepEqual(bandNumbers('268'), [268]);
	assert.deepEqual(bandNumbers('– 268 –'), [268]);
	assert.deepEqual(bandNumbers('268  ECONOMICS AND PHILOSOPHY'), [268]);
	assert.deepEqual(bandNumbers('JOURNAL OF PHILOSOPHY  269'), [269]);
	assert.deepEqual(bandNumbers('Downloaded from …'), []);
	assert.deepEqual(bandNumbers('12345'), [], 'five digits is not a page');
	// What EmbedPDF's text runs actually hold on the Parekh PDF.
	assert.deepEqual(bandNumbers('269\u001b\u0010'), [269]);
	assert.deepEqual(bandNumbers('267\r\n267\u0006'), [267, 267]);
	assert.deepEqual(bandNumbers('267\r\n267tly, '), [267]);
});

test('the runs that may hold a page number: the outermost lines, and the bands', () => {
	const line = (y, h = 10) => ({ y, height: h });
	// LaTeX's default article on letter (792pt): the footer's "58" at 696–705,
	// 88% of the way down — outside a 12% band — and the lowest line.
	const page = [line(72), line(86), line(100), line(600), line(614), line(696, 9)];
	assert.deepEqual(edgeRuns(page, 792, { band: 0.05 }), [0, 1, 4, 5], 'two lines each end, the footer among them');
	// Two runs on one line count as one line.
	const twoRuns = [line(72), line(73, 8), line(300), line(400), line(500), line(696)];
	assert.deepEqual(edgeRuns(twoRuns, 792, { band: 0, lines: 1 }), [0, 1, 5]);
	// The band still counts, whatever the lines.
	assert.deepEqual(edgeRuns([line(50), line(60), line(300), line(400), line(500), line(780)], 792, { lines: 1 }), [0, 1, 5]);
	assert.deepEqual(edgeRuns([], 792), []);
});

test('the offset is accepted only when the pages agree', () => {
	// The Parekh shape: PDF page 2 prints 268, page 3 prints 269, …
	const pages = [{ page: 1, numbers: [] }, { page: 2, numbers: [268] }, { page: 3, numbers: [269, 2001] }, { page: 4, numbers: [270] }, { page: 5, numbers: [271] }];
	assert.equal(textPageOffset(pages), 266);
	// A year in every running header agrees with no page.
	assert.equal(textPageOffset([{ page: 2, numbers: [2001] }, { page: 3, numbers: [2001] }, { page: 4, numbers: [2001] }]), null);
	// Two numbers that disagree say nothing.
	assert.equal(textPageOffset([{ page: 2, numbers: [268] }, { page: 3, numbers: [12] }]), null);
	// Too little to go on.
	assert.equal(textPageOffset([{ page: 2, numbers: [268] }]), null);
	assert.equal(textPageOffset([]), null);
	// Printed equals PDF page: offset 0, said as such.
	assert.equal(textPageOffset([{ page: 1, numbers: [1] }, { page: 2, numbers: [2] }, { page: 3, numbers: [3] }]), 0);
});

test('page labels are cleaned — the shapes measured on the owner\'s PDFs', () => {
	assert.equal(cleanPageLabel('p. 524'), '524', 'JSTOR');
	assert.equal(cleanPageLabel('p. [523]'), '523', 'JSTOR, a number the page does not print');
	assert.equal(cleanPageLabel('[1]'), '1');
	assert.equal(cleanPageLabel('xiv'), 'xiv');
	assert.equal(cleanPageLabel('S12'), 'S12');
	assert.equal(cleanPageLabel('image 1'), null, 'a scan\'s image number is no page');
	assert.equal(cleanPageLabel(''), null);
	assert.equal(cleanPageLabel(null), null);
});

test('a label set that says nothing is none', () => {
	assert.equal(usefulPageLabels(null), null);
	assert.equal(usefulPageLabels(['1', '2', '3']), null, '1…N from the first page (Akerlof and Kranton, the Davis PDF)');
	assert.equal(usefulPageLabels(['[1]', '2', '3']), null);
	assert.equal(usefulPageLabels(['image 1', 'image 2']), null);
	assert.deepEqual(usefulPageLabels(['p. [523]', 'p. 524', 'p. 525', 'p. 525']), ['523', '524', '525', '525']);
	assert.deepEqual(usefulPageLabels(['i', 'ii', '1', '2']), ['i', 'ii', '1', '2']);
});

test('the printed page: by hand, then what the pages print, then labels, then the PDF page', () => {
	assert.deepEqual(printedPage({ pdfPage: 2, label: '505' }), { printed: '505', source: 'label' });
	assert.deepEqual(printedPage({ pdfPage: 5, label: 'xiv' }), { printed: 'xiv', source: 'label' });
	assert.deepEqual(printedPage({ pdfPage: 2, label: 'p. 505' }), { printed: '505', source: 'label' }, 'cleaned here too');
	assert.deepEqual(printedPage({ pdfPage: 2, label: null, textOffset: 266 }), { printed: '268', source: 'text' });
	assert.deepEqual(printedPage({ pdfPage: 2, meta: { offset: 266, offsetSource: 'text' } }), { printed: '268', source: 'text' });
	assert.deepEqual(printedPage({ pdfPage: 2, label: '524', meta: { offset: 10, offsetSource: 'manual' } }), { printed: '12', source: 'manual' });
	assert.deepEqual(printedPage({ pdfPage: 2 }), { printed: '2', source: 'pdf' });
	assert.deepEqual(printedPage({ pdfPage: 2, label: '  ' }), { printed: '2', source: 'pdf' }, 'an empty label is none');
});

test('a numeric label the pages contradict loses; one they confirm, or a roman one, stands', () => {
	// "Identity, Supervision, and Work Groups" (JSTOR): page 2 prints 213,
	// page 3 prints 214 — offset 211 — but page 2 is labelled "p. 214".
	assert.deepEqual(printedPage({ pdfPage: 2, label: '214', textOffset: 211 }), { printed: '213', source: 'text' });
	assert.deepEqual(printedPage({ pdfPage: 2, label: '213', textOffset: 211 }), { printed: '213', source: 'label' });
	// A book: roman front matter labelled, the arabic run offset by 12.
	assert.deepEqual(printedPage({ pdfPage: 4, label: 'iv', textOffset: -12 }), { printed: 'iv', source: 'label' });
	// The pages' own word outranks a remembered one.
	assert.deepEqual(printedPage({ pdfPage: 2, textOffset: 211, meta: { offset: 5, offsetSource: 'text' } }), { printed: '213', source: 'text' });
});

test('the block cites the printed page and links the PDF page', () => {
	assert.equal(
		quoteBlock({ text: 'Text.', page: 2, printed: '268', link: 'Parekh.pdf', key: 'parekh:2001' }),
		'> Text.\n>\n> \\cite[p. 268]{parekh:2001} · [[Parekh.pdf#page=2|PDF p. 2]]',
	);
	assert.equal(
		quoteBlock({ text: 'Text.', page: 2, printed: '268', link: 'Parekh.pdf', key: 'parekh:2001', pandoc: true }),
		'> Text.\n>\n> [@parekh:2001, p. 268] · [[Parekh.pdf#page=2|PDF p. 2]]',
	);
	assert.equal(
		quoteBlock({ text: 'Text.', page: 2, printed: '268', link: 'Parekh.pdf' }),
		'> Text.\n>\n> p. 268 · [[Parekh.pdf#page=2|PDF p. 2]]',
		'without a citation the printed page still shows',
	);
	assert.equal(quoteBlock({ text: 'Text.', page: 7, printed: '7', link: 'x.pdf' }), '> Text.\n>\n> [[x.pdf#page=7|PDF p. 7]]');
});
