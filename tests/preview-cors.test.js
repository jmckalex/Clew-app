// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Who may read a clew-preview:// response across origins, and who the render
// POSTs hear (src/main/preview-cors.js; frame-bridge.md §2.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrowCors, renderOriginAllowed } from '../src/main/preview-cors.js';

const served = (extra = {}) => new Response('body', {
	status: 200,
	headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...extra },
});

test('every response grants the app page, as a constant — never a wildcard, never null', async () => {
	const res = narrowCors(served({ Vary: 'Origin' }));
	assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'clew-app://app');
	assert.equal(res.headers.get('Vary'), null, 'a constant needs no Vary');
	assert.equal(res.headers.get('Content-Type'), 'text/html');
	assert.equal(res.status, 200);
	assert.equal(await res.text(), 'body');
});

test('status and body survive', async () => {
	const res = narrowCors(new Response('gone', { status: 404 }));
	assert.equal(res.status, 404);
	assert.equal(await res.text(), 'gone');
});

test('the render POSTs hear the app page, a preview document, or no Origin', () => {
	assert.equal(renderOriginAllowed('clew-app://app'), true);
	assert.equal(renderOriginAllowed('clew-preview://vault'), true);
	assert.equal(renderOriginAllowed(null), true);
	assert.equal(renderOriginAllowed(''), true);
	for (const o of ['null', 'https://example.com', 'http://localhost:8080', 'file://', 'clew-frame://abc']) {
		assert.equal(renderOriginAllowed(o), false, o);
	}
});
