// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The desktop's right-click menu and dictionary choice for spell checking
// (src/main/spell-menu.js), over the values Electron hands it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editMenuItems, spellLanguages } from '../src/main/spell-menu.js';

const labels = (items) => items.map((i) => (i.type === 'separator' ? '-' : i.label));
const ALL = { canCut: true, canCopy: true, canPaste: true, canSelectAll: true };

test('a misspelt word: its suggestions, Learn Spelling, then the edit items', () => {
	const items = editMenuItems({ isEditable: true, misspelledWord: 'wrod', dictionarySuggestions: ['word', 'rod'], editFlags: ALL }, { platform: 'darwin' });
	assert.deepEqual(labels(items), ['word', 'rod', '-', 'Learn Spelling', '-', 'Cut', 'Copy', 'Paste', '-', 'Select All']);
	assert.deepEqual(items[0].action, { kind: 'replace', word: 'word' });
	assert.deepEqual(items[3].action, { kind: 'learn', word: 'wrod' });
	assert.deepEqual(items.filter((i) => i.role).map((i) => i.role), ['cut', 'copy', 'paste', 'selectAll']);
});

test('Windows and Linux say "Add to Dictionary"; no suggestions say so; at most six', () => {
	for (const platform of ['win32', 'linux']) {
		const items = editMenuItems({ isEditable: true, misspelledWord: 'qzx', dictionarySuggestions: [], editFlags: ALL }, { platform });
		assert.deepEqual(labels(items).slice(0, 4), ['No Guesses Found', '-', 'Add to Dictionary', '-']);
		assert.equal(items[0].enabled, false);
	}
	const many = editMenuItems({ isEditable: true, misspelledWord: 'x', dictionarySuggestions: ['a', '', 'b', 'c', 'd', 'e', 'f', 'g'], editFlags: ALL }, { platform: 'darwin' });
	assert.deepEqual(labels(many).slice(0, 7), ['a', 'b', 'c', 'd', 'e', 'f', '-']);
});

test('a word spelt right: the edit items alone, enabled as Electron says; nothing where nothing is editable', () => {
	const items = editMenuItems({ isEditable: true, misspelledWord: '', editFlags: { canCut: false, canCopy: false, canPaste: true, canSelectAll: true } }, { platform: 'darwin' });
	assert.deepEqual(labels(items), ['Cut', 'Copy', 'Paste', '-', 'Select All']);
	assert.deepEqual(items.filter((i) => i.role).map((i) => i.enabled), [false, false, true, true]);
	assert.deepEqual(editMenuItems({ isEditable: false, misspelledWord: 'wrod', dictionarySuggestions: ['word'] }), []);
	assert.deepEqual(editMenuItems(null), []);
});

const AVAILABLE = ['de', 'de-DE', 'en', 'en-AU', 'en-GB', 'en-US', 'fr', 'fr-FR', 'pt-BR', 'pt-PT'];

test('the setting\'s codes that Electron has, as Electron spells them; the rest named', () => {
	assert.deepEqual(spellLanguages(['en_gb', ' DE ', 'xx', 'fr'], AVAILABLE, ['en-US']),
		{ languages: ['en-GB', 'de', 'fr'], unknown: ['xx'], fromSystem: false });
	assert.deepEqual(spellLanguages(['en-GB', 'en-gb'], AVAILABLE, []).languages, ['en-GB'], 'once each');
});

test('none (or none known): the first system language Electron has, as itself, its language alone, or the first of it', () => {
	assert.deepEqual(spellLanguages([], AVAILABLE, ['en-GB', 'de']), { languages: ['en-GB'], unknown: [], fromSystem: true });
	assert.deepEqual(spellLanguages(undefined, AVAILABLE, ['de-CH']).languages, ['de'], 'its language alone');
	assert.deepEqual(spellLanguages([], AVAILABLE, ['pt-AO']).languages, ['pt-BR'], 'the first of its language');
	assert.deepEqual(spellLanguages([], AVAILABLE, ['ja-JP', 'fr-CA']).languages, ['fr'], 'past a language with none');
	assert.deepEqual(spellLanguages(['xx'], AVAILABLE, ['de-DE']), { languages: ['de-DE'], unknown: ['xx'], fromSystem: true });
	assert.deepEqual(spellLanguages([], AVAILABLE, ['ja-JP']).languages, ['en-US'], 'else en-US');
	assert.deepEqual(spellLanguages([], ['de'], ['ja-JP']).languages, [], 'and nothing where there is no en-US');
});
