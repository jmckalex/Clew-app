// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What the Insert commands WRITE: the engine's `@` forms, never a colon
// directive (jmarkdown is retiring `:::name`, `::name[…]` and `:name[…]` — the
// owner's decision, 2026-10-10). shared/format-spec.js#BLOCK_INSERTS is the
// table; commands/format.js reads it (it imports CodeMirror, so it is held
// here by its text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORMAT_MENU, BLOCK_INSERTS, TODAY_INSERT, environmentBlock } from '../src/shared/format-spec.js';

const COLON = /(^|[\s(])::?:?[A-Za-z][\w-]*|^:{3,}/m;
// Its code, comments left out (they may say what it used to write).
const formatJs = readFileSync(new URL('../src/renderer/commands/format.js', import.meta.url), 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('every block Insert is @begin(name) … @end(name), the generic container @begin(<name>) … @end(name)', () => {
	for (const [id, { header, footer, body }] of Object.entries(BLOCK_INSERTS)) {
		const m = /^@begin\((<?)([\w-]+)(>?)\)(\{[^}]*\})?$/.exec(header);
		assert.ok(m, `${id}: ${header}`);
		assert.equal(m[1] === '<', m[3] === '>', `${id}: the sigil is whole`);
		assert.equal(footer, `@end(${m[2]})`, `${id}: the closer names the bare name`);
		assert.equal(COLON.test(`${header}\n${body}\n${footer}`), false, `${id} writes no colon form`);
	}
	assert.deepEqual(BLOCK_INSERTS['format:container'], { header: '@begin(<name>)', footer: '@end(name)', body: 'Content' });
	assert.deepEqual(environmentBlock('theorem'), { header: '@begin(theorem)', footer: '@end(theorem)' });
	assert.equal(BLOCK_INSERTS['format:mathematica'].header, '@begin(Mathematica){output="svg"}');
	assert.equal(TODAY_INSERT, '@today');
});

test('the Block group\'s environments are the table\'s, and no menu label shows a colon form', () => {
	const block = FORMAT_MENU.find((g) => g.label === 'Block').items.filter((i) => i.id).map((i) => i.id);
	assert.deepEqual(block.filter((id) => !['format:code-fence', 'format:math-block'].includes(id)).sort(), Object.keys(BLOCK_INSERTS).sort());
	for (const item of FORMAT_MENU.flatMap((g) => g.items).filter((i) => i.label)) {
		assert.equal(COLON.test(item.label.replace(/^[^—]*—\s*/, '')), false, item.label);
	}
});

test('commands/format.js writes no colon directive and runs every table entry', () => {
	assert.equal(/['"`]:{1,3}[A-Za-z]|['"`]:::['"`]/.test(formatJs), false, 'a colon form in a string');
	for (const id of Object.keys(BLOCK_INSERTS)) assert.ok(formatJs.includes(`insertEnvironment(v, '${id}')`), id);
	assert.ok(formatJs.includes('insertInline(v, TODAY_INSERT'), 'Today\'s Date');
});
