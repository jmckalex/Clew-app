// <clew-file-explorer>: the vault file tree. Click opens notes; folders
// collapse; context menus offer create/rename/trash/reveal; renames are
// inline. (Drag-to-move folders/files arrives with M3.)
import { ClewElement } from '../base/clew-element.js';
import { vaultStore, isNotePath } from '../../state/vault-store.js';
import { workspaceStore } from '../../state/workspace-store.js';
import { editorPool } from '../../editor/pool.js';
import { ipc, CH } from '../../ipc.js';
import { showMenu } from '../chrome/menu.js';
import { bookmarkStore } from '../../state/bookmark-store.js';

class ClewFileExplorer extends ClewElement {
	#collapsed = new Set();
	#pendingRename = null;

	subscribe() {
		this.listen(vaultStore, 'tree-changed', () => this.render());
		this.listen(vaultStore, 'vault-changed', () => this.render());
		this.listen(workspaceStore, 'active-changed', () => this.#updateActiveHighlight());
		this.listen(workspaceStore, 'layout-changed', () => this.#updateActiveHighlight());
	}

	#updateActiveHighlight() {
		const activePath = workspaceStore.activeTab()?.path;
		for (const row of this.querySelectorAll('.tree-item.is-file')) {
			row.classList.toggle('is-active', row.dataset.path === activePath);
		}
	}

	render() {
		const header = document.createElement('div');
		header.className = 'panel-header';
		const title = document.createElement('span');
		title.className = 'panel-title';
		title.textContent = vaultStore.vault?.name ?? 'No vault';
		const actions = document.createElement('span');
		actions.className = 'panel-actions';
		actions.append(
			this.#actionButton('New note', '✚', () => this.createNote()),
			this.#actionButton('New folder', '⊞', () => this.#createFolder('')),
		);
		header.append(title, actions);

		const treeEl = document.createElement('div');
		treeEl.className = 'file-tree';
		if (vaultStore.tree) {
			this.#renderEntries(vaultStore.tree, treeEl, 0);
		}
		treeEl.addEventListener('contextmenu', (e) => {
			if (e.target === treeEl) {
				e.preventDefault();
				this.#rootMenu(e.clientX, e.clientY);
			}
		});

		this.replaceChildren(header, treeEl);

		if (this.#pendingRename) {
			const row = this.querySelector(`.tree-item[data-path="${CSS.escape(this.#pendingRename)}"]`);
			this.#pendingRename = null;
			if (row) this.#startRename(row);
		}
	}

	#actionButton(titleText, glyph, onClick) {
		const button = document.createElement('button');
		button.className = 'icon-button';
		button.title = titleText;
		button.textContent = glyph;
		button.addEventListener('click', onClick);
		return button;
	}

