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
import { renderCardHtml } from '../src/renderer/canvas/card-markdown.js';

test('escapes HTML everywhere', () => {
	const html = renderCardHtml('<script>alert(1)</script> & "quotes"');
	assert.ok(!html.includes('<script>'));
	assert.ok(html.includes('&lt;script&gt;'));
	assert.ok(html.includes('&amp;'));
});

test('jmarkdown inline forms', () => {
	const html = renderCardHtml('*strong* **intense** /italic/ ==mark== ~gone~ `code` $x^2$');
	assert.ok(html.includes('<strong>strong</strong>'));
	assert.ok(html.includes('<strong class="card-intense">intense</strong>'));
	assert.ok(html.includes('<em>italic</em>'));
	assert.ok(html.includes('<mark>mark</mark>'));
	assert.ok(html.includes('<del>gone</del>'));
	assert.ok(html.includes('<code>code</code>'));
	assert.ok(html.includes('<code class="card-math">x^2</code>'));
});

test('slashes in paths and URLs are not italicized', () => {
	const html = renderCardHtml('see a/b/c and http://x.y/z here');
	assert.ok(!html.includes('<em>'), html);
});

test('formatting does not reach into code spans', () => {
	const html = renderCardHtml('`*not strong*` and *yes*');
	assert.ok(html.includes('<code>*not strong*</code>'));
	assert.ok(html.includes('<strong>yes</strong>'));
});

test('wikilinks with alias and embeds', () => {
	const html = renderCardHtml('See [[Reading Mode]] and ![[Welcome|the hub]].');
	assert.ok(html.includes('data-href="Reading Mode">Reading Mode</a>'));
	assert.ok(html.includes('data-href="Welcome">the hub</a>'));
});

test('external links only for http(s)', () => {
	const html = renderCardHtml('[ok](https://a.b) [bad](file:///etc/passwd)');
	assert.ok(html.includes('data-url="https://a.b">ok</a>'));
	assert.ok(!html.includes('file:///etc/passwd"'));
});

test('blocks: headings, lists, tasks, quote, hr, fences, digits survive', () => {
	const html = renderCardHtml([
		'# Title', '- item', '3. third', '- [x] done', '- [ ] todo',
		'> quoted', '---', '```', '*raw* <tag>', '```', 'has 42 digits',
	].join('\n'));
	assert.ok(html.includes('card-h1">Title'));
	assert.ok(html.includes('card-bullet">•</span><span>item'));
	assert.ok(html.includes('card-bullet">3.</span><span>third'));
	assert.ok(html.includes('is-done'));
	assert.ok(html.includes('☐'));
	assert.ok(html.includes('card-quote">quoted'));
	assert.ok(html.includes('card-hr'));
	assert.ok(html.includes('*raw* &lt;tag&gt;'));
	assert.ok(html.includes('has 42 digits'));
});
