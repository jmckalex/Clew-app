// Packages Clew: sync the engine mirror, build bundles, stage the engine
// with its production dependencies (a plain-node child can't read inside
// app.asar, so the engine ships unpacked in the resources dir), generate
// the icon if missing, then run electron-builder. The staged engine tree is
// pure JS, so the same staging ships on every platform.
//
//   npm run package          → out/mac-arm64/Clew.app (fast, for testing)
//   npm run package:dmg      → + a distributable .dmg
//   npm run package:win      → out/Clew Setup <version>.exe (NSIS, x64)
//   npm run package:linux    → out/Clew-<version>.AppImage + .deb (x64)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run = (cmd, cwd = root) => {
	console.log(`\n> ${cmd}`);
	execSync(cmd, { cwd, stdio: 'inherit' });
};

run('node scripts/vendor-jmarkdown.js');
run('node scripts/build.js');

// Stage the engine: mirror + production node_modules, resolvable by the
// forked worker at Resources/engine/jmarkdown/src/watch-worker.js.
const staging = path.join(root, 'build-engine', 'jmarkdown');
fs.rmSync(path.join(root, 'build-engine'), { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
fs.cpSync(path.join(root, 'vendor', 'jmarkdown'), staging, { recursive: true });
// --legacy-peer-deps matches the golden master's own installed reality
// (marked-emoji's peer range trails the marked the engine actually uses).
try {
	run('npm ci --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps', staging);
} catch {
	console.log('npm ci failed (lockfile drift?); falling back to npm install');
	run('npm install --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps', staging);
}

if (!fs.existsSync(path.join(root, 'build-resources', 'icon.icns'))) {
	run('npx electron scripts/make-icon.js');
}

if (process.argv.includes('--win')) {
	run('npx electron-builder --win nsis --x64');
	console.log('\nPackaged. Installer in out/');
} else if (process.argv.includes('--linux')) {
	run('npx electron-builder --linux AppImage deb --x64');
	console.log('\nPackaged. AppImage + deb in out/');
} else {
	const dmg = process.argv.includes('--dmg');
	run(`npx electron-builder --mac ${dmg ? 'dmg' : 'dir'} --arm64`);
	console.log('\nPackaged. App at out/mac-arm64/Clew.app');
}
