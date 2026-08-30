// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Refresh the vendored EmbedPDF viewer from the owner's OCG build.
//
// The master lives outside this repo (EMBEDPDF_SRC, default
// ~/Source/EmbedPDF/v2, branch ocg-v2): EmbedPDF v2.15.0 plus the layers
// (Optional Content Groups) patches from ~/Source/pdfium-ocg — a custom
// pdfium.wasm carrying the FPDF*OCG* API and the viewer UI that uses it.
// vendor/embedpdf/dist is a dumb mirror of the BUILT snippet viewer
// (viewers/snippet/dist), recreated from scratch on every sync so it can
// never drift — built output rather than source because rebuilding needs
// the EmbedPDF monorepo toolchain and a wasm cross-compile. On machines
// without the master (CI, other clones) the committed mirror is used as-is.
//
// Rebuild the master first when it has changed: `pnpm build` at its root
// (the unrelated example apps may fail after the snippet builds — check
// for "@embedpdf/snippet:build: ... created dist" rather than exit 0).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = process.env.EMBEDPDF_SRC
	?? path.join(os.homedir(), 'Source', 'EmbedPDF', 'v2');
const sourceDist = path.join(source, 'viewers', 'snippet', 'dist');
const dest = path.join(root, 'vendor', 'embedpdf');

if (!fs.existsSync(path.join(sourceDist, 'embedpdf.js'))) {
	console.log(`vendor-embedpdf: built master not found at ${sourceDist}; keeping committed mirror.`);
	process.exit(0);
}

let describe = 'unknown';
try {
	const hash = execSync('git rev-parse --short HEAD', { cwd: source }).toString().trim();
	const branch = execSync('git branch --show-current', { cwd: source }).toString().trim();
	const dirty = execSync('git status --porcelain', { cwd: source }).toString().trim() ? ' (dirty tree)' : '';
	describe = `${branch}@${hash}${dirty}`;
} catch { /* master may not be a git checkout */ }

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
// Wholesale, minus the sample PDFs the snippet demo page ships (multi-MB,
// never served by Clew).
fs.cpSync(sourceDist, path.join(dest, 'dist'), {
	recursive: true,
	filter: (src) => !src.toLowerCase().endsWith('.pdf'),
});
const license = path.join(source, 'LICENSE');
if (fs.existsSync(license)) fs.cpSync(license, path.join(dest, 'LICENSE'));

fs.writeFileSync(path.join(dest, 'VENDOR.md'), `# Vendored EmbedPDF (OCG build) — DO NOT EDIT

This directory is a dumb mirror of the built EmbedPDF snippet viewer from
the owner's layers/OCG fork and is overwritten wholesale by
\`npm run sync-embedpdf\`. Make every viewer change in the master checkout
(${source}) and re-sync. EmbedPDF is MIT (see LICENSE here); the OCG
patch series lives in ~/Source/pdfium-ocg/patches/.

Synced from: ${describe}
`);

console.log(`vendor-embedpdf: mirrored ${describe} → vendor/embedpdf`);
