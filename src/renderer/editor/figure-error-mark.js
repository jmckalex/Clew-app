// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The source line a figure's error is about, marked in the editor (the
// owner's report, 2026-10-03). The live preview pane renders the figure the
// cursor is in; when it fails, the pane finds the fence line the error names
// (shared/figure-errors.js) and sets it here: a tint and a bar at the line's
// left edge, the message as its tooltip — a LINE decoration, so nothing
// moves. It goes when the figure renders, or when the cursor leaves it.
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

/** `{ pos, message }` to mark the line holding `pos`, or null to clear. */
export const setFigureError = StateEffect.define();

export const figureErrorField = StateField.define({
	create: () => Decoration.none,
	update(marks, tr) {
		marks = marks.map(tr.changes);
		for (const e of tr.effects) {
			if (!e.is(setFigureError)) continue;
			if (!e.value) { marks = Decoration.none; continue; }
			const line = tr.state.doc.lineAt(Math.min(Math.max(0, e.value.pos), tr.state.doc.length));
			marks = Decoration.set([Decoration.line({
				class: 'cm-figure-error',
				attributes: { title: e.value.message },
			}).range(line.from)]);
		}
		return marks;
	},
	provide: (f) => EditorView.decorations.from(f),
});
