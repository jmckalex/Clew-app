// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { direntKind, shouldRecurse, walkGuard } from '../src/main/fs-utils.js';
import { Indexer } from '../src/main/indexer.js';

function makeFixture() {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-symlinks-'));
	const vault = path.join(base, 'vault');
	const external = path.join(base, 'external');
	fs.mkdirSync(vault);
	fs.mkdirSync(external);
	fs.writeFileSync(path.join(vault, 'A.md'), '# A\n\nSee [[Linked Note]].\n');
	fs.writeFileSync(path.join(external, 'Linked Note.md'), 'Back to [[A]].\n');
	fs.writeFileSync(path.join(external, 'Single.md'), 'A single external note.\n');
	// Symlinks: a folder, a file, a dangling link, and a cycle back to the vault.
	fs.symlinkSync(external, path.join(vault, 'Linked'));
	fs.symlinkSync(path.join(external, 'Single.md'), path.join(vault, 'External.md'));
	fs.symlinkSync(path.join(base, 'gone.md'), path.join(vault, 'Dangling.md'));
	fs.symlinkSync(vault, path.join(external, 'loop'));
	return { base, vault, external };
}

test('direntKind follows symlinks and rejects dangling ones', () => {
	const { vault } = makeFixture();
	const kinds = {};
	for (const entry of fs.readdirSync(vault, { withFileTypes: true })) {
		kinds[entry.name] = direntKind(vault, entry);
	}
	assert.equal(kinds['A.md'], 'file');
	assert.equal(kinds['Linked'], 'dir');
	assert.equal(kinds['External.md'], 'file');
	assert.equal(kinds['Dangling.md'], null);
});

test('shouldRecurse permits each real directory once', () => {
	const { vault, external } = makeFixture();
	const seen = walkGuard(vault);
	assert.equal(shouldRecurse(path.join(vault, 'Linked'), seen), true);
	assert.equal(shouldRecurse(external, seen), false); // same real dir
	assert.equal(shouldRecurse(path.join(external, 'loop'), seen), false); // cycle to root
});

test('indexer sees symlinked notes and folders, resolves links, survives cycles (a trusted vault)', () => {
	const { vault } = makeFixture();
	const indexer = new Indexer();
	indexer.restricted = false;   // trust covers a vault's links (frame-bridge.md §4)
	indexer.openVault(vault);
	try {
		const paths = [...indexer.notes.keys()].sort();
		assert.deepEqual(paths, ['A.md', 'External.md', 'Linked/Linked Note.md', 'Linked/Single.md']);
		// Wikilinks resolve across the symlink boundary, both directions.
		const a = indexer.notes.get('A.md');
		assert.equal(a.links[0].resolved, 'Linked/Linked Note.md');
		const linked = indexer.notes.get('Linked/Linked Note.md');
		assert.equal(linked.links[0].resolved, 'A.md');
	} finally {
		indexer.closeVault();
	}
});

test('a RESTRICTED vault is indexed only as far as its realpath reaches', () => {
	const { vault } = makeFixture();
	const indexer = new Indexer();   // restricted by default: fails closed
	indexer.openVault(vault);
	try {
		assert.deepEqual([...indexer.notes.keys()].sort(), ['A.md']);
		assert.equal(indexer.notes.get('A.md').links[0].resolved, null, 'the link out resolves to nothing');
	} finally {
		indexer.closeVault();
	}
});

test('insideByRealpath: links out, dangling links and missing paths are outside', async () => {
	const { insideByRealpath } = await import('../src/engine/vault-bounds.js');
	const { vault } = makeFixture();
	assert.equal(insideByRealpath(path.join(vault, 'A.md'), vault), true);
	assert.equal(insideByRealpath(path.join(vault, 'Linked'), vault), false);
	assert.equal(insideByRealpath(path.join(vault, 'Linked', 'Single.md'), vault), false);
	assert.equal(insideByRealpath(path.join(vault, 'External.md'), vault), false);
	assert.equal(insideByRealpath(path.join(vault, 'Dangling.md'), vault), false);
	assert.equal(insideByRealpath(path.join(vault, 'Missing.md'), vault), false);
	// The loop back into the vault, reached from inside: inside.
	assert.equal(insideByRealpath(path.join(vault, 'Linked', 'loop', 'A.md'), vault), true);
});
