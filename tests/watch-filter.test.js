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
import { watchFilter, WATCH_BUDGET } from '../src/main/fs-utils.js';

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

test('the shipped budget leaves room under the fork ceiling', () => {
	// 10,240 held descriptors is where fork() starts failing with EBADF
	// (measured); the app itself needs a few hundred, and every window has
	// its own watcher drawing on this one budget.
	assert.ok(WATCH_BUDGET > 0 && WATCH_BUDGET <= 9000, `budget ${WATCH_BUDGET}`);
});
