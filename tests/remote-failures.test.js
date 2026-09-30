// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The web-PDF viewer's failure texts (preview-client/remote-failures.js):
// every code the desktop fetcher can name has one, and so does iOS's
// `insecure-url`; none states a size limit, which differs by platform and
// comes from the host's own message.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FAILURES } from '../src/preview-client/remote-failures.js';

const fetcher = fs.readFileSync(new URL('../src/main/remote-fetch.js', import.meta.url), 'utf8');
const thrown = new Set([...fetcher.matchAll(/RemoteError\('([a-z-]+)'/g)].map((m) => m[1]));

test('every failure the fetcher names has a headline', () => {
	assert.ok(thrown.size >= 10, `found ${thrown.size} codes — has RemoteError been renamed?`);
	for (const code of thrown) assert.ok(FAILURES[code], `no text for ${code}`);
});

test("iOS's https-only refusal has one too", () => {
	assert.match(FAILURES['insecure-url'], /https/);
	assert.match(FAILURES['insecure-url'], /browser/);
});

test('no headline states a size limit (100 MB on desktop, 50 on the iPad)', () => {
	for (const [code, text] of Object.entries(FAILURES)) assert.doesNotMatch(text, /\d\s*[KMG]B\b/, code);
});
