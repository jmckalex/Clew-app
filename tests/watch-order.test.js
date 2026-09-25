// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// WHAT the watcher spends its descriptor budget on, and in what order
// (src/main/fs-utils.js). The owner's policy, 2026-09-25: markdown first,
// then the other document types that need watching, then everything else
// breadth-first.
//
// The budget alone was not enough, and the measurement is the reason this
// file exists: chokidar walks in directory order, so in the owner's
// ph226-426 the whole budget went inside a font icon set after SIX of the
// vault's eighty-one notes were watched. Ordering the claim ourselves takes
// that to 81 of 81 — the numbers are in the handover.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchTier, watchOrder, watchPlan, WATCH_TIER } from '../src/main/fs-utils.js';

test('markdown is the first tier — that is what the app is for', () => {
	assert.equal(watchTier('Note.md'), WATCH_TIER.NOTE);
	assert.equal(watchTier('Folder/Deep/Note.jmd'), WATCH_TIER.NOTE);
	assert.equal(watchTier('SHOUTING.MD'), WATCH_TIER.NOTE);
	// A drawing is named `.excalidraw.md`, and it IS a note — the plugin's
	// format keeps the markdown wrapper, so the indexer reads it.
	assert.equal(watchTier('Drawings/Plan.excalidraw.md'), WATCH_TIER.NOTE);
});

test('the second tier is documents Clew EDITS, not everything it can show', () => {
	// The distinction that keeps the tier small: a change to one of these
	// has a tab or a render waiting for it.
	for (const rel of ['Board.canvas', 'Views.base', 'refs.bib', 'paper.pdf',
		'Notes/report.docx', 'data/sheet.xlsx', 'talk.pptx', 'x.odt', 'y.ods', 'z.odp',
		'Drawings/Sketch.excalidraw']) {
		assert.equal(watchTier(rel), WATCH_TIER.DOCUMENT, rel);
	}
});

test('images and media are NOT a tier — that is the heuristic', () => {
	// Giving every image a high tier hands the budget straight back to the
	// font icon set that caused the problem: 20,000 .svg files are 20,000
	// images. Depth sorts them out instead (the test below).
	for (const rel of ['Attachments/photo.png', 'Media/talk.mp4', 'icons/sim-card.svg',
		'libs/reveal/reveal.js', 'build/out.css', 'notes.txt', 'archive.zip']) {
		assert.equal(watchTier(rel), WATCH_TIER.OTHER, rel);
	}
});

test('every note beats every document, and every document beats the rest', () => {
	const order = watchOrder([
		'libs/a/b/c/icon.svg', 'Attachments/photo.png', 'refs.bib',
		'Deep/Deeper/Deepest/Note.md', 'Board.canvas', 'Note.md',
	]);
	assert.deepEqual(order, [
		'Note.md', 'Deep/Deeper/Deepest/Note.md',   // tier 0, shallow first
		'Board.canvas', 'refs.bib',                  // tier 1
		'Attachments/photo.png', 'libs/a/b/c/icon.svg', // tier 2, breadth-first
	]);
});

test('within a tier the walk is breadth-first, not depth-first', () => {
	// The whole point: a vault's own attachments sit beside or just below
	// its notes, a vendored library is five folders down. Depth is what
	// tells them apart without naming either.
	const order = watchOrder([
		'a/b/c/d/e/deep.png', 'top.png', 'a/b/mid.png', 'a/one.png',
	]);
	assert.deepEqual(order, ['top.png', 'a/one.png', 'a/b/mid.png', 'a/b/c/d/e/deep.png']);
});

test('at equal depth, a file Clew has a use for goes first', () => {
	const order = watchOrder(['Attachments/notes.bak', 'Attachments/photo.png', 'Attachments/clip.mp4']);
	assert.equal(order.at(-1), 'Attachments/notes.bak');
});

test('a plan claims ancestors with each file — a file without them is unreachable', () => {
	// chokidar cannot descend into a directory it was told to ignore, so a
	// planned file whose parents were not bought would never be watched.
	const { admit } = watchPlan(['a/b/Note.md']);
	assert.deepEqual([...admit].sort(), ['a', 'a/b', 'a/b/Note.md']);
});

test('a directory is paid for once, however many of its files are claimed', () => {
	let charged = 0;
	watchPlan(['a/b/One.md', 'a/b/Two.md', 'a/b/Three.md'], () => (charged++, true));
	assert.equal(charged, 5); // a, a/b, and the three notes
});

test('the budget is spent from the front of the list, and the rest is counted', () => {
	// 'a' + 'a/Note.md' + 'Deep.md' = 3 units; the two images do not fit.
	let left = 3;
	const { admit, skipped, firstSkipped } = watchPlan(
		['big/pile/one.png', 'big/pile/two.png', 'a/Note.md', 'Deep.md'],
		() => (left > 0 ? (left--, true) : false));
	assert.deepEqual([...admit].sort(), ['Deep.md', 'a', 'a/Note.md']);
	assert.equal(skipped, 2);
	assert.equal(firstSkipped, 'big/pile/one.png', 'the message names what went unwatched');
});

test('a tiny budget still buys notes before anything else', () => {
	// The regression that matters: ph226-426 watched six of its notes and
	// spent the rest inside an icon set. Here the icon set is 500 files and
	// the budget is 4 — the notes must still win.
	const files = ['x.md', 'y/z.md'];
	for (let i = 0; i < 500; i++) files.push(`libs/icons/set/i${i}.svg`);
	let left = 4;
	const { admit } = watchPlan(files, () => (left > 0 ? (left--, true) : false));
	assert.ok(admit.has('x.md'));
	assert.ok(admit.has('y/z.md'));
	assert.equal([...admit].filter((p) => p.endsWith('.svg')).length, 0);
});

test('a budget that fits everything admits everything', () => {
	// The ordinary vault, which must not pay anything for this machinery.
	const files = ['One.md', 'Folder/Two.md', 'Attachments/p.png', 'refs.bib'];
	const { admit, skipped, firstSkipped } = watchPlan(files);
	for (const f of files) assert.ok(admit.has(f), f);
	assert.equal(skipped, 0);
	assert.equal(firstSkipped, null);
});
