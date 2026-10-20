// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What every host makes of an export's engine run (src/engine/export-
// config.js), over a stand-in for the engine's configManager: get/set by
// dotted key, and a header merge that gives the merging object a NEW config
// of its own, as the engine's _mergeConfigs does — which is what makes a
// book's trial copy (Object.create(configManager), book.js#sameAsBook)
// distinct from the engine's own instance. The real worker, engine and
// LuaLaTeX run the same through tests/latex-style.test.js and
// tests/export-worker.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureExportBuild, exportEmbedPath, noteExportOptions } from '../src/engine/export-config.js';

// The engine's DEFAULT_CONFIG for the keys this touches (config-manager.js).
const DEFAULTS = {
	'Header style': 'bare', 'LaTeX engine': 'pdflatex', 'Class options': '', Geometry: '', 'Smart typography': false,
	'LaTeX maketitle': false, Packages: [], 'LaTeX preamble': [], Lang: 'en',
	Biblify: { bibliography: '', 'bibliography style': '', resolve: false },
};
const clone = (o) => JSON.parse(JSON.stringify(o));

function engineConfig(user = {}) {
	return {
		config: { ...clone(DEFAULTS), ...clone(user) },
		get(key) { return key.split('.').reduce((v, p) => v?.[p], this.config); },
		set(key, value) {
			const parts = key.split('.');
			let t = this.config;
			for (const p of parts.slice(0, -1)) t = t[p] ??= {};
			t[parts.at(-1)] = value;
		},
		// A header's keys as written, its values lists of lines.
		mergeMetadata(metadata) {
			const next = clone(this.config);
			for (const [key, lines] of Object.entries(metadata)) {
				const value = lines.length === 1 ? lines[0] : lines;
				next[key] = key === 'LaTeX maketitle' || key === 'Smart typography' ? String(value).trim() === 'true' : value;
			}
			this.config = next;
			return next;
		},
	};
}
const STYLE = { locale: 'en-GB', platform: 'darwin' };
const preamble = (cm) => [cm.get('LaTeX preamble')].flat().join('\n');

test('every export reads a header as reading view does: `---`-fenced only', () => {
	for (const to of ['html', 'latex']) {
		const cm = engineConfig();
		configureExportBuild(cm, { to, defaults: DEFAULTS });
		assert.equal(cm.get('Header style'), 'fenced', to);
	}
});

test('HTML: the vault\'s Biblify over the user\'s config, all but the file; LaTeX: none of it', () => {
	const biblify = { bibliography: '/v/refs.bib', resolve: true, 'bibliography style': 'house', template: { name: 'house', file: '/v/house.csl' } };
	const user = { Biblify: { bibliography: '/home/mine.bib', 'bibliography style': 'vancouver', resolve: false, 'add toc entry': true } };
	const html = engineConfig(user);
	configureExportBuild(html, { to: 'html', biblify, defaults: DEFAULTS });
	assert.deepEqual(html.get('Biblify'), { bibliography: '/home/mine.bib', 'bibliography style': 'house', resolve: true, 'add toc entry': true, template: { name: 'house', file: '/v/house.csl' } },
		'the file is processFile\'s `bibliography`, never this key');
	const latex = engineConfig(user);
	configureExportBuild(latex, { to: 'latex', biblify, defaults: DEFAULTS });
	assert.deepEqual(latex.get('Biblify'), user.Biblify);
	const none = engineConfig(user);
	configureExportBuild(none, { to: 'html', biblify: null, defaults: DEFAULTS });
	assert.deepEqual(none.get('Biblify'), user.Biblify, 'a vault naming no file');
});

