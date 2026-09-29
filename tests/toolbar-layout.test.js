// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Which toolbar groups fit (src/renderer/editor/toolbar/toolbar-layout.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutGroups, layoutRows } from '../src/renderer/editor/toolbar/toolbar-layout.js';

const GROUPS = [
	{ id: 'history', priority: 10 },
	{ id: 'block', priority: 90 },
	{ id: 'inline', priority: 100 },
	{ id: 'list', priority: 80 },
	{ id: 'insert', priority: 70 },
	{ id: 'table-tools', priority: 60, when: (s) => s.inTable },
	{ id: 'mode', priority: Infinity },
];
const W = { history: 60, block: 130, inline: 300, list: 150, insert: 280, 'table-tools': 60, mode: 100 };
const opts = { separator: 10, overflowButton: 30 };

test('everything fits: nothing overflows, no button reserved', () => {
	// 60+130+300+150+280+100 = 1020, + 5 separators = 1070
	assert.deepEqual(layoutGroups(GROUPS, W, 1070, opts), {
		visible: ['history', 'block', 'inline', 'list', 'insert', 'mode'], overflow: [],
	});
});

test('too narrow: lowest priorities go first, spec order kept', () => {
	const r = layoutGroups(GROUPS, W, 800, opts);
	assert.deepEqual(r.visible, ['block', 'inline', 'list', 'mode']);
	assert.deepEqual(r.overflow, ['history', 'insert']);
});

test('the mode switch never drops, however narrow', () => {
	assert.deepEqual(layoutGroups(GROUPS, W, 50, opts).visible, ['mode']);
});

test('a group whose when() is false is not laid out at all', () => {
	assert.ok(!layoutGroups(GROUPS, W, 2000, opts).visible.includes('table-tools'));
	assert.ok(layoutGroups(GROUPS, W, 2000, { ...opts, state: { inTable: true } }).visible.includes('table-tools'));
});

test('the overflow button\'s width counts only when something overflows', () => {
	// Exactly the full width fits without the button…
	assert.equal(layoutGroups(GROUPS, W, 1070, opts).overflow.length, 0);
	// …one pixel less and the button's 30 + a separator must be found too.
	assert.deepEqual(layoutGroups(GROUPS, W, 1069, opts).overflow, ['history']);
});

// ---- two rows (layoutRows) -------------------------------------------------
// The same groups: one row costs 1070 (1020 + 5 separators of 10).

test('two rows: everything fits one row → one row, the mode switch last', () => {
	const r = layoutRows(GROUPS, W, 1070, opts);
	assert.deepEqual(r.rows, [['history', 'block', 'inline', 'list', 'insert', 'mode']]);
	assert.deepEqual(r.overflow, []);
});

test('two rows: just too narrow wraps in natural order, mode ends row 1, nothing hidden', () => {
	const r = layoutRows(GROUPS, W, 1060, opts);
	// row 1 reserves mode (100 + 10): history+block+inline+list = 640 + 30 = 670 ≤ 950; + insert 280 + 10 = 960 > 950
	assert.deepEqual(r.rows, [['history', 'block', 'inline', 'list', 'mode'], ['insert']]);
	assert.deepEqual(r.overflow, []);
});

test('two rows: a later small group never backfills an earlier row', () => {
	const groups = [
		{ id: 'a', priority: 50 }, { id: 'big', priority: 50 }, { id: 'small', priority: 50 },
		{ id: 'mode', priority: Infinity, align: 'end' },
	];
	const widths = { a: 100, big: 300, small: 20, mode: 50 };
	// row 1 capacity for flowing groups: 400 - (50 + 10) = 340; a (100) fits,
	// big (100+10+300) does not → row 2; small would fit row 1's gap but follows big
	const r = layoutRows(groups, widths, 400, opts);
	assert.deepEqual(r.rows, [['a', 'mode'], ['big', 'small']]);
});

test('two rows: nothing overflows while two rows can hold everything', () => {
	// the narrowest width with no overflow: row 1 must still take whatever the
	// greedy puts there; walk down until the first overflow appears
	let lastClean = null;
	for (let w = 1060; w > 300; w -= 5) {
		const r = layoutRows(GROUPS, W, w, opts);
		if (r.overflow.length) {
			assert.ok(lastClean, 'some width wraps cleanly');
			assert.equal(lastClean.rows.length, 2);
			// the first overflowing width genuinely cannot pack all groups into two rows
			assert.equal(r.rows.length <= 2, true);
			return;
		}
		lastClean = r;
	}
	assert.fail('never overflowed');
});

test('two rows: past two rows the priority rule decides, … reserved on row 2', () => {
	// kept highest first while the rest still pack into two rows (… reserved):
	// inline 100, block 90 keep; list 80 and insert 70 cannot pack; history 10
	// still fits the room left on row 1 — the one-row rule's behaviour too
	const r = layoutRows(GROUPS, W, 420, opts);
	assert.deepEqual(r.rows, [['history', 'block', 'mode'], ['inline']]);
	assert.deepEqual(r.overflow, ['list', 'insert']);
	// row 2 leaves room for the … button (30 + 10)
	assert.ok(W.inline + 40 <= 420);
});

test('two rows: maxRows 1 is the one-row layout (a short viewport)', () => {
	assert.deepEqual(layoutRows(GROUPS, W, 800, { ...opts, maxRows: 1 }).visible, ['block', 'inline', 'list', 'mode']);
	assert.deepEqual(layoutRows(GROUPS, W, 800, { ...opts, maxRows: 1 }).rows.length, 1);
});

test('two rows: hysteresis — back to one row only with slack to spare', () => {
	assert.equal(layoutRows(GROUPS, W, 1074, { ...opts, previousRows: 2, hysteresis: 8 }).rows.length, 2);
	assert.equal(layoutRows(GROUPS, W, 1078, { ...opts, previousRows: 2, hysteresis: 8 }).rows.length, 1);
	assert.equal(layoutRows(GROUPS, W, 1070, { ...opts, previousRows: 1, hysteresis: 8 }).rows.length, 1);
});

test('two rows: a group whose when() is false is not laid out', () => {
	const r = layoutRows(GROUPS, W, 1060, { ...opts, state: { inTable: false } });
	assert.ok(!r.rows.flat().includes('table-tools'));
	const t = layoutRows(GROUPS, W, 1060, { ...opts, state: { inTable: true } });
	assert.ok(t.rows.flat().includes('table-tools'));
});

test('two rows: a context group never changes the row count (the table tools)', () => {
	// always-there groups cost 1070: one row at 1075 — in a table too, where
	// the table tools go into … rather than add a row
	const out = layoutRows(GROUPS, W, 1075, { ...opts, state: { inTable: false } });
	const inTable = layoutRows(GROUPS, W, 1075, { ...opts, state: { inTable: true } });
	assert.equal(out.rows.length, 1);
	assert.equal(inTable.rows.length, 1);
	assert.ok(inTable.overflow.includes('table-tools'));
	// and on two rows the table tools take room on them, positions of the
	// others unchanged
	const two = layoutRows(GROUPS, W, 1060, { ...opts, state: { inTable: true } });
	assert.deepEqual(two.rows, [['history', 'block', 'inline', 'list', 'mode'], ['insert', 'table-tools']]);
});
