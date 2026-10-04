// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The demo Stock Ticker's live-quote rules (demo-vault/Apps/Ticker/live.js):
// Finnhub's free limit kept, a 429 backed off, the market's state, the
// quote's shape, the request.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// A plain script for the app's page; here it is handed a `module`.
const source = fs.readFileSync(new URL('../demo-vault/Apps/Ticker/live.js', import.meta.url), 'utf8');
const mod = { exports: {} };
new Function('module', source)(mod);
const { nextDelay, backoffAfter429, quoteFrom, marketState, quoteUrl } = mod.exports;

test('each symbol about once a minute, never past 50 a minute; the first round quickly', () => {
	assert.equal(nextDelay({ symbols: 8, firstRound: true }), 300);
	assert.equal(nextDelay({ symbols: 8, firstRound: false }), 7500);
	assert.equal(nextDelay({ symbols: 1, firstRound: false }), 60000);
	// 200 symbols: still no more than 50 requests a minute.
	assert.equal(nextDelay({ symbols: 200, firstRound: false }), 1200);
	assert.ok(60000 / nextDelay({ symbols: 200, firstRound: false }) <= 50);
	assert.equal(nextDelay({ symbols: 0, firstRound: false }), 60000);
});

test('a 429 waits as Finnhub says, else a minute, doubling, five minutes at most', () => {
	assert.equal(backoffAfter429(0, '7'), 7000);
	assert.equal(backoffAfter429(0, null), 60000);
	assert.equal(backoffAfter429(60000, null), 120000);
	assert.equal(backoffAfter429(240000, null), 300000);
	assert.equal(backoffAfter429(0, '9999'), 300000);
	assert.equal(backoffAfter429(0, 'soon'), 60000);
});

test('Finnhub’s quote, and a symbol it does not know', () => {
	assert.deepEqual(quoteFrom({ c: 227.5, d: 1.25, dp: 0.55, h: 228, l: 225, o: 226, pc: 226.25, t: 1790000000 }),
		{ price: 227.5, prevClose: 226.25, change: 1.25, pct: 0.55, t: 1790000000 });
	assert.deepEqual(quoteFrom({ c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 }), { unknown: true });
	assert.deepEqual(quoteFrom(null), { unknown: true });
	assert.deepEqual(quoteFrom({ error: 'Invalid API key.' }), { unknown: true });
});

test('open while the newest quote is under 15 minutes old; closed as of it after', () => {
	const now = 1790000000;
	assert.deepEqual(marketState([{ t: now - 60 }, { t: now - 7200 }], now), { state: 'open', asOf: now - 60 });
	assert.deepEqual(marketState([{ t: now - 3 * 86400 }, { unknown: true }], now), { state: 'closed', asOf: now - 3 * 86400 });
	assert.deepEqual(marketState([{ unknown: true }], now), { state: 'none', asOf: null });
});

test('the request: the symbol and the key as Finnhub’s token parameter, both escaped', () => {
	assert.equal(quoteUrl('https://finnhub.io/api/v1', 'BRK.B', 'k&y=1'),
		'https://finnhub.io/api/v1/quote?symbol=BRK.B&token=k%26y%3D1');
});
