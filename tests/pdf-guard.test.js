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
import { PdfGuard, sha1 } from '../src/main/pdf-guard.js';
import { keepVersion } from '../src/main/history.js';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-pdf-guard-'));
after(() => fs.rmSync(base, { recursive: true, force: true }));
const pdf = (name, text) => {
	const abs = path.join(base, name);
	fs.writeFileSync(abs, `%PDF-1.4\n${text}\n%%EOF\n`);
	return abs;
};

test('a save over the version the viewer loaded goes ahead; over another, it does not', () => {
	const guard = new PdfGuard();
	const abs = pdf('a.pdf', 'loaded');
	const loaded = sha1(fs.readFileSync(abs));
	const mine = Buffer.from('%PDF-1.4\nmine\n%%EOF\n');
	assert.equal(guard.check(abs, mine, loaded), null, 'the disk holds what was loaded');
	// Another device's version arrives.
	fs.writeFileSync(abs, '%PDF-1.4\ntheirs, synced in\n%%EOF\n');
	const c = guard.check(abs, mine, loaded);
	assert.equal(c?.conflict, true);
	assert.equal(c.mineHash, sha1(mine));
	// The disk already holds exactly mine: no conflict.
	fs.writeFileSync(abs, mine);
	assert.equal(guard.check(abs, mine, loaded), null);
});

test('no base cannot be judged, and goes ahead — as every save did before', () => {
	const guard = new PdfGuard();
	const abs = pdf('b.pdf', 'x');
	fs.writeFileSync(abs, 'changed');
	assert.equal(guard.check(abs, Buffer.from('mine'), null), null);
});

test('after a write the version on disk is the one written; a later save from it goes ahead', () => {
	const guard = new PdfGuard();
	const abs = pdf('c.pdf', 'v1');
	const v2 = Buffer.from('%PDF-1.4\nv2\n%%EOF\n');
	fs.writeFileSync(abs, v2);
	const hash = guard.wrote(abs, v2);
	assert.equal(hash, sha1(v2));
	assert.equal(guard.check(abs, Buffer.from('v3'), hash), null, 'saved from the version just written');
});

test('a touched file (new mtime, same bytes) is no conflict', () => {
	const guard = new PdfGuard();
	const abs = pdf('d.pdf', 'same');
	const loaded = sha1(fs.readFileSync(abs));
	guard.hashOf(abs);
	const later = new Date(Date.now() + 5000);
	fs.utimesSync(abs, later, later);
	assert.equal(guard.check(abs, Buffer.from('mine'), loaded), null);
});

test('a conflict\'s versions are kept as bytes, though history tracks no PDFs', () => {
	const root = fs.mkdtempSync(path.join(base, 'vault-'));
	const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x0a]);
	assert.equal(keepVersion(root, 'p/x.pdf', bytes), null, 'not tracked by default');
	const name = keepVersion(root, 'p/x.pdf', bytes, { any: true });
	assert.match(name, /\.pdf$/);
	assert.deepEqual(fs.readFileSync(path.join(root, '.clew', 'history', 'p/x.pdf', name)), bytes);
});
