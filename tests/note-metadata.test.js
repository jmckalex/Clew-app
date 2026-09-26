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
import { extractNoteMetadata, parseFrontmatter, rewriteBlockText } from '../src/shared/note-metadata.js';

test('rewriteBlockText replaces the marker line, keeps the marker, skips fences', () => {
	const text = 'Intro.\n\nOld motto here. ^motto\n\n```\nfake ^motto\n```\nAfter.';
	const next = rewriteBlockText(text, 'motto', 'A better motto.');
	assert.match(next, /^A better motto\. \^motto$/m);
	assert.match(next, /fake \^motto/, 'the fenced lookalike is untouched');
	assert.equal(rewriteBlockText(text, 'absent', 'x'), null);
	// Multi-line input flattens: a marker names ONE block.
	assert.match(rewriteBlockText(text, 'motto', 'two\nlines'), /^two lines \^motto$/m);
});

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

test('labels: every source form, their hosts, and what is not a label', () => {
	const text = '---\nHeadings: numeric\n---\n# Doc\n\n## Setup @label[sec-setup]\n\n@begin(theorem)[Main]{#thm-main}\nText :label[inner]\n@end(theorem)\n\n@begin(equation){id=eq:a}\nx @label[nope]\n@end(equation)\n\n:::figure[Cap]{.wide #fig-1}\n![](x.png)\n:::\n\n@begin(table)[T]{#b title="x"}\n| a |\n@end(table)\n\nA loose @label[loose] and `@label[code]` and $@label[m]$.\n\nA note[fn: see @label[fnl]].\n\n```\n@label[fenced]\n```\n\nNot an email@label[x] either.\n';
	const labels = extractNoteMetadata(text).labels;
	const by = Object.fromEntries(labels.map((l) => [l.key, l]));
	assert.deepEqual(Object.keys(by), ['sec-setup', 'thm-main', 'inner', 'eq:a', 'fig-1', 'b', 'loose', 'fnl']);
	assert.deepEqual([by['sec-setup'].kind, by['sec-setup'].title], ['section', 'Setup']);
	assert.deepEqual([by['thm-main'].kind, by['thm-main'].title, by['thm-main'].host], ['theorem', 'Main', { from: 8, to: 10 }]);
	assert.deepEqual([by.inner.kind, by.inner.host], ['theorem', { from: 8, to: 10 }], 'the colon twin, hosted by its theorem');
	assert.equal(by['eq:a'].kind, 'equation');
	assert.deepEqual([by['fig-1'].kind, by['fig-1'].title], ['figure', 'Cap']);
	assert.equal(by.b.kind, 'table', '{#a title="x"}');
	assert.equal(by.loose.kind, 'plain');
	assert.equal(by.fnl.kind, 'footnote');
});

test('citations: the \\cite family, multi-key, pandoc forms flagged, and what is not one', () => {
	const text = 'A \\cite{alexander2023} and \\citep[p. 3][]{knuth84, lamport94} and \\fullcite*{x}.\n\n'
		+ 'Pandoc [see @smith2020, p. 4; @jones] and bare @doe2019. but me@example.com is mail.\n\n'
		+ '@begin(theorem)\nx\n@end(theorem) and @label[k] are directives.\n\n'
		+ '`\\cite{incode}` and $\\cite{inmath}$\n\n```\n\\cite{fenced}\n```\n';
	const cites = extractNoteMetadata(text).citations;
	const keys = cites.map((c) => `${c.key}${c.pandoc ? '*' : ''}`);
	assert.deepEqual(keys, ['alexander2023', 'knuth84', 'lamport94', 'x', 'smith2020*', 'jones*', 'doe2019*']);
	assert.equal(cites.find((c) => c.key === 'knuth84').command, 'citep');
	assert.equal(cites.find((c) => c.key === 'x').command, 'fullcite');
});
