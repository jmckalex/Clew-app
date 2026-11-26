// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// ⌥⌘E's environment with its name typed once (src/renderer/editor/
// env-insert.js): where the block goes and what it writes, and the name field
// over a real EditorState — typed into the opener, copied into the closer,
// ended by Enter, Tab, Esc or an edit elsewhere — its keys pressed through
// the note editor's own key stack. `|` is the cursor; `§…§` a selection.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, EditorSelection, Transaction, Text } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { history, undo } from '@codemirror/commands';
import { noteMarkdown } from '../src/renderer/editor/jmd/markdown-config.js';
import { noteKeys } from '../src/renderer/editor/note-keys.js';
import {
	planEnvironment, closerName, envNameField, envNameEntry, insertEnvironmentField,
	lastEnvironmentName, resetEnvironmentName,
} from '../src/renderer/editor/env-insert.js';

/** A document and its selection from `|` (a cursor) or `§a§` (a range). */
function parse(text) {
	if (text.includes('§')) {
		const a = text.indexOf('§');
		const b = text.indexOf('§', a + 1) - 1;
		return { doc: text.replace(/§/g, ''), range: { from: a, to: b } };
	}
	const at = text.indexOf('|');
	return { doc: text.slice(0, at) + text.slice(at + 1), range: { from: at, to: at } };
}

/** What planEnvironment writes, with `[` `]` around each name it returns and
 *  `|` where Enter puts the cursor. */
function planned(text, options = {}) {
	const { doc, range } = parse(text);
	const plan = planEnvironment(Text.of(doc.split('\n')), range, options);
	const out = doc.slice(0, plan.from) + plan.insert + doc.slice(plan.to);
	// Inserted from the end; at one position the later mark first.
	const rank = { ']': 0, '[': 1, '|': 0 };
	const marks = [[plan.begin.from, '['], [plan.begin.to, ']'], [plan.end.from, '['], [plan.end.to, ']'], [plan.after, '|']]
		.sort((x, y) => y[0] - x[0] || rank[x[1]] - rank[y[1]]);
	let s = out;
	for (const [at, mark] of marks) s = s.slice(0, at) + mark + s.slice(at);
	return s;
}

test('an environment on a blank line takes the line, a blank line from the text around it', () => {
	assert.equal(planned('|'), '@begin([])\n  |\n@end([])');
	assert.equal(planned('Para one.\n|\nPara two.'), 'Para one.\n\n@begin([])\n  |\n@end([])\n\nPara two.');
	assert.equal(planned('Para one.\n\n|\n\nPara two.'), 'Para one.\n\n@begin([])\n  |\n@end([])\n\nPara two.');
	// A blank line's own indentation is the block's.
	assert.equal(planned('\t|'), '\t@begin([])\n\t  |\n\t@end([])');
});

test('on a line with text it goes after the line, which is never split', () => {
	assert.equal(planned('Some |text.'), 'Some text.\n\n@begin([])\n  |\n@end([])');
	assert.equal(planned('|Some text.\nMore.'), 'Some text.\n\n@begin([])\n  |\n@end([])\n\nMore.');
	assert.equal(planned('Some text.|\n\nMore.'), 'Some text.\n\n@begin([])\n  |\n@end([])\n\nMore.');
});

test('the name it starts with is in both, the closer\'s bare', () => {
	assert.equal(planned('|', { name: 'theorem' }), '@begin([theorem])\n  |\n@end([theorem])');
	assert.equal(planned('|', { name: '<aside>' }), '@begin([<aside>])\n  |\n@end([aside])');
	assert.deepEqual(['<aside>', '.note', 'proof', '<asi', ''].map(closerName), ['aside', 'note', 'proof', 'asi', '']);
	assert.equal(planned('|', { unit: '    ' }), '@begin([])\n    |\n@end([])');
});

test('a selection is wrapped by whole lines, each indented a step, blank lines left blank', () => {
	assert.equal(planned('Intro.\n\nLine §one\nLine two§.\n\nAfter.'),
		'Intro.\n\n@begin([])\n  Line one\n  Line two.|\n@end([])\n\nAfter.');
	// Ending at a line's start leaves that line out; text next to the
	// selection is set off by a blank line.
	assert.equal(planned('Above.\n§One.\n\nTwo.\n§Below.'),
		'Above.\n\n@begin([])\n  One.\n\n  Two.|\n@end([])\n\nBelow.');
	// Lines indented alike keep it as the block's, and their own beyond it.
	assert.equal(planned('§  - a\n    - b§'), '  @begin([])\n    - a\n      - b|\n  @end([])');
});

// ---- the name field, over a real state --------------------------------------

const extensions = [history(), noteMarkdown({}), noteKeys(), envNameEntry()];

/** A view stand-in over a state: what the commands and keys are handed. */
function viewOf(text) {
	const { doc, range } = parse(text);
	let state = EditorState.create({ doc, selection: EditorSelection.single(range.from, range.to), extensions });
	return {
		get state() { return state; },
		dispatch(...specs) { state = (specs[0] instanceof Transaction ? specs[0] : state.update(...specs)).state; },
		focus() {},
	};
}
/** Type `text` at the selection, a key at a time, as typing does. */
function type(view, text) {
	for (const ch of text) {
		const { from, to } = view.state.selection.main;
		view.dispatch({ changes: { from, to, insert: ch }, selection: { anchor: from + 1 }, userEvent: 'input.type' });
	}
}
/** A key through the editor's key stack, in precedence order; was it taken? */
const press = (view, key) => view.state.facet(keymap).flat().some((b) => b.key === key && b.run?.(view));
const shown = (view) => {
	const { from, to } = view.state.selection.main;
	const doc = view.state.doc.toString();
	return from === to ? doc.slice(0, from) + '|' + doc.slice(from) : doc.slice(0, from) + '§' + doc.slice(from, to) + '§' + doc.slice(to);
};

