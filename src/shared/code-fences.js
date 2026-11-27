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
// The rule: a line that starts — after any indentation — with three or more
// backticks or tildes opens a fence; the next such line of the same
// character and at least the same length closes it; an unclosed fence runs to
// the end. Both fence lines are code. Pure: the renderer, main and Clew-iOS
// import it.

/** A fence line: group 1 its run of backticks or tildes. */
export const FENCE_LINE = /^\s*(`{3,}|~{3,})/;

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
		const fence = FENCE_LINE.exec(lines[i]);
		if (len > 0) {
			out.add(i);
			if (fence && fence[1][0] === char && fence[1].length >= len) len = 0;
		} else if (fence) {
			out.add(i);
			char = fence[1][0];
			len = fence[1].length;
		}
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
