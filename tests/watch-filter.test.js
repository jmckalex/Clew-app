// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The vault watcher's gate (src/main/fs-utils.js#watchFilter). It exists
// because the watcher holds one descriptor per watched FILE and the ceiling
// is a PROCESS one: past ~10,240 held descriptors libuv cannot fork, and the
// render worker IS a fork — so an unbounded watcher does not make Clew slow,
// it makes Clew unable to render, reported as `spawn EBADF` in the preview
// (the owner's ph341 vault, 2026-09-25: five presentation folders symlinking
// one 309 MB library, 100,169 descriptors held).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { watchFilter, WATCH_BUDGET, WATCH_CEILING, scanShare, knownPaths, SCAN_KEEP } from '../src/main/fs-utils.js';

const root = '/vault';
const abs = (rel) => path.join(root, rel);

test('the ignore list is applied to the VAULT-relative path, not the absolute one', () => {
	// The bug this replaces: a vault under ~/.notes tested segments of the
	// absolute path, found `.notes`, and ignored every file in it — a vault
	// that silently never updated.
	const { ignored } = watchFilter({ root: '/Users/x/.notes/vault' });
	assert.equal(ignored('/Users/x/.notes/vault/Note.md'), false);
	assert.equal(ignored('/Users/x/.notes/vault/Folder/Deep.md'), false);
	assert.equal(ignored('/Users/x/.notes/vault/.clew/cache/x.html'), true);
});

test('dotfiles and the never-shown folders are ignored', () => {
	const { ignored } = watchFilter({ root });
	for (const rel of ['.git/HEAD', 'node_modules/pkg/index.js', '.obsidian/app.json',
		'.clew/workspace.json', '.trash/old.md', 'Notes/.DS_Store']) {
		assert.equal(ignored(abs(rel)), true, rel);
	}
	for (const rel of ['Note.md', 'Folder/Note.md', 'Attachments/pic.png']) {
		assert.equal(ignored(abs(rel)), false, rel);
	}
});

test("chokidar's own bookkeeping is left alone", () => {
	// It asks about the root itself, and about the parent it watches to
	// notice the root being renamed. Neither is vault content.
	const { ignored } = watchFilter({ root });
	assert.equal(ignored(root), false);
	assert.equal(ignored('/'), false);
	assert.equal(ignored('/elsewhere'), false);
});

test('a tree reachable through several links is watched once', () => {
	// What the vault walk skipped as a duplicate (fs-utils#shouldRecurse),
	// the watcher must skip too: chokidar follows every symlink separately
	// and has no cycle guard, which is how one library tree came to be
	// watched five times over.
	const duplicates = new Set(['b/libs', 'c/libs', 'd/libs']);
	const { ignored } = watchFilter({ root, duplicates });
	assert.equal(ignored(abs('a/libs')), false); // the one the walk kept
	assert.equal(ignored(abs('b/libs')), true);
	assert.equal(ignored(abs('c/libs/css/theme.css')), true); // and everything under it
	assert.equal(ignored(abs('d/libs')), true);
});

test('the budget stops the walk and remembers where', () => {
	let budget = 3;
	const { ignored, state } = watchFilter({ root, take: () => (budget > 0 ? (budget--, true) : false) });
	assert.equal(ignored(abs('one.md')), false);
	assert.equal(ignored(abs('two.md')), false);
	assert.equal(ignored(abs('three.md')), false);
	assert.equal(ignored(abs('four.md')), true);
	assert.equal(ignored(abs('five.md')), true);
	assert.equal(state.accepted.size, 3);
	assert.equal(state.skipped, 2);
	assert.equal(state.firstSkipped, 'four.md');
});

test('a path already accepted is never charged twice', () => {
	// chokidar asks about the same path more than once — with and without a
	// stats object — and a budget that counted those twice would halve.
	let charged = 0;
	const { ignored, state } = watchFilter({ root, take: () => (charged++, true) });
	assert.equal(ignored(abs('Note.md')), false);
	assert.equal(ignored(abs('Note.md')), false);
	assert.equal(ignored(abs('Note.md')), false);
	assert.equal(charged, 1);
	assert.equal(state.accepted.size, 1);
});

test('an ignored path is not charged at all', () => {
	let charged = 0;
	const { ignored, state } = watchFilter({ root, take: () => (charged++, true) });
	ignored(abs('node_modules/a/b.js'));
	ignored(abs('.git/objects/ab/cdef'));
	assert.equal(charged, 0);
	assert.equal(state.skipped, 0); // ignored by rule is not "skipped for budget"
});

test('a spent budget must not blind the watcher to NEW files', () => {
	// The regression this pins, 2026-09-25: the budget was applied to every
	// path for the life of the session, so once a big vault had spent it, a
	// note the user created was never seen — it sat on disk while the
	// explorer refused to show it. vault.js reopens the gate (a higher
	// ceiling) once chokidar's initial scan is done; what the filter has to
	// guarantee is simply that it ASKS every time rather than remembering a
	// refusal.
	let allow = false;              // the scan has spent the budget…
	const { ignored, state } = watchFilter({ root, take: () => allow });
	assert.equal(ignored(abs('Untitled.md')), true);
	assert.equal(state.skipped, 1);
	allow = true;                   // …and then the vault settles
	assert.equal(ignored(abs('Untitled.md')), false, 'a later ask must be honoured');
	assert.ok(state.accepted.has('Untitled.md'));
});

