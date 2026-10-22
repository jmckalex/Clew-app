// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Clew's LaTeX export style (src/engine/latex-style.js): what it adds to the
// user's jmarkdown configuration, and — through the real export worker, the
// engine and LuaLaTeX, with a HOME of the test's own whose config sets
// another face, as the owner's sets Optima — what a document comes out as.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork, execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { latexStyleConfig, latexStyleWanted, headerValues, babelName, BABEL } from '../src/engine/latex-style.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-latex-style-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const style = (config, where = { locale: 'en-GB', platform: 'darwin' }) =>
	Object.fromEntries(latexStyleConfig((k) => config[k], where));

test('layout keys only where the user\'s config leaves them unset, or at the engine\'s default', () => {
	const s = style({ 'Smart typography': false });
	const atDefaults = Object.fromEntries(latexStyleConfig((k) => ({ 'LaTeX engine': 'pdflatex', 'Class options': '' })[k],
		{ locale: 'en-GB', defaults: { 'LaTeX engine': 'pdflatex', 'Class options': '' } }));
	assert.equal(atDefaults['LaTeX engine'], 'lualatex', 'the engine\'s default pdflatex is no choice');
	assert.equal(atDefaults['Class options'], '12pt,a4paper');
	assert.equal(s['LaTeX engine'], 'lualatex');
	assert.equal(s['Class options'], '12pt,a4paper');
	assert.equal(s.Geometry, 'textwidth=31pc,top=30mm,bottom=32mm');
	assert.equal(s['Smart typography'], true);
	const mine = style({ 'LaTeX engine': 'xelatex', 'Class options': '11pt', Geometry: 'margin=1in', 'Smart typography': true });
	assert.equal('LaTeX engine' in mine, false);
	assert.equal('Class options' in mine, false);
	assert.equal('Geometry' in mine, false);
	assert.equal('Smart typography' in mine, false);
});

const babelOf = (s) => /\\usepackage\[(\w+)\]\{babel\}/.exec(s['LaTeX preamble'].join('\n'))?.[1] ?? null;

