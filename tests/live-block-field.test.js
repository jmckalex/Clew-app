// Live edit's block field (src/renderer/editor/live/block-field.js), built
// over a real EditorState with the live fields: a table is drawn as a
// TableWidget, and its cells' references read the note's numbers — a
// chapter's, its BOOK's. From 8619a67 (2026-10-09) until 2026-10-15 building
// any table threw "numbering is not defined" (the cells were handed a
// variable tableWidget did not have) — in the field's create, so the editor
// state with live edit's fields could not be made at all, and a note holding
// a table lost ALL of its live edit (raw **bold**, an image as text, a
// callout as source; measured on the iPad and the desktop). The inline layer
// (a view plugin: bold, the callout's lines) needs a view, which plain Node
// has not; smoke/live-table-edit-scenario.js and the README's whole-note
// check see the drawn note.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { noteMarkdown } from '../src/renderer/editor/jmd/markdown-config.js';
import { liveConfigFacet, DEFAULT_LIVE_CONFIG } from '../src/renderer/editor/live/config.js';
import { liveStateField } from '../src/renderer/editor/live/reveal-field.js';
import { blockField, calloutFoldField } from '../src/renderer/editor/live/block-field.js';
import { frameHeightField } from '../src/renderer/editor/live/frames.js';
import { TableWidget } from '../src/renderer/editor/live/widgets/table.js';
import { setBookNumbering } from '../src/renderer/editor/live/numbering-source.js';
import { numberBook } from '../src/renderer/editor/live/book-numbering.js';

after(() => setBookNumbering(null));

/** Live edit's state for `doc`, the cursor at its start (on the heading). */
function liveState(doc, notePath = null) {
	const config = { ...DEFAULT_LIVE_CONFIG, notePath };
	return EditorState.create({
		doc,
		selection: { anchor: 0 },
		extensions: [noteMarkdown({}), liveConfigFacet.of(config), liveStateField, calloutFoldField, frameHeightField, blockField],
	});
}

/** The block widgets the field draws, in order. */
function widgets(state) {
	const out = [];
	state.field(blockField).deco.between(0, state.doc.length, (from, to, deco) => {
		if (deco.spec.widget) out.push(deco.spec.widget);
	});
	return out;
}

/** The tables the block field draws for `doc`. */
const tables = (doc, notePath) => widgets(liveState(doc, notePath)).filter((w) => w instanceof TableWidget);

/** What each reference chip in a table's cells reads. */
const refs = (widget) => widget.rows.flatMap((row) => row.cells.flatMap((cell) => cell.tokens))
	.filter((t) => t.type === 'ref').map((t) => t.text);

test('a note holding a table keeps ALL its live edit: the table drawn, and the bold, the image and the callout as well', () => {
	const doc = '# Note\n\nSome **bold** text.\n\n![[pic.png]]\n\n> [!note] A callout\n> Its body.\n\n'
		+ '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
	const state = liveState(doc);   // threw, before: the whole note's live edit gone
	const live = state.field(liveStateField);
	const concealed = (kind) => live.model.filter((c) => c.kind === kind && !live.revealed.has(c.id)).length;
	// `**bold**` is the dialect's intense.
	assert.deepEqual(['intense', 'image', 'callout', 'table'].map(concealed), [1, 1, 1, 1], 'each one drawn, not source');
	assert.deepEqual(widgets(state).map((w) => w.constructor.name), ['ImageWidget', 'TableWidget']);
});

test('a table in a numbered note is drawn, its references numbered as the note numbers them', () => {
	const doc = '# Note\n\n@begin(equation){#eq-a}\na = b\n@end(equation)\n\n'
		+ '| What | Where |\n| --- | --- |\n| the equation | @ref[eq-a] |\n| nothing | @ref[eq-none] |\n';
	const drawn = tables(doc);
	assert.equal(drawn.length, 1, 'the table is a widget, not source');
	assert.equal(drawn[0].rows.length, 3);
	assert.deepEqual(refs(drawn[0]), ['1', '??']);
});

test('a table in a book chapter is drawn, its references numbered as the BOOK numbers them', () => {
	const master = { path: 'Book.md', text: '---\nbook: true\nchapters:\n  - "[[One]]"\n  - "[[Two]]"\n---\n\nA book.\n' };
	const one = { path: 'One.md', text: '# One\n\n@begin(equation){#eq-a}\na = b\n@end(equation)\n' };
	const two = {
		path: 'Two.md',
		text: '# Two\n\n@begin(equation){#eq-b}\nc = d\n@end(equation)\n\n'
			+ '| Here | There |\n| --- | --- |\n| @ref[eq-b] | @ref[eq-a] |\n',
	};
	// As renderer/book-map.js installs it: the piece's lines, the book's labels.
	setBookNumbering({
		numbering(doc, notePath) {
			const book = numberBook({ master, chapters: [one, { ...two, text: doc.toString() }] });
			const piece = book.pieces.get(notePath);
			return piece ? { headingsNumeric: piece.headingsNumeric, lines: piece.lines, labels: book.labels, book: { master: master.path, title: 'Book', perChapter: book.perChapter, path: notePath } } : null;
		},
		text: () => null,
		describe: () => null,
	});
	try {
		const drawn = tables(two.text, 'Two.md');
		assert.equal(drawn.length, 1, 'the table is a widget, not source');
		assert.deepEqual(refs(drawn[0]), ['2.1', '1.1'], 'chapter two\'s own equation, and chapter one\'s');
	} finally {
		setBookNumbering(null);
	}
});
