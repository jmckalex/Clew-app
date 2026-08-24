// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// electron-builder afterPack hook: ship the staged engine node_modules.
// extraResources hard-refuses to copy any node_modules directory, but the
// forked engine worker (a plain node child, outside the asar) needs its
// dependencies resolvable next to it — so copy them in here, after the app
// directory is assembled and before any dmg/zip is produced.
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function afterPack(context) {
	const from = path.join(__dirname, '..', 'build-engine', 'jmarkdown', 'node_modules');
	// resourcesPath: inside the .app bundle on macOS, resources/ beside the
	// binary on Windows and Linux (matches process.resourcesPath at runtime).
	const resources = context.electronPlatformName === 'darwin'
		? path.join(context.appOutDir,
			`${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
		: path.join(context.appOutDir, 'resources');
	const to = path.join(resources, 'engine', 'jmarkdown', 'node_modules');
	if (!fs.existsSync(from)) {
		throw new Error(`after-pack: staged engine deps missing at ${from} — run scripts/package.js, not electron-builder directly`);
	}
	fs.rmSync(to, { recursive: true, force: true });
	fs.cpSync(from, to, { recursive: true });
	console.log(`  • after-pack: engine node_modules → Resources/engine/jmarkdown (${fs.readdirSync(to).length} packages)`);
};
