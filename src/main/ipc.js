// All ipcMain handlers in one place. Handlers are thin: validate, delegate
// to the vault manager or settings, return plain JSON-safe values.
import { ipcMain, BrowserWindow, shell } from 'electron';
import { CH } from '../shared/channels.js';
import { vaults } from './vault.js';
import { settings } from './settings.js';
import { appMenu } from './menu.js';
import { renderService } from './main.js';
import { indexer } from './indexer.js';
import { propagateRename } from './rename-links.js';
import { SearchService } from './search.js';
import { exportNote } from './export.js';
import { parseBib } from '../shared/bib.js';
import fs from 'node:fs';
import nodePath from 'node:path';

const searchService = new SearchService({ vaults, indexer });
const bibCache = new Map(); // abs path -> {mtimeMs, entries}

// Vault-state file names must stay simple basenames (workspace.json etc.).
const sanitizeStateName = (name) => {
	if (!/^[\w-]+\.json$/.test(name)) throw new Error(`Bad state name: ${name}`);
	return name;
};

export function registerIpc() {
	const handle = (channel, fn) => ipcMain.handle(channel, (event, payload) => fn(payload, event));

	handle(CH.VAULT_OPEN_DIALOG, (_p, event) =>
		vaults.openDialog(BrowserWindow.fromWebContents(event.sender)));
	handle(CH.VAULT_OPEN_PATH, ({ path }) => vaults.open(path));
	handle(CH.VAULT_CURRENT, () => vaults.info);
	handle(CH.VAULT_RECENT, () => settings.get('recentVaults'));
	handle(CH.VAULT_TREE, () => vaults.tree());

	handle(CH.NOTE_READ, ({ path }) => vaults.readNote(path));
	handle(CH.NOTE_WRITE, ({ path, content }) => vaults.writeNote(path, content));
	handle(CH.NOTE_CREATE, ({ path }) => vaults.createNote(path));
	handle(CH.FS_CREATE_FOLDER, ({ path }) => vaults.createFolder(path));
	handle(CH.FS_RENAME, ({ path, newPath }) => {
		vaults.rename(path, newPath);
		// Rewrite [[links]] pointing at the renamed note(s), using the
		// pre-rename index state (the watcher re-indexes right after).
		const result = propagateRename({ oldRel: path, newRel: newPath, indexer, vaults });
		return result;
	});

	handle(CH.INDEX_GET, () => (vaults.isOpen ? indexer.snapshot() : null));
	handle(CH.SEARCH, ({ query }) => searchService.search(query));
	handle(CH.UNLINKED_MENTIONS, ({ path }) => searchService.unlinkedMentions(path));
	handle(CH.FS_TRASH, ({ path }) => vaults.trash(path));
	handle(CH.FS_REVEAL, ({ path }) => vaults.reveal(path));
	handle(CH.ATTACH_SAVE, ({ name, data }) =>
		vaults.saveAttachment(name, data, settings.get('attachmentFolder') || 'Attachments'));

	// Citation completion: every entry from every .bib in the vault,
	// mtime-cached per file.
	handle(CH.BIB_ENTRIES, () => {
		if (!vaults.isOpen) return [];
		const out = [];
		const walk = (dir) => {
			let entries;
			try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
			for (const entry of entries) {
				if (entry.name.startsWith('.') || ['node_modules', '.trash'].includes(entry.name)) continue;
				const abs = nodePath.join(dir, entry.name);
				if (entry.isDirectory()) walk(abs);
				else if (entry.name.toLowerCase().endsWith('.bib')) {
					const mtimeMs = fs.statSync(abs).mtimeMs;
					const cached = bibCache.get(abs);
					const entries2 = cached?.mtimeMs === mtimeMs
						? cached.entries
						: parseBib(fs.readFileSync(abs, 'utf8'));
					bibCache.set(abs, { mtimeMs, entries: entries2 });
					const rel = nodePath.relative(vaults.root, abs);
					out.push(...entries2.map((e) => ({ ...e, file: rel })));
				}
			}
		};
		walk(vaults.root);
		return out;
	});

	handle(CH.MENU_STATE, (state) => appMenu.update(state));

	handle(CH.RENDER_SUBSCRIBE, ({ path }) => renderService.subscribe(path));
	handle(CH.RENDER_UNSUBSCRIBE, ({ path }) => renderService.unsubscribe(path));
	handle(CH.SHELL_OPEN_EXTERNAL, ({ url }) => {
		if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
	});

	handle(CH.WORKSPACE_LOAD, () => vaults.loadState('workspace.json'));
	handle(CH.WORKSPACE_SAVE, (state) => vaults.saveState('workspace.json', state));
	handle(CH.SETTINGS_GET, () => settings.get());
	handle(CH.SETTINGS_SET, ({ key, value }) => settings.set(key, value));
	handle(CH.VSTATE_LOAD, ({ name }) => vaults.loadState(sanitizeStateName(name)));
	handle(CH.VSTATE_SAVE, ({ name, data }) => vaults.saveState(sanitizeStateName(name), data));

	// Vault-level settings; render-affecting keys reconfigure the engine.
	handle(CH.VAULT_SETTINGS_GET, () => vaults.loadState('vault-settings.json') ?? {});
	handle(CH.VAULT_SETTINGS_SET, ({ key, value }) => {
		const current = vaults.loadState('vault-settings.json') ?? {};
		current[key] = value;
		vaults.saveState('vault-settings.json', current);
		if (key === 'jmarkdownProject') {
			renderService.reconfigure({ jmarkdownProject: value === true });
		}
		return current;
	});

	handle(CH.EXPORT_NOTE, ({ path, format }, event) =>
		exportNote({
			win: BrowserWindow.fromWebContents(event.sender),
			vaults,
			relPath: path,
			format,
		}));

	// User CSS snippets: <vault>/.clew/snippets/*.css, injected by the renderer.
	handle(CH.SNIPPETS_GET, () => {
		if (!vaults.isOpen) return [];
		const dir = nodePath.join(vaults.root, '.clew', 'snippets');
		try {
			return fs.readdirSync(dir)
				.filter((f) => f.endsWith('.css'))
				.map((f) => ({ name: f, css: fs.readFileSync(nodePath.join(dir, f), 'utf8') }));
		} catch {
			return [];
		}
	});
}
