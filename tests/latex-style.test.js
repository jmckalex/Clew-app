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
import { latexStyleConfig } from '../src/engine/latex-style.js';

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

test('the paper and the hyphenation follow the region: Lang\'s, else the machine\'s', () => {
	assert.equal(style({}, { locale: 'en-US' })['Class options'], '12pt,letterpaper');
	assert.match(style({}, { locale: 'en-US' })['LaTeX preamble'].join('\n'), /variant=american/);
	assert.equal(style({ Lang: 'en-GB' }, { locale: 'en-US' })['Class options'], '12pt,a4paper');
	assert.match(style({ Lang: 'en' }, { locale: 'en-GB' })['LaTeX preamble'].join('\n'), /variant=british/);
	// Not English, or a language the user's config already sets: no polyglossia.
	for (const config of [{ Lang: 'de' }, { 'LaTeX preamble': ['\\usepackage[ngerman]{babel}'] }]) {
		const s = style(config);
		assert.equal(s.Packages.includes('polyglossia'), false, JSON.stringify(config));
		assert.doesNotMatch(s['LaTeX preamble'].join('\n'), /setdefaultlanguage/);
	}
});

test('packages and preamble are ADDED to the user\'s — the style\'s fonts after the user\'s own', () => {
	const s = style({ Packages: ['xcolor', 'microtype'], 'LaTeX preamble': ['\\usepackage{fontspec}', '\\setmainfont{Optima}'] });
	assert.deepEqual(s.Packages, ['xcolor', 'microtype', 'polyglossia', 'unicode-math', 'enumitem', 'titlesec', 'titling', 'etoolbox']);
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

// The real worker, engine and LuaLaTeX. Skipped on a machine without them.
const TEX_DIRS = ['/Library/TeX/texbin', '/usr/local/bin', '/opt/homebrew/bin'];
const tool = (name) => TEX_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
const haveTools = tool('latexmk') && tool('lualatex') && tool('pdffonts') && tool('kpsewhich');
const skip = haveTools ? false : 'latexmk, LuaLaTeX and pdffonts are not installed';
const PATH = `${TEX_DIRS.join(':')}:${process.env.PATH}`;
const run = (cmd, args, cwd) => new Promise((resolve) => {
	execFile(cmd, args, { cwd, env: { ...process.env, PATH }, timeout: 120000 }, (err, stdout, stderr) => resolve({ err, stdout, stderr }));
});

const NOTE = [
	'@title[Comments on “a Paper”]',
	'@author[A. Reader]',
	'@date[19 October 2026]',
	'',
	'# Introduction',
	'',
	'* I worry that this demands too much:',
	'    > "What are the success conditions for $M_1, \\dots, M_n$?"',
	'',
	'    Taken literally, it is too strong. 😆',
	'',
].join('\n');

/** The note exported to LaTeX by the real export worker, with `latexStyle` (or none). */
function exportTex(dir, latexStyle) {
	const home = path.join(dir, 'home');
	fs.mkdirSync(path.join(home, '.jmarkdown'), { recursive: true });
	// The user's own config sets another face, as the owner's sets Optima.
	fs.writeFileSync(path.join(home, '.jmarkdown', 'config.json'), JSON.stringify({
		'LaTeX preamble': ['\\usepackage{fontspec}', '\\setmainfont{texgyrepagella-regular.otf}'],
	}));
	fs.writeFileSync(path.join(dir, 'Note.md'), NOTE);
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
	assert.match(styled, /“What are the success conditions/, 'smart quotes');
	const plain = await exportTex(fs.mkdtempSync(path.join(root, 'plain-')), null);
	assert.match(plain, /^\\documentclass\{article\}/);
	assert.doesNotMatch(plain, /EBGaramond|titlesec|polyglossia/);
	assert.match(plain, /"What are the success conditions/);
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
