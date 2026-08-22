// The native application menu. Command items dispatch renderer command ids
// over EV_MENU_COMMAND — the renderer's command registry stays the single
// source of truth for behavior, and its keydown dispatcher owns every chord
// (user rebindings, modal guards). Accelerators here are therefore
// display-only on macOS (registerAccelerator: false); the renderer pushes
// its effective keymap over MENU_STATE so the menu shows real bindings.
//
// The renderer also pushes context (vault open, active note, reading mode,
// bookmark state, sidebars, theme); the menu rebuilds only when the derived
// state actually changes, since a rebuild closes any open menu.
import { app, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { CH } from '../shared/channels.js';
import { vaults } from './vault.js';
import { settings } from './settings.js';

const isMac = process.platform === 'darwin';

const KEY_NAMES = {
	ArrowLeft: 'Left',
	ArrowRight: 'Right',
	ArrowUp: 'Up',
	ArrowDown: 'Down',
};

/** CM chord ('Mod-Shift-p') → Electron accelerator ('CmdOrCtrl+Shift+P'). */
export function chordToAccelerator(chord) {
	// A trailing '--' means the key itself is '-'.
	const parts = chord.endsWith('--')
		? [...chord.slice(0, -2).split('-'), '-']
		: chord.split('-');
	const key = parts.pop();
	// The renderer normalizes Ctrl to 'Mod', and Cmd-Tab belongs to macOS's
	// app switcher — the tab-cycling chords really mean Ctrl-Tab.
	const mod = key === 'Tab' ? 'Control' : 'CmdOrCtrl';
	const out = parts.map((p) => (p === 'Mod' ? mod : p));
	out.push(KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key));
	return out.join('+');
}

