// <clew-tab-bar>: the row of tabs for one group. Click activates,
// middle-click / × closes, dragging hands off to tab-drag.js.
import { ClewElement } from '../base/clew-element.js';
import { workspaceStore } from '../../state/workspace-store.js';
import { editorPool } from '../../editor/pool.js';
import { createTab } from '../../workspace/tree.js';
import { startTabDrag } from '../../workspace/tab-drag.js';

export function tabTitle(tab) {
	if (tab.kind === 'note' && tab.path) {
		const base = tab.path.split('/').pop();
		return base.replace(/\.(md|jmd)$/i, '');
	}
	if (tab.kind === 'file' && tab.path) return tab.path.split('/').pop();
	if (tab.kind === 'canvas' && tab.path) {
		return tab.path.split('/').pop().replace(/\.canvas$/i, '');
	}
	if (tab.kind === 'graph') return 'Graph view';
	if (tab.kind === 'settings') return 'Settings';
	return 'New tab';
}

class ClewTabBar extends ClewElement {
	groupId = null;

	subscribe() {
		this.listen(workspaceStore, 'active-changed', () => this.#refreshActive());
		this.listen(editorPool, 'dirty-changed', ({ tabId, dirty }) => {
			this.querySelector(`.tab[data-tab-id="${tabId}"]`)
				?.classList.toggle('is-dirty', dirty);
		});
	}

	get group() {
		return workspaceStore.allGroups().find((g) => g.id === this.groupId) ?? null;
	}

	render() {
		const group = this.group;
		if (!group) return;

		const strip = document.createElement('div');
		strip.className = 'tab-strip';
		for (const tab of group.tabs) {
			strip.append(this.#makeTab(tab, tab.id === group.activeTabId));
		}

		const addButton = document.createElement('button');
		addButton.className = 'tab-add';
		addButton.title = 'New tab';
		addButton.textContent = '+';
		addButton.addEventListener('click', () => {
			workspaceStore.openTab(this.groupId, createTab('empty'));
		});

		this.replaceChildren(strip, addButton);
	}

	#makeTab(tab, isActive) {
		const el = document.createElement('div');
		el.className = 'tab';
		el.dataset.tabId = tab.id;
		el.classList.toggle('is-active', isActive);
		el.classList.toggle('is-dirty', editorPool.isDirty(tab.id));

		const title = document.createElement('span');
		title.className = 'tab-title';
		title.textContent = tabTitle(tab);
		title.title = tab.path ?? '';

		const close = document.createElement('button');
		close.className = 'tab-close';
		close.setAttribute('aria-label', 'Close tab');
		close.textContent = '×';
		close.addEventListener('click', (e) => {
			e.stopPropagation();
			this.#closeTab(tab.id);
		});

		el.append(title, close);
		el.addEventListener('pointerdown', (e) => {
			if (e.button === 1) return;
			workspaceStore.activateTab(tab.id);
			startTabDrag(e, { tabId: tab.id, groupId: this.groupId, tabEl: el });
		});
		el.addEventListener('auxclick', (e) => {
			if (e.button === 1) this.#closeTab(tab.id);
		});
		return el;
	}

	#closeTab(tabId) {
		editorPool.close(tabId);
		workspaceStore.closeTab(tabId);
	}

	#refreshActive() {
		const group = this.group;
		if (!group) return;
		for (const el of this.querySelectorAll('.tab')) {
			el.classList.toggle('is-active', el.dataset.tabId === group.activeTabId);
		}
	}
}

customElements.define('clew-tab-bar', ClewTabBar);
