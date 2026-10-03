// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WriteGuard, guardable } from '../src/main/write-guard.js';
import { writeFileAtomic } from '../src/main/fs-utils.js';

// One temp root for this file, removed when it is done: fixtures used to
// be left in the system's temp folder, thousands of them over the runs.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-guard-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

function note(text = '# Note\n') {
	const dir = fs.mkdtempSync(path.join(tmpRoot, 'clew-guard-'));
	const abs = path.join(dir, 'Note.md');
	fs.writeFileSync(abs, text);
	return { dir, abs };
}
// An mtime the next write cannot share, however fast the machine.
const bump = (abs, by = 5) => {
	const t = fs.statSync(abs).mtimeMs + by;
	fs.utimesSync(abs, new Date(t), new Date(t));
};

test('another app\'s save between the read and the write is refused, with its text', () => {
	const { dir, abs } = note('# Note\n\nmine so far\n');
	const guard = new WriteGuard();
	guard.read('Note.md', abs);
	fs.writeFileSync(abs, '# Note\n\nTHEIRS\n');
	bump(abs);
	assert.deepEqual(guard.check('Note.md', abs, '# Note\n\nmine so far, and more\n'), { conflict: true, disk: '# Note\n\nTHEIRS\n' });
	fs.rmSync(dir, { recursive: true, force: true });
});

test('a moved mtime with the same text is no conflict (a sync client touching the file)', () => {
	const { dir, abs } = note();
	const guard = new WriteGuard();
	guard.read('Note.md', abs);
	bump(abs);
	assert.equal(guard.check('Note.md', abs, '# Note\n\nedited\n'), null);
	// …and it counts as seen now.
	assert.equal(guard.check('Note.md', abs, '# Note\n\nedited again\n'), null);
	fs.rmSync(dir, { recursive: true, force: true });
});

test('the same edit made on both sides is no conflict', () => {
	const { dir, abs } = note();
	const guard = new WriteGuard();
	guard.read('Note.md', abs);
	fs.writeFileSync(abs, '# Note\n\nsame\n');
	bump(abs);
	assert.equal(guard.check('Note.md', abs, '# Note\n\nsame\n'), null);
	fs.rmSync(dir, { recursive: true, force: true });
});

test('ten separate saves in a row raise nothing: the mtime is taken AFTER the rename', () => {
	// Clew-iOS's false conflict on every second save came from recording the
	// pre-write mtime. Each save here is an atomic rename, as the vault's are.
	const { dir, abs } = note();
	const guard = new WriteGuard();
	guard.read('Note.md', abs);
	for (let i = 1; i <= 10; i++) {
		const content = `# Note\n\nsave ${i}\n`;
		assert.equal(guard.check('Note.md', abs, content), null, `save ${i}`);
		writeFileAtomic(abs, content);
		guard.wrote('Note.md', abs, content);
	}
	assert.equal(fs.readFileSync(abs, 'utf8'), '# Note\n\nsave 10\n');
	fs.rmSync(dir, { recursive: true, force: true });
});

test('after our own save, a later external one is still caught', () => {
	const { dir, abs } = note();
	const guard = new WriteGuard();
	guard.read('Note.md', abs);
	writeFileAtomic(abs, 'ours');
	guard.wrote('Note.md', abs, 'ours');
	fs.writeFileSync(abs, 'theirs');
	bump(abs);
	assert.deepEqual(guard.check('Note.md', abs, 'ours, edited'), { conflict: true, disk: 'theirs' });
	fs.rmSync(dir, { recursive: true, force: true });
});

test('a note never read cannot be judged, and is not refused', () => {
	const { dir, abs } = note();
	assert.equal(new WriteGuard().check('Note.md', abs, 'x'), null);
	fs.rmSync(dir, { recursive: true, force: true });
});

test('vault state is never guarded', () => {
	assert.equal(guardable('Notes/A.md'), true);
	assert.equal(guardable('.clew/vault-settings.json'), false);
	assert.equal(guardable('.clew'), false);
	assert.equal(guardable('clewdata.json'), false);
	assert.equal(guardable('Notes/clewdata.json'), true);
	const { dir, abs } = note();
	const guard = new WriteGuard();
	guard.read('clewdata.json', abs);
	fs.writeFileSync(abs, 'changed');
	bump(abs);
	assert.equal(guard.check('clewdata.json', abs, 'x'), null);
	fs.rmSync(dir, { recursive: true, force: true });
});

test('a rename forgets what was seen at the old path', () => {
	const { dir, abs } = note();
	const guard = new WriteGuard();
	guard.read('Folder/Note.md', abs);
	guard.forget('Folder');
	fs.writeFileSync(abs, 'changed');
	bump(abs);
	assert.equal(guard.check('Folder/Note.md', abs, 'x'), null);
	fs.rmSync(dir, { recursive: true, force: true });
});
