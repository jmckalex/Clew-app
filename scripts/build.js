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
		// The standalone PDF viewer page's script, served from
		// __clew_assets__/clewpdf/ for the file tab and canvas PDF nodes.
		entryPoints: [path.join(root, 'src/preview-client/pdf-page.js')],
		outfile: path.join(root, 'dist/preview-client/pdf-page.js'),
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
];

// Static files copied as-is; CSS is deliberately not compiled. The engine
// assets (wikilink extension, template, preview css) are consumed from dist/
// by the render worker and the preview protocol, not bundled.
export const staticDirs = [
	{ from: path.join(root, 'src/renderer/index.html'), to: path.join(root, 'dist/renderer/index.html') },
	// Host page for the standalone PDF viewer.
	{ from: path.join(root, 'src/preview-client/pdf-page.html'), to: path.join(root, 'dist/preview-client/pdf-page.html') },
	{ from: path.join(root, 'src/renderer/styles'), to: path.join(root, 'dist/renderer/styles') },
	{ from: path.join(root, 'src/engine'), to: path.join(root, 'dist/engine') },
];

export function copyStatic() {
	for (const { from, to } of staticDirs) {
		fs.rmSync(to, { recursive: true, force: true });
		fs.cpSync(from, to, { recursive: true });
	}
}

export async function buildAll() {
	copyStatic();
	await Promise.all(bundles.map((opts) => esbuild.build(opts)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await buildAll();
	console.log('Build complete.');
}
