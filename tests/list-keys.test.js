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
import { EditorState, EditorSelection, Transaction } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { noteMarkdown } from '../src/renderer/editor/jmd/markdown-config.js';
import { listEnterSpec, newListItemSpec, toggleTaskSpec } from '../src/renderer/editor/list-keys.js';
import { noteKeys } from '../src/renderer/editor/note-keys.js';

function stateOf(text) {
	const at = text.indexOf('|');
	const doc = text.slice(0, at) + text.slice(at + 1);
	return parsed(EditorState.create({ doc, selection: EditorSelection.cursor(at), extensions: [noteMarkdown({})] }));
}
/** `state` with its WHOLE syntax tree. A state's first parse has a time budget
 *  (about 20 ms), which a loaded machine can run out of even on a few lines;
 *  ensureSyntaxTree finishes the parse, but `syntaxTree(state)` — what the
 *  code under test reads — keeps the tree the state was made with: only the
 *  next state carries the finished one (measured). Until 2026-10-20 the
 *  helpers returned the state itself, and a full run once saw Enter decline. */
function parsed(state) {
	ensureSyntaxTree(state, state.doc.length, 5000);
	const next = state.update({}).state;
	assert.equal(syntaxTree(next).length, next.doc.length, 'the whole document parsed');
	return next;
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

// A key pressed through the note editor's REAL key stack (note-keys.js over
// noteMarkdown(), as editor.js installs them): each binding for the key in
// CodeMirror's precedence order (the keymap facet's), until one takes it —
// which is how a7baa98's Enter was missed: its spec was right, and
// lang-markdown's Enter, at Prec.high, ran before it on an item's first line.
function pressKey(text, key, markdown = noteMarkdown({}), mark = '|') {
	const at = text.indexOf(mark);
	let state = EditorState.create({
		doc: text.slice(0, at) + text.slice(at + 1),
		selection: EditorSelection.cursor(at),
		extensions: [markdown, noteKeys()],
	});
	state = parsed(state);
	const view = {
		get state() { return state; },
		dispatch(...specs) { state = (specs[0] instanceof Transaction ? specs[0] : state.update(...specs)).state; },
	};
	const taken = state.facet(keymap).flat().some((b) => b.key === key && b.run?.(view));
	if (!taken) return null;
	const head = state.selection.main.head;
	return state.doc.sliceString(0, head) + mark + state.doc.sliceString(head);
}

test('the note editor\'s markdown carries no keymap of its own; the cell editor\'s asks for lang-markdown\'s', () => {
	const keys = (md) => EditorState.create({ extensions: [md] }).facet(keymap).flat().length;
	assert.equal(keys(noteMarkdown({})), 0);
	assert.ok(keys(noteMarkdown({ keymap: true })) > 0);
});

test('a real Enter at the end of an item\'s FIRST line stays in the item (bullet, numbered, task)', () => {
	assert.equal(pressKey('* Alpha\n* Beta|', 'Enter'), '* Alpha\n* Beta\n  |');
	assert.equal(pressKey('1. one|\n2. two', 'Enter'), '1. one\n   |\n2. two');
	assert.equal(pressKey('- [ ] task|', 'Enter'), '- [ ] task\n  |');
	// With lang-markdown's keymap where markdown() puts it, ahead of the
	// stack — 1dc5c81 — the same key starts a new item: what this guards.
	assert.equal(pressKey('* Alpha\n* Beta|', 'Enter', noteMarkdown({ keymap: true })), '* Alpha\n* Beta\n* |');
});

test('every other Enter and Backspace is what it was with lang-markdown\'s keymap at Prec.high', () => {
	const cases = [
		['> a quote|', 'Enter'],
		['> a\n> |', 'Enter'],
		['prose|', 'Enter'],
		['* |', 'Enter'],
		['> |', 'Backspace'],
		['* |', 'Backspace'],
		['1. |', 'Backspace'],
		['* item\n  |', 'Backspace'],
		['text (|)', 'Backspace'],
		['plain|', 'Backspace'],
	];
	for (const [text, key] of cases) {
		assert.equal(pressKey(text, key), pressKey(text, key, noteMarkdown({ keymap: true })), `${key} at ${JSON.stringify(text)}`);
	}
	// A table's Enter is the table's — a new row, the cursor in the same
	// column (`§` here: a table's pipes are no cursor).
	const table = '| a | b |\n|---|---|\n| 1 | 2§ |';
	const row = '| a   | b   |\n| --- | --- |\n| 1   | 2   |\n|     | §    |';
	assert.equal(pressKey(table, 'Enter', noteMarkdown({}), '§'), row);
	assert.equal(pressKey(table, 'Enter', noteMarkdown({ keymap: true }), '§'), row);
});

const cmdL = (text) => press(toggleTaskSpec, text);

test('⌘L makes a line a task, as Obsidian\'s Toggle checkbox status does — and ticks or unticks one', () => {
	assert.equal(cmdL('Buy milk|'), '- [ ] Buy milk|');
	assert.equal(cmdL('|Buy milk'), '- [ ] |Buy milk', 'the cursor moves with its text');
	assert.equal(cmdL('- Buy milk|'), '- [ ] Buy milk|');
	assert.equal(cmdL('* Buy milk|'), '* [ ] Buy milk|', 'the marker kept');
	assert.equal(cmdL('1. Buy milk|'), '1. [ ] Buy milk|');
	assert.equal(cmdL('2) Buy milk|'), '2) [ ] Buy milk|');
	assert.equal(cmdL('|'), '- [ ] |', 'an empty line');
	assert.equal(cmdL('  - nested|'), '  - [ ] nested|');
	assert.equal(cmdL('    |'), '    - [ ] |');
	assert.equal(cmdL('-|'), '- [ ] |', 'a bare marker');
	assert.equal(cmdL('- [ ] task|'), '- [x] task|');
	assert.equal(cmdL('- [x] task|'), '- [ ] task|');
	assert.equal(cmdL('- [X] task|'), '- [ ] task|');
	assert.equal(cmdL('- [/] half done|'), '- [ ] half done|', 'any other status Clew knows unticks');
	assert.equal(cmdL('- [-] dropped|'), '- [ ] dropped|');
	// Only the statuses Clew knows (fill.js: [ xX/-]): a bracketed number is the item's text.
	assert.equal(cmdL('- [1] Smith 2020|'), '- [ ] [1] Smith 2020|', 'nothing lost');
	assert.equal(cmdL('1. [a] first|'), '1. [ ] [a] first|');
	assert.equal(cmdL('1. [ ] first|'), '1. [x] first|');
	assert.equal(cmdL('> quoted|'), '> - [ ] quoted|', 'after a quote\'s >');
	assert.equal(cmdL('> - [ ] in a quote|'), '> - [x] in a quote|');
	// The dialect: `*x*` at a line\'s start is strong, not a bullet.
	assert.equal(cmdL('*Strong* start|'), '- [ ] *Strong* start|');
	assert.equal(cmdL('-1 degrees|'), '- [ ] -1 degrees|');
	assert.equal(cmdL('# Heading|'), '- [ ] # Heading|');
});

test('⌘L on a selection: every line it touches, each by its own rule, in one change', () => {
	const doc = 'alpha\n- beta\n- [ ] gamma\n- [x] delta\nepsilon';
	const state = EditorState.create({ doc, selection: EditorSelection.range(0, doc.indexOf('delta') + 2), extensions: [noteMarkdown({})] });
	const next = state.update(toggleTaskSpec(state)).state;
	assert.equal(next.doc.toString(), '- [ ] alpha\n- [ ] beta\n- [x] gamma\n- [ ] delta\nepsilon');
	// A selection ending at a line\'s start does not take that line.
	const two = EditorState.create({ doc: 'a\nb\nc', selection: EditorSelection.range(0, 4), extensions: [noteMarkdown({})] });
	assert.equal(two.update(toggleTaskSpec(two)).state.doc.toString(), '- [ ] a\n- [ ] b\nc');
	// Several cursors, one on each of two lines.
	const multi = EditorState.create({ doc: 'a\nb', selection: EditorSelection.create([EditorSelection.cursor(1), EditorSelection.cursor(3)]),
		extensions: [noteMarkdown({}), EditorState.allowMultipleSelections.of(true)] });
	assert.equal(multi.update(toggleTaskSpec(multi)).state.doc.toString(), '- [ ] a\n- [ ] b');
});
