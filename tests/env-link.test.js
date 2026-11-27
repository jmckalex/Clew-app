// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// An environment's two names edited as one (editor/env-link.js; the owner's
// ask, 2026-11-27): an edit of the name in `@begin(…)` or in `@end(…)` is
// made in the other in the same transaction — over a real EditorState, by
// transactions shaped as CodeMirror's typing and deleting make them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, EditorSelection, Transaction } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';

globalThis.window ??= { clew: { invoke: async () => null, on: () => () => {} }, addEventListener() {}, removeEventListener() {} };
const { envLinkedNames, envLinkField } = await import('../src/renderer/editor/env-link.js');
const { envNameEntry, envNameField, insertEnvironmentField } = await import('../src/renderer/editor/env-insert.js');

const DOC = '# Note\n\n@begin(theorem)\nA claim.\n@end(theorem)\n\nAfter.\n';

/** A state over `doc`, the caret at `at` (a string: just after its first occurrence). */
function make(doc, at, extra = []) {
	const pos = typeof at === 'string' ? doc.indexOf(at) + at.length : at;
	return EditorState.create({ doc, selection: { anchor: pos }, extensions: [...EXTENSIONS, ...extra] });
}
// In the note editor's order: live edit's compartment (which holds the
// linked names) comes before ⌥⌘E's field (editor.js). CodeMirror runs
// transaction filters last to first, so ⌥⌘E's copies first there.
const EXTENSIONS = [history(), envLinkedNames(), envNameEntry()];
/** Type `text` at the caret a key at a time, as typing does. */
const type = (state, text) => {
	for (const ch of text) state = state.update(state.replaceSelection(ch), { userEvent: 'input.type' }).state;
	return state;
};
/** Backspace at the caret. */
const backspace = (state) => {
	const at = state.selection.main.head;
	return state.update({ changes: { from: at - 1, to: at }, selection: { anchor: at - 1 }, userEvent: 'delete.backward' }).state;
};
const envLines = (state) => state.doc.toString().split('\n').filter((l) => /@(begin|end)\(/.test(l));

test('a name typed in the opener is typed in the closer, and one typed in the closer in the opener', () => {
	let s = make(DOC, '@begin(theorem');
	s = type(s, 's');
	assert.deepEqual(envLines(s), ['@begin(theorems)', '@end(theorems)']);
	s = make(DOC, '@end(the');
	s = type(s, 'X');
	assert.deepEqual(envLines(s), ['@begin(theXorem)', '@end(theXorem)']);
	s = type(make(DOC, '@begin('), 'my');
	assert.deepEqual(envLines(s), ['@begin(mytheorem)', '@end(mytheorem)'], 'at the name\'s start');
});

test('a name backspaced away and typed anew stays linked: the two never differ', () => {
	let s = make(DOC, '@begin(theorem');
	for (let i = 0; i < 'theorem'.length; i += 1) s = backspace(s);
	assert.deepEqual(envLines(s), ['@begin()', '@end()'], 'emptied together');
	s = type(s, 'lemma');
	assert.deepEqual(envLines(s), ['@begin(lemma)', '@end(lemma)']);
	// A name the engine would not take (a digit first) is no pair to the
	// scanner, and stays linked all the same while the cursor is in it.
	s = make(DOC, '@begin(theorem');
	for (let i = 0; i < 'theorem'.length; i += 1) s = backspace(s);
	s = type(s, '2nd');
	assert.deepEqual(envLines(s), ['@begin(2nd)', '@end(2nd)']);
});

test('a selected name replaced, and a paste, are made in both', () => {
	const start = DOC.indexOf('theorem');
	let s = EditorState.create({ doc: DOC, selection: { anchor: start, head: start + 7 }, extensions: EXTENSIONS });
	s = s.update(s.replaceSelection('proof'), { userEvent: 'input.paste' }).state;
	assert.deepEqual(envLines(s), ['@begin(proof)', '@end(proof)']);
});

test('one undo takes back both', () => {
	let s = make(DOC, '@begin(theorem');
	s = type(s, 's');
	let undone = null;
	undo({ state: s, dispatch: (tr) => { undone = tr.state; } });
	assert.deepEqual(envLines(undone), ['@begin(theorem)', '@end(theorem)']);
});

test('nested: an inner name edits its own closer only', () => {
	const doc = '@begin(clew-only)\nOuter.\n@begin(proof)\nInner.\n@end(proof)\n@end(clew-only)\n';
	const s = type(make(doc, '@begin(proof'), 's');
	assert.deepEqual(envLines(s), ['@begin(clew-only)', '@begin(proofs)', '@end(proofs)', '@end(clew-only)']);
});

test('the names alone are linked: a sigil and spaces stay as written, on either side, edited from either', () => {
	const doc = '@begin( <aside> )\nAside.\n@end(aside)\n';
	const s = type(make(doc, '@begin( <aside'), 'x');
	assert.deepEqual(envLines(s), ['@begin( <asidex> )', '@end(asidex)']);
	// The closer spaced, and the closer with its sigil (Clew-boss's gap,
	// 2026-11-27: the closer's name read after them, or neither linked).
	for (const closer of ['@end( aside )', '@end(<aside>)', '@end( < aside > )']) {
		const text = `@begin(aside)\nAside.\n${closer}\n`;
		const fromOpener = type(make(text, '@begin(aside'), 'y');
		assert.deepEqual(envLines(fromOpener), ['@begin(asidey)', closer.replace('aside', 'asidey')], `${closer}, the opener edited`);
		const inCloser = text.indexOf('aside', text.indexOf('@end(')) + 'aside'.length;
		const fromCloser = type(make(text, inCloser), 'z');
		assert.deepEqual(envLines(fromCloser), ['@begin(asidez)', closer.replace('aside', 'asidez')], `${closer}, the closer edited`);
	}
});

test('nothing is linked off a name, or for a pair the engine would not make, or with two cursors', () => {
	assert.equal(make(DOC, 'A cla').field(envLinkField), null, 'in the body');
	assert.equal(make(DOC, '@begi').field(envLinkField), null, 'in the keyword');
	assert.deepEqual(envLines(type(make(DOC, 'A claim'), 'x')), ['@begin(theorem)', '@end(theorem)'], 'typing in the body changes no name');
	const crossed = '@begin(aa)\nx\n@end(bb)\n';
	assert.deepEqual(envLines(type(make(crossed, '@begin(aa'), 'z')), ['@begin(aaz)', '@end(bb)'], 'no pair: nothing linked');
	const at = DOC.indexOf('theorem') + 7;
	const two = EditorState.create({
		doc: DOC, selection: EditorSelection.create([EditorSelection.cursor(at), EditorSelection.cursor(0)], 0),
		extensions: [...EXTENSIONS, EditorState.allowMultipleSelections.of(true)],
	});
	assert.equal(two.field(envLinkField), null, 'two cursors');
});

test('a bracket or a line break in a name links nothing, and ends the link', () => {
	let s = type(make(DOC, '@begin(theorem'), ')');
	assert.deepEqual(envLines(s), ['@begin(theorem))', '@end(theorem)'], 'not copied');
	assert.equal(s.field(envLinkField), null, 'and the link is gone');
	// Enter inside a name, as CodeMirror's Enter makes it (Clew-boss's gap,
	// 2026-11-27: without the line break in NOT_A_NAME it reached the closer).
	s = make(DOC, '@begin(theo');
	s = s.update(s.replaceSelection('\n'), { userEvent: 'input' }).state;
	assert.deepEqual(s.doc.toString().split('\n').slice(2, 6), ['@begin(theo', 'rem)', 'A claim.', '@end(theorem)'], 'the line break not copied');
	assert.equal(s.field(envLinkField), null, 'and the link is gone');
});

test('only the user\'s own typing and deleting: a change from elsewhere is not copied', () => {
	const s = make(DOC, '@begin(theorem');
	const other = s.update({ changes: { from: s.selection.main.head, insert: 's' } }).state;
	assert.deepEqual(envLines(other), ['@begin(theorems)', '@end(theorem)']);
});

test('⌥⌘E\'s own name field copies its edits itself: no second copy, whichever filter runs first', () => {
	// The editor's order, and the other (the linked names registered after
	// ⌥⌘E's field — their filter then running first).
	for (const extensions of [EXTENSIONS, [history(), envNameEntry(), envLinkedNames()]]) {
		let s = EditorState.create({ doc: 'Text.\n', selection: { anchor: 5 }, extensions });
		insertEnvironmentField({
			get state() { return s; },
			dispatch(...specs) { s = (specs[0] instanceof Transaction ? specs[0] : s.update(...specs)).state; },
			focus() {},
		});
		s = type(s, 'lemma');
		assert.deepEqual(envLines(s), ['@begin(lemma)', '@end(lemma)']);
		assert.ok(s.field(envNameField), 'its field still open: the linked copy did not close it');
	}
});
