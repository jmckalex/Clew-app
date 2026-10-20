// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The export pipeline's pure modules, which every host imports rather than
// copies (Clew-iOS's LaTeX exports, 2026-10-20: its UPSTREAM-LATEX-EXPORT-PLAN
// §2): no Electron, no fs, no `process` — a page has none, and a platform
// read at load would be the Mac's — and of Node's built-ins `node:path` alone,
// which a host without Node aliases (Clew-iOS's shim is posix). Each must
// import where there is no `process` at all. What they do is tested beside
// the code they came from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const MODULES = [
	'src/shared/citation-files.js',
	'src/shared/latex-engine.js',
	'src/shared/latex-engine-setting.js',
	'src/shared/export-figures.js',
];

const code = (file) => fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');

for (const file of MODULES) {
	test(`${file}: no Electron, no fs, no process; node:path the only built-in`, () => {
		const source = code(file);
		const builtins = [...source.matchAll(/from\s+['"](node:[^'"]+)['"]/g)].map((m) => m[1]);
		assert.deepEqual(builtins.filter((b) => b !== 'node:path'), []);
		assert.doesNotMatch(source, /require\(|from\s+['"](electron|fs|path)['"]/);
		assert.doesNotMatch(source, /\bprocess\b/);
	});

	test(`${file}: imports where there is no process`, () => {
		const url = new URL(`../${file}`, import.meta.url).href;
		const script = `delete globalThis.process; const m = await import(${JSON.stringify(url)}); console.log(typeof globalThis.process, Object.keys(m).length > 0);`;
		assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim(), 'undefined true');
	});
}
