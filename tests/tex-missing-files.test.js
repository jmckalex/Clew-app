// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// A file TeX could not find in a run that still made its PDF, said as a build
// warning (shared/latex-engine.js#texMissingFiles, the owner's A1): from a log
// as TeX writes it — lines broken at 79 columns, a long path cut anywhere —
// then through the real tools, the desktop's latexmk (export.js#compilePdf
// runs it so) and the pinned mp-tikz-wasm's LuaLaTeX (Clew-iOS's PDF via
// LaTeX: its result.log, and its diagnostics as a fallback). Each skipped
// where the tool is absent.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { texMissingFiles, missingFileWarnings, BUILT_IN_TEX } from '../src/shared/latex-engine.js';
import { latexmkCommand } from '../src/main/latex-engine.js';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-tex-missing-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const LONG = '/nonexistent/a/rather/long/folder/name/that/will/wrap/in/the/log/a-picture-with-a-long-name.png';

// From a real LuaLaTeX log of DOCUMENT (TeX Live 2025): the warning and the
// driver's error broken at 79 columns, the bare name's error with its `l.N`.
const LOG = [
	'LaTeX Warning: File `/nonexistent/a/rather/long/folder/name/that/will/wrap/in/t',
	'he/log/a-picture-with-a-long-name.png\' not found on input line 6.',
	'',
	'',
	'! Package luatex.def Error: File `/nonexistent/a/rather/long/folder/name/that/w',
	'ill/wrap/in/the/log/a-picture-with-a-long-name.png\' not found: using draft sett',
	'ing.',
	'',
	'See the luatex.def package documentation for explanation.',
	'Type  H <return>  for immediate help.',
	' ...                                              ',
	'                                                  ',
	'l.6 .../in/the/log/a-picture-with-a-long-name.png}',
	'',
	'No file Note.bbl.',
	'! LaTeX Error: File `relative-missing\' not found.',
	'',
	'See the LaTeX manual or LaTeX Companion for explanation.',
	'Type  H <return>  for immediate help.',
	' ...                                              ',
	'                                                  ',
	'l.10 \\includegraphics{relative-missing}',
].join('\n');

test('a log: each missing file once, a wrapped path whole, its .tex line', () => {
	assert.deepEqual(texMissingFiles(LOG), [{ file: LONG, line: 6 }, { file: 'relative-missing', line: 10 }]);
	assert.deepEqual(texMissingFiles('No file Note.bbl.\nNo file Note.ind.\nOutput written on Note.pdf (1 page).\n'), [], 'an auxiliary file not yet written is no missing file');
	assert.deepEqual(texMissingFiles(''), []);
	assert.deepEqual(texMissingFiles(undefined), []);
});

test('mp-tikz-wasm\'s diagnostics, where there is no log', () => {
	const diagnostics = [
		{ severity: 'warning', source: 'tex', message: 'File `/x/picture.png\' not found on input line 6', file: 'doc.tex', line: 6 },
		{ severity: 'error', source: 'tex', message: 'Package luatex.def Error: File `/x/picture.png\' not found: u', file: 'doc.tex', line: 6 },
		{ severity: 'error', source: 'tex', message: 'LaTeX Error: File `relative-missing\' not found.', file: 'doc.tex', line: 10 },
		{ severity: 'error', source: 'tex', message: 'Undefined control sequence.', line: 12 },
	];
	assert.deepEqual(texMissingFiles(diagnostics), [{ file: '/x/picture.png', line: 6 }, { file: 'relative-missing', line: 10 }]);
});

// A path with letters of two bytes, broken as each TeX breaks a transcript
// line (measured, TeX Live 2025): pdfTeX after 79 BYTES, through a letter;
// LuaTeX before a letter that would not fit in 79.
const ACCENTED = (pad) => `/Users/me/${'x'.repeat(pad)}Größe Bilder/Übersicht der Ergebnisse/äöü-abbildung-nummer-eins-${'é'.repeat(20)}.png`;
const enc = new TextEncoder();
function broken(text, tex) {
	const bytes = enc.encode(text);
	const out = [];
	for (let at = 0; at < bytes.length;) {
		let end = Math.min(at + 79, bytes.length);
		if (tex === 'luatex') while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
		out.push(bytes.subarray(at, end), Uint8Array.of(0x0a));
		at = end;
	}
	return new Uint8Array(out.flatMap((b) => [...b]));
}

test('a path of letters wider than a byte, broken as pdfTeX and LuaTeX break it, read whole', () => {
	for (const pad of [0, 1, 2, 3]) {
		const warning = `LaTeX Warning: File \`${ACCENTED(pad)}' not found on input line 6.`;
		for (const tex of ['pdftex', 'luatex']) {
			const log = broken(warning, tex);
			assert.deepEqual(texMissingFiles(log), [{ file: ACCENTED(pad), line: 6 }], `${tex}, ${pad} x: as bytes`);
			if (tex === 'luatex') assert.deepEqual(texMissingFiles(new TextDecoder().decode(log)), [{ file: ACCENTED(pad), line: 6 }], `luatex, ${pad} x: as text`);
		}
	}
	const cut = broken(`LaTeX Warning: File \`${ACCENTED(2)}' not found on input line 6.`, 'pdftex');
	assert.ok(new TextDecoder().decode(cut).includes('\uFFFD'), 'pdfTeX did cut a letter here: read as text first, it is lost');
	// LuaTeX's own C-level lines break after 80; TeX's l.N and <…> lines are never joined to.
	assert.deepEqual(texMissingFiles(`${'L'.repeat(80)}\n! LaTeX Error: File \`x' not found.\n`), [{ file: 'x', line: null }]);
	assert.deepEqual(texMissingFiles(`! LaTeX Error: File \`gone' not found.\n\n${'.'.repeat(79)}\nl.12 \\includegraphics{gone}\n`), [{ file: 'gone', line: 12 }]);
});

