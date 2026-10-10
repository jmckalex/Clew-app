// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Regenerate THIRD-PARTY-NOTICES.md from the dependency tree that actually
// ships:  node scripts/gen-notices.js
//
// Run it after adding, removing or upgrading a runtime dependency. The file is
// committed rather than generated at build time so that anyone reading the
// repository — or auditing a release — sees the same list without running
// anything.
//
// WHY IT EXISTS. Most of what Clew ships is MIT or ISC, and both require the
// copyright notice to travel with the software. Listing an SPDX identifier is
// not enough on its own: "the above copyright notice AND this permission
// notice shall be included in all copies". So each package's own licence text
// is reproduced verbatim below its entry.
//
// Two things get called out at the top because they carry obligations beyond
// "include this notice": citeproc's attribution requirement, and the fonts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LICENCE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE',
	'LICENCE.md', 'License', 'License.md', 'license', 'COPYING', 'COPYING.md'];

function readPkg(dir) {
	try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); }
	catch { return null; }
}

function licenceText(dir) {
	for (const name of LICENCE_FILES) {
		const file = path.join(dir, name);
		try { if (fs.statSync(file).isFile()) return fs.readFileSync(file, 'utf8').trim(); }
		catch { /* next */ }
	}
	return null;
}

const spdx = (pkg) => {
	if (typeof pkg.license === 'string') return pkg.license;
	if (pkg.license?.type) return pkg.license.type;
	if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
	return null;
};

/** vendor/ folders that ship as they are (no npm install). The stamp
 *  tool's default library (pdf-core.js) declares no licence field in its
 *  package.json; its LICENSE file is MIT. */
const VENDORED = ['default-stamps', 'embedpdf'];
const VENDORED_LICENCE = { 'default-stamps': 'MIT' };
/** A vendored build with no package.json of its own: what to call it. The
 *  PDF viewer is EmbedPDF built from the owner's OCG/layers fork
 *  (vendor/embedpdf/VENDOR.md), no longer an npm dependency — so the
 *  @embedpdf packages fell out of this list until it was named here. */
const VENDORED_META = {
	embedpdf: { name: 'EmbedPDF (OCG/layers fork)', version: '2.15.0', license: 'MIT', homepage: 'https://github.com/embedpdf/embed-pdf-viewer' },
};

/** Every runtime package reachable from `dependencies`, plus Electron. */
function collect() {
	const manifest = readPkg(root);
	const found = new Map();
	const visit = (name) => {
		if (found.has(name)) return;
		const dir = path.join(root, 'node_modules', name);
		const pkg = readPkg(dir);
		if (!pkg) return;
		found.set(name, {
			name, version: pkg.version ?? '?',
			licence: spdx(pkg) ?? '(not stated)',
			homepage: pkg.homepage ?? pkg.repository?.url ?? null,
			text: licenceText(dir),
		});
		for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep);
	};
	for (const dep of Object.keys(manifest.dependencies ?? {})) visit(dep);
	// Electron is a devDependency because it is not imported — but its binary
	// IS the shipped runtime, so it belongs here more than most of the list.
	visit('electron');
	// Components vendored as committed copies rather than npm dependencies
	// (vendor/<dir>, each with its own package.json and licence file).
	for (const dir of VENDORED) {
		const abs = path.join(root, 'vendor', dir);
		const pkg = readPkg(abs) ?? VENDORED_META[dir] ?? null;
		if (!pkg || found.has(pkg.name)) continue;
		found.set(pkg.name, {
			name: pkg.name, version: pkg.version ?? '?',
			licence: spdx(pkg) ?? VENDORED_LICENCE[dir] ?? '(not stated)',
			homepage: pkg.homepage ?? pkg.repository?.url ?? null,
			text: licenceText(abs),
		});
	}
	// What a vendored BUILD bundles (scripts/vendor-embedpdf.js writes it):
	// vendor/<dir>/licenses/<name>/ — a package.json and its licence text.
	for (const dir of VENDORED) {
		const bundled = path.join(root, 'vendor', dir, 'licenses');
		for (const name of fs.existsSync(bundled) ? fs.readdirSync(bundled) : []) {
			const abs = path.join(bundled, name);
			const pkg = readPkg(abs);
			if (!pkg || found.has(pkg.name)) continue;
			found.set(pkg.name, {
				name: pkg.name, version: pkg.version ?? '?',
				licence: spdx(pkg) ?? '(not stated)',
				homepage: pkg.homepage ?? null,
				text: licenceText(abs),
			});
		}
	}
	return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const packages = collect();
const byLicence = new Map();
for (const p of packages) byLicence.set(p.licence, (byLicence.get(p.licence) ?? 0) + 1);
const noText = packages.filter((p) => !p.text);

const lines = [];
const out = (s = '') => lines.push(s);

