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
import {
	BulletWidget, TaskWidget, CalloutHeadWidget, FenceHeadWidget, FenceFootWidget,
	EnvHeadWidget, EnvFootWidget,
} from './widgets/lines.js';
import { calloutFolded } from './block-field.js';
import { ImageWidget } from './widgets/image.js';
import { imageSpec } from './images.js';
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

	// Line stand-ins first: an inline construct inside a replaced opener
	// line (a directive's `[caption]`) is then skipped, never overlapped.
	lines();

	for (const c of model) {
		if (c.kind === 'image' && c.level === 'inline' && inView(c.from, c.to) && !live.revealed.has(c.id)
			&& oneLine(c.from, c.to) && !replaced.some((r) => c.from >= r.from && c.to <= r.to)) {
			widget(c.from, c.to, new ImageWidget(imageSpec(c, config.notePath, false)));
			continue;
		}
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

	/**
	 * Line constructs (plan §5.1, §5.4, §5.5): their LINE classes apply in
	 * both states — a heading's size, a list's indent, a quote's border, a
	 * callout's tint — so entering a line never changes its height; only
	 * the marks and stand-ins toggle with the reveal.
	 */
	function lines() {
		const lineClass = (pos, cls, attributes) =>
			out.push(Decoration.line(attributes ? { class: cls, attributes } : { class: cls }).range(doc.lineAt(pos).from));
		const lineRange = (from, to) => ({ from, to });
		for (const c of model) {
			if (c.tier !== 'A' || !inView(c.lineFrom, c.lineTo)) continue;
			const hidden = !live.revealed.has(c.id);
			switch (c.kind) {
				case 'heading':
					lineClass(c.from, `le-h le-h${c.depth}`);
					if (hidden) c.hidden.forEach(hide);
					break;
				case 'align':
					lineClass(c.from, `le-align-${c.align}`);
					if (hidden) c.hidden.forEach(hide);
					break;
				case 'quote':
					lineClass(c.from, `le-quote le-quote-${Math.min(c.depth, 4)}${c.callout ? ` le-callout le-callout-${c.callout}` : ''}`);
					if (hidden) c.hidden.forEach(hide);
					break;
				case 'callout':
					lineClass(c.from, 'le-callout-head');
					if (hidden) {
						const h = c.hidden[0];
						widget(h.from, h.to, new CalloutHeadWidget(c.type, c.fold, calloutFolded(state, c), Boolean(c.title), c.id));
						if (c.title) mark(c.title.from, c.title.to, 'le-callout-title');
					}
					break;
				case 'bullet':
				case 'numbered':
				case 'task': {
					const indent = c.listMark.from - doc.lineAt(c.listMark.from).from;
					lineClass(c.from, `le-li le-li-${Math.min(c.depth, 4)}${c.kind === 'task' && c.checked ? ' le-done' : ''}`,
						{ style: `--le-indent: ${indent}` });
					if (!hidden) break;
					if (c.kind === 'bullet') widget(c.hidden[0].from, c.hidden[0].to, new BulletWidget(c.depth));
					if (c.kind === 'task') {
						c.hidden.forEach(hide);
						widget(c.marker.from, c.marker.to, new TaskWidget(c.checked));
					}
					break;
				}
				case 'codeFence': {
					const last = c.closeLine ?? lineRange(doc.lineAt(c.to).from, c.to);
					for (let n = doc.lineAt(c.openLine.from).number; n <= doc.lineAt(last.from).number; n += 1) {
						const line = doc.line(n);
						if (!inView(line.from, line.to)) continue;
						const edge = line.from === c.openLine.from ? ' le-fence-open'
							: c.closeLine && line.from === c.closeLine.from ? ' le-fence-close' : '';
						lineClass(line.from, `le-fence${edge}`);
					}
					if (!hidden) break;
					if (c.openLine.to > c.openLine.from) widget(c.openLine.from, c.openLine.to, new FenceHeadWidget(c.lang));
					if (c.closeLine && c.closeLine.to > c.closeLine.from) widget(c.closeLine.from, c.closeLine.to, new FenceFootWidget());
					break;
				}
				case 'directive':
				case 'environment': {
					const name = c.name || '';
					const kindCls = `le-env le-env-${name.replace(/[^\w-]/g, '')}${c.texOnly ? ' le-tex-only-block' : ''}${c.comment ? ' le-env-comment' : ''}`;
					const bodyFrom = c.body.start ?? c.body.from;
					const bodyTo = c.body.end ?? c.body.to;
					lineClass(c.openLine.from, `${kindCls} le-env-open`);
					if (c.closeLine) lineClass(c.closeLine.from, `${kindCls} le-env-close`);
					if (bodyTo > bodyFrom || doc.lineAt(bodyFrom).from === bodyFrom) {
						for (let n = doc.lineAt(bodyFrom).number; n <= doc.lineAt(bodyTo).number; n += 1) {
							const line = doc.line(n);
							if (line.from >= c.openLine.from && line.from <= c.openLine.to) continue;
							if (c.closeLine && line.from === c.closeLine.from) continue;
							if (inView(line.from, line.to)) lineClass(line.from, kindCls);
						}
					}
					if (!hidden) break;
					const caption = c.content ? doc.sliceString(c.content.start ?? c.content.from, c.content.end ?? c.content.to) : '';
					const attrs = c.attrs ? doc.sliceString(c.attrs.start ?? c.attrs.from, c.attrs.end ?? c.attrs.to) : '';
					widget(c.openLine.from, c.openLine.to, new EnvHeadWidget(name, caption, attrs,
						c.texOnly ? 'LaTeX only' : c.htmlOnly ? 'HTML only' : ''));
					if (c.closeLine && c.closeLine.to > c.closeLine.from) widget(c.closeLine.from, c.closeLine.to, new EnvFootWidget());
					break;
				}
				case 'term':
					mark(c.term.from, c.term.to, 'le-dt');
					break;
				default:
			}
		}
	}
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
