// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Book mode's pure half (shared/book.js) and its two places in main: the
// index (a master carries its chapters, resolved; no other entry changes)
// and renames (a chapter list keeps up). docs/dev/book-mode.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	readMaster, laterNotice, masterIndexEntry, chapterTitle, countWords, chapterStatus,
	booksOf, mastersOf, currentBook, moveChapter, withChapters, chapterLink, placeWarnings,
} from '../src/shared/book.js';
import { extractNoteMetadata } from '../src/shared/note-metadata.js';
import { Indexer } from '../src/main/indexer.js';
import { propagateRename } from '../src/main/rename-links.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-book-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const MASTER = `---
book: true
title: Evolution of the Social Contract
numbering: per chapter
chapters:
  - "[[Sex and Justice]]"
  - "[[Essays/Fairness|Fair]]"
  - "[[Mutual Aid]]"
bibliography: Library/skyrms.bib
---

For my teachers.
`;

test('a master: title, numbering, chapters as written; anything else is not a master', () => {
	const m = readMaster(MASTER);
	assert.equal(m.title, 'Evolution of the Social Contract');
	assert.equal(m.numbering, 'per chapter');
	assert.deepEqual(m.chapters.map((c) => c.target), ['Sex and Justice', 'Essays/Fairness', 'Mutual Aid']);
	assert.deepEqual([m.later, m.problems, m.clean], [[], [], true]);
	assert.equal(readMaster('# Just a note\n'), null);
	assert.equal(readMaster('---\nbook: yes\nchapters: ["[[A]]"]\n---\n'), null, 'book must be true');
	assert.equal(readMaster('---\ntitle: x\n---\n'), null);
	assert.equal(readMaster('---\nbook: true\nchapters:\n---\n').chapters.length, 0, 'a master with no chapters yet');
	assert.equal(readMaster('---\nbook: true\nauthor: Austen\n---\nMy notes on a novel.\n'), null, 'book: true with no chapters key is not a master');
	assert.equal(masterIndexEntry('---\nbook: true\n---\n'), null);
});

test('a master read by name: continuous numbering, problems and what comes later', () => {
	const m = readMaster('---\nbook: true\nnumbering: Continuous\nchapters:\n  - [[A]]\n  - Plain words\n  - "[[a.md]]"\n  - "[[B#Intro]]"\nparts:\n  - x\nappendices:\n  - "[[P]]"\n---\n');
	assert.equal(m.numbering, 'continuous');
	assert.deepEqual(m.chapters.map((c) => c.target), ['A', 'B']);
	assert.deepEqual(m.problems, [
		'chapters: "Plain words" is not a [[link]] to a note',
		'chapters: [[a.md]] is listed twice — the second is left out',
	]);
	assert.deepEqual(m.later, ['parts', 'appendices']);
	assert.equal(laterNotice(m.later), 'Parts and appendices are not supported yet — the book is built from its chapters.');
	assert.equal(laterNotice(['front matter']), 'Front matter is not supported yet — the book is built from its chapters.');
	assert.equal(laterNotice(['parts']), 'Parts are not supported yet — the book is built from its chapters.');
	assert.equal(laterNotice([]), null);
	assert.match(readMaster('---\nbook: true\nnumbering: by part\nchapters:\n---\n').problems[0], /numbering "by part" is not/);
});

test('the index keeps a master’s title and chapters — and nothing new for any other note', () => {
	assert.deepEqual(masterIndexEntry(MASTER), {
		title: 'Evolution of the Social Contract',
		chapters: [{ target: 'Sex and Justice' }, { target: 'Essays/Fairness' }, { target: 'Mutual Aid' }],
	});
	assert.equal(masterIndexEntry('---\ntags: [a]\n---\n# Hi\n'), null);
	assert.equal('book' in extractNoteMetadata(MASTER), false, 'the extractor itself is unchanged');
});

test('a chapter’s title: its first # heading, else its title, else its file name', () => {
	assert.equal(chapterTitle('---\ntitle: FM\n---\n\nText.\n\n## Sub\n\n# The Stag Hunt {#ch:stag}\n', 'x/Ch.md'), 'The Stag Hunt');
	assert.equal(chapterTitle('```\n# not a heading\n```\n\n## Only a section\n', 'x/Ch.md'), 'Ch');
	assert.equal(chapterTitle('---\ntitle: Front Title\n---\nText.\n', 'x/Ch.md'), 'Front Title');
	assert.equal(chapterTitle('Text only.\n', 'Essays/Mutual Aid.md'), 'Mutual Aid');
});

