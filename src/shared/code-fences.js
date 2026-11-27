// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Which lines are fenced code: ONE rule for every reader in Clew that asks —
// live edit's scanner (renderer/editor/jmd/math-segments.js#
// maskMarkdownCode), live edit's numbering (renderer/editor/live/
// numbering.js), the note index (shared/note-metadata.js#maskSource, and
// through it search's unlinked mentions and a book chapter's title and
// words). It is the engine's rule for pairing `@begin`/`@end` too (jmarkdown
// fd9df17 copied it from maskMarkdownCode), so live edit's numbers are the
// engine's. Until 2026-11-27 numbering and the index knew only a fence at
// column 0 of exactly three characters, closed by exactly three: an indented
// fence, or a ```` fence holding ``` lines, was prose to them and code to the
// scanner and the engine, and theorem syntax shown in one was counted
// (Clew-boss's catch).
//
// The rule, CommonMark's as marked (the engine's parser) reads it, except
// that any indentation is allowed (a nested environment's body is still
// indented where it is read): a line that starts with three or more tildes,
// or three or more backticks with no backtick after them on the line, opens
// a fence; a line holding nothing but a run of the same character at least
// as long, and spaces, closes it; an unclosed fence runs to the end. Both
// fence lines are code. So "```` ```query ```` filters notes…" — an inline
// code span starting a paragraph — opens nothing, and "```js" inside a fence
// closes nothing (Clew-boss's catch on the first version, 2026-11-27: the
// demo's Features/Queries.md lost its "## Tasks across the vault" heading
// from the index). Pure: the renderer, main and Clew-iOS import it.

/** A fence's opening line: group 1 a run of backticks with no backtick after
 *  it on the line, or group 2 a run of tildes. */
export const FENCE_OPEN = /^\s*(?:(`{3,})(?=[^`]*$)|(~{3,}))/;
/** A closing line: group 1 the run, nothing but spaces around it. */
export const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;

/**
 * The indices of `lines` inside fenced code, the fence lines included.
 *
 * @param {string[]} lines
 * @returns {Set<number>}
 */
export function fencedLines(lines) {
	const out = new Set();
	let char = '';
	let len = 0;
	for (let i = 0; i < lines.length; i += 1) {
		if (len > 0) {
			out.add(i);
			const close = FENCE_CLOSE.exec(lines[i]);
			if (close && close[1][0] === char && close[1].length >= len) len = 0;
			continue;
		}
		const open = FENCE_OPEN.exec(lines[i]);
		if (!open) continue;
		out.add(i);
		const run = open[1] ?? open[2];
		char = run[0];
		len = run.length;
	}
	return out;
}

/**
 * `text` with its fenced code blanked to spaces — offsets and line breaks
 * kept, so a position in the result is the same position in `text`.
 *
 * @param {string} text
 * @returns {string}
 */
export function maskFences(text) {
	const lines = text.split('\n');
	const fenced = fencedLines(lines);
	if (fenced.size === 0) return text;
	return lines.map((line, i) => (fenced.has(i) ? ' '.repeat(line.length) : line)).join('\n');
}
