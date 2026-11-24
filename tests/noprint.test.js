// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// `@begin(noprint)` (src/engine/noprint.js), for the screen only: through the
// real engine both ways Clew runs it — the preview's (its watch-worker under a
// generated config naming the environment, as render-service.js writes one;
// the reading-view PDF prints that document, and preview.css hides the box
// from print) and an export's (export-worker.mjs, which registers it itself:
// EXPORT_ENVIRONMENTS) — HTML keeping it, LaTeX leaving it out. The PDF itself
// is smoke/print-batch-scenario.js's (pdftotext).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { noprint } from '../src/engine/noprint.js';
import { EXPORT_ENVIRONMENTS } from '../src/engine/export-config.js';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-noprint-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');
const MODULE = path.join(repo, 'src', 'engine', 'noprint.js');

test('the handler: a box for the screen in HTML, nothing in LaTeX', () => {
	assert.equal(noprint.mode, 'markdown');
	assert.equal(noprint.html({ inner: '<p>x</p>' }), '<div class="clew-noprint"><p>x</p></div>');
	assert.equal(noprint.html({ inner: 'x', inline: true }), '<span class="clew-noprint">x</span>');
	assert.equal(noprint.latex({ inner: 'x' }), '');
});

test('every export registers the environment the preview loads, and print hides its box', () => {
	assert.deepEqual(Object.keys(EXPORT_ENVIRONMENTS), ['noprint']);
	assert.equal(EXPORT_ENVIRONMENTS.noprint, noprint);
	const service = fs.readFileSync(path.join(repo, 'src', 'main', 'render-service.js'), 'utf8');
	assert.match(service, /`noprint from \$\{path\.join\(engineAssets, 'noprint\.js'\)\}`/);
	const css = fs.readFileSync(path.join(repo, 'src', 'engine', 'preview.css'), 'utf8');
	const print = css.slice(css.indexOf('@media print {'));
	assert.match(print.slice(0, print.indexOf('\n}')), /\.clew-noprint \{ display: none !important; \}/);
});

const NOTE = [
	'# Essay',
	'',
	'@begin(noprint)',
	'Marking controls: *SCREEN-BLOCK*',
	'',
	'<button>SCREEN-BUTTON</button>',
	'@end(noprint)',
	'',
	'The essay text, KEPT-ONE.',
	'',
	'A grade @noprint[SCREEN-INLINE] in a sentence, KEPT-TWO.',
	'',
	'@noprint+[SCREEN-PLUS]',
	'',
	'End, KEPT-THREE.',
	'',
].join('\n');
const SCREEN = ['SCREEN-BLOCK', 'SCREEN-BUTTON', 'SCREEN-INLINE', 'SCREEN-PLUS'];
const KEPT = ['KEPT-ONE', 'KEPT-TWO', 'KEPT-THREE'];

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
const preview = (name, note) => build(watchWorker, { name, note, config: { 'Header style': 'fenced', 'Environments': [`noprint from ${MODULE}`] } });
const exported = (name, note, to) => build(path.join(repo, 'src', 'engine', 'export-worker.mjs'), { name, note, to, args: [watchWorker] });
const body = (html) => html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));

/** The text inside each `.clew-noprint` box, in order. */
const boxes = (html) => [...html.matchAll(/<(div|span)[^>]* class="clew-noprint">([\s\S]*?)<\/\1>/g)].map((m) => m[2].trim());

test('the preview\'s engine (reading view, the reading-view PDF, a site export): drawn, each form in its box', async () => {
	const html = body(await preview('preview', NOTE));
	for (const s of [...SCREEN, ...KEPT]) assert.ok(html.includes(s), `preview: "${s}" is drawn`);
	const inside = boxes(html);
	assert.equal(inside.length, 3, 'the block, the inline and the + form');
	assert.match(inside[0], /<strong[^>]*>SCREEN-BLOCK<\/strong>/, 'its body is markdown');
	assert.match(inside[0], /<button>SCREEN-BUTTON<\/button>/, 'its HTML kept');
	assert.equal(inside[1], 'SCREEN-INLINE');
	assert.equal(inside[2], 'SCREEN-PLUS');
	for (const s of KEPT) assert.ok(!inside.join('').includes(s), `"${s}" is outside every box`);
	assert.match(html, /<p[^>]*>A grade <span class="clew-noprint">SCREEN-INLINE<\/span> in a sentence, KEPT-TWO\.<\/p>/, 'the inline form stays in its sentence');
});

test('an export: HTML keeps it in its box, LaTeX leaves it out', async () => {
	const html = body(await exported('export-html', NOTE, 'html'));
	assert.equal(boxes(html).length, 3);
	for (const s of [...SCREEN, ...KEPT]) assert.ok(html.includes(s), `HTML export: "${s}" kept`);
	const tex = await exported('export-latex', NOTE, 'latex');
	const doc = tex.slice(tex.indexOf('\\begin{document}'));
	for (const s of SCREEN) assert.ok(!doc.includes(s), `LaTeX export: "${s}" left out`);
	for (const s of KEPT) assert.ok(doc.includes(s), `LaTeX export: "${s}" kept`);
	assert.match(doc, /A grade\s+in a sentence, KEPT-TWO\./, 'the sentence around the inline form');
	assert.match(doc, /\\section\*?\{Essay\}[\s\S]*?\n\nThe essay text, KEPT-ONE\./, 'the paragraph after the block starts a paragraph of its own');
});
