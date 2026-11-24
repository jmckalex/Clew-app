// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// `@begin(clew-only)` (src/engine/clew-only.js), Clew's own views only:
// through the real engine every way Clew runs it — the preview's (its
// watch-worker under a generated config naming the environment, as
// render-service.js writes one; the reading-view PDF prints that document, and
// preview.css hides the box from print), a site export's (the same config,
// CLEW_SITE_EXPORT) and a note export's (export-worker.mjs, which registers
// its own handler: EXPORT_ENVIRONMENTS) — the box in the first, nothing in the
// rest, HTML or LaTeX. The PDF itself is smoke/print-batch-scenario.js's
// (pdftotext).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import registered, { clewOnly, clewOnlyExport } from '../src/engine/clew-only.js';
import { EXPORT_ENVIRONMENTS } from '../src/engine/export-config.js';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-only-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');
const MODULE = path.join(repo, 'src', 'engine', 'clew-only.js');

test('the handlers: a box in Clew\'s views, nothing in a site export or an export, nothing in LaTeX', () => {
	assert.deepEqual(registered, { 'clew-only': clewOnly }, 'the config entry registers it by its hyphenated name');
	assert.equal(clewOnly.mode, 'markdown');
	assert.equal(clewOnly.html({ inner: '<p>x</p>' }), '<div class="clew-only"><p>x</p></div>');
	assert.equal(clewOnly.html({ inner: 'x', inline: true }), '<span class="clew-only">x</span>');
	assert.equal(clewOnly.latex({ inner: 'x' }), '');
	const was = process.env.CLEW_SITE_EXPORT;
	process.env.CLEW_SITE_EXPORT = '1';
	try { assert.equal(clewOnly.html({ inner: 'x' }), '', 'a site export'); } finally {
		if (was === undefined) delete process.env.CLEW_SITE_EXPORT; else process.env.CLEW_SITE_EXPORT = was;
	}
	assert.equal(clewOnlyExport.mode, 'markdown');
	assert.equal(clewOnlyExport.html({ inner: 'x' }), '');
	assert.equal(clewOnlyExport.latex({ inner: 'x' }), '');
});

test('every export registers its own handler, the preview loads the file, and print hides its box', () => {
	assert.deepEqual(Object.keys(EXPORT_ENVIRONMENTS), ['clew-only']);
	assert.equal(EXPORT_ENVIRONMENTS['clew-only'], clewOnlyExport);
	const service = fs.readFileSync(path.join(repo, 'src', 'main', 'render-service.js'), 'utf8');
	assert.match(service, /^\t+path\.join\(engineAssets, 'clew-only\.js'\),$/m);
	const css = fs.readFileSync(path.join(repo, 'src', 'engine', 'preview.css'), 'utf8');
	const print = css.slice(css.indexOf('@media print {'));
	assert.match(print.slice(0, print.indexOf('\n}')), /\.clew-only \{ display: none !important; \}/);
});

const NOTE = [
	'# Essay',
	'',
	'@begin(clew-only)',
	'Marking controls: *SCREEN-BLOCK*',
	'',
	'<button>SCREEN-BUTTON</button>',
	'@end(clew-only)',
	'',
	'The essay text, KEPT-ONE.',
	'',
	'A grade @clew-only[SCREEN-INLINE] in a sentence, KEPT-TWO.',
	'',
	'@clew-only+[SCREEN-PLUS]',
	'',
	'End, KEPT-THREE.',
	'',
].join('\n');
const SCREEN = ['SCREEN-BLOCK', 'SCREEN-BUTTON', 'SCREEN-INLINE', 'SCREEN-PLUS'];
const KEPT = ['KEPT-ONE', 'KEPT-TWO', 'KEPT-THREE'];

/** `note` built by `workerPath` in a folder of its own (an empty HOME, so no
 *  user config), the build message `build`; the output's text. */
function build(workerPath, { name, note, config = null, to = 'html', args = [], env = {} }) {
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
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0', ...env },
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
const config = { 'Header style': 'fenced', 'Environments': [MODULE] };
const preview = (name, note) => build(watchWorker, { name, note, config });
const site = (name, note) => build(watchWorker, { name, note, config, env: { CLEW_SITE_EXPORT: '1' } });
const exported = (name, note, to) => build(path.join(repo, 'src', 'engine', 'export-worker.mjs'), { name, note, to, args: [watchWorker] });
const body = (html) => html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

/** The text inside each `.clew-only` box, in order. */
const boxes = (html) => [...html.matchAll(/<(div|span)[^>]* class="clew-only">([\s\S]*?)<\/\1>/g)].map((m) => m[2].trim());

test('the preview\'s engine (reading view, live edit\'s blocks, the reading-view PDF): drawn, each form in its box', async () => {
	const html = body(await preview('preview', NOTE));
	for (const s of [...SCREEN, ...KEPT]) assert.ok(html.includes(s), `preview: "${s}" is drawn`);
	const inside = boxes(html);
	assert.equal(inside.length, 3, 'the block, the inline and the + form');
	assert.match(inside[0], /<strong[^>]*>SCREEN-BLOCK<\/strong>/, 'its body is markdown');
	assert.match(inside[0], /<button>SCREEN-BUTTON<\/button>/, 'its HTML kept');
	assert.equal(inside[1], 'SCREEN-INLINE');
	assert.equal(inside[2], 'SCREEN-PLUS');
	for (const s of KEPT) assert.ok(!inside.join('').includes(s), `"${s}" is outside every box`);
	assert.match(html, /<p[^>]*>A grade <span class="clew-only">SCREEN-INLINE<\/span> in a sentence, KEPT-TWO\.<\/p>/, 'the inline form stays in its sentence');
});

/** Nothing of the block, the sentences around the inline forms whole. */
function assertLeftOut(text, where) {
	for (const s of SCREEN) assert.ok(!text.includes(s), `${where}: "${s}" left out`);
	for (const s of KEPT) assert.ok(text.includes(s), `${where}: "${s}" kept`);
	assert.ok(!text.includes('clew-only'), `${where}: no box`);
	assert.match(text, /A grade\s+in a sentence, KEPT-TWO\./, `${where}: the sentence around the inline form`);
}

test('a site export (the preview\'s configuration, CLEW_SITE_EXPORT): left out', async () => {
	assertLeftOut(body(await site('site', NOTE)), 'site export');
});

test('a note export: left out of HTML and LaTeX', async () => {
	assertLeftOut(body(await exported('export-html', NOTE, 'html')), 'HTML export');
	const tex = await exported('export-latex', NOTE, 'latex');
	const doc = tex.slice(tex.indexOf('\\begin{document}'));
	assertLeftOut(doc, 'LaTeX export');
	assert.match(doc, /\\section\*?\{Essay\}[\s\S]*?\n\nThe essay text, KEPT-ONE\./, 'the paragraph after the block starts a paragraph of its own');
});
