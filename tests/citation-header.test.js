// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// A note's citation keys, for the blocks rendered on its behalf (src/main/citation-header.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citationHeader } from '../src/main/citation-header.js';

const note = (header, body = '# Note\n\n![[Child]]\n') => `---\n${header}\n---\n${body}`;

test('the citation keys travel, the bibliography made absolute against the note', () => {
	assert.equal(
		citationHeader(note('Bibliography: refs.bib\nResolve citations: true\nBibliography style: chicago'), '/vault/Papers'),
		'---\nBibliography: /vault/Papers/refs.bib\nResolve citations: true\nBibliography style: chicago\n---\n');
});

test('nothing else in the header travels (a title or banner would draw in every frame)', () => {
	assert.equal(citationHeader(note('title: A paper\nheader-image: "[[x.png]]"\ntags: [a, b]'), '/v'), '');
	assert.equal(citationHeader(note('title: A\nBibliography: ../refs.bib'), '/v/sub'), '---\nBibliography: /v/refs.bib\n---\n');
});

test('no header, or one not at the very top, gives nothing', () => {
	assert.equal(citationHeader('# Note\n\nBibliography: refs.bib\n', '/v'), '');
	assert.equal(citationHeader('Intro\n---\nBibliography: refs.bib\n---\n', '/v'), '');
});

test('keys match however they are spelled: case, spaces, underscores', () => {
	assert.equal(citationHeader(note('resolve_citations: true\nPANDOC CITATIONS: true'), '/v'),
		'---\nResolve citations: true\nPandoc citations: true\n---\n');
});

test('quotes, lists, absolute paths and URLs', () => {
	assert.equal(citationHeader(note('Bibliography: "refs.bib"'), '/v'), '---\nBibliography: /v/refs.bib\n---\n');
	assert.equal(citationHeader(note('Bibliography: a.bib, /abs/b.bib, https://x.org/c.bib'), '/v'),
		'---\nBibliography: /v/a.bib, /abs/b.bib, https://x.org/c.bib\n---\n');
	assert.equal(citationHeader(note('Bibliography style: styles/apa.csl'), '/v'), '---\nBibliography style: /v/styles/apa.csl\n---\n');
	assert.equal(citationHeader(note('Bibliography style: "chicago"'), '/v'), '---\nBibliography style: chicago\n---\n');
});
