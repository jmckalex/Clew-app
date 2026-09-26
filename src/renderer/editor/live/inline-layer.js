// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Live edit's INLINE concealment (plan §5.2): a ViewPlugin that, for the
// visible ranges only, hides the delimiters of every inline construct the
// selection does not reveal, styles what remains, and swaps the constructs
// that have a rendering (math, footnotes, citations, chips) for widgets.
//
// A ViewPlugin may not change the vertical block structure — no block
// widgets, no replacement across a line break (CodeMirror computes the
// viewport before plugins run). Everything here stays on one line; a
// construct whose replacement WOULD cross a line (a `$…$` broken over two
// lines, say) is simply left as source. Block-level work is block-field.js.
//
// What a revealed construct looks like is not this file's business: it is
// source mode — the overlay's jmd-* faces and the theme's cmt-* classes.
import { ViewPlugin, Decoration } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { liveStateField } from './reveal-field.js';
import { MathWidget } from './widgets/math.js';
import { ChipWidget } from './widgets/chip.js';
import { vaultStore } from '../../state/vault-store.js';
import { citationLabel } from '../complete/citations.js';

const HIDE = Decoration.replace({});
const markCache = new Map();
function markOf(cls) {
	let deco = markCache.get(cls);
	if (!deco) markCache.set(cls, (deco = Decoration.mark({ class: cls })));
	return deco;
}

/** Inline constructs whose delimiters hide and whose body gets a class. */
const STYLED = new Set(['strong', 'intense', 'italic', 'underline', 'highlight', 'strike', 'sub', 'sup', 'code']);

/**
 * The decorations for the visible part of the document.
 *
 * @param {import('@codemirror/view').EditorView} view
 * @returns {import('@codemirror/view').DecorationSet}
 */
