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
// makeindex's distribution notice, byte for byte as the release archive's
// licenses/COPYING.makeindex carries it from TeX Live's source (its tabs as
// \t, its trailing spaces kept) — what THIRD-PARTY-NOTICES.md holds between
// the notice's ``` fences.
const MAKEINDEX_NOTICE = [
	'',
	'\t\t\tMakeIndex Distribution Notice',
	'',
	'\t\t\t\t11/11/1989',
	'',
	'\tCopyright (C) 1989 by Chen & Harrison International Systems, Inc.  ',
	'\tCopyright (C) 1988 by Olivetti Research Center',
	'\tCopyright (C) 1987 by Regents of the University of California',
	'',
	'\tAuthor:\t',
	'\t  \tPehong Chen',
	'\t\tChen & Harrison International Systems, Inc.',
	'\t\tPalo Alto, California',
	'\t  \tUSA',
	'',
	'Permission is hereby granted to make and distribute original copies of',
	'this program provided that the copyright notice and this permission',
	'notice are preserved and provided that the recipient is not asked to',
	'waive or limit his right to redistribute copies as allowed by this',
	'permission notice and provided that anyone who receives an executable',
	'form of this program is granted access to a machine-readable form of',
	'the source code for this program at a cost not greater than reasonable',
	'reproduction, shipping, and handling costs.  Executable forms of this',
	'program distributed without the source code must be accompanied by a',
	'conspicuous copy of this permission notice and a statement that tells',
	'the recipient how to obtain the source code.',
	'                                                                       ',
	'Permission is granted to distribute modified versions of all or part',
	'of this program under the conditions above with the additional',
	'requirement that the entire modified work must be covered by a',
	'permission notice identical to this permission notice.  Anything',
	'distributed with and usable only in conjunction with something derived',
	'from this program, whose useful purpose is to extend or adapt or add',
	'capabilities to this program, is to be considered a modified version',
	'of this program under the requirement above.  Ports of this program to',
	'other systems not supported in the distribution are also considered',
	'modified versions.  All modified versions should be reported back to',
	'the author.',
	'',
	'This program is distributed with no warranty of any sort.  No',
	'contributor accepts responsibility for the consequences of using this',
	'program or for whether it serves any particular purpose.',
].join('\n');
// The figure engines: not an npm dependency, so no package manifest to read —
// the staged tree (Resources/mptikz) is mp-tikz-wasm's release, and its own
// NOTICE.md is the source of these rows. The pin names the release, and since
// 0.4.0 the Ghostscript module's corresponding source as a release asset of
// its own, which the row offers (never downloaded or staged by Clew).
const mptikz = JSON.parse(fs.readFileSync(path.join(root, 'src', 'shared', 'mptikz-manifest.json'), 'utf8'));
const gsSource = mptikz.ghostscript?.source;
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
out('| BibTeX (`bibtex.wasm`) | BibTeX\'s own terms (as Knuth\'s TeX) / LGPL-2.1-or-later (kpathsea) | BibTeX 0.99d, TeX Live 2025, unmodified |');
out('| makeindex (`makeindex.wasm`) | **MakeIndex Distribution Notice** (below) / LGPL-2.1-or-later (kpathsea) | makeindex 2.17, TeX Live 2025 (`texk/makeindexk`), unmodified |');
out(`| Ghostscript (\`ghostscript/gs.mjs\`, \`gs.wasm\`), when present | **GNU AGPL v3** (\`ghostscript/COPYING\`, \`ghostscript/LICENSE\`) | ${gsSource ? `the corresponding source, ${gsSource.url} (SHA-256 ${gsSource.sha256}), and ` : ''}Ghostscript 10.08.0 (https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/tag/gs10080) and the port's build, as \`ghostscript/SOURCE.md\` pins them |`);
out('| TeX macro packages and fonts (`bundles/`) | LPPL 1.3c and package-specific free licences; Knuth\'s, AMS and GUST font licences; dvips\'s headers GPL | TeX Live 2025 |');
out('| EB Garamond and Garamond-Math (`bundles/latex-doc`) | SIL Open Font License 1.1 | The EB Garamond Project Authors (Georg Duffner, Octavio Pardo); Garamond-Math, Yuansheng Zhao — TeX Live\'s `ebgaramond` and `garamond-math`, unmodified |');
out('| The `latex-doc` bundle\'s packages, BibTeX and makeindex styles, and hyphenation patterns (`bundles/latex-doc`) | LPPL 1.3c, 1.3 or 1.2; MIT (enumitem, titlesec, hyph-utf8); each pattern file\'s own free licence, stated in its header | TeX Live 2025, unmodified |');
out();
out('**Where the source is offered.** The corresponding source of every engine —');
out('the upstream sources, the patches and a reproducible build — is in the');
out('mp-tikz-wasm repository and attached to the GitHub release Clew pins');
out('(`src/shared/mptikz-manifest.json`: the archive and its SHA-256), and');
out(`Ghostscript's${gsSource ? ` in the release's own source archive, \`${gsSource.archive}\`,` : ''} as`);
out('`ghostscript/SOURCE.md` names it, beside the module in every copy of Clew');
out('that ships it. mp-tikz-wasm\'s own `NOTICE.md` has the full table.');
out();
// makeindex's notice asks that an executable shipped without its source come
// with a conspicuous copy of the notice and a statement of where the source
// is: the staged tree carries makeindex.wasm (mp-tikz-wasm 0.5.0 and later)
// but not the release's licenses/, so both are here.
out('**makeindex** (`makeindex.wasm`) is distributed without its source. Its');
out('source is makeindex 2.17 in TeX Live 2025\'s source tree, `texk/makeindexk`');
out('(https://tug.org/texlive/), and in the mp-tikz-wasm repository above');
out('(`vendor/texlive-source/texk/makeindexk` after `scripts/extract-vendor.sh`).');
out('Its notice, as in TeX Live\'s source:');
out();
out('```');
for (const line of MAKEINDEX_NOTICE.split('\n')) out(line);
out('```');
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
