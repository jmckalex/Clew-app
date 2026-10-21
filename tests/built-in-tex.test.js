// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// A host's built-in TeX (shared/latex-engine.js#BUILT_IN_TEX — Clew-iOS's PDF
// via LaTeX): a note exported in Clew's style for the iPad by the real export
// worker, then compiled by the PINNED mp-tikz-wasm (scripts/stage-mptikz.js's
// mptikz-assets/, or CLEW_MPTIKZ_DIR) under those bundles, as LuaLaTeX with
// the library's own PDF back end. Its fonts and date are read from the PDF
// itself — every stream inflated — so no poppler is needed. Skipped where
// nothing is staged; a staged build that is not the pin fails, naming it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUILT_IN_TEX } from '../src/shared/latex-engine.js';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-built-in-tex-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const pin = JSON.parse(fs.readFileSync(path.join(repo, 'src', 'shared', 'mptikz-manifest.json'), 'utf8'));
const assets = process.env.CLEW_MPTIKZ_DIR ?? path.join(repo, 'mptikz-assets');
const staged = fs.existsSync(path.join(assets, 'index.js')) && fs.existsSync(path.join(assets, 'bundles', 'index.json'));
const skip = staged ? false : 'no mp-tikz-wasm build staged (npm run sync-mptikz)';
const bundleNames = () => JSON.parse(fs.readFileSync(path.join(assets, 'bundles', 'index.json'), 'utf8')).bundles.map((b) => b.name);

test('the built-in TeX\'s bundles are the pinned build\'s', { skip }, () => {
	const stamp = (() => { try { return JSON.parse(fs.readFileSync(path.join(assets, 'STAGED.json'), 'utf8')); } catch { return null; } })();
	if (stamp?.source === 'release') assert.equal(stamp.version, pin.version, `mptikz-assets/ holds ${stamp.version}, the pin ${pin.version}: run npm run sync-mptikz`);
	const names = bundleNames();
	assert.deepEqual(BUILT_IN_TEX.bundles.filter((b) => !names.includes(b)), [], `the staged build lacks them: ${names.join(', ')}`);
	assert.equal(BUILT_IN_TEX.date, 'now');
});

const MATHS = [
	'# Maths',
	'',
	'Inline $a^2 + b^2 = c^2$, and on its own:',
	'',
	'$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$',
	'',
	'End.',
	'',
].join('\n');

/** The note (MATHS under a `---`-fenced header of `header`'s lines, if any)
 *  exported to LaTeX in Clew's style for the iPad, by the real export worker,
 *  with a HOME of its own that holds no jmarkdown config. */
function exportTex(dir, header = []) {
	const home = path.join(dir, 'home');
	fs.mkdirSync(home, { recursive: true });
	fs.writeFileSync(path.join(dir, 'Note.md'), header.length ? `---\n${header.join('\n')}\n---\n${MATHS}` : MATHS);
	const worker = fork(path.join(repo, 'src', 'engine', 'export-worker.mjs'), [createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js')], {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file: 'Note.md', options: { to: 'latex', output: 'Note.tex' }, latexStyle: { locale: 'en-GB', platform: 'ios' } });
			else if (msg?.type === 'done') { worker.kill(); resolve(fs.readFileSync(path.join(dir, 'Note.tex'), 'utf8')); }
			else if (msg?.type === 'error') { worker.kill(); reject(new Error(msg.message)); }
		});
		worker.on('error', reject);
	});
}

/** `tex` compiled by the pinned build under BUILT_IN_TEX — a new instance for
 *  the document, as a host makes one per export. */
async function compile(tex) {
	const { MetaPost, DEFAULT_BUNDLES } = await import(pathToFileURL(path.join(assets, 'index.js')).href);
	const mp = await MetaPost.create({ bundles: [...DEFAULT_BUNDLES, ...BUILT_IN_TEX.bundles] });
	try {
		return await mp.latex(tex, { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
	} finally {
		mp.dispose();
	}
}

/** The PDF's text with every stream inflated — LuaTeX puts its font
 *  dictionaries and its Info in compressed object streams. */
function pdfText(pdf) {
	const bytes = Buffer.from(pdf);
	const parts = [bytes.toString('latin1')];
	for (let at = bytes.indexOf('stream'); at >= 0; at = bytes.indexOf('stream', at + 6)) {
		let from = at + 6;
		if (bytes[from] === 0x0d) from += 1;
		if (bytes[from] !== 0x0a) continue;
		const to = bytes.indexOf('endstream', from + 1);
		if (to < 0) break;
		try { parts.push(zlib.inflateSync(bytes.subarray(from + 1, to)).toString('latin1')); } catch {}
	}
	return parts.join('\n');
}

/** The PDF's font names, subset tags dropped. */
const fontsOf = (text) => [...new Set([...text.matchAll(/\/(?:BaseFont|FontName)\s*\/(?:[A-Z]{6}\+)?([\w-]+)/g)].map((m) => m[1]))].sort();

test('a Clew-styled note with inline and display maths: typeset by the built-in TeX in EB Garamond and Garamond-Math, dated now', { skip }, async () => {
	const tex = await exportTex(fs.mkdtempSync(path.join(root, 'styled-')));
	assert.match(tex, /\\usepackage\{unicode-math\}/);
	assert.match(tex, /\\IfFontExistsTF\{Garamond-Math\.otf\}\{\\setmathfont/);
	const r = await compile(tex);
	assert.equal(r.status, 'ok', r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join('\n'));
	const text = pdfText(r.pdf);
	const fonts = fontsOf(text);
	assert.ok(fonts.includes('EBGaramond-Regular'), `the style's text face (latex-doc): ${fonts.join(', ')}`);
	assert.ok(fonts.includes('Garamond-Math'), `the style's maths face (latex-doc): ${fonts.join(', ')}`);
	assert.match(text, new RegExp(`/CreationDate\\s*\\(D:${new Date().getFullYear()}`), 'the clock, not the library\'s fixed 2025');
});

test('a Clew-styled note whose header names its own preamble: unicode-math\'s Latin Modern Math (otf-fonts), its maths and text typeset', { skip }, async () => {
	// The header's `LaTeX preamble` replaces the style's (a key the header set
	// is never touched) — its \setmathfont with it — while the style's
	// packages, unicode-math among them, still load.
	const tex = await exportTex(fs.mkdtempSync(path.join(root, 'own-preamble-')), ['LaTeX preamble: \\usepackage{xcolor}']);
	assert.match(tex, /\\usepackage\{unicode-math\}/);
	assert.doesNotMatch(tex, /\\setmathfont/);
	const r = await compile(tex);
	assert.equal(r.status, 'ok', `without otf-fonts: "The font "latinmodern-math" cannot be found" — ${r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join(' | ')}`);
	const fonts = fontsOf(pdfText(r.pdf));
	assert.ok(fonts.includes('LatinModernMath-Regular'), `unicode-math's maths face: ${fonts.join(', ')}`);
	assert.ok(!fonts.some((f) => /^CMMI/.test(f)), `no Type 1 maths in its place: ${fonts.join(', ')}`);
});
