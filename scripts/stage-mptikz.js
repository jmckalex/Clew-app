// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Stage mp-tikz-wasm into mptikz-assets/ — the wasm MetaPost/TeX engines that
// typeset TikZ and MetaPost figures in the preview, and what packaging ships
// unpacked under Resources/mptikz (paths.js#mptikzAssets).
//
// This is neither of the two existing patterns but a deliberate hybrid of
// them, because 74 MB of engines and TeX bundles (3,600 files) is too much to
// commit like vendor/jmarkdown and too central to download at runtime like
// ZetaOffice — a figure in a note must simply render:
//
//   1. The owner's master build (MPTIKZ_SRC, default ~/Source/mp-tikz-wasm/
//      dist) wins when it is there, so work done upstream reaches Clew the
//      moment it is built — the sync-engine arrangement.
//   2. Otherwise the pinned release archive from GitHub, verified against
//      the SHA256 in src/shared/mptikz-manifest.json — the zeta-assets
//      arrangement, minus the guesswork: the URL carries a version, so a
//      mismatch means the wrong file rather than a new upstream build. The
//      download is cached in mptikz-assets/.cache so a re-stage is free.
//      From 0.4.0 a SECOND archive may be pinned beside it,
//      `manifest.ghostscript` (Ghostscript's module, AGPL, which upstream
//      ships apart): verified the same way and unpacked into the same tree.
//
// mptikz-assets/ is gitignored. In DEV nothing needs staging at all:
// paths.js reads the master's dist directly (and CLEW_MPTIKZ_DIR overrides
// both), which is why `npm run dev` does not call this and `npm run package`
// does — with --require, so packaging fails loudly rather than shipping an
// app whose figures cannot render.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ENGINE_TIKZ_LIBRARIES, UNBUNDLED_TIKZ_LIBRARIES } from '../src/engine/figures.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'shared', 'mptikz-manifest.json'), 'utf8'));
const dest = path.join(root, 'mptikz-assets');
const stamp = path.join(dest, 'STAGED.json');
const required = process.argv.includes('--require');
const force = process.argv.includes('--force');

const master = process.env.MPTIKZ_SRC ?? path.join(os.homedir(), 'Source', 'mp-tikz-wasm', 'dist');

/** What is staged now, if anything. */
function staged() {
	try { return JSON.parse(fs.readFileSync(stamp, 'utf8')); } catch { return null; }
}

function describeMaster() {
	try {
		const repo = path.dirname(master);
		const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repo }).toString().trim();
		const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repo }).toString().trim();
		const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repo }).toString().trim() ? ' (dirty tree)' : '';
		return `${branch}@${hash}${dirty}`;
	} catch { return 'unknown'; }
}

/**
 * The identity of a staged tree: where it came from and how fresh.
 *
 * bundles/index.json is in the list because the four engines and the TeX
 * bundles are rebuilt SEPARATELY upstream (`npm run build:bundles` alone is
 * a normal thing to do there — adding spath3 for the calligraphy library was
 * exactly that), and without it a bundles-only rebuild looked "already
 * current" here and was never staged.
 */
function masterIdentity() {
	const mtimes = ['index.js', 'mplib.wasm', 'tex.wasm', 'dvisvgm.wasm', 'luatex.wasm',
		path.join('bundles', 'index.json'), path.join('bundles', 'hot.json'), path.join('ghostscript', 'gs.wasm')]
		.map((f) => {
			try { return fs.statSync(path.join(master, f)).mtimeMs; } catch { return 0; }
		});
	return { source: 'master', from: master, describe: describeMaster(), mtimes };
}

function sameIdentity(a, b) {
	return !!a && !!b && a.source === b.source
		&& JSON.stringify(a.mtimes ?? a.sha256) === JSON.stringify(b.mtimes ?? b.sha256);
}

function copyTree(from) {
	fs.rmSync(dest, { recursive: true, force: true, maxRetries: 3 });
	fs.mkdirSync(dest, { recursive: true });
	// Source maps are a third of the JavaScript and nothing reads them here.
	fs.cpSync(from, dest, { recursive: true, filter: (src) => !src.endsWith('.js.map') });
}

function report(identity) {
	const files = countFiles(dest);
	fs.writeFileSync(stamp, JSON.stringify({ ...identity, staged: new Date().toISOString(), files }, null, '\t'));
	console.log(`stage-mptikz: ${files} files in mptikz-assets/ (${identity.source}: ${identity.describe ?? identity.from})`);
	checkDirectiveLibraries(identity);
}

/**
 * Does the staged tree carry every TikZ library the DIRECTIVES preload?
 *
 * This is not paranoia: `:::TiKZ` and `@begin(TiKZ)` emit the whole list on
 * every figure, and ONE \usetikzlibrary that cannot be found takes the figure
 * down — so a bundle missing one name breaks every directive figure in every
 * vault. The names come from src/engine/figures.js, the same constants the
 * renderer and tests use, so there is one source of truth.
 *
 * It matters most for exactly the case that is hardest to notice: the master
 * has the library, the PINNED release predates it, and a machine staging from
 * the pin would ship a broken app quietly. With --require (packaging) that is
 * a refusal, not a warning.
 */
