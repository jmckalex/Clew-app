// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// An export's figures outside the vault (src/main/export-cache.js; jmarkdown
// d134995): the figures folder's name and marker as the engine has them, which
// folder may go to the Trash, the trusted vault's cache folder, and the prune;
// and what draws an export's TikZ and MetaPost (jmarkdown 21dee42), with the
// stand-ins that keep a restricted vault's TeX off the installed tools.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
	FIGURES_MARKER, EXPORT_CACHE_LIMIT, figuresFolder, figuresState, otherOutputs,
	vaultCacheDir, markUsed, pruneExportCache, explainFiguresWarnings,
	FIGURE_ENGINE_SETTINGS, figureEngineOptions, TEX_TOOLS, texRefusalDir,
} from '../src/main/export-cache.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-export-cache-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let n = 0;
const fresh = () => {
	const dir = path.join(root, String(++n));
	fs.mkdirSync(dir, { recursive: true });
	return dir;
};
const write = (file, bytes = 1, mtimeMs = null) => {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, Buffer.alloc(bytes));
	if (mtimeMs !== null) fs.utimesSync(file, new Date(mtimeMs), new Date(mtimeMs));
};

test('the marker and the folder name are the engine\'s (vendored figure-cache.js)', () => {
	const engine = fs.readFileSync(new URL('../vendor/jmarkdown/src/figure-cache.js', import.meta.url), 'utf8');
	assert.match(engine, new RegExp(`export const FIGURES_MARKER = '${FIGURES_MARKER.replace('.', '\\.')}';`));
	assert.ok(engine.includes("const dir = `${out.replace(/\\.[^./\\\\]+$/, '')}-figures`;"), 'the engine names the folder as figuresFolder does');
	assert.ok(engine.includes('Copy figures: ${path.basename(dir)}/ was not made by jmarkdown'), 'the warning explainFiguresWarnings reads');
	assert.equal(figuresFolder('/v/xn/diagrams.tex'), '/v/xn/diagrams-figures');
	assert.equal(figuresFolder('/v/build/Signals.html'), '/v/build/Signals-figures');
	assert.equal(figuresFolder('/v/a.b/notes'), '/v/a.b/notes-figures');
});

test('figuresState: none, marked (the engine\'s), foreign (the user\'s)', () => {
	const dir = fresh();
	assert.equal(figuresState(path.join(dir, 'x-figures')), 'none');
	fs.mkdirSync(path.join(dir, 'x-figures'));
	assert.equal(figuresState(path.join(dir, 'x-figures')), 'foreign');
	fs.writeFileSync(path.join(dir, 'x-figures', FIGURES_MARKER), '');
	assert.equal(figuresState(path.join(dir, 'x-figures')), 'marked');
});

test('otherOutputs: a .tex, an .html and a book\'s pages share a figures folder', () => {
	const dir = fresh();
	const tex = path.join(dir, 'x.tex');
	const html = path.join(dir, 'x.html');
	assert.deepEqual(otherOutputs(tex), []);
	write(tex);
	assert.deepEqual(otherOutputs(tex), [], 'the output itself is not another');
	assert.deepEqual(otherOutputs(html), [tex]);
	write(path.join(dir, 'x', 'index.html'));
	assert.deepEqual(otherOutputs(html), [tex, path.join(dir, 'x', 'index.html')]);
});

test('vaultCacheDir: one folder a vault, named by a hash — never its path', () => {
	const a = vaultCacheDir('/c', '/Users/someone/Vault');
	assert.equal(path.dirname(a), '/c');
	assert.match(path.basename(a), /^[0-9a-f]{16}$/);
	assert.equal(vaultCacheDir('/c', '/Users/someone/Vault'), a);
	assert.notEqual(vaultCacheDir('/c', '/Users/someone/Other'), a);
});

test('markUsed: the cached files an export\'s copies came from are used now', () => {
	const dir = fresh();
	const cache = path.join(dir, 'cache');
	const figures = path.join(dir, 'out-figures');
	write(path.join(cache, 'MetaPost', 'a.pdf'), 1, 1000);
	write(path.join(cache, 'MetaPost', 'b.pdf'), 1, 1000);
	write(path.join(figures, 'MetaPost', 'a.pdf'));
	write(path.join(figures, FIGURES_MARKER));
	markUsed(cache, figures, 5_000_000);
	assert.equal(fs.statSync(path.join(cache, 'MetaPost', 'a.pdf')).mtimeMs, 5_000_000);
	assert.equal(fs.statSync(path.join(cache, 'MetaPost', 'b.pdf')).mtimeMs, 1000);
	markUsed(cache, path.join(dir, 'none-figures'));   // no folder: nothing, no throw
});