beforeEach(() => resetEnvironmentName());

test('what is typed in the opener\'s name is the closer\'s too; Enter goes to the body line', () => {
	const view = viewOf('Text.\n|');
	insertEnvironmentField(view);
	assert.equal(shown(view), 'Text.\n\n@begin(|)\n  \n@end()');
	type(view, 'lemma');
	assert.equal(shown(view), 'Text.\n\n@begin(lemma|)\n  \n@end(lemma)');
	assert.equal(press(view, 'Enter'), true);
	assert.equal(shown(view), 'Text.\n\n@begin(lemma)\n  |\n@end(lemma)');
	assert.equal(view.state.field(envNameField), null);
	// The field closed, Enter is Enter again.
	type(view, 'Body.');
	assert.equal(view.state.doc.toString(), 'Text.\n\n@begin(lemma)\n  Body.\n@end(lemma)');
});

test('the next field starts with the last name, selected: typing replaces it, Enter repeats it', () => {
	resetEnvironmentName('theorem');
	const view = viewOf('|');
	insertEnvironmentField(view);
	assert.equal(shown(view), '@begin(§theorem§)\n  \n@end(theorem)');
	type(view, 'pr');
	assert.equal(shown(view), '@begin(pr|)\n  \n@end(pr)');
	press(view, 'Backspace');
	type(view, 'roof');
	assert.equal(shown(view), '@begin(proof|)\n  \n@end(proof)');
	press(view, 'Tab');
	assert.equal(shown(view), '@begin(proof)\n  |\n@end(proof)');
	assert.equal(lastEnvironmentName(), 'proof');

	const again = viewOf('|');
	insertEnvironmentField(again);
	press(again, 'Enter');
	assert.equal(shown(again), '@begin(proof)\n  |\n@end(proof)');
});

test('a wrapped selection: the name, then Enter at the end of what was wrapped', () => {
	const view = viewOf('§First line.\nSecond line.§');
	insertEnvironmentField(view);
	type(view, 'clew-only');
	press(view, 'Enter');
	assert.equal(shown(view), '@begin(clew-only)\n  First line.\n  Second line.|\n@end(clew-only)');
});

test('the element form closes with the bare name', () => {
	const view = viewOf('|');
	insertEnvironmentField(view);
	type(view, '<asi');
	assert.equal(view.state.doc.toString(), '@begin(<asi)\n  \n@end(asi)');
	type(view, 'de>');
	assert.equal(view.state.doc.toString(), '@begin(<aside>)\n  \n@end(aside)');
});

test('Esc ends the field where the cursor is; so do moving out and an edit elsewhere', () => {
	let view = viewOf('|');
	insertEnvironmentField(view);
	type(view, 'abc');
	assert.equal(press(view, 'Escape'), true);
	assert.equal(shown(view), '@begin(abc|)\n  \n@end(abc)');
	assert.equal(view.state.field(envNameField), null);
	assert.equal(press(view, 'Escape'), false, 'Esc is no longer the field\'s');

	view = viewOf('|');
	insertEnvironmentField(view);
	type(view, 'ab');
	view.dispatch({ selection: { anchor: view.state.doc.length } });
	assert.equal(view.state.field(envNameField), null);
	type(view, 'c');
	assert.equal(view.state.doc.toString(), '@begin(ab)\n  \n@end(ab)c', 'not copied once ended');

	view = viewOf('|');
	insertEnvironmentField(view);
	type(view, 'ab');
	view.dispatch({ changes: { from: view.state.doc.length, insert: 'x' } });
	assert.equal(view.state.field(envNameField), null);
	assert.equal(view.state.doc.toString(), '@begin(ab)\n  \n@end(ab)x');
});

test('a bracket or a deleted "(" ends the field, and nothing is copied', () => {
	let view = viewOf('|');
	insertEnvironmentField(view);
	type(view, 'a)');
	assert.equal(view.state.doc.toString(), '@begin(a))\n  \n@end(a)');
	assert.equal(view.state.field(envNameField), null);

	resetEnvironmentName();
	view = viewOf('|');
	insertEnvironmentField(view);
	// closeBrackets' Backspace takes the empty pair.
	press(view, 'Backspace');
	assert.equal(view.state.doc.toString(), '@begin\n  \n@end()');
	assert.equal(view.state.field(envNameField), null);
});

test('undo takes the name back from both, then the environment as one step', () => {
	const view = viewOf('Text.|');
	insertEnvironmentField(view);
	type(view, 'note');
	undo(view);
	assert.equal(view.state.doc.toString(), 'Text.\n\n@begin()\n  \n@end()');
	undo(view);
	assert.equal(view.state.doc.toString(), 'Text.');
});

test('Enter, Tab and Esc are the field\'s only while it is open', () => {
	// The same as the note's keys give with no field installed at all.
	const without = (text, key) => {
		const { doc, range } = parse(text);
		let state = EditorState.create({ doc, selection: EditorSelection.cursor(range.from), extensions: [history(), noteMarkdown({}), noteKeys()] });
		const view = { get state() { return state; }, dispatch(...specs) { state = (specs[0] instanceof Transaction ? specs[0] : state.update(...specs)).state; } };
		press(view, key);
		return shown(view);
	};
	for (const [text, key] of [['* item|', 'Enter'], ['Para|graph', 'Enter'], ['| x', 'Tab'], ['@begin(x|)', 'Enter']]) {
		const view = viewOf(text);
		assert.equal(view.state.field(envNameField), null);
		press(view, key);
		assert.equal(shown(view), without(text, key), `${key} at ${JSON.stringify(text)}`);
	}
});
