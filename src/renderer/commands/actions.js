// Shared UI actions, callable from the interim global keymap, the preview
// bridge (forwarded chords), and — later — the real command registry.
import { workspaceStore } from '../state/workspace-store.js';
import { vaultStore, isNotePath } from '../state/vault-store.js';
import { editorPool } from '../editor/pool.js';
import { createTab } from '../workspace/tree.js';
import { ipc, CH } from '../ipc.js';

export function closeActiveTab() {
	const tab = workspaceStore.activeTab();
	if (!tab) return;
	editorPool.close(tab.id);
	workspaceStore.closeTab(tab.id);
}

export function newTab() {
	workspaceStore.openTab(workspaceStore.activeGroupId, createTab('empty'));
}

export function splitActive(edge) {
	const tab = workspaceStore.activeTab();
	if (tab) workspaceStore.splitWithTab(workspaceStore.activeGroupId, edge, tab.id);
}

export function toggleReadingMode() {
	const tab = workspaceStore.activeTab();
	if (tab?.kind !== 'note') return;
	if (tab.view.mode !== 'reading') editorPool.flush(tab.id);
	workspaceStore.setTabMode(tab.id, tab.view.mode === 'reading' ? 'source' : 'reading');
}

export function openGraph() {
	// Reuse an existing graph tab anywhere in the workspace.
	for (const group of workspaceStore.allGroups()) {
		const existing = group.tabs.find((t) => t.kind === 'graph');
		if (existing) {
			workspaceStore.activateTab(existing.id);
			return;
		}
	}
	workspaceStore.openTab(workspaceStore.activeGroupId, createTab('graph'));
}

export function historyBack() {
	const tab = workspaceStore.activeTab();
	if (tab) { editorPool.flush(tab.id); workspaceStore.goBack(tab.id); }
}

export function historyForward() {
	const tab = workspaceStore.activeTab();
	if (tab) { editorPool.flush(tab.id); workspaceStore.goForward(tab.id); }
}

/**
 * Open a wikilink target: resolve it against the vault, creating the note
 * (Obsidian-style, in the vault root) when unresolved.
 */
export async function openWikilink(target, { newTab = false, mode } = {}) {
	const { name, heading } = splitTarget(target);
	if (!name) return; // same-file heading link — nothing to open
	let path = vaultStore.resolveNoteName(name);
	if (!path) {
		try {
			path = await ipc.invoke(CH.NOTE_CREATE, { path: `${name}.md` });
		} catch (err) {
			console.error('Could not create note for wikilink:', err);
			return;
		}
	}
	const tab = workspaceStore.openNote(path, { newTab });
	if (mode && tab.view.mode !== mode) workspaceStore.setTabMode(tab.id, mode);
	void heading; // heading scroll targeting arrives with scroll-sync polish
}

/** Move a tab's editor cursor to a 1-based line — live when the editor is
 *  mounted, deferred via pendingLine when it isn't (yet). */
export function jumpToLine(tabId, line) {
	const entry = editorPool.get(tabId);
	if (entry?.view?.dom.isConnected) {
		const doc = entry.view.state.doc;
		const target = doc.line(Math.max(1, Math.min(line, doc.lines)));
		entry.view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
		entry.view.focus();
	} else {
		const found = workspaceStore.findTab(tabId);
		if (found) found.tab.view.pendingLine = line;
	}
}

/** Open a note in source mode with the cursor on `line`. */
export function openNoteAtLine(path, line) {
	const tab = workspaceStore.openNote(path);
	workspaceStore.setTabMode(tab.id, 'source');
	jumpToLine(tab.id, line);
}

export function splitTarget(target) {
	const hash = target.indexOf('#');
	if (hash === -1) return { name: target.trim(), heading: null };
	return { name: target.slice(0, hash).trim(), heading: target.slice(hash + 1).trim() || null };
}

export { isNotePath };