test('each missing file is a warning that says the PDF was made without it', () => {
	assert.deepEqual(missingFileWarnings([{ file: LONG, line: 6 }]), [`PDF via LaTeX: TeX could not find the file "${LONG}", so the PDF was made without it.`]);
	assert.deepEqual(missingFileWarnings([]), []);
});

const DOCUMENT = (images) => [
	'\\documentclass{article}',
	'\\usepackage{graphicx}',
	'\\begin{document}',
	'Before.',
	'',
	...images.map((i) => `\\includegraphics[width=3cm]{${i}}\n`),
	'After.',
	'\\end{document}',
	'',
].join('\n');

// The long path, the four accented ones (a letter's bytes at the break, or
// not) and a bare name, each on its own line of DOCUMENT: 6, 8, 10, ….
const IMAGES = [LONG, ...[0, 1, 2, 3].map(ACCENTED), 'relative-missing'];
const EXPECTED = IMAGES.map((file, i) => ({ file, line: 6 + 2 * i }));
// 120 letters of two bytes: pdfTeX's break falls inside one on the warning's
// line (its second) and on the driver error's (its first).
const CUT = `/Users/me/${'é'.repeat(120)}.png`;

// The desktop's TeX, run as export.js#compilePdf runs it.
const TEX_DIRS = ['/Library/TeX/texbin', '/usr/local/bin', '/opt/homebrew/bin'];
const tool = (name) => TEX_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
const latexmk = tool('latexmk');
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

function compile(name, engine, tex) {
	const dir = path.join(root, name);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'Note.tex'), tex);
	const { args, env } = latexmkCommand({ engine, texFile: 'Note.tex', env: process.env, isFile });
	return new Promise((resolve) => {
		execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, () => {
			resolve({ pdf: fs.existsSync(path.join(dir, 'Note.pdf')), log: fs.readFileSync(path.join(dir, 'Note.log')) });
		});
	});
}

for (const engine of ['pdflatex', 'lualatex']) {
	test(`the desktop's latexmk and ${engine}: a PDF made without the images, and the log names each`, { skip: latexmk && tool(engine) ? false : `latexmk and ${engine} are not installed` }, async () => {
		const { pdf, log } = await compile(`missing-${engine}`, engine, DOCUMENT(IMAGES));
		assert.ok(pdf, 'nonstopmode goes on and writes the PDF — which compilePdf accepts');
		assert.deepEqual(texMissingFiles(log), EXPECTED, 'the log as bytes, as compilePdf reads it');
		if (engine === 'pdflatex') {
			// Cut inside a letter on the warning's line AND the error's: from bytes
			// it is read whole; from text first, it is lost.
			const cut = await compile('cut-pdflatex', engine, DOCUMENT([CUT]));
			assert.deepEqual(texMissingFiles(cut.log), [{ file: CUT, line: 6 }]);
			assert.deepEqual(texMissingFiles(new TextDecoder().decode(cut.log)), [], 'why compilePdf reads the log as bytes');
		}
		const clean = await compile(`clean-${engine}`, engine, DOCUMENT([]));
		assert.ok(clean.pdf);
		assert.deepEqual(texMissingFiles(clean.log), []);
	});
}

// Clew-iOS's TeX: the pinned build (scripts/stage-mptikz.js's mptikz-assets/).
const assets = process.env.CLEW_MPTIKZ_DIR ?? path.join(repo, 'mptikz-assets');
const staged = fs.existsSync(path.join(assets, 'index.js'));

test('mp-tikz-wasm\'s LuaLaTeX (the iPad): its log names each, accented paths whole, and its diagnostics the short ones', { skip: staged ? false : 'no mp-tikz-wasm build staged (npm run sync-mptikz)' }, async () => {
	const { MetaPost, DEFAULT_BUNDLES } = await import(pathToFileURL(path.join(assets, 'index.js')).href);
	const mp = await MetaPost.create({ bundles: [...DEFAULT_BUNDLES, ...BUILT_IN_TEX.bundles] });
	try {
		const r = await mp.latex(DOCUMENT(IMAGES), { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
		assert.ok(r.pdf?.length, `a PDF made without them (status ${r.status})`);
		assert.deepEqual(texMissingFiles(r.log), EXPECTED, 'result.log, a string, whole under LuaLaTeX');
		assert.ok(texMissingFiles(r.diagnostics).some((f) => f.file === 'relative-missing' && f.line === EXPECTED.at(-1).line));
	} finally {
		mp.dispose();
	}
});
