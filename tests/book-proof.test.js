// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// "Proof this chapter" (src/main/book-proof.js; jmarkdown cf5ed60's include
// layout): the chapter files' names as the engine writes them, whether a full
// run exists to number a proof from, and what a proof starts from.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fullRunFile, chapterIncludeName, fullRunRecord, proofReadiness, copyFullRun } from '../src/main/book-proof.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-book-proof-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let n = 0;
const fresh = () => {
	const dir = path.join(root, String(++n));
	fs.mkdirSync(dir, { recursive: true });
	return dir;
};

test('a chapter file is named as the engine names it (vendored book-latex.js)', () => {
	const engine = fs.readFileSync(new URL('../vendor/jmarkdown/src/book-latex.js', import.meta.url), 'utf8');
	assert.ok(engine.includes("const base = path.basename(outFile).replace(/\\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-');"), 'the engine\'s base rule');
	assert.ok(engine.includes('return `${base}-ch-${n}`;'), 'the engine\'s chapter suffix');
	assert.equal(chapterIncludeName('/v/build/Big.tex', 1), 'Big-ch-1');
	assert.equal(chapterIncludeName('/v/build/Signals: A Short Book.tex', 12), 'Signals-A-Short-Book-ch-12');
});

test('the record of a full run is hidden beside it, and says what it typeset', () => {
	assert.equal(fullRunFile('/v/build', 'Big'), '/v/build/.Big-full-run.json');
	const record = fullRunRecord(['A.md', 'B.md'], new Date('2026-10-10T12:00:00Z'));
	assert.deepEqual(record, { chapters: ['A.md', 'B.md'], at: '2026-10-10T12:00:00.000Z' });
});

test('proofReadiness: no full run yet, said plainly', () => {
	const dir = fresh();
	const r = proofReadiness({ tex: path.join(dir, 'Big.tex'), names: ['A.md'], title: 'Big', outDir: dir, base: 'Big' });
	assert.equal(r.ok, false);
	assert.equal(r.why, 'none');
	assert.match(r.message, /^No full PDF of Big yet\. Build Big as PDF once/);
});

test('proofReadiness: the chapters changed since the full run', () => {
	const dir = fresh();
	fs.writeFileSync(fullRunFile(dir, 'Big'), JSON.stringify(fullRunRecord(['A.md', 'B.md'])));
	const r = proofReadiness({ tex: path.join(dir, 'Big.tex'), names: ['B.md', 'A.md'], title: 'Big', outDir: dir, base: 'Big' });
	assert.equal(r.why, 'changed');
	assert.match(r.message, /have changed since its last full PDF/);
});

test('proofReadiness: a full run whose .aux files are gone; then ready', () => {
	const dir = fresh();
	const tex = path.join(dir, 'Big.tex');
	fs.writeFileSync(fullRunFile(dir, 'Big'), JSON.stringify(fullRunRecord(['A.md', 'B.md'])));
	fs.writeFileSync(path.join(dir, 'Big.aux'), '');
	fs.writeFileSync(path.join(dir, 'Big-ch-1.aux'), '');
	let r = proofReadiness({ tex, names: ['A.md', 'B.md'], title: 'Big', outDir: dir, base: 'Big' });
	assert.equal(r.why, 'aux');
	assert.match(r.message, /left no Big-ch-2\.aux/);
	fs.writeFileSync(path.join(dir, 'Big-ch-2.aux'), '');
	r = proofReadiness({ tex, names: ['A.md', 'B.md'], title: 'Big', outDir: dir, base: 'Big' });
	assert.equal(r.ok, true);
	assert.deepEqual(r.record.chapters, ['A.md', 'B.md']);
	fs.writeFileSync(fullRunFile(dir, 'Big'), '{not json');
	assert.equal(proofReadiness({ tex, names: ['A.md', 'B.md'], title: 'Big', outDir: dir, base: 'Big' }).why, 'none');
});

test('copyFullRun: the master\'s and every chapter\'s .aux, and the .bbl, into the proof\'s folder', () => {
	const dir = fresh();
	const work = fresh();
	const tex = path.join(dir, 'Big.tex');
	for (const f of ['Big.aux', 'Big.bbl', 'Big-ch-1.aux', 'Big-ch-2.aux', 'Big.log', 'Big-ch-1.tex']) fs.writeFileSync(path.join(dir, f), f);
	copyFullRun({ tex, names: ['A.md', 'B.md'], work });
	assert.deepEqual(fs.readdirSync(work).sort(), ['Big-ch-1.aux', 'Big-ch-2.aux', 'Big.aux', 'Big.bbl']);
	assert.equal(fs.readFileSync(path.join(work, 'Big-ch-2.aux'), 'utf8'), 'Big-ch-2.aux');
});
