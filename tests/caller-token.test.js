// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The caller token (docs/dev/frame-bridge.md §1): the server's check
// (src/main/caller-token.js), the handshake's two rules
// (src/shared/caller-token.js), and a preview document's ask — its retry,
// its giving up, its relay (src/preview-client/caller-token.js).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { newCallerToken, tokenMatches, readRenderBody, RENDER_BODY_LIMIT } from '../src/main/caller-token.js';
import { answersAsk, tokenFrom, PREVIEW_ORIGIN, TOKEN_MESSAGE } from '../src/shared/caller-token.js';

const T = newCallerToken();
const body = (o) => JSON.stringify(o);

test('a token is 32 random bytes, hex, and never repeats', () => {
	assert.match(T, /^[0-9a-f]{64}$/);
	assert.notEqual(newCallerToken(), newCallerToken());
});

test('tokenMatches: exact only', () => {
	assert.equal(tokenMatches(T, T), true);
	assert.equal(tokenMatches(T, T.slice(0, -1)), false);          // shorter
	assert.equal(tokenMatches(T, `${T}0`), false);                  // longer
	assert.equal(tokenMatches(T, T.replace(/.$/, (c) => (c === '0' ? '1' : '0'))), false);
	assert.equal(tokenMatches(T, undefined), false);
	assert.equal(tokenMatches(T, 42), false);
	assert.equal(tokenMatches(null, null), false);                  // a session with none refuses all
	assert.equal(tokenMatches('', ''), false);
});

test('readRenderBody: refused before anything is read, without the token', () => {
	assert.deepEqual(readRenderBody(body({ text: 'x' }), T), { status: 403, message: 'Forbidden' });
	assert.deepEqual(readRenderBody(body({ token: 'nope', text: 'x' }), T), { status: 403, message: 'Forbidden' });
	assert.deepEqual(readRenderBody(body({ token: T, text: 'x' }), null), { status: 403, message: 'Forbidden' });
	// The old raw-text fragment body is not JSON: refused, never rendered.
	assert.equal(readRenderBody('# A card', T).status, 400);
	assert.equal(readRenderBody('null', T).status, 400);
	assert.equal(readRenderBody('x'.repeat(RENDER_BODY_LIMIT + 1), T).status, 413);
});

test('readRenderBody: the text and its note, with the token', () => {
	assert.deepEqual(readRenderBody(body({ token: T, text: '# A card' }), T), { text: '# A card', sourcePath: null, book: null });
	assert.deepEqual(readRenderBody(body({ token: T, text: 'x', sourcePath: 'Notes/A.md' }), T), { text: 'x', sourcePath: 'Notes/A.md', book: null });
	assert.equal(readRenderBody(body({ token: T, text: 3 }), T).status, 400);
	assert.equal(readRenderBody(body({ token: T, text: 'x', sourcePath: 7 }), T).status, 400);
});

test('readRenderBody: a chapter\'s book — the master then its chapters, vault paths', () => {
	assert.deepEqual(readRenderBody(body({ token: T, text: 'x', sourcePath: 'B/One.md', book: ['B/B.md', 'B/One.md'] }), T),
		{ text: 'x', sourcePath: 'B/One.md', book: ['B/B.md', 'B/One.md'] });
	assert.equal(readRenderBody(body({ token: T, text: 'x', book: 'B/B.md' }), T).status, 400);
	assert.equal(readRenderBody(body({ token: T, text: 'x', book: ['B/B.md', 3] }), T).status, 400);
	assert.equal(readRenderBody(body({ token: T, text: 'x', book: Array(2001).fill('a.md') }), T).status, 400);
});

// ---- the handshake's rules ----------------------------------------------------

const app = { name: 'app' };
app.parent = app;                                   // a top-level window
const child = { name: 'child', parent: app };
const grandchild = { name: 'grandchild', parent: child };
const ask = { source: 'clew-preview', type: TOKEN_MESSAGE };

test('answersAsk: only an own child frame, on the preview origin', () => {
	assert.equal(answersAsk({ data: ask, origin: PREVIEW_ORIGIN, source: child }, app), true);
	assert.equal(answersAsk({ data: ask, origin: 'null', source: child }, app), false);             // sandboxed srcdoc
	assert.equal(answersAsk({ data: ask, origin: 'https://example.com', source: child }, app), false);
	assert.equal(answersAsk({ data: ask, origin: PREVIEW_ORIGIN, source: grandchild }, app), false); // not ours: its parent answers
	assert.equal(answersAsk({ data: ask, origin: PREVIEW_ORIGIN, source: app }, app), false);        // never itself
	assert.equal(answersAsk({ data: ask, origin: PREVIEW_ORIGIN, source: null }, app), false);
	assert.equal(answersAsk({ data: { source: 'clew-preview', type: 'ready' }, origin: PREVIEW_ORIGIN, source: child }, app), false);
	const stale = { get parent() { throw new Error('stale WindowProxy'); } };
	assert.equal(answersAsk({ data: ask, origin: PREVIEW_ORIGIN, source: stale }, app), false);     // fails closed
});

