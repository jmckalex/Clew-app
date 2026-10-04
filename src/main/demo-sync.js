// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The bundled demo vault, brought up to date in the user's copy.
//
// A packaged Clew copies Resources/demo-vault to ~/Documents/Clew Demo Vault
// the first time it is opened (main.js#openDemoVault), and nothing touched
// that copy again — so whoever opened the demo once never saw a demo note
// added later (the owner, 2026-10-04: no App Gallery in dev.6, whose copy
// dated from 1 October). Now each opening ADDS the bundled files the copy
// lacks, and says so:
//   - never over a file: a note you changed stays yours (an updated demo
//     note does not reach an old copy — only new ones do);
//   - never into `.clew/`, nor any dot path: a vault's plugins and scripts
//     are code, and nothing slips code into a vault behind your back;
//   - never a file it delivered before: `.clew/demo-files.json` lists what
//     has been offered, so a demo note you deleted stays deleted. A copy from
//     before the list counts what it holds as delivered.
// Electron-free (tests/demo-sync.test.js).
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST = path.join('.clew', 'demo-files.json');

/** Every file under `root`, relative with `/`, no dot names anywhere. */
export function listFiles(root) {
	const out = [];
	const walk = (dir, rel) => {
		let entries;
		try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
		for (const e of entries) {
			if (e.name.startsWith('.')) continue;
			const r = rel ? `${rel}/${e.name}` : e.name;
			if (e.isDirectory()) walk(path.join(dir, e.name), r);
			else if (e.isFile()) out.push(r);
		}
	};
	walk(root, '');
	return out.sort();
}

/**
 * What to add, and what will then have been delivered.
 *
 * @param {{ bundled: string[], existing: Set<string>, delivered: Set<string>|null }} at
 * @returns {{ add: string[], delivered: string[] }}
 */
export function demoFilesToAdd({ bundled, existing, delivered }) {
	const known = delivered ?? existing;
	const add = bundled.filter((f) => !known.has(f) && !existing.has(f));
	return { add, delivered: [...new Set([...known, ...bundled])].sort() };
}

/**
 * Add to `target` (the user's copy) the files of `source` (the bundle) it
 * has never been given. Returns the relative paths added.
 */
export function syncDemoVault(source, target) {
	const manifest = path.join(target, MANIFEST);
	let delivered = null;
	try { delivered = new Set(JSON.parse(fs.readFileSync(manifest, 'utf8')).files ?? []); } catch { /* none yet */ }
	const plan = demoFilesToAdd({ bundled: listFiles(source), existing: new Set(listFiles(target)), delivered });
	const added = [];
	for (const rel of plan.add) {
		const to = path.join(target, ...rel.split('/'));
		if (fs.existsSync(to)) continue;   // a folder or link of that name
		fs.mkdirSync(path.dirname(to), { recursive: true });
		fs.copyFileSync(path.join(source, ...rel.split('/')), to, fs.constants.COPYFILE_EXCL);
		added.push(rel);
	}
	const next = JSON.stringify({ files: plan.delivered }, null, '\t');
	let before = null;
	try { before = fs.readFileSync(manifest, 'utf8'); } catch { /* none */ }
	if (before !== next) {
		fs.mkdirSync(path.dirname(manifest), { recursive: true });
		fs.writeFileSync(manifest, next);
	}
	return added;
}

/** The notice for `added`: its notes by name first, then a count. */
export function demoSyncNotice(added) {
	if (!added.length) return null;
	const notes = added.filter((f) => /\.(md|jmd)$/i.test(f)).map((f) => f.replace(/\.(md|jmd)$/i, ''));
	const named = notes.slice(0, 3).join(', ');
	const more = added.length - Math.min(notes.length, 3);
	return `The demo vault has new things from this version of Clew: ${named || `${added.length} file${added.length === 1 ? '' : 's'}`}`
		+ (named && more > 0 ? `, and ${more} more file${more === 1 ? '' : 's'}` : '') + '.';
}
