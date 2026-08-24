// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	formatDiaryDate, parseDiaryDate, dayKey, parseLogSections,
	upsertLogSection, extractLogRange, composeDiaryView, dayKeysInRange,
} from '../src/shared/diary.js';

const d = (y, m, day) => new Date(y, m - 1, day);

test('format/parse round-trips across formats', () => {
	for (const format of ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM.DD.YYYY']) {
		const date = d(2026, 8, 22);
		const text = formatDiaryDate(date, format);
		assert.deepEqual(parseDiaryDate(text, format), date, format);
	}
	assert.equal(parseDiaryDate('not a date', 'YYYY-MM-DD'), null);
	assert.equal(parseDiaryDate('2026-02-31', 'YYYY-MM-DD'), null); // impossible
	assert.equal(parseDiaryDate('2026-08', 'YYYY-MM'), null); // format lacks DD
	assert.equal(dayKey(d(2026, 8, 22)), '2026-08-22');
});

test('parseLogSections finds date headings with correct spans', () => {
	const text = '# 2026-08-22\n\nToday.\n\n# 2026-08-20\n\nEarlier.\n\n## Not a date\nBody.\n';
	const sections = parseLogSections(text, 'YYYY-MM-DD');
	assert.deepEqual(sections.map((s) => s.key), ['2026-08-22', '2026-08-20']);
	assert.equal(text.slice(sections[0].from, sections[0].to), '# 2026-08-22\n\nToday.\n\n');
	assert.ok(text.slice(sections[1].from).startsWith('# 2026-08-20'));
	assert.equal(sections[1].to, text.length); // runs to EOF past non-date heading
});

test('upsertLogSection keeps newest-first order', () => {
	let { text } = upsertLogSection('', d(2026, 8, 20), 'YYYY-MM-DD');
	({ text } = upsertLogSection(text, d(2026, 8, 22), 'YYYY-MM-DD', 'Seeded.'));
	({ text } = upsertLogSection(text, d(2026, 8, 21), 'YYYY-MM-DD'));
	const keys = parseLogSections(text, 'YYYY-MM-DD').map((s) => s.key);
	assert.deepEqual(keys, ['2026-08-22', '2026-08-21', '2026-08-20']);
	assert.ok(text.includes('# 2026-08-22\n\nSeeded.\n'));
	// Upserting an existing day is a no-op returning its heading line.
	const again = upsertLogSection(text, d(2026, 8, 21), 'YYYY-MM-DD');
	assert.equal(again.text, text);
	assert.equal(text.split('\n')[again.line - 1], '# 2026-08-21');
});

test('extractLogRange filters and orders newest first', () => {
	let { text } = upsertLogSection('', d(2026, 8, 18), 'YYYY-MM-DD', 'A');
	({ text } = upsertLogSection(text, d(2026, 8, 20), 'YYYY-MM-DD', 'B'));
	({ text } = upsertLogSection(text, d(2026, 8, 22), 'YYYY-MM-DD', 'C'));
	const chunks = extractLogRange(text, 'YYYY-MM-DD', '2026-08-19', '2026-08-21');
	assert.equal(chunks.length, 1);
	assert.equal(chunks[0].heading, '2026-08-20');
	assert.equal(chunks[0].body, 'B');
	const all = extractLogRange(text, 'YYYY-MM-DD', '0000-00-00', '9999-99-99');
	assert.deepEqual(all.map((c) => c.key), ['2026-08-22', '2026-08-20', '2026-08-18']);
});

test('composeDiaryView demotes H1s under day headings', () => {
	const view = composeDiaryView('Diary — test', [
		{ key: '2026-08-22', heading: '2026-08-22', body: '# My Day\n\nGood.' },
	]);
	assert.ok(view.startsWith('# Diary — test'));
	assert.ok(view.includes('## 2026-08-22'));
	assert.ok(view.includes('### My Day'));
	assert.ok(view.includes('[!NOTE]'));
});

test('dayKeysInRange walks inclusive, newest first, across months', () => {
	const keys = dayKeysInRange('2026-07-30', '2026-08-02');
	assert.deepEqual(keys, ['2026-08-02', '2026-08-01', '2026-07-31', '2026-07-30']);
});