test('LaTeX\'s own title, on for every LaTeX build — a header\'s `LaTeX maketitle: false` merged later wins', () => {
	const latex = engineConfig();
	configureExportBuild(latex, { to: 'latex', defaults: DEFAULTS });
	assert.equal(latex.get('LaTeX maketitle'), true);
	latex.mergeMetadata({ 'LaTeX maketitle': ['false'] });
	assert.equal(latex.get('LaTeX maketitle'), false);
	const styled = engineConfig();
	configureExportBuild(styled, { to: 'latex', latexStyle: STYLE, defaults: DEFAULTS });
	styled.mergeMetadata({ 'LaTeX maketitle': ['false'] });
	assert.equal(styled.get('LaTeX maketitle'), false, 'the style\'s re-decision leaves it alone');
	const html = engineConfig();
	configureExportBuild(html, { to: 'html', defaults: DEFAULTS });
	assert.equal(html.get('LaTeX maketitle'), false);
});

test('the style, decided before the build and again by the header: its pdflatex takes it away, its Lang chooses babel and paper', () => {
	const cm = engineConfig({ 'LaTeX preamble': ['\\usepackage{fontspec}', '\\setmainfont{Optima}'] });
	configureExportBuild(cm, { to: 'latex', latexStyle: STYLE, defaults: DEFAULTS });
	assert.equal(cm.get('LaTeX engine'), 'lualatex');
	assert.equal(cm.get('Class options'), '12pt,a4paper');
	assert.match(preamble(cm), /\\setmainfont\{Optima\}[\s\S]*\\usepackage\[british\]\{babel\}/, 'the style after the user\'s own');
	cm.mergeMetadata({ 'LaTeX engine': ['pdflatex'] });
	assert.equal(cm.get('LaTeX engine'), 'pdflatex');
	assert.equal(cm.get('Class options'), '', 'the user\'s again');
	assert.deepEqual(cm.get('LaTeX preamble'), ['\\usepackage{fontspec}', '\\setmainfont{Optima}']);

	const de = engineConfig();
	configureExportBuild(de, { to: 'latex', latexStyle: { locale: 'en-US', platform: 'darwin' }, defaults: DEFAULTS });
	assert.equal(de.get('Class options'), '12pt,letterpaper', 'before the header: the machine\'s region');
	de.mergeMetadata({ Lang: ['de-DE'] });
	assert.match(preamble(de), /\\usepackage\[ngerman\]\{babel\}/);
	assert.equal(de.get('Class options'), '12pt,a4paper', 'the header\'s language, its region\'s paper');
	const bare = engineConfig();
	configureExportBuild(bare, { to: 'latex', latexStyle: { locale: 'en-US', platform: 'darwin' }, defaults: DEFAULTS });
	bare.mergeMetadata({ Lang: ['de'] });
	assert.match(preamble(bare), /\[ngerman\]\{babel\}/);
	assert.equal(bare.get('Class options'), '12pt,letterpaper', 'a language naming no region: the machine\'s paper');
});

test('a book\'s trial copies never decide the style: only the engine\'s own configuration, and once', () => {
	const cm = engineConfig();
	configureExportBuild(cm, { to: 'latex', latexStyle: STYLE, defaults: DEFAULTS });
	// A chapter checked before the master's header (book.js merges into a copy).
	const early = Object.create(cm);
	early.mergeMetadata({ Lang: ['fr'] });
	assert.match(preamble(cm), /\[british\]\{babel\}/, 'a trial before the header decides nothing');
	cm.mergeMetadata({ Lang: ['de'] });
	assert.match(preamble(cm), /\[ngerman\]\{babel\}/, 'the master\'s header decides');
	const late = Object.create(cm);
	late.mergeMetadata({ 'Smart typography': ['true'] });
	assert.match(preamble(cm), /\[ngerman\]\{babel\}/, 'a chapter\'s key after it does not reset the language');
	cm.mergeMetadata({ Lang: ['fr'] });
	assert.match(preamble(cm), /\[ngerman\]\{babel\}/, 'once');
});

