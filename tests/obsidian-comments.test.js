// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Obsidian's `%%` comments (src/engine/obsidian-comments.js): the two rules on
// their own, then through the real engine both ways Clew runs it — the
// preview's (its watch-worker under a generated config naming the rules, as
// render-service.js writes one; the site export shares it) and an export's
// (export-worker.mjs, which registers them itself: EXPORT_EXTENSIONS), HTML
// and LaTeX. Hidden whole, never inside code or maths, an unclosed `%%` text.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { obsidianComment, obsidianInlineComment } from '../src/engine/obsidian-comments.js';
import { EXPORT_EXTENSIONS } from '../src/engine/export-config.js';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-obsidian-comments-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');
const MODULE = path.join(repo, 'src', 'engine', 'obsidian-comments.js');

const block = (src) => obsidianComment.tokenizer(src)?.raw ?? null;
const inline = (src) => obsidianInlineComment.tokenizer(src)?.raw ?? null;

test('a block runs from its `%%` to the next, which must end its line', () => {
	assert.equal(block('%% kanban:settings\n```\n{"a":1}\n```\n%%\nafter'), '%% kanban:settings\n```\n{"a":1}\n```\n%%\n');
	assert.equal(block('%%hidden%%\nnext'), '%%hidden%%\n');
	assert.equal(block('   %%\nindented\n%%'), '   %%\nindented\n%%');
	assert.equal(block('%%a%% visible\n'), null, 'text after a closer on the opener\'s line: a paragraph, whose comment is inline');
	assert.equal(block('%%\nhidden\n\nstill hidden\n%% visible\n'), '%%\nhidden\n\nstill hidden\n%%', 'on a later line: the comment ends at it, the text is prose');
	assert.equal(block('%%\nnever closed\n'), null, 'unclosed: text');
	assert.equal(block('    %%\nindented code\n%%\n'), null, 'four spaces is indented code');
});

test('a block\'s start is only where the block rule takes it, so no paragraph is cut for nothing', () => {
	assert.equal(obsidianComment.start('para\n%%\nx\n%%\n'), 5);
	assert.equal(obsidianComment.start('para\n%%a%% more\n'), undefined);
	assert.equal(obsidianComment.start('para\n%%\nunclosed\n'), undefined);
});

test('inline: `%%…%%`, the closer never looked for inside code or maths', () => {
	assert.equal(inline('%%x%% rest'), '%%x%%');
	assert.equal(obsidianInlineComment.start('a %%x%% b'), 2);
	assert.equal(inline('%% a `b %% c` d %% e'), '%% a `b %% c` d %%', 'a code span');
	assert.equal(inline('%% a ``b `%%` c`` d %%'), '%% a ``b `%%` c`` d %%', 'a longer code span');
	assert.equal(inline('%% a $x %% y$ b %%'), '%% a $x %% y$ b %%', '$…$');
	assert.equal(inline('%% a \\(x %% y\\) %%'), '%% a \\(x %% y\\) %%', '\\(…\\)');
	assert.equal(block('%%\n```\nx %% y\n```\n%%\n'), '%%\n```\nx %% y\n```\n%%\n', 'a fence');
	assert.equal(block('%%\n$$\na %% b\n$$\n%%\n'), '%%\n$$\na %% b\n$$\n%%\n', '$$…$$');
	assert.equal(block('%%\n\\begin{align}\na %% b\n\\end{align}\n%%\n'), '%%\n\\begin{align}\na %% b\n\\end{align}\n%%\n', 'an environment');
	assert.equal(inline('%% a b'), null, 'unclosed: text');
	assert.equal(obsidianInlineComment.start('a \\%%x%% b'), undefined, 'an escaped `%`');
});

test('every export registers the rules the preview loads', () => {
	assert.deepEqual(EXPORT_EXTENSIONS.map((e) => e.name), ['obsidianComment', 'obsidianInlineComment']);
	const service = fs.readFileSync(path.join(repo, 'src', 'main', 'render-service.js'), 'utf8');
	assert.match(service, /`obsidianComment, obsidianInlineComment from \$\{path\.join\(engineAssets, 'obsidian-comments\.js'\)\}`/);
});

