// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Is a build made from the sources in this checkout? (src/main/build-stamp.js)
//
//   node scripts/stale-check.mjs              dist/ (its build-stamp.json)
//   node scripts/stale-check.mjs --app <bin>  a packaged app: the stamp in its
//                                             app.asar, from the binary's path
//
// Exit 0 and one line when they match; exit 1 naming every source edited,
// added (+) or removed (-) since the build — or saying there is no stamp.
// The smoke runners call it before they launch anything (live-sweep.sh,
// render-dump.sh, pdf-sweep.sh, boot-test.sh); the harness itself checks
// again in main.js, for a scenario run by hand.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { staleSources } from '../src/main/build-stamp.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const at = process.argv.indexOf('--app');
let stampFile = path.join(root, 'dist', 'build-stamp.json');
let what = 'dist/';
if (at !== -1) {
	const bin = path.resolve(process.argv[at + 1] ?? '');
	// …/Clew.app/Contents/MacOS/Clew → …/Contents/Resources/app.asar (macOS);
	// …/resources/app.asar beside the binary elsewhere.
	const asar = [path.join(path.dirname(bin), '..', 'Resources', 'app.asar'), path.join(path.dirname(bin), 'resources', 'app.asar')]
		.find((p) => fs.existsSync(p));
	if (!asar) {
		console.error(`stale-check: no app.asar beside ${bin}`);
		process.exit(1);
	}
	const { extractFile } = await import('@electron/asar');
	stampFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clew-stamp-')), 'build-stamp.json');
	try {
		fs.writeFileSync(stampFile, extractFile(asar, path.join('dist', 'build-stamp.json')));
	} catch {
		fs.rmSync(stampFile, { force: true });
	}
	what = `the app at ${bin}`;
}
const stale = staleSources(root, stampFile);
if (!stale) {
	console.error(`stale-check: ${what} has no build stamp (dist/build-stamp.json) — it predates the check, or the build did not finish. Rebuild: node scripts/build.js${at !== -1 ? ', then package' : ''}.`);
	process.exit(1);
}
if (stale.changed.length) {
	console.error(`stale-check: ${what} was built (${stale.builtAt}) from other sources than this checkout — ${stale.changed.length} changed since: ${stale.changed.join(', ')}. Rebuild: node scripts/build.js${at !== -1 ? ', then package' : ''}.`);
	process.exit(1);
}
console.log(`stale-check: ${what} matches the sources (built ${stale.builtAt}).`);