class AppMenu {
	/** @type {(channel: string, payload: any) => void} set by main.js */
	send = () => {};
	#getWindow = () => null;
	#rootDir = null;
	#lastBuilt = null;
	#state = {
		vaultOpen: false,
		noteActive: false,
		tabOpen: false,
		readingMode: false,
		pinned: false,
		bookmarked: false,
		leftSidebar: true,
		rightSidebar: true,
		theme: 'dark',
		/** command id → CM chord or null, from the renderer's effective keymap */
		hotkeys: {},
	};

	init({ getWindow, rootDir }) {
		this.#getWindow = getWindow;
		this.#rootDir = rootDir;
		this.#state.theme = settings.get('theme') ?? 'dark';
		this.#state.vaultOpen = vaults.isOpen;
		this.rebuild();
	}

	/** Renderer push over MENU_STATE. */
	update(partial) {
		Object.assign(this.#state, partial);
		this.rebuild();
	}

	rebuild() {
		const snapshot = JSON.stringify([this.#state, settings.get('recentVaults'), vaults.root]);
		if (snapshot === this.#lastBuilt) return;
		this.#lastBuilt = snapshot;
		Menu.setApplicationMenu(Menu.buildFromTemplate(this.#template()));
	}

	// ---- item helpers ------------------------------------------------------

	/** A menu item that dispatches a renderer command id. */
	#cmd(id, label, { chord, needs, type, checked } = {}) {
		const s = this.#state;
		const enabled =
			needs === 'vault' ? s.vaultOpen
			: needs === 'note' ? s.noteActive
			: needs === 'editor' ? s.noteActive && !s.readingMode
			: needs === 'tab' ? s.tabOpen
			: true;
		const item = { label, enabled, click: () => this.send(CH.EV_MENU_COMMAND, { id }) };
		// The renderer's map wins even when it says "unbound" (null).
		const effective = id in s.hotkeys ? s.hotkeys[id] : chord;
		if (effective) {
			item.accelerator = chordToAccelerator(effective);
			item.registerAccelerator = false; // display-only; renderer dispatches
		}
		if (type) {
			item.type = type;
			item.checked = !!checked;
		}
		return item;
	}

	#openVault(vaultPath) {
		try {
			vaults.open(vaultPath);
		} catch (err) {
			console.error('Failed to open vault from menu:', err);
			// Prune recent entries whose folder no longer exists.
			settings.set('recentVaults', (settings.get('recentVaults') ?? []).filter((p) => p !== vaultPath));
			this.#lastBuilt = null;
			this.rebuild();
		}
	}

	#recentSubmenu() {
		const recents = settings.get('recentVaults') ?? [];
		return [
			...recents.map((vaultPath) => ({
				label: path.basename(vaultPath),
				toolTip: vaultPath,
				type: 'checkbox',
				checked: vaults.root === vaultPath,
				click: () => this.#openVault(vaultPath),
			})),
			{ type: 'separator' },
			{
				label: 'Clear Recent Vaults',
				enabled: recents.length > 0,
				click: () => {
					settings.set('recentVaults', []);
					this.#lastBuilt = null;
					this.rebuild();
				},
			},
		];
	}

	// ---- the template ------------------------------------------------------

	#template() {
		const s = this.#state;
		const c = this.#cmd.bind(this);

		const appMenu = {
			label: app.name,
			submenu: [
				{ role: 'about' },
				{ type: 'separator' },
				c('app:settings', 'Settings…', { chord: 'Mod-,' }),
				{ type: 'separator' },
				{ role: 'services' },
				{ type: 'separator' },
				{ role: 'hide' },
				{ role: 'hideOthers' },
				{ role: 'unhide' },
				{ type: 'separator' },
				{ role: 'quit' },
			],
		};

		const fileMenu = {
			label: 'File',
			submenu: [
				c('file:new-note', 'New Note', { chord: 'Mod-n', needs: 'vault' }),
				c('file:new-canvas', 'New Canvas', { needs: 'vault' }),
				c('file:new-folder', 'New Folder', { needs: 'vault' }),
				c('workspace:new-tab', 'New Tab', { chord: 'Mod-t' }),
				{ type: 'separator' },
				{
					label: 'Open Vault…',
					accelerator: 'CmdOrCtrl+Shift+O',
					click: () => vaults.openDialog(this.#getWindow()),
				},
				{ label: 'Open Recent Vault', submenu: this.#recentSubmenu() },
				{ type: 'separator' },
				c('file:save', 'Save', { chord: 'Mod-s', needs: 'note' }),
				{ type: 'separator' },
				c('file:bookmark', 'Bookmark This Note', { needs: 'note', type: 'checkbox', checked: s.bookmarked }),
				c('file:reveal', isMac ? 'Reveal in Finder' : 'Show in File Manager', { needs: 'note' }),
				{ type: 'separator' },
				{
					label: 'Export',
					submenu: [
						c('export:html', 'As HTML…', { needs: 'note' }),
						c('export:latex', 'As LaTeX…', { needs: 'note' }),
						c('export:pdf', 'As PDF (via LaTeX)…', { needs: 'note' }),
					],
				},
				{ type: 'separator' },
				c('workspace:close-tab', 'Close Tab', { chord: 'Mod-w', needs: 'tab' }),
				...(isMac ? [] : [
					{ type: 'separator' },
					c('app:settings', 'Settings…', { chord: 'Mod-,' }),
					{ type: 'separator' },
					{ role: 'quit' },
				]),
			],
		};

		const editMenu = {
			label: 'Edit',
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'pasteAndMatchStyle' },
				{ role: 'selectAll' },
				{ type: 'separator' },
				c('edit:find-in-note', 'Find in Note', { chord: 'Mod-f', needs: 'editor' }),
				c('nav:search', 'Search in All Files', { chord: 'Mod-Shift-f', needs: 'vault' }),
				{ type: 'separator' },
				c('edit:insert-wikilink', 'Insert Wikilink', { chord: 'Mod-k', needs: 'editor' }),
				c('edit:insert-template', 'Insert Template…', { chord: 'Mod-Alt-t', needs: 'editor' }),
				{ type: 'separator' },
				{
					label: 'Format',
					submenu: [
						c('edit:format-strong', 'Strong (*text*)', { needs: 'editor' }),
						c('edit:format-intense', 'Intense (**text**)', { needs: 'editor' }),
						c('edit:format-italic', 'Italic (/text/)', { needs: 'editor' }),
						c('edit:format-highlight', 'Highlight (==text==)', { needs: 'editor' }),
						c('edit:format-strike', 'Strikethrough (~text~)', { needs: 'editor' }),
						{ type: 'separator' },
						c('edit:format-code', 'Inline Code', { needs: 'editor' }),
						c('edit:format-math', 'Inline Math ($x$)', { needs: 'editor' }),
					],
				},
			],
		};

		const viewMenu = {
			label: 'View',
			submenu: [
				c('app:command-palette', 'Command Palette…', { chord: 'Mod-p' }),
				{ type: 'separator' },
				c('workspace:toggle-mode', 'Reading Mode', { chord: 'Mod-e', needs: 'note', type: 'checkbox', checked: s.readingMode }),
				c('view:properties', 'Properties Panel', { needs: 'vault' }),
				{ type: 'separator' },
				{
					label: 'Appearance',
					submenu: [
						c('view:theme-dark', 'Dark', { type: 'radio', checked: s.theme === 'dark' }),
						c('view:theme-light', 'Light', { type: 'radio', checked: s.theme === 'light' }),
					],
				},
				{ type: 'separator' },
				c('workspace:toggle-left-sidebar', 'Left Sidebar', { chord: 'Mod-b', type: 'checkbox', checked: s.leftSidebar }),
				c('workspace:toggle-right-sidebar', 'Right Sidebar', { chord: 'Mod-Shift-b', type: 'checkbox', checked: s.rightSidebar }),
				{ type: 'separator' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'reload' },
				{ role: 'toggleDevTools' },
			],
		};

		const goMenu = {
			label: 'Go',
			submenu: [
				c('nav:back', 'Back', { chord: 'Mod-Alt-ArrowLeft', needs: 'vault' }),
				c('nav:forward', 'Forward', { chord: 'Mod-Alt-ArrowRight', needs: 'vault' }),
				{ type: 'separator' },
				c('nav:quick-switcher', 'Quick Switcher…', { chord: 'Mod-o', needs: 'vault' }),
				c('nav:graph', 'Graph View', { chord: 'Mod-g', needs: 'vault' }),
				c('nav:daily-note', "Today's Daily Note", { chord: 'Mod-Shift-d', needs: 'vault' }),
				{ type: 'separator' },
				c('workspace:next-tab', 'Next Tab', { chord: 'Mod-Tab' }),
				c('workspace:prev-tab', 'Previous Tab', { chord: 'Mod-Shift-Tab' }),
			],
		};

		const windowMenu = {
			label: 'Window',
			submenu: [
				{ role: 'minimize' },
				{ role: 'zoom' },
				{ type: 'separator' },
				c('workspace:split-right', 'Split Right', { chord: 'Mod-\\', needs: 'tab' }),
				c('workspace:split-down', 'Split Down', { chord: 'Mod-Shift-\\', needs: 'tab' }),
				{ type: 'separator' },
				c('workspace:pin-tab', 'Pin Tab', { needs: 'tab', type: 'checkbox', checked: s.pinned }),
				...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
			],
		};

		// In dev the repo's demo-vault is the documentation; open it as a vault.
		const demoVault = this.#rootDir ? path.join(this.#rootDir, 'demo-vault') : null;
		const helpMenu = {
			role: 'help',
			submenu: [
				{
					label: 'Clew Documentation',
					enabled: !!demoVault && fs.existsSync(demoVault),
					click: () => this.#openVault(demoVault),
				},
				...(isMac ? [] : [{ type: 'separator' }, { role: 'about' }]),
			],
		};

		return [
			...(isMac ? [appMenu] : []),
			fileMenu,
			editMenu,
			viewMenu,
			goMenu,
			windowMenu,
			helpMenu,
		];
	}
}

export const appMenu = new AppMenu();
