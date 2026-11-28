// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Live edit's half of the book-style paragraphs (Settings → Appearance →
// Paragraphs: indented; the owner's choice 2026-11-28): the lines whose
// paragraph reading view indents — preview.css's rule, read off the markdown
// parser's tree instead of the engine's HTML. A paragraph is indented when the
// block before it is another paragraph or a plain quote; never after a heading,
// a list, a table, an environment, a callout or a displayed equation, nor when
// it is itself a display, an environment or another block the engine does not
// set as a paragraph. Pure over an EditorState, so tests/paragraph-indents.
// test.js holds it to the real engine's HTML. Live edit keeps its blank lines —
// they are lines one types on — so here the indent is the whole signal.
import { syntaxTree } from '@codemirror/language';

/** A first line the engine does not set as a paragraph of prose: an
 *  environment's or a block directive's line, a display, HTML, a block embed,
 *  a table of contents, a comment block. */
const NOT_PROSE = /^[ \t]*(?:@begin\(|@end\(|@[\w-]+\+\[|@(?:title|subtitle|author|institution|date)\[|:::|\$\$|\\\[|\\begin\{|<\/?[A-Za-z]|!\[\[|\{\{TOC\}\}|%%)/;
/** A paragraph that ENDS in a display: the engine sets the display apart, and
 *  what follows it goes on with its sentence (preview.css). */
const ENDS_IN_DISPLAY = /(?:\$\$|\\\])[ \t]*$/;
/** A callout's head, on its quote's first line. */
const CALLOUT_HEAD = /^[ \t]*(?:>[ \t]?)*\[![\w-]+\]/;
/** A quote's own line (the engine's `^ {0,3}>`, jmarkdown 8ce758d). */
const QUOTE_LINE = /^ {0,3}>/;

/** The block before `node` among its siblings — past a quote's or a list's
 *  own markers. */
function prevBlock(node) {
	let p = node.prevSibling;
	while (p && /Mark$/.test(p.name)) p = p.prevSibling;
	return p;
}

/**
 * The starts of the lines to indent, within `ranges`.
 *
 * @param {import('@codemirror/state').EditorState} state
 * @param {{from: number, to: number}[]} ranges - the drawn part (or the whole note)
 * @returns {number[]} line starts, ascending, each once
 */
export function paragraphIndents(state, ranges) {
	const { doc } = state;
	const firstLine = (node) => doc.sliceString(node.from, doc.lineAt(node.from).to);
	const prose = (node) => !NOT_PROSE.test(firstLine(node));
	const out = new Set();
	const tree = syntaxTree(state);
	for (const { from, to } of ranges) {
		tree.iterate({
			from, to,
			enter(n) {
				if (n.name !== 'Paragraph') return undefined;
				const node = n.node;
				if (!prose(node)) return false;
				const prev = prevBlock(node);
				if (!prev) return false;
				const indent = prev.name === 'Paragraph'
					? prose(prev) && !CALLOUT_HEAD.test(doc.lineAt(prev.from).text)
						&& !ENDS_IN_DISPLAY.test(doc.sliceString(prev.from, prev.to))
					// A quote; a callout only when its last line has no `>` — the
					// engine (`Joined quotes`, which Clew turns on) ends it before
					// that line and sets the line as a paragraph going on
					// (p.jmd-continued), so the block before this one is a
					// paragraph. lezer reads that line into the quote (CommonMark).
					: prev.name === 'Blockquote' && (!CALLOUT_HEAD.test(doc.lineAt(prev.from).text)
						|| !QUOTE_LINE.test(doc.lineAt(prev.to).text));
				if (indent) out.add(doc.lineAt(node.from).from);
				return false;
			},
		});
	}
	return [...out].sort((a, b) => a - b);
}
