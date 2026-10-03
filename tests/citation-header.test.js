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
import { citationHeader, noteBibFiles, bibliographyDirs, bibliographyList } from '../src/main/citation-header.js';

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

test('noteBibFiles: the header\'s bibliography ADDS to the vault\'s (jmarkdown 909af7a)', () => {
	const note = '---\nBibliography: refs.bib, ../shared/more.bib\nResolve citations: true\n---\n# N\n\nNo cites at all.';
	assert.deepEqual(noteBibFiles(note, '/v/Notes', '/v/vault.bib'), ['/v/vault.bib', '/v/Notes/refs.bib', '/v/shared/more.bib'],
		'the configured file first, then the note\'s, against its folder');
	assert.deepEqual(noteBibFiles(note, '/v/Notes', ''), ['/v/Notes/refs.bib', '/v/shared/more.bib'], 'no vault bibliography: the note\'s');
	assert.deepEqual(noteBibFiles('---\nBibliography: https://example.org/x.bib\n---\n', '/v', ''), [], 'a URL is no file to watch');
	assert.deepEqual(noteBibFiles('---\nBibliography: /v/vault.bib\n---\n\\cite{a}', '/v', '/v/vault.bib'), ['/v/vault.bib'], 'named twice, kept once');
});

test('noteBibFiles: `Bibliography mode: replace` is the note\'s alone', () => {
	const note = '---\nBibliography: refs.bib\nBibliography mode: replace\n---\n\\cite{a}';
	assert.deepEqual(noteBibFiles(note, '/v/Notes', '/v/vault.bib'), ['/v/Notes/refs.bib']);
	assert.deepEqual(noteBibFiles('---\nBibliography_mode: Replace\n---\n\\cite{a}', '/v', '/v/vault.bib'), ['/v/vault.bib'],
		'replace with no Bibliography of its own: the configured one (the engine says so too)');
});

test('a Bibliography written as a YAML list, over several lines', () => {
	const note = '---\nBibliography:\n  - local.bib\n  - ../Library/vault2.bib\nResolve citations: true\n---\n# L';
	assert.deepEqual(noteBibFiles(note, '/v/Notes', ''), ['/v/Notes/local.bib', '/v/Library/vault2.bib']);
	assert.equal(citationHeader(note, '/v/Notes'), '---\nBibliography: /v/Notes/local.bib, /v/Library/vault2.bib\nResolve citations: true\n---\n');
	assert.deepEqual(noteBibFiles('---\nBibliography: [a.bib, "b.bib"]\n---\n', '/v', ''), ['/v/a.bib', '/v/b.bib']);
});

test('bibliographyDirs: every folder a LaTeX export\'s bibliographies live in', () => {
	const note = '---\nBibliography: local2.bib, ../Library/vault2.bib\n---\n';
	assert.deepEqual(bibliographyDirs(note, '/v/Notes', ['/v/Library/vault.bib', '/home/me/master.bib']), ['/v/Notes', '/v/Library', '/home/me']);
	assert.deepEqual(bibliographyDirs('# none', '/v/Notes'), ['/v/Notes']);
});

test('bibliographyList reads a value as the engine does', async () => {
	const { parseBibliographyList } = await import('#jmarkdown/bibliographies.js');
	for (const value of ['refs.bib', 'a.bib, b.bib', '[a.bib, "b.bib"]', 'a.bib\n- b.bib\n  - c.bib', "'q.bib' ,, ", ['x.bib', 'y.bib, z.bib'], '', null]) {
		assert.deepEqual(bibliographyList(value), parseBibliographyList(value), JSON.stringify(value));
	}
});

test('noteBibFiles: the vault\'s bibliography only for a note that cites', () => {
	assert.deepEqual(noteBibFiles('See \\cite{a} and \\citep[p. 2]{b}.', '/v', '/v/refs.bib'), ['/v/refs.bib']);
	assert.deepEqual(noteBibFiles('\\fullcite{a}', '/v', '/v/refs.bib'), ['/v/refs.bib']);
	assert.deepEqual(noteBibFiles('# Refs\n\n@bibliography\n', '/v', '/v/refs.bib'), ['/v/refs.bib']);
	assert.deepEqual(noteBibFiles('Plain prose that excites nobody.', '/v', '/v/refs.bib'), []);
	assert.deepEqual(noteBibFiles('\\cite{a}', '/v', ''), [], 'no bibliography anywhere: nothing to depend on');
});

test('noteBibFiles: pandoc forms count only where the vault turns them on', () => {
	assert.deepEqual(noteBibFiles('As [@lewis1969] says.', '/v', '/v/refs.bib'), []);
	assert.deepEqual(noteBibFiles('As [@lewis1969] says.', '/v', '/v/refs.bib', { pandoc: true }), ['/v/refs.bib']);
	assert.deepEqual(noteBibFiles('@lewis1969 argues so.', '/v', '/v/refs.bib', { pandoc: true }), ['/v/refs.bib']);
});

