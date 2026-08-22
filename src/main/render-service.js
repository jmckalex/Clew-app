// The jmarkdown render service: turns vault notes into full HTML documents
// for reading mode / previews.
//
// The engine must never run in Clew's own process (a build mutates the marked
// singleton, `global`, String.prototype, and the import cache, and some error
// paths call process.exit). So this service adopts jmarkdown's own watch-mode
// architecture: fork the engine's one-shot warm worker (watch-worker.js,
// reused verbatim), keep exactly one pre-warmed standby, consume it per build
// while the replacement warms, and drop stale results via a generation guard.
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CH } from '../shared/channels.js';

const require = createRequire(import.meta.url);
const WORKER_PATH = require.resolve('jmarkdown/src/watch-worker.js');

const REBUILD_DEBOUNCE_MS = 300;

// TikZ/MetaPost/mermaid-cli shell out to latex/dvisvgm/mpost by name; a
// dock-launched app's PATH lacks the usual tool locations, so append them.
export function toolchainPath() {
	const extras = ['/Library/TeX/texbin', '/opt/homebrew/bin', '/usr/local/bin'];
	const current = (process.env.PATH ?? '').split(':');
	return [...current, ...extras.filter((dir) => !current.includes(dir))].join(':');
}

export class RenderService {
	vaultRoot = null;
	engineDir = null;
	cacheDir = null;
	/** @type {(channel: string, payload: any) => void} */
	send = () => {};

	#standby = null; // {child, ready: Promise<child>}
	#generation = 0;
	/** Per-vault rendering options (.clew/vault-settings.json). */
	#vaultOptions = {};
	/** vault-relative note paths with an open preview (rendered eagerly on change) */
	#subscribed = new Map(); // path -> subscriber count
	/** per-path render bookkeeping: {mtimeMs, htmlFile, inflight: Promise|null, dirty} */
	#notes = new Map();
	#rebuildTimers = new Map();

	/** dist/ directory (engine assets: wikilinks.js, clew-template.html). */
	constructor(distDir) {
		this.distDir = distDir;
	}

