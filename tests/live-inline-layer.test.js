// Live edit's inline layer (src/renderer/editor/live/inline-layer.js) over a
// real EditorState: a construct whose drawing throws stays SOURCE and the rest
// of the note is drawn (guarded.js) — a throw out of the layer's build loses
// every mark, chip and line class in the note, as a throw out of the block
// field's lost the whole live edit (8619a67's table, 2026-10-09 → 15).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';

// The layer reaches the vault store, and so the preload's bridge, as it
// loads: the least of a window for that.
globalThis.window ??= { clew: { invoke: async () => null, on: () => () => {} }, addEventListener() {}, removeEventListener() {} };
const { inlineDecorations } = await import('../src/renderer/editor/live/inline-layer.js');
const { vaultStore } = await import('../src/renderer/state/vault-store.js');
const { noteMarkdown } = await import('../src/renderer/editor/jmd/markdown-config.js');
const { liveConfigFacet, DEFAULT_LIVE_CONFIG } = await import('../src/renderer/editor/live/config.js');
const { liveStateField } = await import('../src/renderer/editor/live/reveal-field.js');
const { setBookNumbering } = await import('../src/renderer/editor/live/numbering-source.js');

after(() => setBookNumbering(null));

/** The layer's decorations for `doc` as a view showing all of it would get them. */
function drawn(doc, notePath = null) {
	const state = EditorState.create({
		doc,
		selection: { anchor: 0 },   // on the heading: the lines below are concealed
		extensions: [noteMarkdown({}), liveConfigFacet.of({ ...DEFAULT_LIVE_CONFIG, notePath }), liveStateField],
	});
	const set = inlineDecorations({ state, visibleRanges: [{ from: 0, to: doc.length }] });
	const out = { classes: [], hidden: [], widgets: [] };
	set.between(0, doc.length, (from, to, deco) => {
		if (deco.spec.class) out.classes.push(deco.spec.class.split(' ')[0]);
		else if (deco.spec.widget) out.widgets.push(deco.spec.widget.constructor.name);
		else out.hidden.push(doc.slice(from, to));
	});
	return out;
}

const note = '# Note\n\nSome **bold**, a #tag and [[Elsewhere]] here.\n\n- an item\n';

test('the note is drawn: bold, tag, wikilink, list', () => {
	const d = drawn(note);
	for (const cls of ['le-intense', 'le-tag', 'le-wikilink', 'le-li']) assert.ok(d.classes.includes(cls), `${cls} in ${d.classes}`);
	assert.ok(d.hidden.includes('[[') && d.hidden.includes(']]'), 'the brackets concealed');
});

test('a construct that throws stays source, the rest of the note drawn, and says so once', (t) => {
	const warn = t.mock.method(console, 'warn', () => {});
	const resolve = vaultStore.resolveNoteName;
	vaultStore.resolveNoteName = () => { throw new Error('forced'); };   // the wikilink's drawing
	try {
		const d = drawn(note);
		assert.ok(!d.classes.includes('le-wikilink'), 'the wikilink as source');
		assert.ok(!d.hidden.includes('[[') && !d.hidden.includes(']]'), 'its brackets shown — nothing half-drawn');
		for (const cls of ['le-intense', 'le-tag', 'le-li']) assert.ok(d.classes.includes(cls), `${cls} still drawn`);
		assert.equal(warn.mock.callCount(), 1);
		assert.match(String(warn.mock.calls[0].arguments[0]), /a wikilink could not be drawn; it shows as source/);
		drawn(note);
		assert.equal(warn.mock.callCount(), 1, 'said once, not on every rebuild');
	} finally {
		vaultStore.resolveNoteName = resolve;
	}
	assert.ok(drawn(note).classes.includes('le-wikilink'), 'drawn again once it can be');
});

test('numbers that cannot be counted cost only the constructs that show one', (t) => {
	const warn = t.mock.method(console, 'warn', () => {});
	setBookNumbering({ numbering() { throw new Error('the book could not be counted'); }, text: () => null, describe: () => null });
	try {
		const d = drawn('# Note\n\nSee @ref[eq-a], in **bold**.\n', 'Chapter.md');
		assert.ok(d.classes.includes('le-intense'), 'the bold drawn');
		assert.ok(!d.widgets.includes('ChipWidget'), 'the reference as source, no chip');
		assert.match(String(warn.mock.calls[0]?.arguments[0]), /could not be drawn; it shows as source/);
	} finally {
		setBookNumbering(null);
	}
});
