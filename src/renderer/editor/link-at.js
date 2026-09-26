// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Which link is at a column of a line, and what hovering it should preview
// (docs/dev/live-edit.md §5.11). Pure: the source-mode ⌘-click handler
// (wikilink-click.js), the hover plugin (link-hover.js) and reading mode's
// host all read links through here, so they cannot disagree about one.
import { IMAGE_EXT } from '../../shared/file-types.js';

const WIKILINK = /(!?)\[\[([^[\]|#\n]*)(?:#([^[\]|\n]+))?(?:\|([^[\]\n]+))?\]\]/g;
/** `[text](url)` and `![alt](url)`: the url with no spaces (or in `<…>`),
 *  an optional quoted title. */
const MDLINK = /(!?)\[([^\]\n]*)\]\(\s*(?:<([^>\n]+)>|([^\s()]+(?:\([^\s()]*\))?[^\s()]*))(?:\s+"[^"\n]*")?\s*\)/g;

/** The column ranges of the line's code spans (backtick runs of equal
 *  length) — a link inside one is text. */
function codeSpans(text) {
	const out = [];
	const re = /`+/g;
	let m;
	while ((m = re.exec(text))) {
		const run = m[0];
		const close = text.indexOf(run, m.index + run.length);
		// An equal run that is not part of a longer one closes the span.
		let at = close;
		while (at !== -1 && (text[at - 1] === '`' || text[at + run.length] === '`')) at = text.indexOf(run, at + 1);
		if (at === -1) continue;
		out.push([m.index, at + run.length]);
		re.lastIndex = at + run.length;
	}
	return out;
}

const hasExternal = (alias) => (alias ?? '').split('|').some((p) => p.trim().toLowerCase() === 'external');

/**
 * The link at `column` of `lineText` (inclusive of both ends, so a pointer
 * over the last character — which CodeMirror may report as the position
 * after it — still counts).
 *
 * @returns {null | {kind: 'wikilink', embed: boolean, target: string, heading: string,
 *   alias: string, external: boolean, from: number, to: number}
 *   | {kind: 'markdown', embed: boolean, url: string, text: string, from: number, to: number}}
 */
export function linkAt(lineText, column) {
	const inCode = codeSpans(lineText).some(([a, b]) => column >= a && column < b);
	if (inCode) return null;
	WIKILINK.lastIndex = 0;
	let m;
	while ((m = WIKILINK.exec(lineText))) {
		const from = m.index;
		const to = from + m[0].length;
		if (column < from || column > to) continue;
		return {
			kind: 'wikilink', embed: m[1] === '!', target: m[2].trim(), heading: (m[3] ?? '').trim(),
			alias: m[4] ?? '', external: hasExternal(m[4]), from, to,
		};
	}
	MDLINK.lastIndex = 0;
	while ((m = MDLINK.exec(lineText))) {
		const from = m.index;
		const to = from + m[0].length;
		if (column < from || column > to) continue;
		return { kind: 'markdown', embed: m[1] === '!', url: (m[3] ?? m[4]).trim(), text: m[2], from, to };
	}
	return null;
}

/**
 * A reading-mode link's target (`data-href`: `Note`, `Note#Heading`,
 * `Note#^id`, `#Heading`) as the wikilink linkAt would have returned.
 */
export function parseTarget(target) {
	const hash = target.indexOf('#');
	return {
		kind: 'wikilink', embed: false,
		target: (hash === -1 ? target : target.slice(0, hash)).trim(),
		heading: hash === -1 ? '' : target.slice(hash + 1).trim(),
		alias: '', external: false, from: 0, to: 0,
	};
}

const extOf = (name) => { const m = /\.[A-Za-z0-9]+$/.exec(name); return m ? m[0].toLowerCase() : ''; };
const isNoteName = (name) => ['', '.md', '.jmd'].includes(extOf(name));
const safeDecode = (s) => { try { return decodeURI(s); } catch { return s; } };

/**
 * What hovering a link previews.
 *
 * @param {ReturnType<typeof linkAt>} link
 * @param {{ note: (name: string) => string|null, file: (name: string) => string|null,
 *   current: string|null }} resolve - the vault's resolvers, and the note
 *   being edited (a same-note `#Heading` previews that note's section)
 * @returns {null
 *   | { kind: 'block', path: string, text: string, label: string }
 *   | { kind: 'image', path: string, label: string }
 *   | { kind: 'unresolved', name: string, label: string }}
 *   `block`: render `text` through the block endpoint; null: no popover
 *   (a URL, mailto, an `|external` alias).
 */
export function previewSpec(link, resolve) {
	if (!link) return null;
	let target;
	let heading;
	if (link.kind === 'markdown') {
		const url = link.url;
		if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
		const hash = url.indexOf('#');
		target = safeDecode(hash === -1 ? url : url.slice(0, hash));
		heading = hash === -1 ? '' : safeDecode(url.slice(hash + 1));
		if (isNoteName(target)) target = target.replace(/\.(md|jmd)$/i, '');
	} else {
		if (link.external) return null;
		({ target, heading } = link);
	}
	const section = heading ? `#${heading}` : '';
	const note = target ? resolve.note(target) : resolve.current;
	if (note) {
		const name = note.replace(/\.(md|jmd)$/i, '');
		const base = name.split('/').pop();
		return { kind: 'block', path: note, text: `![[${name}${section}|bare]]`, label: base + (heading ? ` › ${heading}` : '') };
	}
	if (!target) return null;
	if (!isNoteName(target)) {
		const file = resolve.file(target);
		const label = (file ?? target).split('/').pop();
		if (!file) return { kind: 'unresolved', name: target, label };
		if (IMAGE_EXT.includes(extOf(file))) return { kind: 'image', path: file, label };
		return { kind: 'block', path: file, text: `![[${file}]]`, label };
	}
	return { kind: 'unresolved', name: target, label: target.split('/').pop() };
}
