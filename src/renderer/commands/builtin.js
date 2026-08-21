// Built-in commands: everything the palette and hotkeys can do. Registered
// once at boot. Chord notation is CodeMirror's ('Mod-Shift-p').
import { registerCommand, buildContext, allCommands, isEnabled, effectiveKeymap } from './registry.js';
import * as actions from './actions.js';
import { workspaceStore } from '../state/workspace-store.js';
import { vaultStore, isNotePath } from '../state/vault-store.js';
import { settingsStore } from '../state/settings-store.js';
import { bookmarkStore } from '../state/bookmark-store.js';
import { editorPool } from '../editor/pool.js';
import { openQuickSwitcher } from '../components/modals/clew-quick-switcher.js';
import { openListModal } from '../components/modals/list-modal.js';
import { ipc, CH } from '../ipc.js';

const needsVault = (ctx) => ctx.vaultOpen;
const needsNote = (ctx) => ctx.notePath !== null;

// ---- date formatting for daily notes / templates --------------------------

export function formatDate(date, format) {
	const pad = (n) => String(n).padStart(2, '0');
	return format
		.replace(/YYYY/g, date.getFullYear())
		.replace(/MM/g, pad(date.getMonth() + 1))
		.replace(/DD/g, pad(date.getDate()))
		.replace(/HH/g, pad(date.getHours()))
		.replace(/mm/g, pad(date.getMinutes()));
}

function substituteTemplate(text, { title }) {
	const now = new Date();
	return text
		.replace(/\{\{date(?::([^}]+))?\}\}/g, (_, fmt) => formatDate(now, fmt || 'YYYY-MM-DD'))
		.replace(/\{\{time(?::([^}]+))?\}\}/g, (_, fmt) => formatDate(now, fmt || 'HH:mm'))
		.replace(/\{\{title\}\}/g, title ?? '');
}

async function openDailyNote() {
	const folder = settingsStore.get('dailyNoteFolder') ?? 'Daily';
	const format = settingsStore.get('dailyNoteFormat') ?? 'YYYY-MM-DD';
	const name = formatDate(new Date(), format);
	const rel = folder ? `${folder}/${name}.md` : `${name}.md`;
	if (vaultStore.pathExists(rel)) {
		workspaceStore.openNote(rel);
		return;
	}
	// Seed from the daily template when one exists.
	let content = '';
	const templateName = settingsStore.get('dailyNoteTemplate');
	if (templateName) {
		const templatePath = vaultStore.resolveNoteName(templateName);
		if (templatePath) {
			const raw = await ipc.invoke(CH.NOTE_READ, { path: templatePath }).catch(() => '');
			content = substituteTemplate(raw, { title: name });
		}
	}
	try {
		const created = await ipc.invoke(CH.NOTE_CREATE, { path: rel });
		if (content) await ipc.invoke(CH.NOTE_WRITE, { path: created, content });
		workspaceStore.openNote(created);
	} catch (err) {
		console.error('Daily note failed:', err);
	}
}

function templateFiles() {
	const folder = (settingsStore.get('templatesFolder') ?? 'Templates').toLowerCase();
	return vaultStore.notePaths().filter((p) => p.toLowerCase().startsWith(folder + '/'));
}

function insertTemplate() {
	const ctx = buildContext();
	const entry = editorPool.get(ctx.activeTab?.id);
	if (!entry?.view) return;
	const items = templateFiles().map((path) => ({
		label: path.split('/').pop().replace(/\.(md|jmd)$/i, ''),
		detail: path,
		run: async () => {
			const raw = await ipc.invoke(CH.NOTE_READ, { path }).catch(() => null);
			if (raw === null) return;
			const title = ctx.notePath?.split('/').pop().replace(/\.(md|jmd)$/i, '') ?? '';
			const text = substituteTemplate(raw, { title });
			const { view } = entry;
			view.dispatch(view.state.replaceSelection(text));
			view.focus();
		},
	}));
	openListModal({ placeholder: 'Insert template…', items, emptyText: 'No templates found (folder: Templates/)' });
}

async function exportActiveNote(format) {
	const ctx = buildContext();
	if (!ctx.notePath) return;
	editorPool.flush(ctx.activeTab.id);
	try {
		const result = await ipc.invoke(CH.EXPORT_NOTE, { path: ctx.notePath, format });
		if (result?.output) console.log(`Exported to ${result.output}`);
	} catch (err) {
		console.error('Export failed:', err);
		alert(`Export failed: ${err.message ?? err}`);
	}
}

// ---- the commands ----------------------------------------------------------

