// Backlinks panel: notes linking to the active note, grouped by source,
// with the line's context snippet (fetched lazily from the source file).
import { ClewElement } from '../base/clew-element.js';
import { vaultStore } from '../../state/vault-store.js';
import { workspaceStore } from '../../state/workspace-store.js';
import { ipc, CH } from '../../ipc.js';
import { debounce } from '../../lib/debounce.js';
import { openNoteAtLine } from '../../commands/actions.js';

const noteTitle = (path) => path.split('/').pop().replace(/\.(md|jmd)$/i, '');

export class ClewBacklinks extends ClewElement {
	#refresh = debounce(() => this.render(), 150);

	subscribe() {
		this.listen(workspaceStore, 'active-changed', () => this.#refresh());
		this.listen(workspaceStore, 'layout-changed', () => this.#refresh());
		this.listen(vaultStore, 'index-changed', () => this.#refresh());
	}

	async render() {
		const path = workspaceStore.activeTab()?.path;
		this.classList.add('panel-scroll');
		if (!path) {
			this.replaceChildren(emptyNote('No active note'));
			return;
		}
		const backlinks = vaultStore.backlinksFor(path);
		if (backlinks.length === 0) {
			this.replaceChildren(emptyNote('No backlinks'));
			return;
		}

		const frag = document.createDocumentFragment();
		for (const { source, links } of backlinks) {
			const group = document.createElement('div');
			group.className = 'link-group';
			const title = document.createElement('div');
			title.className = 'link-group-title';
			title.textContent = noteTitle(source);
			title.title = source;
			title.addEventListener('click', () => workspaceStore.openNote(source));
			group.append(title);

			// Context snippets, fetched once per source note; one row per line
			// (several links on one line share a snippet).
			const text = await ipc.invoke(CH.NOTE_READ, { path: source }).catch(() => null);
			const seenLines = new Set();
			for (const link of links) {
				if (seenLines.has(link.line)) continue;
				seenLines.add(link.line);
				const row = document.createElement('div');
				row.className = 'link-context';
				const snippet = text?.split('\n')[link.line - 1]?.trim() ?? '';
				row.textContent = snippet.length > 220 ? snippet.slice(0, 220) + '…' : snippet;
				row.addEventListener('click', () => openNoteAtLine(source, link.line));
				group.append(row);
			}
			frag.append(group);
		}
		this.replaceChildren(frag);
	}
}

export function emptyNote(text) {
	const el = document.createElement('div');
	el.className = 'panel-empty';
	el.textContent = text;
	return el;
}

customElements.define('clew-backlinks', ClewBacklinks);
