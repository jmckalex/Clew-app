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
// the owner's ask via Clew-boss, 2026-10-22): from a log's lines as TeX
// writes them in nonstop mode, then through the real tools — the desktop's
// latexmk and the pinned mp-tikz-wasm's diagnostics (Clew-iOS's). Each
// skipped where the tool is absent.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { firstLatexHelp, pdfViaLatexFailure, BUILT_IN_TEX } from '../src/shared/latex-engine.js';
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

test('a log: the first error\'s help, its first paragraph', () => {
	assert.equal(firstLatexHelp(UNDEFINED), UNDEFINED_HELP);
	assert.equal(firstLatexHelp(ENVIRONMENT), 'Your command was ignored. Type I <command> <return> to replace it with another command, or <return> to continue without it.');
	assert.equal(firstLatexHelp(FONTSPEC), '', 'a LaTeX3 error writes no help after its context: its message says it');
	assert.equal(firstLatexHelp('! Emergency stop.\n<*> x.tex\n\n*** (job aborted, no legal \\end found)\n'), '', 'no l.N context: none');
	assert.equal(firstLatexHelp('all fine'), '');
	assert.equal(firstLatexHelp(`${UNDEFINED}\n${ENVIRONMENT}`), UNDEFINED_HELP, 'the FIRST error\'s');
	const missing = '! LaTeX Error: File `nosuchpackage.sty\' not found.\n\nType X to quit or <RETURN> to proceed,\nor enter new name. (Default extension: sty)\n\nEnter file name: \n! Emergency stop.\n<read *> \n   \nl.3 \\begin\n        {document}\n*** (cannot \\read from terminal in nonstop modes)\n';
	assert.equal(firstLatexHelp(missing), '', 'a context only the NEXT error has is not the first\'s: no help');
});

test('TeX\'s terminal boilerplate is left out; a long paragraph is cut at a word', () => {
	const boiler = '! Paragraph ended before \\x was complete.\n<to be read again>\nl.9 \n   \nTry typing  <return>  to proceed.\nIf that doesn\'t work, type  X <return>  to quit.\n\n';
	assert.equal(firstLatexHelp(boiler), '');
	const long = `! X.\nl.1 x\n  \n${'word '.repeat(100)}\n\n`;
	const help = firstLatexHelp(long);
	assert.ok(help.length <= 280 && help.endsWith('…') && !help.includes('wor…'), help);
});

test('mp-tikz-wasm\'s diagnostics: the first error\'s help', () => {
	const diagnostics = [
		{ severity: 'warning', source: 'tex', message: 'Overfull \\hbox', help: ['not this'] },
		{ severity: 'error', source: 'tex', message: 'Package fontspec Error: ', line: 4 },
		{ severity: 'error', source: 'tex', message: 'Undefined control sequence.', line: 5, help: UNDEFINED.split('\n').slice(3, 8) },
	];
	assert.equal(firstLatexHelp(diagnostics), UNDEFINED_HELP);
	assert.equal(firstLatexHelp([]), '');
});

test('the failure says the first error, then its help — the same words as before where there is none', () => {
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: UNDEFINED }),
		`PDF via LaTeX failed — LuaLaTeX ran (r). First error: ! Undefined control sequence. l.5 Text \\foo . — ${UNDEFINED_HELP}`);
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: FONTSPEC }),
		'PDF via LaTeX failed — LuaLaTeX ran (r). First error: ! Package fontspec Error: (fontspec) The font "NoSuchFont" cannot be found; (fontspec) this may be but usually is not a fontspec bug.', 'as before: no help to add');
	assert.equal(pdfViaLatexFailure({ engine: 'lualatex', reason: 'r', log: 'nothing', error: 'exit 12', diagnostics: [{ severity: 'error', help: ['A word of help.'] }] }),
		'PDF via LaTeX failed — LuaLaTeX ran (r). First error: exit 12 — A word of help.', 'a host\'s diagnostics, read first');
	assert.equal(pdfViaLatexFailure({ engine: 'pdflatex', reason: 'r', log: 'fine', error: 'spawn ENOENT' }), 'PDF via LaTeX failed — pdfLaTeX ran (r). First error: spawn ENOENT');
});

const DOC = '\\documentclass{article}\n\\begin{document}\nText \\foo.\n\\end{document}\n';
const MISSING = '\\documentclass{article}\n\\usepackage{nosuchpackagehere}\n\\begin{document}\nText.\n\\end{document}\n';

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
		assert.match(fatal, /First error: ! LaTeX Error: File `nosuchpackagehere\.sty' not found\./);
		assert.doesNotMatch(fatal, / — \*\*\*/);
	});
}

const assets = process.env.CLEW_MPTIKZ_DIR ?? path.join(repo, 'mptikz-assets');
test('the built-in TeX (the iPad): its diagnostics carry the same help', { skip: fs.existsSync(path.join(assets, 'index.js')) ? false : 'no mp-tikz-wasm build staged (npm run sync-mptikz)' }, async () => {
	const { MetaPost, DEFAULT_BUNDLES } = await import(pathToFileURL(path.join(assets, 'index.js')).href);
	const mp = await MetaPost.create({ bundles: [...DEFAULT_BUNDLES, ...BUILT_IN_TEX.bundles] });
	try {
		const r = await mp.latex(DOC, { engine: 'lualatex', output: 'pdf', date: BUILT_IN_TEX.date });
		assert.equal(firstLatexHelp(r.diagnostics), UNDEFINED_HELP);
	} finally {
		mp.dispose();
	}
});
