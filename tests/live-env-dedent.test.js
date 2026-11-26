// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Live edit draws an environment's body without the indentation the engine
// strips (live/env-rules.js#bodyIndents, live/inline-layer.js; the owner's
// ask, 2026-11-26): what the inline layer hides on each line, in both states,
// and a list's columns in such a body — over a real EditorState, the layer's
// own decorations. No two hidden ranges may overlap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';

globalThis.window ??= { clew: { invoke: async () => null, on: () => () => {} }, addEventListener() {}, removeEventListener() {} };
const { inlineDecorations } = await import('../src/renderer/editor/live/inline-layer.js');
const { noteMarkdown } = await import('../src/renderer/editor/jmd/markdown-config.js');
const { liveConfigFacet, DEFAULT_LIVE_CONFIG } = await import('../src/renderer/editor/live/config.js');
const { liveStateField } = await import('../src/renderer/editor/live/reveal-field.js');

/** Per line: what is hidden from its start (text), and its --le-indent; the
 *  caret at `anchor` (a string: the caret before its first occurrence). */
function drawn(doc, anchor = 0) {
	const at = typeof anchor === 'string' ? doc.indexOf(anchor) : anchor;
	const state = EditorState.create({
		doc, selection: { anchor: at },
		extensions: [noteMarkdown({}), liveConfigFacet.of({ ...DEFAULT_LIVE_CONFIG }), liveStateField],
	});
	const set = inlineDecorations({ state, visibleRanges: [{ from: 0, to: doc.length }] });
	const lead = new Map();
	const indent = new Map();
	const replaced = [];
	set.between(0, doc.length, (from, to, deco) => {
		const line = state.doc.lineAt(from);
		if (deco.spec.attributes?.style && from === to) {
			const m = /--le-indent: (\d+)/.exec(deco.spec.attributes.style);
			if (m) indent.set(line.number, Number(m[1]));
		}
		if (from < to && !deco.spec.class && !deco.spec.attributes) {
			replaced.push([from, to]);
			// (Line 1 is the heading, its `# ` hidden when the caret is elsewhere.)
			if (from === line.from && !deco.spec.widget && line.number > 1) lead.set(line.number, doc.slice(from, to));
		}
	});
	replaced.sort((a, b) => a[0] - b[0]);
	for (let i = 1; i < replaced.length; i += 1) {
		assert.ok(replaced[i][0] >= replaced[i - 1][1], `overlapping hidden ranges ${JSON.stringify(replaced[i - 1])} ${JSON.stringify(replaced[i])}`);
	}
	return { lead, indent };
}

const head = '# Note\n\n';

test('a body flush left loses nothing', () => {
	const { lead } = drawn(`${head}@begin(theorem)\nFlush left.\n\nAnd again.\n@end(theorem)\n`);
	assert.deepEqual([...lead], []);
});

test('an indented body loses its common indentation, concealed or with the caret in it, and keeps the rest', () => {
	const doc = `${head}@begin(lemma)\n  Two.\n    Four.\n\n  Two again.\n@end(lemma)\n\nAfter.\n`;
	const want = [[4, '  '], [5, '  '], [7, '  ']];
	assert.deepEqual([...drawn(doc).lead], want, 'concealed: two spaces off each, "Four." two in still');
	assert.deepEqual([...drawn(doc, 'Four.').lead], want, 'the caret in it: the same — the line never moves');
	assert.deepEqual([...drawn(doc, '@begin').lead], want, 'revealed: the same');
});

test('tabs are its indentation as written; mixed tabs and spaces share none', () => {
	assert.deepEqual([...drawn(`${head}@begin(lemma)\n\tOne.\n\t\tTwo.\n@end(lemma)\n`).lead], [[4, '\t'], [5, '\t']]);
	assert.deepEqual([...drawn(`${head}@begin(lemma)\n  One.\n\tTwo.\n@end(lemma)\n`).lead], []);
});

test('nested: the inner body its own indentation, the inner opener and closer the outer\'s when shown', () => {
	const doc = `${head}@begin(clew-only)\n  Outer.\n  @begin(theorem)\n    Inner.\n  @end(theorem)\n  Outer again.\n@end(clew-only)\n`;
	// Concealed, the inner head and foot are widgets over their whole lines.
	assert.deepEqual([...drawn(doc).lead], [[4, '  '], [6, '    '], [8, '  ']]);
	// The caret on the inner opener reveals it: its line loses the outer's two.
	assert.deepEqual([...drawn(doc, '@begin(theorem)').lead], [[4, '  '], [5, '  '], [6, '    '], [7, '  '], [8, '  ']]);
});

test('a list in an indented body: its columns less the body\'s, its later line hidden once', () => {
	const doc = `${head}@begin(lemma)\n  - an item\n    its second line\n    - nested\n@end(lemma)\n`;
	const { lead, indent } = drawn(doc);
	assert.equal(lead.get(4), '  ', 'the item\'s line loses the body\'s two');
	assert.equal(lead.get(5), '    ', 'its later line hidden whole, by the list, once');
	assert.equal(indent.get(4), 0, 'the item at the body\'s margin');
	assert.equal(indent.get(5), 0);
	assert.equal(indent.get(6), 2, 'the nested item two in from it');
	// The same list flush left: the same columns.
	const flush = drawn(`${head}@begin(lemma)\n- an item\n  its second line\n  - nested\n@end(lemma)\n`);
	assert.deepEqual([4, 5, 6].map((n) => flush.indent.get(n)), [0, 0, 2]);
});

test('an unclosed environment is literal: nothing hidden', () => {
	assert.deepEqual([...drawn(`${head}@begin(lemma)\n  Never closed.\n`).lead], []);
});

test('a body ⌥⌘E has just written, its one line blank, loses that line\'s indentation', () => {
	assert.deepEqual([...drawn(`${head}@begin(lemma)\n  \n@end(lemma)\n`).lead], [[4, '  ']]);
});
