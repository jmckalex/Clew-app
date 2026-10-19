// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Enter and ⌘Enter in a list item (src/renderer/editor/list-keys.js): Enter
// a new line in the item, ⌘Enter the next item. Over a real EditorState with
// the editor's own markdown config; `|` is the cursor, before and after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, EditorSelection } from '@codemirror/state';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { noteMarkdown } from '../src/renderer/editor/jmd/markdown-config.js';
import { listEnterSpec, newListItemSpec } from '../src/renderer/editor/list-keys.js';

function stateOf(text) {
	const at = text.indexOf('|');
	const doc = text.slice(0, at) + text.slice(at + 1);
	const state = EditorState.create({ doc, selection: EditorSelection.cursor(at), extensions: [noteMarkdown({})] });
	ensureSyntaxTree(state, doc.length, 5000);
	return state;
}
/** The text after `spec(state)`, `|` at the cursor — or null when it declines. */
function press(spec, text) {
	const state = stateOf(text);
	const s = spec(state);
	if (!s) return null;
	const next = state.update(s).state;
	const head = next.selection.main.head;
	return next.doc.sliceString(0, head) + '|' + next.doc.sliceString(head);
}
const enter = (text) => press(listEnterSpec, text);
const cmdEnter = (text) => press(newListItemSpec, text);

test('Enter stays in the item: a new line under its text, at its content column', () => {
	assert.equal(enter('* first item|'), '* first item\n  |');
	assert.equal(enter('1. one|'), '1. one\n   |');
	assert.equal(enter('10. ten|'), '10. ten\n    |');
	// A hard-wrapped item: its last line is a continuation, as the owner's are.
	assert.equal(enter('* line one\n  line two|'), '* line one\n  line two\n  |');
	// Mid-text: the item's line splits, the rest under its text.
	assert.equal(enter('* hello |world'), '* hello\n  |world');
	// A nested item: under ITS text.
	assert.equal(enter('* outer\n  * inner|'), '* outer\n  * inner\n    |');
	// A list in a quote keeps the quote's `>`.
	assert.equal(enter('> * item|'), '> * item\n>   |');
});

test('a task continues under its text, not past its box — a second paragraph there is no code block', () => {
	assert.equal(enter('- [ ] task|'), '- [ ] task\n  |');
	// Enter twice and type: a second paragraph IN the item.
	const twice = enter(enter('- [ ] task|').replace('|', '|'));
	assert.equal(twice, '- [ ] task\n\n  |');
	const state = stateOf(twice.replace('|', 'more|'));
	const node = syntaxTree(state).resolveInner(state.doc.length - 1, -1);
	const path = [];
	for (let n = node; n; n = n.parent) path.push(n.name);
	assert.ok(path.includes('ListItem'), path.join(' < '));
	assert.ok(!path.includes('CodeBlock'), path.join(' < '));
});

test('a blank line left behind is empty, or the `>`s of the quote the list is in', () => {
	assert.equal(enter('* text\n  |'), '* text\n\n  |');
	assert.equal(enter('> * item\n>   |'), '> * item\n>\n>   |');
	// An empty quote line inside an item (a second Enter in the quote): the
	// quote ends, the item goes on.
	assert.equal(enter('* item\n    > a quote\n    > |'), '* item\n    > a quote\n\n  |');
});

test('Enter declines where CodeMirror\'s rule applies', () => {
	assert.equal(enter('* |'), null, 'an empty item: CodeMirror ends the list');
	assert.equal(enter('- [ ] |'), null, 'an empty task too');
	assert.equal(enter('|* item'), null, 'before the marker');
	assert.equal(enter('*| item'), null, 'inside the marker');
	assert.equal(enter('* item\n    > quo|te'), null, 'a quote inside the item continues the quote');
	assert.equal(enter('* item\n\n  ```\n  co|de\n  ```'), null, 'a fence inside the item');
	assert.equal(enter('prose|'), null);
	assert.equal(enter('* text\n|'), null, 'a blank line not indented to the item: out of the list');
});

test('⌘Enter starts the next item after the whole of this one, wherever the cursor is in it', () => {
	assert.equal(cmdEnter('* one|'), '* one\n* |');
	assert.equal(cmdEnter('* o|ne\n* two'), '* one\n* |\n* two');
	assert.equal(cmdEnter('* line one\n  line t|wo\n* next'), '* line one\n  line two\n* |\n* next');
	// After what is nested in it; and a nested item's sibling at its level.
	assert.equal(cmdEnter('* outer|\n  * inner'), '* outer\n  * inner\n* |');
	assert.equal(cmdEnter('* outer\n  * in|ner'), '* outer\n  * inner\n  * |');
	// From inside a quote within the item.
	assert.equal(cmdEnter('* item\n    > quo|te'), '* item\n    > quote\n* |');
	assert.equal(cmdEnter('> * a|'), '> * a\n> * |');
	assert.equal(cmdEnter('- [x] done|'), '- [x] done\n- [ ] |');
	assert.equal(cmdEnter('+   wide|'), '+   wide\n+   |');
});

test('⌘Enter numbers as CodeMirror does: the next number, the ones after moved up while they run on', () => {
	assert.equal(cmdEnter('1. a|\n2. b\n3. c'), '1. a\n2. |\n3. b\n4. c');
	assert.equal(cmdEnter('1) a|'), '1) a\n2) |');
	assert.equal(cmdEnter('1. a|\n1. b'), '1. a\n2. |\n1. b', 'a list of all 1. is left alone');
});

test('⌘Enter: a loose list gets its blank line; the blank line Enter left becomes the item', () => {
	assert.equal(cmdEnter('* a|\n\n* b'), '* a\n\n* |\n\n* b');
	assert.equal(cmdEnter('* a\n  |'), '* a\n* |');
	assert.equal(cmdEnter('* a\n  |\n\n* b'), '* a\n\n* |\n\n* b');
});

test('⌘Enter declines outside a list and on an empty item', () => {
	assert.equal(cmdEnter('prose|'), null);
	assert.equal(cmdEnter('> a quote|'), null);
	assert.equal(cmdEnter('* |'), null);
});
