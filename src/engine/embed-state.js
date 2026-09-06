// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The disclosure state of a note embed, written in the link itself:
//
//   ![[Week 3]]                 an embed, as always — no disclosure at all
//   ![[Week 3|collapsed]]       collapsible, starts closed
//   ![[Week 3|open]]            collapsible, starts open
//   ![[Week 3|Reading|open]]    …with "Reading" still the title
//
// The state lives in the note because that is the only place that travels:
// with the file, into git, into a shared vault, into Obsidian (which shows
// the keyword as the embed's title and is otherwise none the wiser).
//
// Toggling in reading mode rewrites the link, which is why this module is
// imported by BOTH the engine extension that reads the keyword and the
// renderer action that writes it — the block-refs.js/block-ids.js
// arrangement, for the same reason: a reader and a writer that disagree
// about the syntax would corrupt notes. Keep it free of node imports, or
// the renderer bundle can no longer have it.
export const STATES = ['collapsed', 'open'];

/**
 * Split a trailing state keyword off an embed alias. Returns the state (null
 * when the alias carries none) and what is left of the alias to use as the
 * title (null when the keyword was the whole of it — a mode is not a
 * caption, the same rule the office `|live` alias follows).
 */
export function parseEmbedState(alias) {
	if (!alias) return { state: null, alias: null };
	const parts = alias.split('|').map((s) => s.trim());
	const last = parts[parts.length - 1].toLowerCase();
	if (!STATES.includes(last)) return { state: null, alias };
	return { state: last, alias: parts.slice(0, -1).join('|') || null };
}

// Embeds are own-line blocks (the tokenizer accepts nothing else), so a whole
// line is the unit this rewrites. Groups: indent+opener, target, #fragment,
// |alias, closer+trailing space.
const EMBED_LINE_RE = /^(\s*!\[\[)([^\[\]|#\n]*)((?:#[^\[\]|\n]+)?)((?:\|[^\[\]\n]+)?)(\]\][ \t]*)$/;

/**
 * Rewrite one source line so its embed carries `state` ('collapsed' | 'open'
 * | null to remove it), preserving any real alias. Returns the new line, or
 * null when the line is not an embed — which is how a caller learns the line
 * numbers drifted and it should not write anything.
 */
export function setEmbedState(lineText, state) {
	const match = EMBED_LINE_RE.exec(lineText);
	if (!match) return null;
	const [, opener, target, fragment, aliasPart, closer] = match;
	const { alias } = parseEmbedState(aliasPart ? aliasPart.slice(1) : null);
	const segments = [alias, state].filter(Boolean);
	return opener + target + fragment
		+ (segments.length ? '|' + segments.join('|') : '') + closer;
}