test('a chapter’s words: prose only — not front matter, code, maths or comments', () => {
	const text = '---\ntitle: Many words here\nstatus: draft\n---\n# One two\n\nThree four’s five-six $x + y$.\n\n```\ncode code code\n```\n\n<!-- hidden words -->%%more hidden%% seven\n';
	assert.equal(countWords(text), 6);
	assert.equal(countWords(''), 0);
});

test('a chapter’s status: draft, revised or done — anything else is none', () => {
	assert.equal(chapterStatus('---\nstatus: Revised\n---\n'), 'revised');
	assert.equal(chapterStatus('---\nstatus: to-read\n---\n'), null);
	assert.equal(chapterStatus('No front matter.\n'), null);
});

test('which books a note is in, and which one it shows (built or opened last)', () => {
	const index = {
		'Notes/A.md': {},
		'Course 2.md': { book: { title: 'Course 2', chapters: [{ target: 'B', resolved: 'Notes/B.md' }, { target: 'A', resolved: 'Notes/A.md' }] } },
		'Course 1.md': { book: { title: null, chapters: [{ target: 'A', resolved: 'Notes/A.md' }, { target: 'Gone', resolved: null }] } },
	};
	assert.deepEqual(mastersOf(index), ['Course 1.md', 'Course 2.md']);
	assert.deepEqual(booksOf(index, 'Notes/A.md'), [
		{ master: 'Course 1.md', title: 'Course 1', number: 1, count: 2 },
		{ master: 'Course 2.md', title: 'Course 2', number: 2, count: 2 },
	]);
	assert.deepEqual(booksOf(index, 'Notes/C.md'), []);
	assert.equal(currentBook(index, 'Notes/A.md').master, 'Course 1.md');
	const recent = currentBook(index, 'Notes/A.md', 'Course 2.md');
	assert.deepEqual([recent.master, recent.number, recent.also.map((b) => b.master)], ['Course 2.md', 2, ['Course 1.md']]);
	assert.equal(currentBook(index, 'Notes/A.md', 'Elsewhere.md').master, 'Course 1.md', 'a recent book the note is not in is ignored');
	assert.equal(currentBook(index, 'Notes/C.md'), null);
});