function build(view) {
	const { state } = view;
	const live = state.field(liveStateField);
	const { config, model } = live;
	const doc = state.doc;
	const out = [];
	const visible = view.visibleRanges;
	const inView = (from, to) => visible.some((r) => from <= r.to && to >= r.from);
	const oneLine = (from, to) => doc.lineAt(from).number === doc.lineAt(to).number;
	const text = (r) => doc.sliceString(r.from, r.to);
	/** Ranges replaced whole: nothing inside them is decorated. */
	const replaced = [];

	// Footnotes are numbered in document order, as the engine numbers them.
	const footnoteNumber = new Map();
	for (const c of model) if (c.kind === 'footnote') footnoteNumber.set(c.id, footnoteNumber.size + 1);

	const hide = (r) => { if (r.to > r.from) out.push(HIDE.range(r.from, r.to)); };
	const mark = (from, to, cls, attributes) => {
		if (to <= from) return;
		out.push((attributes ? Decoration.mark({ class: cls, attributes }) : markOf(cls)).range(from, to));
	};
	const widget = (from, to, w) => {
		out.push(Decoration.replace({ widget: w }).range(from, to));
		replaced.push({ from, to });
	};

	for (const c of model) {
		if (c.tier !== 'A' || (c.level !== 'inline' && c.kind !== 'blockId')) continue;
		if (!inView(c.from, c.to) || live.revealed.has(c.id)) continue;
		if (replaced.some((r) => c.from >= r.from && c.to <= r.to)) continue;
		// Replacements may not cross a line break here.
		if (c.hidden.some((h) => !oneLine(h.from, h.to))) continue;

		if (STYLED.has(c.kind)) {
			c.hidden.forEach(hide);
			mark(c.from, c.to, `le-${c.kind}`);
			continue;
		}
		switch (c.kind) {
			case 'escape':
			case 'hardBreak':
				c.hidden.forEach(hide);
				break;
			case 'math': {
				if (!config.renderMath || !oneLine(c.from, c.to)) break;
				widget(c.from, c.to, new MathWidget(text(c.body), c.display, text(c)));
				break;
			}
			case 'link':
				c.hidden.forEach(hide);
				mark(c.label.from, c.label.to, 'le-link', { 'data-le-href': c.url, title: c.url });
				break;
			case 'autolink':
				c.hidden.forEach(hide);
				mark(c.from + 1, c.to - 1, 'le-link', { 'data-le-href': c.url, title: c.url });
				break;
			case 'wikilink': {
				c.hidden.forEach(hide);
				const shownFrom = c.hidden[0].to;
				const shownTo = c.hidden[c.hidden.length - 1].from;
				const target = c.target + (c.heading ? `#${c.heading}` : '') + (c.blockId ? `#^${c.blockId}` : '');
				const resolved = !c.target || vaultStore.resolveNoteName(c.target) || vaultStore.resolveFileName(c.target);
				const external = (c.aliasText ?? '').split('|').some((p) => p.trim().toLowerCase() === 'external');
				mark(shownFrom, shownTo, `le-wikilink${resolved ? '' : ' le-unresolved'}`, {
					'data-le-target': target,
					...(external ? { 'data-le-external': c.target } : {}),
					title: resolved ? target : `${target} (not created yet)`,
				});
				break;
			}
			case 'embedChip':
				widget(c.from, c.to, new ChipWidget({
					cls: 'le-embed-chip', text: `⧉ ${c.target || c.heading || ''}`,
					title: text(c), reveal: false, data: { leTarget: c.target + (c.heading ? `#${c.heading}` : '') },
				}));
				break;
			case 'tag':
				mark(c.from, c.to, 'le-tag', { 'data-le-tag': c.name });
				break;
			case 'footnote':
				if (c.multiline) break; // stays source (plan §5.2)
				widget(c.from, c.to, new ChipWidget({
					cls: 'le-fn', tag: 'sup', text: String(footnoteNumber.get(c.id)),
					title: text(c.body).trim(),
				}));
				break;
			case 'cite': {
				const labels = c.keys.map((k) => citationLabel(k));
				widget(c.from, c.to, new ChipWidget({
					cls: 'le-cite',
					text: (c.command === 'cite' ? '' : `${c.command} `) + (labels.map((l, i) => l?.label ?? c.keys[i]).join('; ') || '?'),
					title: labels.map((l, i) => (l ? `${l.label}: ${l.title}` : c.keys[i])).join('\n'),
				}));
				break;
			}
			case 'mustache':
				widget(c.from, c.to, new ChipWidget({ cls: 'le-var', text: c.name, title: `{{${c.name}}}` }));
				break;
			case 'directiveInline':
			case 'directiveAt':
				directive(c);
				break;
			case 'blockId':
				widget(c.hidden[0].from, c.hidden[0].to, new ChipWidget({
					cls: 'le-block-id', text: '⌗', title: `^${c.id} — click to copy a link to this block`,
					reveal: false, data: { leBlockid: c.id },
				}));
				break;
			default:
		}
	}

	function directive(c) {
		const content = c.content ? text(c.content) : '';
		switch (c.name) {
			case 'today':
				widget(c.from, c.to, new ChipWidget({
					cls: 'le-today', text: new Date().toLocaleDateString(), title: text(c),
				}));
				return;
			case 'label':
				widget(c.from, c.to, new ChipWidget({ cls: 'le-label', text: `⚓ ${content}`, title: text(c) }));
				return;
			case 'TeX':
				c.hidden.forEach(hide);
				mark(c.content?.from ?? c.from, c.content?.to ?? c.from, 'le-tex-only', { title: 'LaTeX only' });
				return;
			case 'HTML':
				c.hidden.forEach(hide);
				return;
			case 'ref':
			case 'cref':
			case 'Cref':
				if (!c.content) break;
				c.hidden.forEach(hide);
				mark(c.content.from, c.content.to, 'le-ref', { 'data-le-ref': content, title: `${c.name}: ${content}` });
				return;
			default:
		}
		if (c.content) {
			c.hidden.forEach(hide);
			mark(c.content.from, c.content.to, 'le-directive', { title: text(c).replace(content, '…') });
		} else {
			widget(c.from, c.to, new ChipWidget({ cls: 'le-directive-chip', text: c.name || text(c), title: text(c) }));
		}
	}

	return Decoration.set(out, true);
}

/** Rebuild without a document change: what a link resolves to, or a
 *  citation's label, changed outside the editor. */
export const liveRefresh = StateEffect.define();

export const inlineLayer = ViewPlugin.fromClass(class {
	constructor(view) {
		this.live = view.state.field(liveStateField);
		this.decorations = build(view);
		const refresh = () => requestAnimationFrame(() => {
			if (view.dom.isConnected) view.dispatch({ effects: liveRefresh.of(null) });
		});
		this.unsubscribe = [
			vaultStore.on('tree-changed', refresh),
			vaultStore.on('index-changed', refresh),
		];
		// The .bib entries load on the first citationLabel() ask.
		if (this.live.model.some((c) => c.kind === 'cite')) setTimeout(refresh, 800);
	}

	update(update) {
		const live = update.state.field(liveStateField);
		const refreshed = update.transactions.some((tr) => tr.effects.some((e) => e.is(liveRefresh)));
		if (update.docChanged || update.viewportChanged || live !== this.live || refreshed) {
			this.live = live;
			this.decorations = build(update.view);
		}
	}

	destroy() {
		for (const off of this.unsubscribe) off();
	}
}, { decorations: (plugin) => plugin.decorations });
