// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// "Export notes as PDF (reading view)" (src/main/print-batch.js): which notes
// it prints, each PDF's name under the folder chosen, and the loop — one note
// at a time, a failure the note's alone, a stop leaving the rest unbegun. The
// printing itself is smoke/print-batch-scenario.js's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrintableNote, commonFolder, batchPdfNames, runPrintBatch } from '../src/main/print-batch.js';

test('a printable note is .md or .jmd, never a drawing', () => {
	assert.deepEqual(['a.md', 'b.JMD', 'c.excalidraw.md', 'd.canvas', 'e.pdf', 'f.md.txt'].filter(isPrintableNote), ['a.md', 'b.JMD']);
});

test('the folder every note is in', () => {
	assert.equal(commonFolder([]), '');
	assert.equal(commonFolder(['Essays/Ann.md']), 'Essays');
	assert.equal(commonFolder(['Essays/Ann.md', 'Essays/Ben.md']), 'Essays');
	assert.equal(commonFolder(['Essays/Week 1/Ann.md', 'Essays/Week 2/Ann.md']), 'Essays');
	assert.equal(commonFolder(['Essays/Ann.md', 'Other.md']), '');
	assert.equal(commonFolder(['Essays/Ann.md', 'Essays2/Ben.md']), '', 'by whole folder names, not a common prefix');
});

test('each PDF is named from the notes\' common folder, its subfolders kept', () => {
	assert.deepEqual(batchPdfNames(['Essays/Ann.md', 'Essays/Ben.jmd', 'Essays/Late/Cat.md']), [
		{ path: 'Essays/Ann.md', name: 'Ann.pdf' },
		{ path: 'Essays/Ben.jmd', name: 'Ben.pdf' },
		{ path: 'Essays/Late/Cat.md', name: 'Late/Cat.pdf' },
	]);
	assert.deepEqual(batchPdfNames(['Essays/Week 1/Ann.md', 'Essays/Week 2/Ann.md']).map((p) => p.name),
		['Week 1/Ann.pdf', 'Week 2/Ann.pdf'], 'one name in two folders: two PDFs');
	assert.deepEqual(batchPdfNames(['Top.md', 'Essays/Ann.md']).map((p) => p.name), ['Top.pdf', 'Essays/Ann.pdf']);
});

test('a name two notes would share is numbered — a Mac\'s disk ignores case', () => {
	assert.deepEqual(batchPdfNames(['N/a.md', 'N/a.jmd', 'N/A.md']).map((p) => p.name), ['a.pdf', 'a 2.pdf', 'A 3.pdf']);
});

test('Keep Both: a name a file already has is numbered too; without it the file is replaced', () => {
	const there = new Set(['Ann.pdf', 'Ann 2.pdf']);
	assert.deepEqual(batchPdfNames(['E/Ann.md', 'E/Ben.md'], { taken: (n) => there.has(n) }).map((p) => p.name), ['Ann 3.pdf', 'Ben.pdf']);
	assert.deepEqual(batchPdfNames(['E/Ann.md', 'E/Ben.md']).map((p) => p.name), ['Ann.pdf', 'Ben.pdf']);
});

test('the loop: one at a time, in order, a failure the note\'s alone', async () => {
	const plan = batchPdfNames(['E/Ann.md', 'E/Ben.md', 'E/Cat.md']);
	const heard = [];
	let printing = 0;
	let most = 0;
	const result = await runPrintBatch({
		plan,
		progress: (p) => heard.push([p.done, p.total, p.path]),
		print: async (item) => {
			printing += 1;
			most = Math.max(most, printing);
			await new Promise((r) => setTimeout(r, 2));
			printing -= 1;
			if (item.path === 'E/Ben.md') throw new Error('the printer returned an empty document');
		},
	});
	assert.equal(most, 1, 'never two at once');
	assert.deepEqual(result, {
		written: ['Ann.pdf', 'Cat.pdf'],
		failed: [{ path: 'E/Ben.md', error: 'the printer returned an empty document' }],
		stopped: [],
	});
	assert.deepEqual(heard, [[0, 3, 'E/Ann.md'], [1, 3, 'E/Ben.md'], [2, 3, 'E/Cat.md'], [3, 3, null]]);
});

test('a stop: the note being printed finishes, the rest are not begun', async () => {
	let stop = false;
	const result = await runPrintBatch({
		plan: batchPdfNames(['E/Ann.md', 'E/Ben.md', 'E/Cat.md']),
		stopped: () => stop,
		print: async () => { stop = true; },
	});
	assert.deepEqual(result, { written: ['Ann.pdf'], failed: [], stopped: ['E/Ben.md', 'E/Cat.md'] });
});
