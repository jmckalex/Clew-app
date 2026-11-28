// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What `{{name}}` stands for, as the engine substitutes it (jmarkdown's
// `moustache` rule, syntax-enhancements.js: the header's value for that key,
// the name between the braces exactly as written — `{{ title }}` and
// `{{Title}}` are not `title` — and anything else printed as written), so live
// edit can show the value in its chip (the owner's ask, 2026-11-28; reading
// view and every export always substituted). Pure.
//
// The header is read as the ENGINE reads it (metadata-header.js), not as
// shared/frontmatter.js reads YAML: Clew renders with `Header style: fenced`,
// so a header is a first line of `---`, its first key line next, and the next
// line starting `---` after that (or the end of the note) closes it. A key is
// `^[-a-zA-Z0-9 ]+:` — no underscore, so `my_var: x` is a line of the
// previous key's value — and a value is the rest of its line plus every
// non-blank line after it, as written (quotes kept, a YAML list's lines and
// their indentation too), joined by newlines; a key given twice is its
// values run together. The engine looks a name up with `in`, so
// `{{constructor}}` prints Object's function there; here only the header's
// own keys count (jmarkdown's to fix, not Clew's to copy).

const KEY_LINE = /^([-a-zA-Z0-9 ]+):\s*(.*)$/;

/**
 * The header's values by key, as the engine's `{{name}}` prints them.
 *
 * @param {string} text - the note, or at least its header and the line that
 *   closes it
 * @returns {Map<string, string>}
 */
export function headerVariables(text) {
	const vars = new Map();
	const opener = /^---[ \t]*\r?\n/.exec(text);
	if (!opener) return vars;
	const rest = text.slice(opener[0].length);
	if (!/^[-a-zA-Z0-9 ]+:/.test(rest)) return vars;
	const term = rest.match(/\n^---.*$/m);
	const header = term ? rest.slice(0, term.index) : rest;
	const lists = new Map();
	let key = null;
	let value = [];
	const store = () => {
		if (!lists.has(key)) lists.set(key, []);
		lists.get(key).push(value.join('\n'));
		value = [];
	};
	for (const line of header.split('\n')) {
		const m = KEY_LINE.exec(line);
		if (m) {
			if (key !== null) store();
			key = m[1];
			if (m[2].trim()) value.push(m[2]);
		} else if (key !== null && line.trim()) {
			value.push(line);
		}
	}
	if (key !== null) store();
	for (const [k, list] of lists) vars.set(k, list.join(''));
	return vars;
}

/**
 * The part of a CodeMirror document `headerVariables` needs: up to the end
 * of the line that closes the header (the first line from the third on that
 * starts `---`, as the engine finds it), or the whole note when none does;
 * '' when the note has no `---` first line.
 *
 * @param {{ lines: number, line: (n: number) => { text: string, to: number },
 *   sliceString: (from: number, to?: number) => string, length: number }} doc
 * @returns {string}
 */
export function headerSlice(doc) {
	if (doc.lines < 2 || !/^---[ \t]*$/.test(doc.line(1).text)) return '';
	for (let n = 3; n <= doc.lines; n++) {
		const line = doc.line(n);
		if (line.text.startsWith('---')) return doc.sliceString(0, line.to);
	}
	return doc.sliceString(0, doc.length);
}
