// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The engine runs on ITS OWN lockfile here as it does in the app
// (scripts/engine-deps.js): every dependency the vendored engine names
// resolves, from its own source, inside vendor/jmarkdown/node_modules at the
// version its lockfile pins — what packaging installs and ships. Until
// 2026-11-27 dev and CI took them from Clew's root lockfile (marked 15.0.12
// where 16.2.1 shipped). A checkout without `npm run engine-deps` (or
// `sync-engine`) fails here, by name, rather than testing another engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const engine = path.join(repo, 'vendor', 'jmarkdown');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

test('every engine dependency resolves inside the engine\'s own node_modules, at its lockfile\'s version', () => {
	const deps = Object.keys(read(path.join(engine, 'package.json')).dependencies);
	const lock = read(path.join(engine, 'package-lock.json')).packages;
	const req = createRequire(path.join(engine, 'src', 'watch-worker.js'));
	const wrong = [];
	for (const name of deps) {
		const own = path.join(engine, 'node_modules', name, 'package.json');
		if (!fs.existsSync(own)) { wrong.push(`${name}: not installed in vendor/jmarkdown/node_modules — run \`npm run engine-deps\``); continue; }
		let resolved;
		try { resolved = fs.realpathSync(req.resolve(name)); } catch { resolved = null; }
		if (resolved && !resolved.startsWith(fs.realpathSync(path.join(engine, 'node_modules', name)))) wrong.push(`${name}: resolves to ${path.relative(repo, resolved)}`);
		const version = read(own).version;
		if (version !== lock[`node_modules/${name}`]?.version) wrong.push(`${name}: ${version}, the lockfile ${lock[`node_modules/${name}`]?.version}`);
	}
	assert.deepEqual(wrong, []);
	assert.equal(read(path.join(engine, 'node_modules', 'marked', 'package.json')).version, lock['node_modules/marked'].version);
});

test('dev, CI and packaging install them by the one helper', () => {
	const src = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
	assert.match(src('scripts/vendor-jmarkdown.js'), /installEngineDeps\(dest\)/, 'sync-engine');
	assert.match(src('scripts/package.js'), /installEngineDeps\(staging, \{ force: true, stamp: false \}\)/, 'packaging');
	assert.doesNotMatch(src('scripts/package.js'), /npm (ci|install) --omit=dev/, 'no second copy of the command in packaging');
	assert.match(src('.github/workflows/test.yml'), /run: npm run engine-deps/, 'CI');
	assert.equal(read(path.join(repo, 'package.json')).scripts['engine-deps'], 'node scripts/engine-deps.js');
});
