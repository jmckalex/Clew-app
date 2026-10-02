// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Who a window listens to (src/shared/message-guard.js): the app page's
// bridges act only for a preview-origin document; a document's host messages
// come only from the window it expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromPreviewOrigin, fromWindow, PREVIEW_ORIGIN, parentOrigin, topOrigin, postTo } from '../src/shared/message-guard.js';

const viewer = { name: 'a viewer page' };

test('fromPreviewOrigin: a preview-origin document only', () => {
	assert.equal(fromPreviewOrigin({ origin: PREVIEW_ORIGIN, source: viewer }), true);
	assert.equal(fromPreviewOrigin({ origin: 'https://example.com', source: viewer }), false); // a remote page
	assert.equal(fromPreviewOrigin({ origin: 'null', source: viewer }), false);                // a sandboxed frame
	assert.equal(fromPreviewOrigin({ origin: '', source: viewer }), false);
	assert.equal(fromPreviewOrigin({ origin: 'clew-preview://other', source: viewer }), false);
	assert.equal(fromPreviewOrigin({ origin: PREVIEW_ORIGIN, source: null }), false);          // no window to answer
	assert.equal(fromPreviewOrigin(undefined), false);
});

test('fromWindow: exactly the expected window', () => {
	const parent = { name: 'parent' };
	const child = { name: 'a frame the note embeds' };
	assert.equal(fromWindow({ source: parent }, parent), true);
	assert.equal(fromWindow({ source: child }, parent), false);
	assert.equal(fromWindow({ source: null }, parent), false);
	assert.equal(fromWindow({ source: parent }, null), false);   // nothing expected: nothing believed
	const top = { name: 'the print view' };
	assert.equal(fromWindow({ source: top }, top), true);          // parent === self at the top
});

// ---- who a window addresses (§2.8 step 2) --------------------------------

const loc = (origin, ancestors) => ({ origin, ancestorOrigins: ancestors });

test('parentOrigin / topOrigin read ancestorOrigins: parent first, top last', () => {
	// A card in the reading view: parent and top are the app page.
	const card = loc(PREVIEW_ORIGIN, ['clew-app://app']);
	assert.equal(parentOrigin(card), 'clew-app://app');
	assert.equal(topOrigin(card), 'clew-app://app');
	// A nested card in a canvas scene: the scene is its parent, the app the top.
	const nested = loc(PREVIEW_ORIGIN, [PREVIEW_ORIGIN, 'clew-app://app']);
	assert.equal(parentOrigin(nested), PREVIEW_ORIGIN);
	assert.equal(topOrigin(nested), 'clew-app://app');
	// The print view: top-level, so its "parent" is itself.
	const top = loc(PREVIEW_ORIGIN, []);
	assert.equal(parentOrigin(top), PREVIEW_ORIGIN);
	assert.equal(topOrigin(top), PREVIEW_ORIGIN);
	// A browser that cannot say keeps the old behaviour.
	assert.equal(parentOrigin({ origin: PREVIEW_ORIGIN }), '*');
});

test('postTo names the origin, sends nothing to an opaque one, never throws', () => {
	const sent = [];
	const win = { postMessage: (msg, origin) => sent.push([msg.type, origin]) };
	assert.equal(postTo(win, { type: 'a' }, 'clew-app://app'), true);
	assert.equal(postTo(win, { type: 'b' }, 'null'), false);
	assert.equal(postTo(null, { type: 'c' }, PREVIEW_ORIGIN), false);
	assert.equal(postTo({ postMessage() { throw new Error('gone'); } }, { type: 'd' }, PREVIEW_ORIGIN), false);
	assert.deepEqual(sent, [['a', 'clew-app://app']]);
});
