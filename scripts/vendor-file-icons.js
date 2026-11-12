// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @file Writes the file explorer's icons: `vendor/material-icons/` (the SVGs
 * a file can be given, and the set's licence) and
 * `src/renderer/lib/file-icons-data.js` (which name gets which icon).
 *
 * The source is the owner's copy of Material Icon Theme (MIT) vendored in
 * jmacs, whose directory tree uses it: the SVGs in
 * `apps/desktop/vendor/material-icons/` and its table, generated from the
 * theme's manifest, in `apps/desktop/src/material-icons-data.js`. Only what
 * the table can give a FILE is copied (and the generic folder pair), with the
 * `_light` variant of any icon that has one: the theme's 576 per-name folder
 * icons (a folder called `src`, `test`, …) are left out. Clew's own kinds
 * the theme does not know are added below, as table entries the lookup reads
 * like any other.
 *
 * Run by hand — `node scripts/vendor-file-icons.js` — after the source
 * changes; other machines build from the committed output. Override the
 * source with CLEW_MATERIAL_ICONS (the SVG folder) and
 * CLEW_MATERIAL_ICONS_DATA (the table).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const jmacs = path.join(os.homedir(), 'Source/jmacs/main/apps/desktop');
const srcDir = process.env.CLEW_MATERIAL_ICONS ?? path.join(jmacs, 'vendor/material-icons');
const srcData = process.env.CLEW_MATERIAL_ICONS_DATA ?? path.join(jmacs, 'src/material-icons-data.js');
const outDir = path.join(root, 'vendor', 'material-icons');
const outData = path.join(root, 'src', 'renderer', 'lib', 'file-icons-data.js');

/** Clew's kinds, by extension (lowercased, after the name's first dot or a
 *  later one). The theme has no icon for an Obsidian canvas, a base or a
 *  jmarkdown note, gives an Excalidraw drawing stored as Obsidian's plugin
 *  stores it (`.excalidraw.md`) the markdown icon, and an .ogg the video
 *  icon — Clew opens one as audio (shared/file-types.js#AUDIO_EXT). */
const CLEW_EXTENSIONS = {
	jmd: 'markdown',
	'excalidraw.md': 'excalidraw',
	canvas: 'drawio',
	base: 'database',
	ogg: 'audio',
};

const { MATERIAL_ICONS: M } = await import(pathToFileURL(srcData).href);
const version = /material-icon-theme (\d+\.\d+\.\d+)/.exec(fs.readFileSync(srcData, 'utf8'))?.[1];
if (!version) throw new Error(`No material-icon-theme version in ${srcData}`);

const extensions = { ...M.extensions, ...CLEW_EXTENSIONS };
const fileNames = { ...M.fileNames };
const used = new Set([M.default, M.folder, M.folderOpen, ...Object.values(extensions), ...Object.values(fileNames)]);

/** The source file of an icon: the table names the odd one (`x.clone.svg`). */
const sourceOf = (icon) => {
	const named = M.files[icon] ? path.join(srcDir, M.files[icon]) : null;
	for (const file of [named, path.join(srcDir, `${icon}.svg`), path.join(srcDir, `${icon}.clone.svg`)]) {
		if (file && fs.existsSync(file)) return file;
	}
	return null;
};

// Every icon is written as `<icon>.svg` (and `<icon>_light.svg`), so the URL
// is the name. Only .svg files are removed first — never the folder — so a
// stale icon cannot linger and nothing else in it is touched.
fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
	if (file.endsWith('.svg')) fs.unlinkSync(path.join(outDir, file));
}
const light = [];
let bytes = 0;
for (const icon of [...used].sort()) {
	const from = sourceOf(icon);
	if (!from) throw new Error(`No SVG for the icon "${icon}" in ${srcDir}`);
	fs.copyFileSync(from, path.join(outDir, `${icon}.svg`));
	bytes += fs.statSync(from).size;
	const lightFrom = sourceOf(`${icon}_light`);
	if (lightFrom) {
		fs.copyFileSync(lightFrom, path.join(outDir, `${icon}_light.svg`));
		bytes += fs.statSync(lightFrom).size;
		light.push(icon);
	}
}
fs.copyFileSync(path.join(srcDir, 'LICENSE'), path.join(outDir, 'LICENSE'));
fs.writeFileSync(path.join(outDir, 'VENDOR.md'), `# Material Icon Theme's file icons — DO NOT EDIT

The file explorer's icons (components/panels/clew-file-explorer.js,
lib/file-icons.js). Written by \`node scripts/vendor-file-icons.js\` from the
owner's copy of Material Icon Theme ${version} (MIT, see LICENSE here; Material
Extensions, https://github.com/material-extensions/vscode-material-icon-theme),
vendored in jmacs. Only the icons a FILE can be given are here, with the
generic folder and open folder and every \`_light\` variant of those; the
theme's per-name folder icons are not. Which name gets which icon is
src/renderer/lib/file-icons-data.js, written by the same script. Change the
script and re-run it; never edit this folder by hand.

scripts/build.js copies this folder to dist/renderer/file-icons/.
`);

const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const HEADER = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 10).join('\n');
fs.writeFileSync(outData, `${HEADER}

// GENERATED by scripts/vendor-file-icons.js — do not edit by hand.
// Which file gets which of Material Icon Theme ${version}'s icons (MIT,
// vendor/material-icons/LICENSE): \`fileNames\` by the whole name, then
// \`extensions\` by what follows a dot, both lowercased; \`light\` the icons
// with a \`_light\` variant for a light page. The SVGs are
// vendor/material-icons/<icon>.svg.
export const FILE_ICONS = ${JSON.stringify({
	version,
	file: M.default,
	folder: M.folder,
	folderOpen: M.folderOpen,
	light,
	fileNames: sortKeys(fileNames),
	extensions: sortKeys(extensions),
}, null, '\t')};
`);
console.log(`Wrote ${outDir} (${used.size} icons, ${light.length} light variants, ${bytes} bytes; Material Icon Theme ${version}) and ${outData}`);
