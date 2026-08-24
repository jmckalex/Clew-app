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
import {
	parseProperties, serializeProperties, applyProperties, propertyType,
} from '../src/shared/frontmatter.js';

test('no frontmatter', () => {
	const r = parseProperties('# Hello\n');
	assert.equal(r.present, false);
	assert.equal(r.end, 0);
	assert.deepEqual(r.entries, []);
});

test('scalar types', () => {
	const text = '---\ntitle: My Note\ncount: 42\nrating: 4.5\ndone: true\nempty:\n---\nbody\n';
	const r = parseProperties(text);
	assert.equal(r.present, true);
	assert.equal(r.clean, true);
	assert.deepEqual(r.entries, [
		{ key: 'title', value: 'My Note' },
		{ key: 'count', value: 42 },
		{ key: 'rating', value: 4.5 },
		{ key: 'done', value: true },
		{ key: 'empty', value: null },
	]);
	assert.equal(text.slice(r.end), 'body\n');
});

test('quoted strings keep their type', () => {
	const r = parseProperties('---\nversion: "1.0"\nname: \'x\'\n---\n');
	assert.deepEqual(r.entries, [
		{ key: 'version', value: '1.0' },
		{ key: 'name', value: 'x' },
	]);
});

test('inline and block lists', () => {
	const text = '---\ntags: [a, b]\naliases:\n  - One\n  - "Two"\nempty: []\n---\n';
	const r = parseProperties(text);
	assert.deepEqual(r.entries, [
		{ key: 'tags', value: ['a', 'b'] },
		{ key: 'aliases', value: ['One', 'Two'] },
		{ key: 'empty', value: [] },
	]);
});

test('unsupported constructs mark the block dirty', () => {
	for (const body of ['nested:\n  inner: 1', 'weird: {a: 1}', '# a comment', 'multi: |\n  text']) {
		const r = parseProperties(`---\n${body}\n---\n`);
		assert.equal(r.clean, false, body);
	}
});

test('serialize round-trips', () => {
	const entries = [
		{ key: 'title', value: 'Notes: a study' },
		{ key: 'count', value: 3 },
		{ key: 'done', value: false },
		{ key: 'tags', value: ['x', 'y z'] },
		{ key: 'blank', value: null },
	];
	const text = serializeProperties(entries) + 'body\n';
	const r = parseProperties(text);
	assert.equal(r.clean, true);
	assert.deepEqual(r.entries, entries);
});

test('strings that look like other types are quoted', () => {
	const entries = [{ key: 'v', value: '42' }, { key: 'b', value: 'true' }];
	const r = parseProperties(serializeProperties(entries) + '\n');
	assert.deepEqual(r.entries, entries); // still strings
});

test('applyProperties replaces, inserts, and removes', () => {
	const withFm = '---\na: 1\n---\nbody\n';
	assert.equal(applyProperties(withFm, [{ key: 'b', value: 2 }]), '---\nb: 2\n---\nbody\n');
	assert.equal(applyProperties('body\n', [{ key: 'a', value: 1 }]), '---\na: 1\n---\nbody\n');
	assert.equal(applyProperties(withFm, []), 'body\n');
});

test('propertyType inference', () => {
	assert.equal(propertyType([]), 'list');
	assert.equal(propertyType(true), 'checkbox');
	assert.equal(propertyType(1), 'number');
	assert.equal(propertyType('x'), 'text');
	assert.equal(propertyType(null), 'text');
});
