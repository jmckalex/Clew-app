// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Clew's LaTeX style loads Garamond-Math only for a document with maths (the
// owner's C4; engine/latex-style.js#mathFontOnlyWithMaths, which every host
// runs over what the engine wrote): what counts as maths, erring towards yes;
// then through the real export worker, LuaLaTeX (the PDF's fonts and text)
// and the pinned mp-tikz-wasm (Clew-iOS's built-in TeX).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile, fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { texHasMaths, mathFontOnlyWithMaths, MATH_FONT_LINE, latexStyleConfig } from '../src/engine/latex-style.js';
import { BUILT_IN_TEX } from '../src/shared/latex-engine.js';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-math-font-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const doc = (preamble, body) => `\\documentclass{article}\n${preamble}\n\\begin{document}\n${body}\n\\end{document}\n`;

test('maths: a formula, a maths environment, a command that sets maths — erring towards yes', () => {
	for (const [what, tex] of [
		['$…$', doc('', 'a $x$ b')],
		['$$…$$', doc('', '$$x$$')],
		['\\(…\\)', doc('', '\\(x\\)')],
		['\\[…\\]', doc('', '\\[x\\]')],
		['a $ after a line break', doc('', 'line\\\\$x$')],
		['align*', doc('', '\\begin{align*}a&=b\\end{align*}')],
		['equation', doc('', '\\begin{equation}a\\end{equation}')],
		['\\ensuremath in text', doc('', 'a \\ensuremath{x} b')],
		['\\mathbb', doc('', '\\mathbb{R}')],
		['siunitx', doc('', '\\SI{3}{\\metre}')],
		['mhchem', doc('', '\\ce{H2O}')],
		['a macro the preamble defines with maths', doc('\\newcommand{\\R}{\\ensuremath{\\mathbb{R}}}', 'The reals \\R.')],
		['a title with maths', doc('\\title{On $E=mc^2$}', '\\maketitle')],
		['after an escaped %', doc('', '50\\% of $x$')],
		['\\textsuperscript: maths in the kernel', doc('', 'the 1\\textsuperscript{st}')],
		['\\textsubscript', doc('', 'H\\textsubscript{2}O')],
		['a footnote: its mark is a \\textsuperscript', doc('', 'Text.\\footnote{A note.}')],
		['\\footnotemark', doc('', 'Text\\footnotemark')],
		['\\thanks', doc('\\author{A\\thanks{B}}', '\\maketitle')],
	]) assert.equal(texHasMaths(tex), true, what);
});

test('no maths: dollars escaped, a line break\'s optional skip, code, comments, the style\'s own block', () => {
	for (const [what, tex] of [
		['plain text', doc('', 'Text, and \\textbf{bold}.')],
		['\\$5 and \\$6', doc('', 'costs \\$5 and \\$6')],
		['\\\\[2pt]', doc('', 'a\\\\[2pt] b')],
		['minted', doc('', '\\begin{minted}{sh}\necho $HOME\n\\end{minted}')],
		['\\mintinline', doc('', 'run \\mintinline{text}|$x$| or \\mintinline{text}{$y$}')],
		['\\verb', doc('', '\\verb|$x$|')],
		['verbatim', doc('', '\\begin{verbatim}\n\\[x\\]\n\\end{verbatim}')],
		['a comment', doc('', 'a % $x$ in a comment')],
		['the style\'s maths line itself', doc(`% Clew's export style (Settings → Appearance; \`latexExportStyle: none\` leaves it out).\n\\makeatletter\n${MATH_FONT_LINE}\n\\makeatother`, 'Text.')],
	]) assert.equal(texHasMaths(tex), false, what);
});

test('the pass takes out the style\'s line only, and only where nothing has maths — a book\'s chapters counted', () => {
	const styled = (body) => doc(`\\usepackage{unicode-math}\n\\makeatletter\n${MATH_FONT_LINE}\n\\makeatother`, body);
	assert.equal(mathFontOnlyWithMaths(styled('Text.')), styled('Text.').replace(`${MATH_FONT_LINE}\n`, ''));
	assert.ok(mathFontOnlyWithMaths(styled('Text.')).includes('\\usepackage{unicode-math}'), 'unicode-math stays: its own default at \\begin{document}');
	assert.equal(mathFontOnlyWithMaths(styled('$x$')), styled('$x$'));
	const master = styled('\\include{Book-ch-1}\n\\include{Book-ch-2}');
	assert.equal(mathFontOnlyWithMaths(master, ['Prose.', 'And $x$.']), master, 'maths in a chapter only');
	assert.equal(mathFontOnlyWithMaths(master, ['Prose.', 'More prose.']), master.replace(`${MATH_FONT_LINE}\n`, ''));
	assert.equal(mathFontOnlyWithMaths(doc('', 'Text.')), doc('', 'Text.'), 'no style: as it was');
});

test('the line the pass takes out is the one the style writes', () => {
	const preamble = Object.fromEntries(latexStyleConfig(() => undefined, { locale: 'en-GB', platform: 'darwin' }))['LaTeX preamble'];
	assert.ok(preamble.includes(MATH_FONT_LINE));
});

