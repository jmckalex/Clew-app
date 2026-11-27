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

test('an @begin(…) holding no name is drawn as written: no chip, its `@` shown', () => {
	// ⌥⌘E's opener before a name is typed (the owner's report on dev.24,
	// 2026-11-27: a chip "begin", its `@` hidden).
	const d = drawn('# Note\n\n@begin()\n  \n@end()\n\nAfter.\n');
	assert.ok(!d.widgets.includes('ChipWidget'), `no chip: ${d.widgets}`);
	assert.deepEqual(d.hidden.filter((h) => h.includes('@')), [], 'no `@` hidden');
});

/** Every line class and head widget the layer gives `doc`, the caret at `anchor`. */
function frames(doc, anchor) {
	const state = EditorState.create({
		doc, selection: { anchor },
		extensions: [noteMarkdown({}), liveConfigFacet.of({ ...DEFAULT_LIVE_CONFIG }), liveStateField],
	});
	const set = inlineDecorations({ state, visibleRanges: [{ from: 0, to: doc.length }] });
	const lines = new Map();
	const styles = new Map();
	const heads = [];
	set.between(0, doc.length, (from, to, deco) => {
		const n = state.doc.lineAt(from).number;
		if (deco.spec.class && from === to) lines.set(n, `${lines.get(n) ?? ''} ${deco.spec.class}`.trim());
		if (deco.spec.attributes?.style && from === to) styles.set(n, `${styles.get(n) ?? ''};${deco.spec.attributes.style}`);
		if (deco.spec.widget?.constructor.name === 'EnvHeadWidget') heads.push([deco.spec.widget.name, deco.spec.widget.note]);
	});
	return { lines, styles, heads };
}

/** A line's environment rules, top feet (┌) and feet (└), from its style
 *  (env-rules.js): a foot is a 10px × 2px layer, at the line's top or bottom. */
const rules = (style = '') => {
	const sizes = /background-size: ([^;]+)/.exec(style)?.[1].split(', ') ?? [];
	const places = /background-position: ([^;]+)/.exec(style)?.[1].split(', ') ?? [];
	const feet = (end) => sizes.filter((x, i) => x === '10px 2px' && places[i]?.endsWith(end)).length;
	return [sizes.filter((x) => x === '2px 100%').length, feet(' 0'), feet('100%')];
};

test('an environment\'s concealed closer is its frame\'s foot, a pad; `@begin(clew-only)` says what it is once', () => {
	const doc = '# Note\n\n@begin(clew-only)\nGrade: A\n@end(clew-only)\n\n@begin(theorem)\nA claim.\n@end(theorem)\n';
	const concealed = frames(doc, 0);
	assert.match(concealed.lines.get(5), /\ble-env-close\b.*\ble-env-foot-line\b/, 'the clew-only closer a pad');
	assert.match(concealed.lines.get(9), /\ble-env-foot-line\b/, 'and every environment\'s');
	assert.doesNotMatch(concealed.lines.get(4), /foot-line/, 'a body line is a line');
	assert.deepEqual(concealed.heads, [['Clew only', 'left out of PDFs and exports'], ['theorem', '']]);
	const revealed = frames(doc, doc.indexOf('@end(clew-only)'));
	assert.match(revealed.lines.get(5), /\ble-env-close\b/);
	assert.doesNotMatch(revealed.lines.get(5), /foot-line/, 'revealed, the closer is a line showing @end(…)');
	assert.match(revealed.lines.get(9), /\ble-env-foot-line\b/, 'another environment stays concealed');
});

test('spaces around an environment\'s name are nothing: `@begin( theorem )` drawn as `@begin(theorem)` — head, line classes, rules', () => {
	// The owner's ask, 2026-11-27: the engine trims them (begin-end-core.js).
	const plain = '# Note\n\n@begin(clew-only)\nOuter.\n@begin(theorem)\nA claim.\n@end(theorem)\n@end(clew-only)\n\n@begin(<aside>)\nAside.\n@end(aside)\n\nAfter.\n';
	const spaced = '# Note\n\n@begin( clew-only )\nOuter.\n@begin(\ttheorem  )\nA claim.\n@end( theorem )\n@end(clew-only)\n\n@begin( < aside > )\nAside.\n@end( aside )\n\nAfter.\n';
	const a = frames(plain, 0);
	const b = frames(spaced, 0);
	assert.deepEqual(b.heads, a.heads);
	assert.deepEqual(a.heads.map(([name]) => name), ['Clew only', 'theorem', 'aside']);
	assert.deepEqual([...b.lines], [...a.lines]);
	assert.deepEqual([...b.styles], [...a.styles]);
});

test('nested environments draw a rule per level, each starting and ending in its own foot', () => {
	const doc = '# Note\n\n@begin(clew-only)\nOuter.\n@begin(theorem)\nInner.\n@end(theorem)\nOuter again.\n@end(clew-only)\n\nAfter.\n';
	const { styles } = frames(doc, 0);
	const at = (n) => rules(styles.get(n));
	assert.deepEqual([3, 4, 5, 6, 7, 8, 9, 11].map(at),
		[[1, 1, 0], [1, 0, 0], [2, 1, 0], [2, 0, 0], [2, 0, 1], [1, 0, 0], [1, 0, 1], [0, 0, 0]],
		'head and its ┌, text, inner head and its ┌, inner text, inner └, the outer again, the outer └, after both');
	assert.match(styles.get(6), /--le-env-x: 44px/);
	assert.match(styles.get(8), /--le-env-x: 22px/, '"Outer again." back at the outer level');
	const inks = (n) => [(styles.get(n).match(/repeating-linear-gradient\(/g) ?? []).length, (styles.get(n).match(/(?<!repeating-)linear-gradient\(/g) ?? []).length];
	assert.deepEqual(inks(4), [1, 0], 'clew-only dashed');
	assert.deepEqual(inks(6), [1, 1], 'inside it, the theorem solid');
});