test('no style asked for: the style\'s keys are the user\'s', () => {
	const cm = engineConfig({ 'Class options': '11pt' });
	configureExportBuild(cm, { to: 'latex', latexStyle: null, defaults: DEFAULTS });
	assert.equal(cm.get('Class options'), '11pt');
	assert.equal(cm.get('LaTeX engine'), 'pdflatex');
	assert.deepEqual(cm.get('LaTeX preamble'), []);
	const html = engineConfig();
	configureExportBuild(html, { to: 'html', latexStyle: STYLE, defaults: DEFAULTS });
	assert.equal(html.get('LaTeX engine'), 'pdflatex', 'HTML never gets it');
});

test('an embed points from the file the export writes', () => {
	const abs = '/v/Attachments/x.png';
	assert.equal(exportEmbedPath({ abs, output: '/v/Note.html', to: 'html' }), 'Attachments/x.png');
	assert.equal(exportEmbedPath({ abs, output: '/v/out/Note.tex', to: 'latex' }), '../Attachments/x.png');
	assert.equal(exportEmbedPath({ abs, output: '/elsewhere/deep/Note.html', to: 'html' }), '../../v/Attachments/x.png');
	assert.equal(exportEmbedPath({ abs }), abs, 'no output: as resolved');
	// A book's: relative to the chapter it is written in, the engine rebasing it.
	const book = { abs, output: '/v/Books/build/B.tex', to: 'latex', chapters: ['Ch/One.md'] };
	assert.equal(exportEmbedPath({ ...book, file: '/v/Books/Ch/One.md' }), '../../Attachments/x.png');
	assert.equal(exportEmbedPath(book), abs, 'no chapter named');
});

test('LaTeX counts by realpath — a link\'s folder its target\'s — HTML by the paths given; a path not there yet as given', () => {
	const links = { '/var/folders/t': '/private/var/folders/t', '/link/v': '/real/v' };
	const realpath = (p) => {
		for (const [from, to] of Object.entries(links)) if (p === from || p.startsWith(`${from}/`)) return to + p.slice(from.length);
		return p;
	};
	const abs = '/v/Attachments/x.png';
	assert.equal(exportEmbedPath({ abs, output: '/var/folders/t/N.tex', to: 'latex', realpath }), '../../../../v/Attachments/x.png');
	assert.equal(exportEmbedPath({ abs, output: '/var/folders/t/N.html', to: 'html', realpath }), '../../../v/Attachments/x.png');
	assert.equal(exportEmbedPath({ abs: '/link/v/Attachments/x.png', output: '/real/v/out/N.tex', to: 'latex', realpath }), '../Attachments/x.png',
		'a vault reached through a link: no climb out to the link\'s path');
	const missing = () => { throw new Error('ENOENT'); };
	assert.equal(exportEmbedPath({ abs, output: '/v/out/N.tex', to: 'latex', realpath: missing }), '../Attachments/x.png');
});

test('a note\'s processFile options: the vault\'s syntax and bibliography, the figure cache and its copies, what draws them', () => {
	const base = { output: '/v/out/N.tex', vaultRoot: '/v', cacheDir: '/cache/v' };
	assert.deepEqual(noteExportOptions({ ...base, format: 'latex', vaultSettings: { bibliography: 'Library/refs.bib', normalSyntax: true }, figureEngine: { figureEngine: 'auto', mpTikzDist: '/m' } }), {
		to: 'latex', output: '/v/out/N.tex', normalSyntax: true, bibliography: ['/v/Library/refs.bib'], cacheDir: '/cache/v', copyFigures: true, figureEngine: 'auto', mpTikzDist: '/m',
	});
	assert.equal(noteExportOptions({ ...base, format: 'pdf' }).to, 'latex', 'a PDF via LaTeX is a LaTeX build');
	assert.equal(noteExportOptions({ ...base, format: 'html' }).to, 'html');
	assert.deepEqual(noteExportOptions({ ...base, format: 'html' }).bibliography, []);
	assert.equal(noteExportOptions({ ...base, format: 'html' }).normalSyntax, false);
	assert.deepEqual(noteExportOptions({ ...base, format: 'html', vaultSettings: { bibliography: ' /shared/refs.bib ' } }).bibliography, ['/shared/refs.bib']);
});
