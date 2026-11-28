// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What `{{name}}` stands for in live edit (src/renderer/editor/live/
// header-vars.js), held to the REAL engine: one note whose header has every
// awkward shape, built by the preview's watch-worker, each `{{name}}` between
// markers, and the engine's text for each must be the mirror's — or, where the
// engine printed `{{name}}` as written, the mirror must have no value.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { Text } from '@codemirror/state';
import { headerVariables, headerSlice } from '../src/renderer/editor/live/header-vars.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-header-vars-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');

/** `note` built to HTML by the engine, as the preview builds it (a fenced header). */
function engineHtml(note) {
	fs.mkdirSync(path.join(root, 'home'), { recursive: true });
	fs.mkdirSync(path.join(root, '.jmarkdown'), { recursive: true });
	fs.writeFileSync(path.join(root, '.jmarkdown', 'config.json'), JSON.stringify({ 'Header style': 'fenced' }));
	fs.writeFileSync(path.join(root, 'Note.md'), note);
	const worker = fork(watchWorker, [], { cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, HOME: path.join(root, 'home') } });
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file: 'Note.md', options: { to: 'html', output: 'Note.html' } });
			else if (msg?.type === 'done') { worker.kill(); resolve(fs.readFileSync(path.join(root, 'Note.html'), 'utf8')); }
			else if (msg?.type === 'error') { worker.kill(); reject(new Error(msg.message)); }
		});
		worker.on('error', reject);
	});
}

const HEADER = `---
title: Hello world
quoted: "Hi there"
multi: first part
  second part
again: one
again: two
my_var: under
after: plain
tags:
  - alpha
  - beta
html: <b>bold</b> text
blank:
My Key: spaced key
with-dash: dashed
time: 10:30 sharp
trailing: ends in spaces
---
`;
const NAMES = ['title', ' title ', 'Title', 'quoted', 'multi', 'again', 'my_var', 'after', 'tags', 'html',
	'blank', 'My Key', 'with-dash', 'time', 'trailing', 'missing'];
const squash = (s) => s.replace(/\s+/g, ' ').trim();

test('every name substitutes as the engine substitutes it, or not at all where it does not', async () => {
	const body = NAMES.map((n, i) => `S${i}«{{${n}}}»E${i}`).join('\n\n');
	const html = await engineHtml(`${HEADER}${body}\n`);
	const vars = headerVariables(HEADER + body);
	for (const [i, name] of NAMES.entries()) {
		const m = new RegExp(`S${i}«([\\s\\S]*?)»E${i}`).exec(html);
		assert.ok(m, `${name}: found in the engine's HTML`);
		const engine = m[1];
		if (engine === `{{${name}}}`) assert.equal(vars.has(name), false, `${JSON.stringify(name)}: the engine left it, the mirror has no value`);
		else assert.equal(squash(vars.get(name) ?? '<none>'), squash(engine), `${JSON.stringify(name)}: the engine's text`);
	}
	// The cases this note is for, said outright.
	assert.equal(vars.get('quoted'), '"Hi there"', 'quotes kept');
	assert.equal(vars.get('multi'), 'first part\n  second part', 'a continuation line as written');
	assert.equal(vars.get('again'), 'onetwo\nmy_var: under', 'a key twice runs together; an underscore is no key');
	assert.equal(vars.has('my_var'), false);
	assert.equal(vars.get('tags'), '  - alpha\n  - beta');
	assert.equal(vars.get('blank'), '');
	assert.equal(vars.get('time'), '10:30 sharp');
	assert.equal(vars.has(' title ') || vars.has('Title'), false, 'the name exactly as written');
});

test('no header, or one the engine would not read: nothing', () => {
	assert.deepEqual([...headerVariables('# Just a note\n\n{{title}}\n')], []);
	assert.deepEqual([...headerVariables('\n---\ntitle: X\n---\n')], [], 'not on the first line');
	assert.deepEqual([...headerVariables('---\n# Heading, not a key\n---\n')], [], 'no key line first');
	assert.deepEqual([...headerVariables('---\n')], []);
	// Measured through the engine (Clew's fenced header), 2026-11-28: a
	// bare-key header is not read, nor one whose first line is not a key.
	assert.deepEqual([...headerVariables('title: Bare\n---\n{{title}}\n')], [], 'no `---` first line');
	assert.deepEqual([...headerVariables('---\n# not a key\ntitle: Later\n---\n')], [], 'a key line, but not the first');
});

test('the header\'s first line never closes it: `--- x: 1` there is a key (the engine\'s `\\n^---`; measured, it prints 1)', () => {
	assert.equal(headerVariables('---\n--- x: 1\n---\n').get('--- x'), '1');
	assert.equal(headerSlice(Text.of(['---', '--- x: 1', '---', 'body'])), '---\n--- x: 1\n---');
});

test('the opener may carry spaces or tabs after its dashes, as the engine\'s `^---[ \\t]*\\r?\\n` allows', () => {
	// Clew-boss's surviving mutant on 6af8a0d: `/^---\\n/` passed every test.
	assert.equal(headerVariables('--- \ntitle: X\n---\n').get('title'), 'X');
	assert.equal(headerVariables('---\t \ntitle: Y\n---\n').get('title'), 'Y');
	assert.equal(headerVariables('---\r\ntitle: Z\n---\n').get('title'), 'Z', 'a CRLF opener');
});

test('a header nothing closes is the whole note, as the engine reads it', () => {
	const vars = headerVariables('---\ntitle: X\nmore text\n\nlast');
	assert.equal(vars.get('title'), 'X\nmore text\nlast');
});

test('own keys only: the engine\'s `in` finds Object\'s, the mirror does not', () => {
	const vars = headerVariables('---\ntitle: X\n---\n');
	assert.equal(vars.has('constructor'), false);
	assert.equal(vars.has('toString'), false);
});

test('headerSlice: up to the closing line (the third line on), the whole note, or nothing', () => {
	const doc = (s) => Text.of(s.split('\n'));
	assert.equal(headerSlice(doc('---\ntitle: X\n---\nbody {{title}}\n')), '---\ntitle: X\n---');
	assert.equal(headerSlice(doc('---\ntitle: X\nmore\n')), '---\ntitle: X\nmore\n');
	assert.equal(headerSlice(doc('# Note\n---\n')), '');
	assert.equal(headerSlice(doc('---')), '');
	assert.equal(headerSlice(doc('--- \ntitle: X\n----\n')), '--- \ntitle: X\n----', 'spaces after the opener; a longer closer');
});