test('the language: the header\'s Lang, else the config\'s; its region, else the machine\'s, for the paper and English\'s variant', () => {
	assert.equal(style({}, { locale: 'en-US' })['Class options'], '12pt,letterpaper');
	assert.equal(babelOf(style({}, { locale: 'en-US' })), 'american');
	assert.equal(style({ Lang: 'en-GB' }, { locale: 'en-US' })['Class options'], '12pt,a4paper');
	assert.equal(babelOf(style({ Lang: 'en' }, { locale: 'en-GB' })), 'british');
	assert.equal(babelOf(style({ Lang: 'en' }, { locale: 'de-DE' })), 'english', 'a bare en elsewhere: babel\'s english');
	assert.equal(babelOf(style({ Lang: 'de' })), 'ngerman');
	assert.equal(babelOf(style({ Lang: 'tlh' })), null, 'a tag babel does not know: no hyphenation from the style');
	// The header's Lang over the config's (Clew-docs: a German note hyphenated as British).
	const de = Object.fromEntries(latexStyleConfig((k) => ({ Lang: 'en' })[k], { locale: 'en-GB', header: { Lang: 'de' } }));
	assert.equal(babelOf(de), 'ngerman');
	const us = Object.fromEntries(latexStyleConfig((k) => ({ Lang: 'en' })[k], { locale: 'en-GB', header: { Lang: 'en-US' } }));
	assert.equal(us['Class options'], '12pt,letterpaper');
	assert.equal(babelOf(us), 'american');
	// babel only where none is loaded: the engine's book loads one for a book in other languages.
	assert.match(style({})['LaTeX preamble'].join('\n'), /\\@ifpackageloaded\{babel\}\{\}\{\\@ifpackageloaded\{polyglossia\}\{\}\{\\usepackage/);
});

test('a header that forces pdfLaTeX gets no style; a key the header set is never set by the style', () => {
	assert.deepEqual(latexStyleConfig(() => undefined, { header: { 'LaTeX engine': 'pdflatex' } }), []);
	const s = Object.fromEntries(latexStyleConfig(() => undefined, { locale: 'en-GB',
		header: { Packages: 'xcolor', 'LaTeX preamble': '\\usepackage{x}', Geometry: 'margin=1in', 'Smart typography': 'false', 'LaTeX engine': 'xelatex' } }));
	for (const key of ['Packages', 'LaTeX preamble', 'Geometry', 'Smart typography', 'LaTeX engine']) assert.equal(key in s, false, key);
	assert.deepEqual(headerValues({ 'latex  engine': ['pdflatex'], Class_options: ['11pt'], lang: ['de'], Title: ['x'] }),
		{ 'LaTeX engine': 'pdflatex', 'Class options': '11pt', Lang: 'de' });
});

test('class options naming no paper get the region\'s through geometry; ones that name it keep it', () => {
	assert.equal(style({ 'Class options': '11pt' }).Geometry, 'a4paper,textwidth=31pc,top=30mm,bottom=32mm');
	assert.equal(style({ 'Class options': '11pt' }, { locale: 'en-US' }).Geometry, 'letterpaper,textwidth=31pc,top=30mm,bottom=32mm');
	assert.equal(style({ 'Class options': '11pt,letterpaper' }).Geometry, 'textwidth=31pc,top=30mm,bottom=32mm');
	assert.equal(Object.fromEntries(latexStyleConfig(() => undefined, { locale: 'en-GB', header: { 'Class options': '10pt' } })).Geometry,
		'a4paper,textwidth=31pc,top=30mm,bottom=32mm');
});

test('babel\'s names are the engine\'s own (jmarkdown book.js#BABEL)', () => {
	const source = fs.readFileSync(path.resolve('vendor/jmarkdown/src/book.js'), 'utf8');
	const literal = /const BABEL = (\{[\s\S]*?\});/.exec(source)?.[1];
	assert.ok(literal, 'book.js has a BABEL table');
	assert.deepEqual(BABEL, new Function(`return ${literal}`)());
	assert.equal(babelName('EN_gb'), 'british');
});

test('packages and preamble are ADDED to the user\'s — the style\'s fonts after the user\'s own', () => {
	const s = style({ Packages: ['xcolor', 'microtype'], 'LaTeX preamble': ['\\usepackage{fontspec}', '\\setmainfont{Optima}'] });
	assert.deepEqual(s.Packages, ['xcolor', 'microtype', 'unicode-math', 'enumitem', 'titlesec', 'titling', 'etoolbox']);
	const lines = s['LaTeX preamble'];
	assert.deepEqual(lines.slice(0, 2), ['\\usepackage{fontspec}', '\\setmainfont{Optima}']);
	assert.ok(lines.findIndex((l) => l.includes('\\setmainfont{EBGaramond}')) > 1);
	// Every command guarded by what it needs, so a header that replaces the
	// packages leaves a document that compiles.
	for (const line of lines.slice(2)) {
		if (/^\\(titleformat|setlist|AtBeginEnvironment|pretitle|setmathfont|setdefaultlanguage|hypersetup)/.test(line)) assert.fail(`unguarded: ${line}`);
	}
	assert.match(style({}, { platform: 'win32' })['LaTeX preamble'].join('\n'), /SegoeUIEmoji/);
	assert.match(style({}, { platform: 'linux' })['LaTeX preamble'].join('\n'), /NotoColorEmoji/);
});

test('only commands an old TeX has: \\@ifpackageloaded inside \\makeatletter, never the 2021 kernel\'s tests; luaotfload\'s fallback asked for first', () => {
	// The style is on by default: a TeX Live before 2021-11 has no
	// \IfPackageLoadedTF, and every LaTeX export would stop at "Undefined
	// control sequence" (Clew-boss, 2026-10-19).
	for (const where of [{ platform: 'darwin' }, { platform: 'linux', locale: 'en-US' }]) {
		const lines = style({}, where)['LaTeX preamble'];
		const text = lines.join('\n');
		assert.doesNotMatch(text, /\\(IfPackageLoaded|IfClassLoaded|IfFormatAtLeast|IfPackageAtLeast|NewDocumentCommand|IfBooleanTF)/);
		const open = lines.indexOf('\\makeatletter');
		const close = lines.lastIndexOf('\\makeatother');
		assert.ok(open >= 0 && close === lines.length - 1, 'the block is \\makeatletter … \\makeatother');
		lines.forEach((line, i) => {
			if (/\\@/.test(line)) assert.ok(i > open && i < close, `an @ command outside the block: ${line}`);
		});
		assert.match(text, /\\@ifpackageloaded\{fontspec\}/);
		// luaotfload 3.11 (TeX Live 2020) brought add_fallback: older, the face alone.
		assert.ok(text.indexOf('luaotfload.add_fallback and 1 or 0') < text.indexOf('luaotfload.add_fallback("clewemoji"'));
	}
});

// The real worker, engine and LuaLaTeX. Skipped on a machine without them.
test('whether a build gets the style: a LaTeX build, the setting `clew` or unset, pdfLaTeX not forced — every host\'s rule', () => {
	const where = { locale: 'en-GB', platform: 'ios' };
	assert.deepEqual(latexStyleWanted({ to: 'latex', ...where }), where, 'the setting unset is its default, clew');
	assert.deepEqual(latexStyleWanted({ to: 'latex', style: 'clew', engine: 'lualatex', ...where }), where);
	assert.equal(latexStyleWanted({ to: 'html', style: 'clew', ...where }), null);
	assert.equal(latexStyleWanted({ to: 'latex', style: 'none', ...where }), null);
	assert.equal(latexStyleWanted({ to: 'latex', style: 'clew', engine: 'pdflatex', ...where }), null);
	assert.deepEqual(latexStyleWanted({ to: 'latex' }), { locale: '', platform: '' });
});

test('the emoji face by platform: the Mac\'s, Windows\', Linux\' for one unknown — and none on the iPad, whose TeX has no HarfBuzz', () => {
	const preambleOn = (platform) => style({}, { locale: 'en-GB', platform })['LaTeX preamble'].join('\n');
	assert.match(preambleOn('darwin'), /add_fallback\("clewemoji", \{"AppleColorEmoji:mode=harf;"\}\)/);
	assert.match(preambleOn('win32'), /SegoeUIEmoji:mode=harf/);
	assert.match(preambleOn('freebsd'), /NotoColorEmoji:mode=harf/);
	const ios = preambleOn('ios');
	assert.doesNotMatch(ios, /add_fallback|Emoji|directlua/);
	assert.match(ios, /\\@ifpackageloaded\{fontspec\}\{\\IfFontExistsTF\{EBGaramond-Regular\.otf\}\{%\n  \\setmainfont\{EBGaramond\}\[Extension=\.otf,[^\n]*\]%\n\}\{\}\}\{\}/);
});

const TEX_DIRS = ['/Library/TeX/texbin', '/usr/local/bin', '/opt/homebrew/bin'];
const tool = (name) => TEX_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
const haveTools = tool('latexmk') && tool('lualatex') && tool('pdffonts') && tool('kpsewhich');
const skip = haveTools ? false : 'latexmk, LuaLaTeX and pdffonts are not installed';
const PATH = `${TEX_DIRS.join(':')}:${process.env.PATH}`;
const run = (cmd, args, cwd) => new Promise((resolve) => {
	execFile(cmd, args, { cwd, env: { ...process.env, PATH }, timeout: 120000 }, (err, stdout, stderr) => resolve({ err, stdout, stderr }));
});

const NOTE = [
	'@title[Notes on “a Topic”]',
	'@author[A. Reader]',
	'@date[1 March 2026]',
	'',
	'# Introduction',
	'',
	'* A first point, with a quotation:',
	'    > "How do $a_1, \\dots, a_k$ combine as $k$ grows?"',
	'',
	'    A second paragraph of the point. 🙂',
	'',
].join('\n');

/** The note (NOTE, or `body`) exported to LaTeX by the real export worker,
 *  with `latexStyle` (or none) — under a `---`-fenced header of `header`'s
 *  lines, if any. */
function exportTex(dir, latexStyle, header = [], body = NOTE) {
	const home = path.join(dir, 'home');
	fs.mkdirSync(path.join(home, '.jmarkdown'), { recursive: true });
	// The user's own config sets another face, as the owner's sets Optima.
	fs.writeFileSync(path.join(home, '.jmarkdown', 'config.json'), JSON.stringify({
		'LaTeX preamble': ['\\usepackage{fontspec}', '\\setmainfont{texgyrepagella-regular.otf}'],
	}));
	fs.writeFileSync(path.join(dir, 'Note.md'), header.length ? `---\n${header.join('\n')}\n---\n${body}` : body);
	const worker = fork(path.resolve('src/engine/export-worker.mjs'), [createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js')], {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file: 'Note.md', options: { to: 'latex', output: 'Note.tex' }, latexStyle });
			else if (msg?.type === 'done') resolve(fs.readFileSync(path.join(dir, 'Note.tex'), 'utf8'));
			else if (msg?.type === 'error') reject(new Error(msg.message));
		});
		worker.on('error', reject);
	});
}

