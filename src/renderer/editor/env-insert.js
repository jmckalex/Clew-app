// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// An environment whose name is typed ONCE (the owner's ask, 2026-11-26):
// ⌥⌘E (`format:begin-end`) writes
//
//     @begin(name)
//       ‸
//     @end(name)
//
// — or puts `@begin`/`@end` around the selected lines, indented a step — and
// then holds a NAME FIELD: both names highlighted, the cursor in the
// opener's, and whatever is typed, deleted or pasted there copied into the
// closer in the same transaction (one undo step with the edit). Enter or Tab
// ends it on the body line (an insert's empty line, the end of wrapped text),
// Esc where it is; moving the cursor out of the name, or an edit anywhere
// else, ends it too. The field starts with the last name given in this
// window, selected, so Enter alone repeats it; the first time, it is empty
// under a faint "name".
//
// The closer is the BARE name (`@begin(<aside>)` closes with `@end(aside)`,
// as format-spec.js#environmentBlock writes it — the engine matches `@end` by
// name, sigils or not). The body's indentation is the editor's own unit: the
// engine dedents an environment's body (begin-end-core.js#dedent), and two
// spaces is short of markdown's indented code. In live edit the closer stays
// revealed while the field is open with nothing added here: the cursor is in
// the opener, and an environment is revealed whole (live/model.js's extents
// are the opener's line and the closer's), so the name is seen arriving in
// both.

import { StateField, StateEffect, EditorState, EditorSelection, Prec } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, keymap } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { completionStatus } from '@codemirror/autocomplete';
import { isolateHistory } from '@codemirror/commands';

// ---- the plan (pure) --------------------------------------------------------

/** The closer's name for an opener's: the engine's sigils dropped —
 *  `<aside>` → `aside`, `.note` → `note`. */
export function closerName(name) {
	return name.replace(/^[<.]/, '').replace(/>$/, '');
}

const blank = (text) => text.trim() === '';
const leading = (text) => /^[ \t]*/.exec(text)[0];

/** The whitespace every non-blank line starts with (the engine's dedent rule:
 *  the actual characters, so tabs and spaces are never mixed up). */
function commonIndent(lines) {
	let prefix = null;
	for (const line of lines) {
		if (blank(line)) continue;
		const ws = leading(line);
		if (prefix === null) { prefix = ws; continue; }
		let i = 0;
		while (i < prefix.length && i < ws.length && prefix[i] === ws[i]) i += 1;
		prefix = prefix.slice(0, i);
	}
	return prefix ?? '';
}

/**
 * Where an environment goes and what it writes, for a document and its main
 * selection. With no selection: on the cursor's line if that line is blank,
 * else after it — a line is never split. With one: around the selected LINES
 * (a selection ending at a line's start leaves that line out), each indented
 * a step. A blank line separates the block from text above or below it.
 *
 * @param {import('@codemirror/state').Text} doc
 * @param {{from: number, to: number}} range - the main selection
 * @param {{unit?: string, name?: string}} [options] - the indentation unit,
 *   the name to start with
 * @returns {{from: number, to: number, insert: string,
 *   begin: {from: number, to: number}, end: {from: number, to: number},
 *   after: number}} the change, and in the NEW document the two names and
 *   where the cursor goes when the name is given
 */
export function planEnvironment(doc, range, { unit = '  ', name = '' } = {}) {
	const closer = closerName(name);
	let from, to, base, body, before = '', after = '';
	if (range.from === range.to) {
		const line = doc.lineAt(range.from);
		const prev = line.number > 1 ? doc.line(line.number - 1).text : null;
		const next = line.number < doc.lines ? doc.line(line.number + 1).text : null;
		if (blank(line.text)) {
			// The line itself becomes the block (its indentation kept).
			({ from, to } = line);
			base = line.text;
			if (prev !== null && !blank(prev)) before = '\n';
			if (next !== null && !blank(next)) after = '\n';
		} else {
			from = to = line.to;
			base = leading(line.text);
			before = '\n\n';
			if (next !== null && !blank(next)) after = '\n';
		}
		body = [base + unit];
	} else {
		const first = doc.lineAt(range.from);
		let last = doc.lineAt(range.to);
		if (range.to === last.from && last.number > first.number) last = doc.line(last.number - 1);
		const lines = [];
		for (let n = first.number; n <= last.number; n += 1) lines.push(doc.line(n).text);
		from = first.from;
		to = last.to;
		base = commonIndent(lines);
		body = lines.map((text) => (blank(text) ? '' : base + unit + text.slice(base.length)));
		if (first.number > 1 && !blank(doc.line(first.number - 1).text)) before = '\n';
		if (last.number < doc.lines && !blank(doc.line(last.number + 1).text)) after = '\n';
	}
	const opener = `${base}@begin(${name})`;
	const block = [opener, ...body, `${base}@end(${closer})`].join('\n');
	const start = from + before.length;
	const beginFrom = start + base.length + '@begin('.length;
	const bodyEnd = start + opener.length + 1 + body.join('\n').length;
	const endFrom = bodyEnd + 1 + base.length + '@end('.length;
	return {
		from, to,
		insert: before + block + after,
		begin: { from: beginFrom, to: beginFrom + name.length },
		end: { from: endFrom, to: endFrom + closer.length },
		after: bodyEnd,
	};
}

