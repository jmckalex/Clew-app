// Dev loop: esbuild in watch mode + a managed Electron instance.
// Rebuilds of main/preload respawn Electron; rebuilds of the renderer
// bundle or static assets are picked up by main's dist-watcher, which
// reloads the window (see src/main/main.js, CLEW_DEV).
import * as esbuild from 'esbuild';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { bundles, copyStatic } from './build.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const electronBin = createRequire(import.meta.url)('electron');

let child = null;
let respawnTimer = null;

function spawnElectron() {
	child = spawn(electronBin, ['.'], {
		cwd: root,
		stdio: 'inherit',
		env: { ...process.env, CLEW_DEV: '1' },
	});
	child.on('exit', (code, signal) => {
		child = null;
		// Respawn only when we killed it for a rebuild; a user quit ends dev.
		if (signal !== 'SIGTERM') process.exit(code ?? 0);
	});
}

function scheduleRespawn() {
	clearTimeout(respawnTimer);
	respawnTimer = setTimeout(() => {
		if (child) {
			child.once('exit', spawnElectron);
			child.kill('SIGTERM');
		} else {
			spawnElectron();
		}
	}, 100);
}

function watchPlugin(name, onRebuild) {
	return {
		name: `clew-watch-${name}`,
		setup(build) {
			let first = true;
			build.onEnd((result) => {
				if (result.errors.length) return;
				if (first) { first = false; return; }
				console.log(`[dev] rebuilt ${name}`);
				onRebuild?.();
			});
		},
	};
}

copyStatic();

const contexts = await Promise.all(
	bundles.map((opts) => {
		const name = path.basename(path.dirname(opts.entryPoints[0]));
		const needsRespawn = name === 'main' || name === 'preload';
		return esbuild.context({
			...opts,
			plugins: [watchPlugin(name, needsRespawn ? scheduleRespawn : null)],
		});
	}),
);
await Promise.all(contexts.map((c) => c.watch()));

// Static assets: recopy on change (macOS supports recursive fs.watch).
let copyTimer = null;
fs.watch(path.join(root, 'src/renderer/styles'), { recursive: true }, () => {
	clearTimeout(copyTimer);
	copyTimer = setTimeout(() => { copyStatic(); console.log('[dev] copied static assets'); }, 100);
});
fs.watch(path.join(root, 'src/renderer/index.html'), () => {
	clearTimeout(copyTimer);
	copyTimer = setTimeout(() => { copyStatic(); console.log('[dev] copied static assets'); }, 100);
});
fs.watch(path.join(root, 'src/engine'), { recursive: true }, () => {
	clearTimeout(copyTimer);
	copyTimer = setTimeout(() => { copyStatic(); console.log('[dev] copied static assets'); }, 100);
});

spawnElectron();
console.log('[dev] watching — quit the Clew window (or Ctrl+C here) to stop.');
