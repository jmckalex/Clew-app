// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Who may read a clew-preview:// response across origins (src/main/preview-cors.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, narrowCors } from '../src/main/preview-cors.js';

const served = () => new Response('body', {
	status: 200,
	headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
});

test('the preview origin and the app page (null) may read; nothing else', () => {
	assert.equal(allowedOrigin('clew-preview://vault'), 'clew-preview://vault');
	assert.equal(allowedOrigin('null'), 'null');
	assert.equal(allowedOrigin('https://example.com'), null);
	assert.equal(allowedOrigin('http://localhost:8080'), null);
	assert.equal(allowedOrigin('file://'), null);
	assert.equal(allowedOrigin(null), null);
	assert.equal(allowedOrigin(''), null);
});

test('an allowed origin is echoed, never a wildcard, and the response varies by it', async () => {
	const res = narrowCors('null', served());
	assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'null');
	assert.match(res.headers.get('Vary'), /Origin/);
	assert.equal(res.headers.get('Content-Type'), 'text/html');
	assert.equal(res.status, 200);
	assert.equal(await res.text(), 'body');
});

test('any other origin gets no Access-Control-Allow-Origin at all', () => {
	const res = narrowCors('https://example.com', served());
	assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
	assert.equal(res.headers.get('Content-Type'), 'text/html');
});

test('a request with no Origin (same-origin, a navigation) gets none either — it needs none', () => {
	assert.equal(narrowCors(null, served()).headers.get('Access-Control-Allow-Origin'), null);
});

test('status, status text and a streamed body pass through; 206 and errors too', async () => {
	const partial = new Response(new Blob(['abc']).stream(), { status: 206, statusText: 'Partial Content', headers: { 'Content-Range': 'bytes 0-2/10' } });
	const res = narrowCors('clew-preview://vault', partial);
	assert.equal(res.status, 206);
	assert.equal(res.statusText, 'Partial Content');
	assert.equal(res.headers.get('Content-Range'), 'bytes 0-2/10');
	assert.equal(await res.text(), 'abc');
	const missing = narrowCors('https://example.com', new Response('nope', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }));
	assert.equal(missing.status, 404);
	assert.equal(missing.headers.get('Access-Control-Allow-Origin'), null);
});