// ---- the name field ---------------------------------------------------------

/** The last name given, this window: what the next field starts with. */
let lastName = '';
export const lastEnvironmentName = () => lastName;
/** For tests: forget it. */
export const resetEnvironmentName = (name = '') => { lastName = name; };

const openField = StateEffect.define();
const closeField = StateEffect.define();

const mapField = (f, changes) => ({
	begin: { from: changes.mapPos(f.begin.from, -1), to: changes.mapPos(f.begin.to, 1) },
	end: { from: changes.mapPos(f.end.from, -1), to: changes.mapPos(f.end.to, 1) },
	after: changes.mapPos(f.after, 1),
});

/** The open name field, or null: `{begin, end, after}`. */
export const envNameField = StateField.define({
	create: () => null,
	update(value, tr) {
		for (const e of tr.effects) {
			if (e.is(closeField)) return null;
			if (e.is(openField)) return e.value;
		}
		if (!value) return value;
		const next = tr.docChanged ? mapField(value, tr.changes) : value;
		const sel = tr.state.selection;
		if (sel.ranges.length > 1 || sel.main.from < next.begin.from || sel.main.to > next.begin.to) return null;
		return next;
	},
	provide: (f) => EditorView.decorations.from(f, (field) => (field ? decorations(field) : Decoration.none)),
});

class NameHint extends WidgetType {
	eq() { return true; }
	toDOM() {
		const hint = document.createElement('span');
		hint.className = 'cm-env-name-hint';
		hint.textContent = 'name';
		return hint;
	}
	ignoreEvent() { return false; }
}

const nameMark = Decoration.mark({ class: 'cm-env-name' });
const nameHint = Decoration.widget({ widget: new NameHint(), side: 1 });

function decorations(field) {
	const ranges = [field.begin, field.end].map((r) => (r.from === r.to
		? nameHint.range(r.from)
		: nameMark.range(r.from, r.to)));
	return Decoration.set(ranges, true);
}

/**
 * Copy an edit of the opener's name into the closer's, in the same
 * transaction; close the field on an edit anywhere else (an undo, a paste
 * elsewhere) or one that makes the name no name (a bracket, a newline).
 */
const mirror = EditorState.transactionFilter.of((tr) => {
	const field = tr.startState.field(envNameField, false);
	if (!field || !tr.docChanged || tr.effects.some((e) => e.is(openField) || e.is(closeField))) return tr;
	let inside = true;
	tr.changes.iterChangedRanges((fromA, toA) => {
		if (fromA < field.begin.from || toA > field.begin.to) inside = false;
	});
	if (!inside) return [tr, { effects: closeField.of(null) }];
	const next = mapField(field, tr.changes);
	const name = tr.newDoc.sliceString(next.begin.from, next.begin.to);
	if (/[()\n]/.test(name)) return [tr, { effects: closeField.of(null) }];
	const closer = closerName(name);
	if (closer) lastName = name;
	if (tr.newDoc.sliceString(next.end.from, next.end.to) === closer) return tr;
	return [tr, { changes: { from: next.end.from, to: next.end.to, insert: closer }, sequential: true }];
});

/** Close the field: on the body line (Enter, Tab) or where the cursor is
 *  (Esc). An open completion keeps its Enter. */
function finish(view, toBody) {
	const field = view.state.field(envNameField, false);
	if (!field || completionStatus(view.state) === 'active') return false;
	const name = view.state.sliceDoc(field.begin.from, field.begin.to);
	if (closerName(name)) lastName = name;
	view.dispatch({
		effects: closeField.of(null),
		...(toBody ? { selection: { anchor: field.after }, scrollIntoView: true } : {}),
	});
	return true;
}

/** The name field's state and keys, for a note's editor (editor.js). */
export function envNameEntry() {
	return [
		envNameField,
		mirror,
		Prec.highest(keymap.of([
			{ key: 'Enter', run: (view) => finish(view, true) },
			{ key: 'Tab', run: (view) => finish(view, true) },
			{ key: 'Escape', run: (view) => finish(view, false) },
		])),
	];
}

/**
 * `format:begin-end`: write the environment (planEnvironment) and open its
 * name field, the last name selected. An editor without the field (none
 * today) gets the text and the opener's name selected.
 */
export function insertEnvironmentField(view) {
	const { state } = view;
	const plan = planEnvironment(state.doc, state.selection.main, {
		unit: state.facet(indentUnit), name: lastName,
	});
	const hasField = state.field(envNameField, false) !== undefined;
	view.dispatch({
		changes: { from: plan.from, to: plan.to, insert: plan.insert },
		selection: EditorSelection.single(plan.begin.from, plan.begin.to),
		effects: hasField ? openField.of({ begin: plan.begin, end: plan.end, after: plan.after }) : [],
		annotations: isolateHistory.of('full'),
		scrollIntoView: true,
		userEvent: 'input.environment',
	});
	view.focus();
	return true;
}