function checkDirectiveLibraries(identity) {
	const bundles = path.join(dest, 'bundles');
	if (!fs.existsSync(bundles)) return;
	const names = new Set();
	for (const entry of fs.readdirSync(bundles, { withFileTypes: true, recursive: true })) {
		if (entry.isFile()) names.add(entry.name);
	}
	const missing = ENGINE_TIKZ_LIBRARIES.split(',').filter((lib) =>
		!UNBUNDLED_TIKZ_LIBRARIES.has(lib)
		&& !names.has(`tikzlibrary${lib}.code.tex`)
		&& !names.has(`pgflibrary${lib}.code.tex`));
	if (!missing.length) return;
	const how = identity.source === 'release'
		? `The pinned ${identity.version} predates them. Build the master, or re-pin
src/shared/mptikz-manifest.json to a release whose bundles carry them.`
		: `Rebuild the master's bundles (npm run build:texmf && npm run build:bundles
there), adding the packages that provide them.`;
	const message = `stage-mptikz: the staged bundles are missing ${missing.length} TikZ `
		+ `librar${missing.length === 1 ? 'y' : 'ies'} the :::TiKZ / @begin(TiKZ) directives `
		+ `preload:\n  ${missing.join(', ')}\n`
		+ `Every directive figure would fail, not just the ones using them.\n${how}\n`
		+ `The other way out is to name them in UNBUNDLED_TIKZ_LIBRARIES\n`
		+ `(src/engine/figures.js), which drops them from the preloaded list.`;
	if (required) {
		console.error(message);
		process.exit(1);
	}
	console.warn(message);
}

function countFiles(dir) {
	let n = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
		if (entry.isFile()) n += 1;
	}
	return n;
}

// ---- 1. the master's own build --------------------------------------------

if (fs.existsSync(path.join(master, 'index.js')) && fs.existsSync(path.join(master, 'bundles'))) {
	const identity = masterIdentity();
	if (!force && sameIdentity(staged(), identity)) {
		console.log(`stage-mptikz: mptikz-assets/ already current with ${identity.describe}; nothing to do.`);
		process.exit(0);
	}
	copyTree(master);
	report(identity);
	process.exit(0);
}

// ---- 2. the pinned release ------------------------------------------------
// The main archive, and — from 0.4.0 — Ghostscript's module as an archive of
// its own (`manifest.ghostscript`, AGPL, so upstream ships it apart), whose
// dist/ghostscript/ unpacks into the same tree. Each is SHA256-pinned and
// verified; a manifest without the second simply stages the first.

const cache = path.join(dest, '.cache');
const assets = [manifest, manifest.ghostscript].filter(Boolean);
const pins = assets.map((a) => a.sha256);

function sha256(file) {
	const hash = crypto.createHash('sha256');
	hash.update(fs.readFileSync(file));
	return hash.digest('hex');
}

async function download(asset, file) {
	console.log(`stage-mptikz: fetching ${asset.url} (${Math.round(asset.bytes / 1e6)} MB)…`);
	const res = await fetch(asset.url, { redirect: 'follow' });
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	fs.mkdirSync(cache, { recursive: true });
	fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/** The asset's archive in the cache, fetched if need be and VERIFIED. */
async function verified(asset) {
	const file = path.join(cache, asset.archive);
	if (!fs.existsSync(file)) await download(asset, file);
	const digest = sha256(file);
	if (digest !== asset.sha256) {
		// REFUSE rather than "probably fine": the pin names one exact file.
		fs.rmSync(file, { force: true });
		throw new Error(`SHA256 mismatch for ${asset.archive}\n  expected ${asset.sha256}\n  got      ${digest}`);
	}
	return file;
}

const current = staged();
if (!force && current?.source === 'release' && current.version === manifest.version
	&& JSON.stringify(current.archives ?? [current.sha256]) === JSON.stringify(pins)
	&& fs.existsSync(path.join(dest, 'index.js'))) {
	console.log(`stage-mptikz: mptikz-assets/ already holds the pinned ${manifest.version}; nothing to do.`);
	process.exit(0);
}

try {
	const kept = [];
	for (const asset of assets) {
		const file = await verified(asset);
		kept.push([file, fs.readFileSync(file)]);
	}
	fs.rmSync(dest, { recursive: true, force: true, maxRetries: 3 });
	fs.mkdirSync(cache, { recursive: true });
	for (const [file, bytes] of kept) fs.writeFileSync(file, bytes);
	// dist/ inside each archive IS (part of) the staged tree, two components deep.
	for (const asset of assets) {
		execFileSync('tar', ['xzf', path.join(cache, asset.archive), '-C', dest, '--strip-components=2', asset.unpackedDir], { stdio: 'inherit' });
	}
	report({
		source: 'release', version: manifest.version, from: manifest.url,
		describe: `pinned ${manifest.tag}${manifest.ghostscript ? ' + ghostscript' : ''}`,
		sha256: manifest.sha256, archives: pins,
	});
} catch (err) {
	const message = `stage-mptikz: no mp-tikz-wasm build staged — ${String(err.message ?? err)}`;
	if (required) {
		console.error(`${message}\n\nPackaging without it would ship an app that cannot typeset a TikZ or\nMetaPost figure. Build the master (${master}) or make the pinned\nrelease reachable, then re-run.`);
		process.exit(1);
	}
	console.log(`${message}\nFigures will not render until this succeeds (see src/main/paths.js).`);
}
