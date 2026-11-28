// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Book-style paragraphs in live edit (src/renderer/editor/live/
// paragraph-indents.js) held to READING VIEW: one note with every kind of
// neighbour a paragraph can have is built by the real watch-worker, and
// preview.css's rule is applied to the engine's HTML — a <p> is indented when
// the element before it is a <p> (not a display alone) or a <blockquote>, and
// it is not a display alone itself. Every paragraph the engine stamps with its
// source line must be indented in live edit exactly when it is in reading view.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { noteMarkdown } from '../src/renderer/editor/jmd/markdown-config.js';
import { paragraphIndents } from '../src/renderer/editor/live/paragraph-indents.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-paragraph-indents-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');
// The engine's own cheerio (its lockfile's, installed by engine-deps).
const cheerio = createRequire(watchWorker)('cheerio');

function engineHtml(note) {
	fs.mkdirSync(path.join(root, 'home'), { recursive: true });
	fs.mkdirSync(path.join(root, '.jmarkdown'), { recursive: true });
	fs.writeFileSync(path.join(root, '.jmarkdown', 'config.json'), JSON.stringify({ 'Header style': 'fenced', 'Joined quotes': true }));
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

const NOTE = `# Heading

First after the heading.

Second, after the first.

> A quote's first paragraph.
>
> Its second paragraph.

After the quote.

- an item
- another item

After the list.

Before a display:
$$
x^2
$$
and the sentence goes on.

After the paragraph that held the display.

$$
y^2
$$

After a display on its own.

A paragraph ending in a display:
$$
z^2
$$

After the paragraph that ended in a display.

@begin(theorem)
A theorem.
@end(theorem)

After the environment.

> [!note] A callout
> Its body.

After the callout.

> [!tip] A callout whose body follows a blank quote line
>
> Its body, set apart.

After the second callout.

| a | b |
|---|---|
| 1 | 2 |

After the table.

Before a quote inside the paragraph:
> a quoted line,
and the paragraph goes on.

A new paragraph after the joined quote.

> A quote joined only below,
and its paragraph goes on.

Before a callout inside the paragraph:
> [!note] Joined
> its body
and the paragraph goes on after the callout.

A new paragraph after the joined callout.

Before a callout ended by an indented marker:
> [!tip] Joined again
> its body
    > four spaces in: no longer the callout's

A new paragraph after that one.

Last.
`;

/** Reading view's rule over the engine's HTML: line → indented, for every stamped <p>. */
function readingIndents(html) {
	const $ = cheerio.load(html);
	const displayOnly = (el) => el && el.tagName === 'p' && /^\s*(\$\$[\s\S]*\$\$|\\\[[\s\S]*\\\])\s*$/.test($(el).text());
	const out = new Map();
	$('p[data-source-line]').each((_, el) => {
		const prev = $(el).prev()[0];
		// preview.css: a joined quote's continuation is never indented.
		const indented = !displayOnly(el) && !$(el).hasClass('jmd-continued') && Boolean(prev)
			&& ((prev.tagName === 'p' && !displayOnly(prev)) || prev.tagName === 'blockquote');
		out.set(Number($(el).attr('data-source-line')), indented);
	});
	return out;
}

test('live edit indents exactly the paragraphs reading view indents', async () => {
	const html = await engineHtml(NOTE);
	const reading = readingIndents(html);
	const state = EditorState.create({ doc: NOTE, extensions: [noteMarkdown({})] });
	ensureSyntaxTree(state, NOTE.length, 5000);
	const live = new Set(paragraphIndents(state, [{ from: 0, to: NOTE.length }]).map((pos) => state.doc.lineAt(pos).number));
	assert.ok(reading.size >= 12, `the engine stamped ${reading.size} paragraphs`);
	const wrong = [...reading].filter(([line, indented]) => live.has(line) !== indented)
		.map(([line, indented]) => `${line} ${JSON.stringify(state.doc.line(line).text)}: reading ${indented}, live ${live.has(line)}`);
	assert.deepEqual(wrong, []);
	// And the cases this note is for, said outright (line text → indented).
	const at = (text) => live.has(NOTE.split('\n').indexOf(text) + 1);
	assert.equal(at('Second, after the first.'), true);
	assert.equal(at('After the quote.'), true);
	assert.equal(at('First after the heading.'), false);
	assert.equal(at('After the list.'), false);
	assert.equal(at('After the paragraph that held the display.'), true);
	assert.equal(at('After a display on its own.'), false);
	assert.equal(at('After the paragraph that ended in a display.'), false);
	assert.equal(at('After the environment.'), false);
	assert.equal(at('After the callout.'), false);
	assert.equal(at('After the table.'), false);
	assert.equal(at('and the paragraph goes on.'), false, 'a continuation is never indented');
	assert.equal(at('A new paragraph after the joined quote.'), true);
	assert.equal(at('A new paragraph after the joined callout.'), true, "after a callout's continuation, as after a paragraph");
	assert.equal(at('A new paragraph after that one.'), true, 'a `>` four spaces in leaves the callout, as the engine reads it');
	// The engine really joined them (jmarkdown 8ce758d).
	assert.ok(/class="jmd-continued"|jmd-continued/.test(html), 'the engine marked a continuation');
	// Where the engine stamps no line (a display's own <p>, a callout's
	// body), reading view's rule said outright: neither is indented.
	const lines = NOTE.split('\n');
	const display = lines.indexOf('y^2');     // 0-based: the `$$` above it is line `display` 1-based
	assert.equal(lines[display - 1], '$$');
	assert.equal(live.has(display), false, 'a display alone is not indented itself');
	assert.equal(at('> Its body, set apart.'), false, "a callout's body is not indented after its head");
	assert.equal(at('After the second callout.'), false);
});

test('only within the ranges asked for; each line once', () => {
	const doc = 'One.\n\nTwo.\n\nThree.\n';
	const state = EditorState.create({ doc, extensions: [noteMarkdown({})] });
	ensureSyntaxTree(state, doc.length, 5000);
	assert.deepEqual(paragraphIndents(state, [{ from: 0, to: doc.length }]), [6, 12]);
	assert.deepEqual(paragraphIndents(state, [{ from: 0, to: 4 }]), []);
	assert.deepEqual(paragraphIndents(state, [{ from: 6, to: 9 }, { from: 6, to: 9 }]), [6]);
});
