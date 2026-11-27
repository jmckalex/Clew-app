// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The engine's production dependencies, installed from ITS OWN lockfile —
// the one command `npm run sync-engine` (into vendor/jmarkdown, for dev),
// CI (the same) and packaging (into build-engine/jmarkdown, what ships) all
// run, so the three cannot drift apart. Until 2026-11-27 dev and CI resolved
// the engine's imports through Clew's ROOT lockfile instead: marked 15.0.12
// where the app shipped 16.2.1, and 13 other dependencies at other versions
// — measured over the demo and study vaults' 156 exports, marked alone made
// a difference: 16 more `data-source-line` paragraph stamps in 8 notes'
// HTML in what shipped than in what dev and CI tested (Clew-boss's catch).
//
//   node scripts/engine-deps.js [dir] [--force]
//
// `dir` defaults to vendor/jmarkdown. Outside packaging the install is skipped
// while node_modules was installed from this package.json and lockfile (a
// stamp in node_modules records their hash): `npm run dev` re-syncs every
// time it starts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// --legacy-peer-deps matches the golden master's own installed reality
// (marked-emoji's peer range trails the marked the engine actually uses).
export const ENGINE_DEPS_COMMAND = 'npm ci --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps';
export const ENGINE_DEPS_FALLBACK = 'npm install --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps';
const STAMP = '.clew-engine-deps.json';

/** The hash of the manifest and lockfile the install is made from. */
function sourceHash(dir) {
	const h = crypto.createHash('sha256');
	for (const file of ['package.json', 'package-lock.json']) {
		const p = path.join(dir, file);
		h.update(file).update(fs.existsSync(p) ? fs.readFileSync(p) : '');
	}
	return h.digest('hex');
}

/**
 * Install `dir`'s production dependencies from its lockfile.
 *
 * @param {string} dir - the engine package (holding package.json + lockfile)
 * @param {{ force?: boolean, stamp?: boolean, log?: (s: string) => void }} [options]
 *   force: install even when the stamp says it is current; stamp: record the
 *   hash afterwards (packaging does not — the app's files stay the engine's)
 * @returns {'current' | 'ci' | 'fallback'}
 */
export function installEngineDeps(dir, { force = false, stamp = true, log = console.log } = {}) {
	const want = sourceHash(dir);
	const stampFile = path.join(dir, 'node_modules', STAMP);
	if (!force && fs.existsSync(stampFile)) {
		try {
			if (JSON.parse(fs.readFileSync(stampFile, 'utf8')).hash === want) {
				log(`engine-deps: ${path.relative(root, dir) || dir} is current`);
				return 'current';
			}
		} catch { /* reinstall */ }
	}
	let how = 'ci';
	try {
		execSync(ENGINE_DEPS_COMMAND, { cwd: dir, stdio: 'inherit' });
	} catch {
		// The lockfile no longer matches its package.json: the vendored
		// engine drifted. Say so loudly — never quietly.
		const bar = '!'.repeat(72);
		console.warn(`\n${bar}\nengine-deps: \`npm ci\` FAILED in ${dir} — the vendored lockfile has drifted from\nits package.json. Falling back to \`npm install\`; the versions installed may\nnot be the lockfile's. Fix the lockfile in the jmarkdown master and re-sync.\n${bar}\n`);
		execSync(ENGINE_DEPS_FALLBACK, { cwd: dir, stdio: 'inherit' });
		how = 'fallback';
	}
	if (stamp) fs.writeFileSync(stampFile, `${JSON.stringify({ hash: want, how })}\n`);
	log(`engine-deps: installed ${path.relative(root, dir) || dir} (${how})`);
	return how;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const dir = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(root, 'vendor', 'jmarkdown'));
	installEngineDeps(dir, { force: args.includes('--force') });
}