test('through the export worker: the style\'s class, page, fonts after the user\'s, smart quotes; none without it', async () => {
	const styled = await exportTex(fs.mkdtempSync(path.join(root, 'styled-')), { locale: 'en-GB', platform: process.platform });
	assert.match(styled, /^\\documentclass\[12pt,a4paper\]\{article\}/);
	assert.match(styled, /\\usepackage\[textwidth=31pc,top=30mm,bottom=32mm\]\{geometry\}/);
	assert.doesNotMatch(styled, /\{inputenc\}/, 'LuaLaTeX: fontspec, no inputenc');
	assert.ok(styled.indexOf('texgyrepagella') < styled.indexOf('\\setmainfont{EBGaramond}'), 'the style\'s face after the user\'s');
	assert.ok(styled.indexOf('\\usepackage{titlesec}') < styled.indexOf('\\usepackage{hyperref}'), 'the style\'s packages before hyperref');
	assert.match(styled, /“How do \$a_1/, 'smart quotes');
	const plain = await exportTex(fs.mkdtempSync(path.join(root, 'plain-')), null);
	assert.match(plain, /^\\documentclass\{article\}/);
	assert.doesNotMatch(plain, /EBGaramond|titlesec|babel/);
	assert.match(plain, /"How do \$a_1/);
});

test('through the export worker, the note\'s HEADER decides: its Lang, its pdflatex, its paperless class options', async () => {
	const gb = { locale: 'en-GB', platform: process.platform };
	const tex = (header) => exportTex(fs.mkdtempSync(path.join(root, 'header-')), gb, header);
	const none = await tex([]);
	assert.match(none, /\\usepackage\[british\]\{babel\}/, 'no header: the machine\'s English');
	const de = await tex(['Lang: de']);
	assert.match(de, /\\usepackage\[ngerman\]\{babel\}/);
	assert.doesNotMatch(de, /british|american/, 'a German note is not hyphenated as English');
	const us = await tex(['Lang: en-US']);
	assert.match(us, /^\\documentclass\[12pt,letterpaper\]\{article\}/);
	assert.match(us, /\\usepackage\[american\]\{babel\}/);
	const pdflatex = await tex(['LaTeX engine: pdflatex']);
	assert.match(pdflatex, /^\\documentclass\{article\}/, 'a header forcing pdfLaTeX: no style');
	assert.match(pdflatex, /\{inputenc\}/);
	assert.doesNotMatch(pdflatex, /EBGaramond|titlesec|babel|unicode-math|Clew's export style/);
	const eleven = await tex(['Class options: 11pt']);
	assert.match(eleven, /^\\documentclass\[11pt\]\{article\}/);
	assert.match(eleven, /\\usepackage\[a4paper,textwidth=31pc,top=30mm,bottom=32mm\]\{geometry\}/);
	const packages = await tex(['Packages: xcolor']);
	assert.match(packages, /\\usepackage\{xcolor\}/);
	assert.doesNotMatch(packages, /\\usepackage\{titlesec\}/, 'the header\'s Packages replace the style\'s');
});

test('a book: the MASTER\'s header decides, its chapters\' headers never re-decide it', async () => {
	// book.js checks a chapter's keys by merging them into TRIAL copies of the
	// configuration, which inherit the worker's wrapper: re-deciding from one
	// chapter's key reset a German book's language to British (measured).
	const dir = fs.mkdtempSync(path.join(root, 'book-'));
	const home = path.join(dir, 'home');
	fs.mkdirSync(path.join(home, '.jmarkdown'), { recursive: true });
	fs.writeFileSync(path.join(home, '.jmarkdown', 'config.json'), '{}');
	fs.writeFileSync(path.join(dir, 'Book.md'), '---\nLang: de\nbook: true\n---\n\nVorwort.\n');
	fs.writeFileSync(path.join(dir, 'Eins.md'), '# Eins\n\nText.\n');
	fs.writeFileSync(path.join(dir, 'Zwei.md'), '---\nSmart typography: true\n---\n# Zwei\n\nText.\n');
	const worker = fork(path.resolve('src/engine/export-worker.mjs'), [createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js')], {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	const tex = await new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') {
				worker.send({ type: 'build', file: 'Book.md', options: { to: 'latex', output: 'Book.tex', chapters: ['Eins.md', 'Zwei.md'] },
					latexStyle: { locale: 'en-GB', platform: process.platform } });
			} else if (msg?.type === 'done') resolve(fs.readFileSync(path.join(dir, 'Book.tex'), 'utf8'));
			else if (msg?.type === 'error') reject(new Error(msg.message));
		});
		worker.on('error', reject);
	});
	assert.match(tex, /\\@ifpackageloaded\{polyglossia\}\{\}\{\\usepackage\[ngerman\]\{babel\}\}/, 'the style\'s language is the master\'s');
	assert.doesNotMatch(tex, /british/);
});