	openVault(vaultRoot) {
		this.closeVault();
		this.vaultRoot = vaultRoot;
		this.engineDir = path.join(vaultRoot, '.clew', 'engine');
		this.cacheDir = path.join(vaultRoot, '.clew', 'cache', 'html');
		fs.mkdirSync(path.join(this.engineDir, '.jmarkdown'), { recursive: true });
		fs.mkdirSync(this.cacheDir, { recursive: true });
		try {
			this.#vaultOptions = JSON.parse(
				fs.readFileSync(path.join(vaultRoot, '.clew', 'vault-settings.json'), 'utf8'));
		} catch {
			this.#vaultOptions = {};
		}
		this.#writeEngineConfig();
		this.#spawnStandby();
	}

	/**
	 * Vault-level render options changed (e.g. the jmarkdown-project toggle):
	 * rewrite the engine config, discard the standby worker (it imported the
	 * old config), forget cached renders, and re-render open previews.
	 */
	reconfigure(options) {
		Object.assign(this.#vaultOptions, options);
		if (!this.vaultRoot) return;
		this.#writeEngineConfig();
		this.#standby?.child.kill();
		this.#spawnStandby();
		this.#notes.clear();
		for (const relPath of this.#subscribed.keys()) {
			this.render(relPath).catch(() => {});
		}
	}

	closeVault() {
		this.#standby?.child.kill();
		this.#standby = null;
		this.vaultRoot = null;
		this.#subscribed.clear();
		this.#notes.clear();
		for (const timer of this.#rebuildTimers.values()) clearTimeout(timer);
		this.#rebuildTimers.clear();
		this.#generation++;
	}

	// The engine reads ./.jmarkdown/config.json relative to the worker's cwd at
	// import time — which is why the worker's cwd is <vault>/.clew/engine/, a
	// Clew-owned directory (vault roots stay clean; a vault-level .jmarkdown/
	// config for CLI use is untouched and simply not consulted here).
	#writeEngineConfig() {
		const engineAssets = path.join(this.distDir, 'engine');
		const config = {
			// "jmarkdown project" vaults (the book manuscript case) re-enable
			// the engine's own-line [[file.md]] inclusion in previews.
			'File inclusion': this.#vaultOptions.jmarkdownProject === true,
			'Header style': 'fenced',
			'Template': path.join(engineAssets, 'clew-template.html'),
			'Extensions': [
				`wikiembed, wikilink from ${path.join(engineAssets, 'wikilinks.js')}`,
				`mermaidFence from ${path.join(engineAssets, 'obsidian-fences.js')}`,
			],
			'MathJax': { 'src': '/__clew_assets__/mathjax/tex-svg.js' },
			'Mermaid': '/__clew_assets__/mermaid/mermaid.min.js',
			'Fontawesome': '/__clew_assets__/fontawesome/all.min.js',
			'Highlight src': '/__clew_assets__/highlight/atom-one-dark.min.css',
		};
		fs.writeFileSync(
			path.join(this.engineDir, '.jmarkdown', 'config.json'),
			JSON.stringify(config, null, 2),
		);
	}

	#spawnStandby() {
		if (!this.vaultRoot) return;
		const child = fork(WORKER_PATH, [], {
			cwd: this.engineDir,
			stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
			env: {
				...process.env,
				PATH: toolchainPath(),
				CLEW_VAULT_ROOT: this.vaultRoot,
				// Engine console chatter goes to the pipes; keep them from filling.
			},
		});
		child.stdout.on('data', () => {});
		child.stderr.on('data', (chunk) => {
			if (process.env.CLEW_DEV) process.stderr.write(`[render-worker] ${chunk}`);
		});
		const ready = new Promise((resolve, reject) => {
			const onMessage = (msg) => {
				if (msg?.type === 'ready') {
					child.off('message', onMessage);
					resolve(child);
				}
			};
			child.on('message', onMessage);
			child.once('exit', () => reject(new Error('render worker died during warm-up')));
			child.once('error', reject);
		});
		ready.catch(() => {});
		this.#standby = { child, ready };
	}

	#takeStandby() {
		const standby = this.#standby;
		this.#spawnStandby(); // replacement warms while the taken worker builds
		return standby;
	}

	htmlPathFor(relPath) {
		const hash = crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 16);
		return path.join(this.cacheDir, `${hash}.html`);
	}

	/** Render if the cached HTML is missing or stale; resolves to the html file. */
	async ensureRendered(relPath) {
		const abs = path.join(this.vaultRoot, relPath);
		const mtimeMs = fs.statSync(abs).mtimeMs;
		const entry = this.#notes.get(relPath);
		if (entry?.inflight) return entry.inflight;
		if (entry && entry.mtimeMs >= mtimeMs && fs.existsSync(entry.htmlFile)) {
			return entry.htmlFile;
		}
		return this.render(relPath);
	}

	/** Unconditional render (coalesced: concurrent calls share one build). */
	async render(relPath) {
		let entry = this.#notes.get(relPath);
		if (entry?.inflight) {
			entry.dirty = true; // re-render once the current build lands
			return entry.inflight;
		}
		if (!entry) {
			entry = { mtimeMs: 0, htmlFile: this.htmlPathFor(relPath), inflight: null, dirty: false };
			this.#notes.set(relPath, entry);
		}
		entry.inflight = this.#build(relPath, entry).finally(() => {
			entry.inflight = null;
			if (entry.dirty) {
				entry.dirty = false;
				this.render(relPath).catch(() => {});
			}
		});
		return entry.inflight;
	}

	async #build(relPath, entry) {
		const generation = this.#generation;
		const abs = path.join(this.vaultRoot, relPath);
		const mtimeMs = fs.statSync(abs).mtimeMs;
		const standby = this.#takeStandby();
		const child = await standby.ready;

		const result = await new Promise((resolve) => {
			const onMessage = (msg) => {
				if (msg?.type === 'done' || msg?.type === 'error') resolve(msg);
			};
			child.on('message', onMessage);
			child.once('exit', (code) => {
				resolve({ type: 'error', message: `render worker exited (code ${code}) without a result` });
			});
			child.send({
				type: 'build',
				file: abs,
				options: { to: 'html', output: entry.htmlFile },
			});
		});

		if (generation !== this.#generation) throw new Error('stale render (vault closed)');

		if (result.type === 'done') {
			entry.mtimeMs = mtimeMs;
			this.send(CH.EV_RENDER_DONE, { path: relPath });
			return entry.htmlFile;
		}
		this.send(CH.EV_RENDER_ERROR, { path: relPath, message: result.message, stack: result.stack });
		throw new Error(result.message);
	}

	// ---- subscriptions (open previews re-render on file change) -----------

	subscribe(relPath) {
		this.#subscribed.set(relPath, (this.#subscribed.get(relPath) ?? 0) + 1);
	}

	unsubscribe(relPath) {
		const count = (this.#subscribed.get(relPath) ?? 1) - 1;
		if (count <= 0) this.#subscribed.delete(relPath);
		else this.#subscribed.set(relPath, count);
	}

	/** Called by the vault watcher on every content change. */
	onFileChanged(relPath) {
		if (!this.#subscribed.has(relPath)) return;
		clearTimeout(this.#rebuildTimers.get(relPath));
		this.#rebuildTimers.set(relPath, setTimeout(() => {
			this.#rebuildTimers.delete(relPath);
			this.render(relPath).catch(() => {}); // errors already broadcast
		}, REBUILD_DEBOUNCE_MS));
	}
}
