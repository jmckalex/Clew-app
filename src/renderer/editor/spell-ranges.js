// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Which stretches of a note are NOT prose, for the spell checker (the owner's
// ask, 2026-11-28): editor/spellcheck.js marks them `spellcheck="false"` so
// the platform's checker — Chromium's on the desktop, WebKit's on the iPad —
// underlines no code, maths, citation key, link target or directive. Pure:
// nothing from CodeMirror or the DOM, so it is tested over the real dialect
// scanner and the real markdown parser, and every host's editor shares it.
//
// Two sources, as the source mode's colours have: the markdown parser's tree
// (code, URLs, HTML, entities, reference definitions, block ids) and the
// dialect scanner (jmd/jmarkdown-scan.js) — its faces, its injected bodies
// (TeX, HTML, CSS, script, mermaid) and two of its constructs. The scanner's
// faces are counted as NOT prose unless named here as prose: a face added
// later then goes unchecked, never underlined wrongly — a missed misspelling
// costs less than red under every macro name.
import { LITERAL_DIRECTIVES } from './jmd/jmarkdown-scan.js';

/** Markdown parser nodes whose text is never prose (a link's TEXT is; its
 *  `URL` child is not). */
export const NO_SPELL_NODES = new Set([
	'InlineCode', 'FencedCode', 'CodeBlock', 'URL', 'Autolink', 'FtpAutolink',
	'HTMLTag', 'HTMLBlock', 'CommentBlock', 'Comment', 'ProcessingInstruction',
	'ProcessingInstructionBlock', 'LinkReference', 'LinkLabel', 'Entity', 'JmdBlockId',
]);

/** The scanner's faces that ARE prose — /italic/, ==highlight==, a
 *  footnote's text, a wikilink's alias. Every other face is not. */
export const PROSE_FACES = new Set(['jmd-italic', 'jmd-highlight', 'jmd-footnote-body', 'jmd-wikilink-alias']);

/**
 * The ranges not to check, sorted and merged.
 *
 * @param {{ captures?: {start: number, end: number, face: string}[],
 *   injections?: {start: number, end: number, language: string}[],
 *   constructs?: {kind: string, start: number, end: number,
 *     name?: {start: number, end: number}|null,
 *     content?: {start: number, end: number}|null}[] }|null} scan - scanJmarkdown's
 * @param {Iterable<{name: string, from: number, to: number}>} nodes - parser nodes
 *   (only NO_SPELL_NODES' count; a caller may pass just those)
 * @param {(from: number, to: number) => string} textAt - the note's text
 *   between two offsets (a directive's name)
 * @param {{from: number, to: number}} [within] - only ranges touching this
 * @returns {[number, number][]} [from, to) pairs
 */
export function noSpellRanges(scan, nodes, textAt, within) {
	const out = [];
	const lo = within?.from ?? -Infinity;
	const hi = within?.to ?? Infinity;
	const add = (from, to) => { if (to > from && to >= lo && from <= hi) out.push([from, to]); };
	for (const c of scan?.captures ?? []) {
		const face = c.face.startsWith('jmd-') ? c.face : `jmd-${c.face}`;
		if (!PROSE_FACES.has(face)) add(c.start, c.end);
	}
	// A directive's `[…]` is markdown — prose — and is injected as
	// `jmarkdown_inline`; every other injection is another language's body.
	for (const inj of scan?.injections ?? []) {
		if (inj.language !== 'jmarkdown_inline') add(inj.start, inj.end);
	}
	for (const c of scan?.constructs ?? []) {
		// The front matter, keys and values alike: names, dates, tags, paths.
		if (c.kind === 'metaHeader') add(c.start, c.end);
		// `@reveal[http://…]`, `@image[pics/a.png]`: what the engine takes
		// literally is a URL, a path or code, not prose.
		else if (c.kind === 'directiveAt' && c.content && c.name
			&& LITERAL_DIRECTIVES.has(textAt(c.name.start, c.name.end))) add(c.content.start, c.content.end);
	}
	for (const n of nodes ?? []) if (NO_SPELL_NODES.has(n.name)) add(n.from, n.to);
	out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const merged = [];
	for (const r of out) {
		const last = merged[merged.length - 1];
		if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
		else merged.push([r[0], r[1]]);
	}
	return merged;
}
