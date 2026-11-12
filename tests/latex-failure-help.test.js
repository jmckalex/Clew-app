// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// A failed PDF via LaTeX says its first error's help — the first paragraph,
// TeX's terminal boilerplate left out (shared/latex-engine.js#firstLatexHelp,
// the owner's ask via Clew-boss, 2026-10-22) — and since 2026-11-06 none of
// TeX's terminal instructions in the help or the first error, a package's
// `(name)` lines joined (#firstLatexError): from a log's lines as TeX writes
// them in nonstop mode, then through the real tools — the desktop's latexmk
// and the pinned mp-tikz-wasm's log and diagnostics (Clew-iOS's). Each
// skipped where the tool is absent. Since 2026-11-12 a log's lines are TeX's
// (unwrapLog): a first error or a help line TeX broke at 79 bytes is read
// whole, from the log's bytes where a host has them.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { firstLatexError, firstLatexHelp, pdfViaLatexFailure, BUILT_IN_TEX } from '../src/shared/latex-engine.js';
import { latexmkCommand } from '../src/main/latex-engine.js';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-failure-help-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const UNDEFINED_HELP = "The control sequence at the end of the top line of your error message was never \\def'ed. If you have misspelled it (e.g., `\\hobx'), type `I' and the correct spelling (e.g., `I\\hbox'). Otherwise just continue, and I'll forget about whatever was undefined.";

// As LuaLaTeX writes them (TeX Live 2025, nonstop mode).
const UNDEFINED = [
	'! Undefined control sequence.',
	'l.5 Text \\foo',
	'           .',
	'The control sequence at the end of the top line',
	"of your error message was never \\def'ed. If you have",
	"misspelled it (e.g., `\\hobx'), type `I' and the correct",
	"spelling (e.g., `I\\hbox'). Otherwise just continue,",
	"and I'll forget about whatever was undefined.",
	'',
	'',
].join('\n');
const ENVIRONMENT = [
	'! LaTeX Error: Environment nosuchenv undefined.',
	'',
	'See the LaTeX manual or LaTeX Companion for explanation.',
	'Type  H <return>  for immediate help.',
	' ...                                              ',
	'                                                  ',
	'l.6 \\begin{nosuchenv}',
	'                   x\\end{nosuchenv}',
	'Your command was ignored.',
	'Type  I <command> <return>  to replace it with another command,',
	'or  <return>  to continue without it.',
	'',
].join('\n');
const FONTSPEC = [
	'! Package fontspec Error: ',
	'(fontspec)                The font "NoSuchFont" cannot be found;',
	'(fontspec)                this may be but usually is not a fontspec bug.',
	'',
	'For immediate help type H <return>.',
	' ...                                              ',
	'                                                  ',
	'l.4 \\begin',
	'        {document}',
	'',
].join('\n');
// The first errors that carried TeX's terminal instructions (Clew-boss and
// Clew-docs, 2026-11-06), as the desktop's latexmk wrote them (TeX Live
// 2025): pdfLaTeX loading fontspec, LuaLaTeX a family it cannot find, and a
// package that is not there.
const FATAL_FONTSPEC = [
	'! Fatal Package fontspec Error: The fontspec package requires either XeTeX or',
	'(fontspec)                      LuaTeX.',
	'(fontspec)                      ',
	'(fontspec)                      You must change your typesetting engine to,',
	'(fontspec)                      e.g., "xelatex" or "lualatex" instead of',
	'(fontspec)                      "latex" or "pdflatex".',
	'',
	'Type <return> to continue.',
	' ...                                              ',
	'                                                  ',
	'l.101 \\msg_fatal:nn {fontspec} {cannot-use-pdftex}',
	'                                                  ',
	'',
	'LaTeX does not know anything more about this error, sorry.',
	'',
	'Try typing <return> to proceed.',
	'If that doesn\'t work, type X <return> to quit.',
	'',
	'This is a fatal error: LaTeX will abort.',
	'',
].join('\n');
const MISSING_FONT = [
	'! Package fontspec Error: ',
	'(fontspec)                The font "NoSuchFamilyXyz" cannot be found; this',
	'(fontspec)                may be but usually is not a fontspec bug. Either',
	'(fontspec)                there is a typo in the font name/file, the font is',
	'(fontspec)                not installed (correctly), or there is a bug in',
	'(fontspec)                the underlying font loading engine',
	'(fontspec)                (XeTeX/luaotfload).',
	'',
	'For immediate help type H <return>.',
	' ...                                              ',
	'                                                  ',
	'l.4 \\begin',
	'        {document}',
	'',
	'A font might not be found for many reasons.',
	' Check the spelling, where the font is installed etc. etc.',
	'',
	' When in doubt, ask someone for help!',
	'',
].join('\n');
const MISSING_STY = [
	'! LaTeX Error: File `nosuchpackagexyz.sty\' not found.',
	'',
	'Type X to quit or <RETURN> to proceed,',
	'or enter new name. (Default extension: sty)',
	'',
	'Enter file name: ',
	'! Emergency stop.',
	'<read *> ',
	'   ',
	'l.3 \\begin',
	'        {document}\r',
].join('\n');

