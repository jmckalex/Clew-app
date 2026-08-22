// Refresh the vendored jmarkdown mirror from the golden master.
//
// The master lives outside this repo (JMARKDOWN_SRC, default
// ~/Sites/jmckalex/software/jmarkdown) and is the ONLY place the engine is
// ever edited. vendor/jmarkdown is a dumb mirror of its runtime files —
// src/, package.json, lockfile — recreated from scratch on every sync so it
// can never drift. `npm run dev` and `npm run package` sync automatically
// when the master is present; on machines without it (CI, other clones) the
// committed mirror is used as-is.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = process.env.JMARKDOWN_SRC
	?? path.join(os.homedir(), 'Sites', 'jmckalex', 'software', 'jmarkdown');
const dest = path.join(root, 'vendor', 'jmarkdown');

if (!fs.existsSync(path.join(source, 'src', 'watch-worker.js'))) {
	console.log(`vendor-jmarkdown: master not found at ${source}; keeping committed mirror.`);
	process.exit(0);
}

let describe = 'unknown';
try {
	const hash = execSync('git rev-parse --short HEAD', { cwd: source }).toString().trim();
	const branch = execSync('git branch --show-current', { cwd: source }).toString().trim();
	const dirty = execSync('git status --porcelain', { cwd: source }).toString().trim() ? ' (dirty tree)' : '';
	describe = `${branch}@${hash}${dirty}`;
} catch { /* master may not be a git checkout */ }

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(source, 'src'), path.join(dest, 'src'), { recursive: true });
for (const file of ['package.json', 'package-lock.json', 'LICENSE', 'LICENSE.md', 'README.md']) {
	const from = path.join(source, file);
	if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, file));
}

fs.writeFileSync(path.join(dest, 'VENDOR.md'), `# Vendored jmarkdown — DO NOT EDIT

This directory is a dumb mirror of the jmarkdown golden master and is
overwritten wholesale by \`npm run sync-engine\`. Make every engine change
in the master checkout (${source}) and re-sync.

Synced from: ${describe}
Synced at: ${new Date().toISOString()}
`);

console.log(`vendor-jmarkdown: mirrored ${describe} → vendor/jmarkdown`);