// The real export worker, in Clew's style, a HOME of its own.
const watchWorker = createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js');
const PROSE = '# Prose\n\nNo formula here, only words — and 50% of them.\n';
const FOOTNOTED = '# Noted\n\nWords with a note.[fn: The note.]\n';
const MATHS = '# Maths\n\nInline $a^2 + b^2 = c^2$, and:\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$\n';
function exportTex(name, note, platform = process.platform) {
	const dir = path.join(root, name);
	fs.mkdirSync(path.join(dir, 'home'), { recursive: true });
	fs.writeFileSync(path.join(dir, 'Note.md'), note);
	const worker = fork(path.join(repo, 'src', 'engine', 'export-worker.mjs'), [watchWorker], {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: path.join(dir, 'home'), CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file: 'Note.md', options: { to: 'latex', output: 'Note.tex' }, latexStyle: { locale: 'en-GB', platform } });
			else if (msg?.type === 'done') { worker.kill(); resolve({ dir, tex: fs.readFileSync(path.join(dir, 'Note.tex'), 'utf8') }); }
			else if (msg?.type === 'error') { worker.kill(); reject(new Error(msg.message)); }
		});
		worker.on('error', reject);
	});
}

test('through the export worker: a note without maths loses the line, one with maths keeps it', async () => {
	const prose = await exportTex('worker-prose', PROSE);
	assert.ok(!prose.tex.includes(MATH_FONT_LINE));
	assert.match(prose.tex, /\\usepackage\{unicode-math\}/);
	const maths = await exportTex('worker-maths', MATHS);
	assert.ok(maths.tex.includes(MATH_FONT_LINE));
	const noted = await exportTex('worker-footnote', FOOTNOTED);
	assert.match(noted.tex, /\\footnote\{/);
	assert.ok(noted.tex.includes(MATH_FONT_LINE), 'a footnote\'s mark is set by the maths font: kept');
});

const TEX_DIRS = ['/Library/TeX/texbin', '/usr/local/bin', '/opt/homebrew/bin'];
const tool = (name) => TEX_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
const skip = tool('latexmk') && tool('lualatex') && tool('pdffonts') && tool('pdftotext') ? false : 'latexmk, LuaLaTeX and poppler are not installed';
const run = (cmd, args, cwd) => new Promise((resolve) => {
	execFile(cmd, args, { cwd, env: { ...process.env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` }, timeout: 120000 }, (err, stdout) => resolve(stdout));
});
async function pdfOf(dir, tex) {
	fs.writeFileSync(path.join(dir, 'Note.tex'), tex);
	await run(tool('latexmk'), ['-lualatex', '-g', '-interaction=nonstopmode', '-quiet', 'Note.tex'], dir);
	const fonts = (await run(tool('pdffonts'), ['Note.pdf'], dir)).split('\n').slice(2).map((l) => l.split(/\s+/)[0].replace(/^[A-Z]{6}\+/, '')).filter(Boolean);
	return { fonts, text: await run(tool('pdftotext'), ['Note.pdf', '-'], dir) };
}

test('compiled by LuaLaTeX: without maths, no Garamond-Math and the same text as with the line; with maths, Garamond-Math', { skip }, async () => {
	const prose = await exportTex('pdf-prose', PROSE);
	const without = await pdfOf(prose.dir, prose.tex);
	const withLine = await pdfOf(prose.dir, prose.tex.replace('\\makeatletter\n', `\\makeatletter\n${MATH_FONT_LINE}\n`));
	assert.ok(without.fonts.includes('EBGaramond-Regular'), without.fonts.join(', '));
	assert.ok(!without.fonts.some((f) => /Math/.test(f)), `no maths face: ${without.fonts.join(', ')}`);
	assert.equal(without.text, withLine.text, 'it prints the same');
	const maths = await exportTex('pdf-maths', MATHS);
	assert.ok((await pdfOf(maths.dir, maths.tex)).fonts.includes('Garamond-Math'));
});

// Clew-iOS's TeX: the pinned build, under BUILT_IN_TEX.
const assets = process.env.CLEW_MPTIKZ_DIR ?? path.join(repo, 'mptikz-assets');
const staged = fs.existsSync(path.join(assets, 'index.js'));
function pdfFonts(pdf) {
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
	return [...new Set([...parts.join('\n').matchAll(/\/(?:BaseFont|FontName)\s*\/(?:[A-Z]{6}\+)?([\w-]+)/g)].map((m) => m[1]))];
}

test('the built-in TeX (the iPad): a note without maths, the line taken out, typeset without Garamond-Math', { skip: staged ? false : 'no mp-tikz-wasm build staged (npm run sync-mptikz)' }, async () => {
	const { tex } = await exportTex('ios-prose', PROSE, 'ios');
	assert.ok(!tex.includes(MATH_FONT_LINE));
	const { MetaPost, DEFAULT_BUNDLES } = await import(pathToFileURL(path.join(assets, 'index.js')).href);
	const mp = await MetaPost.create({ bundles: [...DEFAULT_BUNDLES, ...BUILT_IN_TEX.bundles] });
	try {
		const r = await mp.latex(tex, { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
		assert.equal(r.status, 'ok', r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join(' | '));
		const fonts = pdfFonts(r.pdf);
		assert.ok(fonts.includes('EBGaramond-Regular'), fonts.join(', '));
		assert.ok(!fonts.some((f) => /Math/.test(f)), fonts.join(', '));
	} finally {
		mp.dispose();
	}
});