// LuaLaTeX's, as latexmk wrote them: a primitive \input of a file that is not
// there (TeX's prompt, then the next error at once); LaTeX's own instruction
// sharing a line with its prose; a LaTeX2e \PackageError, whose help is
// instructions alone.
const PRIMITIVE_INPUT = [
	'! I can\'t find file `nosuchfilexyz\'.',
	'l.3 \\input nosuchfilexyz',
	'                      ',
	'(Press Enter to retry, or Control-D to exit)',
	'Please type another input file name',
	'! Emergency stop.',
	'l.3 \\input nosuchfilexyz',
	'                      ',
	'*** (job aborted, file error in nonstop mode)',
	'',
].join('\n');
const MISSING_BEGIN = [
	'! LaTeX Error: Missing \\begin{document}.',
	'',
	'See the LaTeX manual or LaTeX Companion for explanation.',
	'Type  H <return>  for immediate help.',
	' ...                                              ',
	'                                                  ',
	'l.2 T',
	'   ext.',
	'You\'re in trouble here.  Try typing  <return>  to proceed.',
	'If that doesn\'t work, type  X <return>  to quit.',
	'',
].join('\n');
const XCOLOR = [
	'! Package xcolor Error: Undefined color `nosuchcolourxyz\'.',
	'',
	'See the xcolor package documentation for explanation.',
	'Type  H <return>  for immediate help.',
	' ...                                              ',
	'                                                  ',
	'l.4 \\textcolor{nosuchcolourxyz}{Text.}',
	'                                    ',
	'Try typing  <return>  to proceed.',
	'If that doesn\'t work, type  X <return>  to quit.',
	'',
].join('\n');

test('a log: the first error\'s help, its first paragraph', () => {
	assert.equal(firstLatexHelp(PRIMITIVE_INPUT), '', 'TeX\'s prompt is no help, and the next error\'s lines are not this one\'s');
	assert.equal(firstLatexHelp(MISSING_BEGIN), 'You\'re in trouble here.', 'an instruction sharing a line with prose: the prose stays');
	assert.equal(firstLatexError(PRIMITIVE_INPUT), '! I can\'t find file `nosuchfilexyz\'. l.3 \\input nosuchfilexyz');
	assert.equal(firstLatexError(MISSING_BEGIN), '! LaTeX Error: Missing \\begin{document}.');
	assert.equal(firstLatexHelp(XCOLOR), '', 'a \\PackageError whose help is instructions alone: none');
	assert.equal(firstLatexError(XCOLOR), '! Package xcolor Error: Undefined color `nosuchcolourxyz\'.');
	assert.equal(firstLatexHelp(UNDEFINED), UNDEFINED_HELP);
	assert.equal(firstLatexHelp(ENVIRONMENT), 'Your command was ignored.', 'how to answer at a terminal is left out');
	assert.equal(firstLatexHelp(FONTSPEC), '', 'a LaTeX3 error with nothing after the blank line: none');
	assert.equal(firstLatexHelp('! Emergency stop.\n<*> x.tex\n\n*** (job aborted, no legal \\end found)\n'), '', 'no l.N context: none');
	assert.equal(firstLatexHelp('all fine'), '');
	assert.equal(firstLatexHelp(`${UNDEFINED}\n${ENVIRONMENT}`), UNDEFINED_HELP, 'the FIRST error\'s');
	const missing = '! LaTeX Error: File `nosuchpackage.sty\' not found.\n\nType X to quit or <RETURN> to proceed,\nor enter new name. (Default extension: sty)\n\nEnter file name: \n! Emergency stop.\n<read *> \n   \nl.3 \\begin\n        {document}\n*** (cannot \\read from terminal in nonstop modes)\n';
	assert.equal(firstLatexHelp(missing), '', 'a context only the NEXT error has is not the first\'s: no help');
});

test('the first error: its message whole over its (name) lines, without the marker, and TeX\'s terminal instructions left out', () => {
	assert.equal(firstLatexError(MISSING_STY), '! LaTeX Error: File `nosuchpackagexyz.sty\' not found.');
	assert.equal(firstLatexError(FATAL_FONTSPEC), '! Fatal Package fontspec Error: The fontspec package requires either XeTeX or LuaTeX. You must change your typesetting engine to, e.g., "xelatex" or "lualatex" instead of "latex" or "pdflatex".');
	assert.equal(firstLatexError(MISSING_FONT), '! Package fontspec Error: The font "NoSuchFamilyXyz" cannot be found; this may be but usually is not a fontspec bug. Either there is a typo in the font name/file, the font is not installed (correctly), or there is a bug in the underlying font loading engine (XeTeX/luaotfload).');
	assert.equal(firstLatexError(ENVIRONMENT), '! LaTeX Error: Environment nosuchenv undefined.');
	assert.equal(firstLatexError(UNDEFINED), '! Undefined control sequence. l.5 Text \\foo .', 'the lines after it, as before');
	assert.equal(firstLatexError('! Package one Error: a\n(two) b\n'), '! Package one Error: a (two) b', 'only its own name marks its lines');
});