test('compiled by LuaLaTeX: EB Garamond and Garamond-Math, the user\'s face set aside', { skip }, async () => {
	const dir = fs.mkdtempSync(path.join(root, 'pdf-'));
	await exportTex(dir, { locale: 'en-GB', platform: process.platform });
	const built = await run(tool('latexmk'), ['-lualatex', '-interaction=nonstopmode', '-quiet', 'Note.tex'], dir);
	assert.ok(fs.existsSync(path.join(dir, 'Note.pdf')), `no PDF: ${built.stdout.slice(-800)}`);
	const { stdout } = await run(tool('pdffonts'), ['Note.pdf'], dir);
	assert.match(stdout, /EBGaramond-Regular/);
	assert.match(stdout, /Garamond-Math/);
	assert.doesNotMatch(stdout, /Pagella/i);
	if (process.platform === 'darwin') assert.match(stdout, /AppleColorEmoji/, 'the emoji from the fallback');
	const { stdout: info } = await run(tool('pdfinfo'), ['Note.pdf'], dir);
	assert.match(info, /Page size:\s+595\.\d+ x 841\.\d+ pts \(A4\)/);
});

// The title-page directives as LaTeX's own title: jmarkdown's `LaTeX
// maketitle` (efd8a39, default off), which the export worker turns on for
// every LaTeX build, the style's or not; a header's false wins. Under it the
// block's title is the PDF's Title too, where the header names none (b0aa61b).
const TITLE_BLOCK = [
	'@title[Notes on “a Topic”]',
	'@subtitle[A second look]',
	'@author[A. Reader]',
	'@institution[University of Somewhere]',
	'@author[B. Writer]',
	'@date[1 March 2026]',
	'',
	'# Introduction',
	'',
	'Text.',
	'',
].join('\n');
const MONTH = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

