// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// An EXPORT's engine run, with the engine's Obsidian links on (jmarkdown
// obsidian-links.js — the owner, 2026-10-05: "teach it, Clew switches it
// on"). The engine's own one-shot worker (watch-worker.js) takes its options
// over IPC, which carries no functions, and the resolvers are functions; so
// this worker hands the engine its resolvers itself, and otherwise does
// exactly what that worker does: import the engine, say ready, run ONE
// build, report its output and warnings, exit.
//
//   resolveEmbed(name, { file }) — an image embed resolved as the preview
//     resolves one (vault-files.js#resolveFileTarget, wikilinks.js's own: by
//     name across the vault, the shortest path first, clamped by realpath in
//     a vault this device does not trust: CLEW_VAULT_ROOT,
//     CLEW_VAULT_RESTRICTED), written RELATIVE to the folder of the file the
//     export WRITES (processFile's `output`) — never absolute, which would put
//     the user's home folder and vault layout into a .tex or .html they share,
//     and not relative to the note, which only works for an export saved
//     beside the note (TeX never searches TEXINPUTS for a `../` path, and the
//     engine copies an image path into HTML as written — measured). For LaTeX
//     the folder's realpath (TeX's `..` is physical). A BOOK's
//     embeds stay absolute for now: the engine rebases a chapter's relative
//     path onto the master's folder, which its .tex in build/ is not.
//     Nothing found: the name stays as written, relative to the note.
//   resolveLink() — nothing: an export has no page to point a note's link at,
//     so a [[link]] prints as its text (the alias, or "Note > Heading").
//
// argv[2] is the engine's watch-worker.js; its folder holds index.js.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveFileTarget } from './vault-files.js';

const engineDir = path.dirname(process.argv[2]);
const load = (name) => import(pathToFileURL(path.join(engineDir, name)).href);
const { processFile } = await load('index.js');
const { getWarnings } = await load('warnings.js');

let building = null;   // the build's message: its file and options

const resolveEmbed = (name) => {
	const rel = resolveFileTarget(String(name));
	if (!rel) return null;
	const abs = path.join(process.env.CLEW_VAULT_ROOT, rel);
	const output = building.options?.output;
	if (building.options?.chapters?.length || !output) return abs;
	// TeX climbs `..` from its REAL working folder, a browser from the URL it
	// was given: under a symlinked folder (macOS's /var → /private/var holds
	// every temp folder — `clew export`'s build) the two count differently.
	let from = path.dirname(path.resolve(output));
	if (building.options?.to === 'latex') {
		try { from = fs.realpathSync(from); } catch { /* not there yet: as given */ }
	}
	return path.relative(from, abs).split(path.sep).join('/');
};

if (process.send) process.send({ type: 'ready' });

process.once('message', async (msg) => {
	if (!msg || msg.type !== 'build') return;
	building = msg;
	try {
		const options = { ...msg.options, obsidianLinks: { resolveEmbed, resolveLink: () => null } };
		const { outFile } = await processFile(msg.file, options);
		if (process.send) process.send({ type: 'done', output: outFile, warnings: getWarnings() });
	} catch (err) {
		if (process.send) process.send({ type: 'error', message: String((err && err.message) || err) });
	} finally {
		process.exit(0);
	}
});