test('TeX\'s terminal boilerplate is left out; a long paragraph is cut at a word', () => {
	const boiler = '! Paragraph ended before \\x was complete.\n<to be read again>\nl.9 \n   \nTry typing  <return>  to proceed.\nIf that doesn\'t work, type  X <return>  to quit.\n\n';
	assert.equal(firstLatexHelp(boiler), '');
	const long = `! X.\nl.1 x\n  \n${'word '.repeat(100)}\n\n`;
	const help = firstLatexHelp(long);
	assert.ok(help.length <= 280 && help.endsWith('…') && !help.includes('wor…'), help);
});

test('mp-tikz-wasm\'s diagnostics: the first error\'s help, or none — never a later error\'s', () => {
	const undefinedError = { severity: 'error', source: 'tex', message: 'Undefined control sequence.', line: 5, help: UNDEFINED.split('\n').slice(3, 8) };
	assert.equal(firstLatexHelp([{ severity: 'warning', source: 'tex', message: 'Overfull \\hbox', help: ['not this'] }, undefinedError]), UNDEFINED_HELP, 'a warning\'s is not an error\'s');
	assert.equal(firstLatexHelp([{ severity: 'error', source: 'tex', message: 'Package fontspec Error: ', line: 4 }, undefinedError]), '', 'the first has none');
	// The pinned 0.5.1 under a missing package: the first error has none, the
	// Emergency stop's is TeX's notice that it cannot ask.
	assert.equal(firstLatexHelp([
		{ severity: 'error', source: 'tex', message: 'LaTeX Error: File `nosuchpackagexyz.sty\' not found.' },
		{ severity: 'error', source: 'tex', message: 'Emergency stop.', line: 3, help: ['*** (cannot \\read from terminal in nonstop modes)'] },
	]), '');
	assert.equal(firstLatexHelp([]), '');
});

test('the failure says the first error, then its help — the same words as before where there is none', () => {
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: UNDEFINED }),
		`PDF via LaTeX failed — LuaLaTeX ran (r). First error: ! Undefined control sequence. l.5 Text \\foo . — ${UNDEFINED_HELP}`);
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: FONTSPEC }),
		'PDF via LaTeX failed — LuaLaTeX ran (r). First error: ! Package fontspec Error: The font "NoSuchFont" cannot be found; this may be but usually is not a fontspec bug.', 'no help to add');
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: ENVIRONMENT }),
		'PDF via LaTeX failed — LuaLaTeX ran (r). First error: ! LaTeX Error: Environment nosuchenv undefined. — Your command was ignored.');
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: 'nothing', error: 'exit 12', diagnostics: [{ severity: 'error', help: ['A word of help.'] }] }),
		'PDF via LaTeX failed — LuaLaTeX ran (r). First error: exit 12 — A word of help.', 'a host\'s diagnostics, read first');
	assert.equal(pdfViaLatexFailure({ engine: 'pdflatex', reason: 'r', log: 'fine', error: 'spawn ENOENT' }), 'PDF via LaTeX failed — pdfLaTeX ran (r). First error: spawn ENOENT');
});

const DOC = '\\documentclass{article}\n\\begin{document}\nText \\foo.\n\\end{document}\n';
const MISSING = '\\documentclass{article}\n\\usepackage{nosuchpackagehere}\n\\begin{document}\nText.\n\\end{document}\n';
const IN_BODY = '\\documentclass{article}\n\\begin{document}\n\\usepackage{amsmath}\nText.\n\\end{document}\n';
const INPUT_DOC = '\\documentclass{article}\n\\begin{document}\n\\input nosuchfilexyz\n\\end{document}\n';
const FONTSPEC_DOC = '\\documentclass{article}\n\\usepackage{fontspec}\n\\begin{document}\nText.\n\\end{document}\n';
// How a person at a terminal answers TeX, none of which a failure says.
const INSTRUCTIONS = /Type X|<RETURN>|enter new name|Type I|<command>|<return>|For immediate help/;

const TEX_DIRS = ['/Library/TeX/texbin', '/usr/local/bin', '/opt/homebrew/bin'];
const tool = (name) => TEX_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
const latexmk = tool('latexmk');
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

