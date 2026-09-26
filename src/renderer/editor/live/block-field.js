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
import { TableWidget } from './widgets/table.js';
import { ImageWidget } from './widgets/image.js';
import { imageSpec } from './images.js';
import {
	FramePlaceholder, frameHeightField, setFrameHeight, frameKind, wantsFrame, defaultHeight,
} from './frames.js';
import { inlineTokens } from './inline-dom.js';
import { splitRow, alignmentOf } from '../tables.js';
import { cellRanges, isExtendedTable, CELL_EDIT_LIMITS } from './table-cell-model.js';
import { activeCellOf } from './active-cell.js';
import { numberDocument } from './numbering.js';

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
	const numbering = numberDocument(doc, config.numbered?.size ? { numbered: config.numbered } : undefined);
	const block = (c, widget) =>
		out.push(Decoration.replace({ widget, block: true }).range(c.lineFrom, c.lineTo));

	const headings = model.filter((c) => c.kind === 'heading').map((h) => ({
		depth: h.depth,
		text: text(h.hidden[0]?.to ?? h.from, h.hidden[1]?.from ?? h.to).trim(),
		pos: h.hidden[0]?.to ?? h.from,
	}));

	// Tier C placeholders. An edit to a block changes its id (the id is a
	// hash of the text), so a height is also remembered by kind + ordinal:
	// the edited block keeps its size instead of snapping to the default.
	const heights = state.field(frameHeightField, false) ?? new Map();
	const ordinal = new Map();
	for (const c of model) {
		if (!wantsFrame(c, config)) continue;
		const kind = frameKind(c);
		const n = ordinal.get(kind) ?? 0;
		ordinal.set(kind, n + 1);
		if (live.revealed.has(c.id)) continue;
		const measured = heights.get(c.id) ?? heights.get(`${kind}#${n}`);
		block(c, new FramePlaceholder(c.id, kind, measured ?? defaultHeight(kind), measured !== undefined));
	}

	for (const c of model) {
		if (c.tier === 'B' && c.level === 'block' && !live.revealed.has(c.id)) {
			if (c.kind === 'table') block(c, tableWidget(state, c, model));
			else if (c.kind === 'image') block(c, new ImageWidget(imageSpec(c, config.notePath, true)));
			continue;
		}
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
				// `@begin(equation)` is numbered; `$$…$$` is not (numbering.js).
				const tag = c.env === 'equation' && c.environment
					? numbering.lines.get(doc.lineAt(c.from).number)?.number ?? '' : '';
				block(c, new MathWidget(tex, true, text(c.from, c.to), true, tag));
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
		const folds = tr.effects.some((e) => e.is(setCalloutFold) || e.is(setFrameHeight));
		if (live === value.live && !folds && !(tr.selection && hasFoldedCallouts(tr.state))) return value;
		return { live, deco: build(tr.state) };
	},
	provide: (field) => EditorView.decorations.from(field, (value) => value.deco),
});

/**
 * A table construct's widget. Cells come from the table's TEXT
 * (live/table-cell-model.js#cellRanges — lezer has no node for an empty
 * cell, and an empty cell must be editable); each cell's inline markdown is
 * tokenised from the model. An extended table (colspan/rowspan/widths) or a
 * very large one is drawn but edited as source (§5.5c).
 */
function tableWidget(state, c, model) {
	const doc = state.doc;
	const first = doc.lineAt(c.from).number;
	const last = doc.lineAt(c.to).number;
	const ranges = cellRanges(doc, first, last);
	const rows = ranges.rows.map((row, r) => ({
		header: r === 0,
		cells: row.map((cell) => ({
			tokens: inlineTokens(doc, cell.from, cell.to, model),
			offset: cell.from - c.lineFrom,
		})),
	}));
	const align = ranges.delimiterLine ? splitRow(doc.line(ranges.delimiterLine).text).map(alignmentOf) : [];
	const lines = [];
	for (let n = first; n <= last; n += 1) lines.push(doc.line(n).text);
	const cols = Math.max(0, ...ranges.rows.map((r) => r.length));
	const extended = isExtendedTable(lines);
	const tooBig = ranges.rows.length > CELL_EDIT_LIMITS.rows || cols > CELL_EDIT_LIMITS.cols;
	const cell = activeCellOf(state);
	const active = cell && cell.from >= c.from && cell.to <= c.to ? { row: cell.row, col: cell.col } : null;
	return new TableWidget(doc.sliceString(c.from, c.to), rows, align, {
		editable: !extended && !tooBig && Boolean(ranges.delimiterLine),
		reason: extended ? 'Extended table (merged cells or widths) — edited as source'
			: tooBig ? `Large table (over ${CELL_EDIT_LIMITS.rows} rows or ${CELL_EDIT_LIMITS.cols} columns) — edited as source` : '',
		active,
	});
}

function hasFoldedCallouts(state) {
	return state.field(liveStateField).model.some((c) => c.kind === 'callout' && c.fold);
}
