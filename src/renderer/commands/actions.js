// Shared UI actions, callable from the interim global keymap, the preview
// bridge (forwarded chords), and — later — the real command registry.
import { workspaceStore } from '../state/workspace-store.js';
import { vaultStore, isNotePath } from '../state/vault-store.js';
import { editorPool } from '../editor/pool.js';
import { createTab } from '../workspace/tree.js';
import { isCanvasPath } from '../lib/file-types.js';
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

function openSingletonTab(kind) {
	// Reuse an existing tab of this kind anywhere in the workspace.
	for (const group of workspaceStore.allGroups()) {
		const existing = group.tabs.find((t) => t.kind === kind);
		if (existing) {
			workspaceStore.activateTab(existing.id);
			return;
		}
	}
	workspaceStore.openTab(workspaceStore.activeGroupId, createTab(kind));
}

export function openGraph() {
	openSingletonTab('graph');
}

export function openSettings() {
	openSingletonTab('settings');
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
		// An attachment reference ([[img.png]], ![[paper.pdf]]) opens a viewer
		// tab — and [[x.canvas]] opens the canvas — rather than creating a
		// note by that name.
		const filePath = vaultStore.resolveFileName(name);
		if (filePath) {
			if (isCanvasPath(filePath)) workspaceStore.openCanvas(filePath, { newTab });
			else workspaceStore.openFile(filePath, { newTab });
			return;
		}
	}
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

const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/;

/**
 * Toggle the task checkbox on a 1-based source line of a note — through the
 * live editor when one is open (undoable, autosave persists it), otherwise
 * straight to disk. Tolerates ±1 line drift by searching neighbours.
 */
export async function toggleTaskLine(path, line, checked) {
	const box = `[${checked ? 'x' : ' '}]`;

	for (const group of workspaceStore.allGroups()) {
		for (const tab of group.tabs) {
			if (tab.kind !== 'note' || tab.path !== path) continue;
			const entry = editorPool.get(tab.id);
			if (!entry?.view) continue;
			const doc = entry.view.state.doc;
			for (const candidate of [line, line + 1, line - 1]) {
				if (candidate < 1 || candidate > doc.lines) continue;
				const docLine = doc.line(candidate);
				const match = TASK_RE.exec(docLine.text);
				if (!match) continue;
				const from = docLine.from + match[1].length;
				entry.view.dispatch({ changes: { from, to: from + 3, insert: box } });
				editorPool.flush(tab.id);
				return true;
			}
			return false; // an editor had the note but no task on that line
		}
	}

	// No live editor: rewrite the file directly.
	const text = await ipc.invoke(CH.NOTE_READ, { path }).catch(() => null);
	if (text === null) return false;
	const lines = text.split('\n');
	for (const candidate of [line, line + 1, line - 1]) {
		const index = candidate - 1;
		if (index < 0 || index >= lines.length) continue;
		const match = TASK_RE.exec(lines[index]);
		if (!match) continue;
		lines[index] = lines[index].slice(0, match[1].length) + box + lines[index].slice(match[1].length + 3);
		await ipc.invoke(CH.NOTE_WRITE, { path, content: lines.join('\n') }).catch(() => {});
		return true;
	}
	return false;
}

/**
 * Convert an unlinked mention into a wikilink: wrap the occurrence at
 * {line, column, length} in `sourcePath` as [[mention]] — or, when the
 * mention is an alias of the target, [[Target|mention]]. Goes through the
 * live editor when the source note has one open (undoable), else disk.
 * Returns false when the text at that position no longer matches.
 */
export async function linkMention({ sourcePath, line, column, length, targetPath, name }) {
	const base = targetPath.split('/').pop().replace(/\.(md|jmd)$/i, '');
	const wrap = (occurrence) =>
		occurrence.toLowerCase() === base.toLowerCase()
			? `[[${occurrence}]]`
			: `[[${base}|${occurrence}]]`;

	// Live editor first (mirrors toggleTaskLine).
	for (const group of workspaceStore.allGroups()) {
		for (const tab of group.tabs) {
			if (tab.kind !== 'note' || tab.path !== sourcePath) continue;
			const entry = editorPool.get(tab.id);
			if (!entry?.view) continue;
			const doc = entry.view.state.doc;
			if (line < 1 || line > doc.lines) return false;
			const docLine = doc.line(line);
			const occurrence = doc.sliceString(docLine.from + column, docLine.from + column + length);
			if (occurrence.toLowerCase() !== name.toLowerCase()) return false;
			entry.view.dispatch({
				changes: { from: docLine.from + column, to: docLine.from + column + length, insert: wrap(occurrence) },
			});
			editorPool.flush(tab.id);
			return true;
		}
	}

	const text = await ipc.invoke(CH.NOTE_READ, { path: sourcePath }).catch(() => null);
	if (text === null) return false;
	const lines = text.split('\n');
	const lineText = lines[line - 1];
	if (lineText === undefined) return false;
	const occurrence = lineText.slice(column, column + length);
	if (occurrence.toLowerCase() !== name.toLowerCase()) return false;
	lines[line - 1] = lineText.slice(0, column) + wrap(occurrence) + lineText.slice(column + length);
	await ipc.invoke(CH.NOTE_WRITE, { path: sourcePath, content: lines.join('\n') }).catch(() => {});
	return true;
}

export function splitTarget(target) {
	const hash = target.indexOf('#');
	if (hash === -1) return { name: target.trim(), heading: null };
	return { name: target.slice(0, hash).trim(), heading: target.slice(hash + 1).trim() || null };
}

export { isNotePath };
