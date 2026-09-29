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
import { fromPreviewOrigin, fromWindow, PREVIEW_ORIGIN } from '../src/shared/message-guard.js';

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