/** Compiles `dir`/Note.tex with LuaLaTeX: the log's errors and the PDF's text. */
async function compiled(dir) {
	await run(tool('latexmk'), ['-lualatex', '-interaction=nonstopmode', '-quiet', 'Note.tex'], dir);
	const log = fs.existsSync(path.join(dir, 'Note.log')) ? fs.readFileSync(path.join(dir, 'Note.log'), 'utf8') : '';
	const { stdout: text } = await run(tool('pdftotext'), ['Note.pdf', '-'], dir);
	return { errors: log.split('\n').filter((l) => l.startsWith('!')), pdf: fs.existsSync(path.join(dir, 'Note.pdf')), text };
}

test('the title block as \\title, \\author, \\date and \\maketitle — compiled in the style: authors side by side by \\and, in small capitals', { skip }, async () => {
	const dir = fs.mkdtempSync(path.join(root, 'maketitle-'));
	const tex = await exportTex(dir, { locale: 'en-GB', platform: process.platform }, [], TITLE_BLOCK);
	assert.match(tex, /\\title\{Notes on “a Topic”\\\\\{\\large A second look\}\}\n\\author\{A\. Reader\\\\University of Somewhere \\and B\. Writer\}\n\\date\{1 March 2026\}\n\\maketitle/);
	// titling's author line opens a tabular, which `\and` closes and opens again
	// (without it: "Misplaced \crcr"), its first row in small capitals.
	assert.match(tex, /\\preauthor\{[^\n]*\\begin\{tabular\}\[t\]\{c\}\\large\\scshape\}/);
	const { errors, pdf, text } = await compiled(dir);
	assert.deepEqual(errors, []);
	assert.ok(pdf);
	for (const s of ['Notes on “a Topic”', 'A second look', 'A. Reader', 'University of Somewhere', 'B. Writer', '1 March 2026']) assert.ok(text.includes(s), s);
	// The PDF's Title: the block's title as text, without its subtitle.
	const { stdout: info } = await run(tool('pdfinfo'), ['Note.pdf'], dir);
	assert.match(info, /^Title:\s+Notes on “a Topic”$/m);
	// Each author set alike — the second too, which `\and` opens — on one
	// line, the institution smaller under the first.
	const { stdout: boxes } = await run(tool('pdftotext'), ['-bbox', '-l', '1', 'Note.pdf', '-'], dir);
	const box = (word) => {
		const m = new RegExp(`yMin="([\\d.]+)"[^>]*yMax="([\\d.]+)">${word}<`).exec(boxes);
		return { top: Number(m[1]), height: Number(m[2]) - Number(m[1]) };
	};
	const [reader, writer, somewhere] = ['Reader', 'Writer', 'Somewhere'].map(box);
	assert.ok(Math.abs(writer.height - reader.height) < 0.1 && Math.abs(writer.top - reader.top) < 0.1, `${JSON.stringify(writer)} vs ${JSON.stringify(reader)}`);
	assert.ok(somewhere.height < reader.height - 1 && somewhere.top > reader.top);
});