export function registerBuiltinCommands() {
	const commands = [
		// files
		{ id: 'file:new-note', name: 'Create new note', hotkeys: ['Mod-n'], when: needsVault,
			run: () => document.querySelector('clew-file-explorer')?.createNote?.() },
		{ id: 'file:open-vault', name: 'Open another vault…',
			run: () => ipc.invoke(CH.VAULT_OPEN_DIALOG).catch(() => {}) },
		{ id: 'file:reveal', name: 'Reveal active note in Finder', when: needsNote,
			run: (ctx) => ipc.invoke(CH.FS_REVEAL, { path: ctx.notePath }) },
		{ id: 'file:bookmark', name: 'Bookmark / unbookmark active note', when: needsNote,
			run: (ctx) => bookmarkStore.toggle(ctx.notePath) },

		// navigation
		{ id: 'nav:quick-switcher', name: 'Open quick switcher', hotkeys: ['Mod-o'], when: needsVault,
			inModal: false, run: () => openQuickSwitcher() },
		{ id: 'nav:back', name: 'Navigate back', hotkeys: ['Mod-Alt-ArrowLeft'], when: needsVault,
			run: () => actions.historyBack() },
		{ id: 'nav:forward', name: 'Navigate forward', hotkeys: ['Mod-Alt-ArrowRight'], when: needsVault,
			run: () => actions.historyForward() },
		{ id: 'nav:graph', name: 'Open graph view', hotkeys: ['Mod-g'], when: needsVault,
			run: () => actions.openGraph() },
		{ id: 'nav:search', name: 'Search in all files', hotkeys: ['Mod-Shift-f'], when: needsVault,
			run: () => document.querySelector('clew-app')?.openSearch?.() },
		{ id: 'nav:daily-note', name: "Open today's daily note", hotkeys: ['Mod-Shift-d'], when: needsVault,
			run: () => openDailyNote() },

		// workspace
		{ id: 'workspace:close-tab', name: 'Close tab', hotkeys: ['Mod-w'],
			run: () => actions.closeActiveTab() },
		{ id: 'workspace:new-tab', name: 'New tab', hotkeys: ['Mod-t'],
			run: () => actions.newTab() },
		{ id: 'workspace:next-tab', name: 'Next tab', hotkeys: ['Mod-Tab'],
			run: () => cycleTab(1) },
		{ id: 'workspace:prev-tab', name: 'Previous tab', hotkeys: ['Mod-Shift-Tab'],
			run: () => cycleTab(-1) },
		{ id: 'workspace:split-right', name: 'Split right', hotkeys: ['Mod-\\'],
			run: () => actions.splitActive('right') },
		{ id: 'workspace:split-down', name: 'Split down', hotkeys: ['Mod-Shift-\\'],
			run: () => actions.splitActive('bottom') },
		{ id: 'workspace:toggle-mode', name: 'Toggle reading mode', hotkeys: ['Mod-e'], when: needsNote,
			run: () => actions.toggleReadingMode() },
		{ id: 'workspace:toggle-left-sidebar', name: 'Toggle left sidebar', hotkeys: ['Mod-b'],
			run: () => toggleSidebar('left') },
		{ id: 'workspace:toggle-right-sidebar', name: 'Toggle right sidebar', hotkeys: ['Mod-Shift-b'],
			run: () => toggleSidebar('right') },

		// editing
		{ id: 'edit:insert-template', name: 'Insert template…', hotkeys: ['Mod-Alt-t'],
			when: (ctx) => needsNote(ctx), run: () => insertTemplate() },

		// view
		{ id: 'app:settings', name: 'Open settings', hotkeys: ['Mod-,'],
			run: () => actions.openSettings() },
		{ id: 'view:toggle-theme', name: 'Toggle light/dark theme',
			run: () => settingsStore.set('theme', settingsStore.get('theme') === 'dark' ? 'light' : 'dark') },

		// export
		{ id: 'export:html', name: 'Export note as HTML', when: needsNote,
			run: () => exportActiveNote('html') },
		{ id: 'export:latex', name: 'Export note as LaTeX (.tex)', when: needsNote,
			run: () => exportActiveNote('latex') },
		{ id: 'export:pdf', name: 'Export note as PDF (via LaTeX)', when: needsNote,
			run: () => exportActiveNote('pdf') },
	];
	for (const command of commands) registerCommand(command);

	// The palette itself.
	registerCommand({
		id: 'app:command-palette',
		name: 'Open command palette',
		hotkeys: ['Mod-p'],
		run: () => openCommandPalette(),
	});
}

function cycleTab(direction) {
	const group = workspaceStore.activeGroup();
	if (!group || group.tabs.length < 2) return;
	const index = group.tabs.findIndex((t) => t.id === group.activeTabId);
	const next = (index + direction + group.tabs.length) % group.tabs.length;
	workspaceStore.activateTab(group.tabs[next].id);
}

function toggleSidebar(side) {
	workspaceStore.setSidebar(side, { open: !workspaceStore.state.sidebars[side].open });
}

export function openCommandPalette() {
	const ctx = buildContext();
	const keymap = effectiveKeymap();
	const chordFor = (id) => {
		for (const [chord, mapped] of keymap) {
			if (mapped === id) return prettifyChord(chord);
		}
		return '';
	};
	const items = allCommands()
		.filter((c) => isEnabled(c, ctx))
		.map((c) => ({ label: c.name, hint: chordFor(c.id), run: () => c.run(buildContext()) }));
	openListModal({ placeholder: 'Run a command…', items });
}

function prettifyChord(chord) {
	const isMac = navigator.platform.startsWith('Mac');
	return chord
		.replace('Mod', isMac ? '⌘' : 'Ctrl')
		.replace('Alt', isMac ? '⌥' : 'Alt')
		.replace('Shift', '⇧')
		.replace('ArrowLeft', '←')
		.replace('ArrowRight', '→')
		.replaceAll('-', isMac ? '' : '+');
}

export { isNotePath };