test('pruneExportCache: under the limit nothing goes; over it the least recently used first', () => {
	const cache = fresh();
	write(path.join(cache, 'v1', 'mermaid', 'old.pdf'), 400, 1000);
	write(path.join(cache, 'v1', 'mermaid', 'mid.pdf'), 400, 2000);
	write(path.join(cache, 'v2', 'TiKZ', 'new.svg'), 400, 3000);
	assert.deepEqual(pruneExportCache(cache, { limit: 1200 }), { removed: 0, bytes: 1200 });
	// markUsed made `old` the newest: `mid` goes first.
	fs.utimesSync(path.join(cache, 'v1', 'mermaid', 'old.pdf'), new Date(4000), new Date(4000));
	assert.deepEqual(pruneExportCache(cache, { limit: 800 }), { removed: 1, bytes: 800 });
	assert.equal(fs.existsSync(path.join(cache, 'v1', 'mermaid', 'mid.pdf')), false);
	assert.equal(fs.existsSync(path.join(cache, 'v1', 'mermaid', 'old.pdf')), true);
	// Every vault's together; a vault's folder emptied goes too.
	assert.deepEqual(pruneExportCache(cache, { limit: 400 }), { removed: 1, bytes: 400 });
	assert.equal(fs.existsSync(path.join(cache, 'v2')), false);
	assert.equal(EXPORT_CACHE_LIMIT, 500 * 1024 * 1024);
});

test('pruneExportCache: a dead worker\'s run folder goes after an hour; a running one stays', () => {
	const cache = fresh();
	const now = Date.now();
	const stale = path.join(cache, 'v', 'MetaPost', '.run-old');
	const live = path.join(cache, 'v', 'MetaPost', '.run-new');
	write(path.join(stale, 'x.mp'));
	write(path.join(live, 'y.mp'));
	fs.utimesSync(stale, new Date(now - 2 * 3600_000), new Date(now - 2 * 3600_000));
	pruneExportCache(cache, { now });
	assert.equal(fs.existsSync(stale), false);
	assert.equal(fs.existsSync(path.join(live, 'y.mp')), true);
	pruneExportCache(path.join(root, 'no-such-cache'));   // never made: nothing, no throw
});

test('explainFiguresWarnings: the engine\'s warning about a folder of the user\'s, said for the reader', () => {
	const engine = 'Copy figures: diagrams-figures/ was not made by jmarkdown (it has no .jmarkdown-figures), so nothing is copied into it — the output refers to the cache instead';
	const [trusted, other] = explainFiguresWarnings([engine, 'latex-export [x]: y'], { restricted: false });
	assert.match(trusted, /^diagrams-figures\/ beside the export is not one Clew or jmarkdown made/);
	assert.match(trusted, /export cache on this computer/);
	assert.match(trusted, /Rename or move diagrams-figures\/ and export again\.$/);
	assert.equal(other, 'latex-export [x]: y');
	const [restricted] = explainFiguresWarnings([engine], { restricted: true });
	assert.match(restricted, /temporary folder this export removed, so its diagrams will not show/);
});

test('figureEngineOptions: a trusted vault as the setting says, a restricted one always the library alone', () => {
	const dist = '/app/mptikz';
	assert.deepEqual(FIGURE_ENGINE_SETTINGS, ['external', 'auto']);
	assert.deepEqual(figureEngineOptions({ trusted: true, dist, setting: 'external' }), {});
	assert.deepEqual(figureEngineOptions({ trusted: true, dist, setting: undefined }), {}, 'no setting: the installed tools');
	assert.deepEqual(figureEngineOptions({ trusted: true, dist, setting: 'nonsense' }), {});
	assert.deepEqual(figureEngineOptions({ trusted: true, dist, setting: 'auto' }), { figureEngine: 'auto', mpTikzDist: dist });
	for (const setting of ['external', 'auto', undefined]) {
		assert.deepEqual(figureEngineOptions({ trusted: false, dist, setting }), { figureEngine: 'wasm', mpTikzDist: dist }, `restricted, setting ${setting}`);
	}
	const defaults = fs.readFileSync(new URL('../src/main/settings.js', import.meta.url), 'utf8');
	assert.ok(defaults.includes("exportFigureEngine: 'external',"), 'the setting\'s default is the first value');
});

test('TEX_TOOLS: every program the engine runs over a figure\'s TeX (vendored tikz.js, metapost.js)', () => {
	const ran = new Set();
	for (const file of ['tikz.js', 'metapost.js']) {
		const src = fs.readFileSync(new URL(`../vendor/jmarkdown/src/${file}`, import.meta.url), 'utf8');
		for (const m of src.matchAll(/exec(?:File)?Sync\(\s*['"`]([A-Za-z0-9_-]+)/g)) ran.add(m[1]);
	}
	assert.deepEqual([...ran].sort(), [...TEX_TOOLS].sort());
});

test('texRefusalDir: a stand-in for each tool that refuses, saying why; none on Windows', () => {
	const dir = path.join(fresh(), 'no-tex');
	assert.equal(texRefusalDir(dir), dir);
	assert.deepEqual(fs.readdirSync(dir).sort(), [...TEX_TOOLS].sort());
	assert.equal(texRefusalDir(dir), dir, 'written again over itself');
	for (const tool of TEX_TOOLS) {
		assert.ok(fs.statSync(path.join(dir, tool)).mode & 0o111, `${tool} is executable`);
		// Found by name on PATH, as the engine's execFileSync finds the real one.
		assert.throws(() => execFileSync(tool, ['--version'], { env: { PATH: `${dir}${path.delimiter}/usr/bin:/bin` }, stdio: 'pipe' }),
			(err) => err.status === 1 && /was not run: in a vault this device does not trust/.test(String(err.stderr)));
	}
	assert.equal(texRefusalDir(path.join(fresh(), 'win'), 'win32'), null);
});
