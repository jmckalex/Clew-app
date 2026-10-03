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
import { getPdfMeta, setPdfMeta, renamePdfMeta, PDF_META_FILE } from '../src/main/pdf-meta.js';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-pdf-meta-'));
after(() => fs.rmSync(base, { recursive: true, force: true }));
const vault = () => fs.mkdtempSync(path.join(base, 'vault-'));

test('a chosen entry is remembered, in .clew/, and read back', () => {
	const root = vault();
	assert.equal(getPdfMeta(root, 'Papers/x.pdf'), null);
	setPdfMeta(root, 'Papers/x.pdf', { key: 'skyrms:1996' }, { now: new Date('2026-10-03T10:00:00Z') });
	assert.deepEqual(getPdfMeta(root, 'Papers/x.pdf'), { key: 'skyrms:1996', updated: '2026-10-03T10:00:00.000Z' });
	assert.ok(fs.existsSync(path.join(root, '.clew', PDF_META_FILE)));
});

test('"no citation" is remembered too, as null', () => {
	const root = vault();
	setPdfMeta(root, 'a.pdf', { key: null });
	assert.equal(getPdfMeta(root, 'a.pdf').key, null);
	assert.equal('key' in getPdfMeta(root, 'a.pdf'), true);
});

test('fields merge; undefined forgets one; an empty entry goes', () => {
	const root = vault();
	setPdfMeta(root, 'a.pdf', { key: 'k' });
	setPdfMeta(root, 'a.pdf', { offset: 266, offsetSource: 'text' });
	assert.equal(getPdfMeta(root, 'a.pdf').key, 'k');
	assert.equal(getPdfMeta(root, 'a.pdf').offset, 266);
	setPdfMeta(root, 'a.pdf', { key: undefined, offset: undefined, offsetSource: undefined });
	assert.equal(getPdfMeta(root, 'a.pdf'), null);
	setPdfMeta(root, 'a.pdf', { evil: 1 });
	assert.equal(getPdfMeta(root, 'a.pdf'), null, 'only the known fields');
});

test('a rename or move carries the entry — the PDF, or a folder holding it', () => {
	const root = vault();
	setPdfMeta(root, 'Papers/x.pdf', { key: 'k1' });
	setPdfMeta(root, 'Papers/Sub/y.pdf', { key: 'k2' });
	setPdfMeta(root, 'Papersmith/z.pdf', { key: 'k3' });
	renamePdfMeta(root, 'Papers/x.pdf', 'Library/x renamed.pdf');
	assert.equal(getPdfMeta(root, 'Library/x renamed.pdf').key, 'k1');
	assert.equal(getPdfMeta(root, 'Papers/x.pdf'), null);
	renamePdfMeta(root, 'Papers', 'Reading');
	assert.equal(getPdfMeta(root, 'Reading/Sub/y.pdf').key, 'k2');
	assert.equal(getPdfMeta(root, 'Papersmith/z.pdf').key, 'k3', 'a folder sharing a prefix is not inside it');
});

test('no file, nothing to rename, nothing written', () => {
	const root = vault();
	assert.equal(renamePdfMeta(root, 'a.pdf', 'b.pdf'), false);
	assert.equal(fs.existsSync(path.join(root, '.clew', PDF_META_FILE)), false);
});