for (const engine of ['pdflatex', 'lualatex']) {
	test(`the desktop's latexmk and ${engine}: an undefined command's failure carries TeX's help`, { skip: latexmk && tool(engine) ? false : `latexmk and ${engine} are not installed` }, async () => {
		const dir = path.join(root, engine);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, 'Note.tex'), DOC);
		const { args, env } = latexmkCommand({ engine, texFile: 'Note.tex', env: process.env, isFile });
		await new Promise((resolve) => execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, resolve));
		const log = fs.readFileSync(path.join(dir, 'Note.log'), 'utf8');
		assert.match(pdfViaLatexFailure({ engine, reason: 'r', log }), / — The control sequence at the end of the top line of your error message was never \\def'ed\./);
		// A failure that stops the run — a missing package, no PDF — says its
		// error, and no help that is another error's.
		fs.writeFileSync(path.join(dir, 'Note.tex'), MISSING);
		await new Promise((resolve) => execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, resolve));
		const fatal = pdfViaLatexFailure({ engine, reason: 'r', log: fs.readFileSync(path.join(dir, 'Note.log'), 'utf8') });
		assert.match(fatal, /First error: ! LaTeX Error: File `nosuchpackagehere\.sty' not found\.$/);
		assert.doesNotMatch(fatal, / — \*\*\*/);
		assert.doesNotMatch(fatal, INSTRUCTIONS);
		// A package loaded in the body: LaTeX's error, its help without the
		// terminal's choices.
		fs.writeFileSync(path.join(dir, 'Note.tex'), IN_BODY);
		await new Promise((resolve) => execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, resolve));
		assert.equal(pdfViaLatexFailure({ engine, reason: 'r', log: fs.readFileSync(path.join(dir, 'Note.log'), 'utf8') }),
			`PDF via LaTeX failed — ${engine === 'pdflatex' ? 'pdfLaTeX' : 'LuaLaTeX'} ran (r). First error: ! LaTeX Error: Can be used only in preamble. — Your command was ignored.`);
		// A primitive \input of a missing file: no prompt, no Emergency stop.
		fs.writeFileSync(path.join(dir, 'Note.tex'), INPUT_DOC);
		await new Promise((resolve) => execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, resolve));
		assert.equal(pdfViaLatexFailure({ engine, reason: 'r', log: fs.readFileSync(path.join(dir, 'Note.log'), 'utf8') }),
			`PDF via LaTeX failed — ${engine === 'pdflatex' ? 'pdfLaTeX' : 'LuaLaTeX'} ran (r). First error: ! I can't find file \`nosuchfilexyz'. l.3 \\input nosuchfilexyz`);
		if (engine === 'pdflatex') {
			// fontspec under pdfLaTeX (a forced engine): its message whole, its
			// (fontspec) lines joined without the marker.
			fs.writeFileSync(path.join(dir, 'Note.tex'), FONTSPEC_DOC);
			await new Promise((resolve) => execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, resolve));
			const forced = pdfViaLatexFailure({ engine, reason: 'r', log: fs.readFileSync(path.join(dir, 'Note.log'), 'utf8') });
			assert.match(forced, /First error: ! Fatal Package fontspec Error: The fontspec package requires either XeTeX or LuaTeX\. You must change your typesetting engine to, e\.g\., "xelatex" or "lualatex" instead of "latex" or "pdflatex"\.$/);
			assert.doesNotMatch(forced, /\(fontspec\)/);
		}
	});
}

const assets = process.env.CLEW_MPTIKZ_DIR ?? path.join(repo, 'mptikz-assets');
// What Clew-iOS passes as the log: the .log's bytes where the build gives
// them, else the .log decoded (`texLog`) — never `log`, the terminal's.
const iPadLog = (r) => r.texLogBytes ?? r.texLog;
test('the built-in TeX (the iPad): its diagnostics carry the same help', { skip: fs.existsSync(path.join(assets, 'index.js')) ? false : 'no mp-tikz-wasm build staged (npm run sync-mptikz)' }, async () => {
	const { MetaPost, DEFAULT_BUNDLES } = await import(pathToFileURL(path.join(assets, 'index.js')).href);
	const mp = await MetaPost.create({ bundles: [...DEFAULT_BUNDLES, ...BUILT_IN_TEX.bundles] });
	try {
		const r = await mp.latex(DOC, { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
		assert.equal(firstLatexHelp(r.diagnostics), UNDEFINED_HELP);
		const inBody = await mp.latex(IN_BODY, { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
		assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: iPadLog(inBody), diagnostics: inBody.diagnostics }),
			'PDF via LaTeX failed — LuaLaTeX ran (r). First error: ! LaTeX Error: Can be used only in preamble. — Your command was ignored.', 'the iPad\'s words, as the Mac\'s');
	} finally {
		mp.dispose();
	}
});

// The iPad's whole message beside the Mac's (Clew-boss's probe, 2026-11-06):
// each document through the pinned build, and the log latexmk wrote for it.
// Under a missing package the iPad's said the Emergency stop's "*** (cannot
// \read from terminal in nonstop modes)" as help, a later error's.
const SIDE_BY_SIDE = [
	['a missing package', '\\documentclass{article}\n\\usepackage{nosuchpackagexyz}\n\\begin{document}\nText.\n\\end{document}\n', MISSING_STY,
		'First error: ! LaTeX Error: File `nosuchpackagexyz.sty\' not found.'],
	['no \\begin{document}', '\\documentclass{article}\nText.\n\\end{document}\n', MISSING_BEGIN,
		'First error: ! LaTeX Error: Missing \\begin{document}. — You\'re in trouble here.'],
	['a primitive \\input of a missing file', INPUT_DOC, PRIMITIVE_INPUT,
		'First error: ! I can\'t find file `nosuchfilexyz\'. l.3 \\input nosuchfilexyz'],
];
const FAMILY_DOC = '\\documentclass{article}\n\\usepackage{fontspec}\n\\setmainfont{NoSuchFamilyXyz}\n\\begin{document}\nText.\n\\end{document}\n';
const FAMILY_ERROR = 'First error: ! Package fontspec Error: The font "NoSuchFamilyXyz" cannot be found; this may be but usually is not a fontspec bug. Either there is a typo in the font name/file, the font is not installed (correctly), or there is a bug in the underlying font loading engine (XeTeX/luaotfload).';
const FAMILY_HELP = 'A font might not be found for many reasons. Check the spelling, where the font is installed etc. etc.';
const said = (o) => pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', ...o }).replace('PDF via LaTeX failed — LuaLaTeX ran (r). ', '');