out('# Third-party notices');
out();
out('Clew itself is © J. McKenzie Alexander and released under the **GNU');
out('General Public License, version 3 or later** — see `LICENSE`.');
out();
out('It ships, and is built on, the work of many other people. What follows is');
out('every third-party component distributed with Clew, its licence, and that');
out('licence\'s own text. MIT and ISC — which between them account for most of');
out('this list — require the copyright notice to travel with the software, so');
out('reproducing the text is not politeness but the condition of use.');
out();
out('_Generated by `node scripts/gen-notices.js`. Re-run it whenever a runtime');
out('dependency is added, removed or upgraded._');
out();
out(`**${packages.length} components.**`);
out();
out('| Licence | Components |');
out('| --- | ---: |');
for (const [lic, n] of [...byLicence].sort((a, b) => b[1] - a[1])) {
	out(`| ${lic.replace(/\|/g, '\\|')} | ${n} |`);
}
out();
out('## Components carrying obligations beyond attribution');
out();
out('### citeproc — `CPAL-1.0 OR AGPL-1.0`');
out();
out('The CSL citation processor behind Clew\'s bibliography, reached through');
out('`jmarkdown → citation-js → citeproc`. It is **dual-licensed**: a user may');
out('rely on either the Common Public Attribution License 1.0 or the GNU Affero');
out('GPL 1.0.');
out();
out('It is not linked into Clew\'s own code. It ships as an unpacked file tree');
out('under `Resources/engine/` and executes inside the forked jmarkdown worker —');
out('a separate process Clew communicates with over IPC.');
out();
out('CPAL-1.0 carries an **attribution requirement**; this notices file is part');
out('of how that is met. Both options additionally treat network deployment as');
out('distribution, which a desktop application does not trigger — but anyone');
out('putting Clew or its engine behind a network service should read both');
out('licences before doing so.');
out();
out('### Fonts — `OFL-1.1`');
out();
out('SIL Open Font License. Reserved font names may not be reused, and the fonts');
out('may not be sold on their own. Bundling them in an application is expressly');
out('permitted.');
out();
// The figure engines: not an npm dependency, so no manifest to read — the
// staged tree (Resources/mptikz) is mp-tikz-wasm's release, and its own
// NOTICE.md is the source of these rows.
out('### The figure engines — mp-tikz-wasm (GPL, LGPL, AGPL)');
out();
out('TikZ, MetaPost, LaTeX and plain-TeX figures are typeset by **mp-tikz-wasm**');
out('(https://github.com/jmckalex/mp-tikz-wasm): TeX Live\'s programs compiled to');
out('WebAssembly. It ships as an unpacked tree under `Resources/mptikz/` and runs');
out('inside the preview, a separate document Clew talks to over messages. Each');
out('part keeps its own licence:');
out();
out('| Part | Licence | Source |');
out('| --- | --- | --- |');
out('| mp-tikz-wasm\'s own code (`index.js`, `auto.js`, the glue) | LGPL-3.0-or-later | the repository above |');
out('| MetaPost (`mplib.wasm`) | public domain; with `avl.c`, LGPL-3.0-or-later | TeX Live 2025; the build in the repository |');
out('| pdfTeX and kpathsea (`tex.wasm`) | GPL-2.0-or-later / LGPL-2.1-or-later | TeX Live 2025 (https://tug.org/texlive/) |');
out('| LuaTeX (`luatex.wasm`) | GPL-2.0-or-later (with Lua 5.3, MIT, and others) | TeX Live 2025 |');
out('| dvisvgm (`dvisvgm.wasm`) | GPL-3.0-or-later (with FreeType, potrace and others) | https://github.com/mgieseki/dvisvgm |');
out('| Ghostscript (`ghostscript/gs.mjs`, `gs.wasm`), when present | **GNU AGPL v3** (`ghostscript/COPYING`, `ghostscript/LICENSE`) | Ghostscript 10.08.0 (https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/tag/gs10080) and the port\'s build, as `ghostscript/SOURCE.md` pins them |');
out('| TeX macro packages and fonts (`bundles/`) | LPPL 1.3c and package-specific free licences; Knuth\'s, AMS and GUST font licences; dvips\'s headers GPL | TeX Live 2025 |');
out();
out('**Where the source is offered.** The corresponding source of every engine —');
out('the upstream sources, the patches and a reproducible build — is in the');
out('mp-tikz-wasm repository and attached to the GitHub release Clew pins');
out('(`src/shared/mptikz-manifest.json`: the archive and its SHA-256), and');
out('Ghostscript\'s as `ghostscript/SOURCE.md` names it, beside the module in');
out('every copy of Clew that ships it. mp-tikz-wasm\'s own `NOTICE.md` has the');
out('full table.');
out();
if (noText.length) {
	out('### Components shipping no licence file');
	out();
	out('These declare a licence in their manifest but ship no licence text. The');
	out('declared identifier is reproduced; the canonical text is the standard text');
	out('of that licence.');
	out();
	for (const p of noText) out(`- \`${p.name}@${p.version}\` — ${p.licence}`);
	out();
}
out('---');
out();
out('## Every component');
out();
for (const p of packages) {
	out(`### ${p.name} \`${p.version}\``);
	out();
	out(`**Licence:** ${p.licence}  `);
	if (p.homepage) out(`**Source:** ${String(p.homepage).replace(/^git\+/, '').replace(/\.git$/, '')}`);
	out();
	if (p.text) {
		out('```text');
		out(p.text);
		out('```');
	} else {
		out('_No licence file is distributed with this package._');
	}
	out();
}

fs.writeFileSync(path.join(root, 'THIRD-PARTY-NOTICES.md'), lines.join('\n') + '\n');
console.log(`third-party notices: ${packages.length} components, `
	+ `${(lines.join('\n').length / 1024).toFixed(0)} KB, ${noText.length} without licence text`);
