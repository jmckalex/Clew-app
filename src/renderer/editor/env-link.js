// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// An environment's two names edited as one (the owner's ask, 2026-11-27:
// editing the name in `@begin(…)` or in `@end(…)` edits the other's too —
// "that would prevent it from ever generating a syntax error"). VS Code's
// linked editing of an HTML tag pair, for `@begin(name)`/`@end(name)`.
//
// The pair is the scanner's (jmd/jmarkdown-scan.js pairs them as the engine
// does, by name): while the cursor is in the name of an opener or a closer of
// one, `envLinkField` holds both names' ranges, mapped through every edit,
// and a typed or deleted change inside one is made in the other in the SAME
// transaction (one undo step). The link holds while the cursor stays in the
// name — through a name backspaced away and typed anew, when the scanner no
// longer pairs them — and goes when it leaves. Sigils stay as written
// (`@begin(<aside>)` ↔ `@end(aside)`): the names alone are linked.
//
// It stands aside for ⌥⌘E's own name field (env-insert.js, which copies its
// edits itself), for undo and redo (they restore both), for any change that
// is not the user's typing or deleting, and for one bringing a bracket or a
// line break into a name (no name then: the link goes).
import { EditorState, StateField } from '@codemirror/state';
import { scanFor } from './jmd/scan-cache.js';
import { envNameField } from './env-insert.js';

/** A line that may hold an opener's or a closer's name. */
const ENV_LINE = /^[ \t]*@(?:begin|end)\(/;
/** Inside a closer: its name, after the spaces and sigil the engine allows. */
const CLOSER_NAME = /^@end\([ \t]*[.<]?[ \t]*([A-Za-z][\w-]*\*?)/;
const NOT_A_NAME = /[()\n]/;

const inside = (sel, r) => sel.from >= r.from && sel.to <= r.to;

/**
 * The linked names around the selection: `{a, b}` — the opener's name and
 * the closer's — or null. Only a single selection inside one of them, on a
 * pair the scanner closes.
 *
 * @param {EditorState} state
 * @returns {{a: {from: number, to: number}, b: {from: number, to: number}} | null}
 */
export function linkAt(state) {
	const { ranges, main } = state.selection;
	if (ranges.length > 1) return null;
	const line = state.doc.lineAt(main.head);
	if (main.from < line.from || main.to > line.to || !ENV_LINE.test(line.text)) return null;
	for (const c of scanFor(state.doc).constructs) {
		if (c.kind !== 'environment' || !c.close || !c.name) continue;
		if (c.close.end < line.from || c.start > line.to) continue;
		const m = CLOSER_NAME.exec(state.doc.sliceString(c.close.start, Math.min(c.close.end, c.close.start + 200)));
		if (!m) continue;
		const at = c.close.start + m[0].length - m[1].length;
		const link = { a: { from: c.name.start, to: c.name.end }, b: { from: at, to: at + m[1].length } };
		if (inside(main, link.a) || inside(main, link.b)) return link;
	}
	return null;
}

const mapLink = (link, changes) => ({
	a: { from: changes.mapPos(link.a.from, -1), to: changes.mapPos(link.a.to, 1) },
	b: { from: changes.mapPos(link.b.from, -1), to: changes.mapPos(link.b.to, 1) },
});

/** The pair whose names are linked now, or null. */
export const envLinkField = StateField.define({
	create: (state) => linkAt(state),
	update(link, tr) {
		const { ranges, main } = tr.state.selection;
		if (link && tr.docChanged) {
			link = mapLink(link, tr.changes);
			const { doc } = tr.state;
			if (NOT_A_NAME.test(doc.sliceString(link.a.from, link.a.to)) || NOT_A_NAME.test(doc.sliceString(link.b.from, link.b.to))) link = null;
		}
		if (link && ranges.length === 1 && (inside(main, link.a) || inside(main, link.b))) return link;
		if (!tr.docChanged && !tr.selection) return link;
		return linkAt(tr.state);
	},
});

/**
 * Make the user's edit of one linked name in the other, in the same
 * transaction — `sequential`, so the copy's positions are the edited
 * document's.
 */
const linkMirror = EditorState.transactionFilter.of((tr) => {
	if (!tr.docChanged || !(tr.isUserEvent('input') || tr.isUserEvent('delete'))) return tr;
	if (tr.startState.field(envNameField, false)) return tr;
	const link = tr.startState.field(envLinkField, false);
	if (!link) return tr;
	let inA = true;
	let inB = true;
	let bracket = false;
	tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
		if (fromA < link.a.from || toA > link.a.to) inA = false;
		if (fromA < link.b.from || toA > link.b.to) inB = false;
		if (NOT_A_NAME.test(inserted.toString())) bracket = true;
	});
	if (bracket || inA === inB) return tr;
	const [src, dst] = inA ? [link.a, link.b] : [link.b, link.a];
	const name = tr.newDoc.sliceString(tr.changes.mapPos(src.from, -1), tr.changes.mapPos(src.to, 1));
	const from = tr.changes.mapPos(dst.from, -1);
	const to = tr.changes.mapPos(dst.to, 1);
	if (tr.newDoc.sliceString(from, to) === name) return tr;
	return [tr, { changes: { from, to, insert: name }, sequential: true }];
});

/** Linked environment names, for a note's editor (editor.js). */
export function envLinkedNames() {
	return [envLinkField, linkMirror];
}