test('the built-in TeX (the iPad) and the Mac\'s latexmk: the same whole message', { skip: fs.existsSync(path.join(assets, 'index.js')) ? false : 'no mp-tikz-wasm build staged (npm run sync-mptikz)' }, async () => {
	const { MetaPost, DEFAULT_BUNDLES } = await import(pathToFileURL(path.join(assets, 'index.js')).href);
	const mp = await MetaPost.create({ bundles: [...DEFAULT_BUNDLES, ...BUILT_IN_TEX.bundles] });
	try {
		for (const [what, doc, macLog, words] of SIDE_BY_SIDE) {
			const r = await mp.latex(doc, { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
			assert.equal(said({ log: iPadLog(r), diagnostics: r.diagnostics }), words, `${what}: the iPad`);
			assert.equal(said({ log: macLog }), words, `${what}: the Mac`);
		}
		// fontspec's help (a LaTeX3 error's): the iPad's from its diagnostics,
		// the Mac's from its log, after the blank line LaTeX3 writes first.
		const r = await mp.latex(FAMILY_DOC, { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
		assert.equal(said({ log: iPadLog(r), diagnostics: r.diagnostics }), `${FAMILY_ERROR} — ${FAMILY_HELP}`, 'a missing family: the iPad');
		assert.equal(said({ log: MISSING_FONT }), `${FAMILY_ERROR} — ${FAMILY_HELP}`, 'a missing family: the Mac');
	} finally {
		mp.dispose();
	}
});

// LaTeX3's own errors (\msg_error), as latexmk wrote them under LuaLaTeX: an
// unknown key (l3keys, the kernel's "! LaTeX Error:") and a package's.
const SIUNITX_KEY = [
	'! LaTeX Error: The key \'siunitx/nosuchkeyxyz\' is unknown and is being ignored.',
	'',
	'For immediate help type H <return>.',
	' ...                                              ',
	'                                                  ',
	'l.3 \\sisetup{nosuchkeyxyz=1}',
	'                          ',
	'',
	'The module \'siunitx\' does not have a key called \'siunitx/nosuchkeyxyz\'.',
	'Check that you have spelled the key name correctly.',
	'',
].join('\n');
const SIUNITX_NUMBER = [
	'! Package siunitx Error: Invalid number \'1x2\'.',
	'',
	'For immediate help type H <return>.',
	' ...                                              ',
	'                                                  ',
	'l.4 \\num{1x2}',
	'           ',
	'',
	'The input \'1x2\' could not be parsed as a number following the format defined',
	'in module documentation.',
	'',
].join('\n');

test('a LaTeX3 error\'s help, after the blank line it writes under its context (the owner\'s "TeX\'s own help where TeX gives one")', () => {
	assert.equal(firstLatexHelp(MISSING_FONT), FAMILY_HELP, 'fontspec\'s: its first paragraph');
	assert.equal(firstLatexHelp(SIUNITX_KEY), 'The module \'siunitx\' does not have a key called \'siunitx/nosuchkeyxyz\'. Check that you have spelled the key name correctly.');
	assert.equal(firstLatexHelp(SIUNITX_NUMBER), 'The input \'1x2\' could not be parsed as a number following the format defined in module documentation.');
	// A fatal one has only LaTeX3's "LaTeX does not know anything more about
	// this error, sorry." there (the iPad's TeX not even that): none.
	assert.equal(firstLatexHelp(FATAL_FONTSPEC), '');
	// Nothing else reads past a blank line: every LaTeX2e and primitive error
	// says what it said before.
	for (const [log, help] of [[UNDEFINED, UNDEFINED_HELP], [ENVIRONMENT, 'Your command was ignored.'], [MISSING_BEGIN, 'You\'re in trouble here.'], [XCOLOR, ''], [PRIMITIVE_INPUT, ''], [MISSING_STY, '']]) {
		assert.equal(firstLatexHelp(log), help, log.split('\n')[0]);
	}
});

const SIUNITX_DOC = '\\documentclass{article}\n\\usepackage{siunitx}\n\\sisetup{nosuchkeyxyz=1}\n\\begin{document}\nText.\n\\end{document}\n';
for (const engine of ['pdflatex', 'lualatex']) {
	test(`the desktop's latexmk and ${engine}: a LaTeX3 error's failure carries its help`, { skip: latexmk && tool(engine) ? false : `latexmk and ${engine} are not installed` }, async () => {
		const dir = path.join(root, `latex3-${engine}`);
		fs.mkdirSync(dir, { recursive: true });
		const { args, env } = latexmkCommand({ engine, texFile: 'Note.tex', env: process.env, isFile });
		const run = async (tex) => {
			fs.writeFileSync(path.join(dir, 'Note.tex'), tex);
			await new Promise((resolve) => execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, resolve));
			return pdfViaLatexFailure({ engine, reason: 'r', log: fs.readFileSync(path.join(dir, 'Note.log'), 'utf8') });
		};
		assert.match(await run(SIUNITX_DOC), / — The module 'siunitx' does not have a key called 'siunitx\/nosuchkeyxyz'\. Check that you have spelled the key name correctly\.$/);
		if (engine === 'lualatex') assert.ok((await run(FAMILY_DOC)).endsWith(`${FAMILY_ERROR} — ${FAMILY_HELP}`), 'a missing family: as the iPad says it');
	});
}

// TeX breaks a log's lines at 79 bytes (80 for LuaTeX's C-level messages),
// and until 2026-11-12 the first error and its help were read across that
// break with a space in it — "…/Devices/90 DCB612-…" for a simulator
// container's path on the iPad (Clew-iOS's catch, reproduced by Clew-boss
// with pdfLaTeX). As latexmk wrote them (TeX Live 2025, an empty HOME).
const enc = (s) => new TextEncoder().encode(s);
const bytes = (...parts) => {
	const all = parts.map((p) => (typeof p === 'string' ? enc(p) : Uint8Array.from(p)));
	const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
	all.reduce((at, p) => { out.set(p, at); return at + p.length; }, 0);
	return out;
};
const LONG_PATH = '/Users/somebody/Library/Developer/CoreSimulator/Devices/90DCB612-1B85-4C2E-9F11-0123456789AB/data/Containers/secret.tex';
const longPathLog = (engine) => [
	'! LaTeX Error: File `/Users/somebody/Library/Developer/CoreSimulator/Devices/90',
	'DCB612-1B85-4C2E-9F11-0123456789AB/data/Containers/secret.tex\' not found.',
	'',
	'Type X to quit or <RETURN> to proceed,',
	'or enter new name. (Default extension: tex)',
	'',
	'Enter file name: ',
	'! Emergency stop.',
	'<read *> ',
	engine === 'pdflatex' ? '         ' : '   ',
	engine === 'pdflatex' ? 'l.3 ...11-0123456789AB/data/Containers/secret.tex}' : 'l.3 ...9F11-0123456789AB/data/Containers/secret.tex}',
	`${' '.repeat(50)}${engine === 'pdflatex' ? '^^M' : '\r'}`,
	'*** (cannot \\read from terminal in nonstop modes)',
	'',
].join('\n');
// The é a 79th byte: pdfTeX breaks after exactly 79, its two bytes either
// side of the break; LuaTeX moves it whole to the next line.
const ACCENT_PATH = '/Users/somebody/Library/Developer/CoreSimulator/Devices/9é0DCB612-1B85/data/secret.tex';
const ACCENT_HEAD = '! LaTeX Error: File `/Users/somebody/Library/Developer/CoreSimulator/Devices/9';
const ACCENT_TAIL = '0DCB612-1B85/data/secret.tex\' not found.\n\nType X to quit or <RETURN> to proceed,\n';
const accentLog = (engine) => (engine === 'pdflatex'
	? bytes(ACCENT_HEAD, [0xc3, 0x0a, 0xa9], ACCENT_TAIL)
	: bytes(ACCENT_HEAD, '\né', ACCENT_TAIL));
// A \PackageError whose help is one long line (both engines alike).
const LONG_HELP = [
	'! Package sample Error: Something went wrong.',
	'',
	'See the sample package documentation for explanation.',
	'Type  H <return>  for immediate help.',
	' ...                                              ',
	'                                                  ',
	'l.3 ... and TeX breaks it where the line is full.}',
	'                                                  ',
	'The explanation of what went wrong is one long sentence, and TeX breaks it wher',
	'e the line is full.',
	'',
].join('\n');
// LuaTeX's own message for a font it could not load, broken after 80 bytes.
const FONT_80 = [
	'! Font \\TU/lmr/m/n/10=[lmroman10-regular]:+tlig; at 10pt not loadable: metric da',
	'ta not found or bad.',
	'<to be read again> ',
	'                   relax ',
	'l.54 \\normalsize',
	'                ',
	'I wasn\'t able to read the size data for this font,',
	'so I will ignore the font specification.',
	'[Wizards can fix TFM files using TFtoPL/PLtoTF.]',
	'You might try inserting a different font spec;',
	'e.g., type `I\\font<same font id>=<substitute font name>\'.',
	'',
].join('\n');

const LONG_PATH_ERROR = `! LaTeX Error: File \`${LONG_PATH}' not found.`;
const ENGINE_NAMES = { pdflatex: 'pdfLaTeX', lualatex: 'LuaLaTeX' };

test('a first error past TeX\'s 79 bytes is read whole: a long path, under each engine, as bytes or text', () => {
	for (const engine of ['pdflatex', 'lualatex']) {
		const log = longPathLog(engine);
		assert.equal(firstLatexError(log), LONG_PATH_ERROR, `${engine}, text`);
		assert.equal(firstLatexError(enc(log)), LONG_PATH_ERROR, `${engine}, bytes`);
		assert.equal(firstLatexHelp(enc(log)), '', `${engine}: the Emergency stop's context is not the first error's`);
		assert.equal(pdfViaLatexFailure({ engine, reason: 'r', log: enc(log) }),
			`PDF via LaTeX failed — ${ENGINE_NAMES[engine]} ran (r). First error: ${LONG_PATH_ERROR}`);
	}
	assert.equal(firstLatexError(FONT_80), '! Font \\TU/lmr/m/n/10=[lmroman10-regular]:+tlig; at 10pt not loadable: metric data not found or bad. <to be read again> relax',
		'LuaTeX\'s C-level message, broken after 80: whole, and its context the two lines after it');
});

test('a letter pdfTeX cut in two at the break is whole from the log\'s bytes', () => {
	assert.equal(enc(ACCENT_HEAD).length, 78, 'the é\'s bytes are the 79th and 80th');
	const want = `! LaTeX Error: File \`${ACCENT_PATH}' not found.`;
	assert.equal(firstLatexError(accentLog('pdflatex')), want, 'pdfTeX\'s bytes');
	assert.equal(firstLatexError(accentLog('lualatex')), want, 'LuaTeX\'s bytes');
	assert.equal(firstLatexError(new TextDecoder().decode(accentLog('lualatex'))), want, 'LuaTeX\'s text: it moved the letter whole');
	// Decoded first, pdfTeX's halves are two U+FFFD: why a host passes bytes.
	assert.doesNotMatch(firstLatexError(new TextDecoder().decode(accentLog('pdflatex'))), /9é0/);
});

test('a help line past TeX\'s 79 bytes is read whole', () => {
	const help = 'The explanation of what went wrong is one long sentence, and TeX breaks it where the line is full.';
	assert.equal(firstLatexHelp(LONG_HELP), help);
	assert.equal(firstLatexHelp(enc(LONG_HELP)), help);
	assert.equal(firstLatexError(LONG_HELP), '! Package sample Error: Something went wrong.');
	assert.equal(firstLatexHelp(FONT_80), 'I wasn\'t able to read the size data for this font, so I will ignore the font specification. [Wizards can fix TFM files using TFtoPL/PLtoTF.] You might try inserting a different font spec; e.g., type `I\\font<same font id>=<substitute font name>\'.');
});

// What is NOT a broken line, though 79 bytes long (TeX starts each of these
// with print_nl, which starts no line after one that ended at the width): an
// error after a line that filled it, and a context's second line, which
// show_context holds to error_line, 79 — in a long source line it is 79
// bytes ending "...", and the help follows at once. As pdfLaTeX wrote them;
// LuaLaTeX's the same in kind (the real tools below).
const AFTER_FULL_LINE = [
	'x'.repeat(79),
	'! Undefined control sequence.',
	'l.3 ...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx}\\foo',
	' '.repeat(50),
	...UNDEFINED.split('\n').slice(3),
].join('\n');
const LONG_SOURCE_LINE = [
	'! Undefined control sequence.',
	'l.3 Text \\foo',
	'              and then a good deal more text that runs on past the end of th...',
	...UNDEFINED.split('\n').slice(3),
].join('\n');
// The document on TeX's command line: the base context is the terminal's
// `<*>`, and the help follows ITS second line.
const TERMINAL_CONTEXT = [
	'! Undefined control sequence.',
	'<*> \\documentclass{article}\\begin{document}\\foo',
	'                                               \\ and then a good deal more t...',
	...UNDEFINED.split('\n').slice(3),
].join('\n');

test('a line that only filled TeX\'s width is not joined: an error after it, a context\'s second line', () => {
	assert.equal(AFTER_FULL_LINE.split('\n')[0].length, 79);
	assert.equal(firstLatexError(AFTER_FULL_LINE), '! Undefined control sequence. l.3 ...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx}\\foo');
	assert.equal(firstLatexHelp(AFTER_FULL_LINE), UNDEFINED_HELP);
	assert.equal(LONG_SOURCE_LINE.split('\n')[2].length, 79);
	assert.equal(firstLatexError(LONG_SOURCE_LINE), '! Undefined control sequence. l.3 Text \\foo and then a good deal more text that runs on past the end of th...');
	assert.equal(firstLatexHelp(LONG_SOURCE_LINE), UNDEFINED_HELP);
	assert.equal(TERMINAL_CONTEXT.split('\n')[2].length, 79);
	assert.equal(firstLatexError(TERMINAL_CONTEXT), '! Undefined control sequence. <*> \\documentclass{article}\\begin{document}\\foo \\ and then a good deal more t...');
	// The package messages and their (name) lines, as bytes: as before.
	assert.equal(firstLatexError(enc(MISSING_FONT)), firstLatexError(MISSING_FONT));
	assert.equal(firstLatexError(enc(FATAL_FONTSPEC)), firstLatexError(FATAL_FONTSPEC));
	assert.equal(firstLatexHelp(enc(MISSING_FONT)), FAMILY_HELP);
});

const LONG_PATH_DOC = `\\documentclass{article}\n\\begin{document}\n\\input{${LONG_PATH}}\n\\end{document}\n`;
const ACCENT_DOC = `\\documentclass{article}\n\\begin{document}\n\\input{${ACCENT_PATH}}\n\\end{document}\n`;
const LONG_LINE_DOC = '\\documentclass{article}\n\\begin{document}\nText \\foo and then a good deal more text that runs on past the end of the context window, as a paragraph does.\n\\end{document}\n';
const AFTER_FULL_DOC = `\\documentclass{article}\n\\begin{document}\n\\message{${'x'.repeat(79)}}\\foo\nText.\n\\end{document}\n`;
const LONG_HELP_DOC = '\\documentclass{article}\n\\makeatletter\n\\PackageError{sample}{Something went wrong}{The explanation of what went wrong is one long sentence, and TeX breaks it where the line is full.}\n\\makeatother\n\\begin{document}\nText.\n\\end{document}\n';
for (const engine of ['pdflatex', 'lualatex']) {
	test(`the desktop's latexmk and ${engine}: a first error and a help line past 79 bytes, read whole from the log's bytes`, { skip: latexmk && tool(engine) ? false : `latexmk and ${engine} are not installed` }, async () => {
		const dir = path.join(root, `wrap-${engine}`);
		fs.mkdirSync(dir, { recursive: true });
		const { args, env } = latexmkCommand({ engine, texFile: 'Note.tex', env: process.env, isFile });
		const run = async (tex) => {
			fs.writeFileSync(path.join(dir, 'Note.tex'), tex);
			await new Promise((resolve) => execFile(latexmk, args, { cwd: dir, timeout: 120000, env: { ...process.env, ...env, PATH: `${TEX_DIRS.join(':')}:${process.env.PATH}` } }, resolve));
			// As export.js#compilePdf reads it.
			return fs.readFileSync(path.join(dir, 'Note.log'));
		};
		const prefix = `PDF via LaTeX failed — ${ENGINE_NAMES[engine]} ran (r). First error: `;
		assert.equal(pdfViaLatexFailure({ engine, reason: 'r', log: await run(LONG_PATH_DOC) }), `${prefix}${LONG_PATH_ERROR}`);
		const accent = await run(ACCENT_DOC);
		assert.ok(accent.includes(engine === 'pdflatex' ? Uint8Array.from([0xc3, 0x0a, 0xa9]) : enc('/9\né0')), 'TeX broke the line at the letter, as the fixture has it');
		assert.equal(pdfViaLatexFailure({ engine, reason: 'r', log: accent }), `${prefix}! LaTeX Error: File \`${ACCENT_PATH}' not found.`);
		const longLine = await run(LONG_LINE_DOC);
		assert.match(pdfViaLatexFailure({ engine, reason: 'r', log: longLine }), /^PDF via LaTeX failed — \S+ ran \(r\)\. First error: ! Undefined control sequence\. l\.3 Text \\foo and then a good deal more text that runs on past the end of (?:the |th)\.\.\. — The control sequence at the end of the top line of your error message was never \\def'ed\./);
		assert.ok(pdfViaLatexFailure({ engine, reason: 'r', log: await run(LONG_HELP_DOC) }).endsWith(' — The explanation of what went wrong is one long sentence, and TeX breaks it where the line is full.'));
		const afterFull = await run(AFTER_FULL_DOC);
		assert.ok(afterFull.includes(enc(`${'x'.repeat(79)}\n! Undefined control sequence.`)), 'the error at once after a line that filled the width');
		assert.match(pdfViaLatexFailure({ engine, reason: 'r', log: afterFull }), /First error: ! Undefined control sequence\. l\.3 \.\.\.x+\}\\foo — The control sequence at the end of the top line/);
	});
}

test('the built-in TeX (the iPad): a long path and a letter at the break, whole from texLogBytes, as the Mac says them', { skip: fs.existsSync(path.join(assets, 'index.js')) ? false : 'no mp-tikz-wasm build staged (npm run sync-mptikz)' }, async () => {
	const { MetaPost, DEFAULT_BUNDLES } = await import(pathToFileURL(path.join(assets, 'index.js')).href);
	const mp = await MetaPost.create({ bundles: [...DEFAULT_BUNDLES, ...BUILT_IN_TEX.bundles] });
	try {
		// pdfLaTeX is the build's engine 'latex' with a PDF out.
		for (const [engine, wasmEngine] of [['pdflatex', 'latex'], ['lualatex', 'lualatex']]) {
			const words = (r) => pdfViaLatexFailure({ engine, reason: 'r', log: iPadLog(r), diagnostics: r.diagnostics });
			const long = await mp.latex(LONG_PATH_DOC, { engine: wasmEngine, output: 'pdf', date: BUILT_IN_TEX.date });
			assert.equal(words(long), pdfViaLatexFailure({ engine, reason: 'r', log: enc(longPathLog(engine)) }), `${engine}: a long path, as the Mac's`);
			const accent = await mp.latex(ACCENT_DOC, { engine: wasmEngine, output: 'pdf', date: BUILT_IN_TEX.date });
			assert.ok(accent.texLogBytes, 'the pinned build gives the log\'s bytes');
			assert.equal(words(accent), pdfViaLatexFailure({ engine, reason: 'r', log: accentLog(engine) }), `${engine}: a letter at the break, as the Mac's`);
			assert.match(words(accent), /Devices\/9é0DCB612/);
		}
	} finally {
		mp.dispose();
	}
});