test('tokenFrom: only from the parent (itself, at the top)', () => {
	const answer = { source: 'clew-preview-host', type: TOKEN_MESSAGE, token: T };
	assert.equal(tokenFrom({ data: answer, source: app }, child), T);
	assert.equal(tokenFrom({ data: answer, source: grandchild }, child), null);   // a child cannot hand one down
	assert.equal(tokenFrom({ data: answer, source: app }, app), T);              // the print view's self-post
	assert.equal(tokenFrom({ data: { ...answer, token: '' }, source: app }, child), null);
	assert.equal(tokenFrom({ data: { ...answer, source: 'clew-preview' }, source: app }, child), null);
});

// ---- a preview document's ask -------------------------------------------------

/** A stand-in window for preview-client/caller-token.js, which binds to `window`. */
function fakeWindow() {
	const listeners = {};
	const parentPosts = [];
	const w = {
		parent: { postMessage: (msg, target) => parentPosts.push({ msg, target }) },
		addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
		emit: (type, event) => { for (const fn of listeners[type] ?? []) fn(event); },
		parentPosts,
	};
	return w;
}

test('the ask: lazy, retried, answered once', async () => {
	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		const w = fakeWindow();
		globalThis.window = w;
		const { callerToken } = await import(`../src/preview-client/caller-token.js?case=answered`);
		assert.equal(w.parentPosts.length, 0, 'nothing asked until a POST needs it');
		const got = callerToken();
		assert.equal(w.parentPosts.length, 1);
		assert.deepEqual(w.parentPosts[0].msg, { source: 'clew-preview', type: TOKEN_MESSAGE });
		mock.timers.tick(1000);
		assert.equal(w.parentPosts.length, 2, 'a lost ask is repeated');
		w.emit('message', { data: { source: 'clew-preview-host', type: TOKEN_MESSAGE, token: T }, source: w.parent });
		assert.equal(await got, T);
		mock.timers.tick(5000);
		assert.equal(w.parentPosts.length, 2, 'no asks once answered');
		assert.equal(await callerToken(), T);
	} finally {
		mock.timers.reset();
		delete globalThis.window;
	}
});

test('the ask: gives up after five tries, then asks afresh', async () => {
	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		const w = fakeWindow();
		globalThis.window = w;
		const { callerToken } = await import(`../src/preview-client/caller-token.js?case=lost`);
		const got = callerToken();
		for (let i = 0; i < 5; i++) mock.timers.tick(1000);
		await assert.rejects(got, /no caller token/);
		assert.equal(w.parentPosts.length, 5);
		// A forged answer from anyone but the parent is not believed.
		const next = callerToken();
		w.emit('message', { data: { source: 'clew-preview-host', type: TOKEN_MESSAGE, token: 'forged' }, source: {} });
		w.emit('pageshow', {});
		assert.equal(w.parentPosts.length, 7, 'a fresh ask, and pageshow repeats it');
		w.emit('message', { data: { source: 'clew-preview-host', type: TOKEN_MESSAGE, token: T }, source: w.parent });
		assert.equal(await next, T);
	} finally {
		mock.timers.reset();
		delete globalThis.window;
	}
});

test('the relay: a document answers its own frame, asking for itself first', async () => {
	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		const w = fakeWindow();
		globalThis.window = w;
		await import(`../src/preview-client/caller-token.js?case=relay`);
		const replies = [];
		const card = { parent: w, postMessage: (msg, target) => replies.push({ msg, target }) };
		w.emit('message', { data: ask, origin: PREVIEW_ORIGIN, source: card });
		assert.equal(w.parentPosts.length, 1, 'the document asks its own parent');
		w.emit('message', { data: { source: 'clew-preview-host', type: TOKEN_MESSAGE, token: T }, source: w.parent });
		await new Promise((r) => setImmediate(r));
		assert.deepEqual(replies, [{ msg: { source: 'clew-preview-host', type: TOKEN_MESSAGE, token: T }, target: PREVIEW_ORIGIN }]);
		// Not a frame of this document: no answer.
		const stranger = { parent: {}, postMessage: (msg) => replies.push({ msg }) };
		w.emit('message', { data: ask, origin: PREVIEW_ORIGIN, source: stranger });
		await new Promise((r) => setImmediate(r));
		assert.equal(replies.length, 1);
	} finally {
		mock.timers.reset();
		delete globalThis.window;
	}
});
