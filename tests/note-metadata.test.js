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
import { extractNoteMetadata, parseFrontmatter } from '../src/shared/note-metadata.js';

test('extracts headings with levels and lines', () => {
	const meta = extractNoteMetadata('# One\n\ntext\n\n## Two ##\n');
	assert.deepEqual(meta.headings, [
		{ level: 1, text: 'One', line: 1 },
		{ level: 2, text: 'Two', line: 5 },
	]);
});

test('extracts wikilinks with alias, heading, and embed flags', () => {
	const meta = extractNoteMetadata(
		'A [[Note]] and [[Other|alias]] and [[Third#Head]] here.\n![[Embedded]]\n');
	assert.deepEqual(meta.links.map((l) => [l.target, l.heading, l.alias, l.embed, l.line]), [
		['Note', null, null, false, 1],
		['Other', null, 'alias', false, 1],
		['Third', 'Head', null, false, 1],
		['Embedded', null, null, true, 2],
	]);
});

test('ignores links and tags inside code fences and inline code', () => {
	const meta = extractNoteMetadata(
		'Real [[Link]] #realtag\n\n```\n[[NotALink]] #nottag\n```\n\nAnd `[[also not]] #no` here.\n');
	assert.deepEqual(meta.links.map((l) => l.target), ['Link']);
	assert.deepEqual(meta.tags.map((t) => t.tag), ['realtag']);
});

test('ignores links inside math', () => {
	const meta = extractNoteMetadata('Math $[[x]]$ and $$\n[[y]]\n$$ but [[Real]].\n');
	assert.deepEqual(meta.links.map((l) => l.target), ['Real']);
});

test('extracts nested tags; skips pure-number refs and heading marks', () => {
	const meta = extractNoteMetadata('# Heading\n\nWork on #project/clew and #a_b-c, see #123.\n');
	assert.deepEqual(meta.tags.map((t) => t.tag).sort(), ['a_b-c', 'project/clew']);
});

test('parses frontmatter tags and aliases in both list styles', () => {
	const text = '---\ntags: [alpha, beta]\naliases:\n  - First Alias\n  - second\n---\n# Body\n';
	const fm = parseFrontmatter(text);
	assert.deepEqual(fm.tags, ['alpha', 'beta']);
	assert.deepEqual(fm.aliases, ['First Alias', 'second']);
	const meta = extractNoteMetadata(text);
	assert.deepEqual(meta.aliases, ['First Alias', 'second']);
	assert.ok(meta.tags.some((t) => t.tag === 'alpha'));
	assert.deepEqual(meta.headings, [{ level: 1, text: 'Body', line: 7 }]);
});

test('frontmatter keys are not parsed as tags or headings', () => {
	const meta = extractNoteMetadata('---\ntitle: X\ntags: [t]\n---\ntext #real\n');
	assert.ok(meta.tags.some((t) => t.tag === 'real'));
	assert.ok(meta.tags.some((t) => t.tag === 't'));
	assert.equal(meta.headings.length, 0);
});
