// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Quote-and-cite from a PDF (FEATURE-IDEAS #2) — the pure half: what text
// you selected in a PDF becomes in a note, and where in the note it goes.
//
//     > The selected text, as one paragraph.
//     >
//     > \cite[p. 12]{skyrms:1996} · [[Skyrms 1996.pdf#page=12|PDF p. 12]]
//
// The same shape as an entry of the annotations note (pdf-annotations-note.js):
// one blockquote, the page link last. `p. N` is the PDF's own page number,
// which is what `#page=N` opens; a journal article's printed page numbers
// differ, and the engine does not give us the PDF's page labels yet.

/**
 * The viewer's text — one string per page, its lines broken where the PDF's
 * lines break — as one paragraph. A word broken across a line by a hyphen is
 * joined (`evo-\nlutionary`), soft hyphens are dropped, and every run of
 * white space becomes one space.
 */
export function cleanPdfText(pages) {
	const list = Array.isArray(pages) ? pages : [pages];
	return list
		.map((page) => String(page ?? '')
			.replace(/[­￾\u0002]/g, '')
			.replace(/\r\n?/g, '\n')
			.replace(/(\p{L})-\n[ \t]*(\p{Ll})/gu, '$1$2'))
		.join('\n')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Prose kept as prose: what this dialect would read as markup is escaped.
 * Every rule below was checked by rendering through the engine (2026-10-03):
 * unescaped, `x^2` is a superscript, `H_2O` a subscript, `a*b*` strong,
 * ` /tmp/ ` italic, `==x==` a highlight, `a::b` mangled and `X:: Y` a
 * description list. Two need more than a backslash, and one needed it:
 *
 * - `$` is `\$`: since jmarkdown e02cd51 the engine wraps an escaped dollar
 *   in `span.escaped`, which MathJax (it typesets `$5 and $10` in the PAGE,
 *   after the engine) does not read a delimiter across, and a LaTeX export
 *   writes `\$`. Before it, the escape had to be `\\\$`.
 * - `[`: `\[` is display maths in this dialect, so a bracket is never
 *   backslashed (`[sic]` is plain text anyway); only `[[` (a wikilink) and
 *   `[@` (a pandoc citation) are hidden, as the entity `&#91;`.
 * - a backslash is doubled, so `\cite` or `\begin` in a PDF stays text.
 */
export function escapeProse(text, { normalSyntax = false } = {}) {
	let out = String(text)
		.replace(/\\/g, '\\\\')
		.replace(/[*_^~`<]/g, (c) => `\\${c}`)
		.replace(/\$/g, '\\$$')
		.replace(/\[(?=[[@])/g, '&#91;')
		.replace(/==/g, '\\=\\=')
		.replace(/::+/g, (run) => run.replace(/:/g, '\\:'))
		// A directive (and, with pandocCitations, a citation): `@name`.
		.replace(/(^|[\s(])@(?=[A-Za-z])/g, '$1\\@');
	// The dialect's /italic/ opens on a slash with nothing word-like before
	// it; `and/or` and URLs are already literal (jmarkdown 3134543).
	if (!normalSyntax) out = out.replace(/(^|[\s(])\/(?=\S)/g, '$1\\/');
	// What would make the paragraph's first line something else: a heading,
	// a list item, a table row, a callout.
	return out
		.replace(/^(\d+)([.)])(?=\s)/, '$1\\$2')
		.replace(/^(#|[-+](?=\s)|\||>)/, '\\$1');
}

/** The citation for `key` at `page`, in the vault's form. */
export function citation(key, page, { pandoc = false } = {}) {
	if (!key) return '';
	return pandoc ? `[@${key}, p. ${page}]` : `\\cite[p. ${page}]{${key}}`;
}

/**
 * The block to insert.
 * @param {{ text: string, page: number, link: string, key?: string|null,
 *   pandoc?: boolean, normalSyntax?: boolean }} q
 *   `text` already cleaned; `link` the PDF as a wikilink target (a bare
 *   name when the vault has one file by that name, else its path).
 */
export function quoteBlock({ text, page, link, key = null, pandoc = false, normalSyntax = false }) {
	const cite = citation(key, page, { pandoc });
	const back = `[[${link}#page=${page}|PDF p. ${page}]]`;
	return `> ${escapeProse(text, { normalSyntax })}\n>\n> ${cite ? `${cite} · ` : ''}${back}`;
}

/**
 * Where `block` goes in `doc` for a cursor at `pos`: as a block of its own,
 * never inside another — on the blank line the cursor is on; before the
 * block whose first line the cursor starts; otherwise after the end of the
 * block the cursor is in (a paragraph, a quote, a list: up to the next blank
 * line — a heading ends at its own line) — with a blank line either side,
 * unless the document's edge or a blank line is already there.
 * @returns {{ from: number, to: number, insert: string, cursor: number }}
 *   `cursor` is where the caret goes afterwards: the line after the block,
 *   so a second quote lands beneath the first.
 */
export function placeQuote(doc, pos, block) {
	const at = Math.max(0, Math.min(Number(pos) || 0, doc.length));
	const lineStart = (i) => doc.lastIndexOf('\n', i - 1) + 1;
	const lineEnd = (i) => { const e = doc.indexOf('\n', i); return e === -1 ? doc.length : e; };
	const blankAt = (start) => !doc.slice(start, lineEnd(start)).trim();
	const start = lineStart(at);
	let from;
	let to;
	if (blankAt(start)) {
		// A blank line is the block's own (its spaces too).
		from = start;
		to = lineEnd(start);
	} else if (at === start && (start === 0 || blankAt(lineStart(start - 1)))) {
		from = to = start;
	} else {
		let end = lineEnd(start);
		if (!/^#{1,6}\s/.test(doc.slice(start, end))) {
			while (end < doc.length && !blankAt(end + 1)) end = lineEnd(end + 1);
		}
		from = to = end;
	}
	const before = doc.slice(0, from);
	const after = doc.slice(to);

	let lead = '';
	if (before && !before.endsWith('\n')) lead = '\n\n';
	else if (before && before.slice(lineStart(before.length - 1), -1).trim()) lead = '\n';
	let tail;
	if (!after) tail = '\n';
	else if (!after.startsWith('\n')) tail = '\n\n';
	else {
		const next = after.slice(1, after.indexOf('\n', 1) === -1 ? after.length : after.indexOf('\n', 1));
		tail = after === '\n' || !next.trim() ? '' : '\n';
	}
	return { from, to, insert: lead + block + tail, cursor: from + lead.length + block.length + 1 };
}
