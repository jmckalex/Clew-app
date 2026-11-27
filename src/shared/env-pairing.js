// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// How `@begin(name)` and `@end(name)` pair: the engine's rule (begin-end-core
// .js's tokenizer), one definition for every reader of the syntax in Clew —
// the dialect scanner live edit draws from (renderer/editor/jmd/
// jmarkdown-scan.js), live edit's numbering (renderer/editor/live/
// numbering.js) and the note index's labels (shared/note-metadata.js). The
// owner's rule, 2026-11-27: pairs nest like well-formed parentheses —
// `@end(b)` never closes `@begin(a)` — and what pairs with nothing is text:
// no environment, no number, no label. Until then numbering and the index
// counted an opener nothing closed, which the engine prints as text, so the
// numbers after it were one higher in live edit than in reading view.
//
// Pure: no DOM, no Node built-in — the renderer, main and Clew-iOS import it.

/**
 * A line the pairing weighs: an `@begin(name)` (anything after it) or an
 * `@end(name)` alone on its line, a sigil and spaces allowed around the name
 * as the engine allows them. Groups: 1 `begin` (or none: a closer), 2 the
 * opener's name, 3 the closer's.
 */
export const PAIRING_LINE = /^[ \t]*@(?:(begin)\([ \t]*[.<]?[ \t]*([A-Za-z][\w-]*\*?)[ \t]*>?[ \t]*\)|end\([ \t]*[.<]?[ \t]*([A-Za-z][\w-]*\*?)[ \t]*>?[ \t]*\)[ \t\r]*$)/;

/**
 * Every line of `lines` the pairing weighs, in order, each with its index
 * and name — leaving out the lines `skip(i)` says are code (a closer in a
 * fenced block is code, not a closer).
 *
 * @param {string[]} lines
 * @param {(i: number) => boolean} [skip]
 * @returns {{ line: number, begin: boolean, name: string }[]}
 */
export function pairingEntries(lines, skip = () => false) {
	const out = [];
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		if (!line.includes('@') || skip(i)) continue;
		const m = PAIRING_LINE.exec(line);
		if (m) out.push({ line: i, begin: Boolean(m[1]), name: m[2] ?? m[3] });
	}
	return out;
}

/**
 * The line that closes the `@begin(name)` on line `k`: the first `@end(name)`
 * of the SAME name after it, each same-name `@begin(name)` on the way needing
 * an `@end(name)` of its own; other names are its body's business. `bound` is
 * the line that closes the environment around it, which an inner pair never
 * crosses. -1 when there is none: the opener is then text.
 *
 * @param {{ line: number, begin: boolean, name: string }[]} entries - in line order
 * @param {number} k - The opener's line.
 * @param {string} name
 * @param {number} bound - The first line not searched.
 * @returns {number}
 */
export function closerOf(entries, k, name, bound) {
	let lo = 0;
	let hi = entries.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (entries[mid].line <= k) lo = mid + 1; else hi = mid;
	}
	let depth = 0;
	for (let i = lo; i < entries.length && entries[i].line < bound; i += 1) {
		const p = entries[i];
		if (p.name !== name) continue;
		if (p.begin) depth += 1;
		else if (depth === 0) return p.line;
		else depth -= 1;
	}
	return -1;
}

/**
 * The pairing as a reader walking a document's lines in order meets it —
 * numbering.js and note-metadata.js, which keep their own stacks of what is
 * open. `opens(i)` at an `@begin(…)` line: its closer, searched inside the
 * innermost environment still open (and that one is now open), or -1 — text,
 * not an environment. `closes(i)` at an `@end(…)` line: whether it closes the
 * innermost open one (then no longer open); a closer that does not closes
 * nothing.
 *
 * @param {{ line: number, begin: boolean, name: string }[]} entries
 */
export function pairer(entries) {
	const byLine = new Map(entries.map((e) => [e.line, e]));
	/** Closers of the environments open now, innermost last. */
	const open = [];
	return {
		opens(i) {
			const entry = byLine.get(i);
			if (!entry?.begin) return -1;
			const c = closerOf(entries, i, entry.name, open.length ? open[open.length - 1] : Infinity);
			if (c >= 0) open.push(c);
			return c;
		},
		closes(i) {
			if (!open.length || open[open.length - 1] !== i) return false;
			open.pop();
			return true;
		},
	};
}
