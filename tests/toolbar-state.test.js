// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What the toolbar shows for a cursor (src/renderer/editor/toolbar/toolbar-state.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { noteMarkdown } from '../src/renderer/editor/jmd/markdown-config.js';
import { liveModel } from '../src/renderer/editor/live/model.js';
import { deriveState } from '../src/renderer/editor/toolbar/toolbar-state.js';

function at(doc, marker, opts = {}) {
	const pos = doc.indexOf('|');
	const text = doc.replace('|', '');
	const state = EditorState.create({ doc: text, selection: { anchor: pos }, extensions: [noteMarkdown(opts)] });
	return deriveState(state, liveModel(state, opts), opts);
}

test('block types', () => {
	assert.equal(at('# Ti|tle\n').blockType, 'h1');
	assert.equal(at('### Ti|tle\n').blockType, 'h3');
	assert.equal(at('Plain |text.\n').blockType, 'paragraph');
	assert.equal(at('> quo|te\n').blockType, 'quote');
	assert.equal(at('> [!tip] Ti|tle\n> body\n').blockType, 'callout');
	assert.equal(at('> [!tip] Title\n> bo|dy\n').blockType, 'callout');
	assert.equal(at('- ite|m\n').blockType, 'bullet');
	assert.equal(at('1. ite|m\n').blockType, 'numbered');
	assert.equal(at('- [ ] ta|sk\n').blockType, 'task');
	assert.equal(at('```js\nco|de\n```\n').blockType, 'code');
	assert.equal(at('| a |\n|---|\n| b| |\n').blockType, 'table');
	assert.equal(at('$$\nx|\n$$\n').blockType, 'math');
});

test('an environment names itself', () => {
	const s = at(':::theorem\nBo|dy\n:::\n');
	assert.deepEqual([s.blockType, s.envName], ['env', 'theorem']);
});

test('inline styles under the cursor — innermost and outer both count', () => {
	assert.deepEqual([...at('*a /b|/ c*').inline].sort(), ['italic', 'strong']);
	assert.deepEqual([...at('A [[No|te]] and `x`').inline], ['wikilink']);
	assert.deepEqual([...at('plain| text').inline], []);
});

test('lists: inList and depth', () => {
	const s = at('- a\n  - b|\n');
	assert.deepEqual([s.inList, s.listDepth], [true, 2]);
	assert.equal(at('para|\n').inList, false);
});

test('normalSyntax flows through', () => {
	const s = at('a **b|** c', null, { normalSyntax: true });
	assert.equal(s.normalSyntax, true);
	assert.deepEqual([...s.inline], ['strong']);
});

test('the Next item button is a touch-first host\'s alone (the iPad: lib/host.js), enabled in a list', async () => {
	const { TOOLBAR_GROUPS } = await import('../src/renderer/editor/toolbar/toolbar-spec.js');
	const item = TOOLBAR_GROUPS.find((g) => g.id === 'list').items.find((i) => i.command === 'editor:new-list-item');
	assert.ok(item, 'the Lists group holds it');
	const doc = '* item\n';
	const at = (touch) => {
		const state = EditorState.create({ doc, selection: { anchor: 3 }, extensions: [noteMarkdown({})] });
		return deriveState(state, liveModel(state, {}), { touch });
	};
	assert.equal(at(false).touchFirst, false);
	assert.equal(item.when(at(false)), false, 'never on a Mac');
	assert.equal(item.when(at(true)), true, 'on the iPad');
	assert.equal(item.enabled(at(true)), true, 'in a list');
	// With no host saying otherwise — the desktop's preload says nothing — not touch-first.
	const plain = EditorState.create({ doc: 'prose\n', extensions: [noteMarkdown({})] });
	assert.equal(deriveState(plain, liveModel(plain, {})).touchFirst, false);
});

test('the host reader (lib/host.js): exactly `window.clew.host.touchFirst === true` — what the iOS shim sets', async () => {
	const { touchFirst } = await import('../src/renderer/lib/host.js');
	const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
	const was = globalThis.window;
	try {
		globalThis.window = { clew: { host: { touchFirst: true } } };
		assert.equal(touchFirst(), true);
		globalThis.window = { clew: { host: { touchFirst: 'yes' } } };
		assert.equal(touchFirst(), false, 'true itself, not a truthy value');
		globalThis.window = { clew: {} };
		assert.equal(touchFirst(), false, 'no host: the desktop');
		globalThis.window = { clew: { host: { touchfirst: true } } };
		assert.equal(touchFirst(), false, 'the property\'s exact name');
		delete globalThis.window;
		assert.equal(touchFirst(), false, 'no window at all');
		// deriveState reads it when not told.
		globalThis.window = { clew: { host: { touchFirst: true } } };
		const state = EditorState.create({ doc: '* item\n', extensions: [noteMarkdown({})] });
		assert.equal(deriveState(state, liveModel(state, {})).touchFirst, true);
	} finally {
		if (had) globalThis.window = was; else delete globalThis.window;
	}
});
