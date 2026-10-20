// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// What an export reads as reading view does, through the real export worker
// (src/engine/export-worker.mjs) and engine, with a HOME of the test's own
// and no config: a header is a `---`-fenced block only — a first line
// `Note: remember this.` exported every note EMPTY (Clew-docs, 2026-10-20) —
// and an HTML export cites as reading view does: the vault's bibliography
// resolving, in the vault's style, over the user's config and under the
// note's header (citation-header.js#vaultBiblify, the object both are given).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { vaultBiblify } from '../src/main/citation-header.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-export-worker-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const BIB = '@book{lewis1969,\n  author = {Lewis, David},\n  title = {Convention},\n  year = {1969},\n  publisher = {Harvard University Press}\n}\n';

/** `files` written into a vault folder of their own, `file` built by the
 *  worker with `options`: the output's text. `vault` is its vault-settings
 *  (`bibliography`, `bibliographyStyle`), handed over as export.js hands
 *  them — the file as processFile's `bibliography`, the settings as
 *  vaultBiblify's object; `home` the user's ~/.jmarkdown config. */
function build(files, file, options, { vault = {}, home: homeConfig = {} } = {}) {
	const dir = fs.mkdtempSync(path.join(root, 'build-'));
	const home = path.join(dir, 'home');
	fs.mkdirSync(path.join(home, '.jmarkdown'), { recursive: true });
	fs.writeFileSync(path.join(home, '.jmarkdown', 'config.json'), JSON.stringify(homeConfig));
	for (const [name, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
		fs.writeFileSync(path.join(dir, name), text);
	}
	const biblify = vaultBiblify(vault, dir);
	const bibliography = biblify ? [biblify.bibliography] : [];
	const worker = fork(path.resolve('src/engine/export-worker.mjs'), [createRequire(import.meta.url).resolve('jmarkdown/src/watch-worker.js')], {
		cwd: dir, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		env: { ...process.env, HOME: home, CLEW_VAULT_ROOT: dir, CLEW_VAULT_RESTRICTED: '0' },
	});
	return new Promise((resolve, reject) => {
		worker.on('message', (msg) => {
			if (msg?.type === 'ready') worker.send({ type: 'build', file, options: { ...options, bibliography }, biblify });
			else if (msg?.type === 'done') resolve(fs.readFileSync(path.join(dir, options.output), 'utf8'));
			else if (msg?.type === 'error') reject(new Error(msg.message));
		});
		worker.on('error', reject);
	});
}
const body = (tex) => tex.slice(tex.indexOf('\\begin{document}'));
const VAULT = { bibliography: 'refs.bib' };

test('a first line `word: …` is the note\'s text, not a header — in HTML and LaTeX', async () => {
	const note = { 'Note.md': 'Note: remember this.\n\nA second paragraph.\n' };
	const html = await build(note, 'Note.md', { to: 'html', output: 'Note.html' });
	assert.match(html, /<p[^>]*>Note: remember this\.<\/p>/);
	assert.match(html, /<p[^>]*>A second paragraph\.<\/p>/);
	const tex = body(await build(note, 'Note.md', { to: 'latex', output: 'Note.tex' }));
	assert.match(tex, /Note: remember this\.\n\nA second paragraph\./);
	const url = body(await build({ 'Note.md': 'Visit https://example.com/one here.\n\nMore.\n' }, 'Note.md', { to: 'latex', output: 'Note.tex' }));
	assert.match(url, /example\.com\/one[\s\S]*More\./);
});

test('a `---`-fenced header is still the header', async () => {
	const tex = await build({ 'Note.md': '---\nTitle: Fenced Title\n---\nNote: remember this.\n\nA second paragraph.\n' }, 'Note.md', { to: 'latex', output: 'Note.tex' });
	assert.match(tex, /\\title\{Fenced Title\}/);
	assert.match(body(tex), /Note: remember this\.\n\nA second paragraph\./);
	assert.doesNotMatch(body(tex), /Title: Fenced Title/);
});

test('a book\'s chapter whose first line is `word: …` keeps it', async () => {
	const tex = await build({
		'Book.md': '---\nbook: true\n---\n\nPreface.\n',
		'One.md': 'Note: the chapter\'s first line.\n\nIts second paragraph.\n',
	}, 'Book.md', { to: 'latex', output: 'Book.tex', chapters: ['One.md'] });
	assert.match(tex, /Note: the chapter’s first line\.|Note: the chapter's first line\./);
	assert.match(tex, /Its second paragraph\./);
});

test('the vault\'s bibliography resolves a note\'s citations in HTML, as reading view does; a header\'s `Resolve citations: false` still wins', async () => {
	const files = { 'refs.bib': BIB, 'Note.md': 'As \\cite{lewis1969} argued.\n' };
	const html = await build(files, 'Note.md', { to: 'html', output: 'Note.html' }, { vault: VAULT });
	assert.doesNotMatch(html, /\\cite\{lewis1969\}/);
	assert.match(html.replace(/<[^>]*>/g, ''), /As Lewis \(1969\) argued\./);
	const off = await build({ ...files, 'Note.md': '---\nResolve citations: false\n---\nAs \\cite{lewis1969} argued.\n' }, 'Note.md',
		{ to: 'html', output: 'Note.html' }, { vault: VAULT });
	assert.match(off, /As \\cite\{lewis1969\} argued\./);
	// No vault bibliography: as reading view, whose generated config turns
	// `resolve` on only for a vault file — a note's own `Bibliography` resolves
	// where its header asks (`Resolve citations: true`), and is left as written
	// otherwise.
	const own = { ...files, 'Note.md': '---\nBibliography: refs.bib\n---\nAs \\cite{lewis1969} argued.\n' };
	assert.match(await build(own, 'Note.md', { to: 'html', output: 'Note.html' }), /As \\cite\{lewis1969\} argued\./);
	const asked = await build({ ...files, 'Note.md': '---\nBibliography: refs.bib\nResolve citations: true\n---\nAs \\cite{lewis1969} argued.\n' }, 'Note.md',
		{ to: 'html', output: 'Note.html' });
	assert.match(asked.replace(/<[^>]*>/g, ''), /As Lewis \(1969\) argued\./);
});

test('LaTeX keeps natbib\'s own citations with the vault\'s bibliography, its style the user\'s config\'s as before', async () => {
	const files = { 'refs.bib': BIB, 'Note.md': 'As \\cite{lewis1969} argued.\n' };
	const tex = await build(files, 'Note.md', { to: 'latex', output: 'Note.tex' }, { vault: VAULT });
	assert.match(body(tex), /\\cite\{lewis1969\}/);
	// A numeric vault style would make natbib numeric: not handed to LaTeX.
	const numeric = await build(files, 'Note.md', { to: 'latex', output: 'Note.tex' }, { vault: { ...VAULT, bibliographyStyle: 'vancouver' } });
	assert.equal(numeric, tex);
});

// How each style prints `\citep{lewis1969}`, measured: the engine's default
// (chicago) `(Lewis 1969)`, apa `(Lewis, 1969)`, vancouver `[1]`.
const CITEP = { 'Note.md': 'See \\citep{lewis1969}.\n', 'refs.bib': BIB };
const cited = (html) => /<p[^>]*>See ([\s\S]*?)\.<\/p>/.exec(html)?.[1].replace(/<[^>]*>/g, '');

test('an HTML export cites in the vault\'s style, as reading view: over the user\'s config, under the note\'s header', async () => {
	const html = (files, vault, home) => build(files, 'Note.md', { to: 'html', output: 'Note.html' }, { vault, home }).then(cited);
	assert.equal(await html(CITEP, VAULT), '(Lewis 1969)', 'no style anywhere: the engine\'s');
	assert.equal(await html(CITEP, { ...VAULT, bibliographyStyle: 'apa' }), '(Lewis, 1969)');
	const vancouver = { Biblify: { 'bibliography style': 'vancouver' } };
	assert.equal(await html(CITEP, VAULT, vancouver), '[1]', 'the vault naming no style: the user\'s');
	assert.equal(await html(CITEP, { ...VAULT, bibliographyStyle: 'apa' }, vancouver), '(Lewis, 1969)', 'the vault\'s over the user\'s');
	const header = { ...CITEP, 'Note.md': '---\nBibliography style: vancouver\n---\nSee \\citep{lewis1969}.\n' };
	assert.equal(await html(header, { ...VAULT, bibliographyStyle: 'apa' }), '[1]', 'the note\'s header over the vault\'s');
	// A style with no vault bibliography is no setting, in reading view too.
	assert.equal(await html(CITEP, { bibliographyStyle: 'apa' }), '\\citep{lewis1969}');
});

test('a vault\'s custom .csl style is handed over as reading view has it — the file the engine registers by name', async () => {
	// The engine's ergo.csl with the citation's brackets made ⟨ ⟩: only this
	// file prints them.
	const ergo = fs.readFileSync(path.resolve('vendor/jmarkdown/src/csl/ergo.csl'), 'utf8');
	const house = ergo.replace('<layout prefix="(" suffix=")"', '<layout prefix="⟨" suffix="⟩"');
	assert.notEqual(house, ergo);
	const html = await build({ ...CITEP, 'Styles/house.csl': house }, 'Note.md', { to: 'html', output: 'Note.html' },
		{ vault: { ...VAULT, bibliographyStyle: 'Styles/house.csl' } });
	assert.equal(cited(html), '⟨Lewis, 1969⟩');
});