test('with a plan, the scan holds exactly what was planned', () => {
	// The order is decided before chokidar walks (watchPlan), so the gate's
	// job during the scan is simply to honour it. Asking the budget here as
	// well would let chokidar's own walk order spend what the plan reserved
	// for notes deeper down — which is the bug the plan exists to fix.
	const admit = new Set(['Note.md', 'Folder', 'Folder/Deep.md']);
	const { ignored } = watchFilter({ root, admit, take: () => true });
	assert.equal(ignored(abs('Note.md')), false);
	assert.equal(ignored(abs('Folder/Deep.md')), false);
	assert.equal(ignored(abs('libs/icons/a.svg')), true, 'not planned, not watched');
});

test('once the scan has settled the plan is spent and new files are judged on budget', () => {
	// A note the user creates after the vault opened is not in any plan, and
	// refusing it is how a capped vault stopped showing new notes at all.
	let settled = false;
	const admit = new Set(['Note.md']);
	const { ignored, state } = watchFilter({ root, admit, settled: () => settled, take: () => true });
	assert.equal(ignored(abs('Untitled.md')), true);
	settled = true;
	assert.equal(ignored(abs('Untitled.md')), false, 'a file created in the session must be watched');
	assert.ok(state.accepted.has('Untitled.md'));
	assert.ok(state.accepted.has('Note.md'), 'what the plan bought is already ours');
});

test('the exclusion rules outrank the plan', () => {
	// A plan is built from the vault walk, which applies `hidden`; the
	// watcher also applies `unindexed`, and chokidar asks about paths the
	// walk never saw. The rules stay the first question.
	const admit = new Set(['.git/HEAD', 'node_modules/x.js']);
	const { ignored } = watchFilter({ root, admit });
	assert.equal(ignored(abs('.git/HEAD')), true);
	assert.equal(ignored(abs('node_modules/x.js')), true);
});

test('the ceiling is above the budget and still clear of the fork limit', () => {
	assert.ok(WATCH_CEILING > WATCH_BUDGET, 'the session needs room the scan did not take');
	assert.ok(WATCH_CEILING <= 9500, `ceiling ${WATCH_CEILING} is too close to the 10,240 where fork() fails`);
});

test('the shipped budget leaves room under the fork ceiling', () => {
	// 10,240 held descriptors is where fork() starts failing with EBADF
	// (measured); the app itself needs a few hundred, and every window has
	// its own watcher drawing on this one budget.
	assert.ok(WATCH_BUDGET > 0 && WATCH_BUDGET <= 9000, `budget ${WATCH_BUDGET}`);
});

test('after the scan, a path the scan knew is refused FREE — only new paths spend headroom', () => {
	// chokidar re-reads a folder on every event and asks about every entry.
	// Buying the ones the scan left out, then, emitted an `add` for each old
	// file and spent the ceiling's headroom on them: with two windows open,
	// neither saw a new file afterwards (smoke/watch-repro.mjs, 2026-09-30).
	let settled = false;
	let charged = 0;
	const admit = new Set(['Note.md']);
	const known = knownPaths(['Note.md', 'libs/icons/a.svg', 'libs/icons/b.svg']);
	const { ignored, state } = watchFilter({
		root, admit, known, settled: () => settled, take: () => { charged++; return true; },
	});
	settled = true;
	assert.equal(ignored(abs('libs/icons/a.svg')), true, 'known, not bought: stays unwatched');
	assert.equal(ignored(abs('libs/icons')), true, 'its folder too');
	assert.equal(charged, 0, 'and neither was charged');
	assert.equal(state.skipped, 0, 'nor counted as refused for budget');
	assert.equal(ignored(abs('Exported.pdf')), false, 'a NEW file is still watched');
	assert.equal(charged, 1);
	assert.equal(ignored(abs('Note.md')), false, 'what the plan bought is still ours');
});

test('knownPaths holds every file and every folder above it', () => {
	assert.deepEqual([...knownPaths(['a/b/c.md', 'a/b/d.md', 'x.md'])].sort(), ['a', 'a/b', 'a/b/c.md', 'a/b/d.md', 'x.md']);
	assert.deepEqual([...knownPaths([])], []);
});

test('a scan takes all but SCAN_KEEP of what is left, never more than half past that', () => {
	assert.equal(scanShare(WATCH_BUDGET), WATCH_BUDGET - SCAN_KEEP, 'the first window of a process');
	assert.ok(scanShare(WATCH_BUDGET) >= 5000, 'room for a 5,000-note vault');
	const second = WATCH_BUDGET - scanShare(WATCH_BUDGET);
	assert.ok(scanShare(second) > 0, 'a later window is never starved');
	assert.equal(scanShare(1000), 500);
	assert.equal(scanShare(0), 0);
	assert.equal(scanShare(-5), 0);
});
