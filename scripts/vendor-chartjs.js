// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Copy Chart.js's UMD bundle (MIT) into the demo vault's Charts plugin:
//   node scripts/vendor-chartjs.js
//
// The copy is COMMITTED, like the icon: the plugin is vault content that must
// work wherever the vault travels, not a build product. Re-run after
// upgrading the chart.js dependency, then commit the result. chart.js stays
// in package.json `dependencies` so gen-notices carries its licence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const from = path.join(root, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
const to = path.join(root, 'demo-vault', '.clew', 'plugins', 'charts', 'chart.umd.js');

fs.mkdirSync(path.dirname(to), { recursive: true });
fs.copyFileSync(from, to);
const { version } = JSON.parse(
	fs.readFileSync(path.join(root, 'node_modules', 'chart.js', 'package.json'), 'utf8'));
console.log(`chart.umd.js ${version} → ${path.relative(root, to)}`);
