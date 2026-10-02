// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Build pipeline: three esbuild bundles (main, preload, renderer) plus a
// verbatim copy of static assets (index.html, styles). Used one-shot here
// and in watch mode by scripts/dev.js.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceHashes, writeBuildStamp } from '../src/main/build-stamp.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const bundles = [
	{
		entryPoints: [path.join(root, 'src/main/main.js')],
		outfile: path.join(root, 'dist/main/main.js'),
		bundle: true,
		platform: 'node',
		format: 'esm',
		external: ['electron'],
		sourcemap: true,
	},
	{
		entryPoints: [path.join(root, 'src/preload/preload.cjs')],
		outfile: path.join(root, 'dist/preload/preload.cjs'),
		bundle: true,
		platform: 'node',
		format: 'cjs',
		external: ['electron'],
	},
	{
		entryPoints: [path.join(root, 'src/renderer/main.js')],
		outfile: path.join(root, 'dist/renderer/bundle.js'),
		bundle: true,
		format: 'esm',
		sourcemap: true,
	},
	{
		// Injected into preview iframes as a classic <script>; bundles morphdom.
		entryPoints: [path.join(root, 'src/preview-client/client.js')],
		outfile: path.join(root, 'dist/preview-client/client.js'),
		bundle: true,
		format: 'iife',
	},
	{
		// Static-site runtime for exported vaults (maps, mermaid) — shipped
		// into <site>/assets/ by File → Export Vault as Website.
		entryPoints: [path.join(root, 'src/preview-client/site-client.js')],
		outfile: path.join(root, 'dist/preview-client/site-client.js'),
		bundle: true,
		format: 'iife',
	},
	{
		// Web Awesome components for Meta Bind widgets — lazily loaded by the
		// preview client only when a document contains one.
		entryPoints: [path.join(root, 'src/preview-client/wa-bundle.js')],
		outfile: path.join(root, 'dist/preview-client/wa.js'),
		bundle: true,
		format: 'iife',
		minify: true,   // lazily loaded, but 650 KB of library earns a squeeze
	},
	{
		// …and their base styles + default theme, resolved to one file.
		entryPoints: [path.join(root, 'src/preview-client/wa-styles.css')],
		outfile: path.join(root, 'dist/preview-client/wa.css'),
		bundle: true,
		minify: true,
	},
	{
		// The Excalidraw editor page. This is the ONLY bundle that contains
		// React: it is loaded in an iframe when a drawing is opened, so the
		// app's own renderer never carries a framework. Excalidraw is bundled
		// as-is — upgrading is `npm install @excalidraw/excalidraw@latest`
		// plus a rebuild, with no code of ours to revisit.
		entryPoints: [path.join(root, 'src/excalidraw/page.js')],
		outfile: path.join(root, 'dist/excalidraw/page.js'),
		bundle: true,
		format: 'iife',
		jsx: 'automatic',
		// Excalidraw's exports map offers only development/production
		// conditions — no default — so without this neither its entry
		// point nor its stylesheet resolves.
		conditions: ['production'],
		// The only minified bundle in the project, and it earns it: React plus
		// Excalidraw is 14 MB unminified and about a seventh of that minified.
		// Nothing of ours is in here to debug — it is third-party code we do
		// not modify.
		minify: true,
		loader: { '.woff2': 'file', '.ttf': 'file', '.png': 'file', '.svg': 'file' },
		define: { 'process.env.NODE_ENV': '"production"' },
	},
	{
		// The standalone PDF viewer page's script, served from
		// __clew_assets__/clewpdf/ for the file tab and canvas PDF nodes.
		entryPoints: [path.join(root, 'src/preview-client/pdf-page.js')],
		outfile: path.join(root, 'dist/preview-client/pdf-page.js'),
		bundle: true,
		format: 'iife',
	},
	{
		// window.clew inside an app frame (frame-bridge.md §7), served by the
		// clew-frame handler at /__clew_bridge__.js on the app's own origin.
		entryPoints: [path.join(root, 'src/preview-client/clew-bridge.js')],
		outfile: path.join(root, 'dist/preview-client/clew-bridge.js'),
		bundle: true,
		format: 'iife',
	},
	{
		// The note API (window.clew), injected into preview <head>s.
		entryPoints: [path.join(root, 'src/preview-client/api.js')],
		outfile: path.join(root, 'dist/preview-client/api.js'),
		bundle: true,
		format: 'iife',
	},
	{
		// The ZetaOffice host page's script (spike), served from
		// __clew_assets__/clewzeta/.
		entryPoints: [path.join(root, 'src/preview-client/zeta-page.js')],
		outfile: path.join(root, 'dist/preview-client/zeta-page.js'),
		bundle: true,
		format: 'iife',
	},
];

