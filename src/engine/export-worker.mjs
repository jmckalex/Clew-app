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
//   resolveEmbed(name) — an image embed resolved as the preview resolves one
//     (vault-files.js#resolveFileTarget, wikilinks.js's own: by name across
//     the vault, the shortest path first, clamped by realpath in a vault this
//     device does not trust:
//     CLEW_VAULT_ROOT, CLEW_VAULT_RESTRICTED), as an absolute path, or
//     nothing — the name then stays as written, relative to the note.
//   resolveLink() — nothing: an export has no page to point a note's link at,
//     so a [[link]] prints as its text (the alias, or "Note > Heading").
//
// argv[2] is the engine's watch-worker.js; its folder holds index.js.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveFileTarget } from './vault-files.js';

const engineDir = path.dirname(process.argv[2]);
const load = (name) => import(pathToFileURL(path.join(engineDir, name)).href);
const { processFile } = await load('index.js');
const { getWarnings } = await load('warnings.js');

const resolveEmbed = (name) => {
	const rel = resolveFileTarget(String(name));
	return rel ? path.join(process.env.CLEW_VAULT_ROOT, rel) : null;
};

if (process.send) process.send({ type: 'ready' });

process.once('message', async (msg) => {
	if (!msg || msg.type !== 'build') return;
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
