// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Live edit's BLOCK replacements (plan §3.2, §5.5): everything that swaps
// whole lines for a rendering — display math, a horizontal rule, the table
// of contents, the properties, a folded callout's body, the kanban banner.
// CodeMirror computes the viewport before view plugins run, so anything that
// changes the vertical block structure MUST come from a StateField; this is
// that field. It rebuilds whenever the live state object changes (a new
// model, or a different revealed set — cursor moves that touch nothing keep
// the same object, live/reveal-field.js).
//
// Callout folding is view state, not document state: the `+`/`-` in the
// source is the INITIAL state, as in reading mode, and toggling a chevron
// edits nothing (calloutFoldField).
import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration } from '@codemirror/view';
import { liveStateField } from './reveal-field.js';
import { MathWidget } from './widgets/math.js';
import { HrWidget, TocWidget, BannerWidget, PropertiesWidget } from './widgets/blocks.js';

/** Toggle a foldable callout: `{ id, folded }`. */
export const setCalloutFold = StateEffect.define();

/** Callout id → folded, for the ones the user has toggled. */
export const calloutFoldField = StateField.define({
	create: () => new Map(),
	update(value, tr) {
		let next = value;
		for (const e of tr.effects) {
			if (!e.is(setCalloutFold)) continue;
			if (next === value) next = new Map(value);
			next.set(e.value.id, e.value.folded);
		}
		return next;
	},
});

/** Is this callout folded now? Its `-` marker until someone toggles it. */
export function calloutFolded(state, callout) {
	const toggled = state.field(calloutFoldField, false)?.get(callout.id);
	return toggled ?? callout.fold === '-';
}

function build(state) {
	const live = state.field(liveStateField);
	const { model, config } = live;
	const doc = state.doc;
	const out = [];
	const sel = state.selection.ranges;
	const text = (a, b) => doc.sliceString(a, b);
	const block = (c, widget) =>
		out.push(Decoration.replace({ widget, block: true }).range(c.lineFrom, c.lineTo));

	const headings = model.filter((c) => c.kind === 'heading').map((h) => ({
		depth: h.depth,
		text: text(h.hidden[0]?.to ?? h.from, h.hidden[1]?.from ?? h.to).trim(),
		pos: h.hidden[0]?.to ?? h.from,
	}));

	for (const c of model) {
		if (c.tier !== 'A') continue;
		if (c.kind === 'callout' && c.fold && c.body && calloutFolded(state, c)) {
			// A folded body hides, unless the cursor is in it (arrow keys can
			// still walk in; the lines then show rather than trap the caret).
			const inside = sel.some((r) => r.to >= c.body.from && r.from <= c.body.to);
			if (!inside) out.push(Decoration.replace({ block: true }).range(c.body.from, c.body.to));
			continue;
		}
		if (c.level !== 'block' || live.revealed.has(c.id)) continue;
		switch (c.kind) {
			case 'hr':
				block(c, new HrWidget());
				break;
			case 'math': {
				if (!config.renderMath) break;
				const tex = c.environment
					? `\\begin{${c.env}}\n${text(c.body.start ?? c.body.from, c.body.end ?? c.body.to)}\n\\end{${c.env}}`
					: text(c.body.from, c.body.to);
				block(c, new MathWidget(tex, true, text(c.from, c.to), true));
				break;
			}
			case 'toc':
				block(c, new TocWidget(headings));
				break;
			case 'frontmatter':
				if (!c.closed) break;
				block(c, new PropertiesWidget(text(c.from, c.to)));
				break;
			default:
		}
	}

	// A kanban board note: say where the board is (plan §5.5).
	const front = model.find((c) => c.kind === 'frontmatter');
	if (front && /(^|\n)kanban-plugin\s*:/.test(text(front.from, front.to))) {
		out.push(Decoration.widget({
			widget: new BannerWidget('This note is a Kanban board — boards render in reading mode.',
				{ label: 'Reading mode', command: 'workspace:mode-reading' }),
			block: true, side: -1,
		}).range(0));
	}
	return Decoration.set(out, true);
}

export const blockField = StateField.define({
	create: (state) => ({ live: state.field(liveStateField), deco: build(state) }),
	update(value, tr) {
		const live = tr.state.field(liveStateField);
		const folds = tr.effects.some((e) => e.is(setCalloutFold));
		if (live === value.live && !folds && !(tr.selection && hasFoldedCallouts(tr.state))) return value;
		return { live, deco: build(tr.state) };
	},
	provide: (field) => EditorView.decorations.from(field, (value) => value.deco),
});

function hasFoldedCallouts(state) {
	return state.field(liveStateField).model.some((c) => c.kind === 'callout' && c.fold);
}
