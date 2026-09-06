// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The embed disclosure keyword: read by the engine, written by the toggle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEmbedState, setEmbedState } from '../src/engine/embed-state.js';

test('no alias means no disclosure state', () => {
	assert.deepEqual(parseEmbedState(null), { state: null, alias: null });
});

test('a keyword-only alias is a state, not a title', () => {
	assert.deepEqual(parseEmbedState('collapsed'), { state: 'collapsed', alias: null });
	assert.deepEqual(parseEmbedState('open'), { state: 'open', alias: null });
});

test('the keyword is the LAST segment; earlier segments stay the title', () => {
	assert.deepEqual(parseEmbedState('Reading|collapsed'), { state: 'collapsed', alias: 'Reading' });
});

test('a plain alias is left alone', () => {
	assert.deepEqual(parseEmbedState('Week Three'), { state: null, alias: 'Week Three' });
});

test('the keyword is recognised whatever its case', () => {
	assert.equal(parseEmbedState('Collapsed').state, 'collapsed');
	assert.equal(parseEmbedState('OPEN').state, 'open');
});

test('a title that merely contains the word is not a state', () => {
	assert.deepEqual(parseEmbedState('collapsed notes'),
		{ state: null, alias: 'collapsed notes' });
});

test('setEmbedState adds a keyword to a bare embed', () => {
	assert.equal(setEmbedState('![[Week 3]]', 'collapsed'), '![[Week 3|collapsed]]');
});

test('setEmbedState flips an existing keyword rather than stacking them', () => {
	assert.equal(setEmbedState('![[Week 3|collapsed]]', 'open'), '![[Week 3|open]]');
	assert.equal(setEmbedState('![[Week 3|open]]', 'collapsed'), '![[Week 3|collapsed]]');
});

test('setEmbedState keeps a real alias, and the fragment, and the indent', () => {
	assert.equal(setEmbedState('  ![[Week 3#Readings|Reading list|open]]', 'collapsed'),
		'  ![[Week 3#Readings|Reading list|collapsed]]');
});

test('setEmbedState(null) removes the keyword entirely', () => {
	assert.equal(setEmbedState('![[Week 3|collapsed]]', null), '![[Week 3]]');
	assert.equal(setEmbedState('![[Week 3|Reading|open]]', null), '![[Week 3|Reading]]');
});

test('setEmbedState returns null for a line that is not an embed', () => {
	// How a drifted line number is caught before anything is written.
	assert.equal(setEmbedState('Just some prose.', 'collapsed'), null);
	assert.equal(setEmbedState('[[Week 3]]', 'collapsed'), null); // a link, not an embed
	assert.equal(setEmbedState('![[Week 3]] with trailing prose', 'collapsed'), null);
});
