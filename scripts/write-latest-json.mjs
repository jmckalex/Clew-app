// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The update feed for a release (docs/dev/auto-update.md §3):
//
//   node scripts/write-latest-json.mjs [outDir] [--out file] [--version v]
//     [--released YYYY-MM-DD] [--notes url]
//
// Reads the artifacts packaging left in outDir (default out/) and writes
// latest.json beside them (or to --out): the version, the release date, the
// "What's new" link, and per platform the SERVED file name (relative to the
// feed — Clew-docs serves both from /downloads/), its sha512 (base64, as
// electron-builder writes its own) and size. Clew-docs uploads it LAST, after
// the binaries, so it never names a file that is not there.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Built name → served name, per platform key. */
export function artifactNames(version) {
	return {
		'mac-arm64': { built: `Clew-${version}-arm64.dmg`, served: `Clew-${version}-arm64.dmg` },
		'mac-x64': { built: `Clew-${version}-x64.dmg`, served: `Clew-${version}-x64.dmg` },
		'win-x64': { built: `Clew Setup ${version}.exe`, served: `Clew-Setup-${version}.exe` },
		'linux-appimage': { built: `Clew-${version}.AppImage`, served: `Clew-${version}.AppImage` },
		'linux-deb': { built: `clew_${version}_amd64.deb`, served: `clew_${version}_amd64.deb` },
	};
}

/** The feed object, from what was found: key → { served, sha512, size }. */
export function latestJson({ version, released, notes, found }) {
	const files = {};
	for (const [key, f] of Object.entries(found)) files[key] = { url: f.served, sha512: f.sha512, size: f.size };
	return { version, released, notes, files };
}

function main() {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const args = process.argv.slice(2);
	const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args.splice(i, 2)[1]; };
	const outFile = opt('--out');
	const version = opt('--version') ?? JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
	const released = opt('--released') ?? new Date().toISOString().slice(0, 10);
	const notes = opt('--notes') ?? `https://clew-app.com/manual/whats-new.html#v${version.replace(/\./g, '-')}`;
	const dir = path.resolve(root, args[0] ?? 'out');
	const found = {};
	for (const [key, names] of Object.entries(artifactNames(version))) {
		const file = path.join(dir, names.built);
		if (!fs.existsSync(file)) { console.warn(`write-latest-json: no ${names.built} — ${key} left out`); continue; }
		const bytes = fs.readFileSync(file);
		found[key] = { served: names.served, sha512: crypto.createHash('sha512').update(bytes).digest('base64'), size: bytes.length };
	}
	const target = outFile ?? path.join(dir, 'latest.json');
	fs.writeFileSync(target, JSON.stringify(latestJson({ version, released, notes, found }), null, '\t') + '\n');
	console.log(`write-latest-json: ${Object.keys(found).length} files → ${target}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
