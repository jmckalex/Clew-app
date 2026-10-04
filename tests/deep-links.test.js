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
import { parseClewUrl, cleanNotePath, resolveVaultSpec, vaultForFile, parseCliArgs } from '../src/main/deep-links.js';

test('clew://open: vault, note, line and heading', () => {
	assert.deepEqual(parseClewUrl('clew://open?vault=ph226-426&note=notes/Week%203.md&line=12#Personal%20identity'), {
		action: 'open', vault: 'ph226-426', note: 'notes/Week 3.md', heading: 'Personal identity', line: 12, daily: false,
	});
	assert.equal(parseClewUrl('clew://open?vault=v&note=Plain').note, 'Plain.md', 'no extension: a note');
	assert.equal(parseClewUrl('clew:open?vault=v').action, 'open', 'the path form too');
});

test('clew://new: daily, or a note', () => {
	assert.equal(parseClewUrl('clew://new?vault=v&daily=1').daily, true);
	assert.equal(parseClewUrl('clew://new?vault=v&note=Ideas/Fresh').note, 'Ideas/Fresh.md');
	assert.match(parseClewUrl('clew://new?vault=v').error, /daily=1 or a note/);
});

test('anything else is refused by name', () => {
	assert.match(parseClewUrl('clew://run?script=x').error, /clew:\/\/run is not something a link can do/);
	assert.match(parseClewUrl('clew://trust?vault=v').error, /not something a link can do/);
	assert.match(parseClewUrl('https://example.org').error, /not a clew:\/\/ link/);
	assert.match(parseClewUrl('clew://open?vault=v&note=../../etc/passwd').error, /climbs out/);
	assert.match(parseClewUrl('clew://open?vault=v&note=/etc/passwd').error, /climbs out/);
	assert.match(parseClewUrl('clew://open').error, /needs a vault or a note/);
	assert.equal(parseClewUrl('clew://open?vault=v&line=abc').line, null, 'a line that is no number is no line');
});

test('note paths are cleaned', () => {
	assert.equal(cleanNotePath('./a//b.md'), 'a/b.md');
	assert.equal(cleanNotePath('a\\b'), 'a/b.md');
	assert.equal(cleanNotePath('Paper.pdf'), 'Paper.pdf');
	assert.equal(cleanNotePath(''), null);
	assert.equal(cleanNotePath('a/../b'), false);
});

test('a vault by path or by the name of a known one', () => {
	const known = ['/Users/j/Sites/ph226-426', '/Users/j/Notes', '/Volumes/X/Notes'];
	assert.deepEqual(resolveVaultSpec('ph226-426', known), { path: '/Users/j/Sites/ph226-426', known: true });
	assert.deepEqual(resolveVaultSpec('PH226-426', known), { path: '/Users/j/Sites/ph226-426', known: true }, 'ignoring case');
	assert.deepEqual(resolveVaultSpec('~/Elsewhere/', known, '/Users/j'), { path: '/Users/j/Elsewhere', known: false });
	assert.deepEqual(resolveVaultSpec('/Users/j/Notes', known), { path: '/Users/j/Notes', known: true });
	assert.match(resolveVaultSpec('Notes', known).error, /two vaults are called/);
	assert.match(resolveVaultSpec('Nope', known).error, /no vault called "Nope"/);
});

test('the vault a file belongs to', () => {
	const marked = new Set(['/u/Vault', '/u/Other/Deep']);
	const isVault = (d) => marked.has(d);
	assert.equal(vaultForFile('/u/Vault/notes/a.md', { isVault }), '/u/Vault');
	assert.equal(vaultForFile('/u/Other/Deep/x/y.md', { isVault }), '/u/Other/Deep');
	assert.equal(vaultForFile('/u/Plain/a.md', { isVault, knownPaths: ['/u/Plain'] }), '/u/Plain');
	assert.equal(vaultForFile('/u/Loose/a.md', { isVault }), '/u/Loose', 'else its own folder');
});

test('the command line', () => {
	assert.deepEqual(parseCliArgs(['open', 'notes/a.md']), { cmd: 'open', path: 'notes/a.md' });
	assert.deepEqual(parseCliArgs(['new', '--daily']), { cmd: 'new', daily: true, vault: null });
	assert.deepEqual(parseCliArgs(['new', '--daily', '--vault', 'ph226-426']), { cmd: 'new', daily: true, vault: 'ph226-426' });
	assert.deepEqual(parseCliArgs(['new', 'Ideas/Fresh']), { cmd: 'new', note: 'Ideas/Fresh', vault: null });
	assert.deepEqual(parseCliArgs(['export', '--pdf', 'a.md']), { cmd: 'export', format: 'pdf', path: 'a.md', out: null });
	assert.deepEqual(parseCliArgs(['export', '--pdf', 'a.md', '--out', '~/Desktop/']), { cmd: 'export', format: 'pdf', path: 'a.md', out: '~/Desktop/' });
	// A value equal to the note's path is still the value, by position.
	assert.deepEqual(parseCliArgs(['export', '--latex', '--out', 'a.md', 'a.md']), { cmd: 'export', format: 'latex', path: 'a.md', out: 'a.md' });
	assert.match(parseCliArgs(['export', '--pdf', 'a.md', '--out']).error, /--out where/);
	assert.match(parseCliArgs(['export', 'a.md']).error, /--latex, --pdf or --html/);
	assert.match(parseCliArgs(['rm', '-rf']).error, /unknown command "rm"/);
	assert.equal(parseCliArgs([]).usage, true);
});
