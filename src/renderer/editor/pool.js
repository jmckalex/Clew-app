// The editor pool owns every live EditorView, keyed by tab id. Components
// adopt/release the view's DOM node but never destroy it — layout changes and
// tab drags reparent editors losslessly. Views are destroyed only when their
// tab closes. The pool also owns dirty state and auto-save.
import { Emitter } from '../lib/emitter.js';
import { debounce } from '../lib/debounce.js';
import { ipc, CH } from '../ipc.js';
import { createNoteEditor, makeNoteState } from './editor.js';

const AUTOSAVE_MS = 1000;

class EditorPool extends Emitter {
	/** @type {Map<string, {view, path, dirty, save, generation}>} */
	#entries = new Map();

	/**
	 * Get (creating or re-pointing as needed) the editor for a note tab.
	 * Returns the entry whose `view.dom` the component adopts.
	 */
	async open(tabId, path) {
		let entry = this.#entries.get(tabId);
		if (entry && entry.path === path) return entry;

		if (entry) {
			// Same tab navigated to a different note: save the old one first.
			entry.save.flush();
			entry.generation++;
		} else {
			entry = { view: null, path: null, dirty: false, generation: 0, save: null };
			entry.save = debounce(() => this.#save(tabId), AUTOSAVE_MS);
			this.#entries.set(tabId, entry);
		}

		const generation = entry.generation;
		entry.path = path;
		const content = await ipc.invoke(CH.NOTE_READ, { path }).catch(() => '');
		// The tab may have navigated again (or closed) while we read.
		if (this.#entries.get(tabId) !== entry || entry.generation !== generation) return entry;

		const onUpdate = (update) => {
			if (!update.docChanged) return;
			this.#setDirty(tabId, true);
			entry.save();
			this.emit('doc-changed', { tabId });
		};
		if (entry.view) {
			entry.view.setState(makeNoteState(content, onUpdate));
		} else {
			entry.view = createNoteEditor({ doc: content, onUpdate });
		}
		entry.dirty = false;
		return entry;
	}

	get(tabId) {
		return this.#entries.get(tabId) ?? null;
	}

	isDirty(tabId) {
		return this.#entries.get(tabId)?.dirty ?? false;
	}

	async #save(tabId) {
		const entry = this.#entries.get(tabId);
		if (!entry?.view || !entry.dirty) return;
		const content = entry.view.state.doc.toString();
		try {
			await ipc.invoke(CH.NOTE_WRITE, { path: entry.path, content });
			this.#setDirty(tabId, false);
		} catch (err) {
			console.error(`Failed to save ${entry.path}:`, err);
		}
	}

	#setDirty(tabId, dirty) {
		const entry = this.#entries.get(tabId);
		if (!entry || entry.dirty === dirty) return;
		entry.dirty = dirty;
		this.emit('dirty-changed', { tabId, dirty });
	}

	/** Flush a pending save immediately (blur, tab switch, close). */
	flush(tabId) {
		this.#entries.get(tabId)?.save.flush();
	}

	flushAll() {
		for (const entry of this.#entries.values()) entry.save.flush();
	}

	/** A file changed on disk: reload any clean editor showing it. */
	async externalChange(path) {
		for (const [tabId, entry] of this.#entries) {
			if (entry.path !== path || !entry.view) continue;
			if (entry.dirty) continue; // local edits win for now (conflict UI later)
			const content = await ipc.invoke(CH.NOTE_READ, { path }).catch(() => null);
			if (content === null || this.#entries.get(tabId) !== entry) continue;
			if (content === entry.view.state.doc.toString()) continue;
			const { view } = entry;
			const selection = view.state.selection;
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: content },
				selection: selection.main.anchor <= content.length ? selection : undefined,
			});
			this.#setDirty(tabId, false); // the dispatch marked it dirty; it matches disk
		}
	}

	/** A file was renamed: keep editors pointed at the right path. */
	remapPath(fromPath, toPath) {
		for (const entry of this.#entries.values()) {
			if (entry.path === fromPath) entry.path = toPath;
			else if (entry.path?.startsWith(fromPath + '/')) {
				entry.path = toPath + entry.path.slice(fromPath.length);
			}
		}
	}

	close(tabId) {
		const entry = this.#entries.get(tabId);
		if (!entry) return;
		entry.save.flush();
		entry.save.cancel();
		entry.view?.destroy();
		this.#entries.delete(tabId);
	}

	/** Destroy editors whose tabs no longer exist. */
	reap(openTabIds) {
		for (const tabId of [...this.#entries.keys()]) {
			if (!openTabIds.has(tabId)) this.close(tabId);
		}
	}
}

export const editorPool = new EditorPool();