	#renderEntries(entries, container, depth) {
		for (const entry of entries) {
			const row = document.createElement('div');
			row.className = `tree-item is-${entry.type}`;
			row.dataset.path = entry.path;
			row.style.paddingLeft = `${10 + depth * 14}px`;

			if (entry.type === 'folder') {
				const chevron = document.createElement('span');
				chevron.className = 'tree-chevron';
				chevron.textContent = this.#collapsed.has(entry.path) ? '▸' : '▾';
				row.append(chevron);
			}

			const name = document.createElement('span');
			name.className = 'tree-name';
			name.textContent = entry.type === 'file' ? entry.name.replace(/\.(md|jmd)$/i, '') : entry.name;
			row.append(name);

			const activePath = workspaceStore.activeTab()?.path;
			if (entry.type === 'file' && entry.path === activePath) row.classList.add('is-active');

			row.addEventListener('click', (e) => {
				if (entry.type === 'folder') {
					this.#toggleFolder(entry.path);
				} else if (isNotePath(entry.path)) {
					workspaceStore.openNote(entry.path, { newTab: e.metaKey || e.ctrlKey });
				}
			});
			row.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.#itemMenu(entry, e.clientX, e.clientY);
			});

			container.append(row);

			if (entry.type === 'folder' && !this.#collapsed.has(entry.path)) {
				this.#renderEntries(entry.children, container, depth + 1);
			}
		}
	}

	#toggleFolder(path) {
		if (this.#collapsed.has(path)) this.#collapsed.delete(path);
		else this.#collapsed.add(path);
		this.render();
	}

	// ---- actions ----------------------------------------------------------

	async createNote(folder = '') {
		if (!vaultStore.vault) return;
		const rel = folder ? `${folder}/Untitled.md` : 'Untitled.md';
		try {
			const created = await ipc.invoke(CH.NOTE_CREATE, { path: rel });
			this.#pendingRename = created;
			workspaceStore.openNote(created);
		} catch (err) {
			console.error('Create note failed:', err);
		}
	}

	async #createFolder(parent) {
		if (!vaultStore.vault) return;
		let name = 'New folder';
		let rel = parent ? `${parent}/${name}` : name;
		for (let i = 1; vaultStore.pathExists(rel); i++) {
			name = `New folder ${i}`;
			rel = parent ? `${parent}/${name}` : name;
		}
		try {
			await ipc.invoke(CH.FS_CREATE_FOLDER, { path: rel });
			this.#pendingRename = rel;
		} catch (err) {
			console.error('Create folder failed:', err);
		}
	}

	#itemMenu(entry, x, y) {
		const items = [];
		if (entry.type === 'folder') {
			items.push(
				{ label: 'New note', click: () => this.createNote(entry.path) },
				{ label: 'New folder', click: () => this.#createFolder(entry.path) },
				{ separator: true },
			);
		}
		items.push(
			{ label: 'Rename…', click: () => this.#startRename(this.querySelector(`.tree-item[data-path="${CSS.escape(entry.path)}"]`)) },
			{ label: 'Reveal in Finder', click: () => ipc.invoke(CH.FS_REVEAL, { path: entry.path }) },
			{ separator: true },
			{ label: 'Delete', danger: true, click: () => this.#trash(entry) },
		);
		showMenu(x, y, items);
	}

	#rootMenu(x, y) {
		showMenu(x, y, [
			{ label: 'New note', click: () => this.createNote() },
			{ label: 'New folder', click: () => this.#createFolder('') },
		]);
	}

	async #trash(entry) {
		try {
			await ipc.invoke(CH.FS_TRASH, { path: entry.path });
			// Close tabs showing the deleted note (or notes inside a deleted folder).
			for (const group of workspaceStore.allGroups()) {
				for (const tab of [...group.tabs]) {
					if (tab.kind !== 'note') continue;
					if (tab.path === entry.path || tab.path?.startsWith(entry.path + '/')) {
						editorPool.close(tab.id);
						workspaceStore.closeTab(tab.id);
					}
				}
			}
		} catch (err) {
			console.error('Delete failed:', err);
		}
	}

	#startRename(row) {
		if (!row) return;
		const path = row.dataset.path;
		const isFile = row.classList.contains('is-file');
		const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
		const fullName = path.split('/').pop();
		const ext = isFile && /\.[^.]+$/.test(fullName) ? fullName.slice(fullName.lastIndexOf('.')) : '';
		const stem = ext ? fullName.slice(0, -ext.length) : fullName;

		const nameEl = row.querySelector('.tree-name');
		const input = document.createElement('input');
		input.className = 'tree-rename-input';
		input.value = stem;
		nameEl.replaceWith(input);
		input.focus();
		input.select();

		let done = false;
		const commit = async () => {
			if (done) return;
			done = true;
			const newStem = input.value.trim();
			if (!newStem || newStem === stem || newStem.includes('/')) {
				this.render();
				return;
			}
			const newPath = (dir ? dir + '/' : '') + newStem + ext;
			try {
				await ipc.invoke(CH.FS_RENAME, { path, newPath });
				workspaceStore.remapPaths(path, newPath);
				editorPool.remapPath(path, newPath);
				bookmarkStore.remap(path, newPath);
				if (!isFile && this.#collapsed.delete(path)) this.#collapsed.add(newPath);
			} catch (err) {
				console.error('Rename failed:', err);
				this.render();
			}
		};
		input.addEventListener('blur', commit);
		input.addEventListener('keydown', (e) => {
			e.stopPropagation();
			if (e.key === 'Enter') commit();
			if (e.key === 'Escape') { done = true; this.render(); }
		});
		input.addEventListener('click', (e) => e.stopPropagation());
	}
}

customElements.define('clew-file-explorer', ClewFileExplorer);
