// <clew-tab-bar>: the row of tabs for one group. Click activates,
// middle-click / × closes, dragging hands off to tab-drag.js.
import { ClewElement } from '../base/clew-element.js';
import { workspaceStore } from '../../state/workspace-store.js';
import { editorPool } from '../../editor/pool.js';
import { createTab } from '../../workspace/tree.js';
import { startTabDrag } from '../../workspace/tab-drag.js';
import { showMenu } from '../chrome/menu.js';
import { icon } from '../../lib/icons.js';

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
		addButton.append(icon('plus'));
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
		el.classList.toggle('is-pinned', !!tab.pinned);
		el.classList.toggle('is-dirty', editorPool.isDirty(tab.id));

		const title = document.createElement('span');
		title.className = 'tab-title';
		title.textContent = tabTitle(tab);
		title.title = tab.path ?? '';
		el.append(title);

		if (tab.pinned) {
			const pin = document.createElement('span');
			pin.className = 'tab-pin';
			pin.append(icon('thumbtack'));
			pin.title = 'Pinned (right-click to unpin)';
			el.append(pin);
		} else {
			const close = document.createElement('button');
			close.className = 'tab-close';
			close.setAttribute('aria-label', 'Close tab');
			close.append(icon('xmark'));
			close.addEventListener('click', (e) => {
				e.stopPropagation();
				this.#closeTab(tab.id);
			});
			el.append(close);
		}

		el.addEventListener('pointerdown', (e) => {
			if (e.button === 1 || e.button === 2) return;
			workspaceStore.activateTab(tab.id);
			startTabDrag(e, { tabId: tab.id, groupId: this.groupId, tabEl: el });
		});
		el.addEventListener('auxclick', (e) => {
			if (e.button === 1 && !tab.pinned) this.#closeTab(tab.id);
		});
		el.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.#tabMenu(tab, e.clientX, e.clientY);
		});
		return el;
	}

	#tabMenu(tab, x, y) {
		const group = this.group;
		if (!group) return;
		const index = group.tabs.findIndex((t) => t.id === tab.id);
		const closable = (t) => !t.pinned && t.id !== tab.id;
		const others = group.tabs.filter(closable);
		const toRight = group.tabs.slice(index + 1).filter((t) => !t.pinned);
		const closeAll = (tabs) => {
			for (const t of tabs) this.#closeTab(t.id);
		};
		showMenu(x, y, [
			tab.pinned
				? { label: 'Unpin', click: () => workspaceStore.pinTab(tab.id, false) }
				: { label: 'Pin', click: () => workspaceStore.pinTab(tab.id, true) },
			{ separator: true },
			...(tab.pinned ? [] : [{ label: 'Close', click: () => this.#closeTab(tab.id) }]),
			{ label: `Close others${others.length ? ` (${others.length})` : ''}`, click: () => closeAll(others) },
			{ label: `Close tabs to the right${toRight.length ? ` (${toRight.length})` : ''}`, click: () => closeAll(toRight) },
		]);
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