// Static files copied as-is; CSS is deliberately not compiled. The engine
// assets (wikilink extension, template, preview css) are consumed from dist/
// by the render worker and the preview protocol, not bundled.
export const staticDirs = [
	{ from: path.join(root, 'src/renderer/index.html'), to: path.join(root, 'dist/renderer/index.html') },
	// Host page for the Excalidraw editor.
	{ from: path.join(root, 'src/excalidraw/page.html'), to: path.join(root, 'dist/excalidraw/page.html') },
	// Host page for the standalone PDF viewer.
	{ from: path.join(root, 'src/preview-client/pdf-page.html'), to: path.join(root, 'dist/preview-client/pdf-page.html') },
	// Host page + office-thread script for the ZetaOffice viewer (spike).
	// The thread script is copied verbatim: the LOWA worker loads it as a
	// plain script via Module.uno_scripts, not through any bundle.
	{ from: path.join(root, 'src/preview-client/zeta-page.html'), to: path.join(root, 'dist/preview-client/zeta-page.html') },
	{ from: path.join(root, 'src/preview-client/zeta-thread.js'), to: path.join(root, 'dist/preview-client/zeta-thread.js') },
	{ from: path.join(root, 'src/renderer/styles'), to: path.join(root, 'dist/renderer/styles') },
	// xterm's own stylesheet for the shell panel, copied out of node_modules
	// rather than imported from JS: CSS is not compiled here, and a <link> in
	// index.html keeps the one rule that matters — the grid's metrics — where
	// a reader can see it. Clew's colours are applied as an xterm theme
	// object, not by overriding this file (clew-shell-panel.js).
	{ from: path.join(root, 'node_modules/@xterm/xterm/css/xterm.css'), to: path.join(root, 'dist/renderer/vendor/xterm.css') },
	{ from: path.join(root, 'src/engine'), to: path.join(root, 'dist/engine') },
];

export function copyStatic() {
	for (const { from, to } of staticDirs) {
		fs.rmSync(to, { recursive: true, force: true });
		fs.cpSync(from, to, { recursive: true });
	}
}

// Font Awesome Free's icons as one table — `family:name` → [width, height,
// path] — for custom callout types (the engine's callout-definitions.js): main
// resolves the names a definition uses from it and hands the worker only
// those paths, and Settings' icon picker loads it on demand. Never on a
// render path. Built from the package's own svgs/ (CC BY 4.0, see
// THIRD-PARTY-NOTICES.md), which do not ship in the app.
export function writeIconTable() {
	const base = path.join(root, 'node_modules/@fortawesome/fontawesome-free');
	const icons = {};
	for (const family of ['solid', 'regular', 'brands']) {
		const dir = path.join(base, 'svgs', family);
		if (!fs.existsSync(dir)) continue;
		for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
			const svg = fs.readFileSync(path.join(dir, file), 'utf8');
			const box = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
			const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
			if (!box || !paths.length) continue;
			icons[`${family}:${file.slice(0, -4)}`] = [Number(box[1]), Number(box[2]), paths.join(' ')];
		}
	}
	const { version } = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
	fs.mkdirSync(path.join(root, 'dist/main'), { recursive: true });
	fs.writeFileSync(path.join(root, 'dist/main/fa-icons.json'), JSON.stringify({ version, icons }));
}

export async function buildAll() {
	// The sources are read BEFORE the build: an edit made while it runs then
	// shows up as stale, never as built (build-stamp.js).
	const sources = sourceHashes(root);
	copyStatic();
	writeIconTable();
	await Promise.all(bundles.map((opts) => esbuild.build(opts)));
	writeBuildStamp(root, sources);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await buildAll();
	console.log('Build complete.');
}
