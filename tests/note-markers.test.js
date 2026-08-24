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
import { noteMarkerFrom, noteHasTag } from '../src/engine/obsidian-fences.js';

test('note marker from frontmatter location', () => {
	const text = '---\nlocation: [41.9, 12.5]\nmapmarker: red\nmap-label: The Forum\n---\n# Note';
	assert.deepEqual(noteMarkerFrom(text, 'Trips/Rome.md'),
		{ lat: 41.9, long: 12.5, link: 'Trips/Rome.md', label: 'The Forum', type: 'red' });
});

test('label falls back to the note name; bare location works', () => {
	const m = noteMarkerFrom('---\nlocation: 51.5, -0.12\n---\nx', 'London.md');
	assert.deepEqual(m, { lat: 51.5, long: -0.12, link: 'London.md', label: 'London' });
});

test('notes without location yield null', () => {
	assert.equal(noteMarkerFrom('---\ntitle: x\n---\nbody', 'a.md'), null);
	assert.equal(noteMarkerFrom('no frontmatter', 'a.md'), null);
});

test('tag matching: inline and block forms, # optional', () => {
	assert.equal(noteHasTag('---\ntags: [travel, fun]\n---\n', 'travel'), true);
	assert.equal(noteHasTag('---\ntags:\n  - "#travel"\n  - x\n---\n', 'travel'), true);
	assert.equal(noteHasTag('---\ntags: [work]\n---\n', 'travel'), false);
	assert.equal(noteHasTag('no fm', 'travel'), false);
});