test('a header\'s Title with no Date: \\date{}, so no date is printed', { skip }, async () => {
	const dir = fs.mkdtempSync(path.join(root, 'maketitle-header-'));
	const tex = await exportTex(dir, { locale: 'en-GB', platform: process.platform }, ['Title: Header Title', 'Author: H. Author'], '# Introduction\n\nText.\n');
	assert.match(tex, /\\title\{Header Title\}\n\\author\{H\. Author\}\n\\date\{\}\n\\maketitle/);
	const { errors, text } = await compiled(dir);
	assert.deepEqual(errors, []);
	assert.ok(text.includes('Header Title') && text.includes('H. Author'));
	assert.doesNotMatch(text, MONTH, 'LaTeX\'s \\today left out');
});

test('a header\'s `LaTeX maketitle: false` wins: the title lines as before', async () => {
	const tex = await exportTex(fs.mkdtempSync(path.join(root, 'maketitle-off-')), { locale: 'en-GB', platform: process.platform },
		['LaTeX maketitle: false'], TITLE_BLOCK);
	assert.doesNotMatch(tex, /\\maketitle|\\author\{/);
	assert.match(tex, /\{\\noindent\\LARGE\\bfseries Notes on “a Topic”\\par\}/);
	assert.doesNotMatch(tex, /pdftitle/, 'nor the PDF\'s Title');
});

test('with `latexExportStyle: none` the title block is still LaTeX\'s title — compiled as the engine\'s own document (LuaLaTeX, as latex-engine.js picks for the home\'s fontspec)', { skip }, async () => {
	const dir = fs.mkdtempSync(path.join(root, 'maketitle-plain-'));
	const tex = await exportTex(dir, null, [], TITLE_BLOCK);
	assert.match(tex, /^\\documentclass\{article\}/);
	assert.match(tex, /\\author\{A\. Reader\\\\University of Somewhere \\and B\. Writer\}\n\\date\{1 March 2026\}\n\\maketitle/);
	assert.doesNotMatch(tex, /titling|EBGaramond/);
	const { errors, pdf, text } = await compiled(dir);
	assert.deepEqual(errors, []);
	assert.ok(pdf);
	assert.ok(text.includes('B. Writer') && text.includes('1 March 2026'));
});

test('a book: the master\'s title block is the book\'s title page, a chapter\'s stays a line', async () => {
	const dir = fs.mkdtempSync(path.join(root, 'maketitle-book-'));
	const home = path.join(dir, 'home');
	fs.mkdirSync(path.join(home, '.jmarkdown'), { recursive: true });
	fs.writeFileSync(path.join(home, '.jmarkdown', 'config.json'), '{}');
	fs.writeFileSync(path.join(dir, 'Book.md'), '---\nbook: true\n---\n@title[The Book]\n@author[A. Reader]\n\nPreface.\n');
	fs.writeFileSync(path.join(dir, 'One.md'), '# One\n\n@title[A chapter\'s line]\n\nText.\n');
	const worker = fork(path.resolve('src/engine/export-worker.mjs'), [createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js')], {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	const tex = await new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') {
				worker.send({ type: 'build', file: 'Book.md', options: { to: 'latex', output: 'Book.tex', chapters: ['One.md'] },
					latexStyle: { locale: 'en-GB', platform: process.platform } });
			} else if (msg?.type === 'done') resolve(fs.readFileSync(path.join(dir, 'Book.tex'), 'utf8'));
			else if (msg?.type === 'error') reject(new Error(msg.message));
		});
		worker.on('error', reject);
	});
	assert.match(tex, /\\title\{The Book\}\n\\author\{A\. Reader\}\n\\date\{\}\n\\maketitle/);
	assert.match(tex, /\{\\noindent\\LARGE\\bfseries A chapter’s line\\par\}/);
	assert.match(tex, /\\hypersetup\{pdftitle=\{The Book\}\}/, 'the PDF\'s Title the master\'s, never a chapter\'s line');
});