test('reordering and rewriting the chapter list', () => {
	assert.deepEqual(moveChapter(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
	assert.deepEqual(moveChapter(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
	assert.deepEqual(moveChapter(['a', 'b'], 5, 0), ['a', 'b']);
	const next = withChapters(MASTER, ['[[Mutual Aid]]', '[[Sex and Justice]]']);
	assert.equal(next, MASTER.replace('  - "[[Sex and Justice]]"\n  - "[[Essays/Fairness|Fair]]"\n  - "[[Mutual Aid]]"\n', '  - "[[Mutual Aid]]"\n  - "[[Sex and Justice]]"\n'));
	assert.equal(withChapters('---\nbook: true\n# a comment\nchapters:\n  - "[[B]]"\n---\n', ['[[A]]']), null, 'unclean front matter is never rewritten');
	assert.equal(chapterLink('Essays/Fairness.md', true), '[[Fairness]]');
	assert.equal(chapterLink('Essays/Fairness.md', false), '[[Essays/Fairness]]');
});

function vaultWith(files) {
	const root = fs.mkdtempSync(path.join(tmpRoot, 'vault-'));
	for (const [rel, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), text);
	}
	return root;
}

test('the indexer: a master’s chapters resolved, dangling ones null, other notes as before', () => {
	const root = vaultWith({
		'Book.md': MASTER,
		'Chapters/Sex and Justice.md': '# Sex and Justice\n',
		'Essays/Fairness.md': '# Fairness\n',
		'Plain.md': '---\ntags: [x]\n---\nSee [[Fairness]].\n',
	});
	const indexer = new Indexer();
	indexer.restricted = false;
	indexer.openVault(root);
	try {
		const book = indexer.notes.get('Book.md').book;
		assert.deepEqual(book.chapters.map((c) => c.resolved), ['Chapters/Sex and Justice.md', 'Essays/Fairness.md', null]);
		assert.equal('book' in indexer.notes.get('Plain.md'), false);
		// A chapter created later resolves on the structure change.
		fs.writeFileSync(path.join(root, 'Mutual Aid.md'), '# Mutual Aid\n');
		indexer.onStructureChanged();
		assert.equal(indexer.notes.get('Book.md').book.chapters[2].resolved, 'Mutual Aid.md');
	} finally {
		indexer.closeVault();
	}
});

test('a renamed chapter is renamed in its master’s front matter', () => {
	const root = vaultWith({
		'Book.md': MASTER,
		'Chapters/Sex and Justice.md': '# Sex and Justice\n',
		'Essays/Fairness.md': '# Fairness\n',
		'Mutual Aid.md': '# Mutual Aid\n',
	});
	const indexer = new Indexer();
	indexer.restricted = false;
	indexer.openVault(root);
	const vaults = {
		root,
		restricted: false,
		excludes: { isUnindexed: () => false },
		resolve: (rel) => path.join(root, rel),
	};
	try {
		fs.renameSync(path.join(root, 'Essays/Fairness.md'), path.join(root, 'Essays/Justice as Fairness.md'));
		fs.renameSync(path.join(root, 'Mutual Aid.md'), path.join(root, 'Mutual Help.md'));
		const one = propagateRename({ oldRel: 'Essays/Fairness.md', newRel: 'Essays/Justice as Fairness.md', indexer, vaults });
		const two = propagateRename({ oldRel: 'Mutual Aid.md', newRel: 'Mutual Help.md', indexer, vaults });
		assert.deepEqual([one.rewrittenLinks, two.rewrittenLinks], [1, 1]);
		const text = fs.readFileSync(path.join(root, 'Book.md'), 'utf8');
		assert.match(text, /- "\[\[Essays\/Justice as Fairness\|Fair\]\]"\n {2}- "\[\[Mutual Help\]\]"/);
		assert.equal(readMaster(text).chapters.length, 3);
	} finally {
		indexer.closeVault();
	}
});

test('a book build’s warnings placed in their chapters, at their lines', () => {
	const chapters = new Map([
		['Senders and Receivers.md', 'Books/Signals/Senders and Receivers.md'],
		['../Shared/Intro.md', 'Books/Shared/Intro.md'],
		['Intro.md', 'Books/Signals/Intro.md'],
	]);
	assert.deepEqual(placeWarnings([
		'Senders and Receivers.md:12: book: a second # heading starts a new chapter',
		'../Shared/Intro.md: book: front matter key "Bibliography style" is not applied in a book',
		'Intro.md:3: latex-export [unicode]: “x” needs a Unicode engine',
		'book: the master\'s `@chapter+` lines are ignored — the chapters were given by the host',
		'Elsewhere.md:4: not one of ours',
	], chapters, 'Books/Signals/Signals.md'), [
		{ path: 'Books/Signals/Senders and Receivers.md', line: 12, text: 'book: a second # heading starts a new chapter' },
		{ path: 'Books/Shared/Intro.md', line: null, text: 'book: front matter key "Bibliography style" is not applied in a book' },
		{ path: 'Books/Signals/Intro.md', line: 3, text: 'latex-export [unicode]: “x” needs a Unicode engine' },
		{ path: 'Books/Signals/Signals.md', line: null, text: 'book: the master\'s `@chapter+` lines are ignored — the chapters were given by the host' },
		{ path: 'Books/Signals/Signals.md', line: null, text: 'Elsewhere.md:4: not one of ours' },
	]);
	assert.deepEqual(placeWarnings(undefined, chapters, 'M.md'), []);
});