const NOTE = [
	'# Comments',
	'',
	'Before %%INLINE-SECRET%% after.',
	'',
	'%% kanban:settings',
	'```',
	'{"BLOCK-SECRET":"basic"}',
	'```',
	'%%',
	'',
	'%%',
	'MULTI-LINE-SECRET',
	'and more',
	'%%',
	'',
	'%%',
	'TRAIL-SECRET',
	'',
	'over a blank line',
	'%% TRAIL-VISIBLE stays.',
	'',
	'Code `x %%CODE-KEPT%% y` and maths $a %% b$ stay.',
	'',
	'```',
	'%% FENCE-KEPT',
	'%%',
	'```',
	'',
	'$$',
	'c %% DISPLAY-KEPT',
	'$$',
	'',
	'A stray %% UNCLOSED-KEPT stays.',
	'',
	'End.',
	'',
].join('\n');
const HIDDEN = ['INLINE-SECRET', 'BLOCK-SECRET', 'MULTI-LINE-SECRET', 'and more', 'kanban:settings', 'TRAIL-SECRET', 'over a blank line'];
const KEPT = ['CODE-KEPT', 'FENCE-KEPT', 'DISPLAY-KEPT', 'UNCLOSED-KEPT', 'TRAIL-VISIBLE stays.', 'Before', 'after.', 'End.'];

/** `note` built by `workerPath` in a folder of its own (an empty HOME, so no
 *  user config), the build message `build`; the output's text. */
function build(workerPath, { name, note, config = null, to = 'html', args = [] }) {
	const dir = path.join(root, name);
	const home = path.join(dir, 'home');
	fs.mkdirSync(home, { recursive: true });
	if (config) {
		fs.mkdirSync(path.join(dir, '.jmarkdown'), { recursive: true });
		fs.writeFileSync(path.join(dir, '.jmarkdown', 'config.json'), JSON.stringify(config));
	}
	fs.writeFileSync(path.join(dir, 'Note.md'), note);
	const output = to === 'html' ? 'Note.html' : 'Note.tex';
	const worker = fork(workerPath, args, {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file: 'Note.md', options: { to, output } });
			else if (msg?.type === 'done') { worker.kill(); resolve(fs.readFileSync(path.join(dir, output), 'utf8')); }
			else if (msg?.type === 'error') { worker.kill(); reject(new Error(msg.message)); }
		});
		worker.on('error', reject);
	});
}
const preview = (name, note) => build(watchWorker, { name, note, config: { 'Header style': 'fenced', 'Extensions': [`obsidianComment, obsidianInlineComment from ${MODULE}`] } });
const exported = (name, note, to) => build(path.join(repo, 'src', 'engine', 'export-worker.mjs'), { name, note, to, args: [watchWorker] });
const body = (html) => html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

function assertHiddenAndKept(text, where) {
	for (const s of HIDDEN) assert.ok(!text.includes(s), `${where}: "${s}" is hidden`);
	for (const s of KEPT) assert.ok(text.includes(s), `${where}: "${s}" is kept`);
}

test('the preview\'s engine (reading view, the reading-view PDF, a site export): hidden, code and maths kept', async () => {
	const html = body(await preview('preview', NOTE));
	assertHiddenAndKept(html, 'preview');
	assert.ok(!/<p[^>]*>\s*<\/p>/.test(html), 'no empty paragraph where a block was');
});

test('an export, HTML and LaTeX: hidden, code and maths kept', async () => {
	assertHiddenAndKept(body(await exported('export-html', NOTE, 'html')), 'HTML export');
	const tex = await exported('export-latex', NOTE, 'latex');
	assertHiddenAndKept(tex.slice(tex.indexOf('\\begin{document}')), 'LaTeX export');
});

test('a note with a header: a block hidden whole; inline, jmarkdown\'s own `%` comment is asked first', async () => {
	const note = '---\nTitle: Headed\n---\nBefore %%INLINE-SECRET%% after.\n\n%%\nMULTI-LINE-SECRET\n%%\n\nEnd.\n';
	for (const html of [body(await preview('headed-preview', note)), body(await exported('headed-export', note, 'html'))]) {
		assert.ok(!html.includes('MULTI-LINE-SECRET'));
		assert.ok(!html.includes('INLINE-SECRET'));
		assert.ok(html.includes('Before') && html.includes('End.'));
	}
});
