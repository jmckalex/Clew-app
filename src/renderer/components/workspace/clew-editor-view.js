// <clew-editor-view>: hosts the pooled CodeMirror view for one note tab.
// Adopts the pool's DOM on connect; never destroys it (the pool owns views).
import { ClewElement } from '../base/clew-element.js';
import { editorPool } from '../../editor/pool.js';
import { workspaceStore } from '../../state/workspace-store.js';
import { uiStore } from '../../state/ui-store.js';
import { debounce } from '../../lib/debounce.js';

class ClewEditorView extends ClewElement {
	tabId = null;
	path = null;
	#saveViewState = debounce(() => {
		const entry = editorPool.get(this.tabId);
		if (!entry?.view) return;
		const { anchor, head } = entry.view.state.selection.main;
		workspaceStore.updateTabView(this.tabId, {
			cursor: { anchor, head },
			scrollTop: entry.view.scrollDOM.scrollTop,
		});
	}, 1000);

	async connectedCallback() {
		super.connectedCallback();
		this.classList.add('editor-host');
		const tabId = this.tabId;
		const entry = await editorPool.open(tabId, this.path);
		// The tab may have switched/closed while the note loaded.
		if (!this.isConnected || this.tabId !== tabId || !entry.view) return;

		this.replaceChildren(entry.view.dom);
		this.#restoreViewState(entry.view);

		entry.view.dom.addEventListener('focusin', this.#onFocusIn);
		entry.view.dom.addEventListener('focusout', this.#onFocusOut);
		this.addEventListener('scroll', this.#onAnyChange, true);
		this.addEventListener('keyup', this.#onAnyChange);
		this.addEventListener('pointerup', this.#onAnyChange);

		if (workspaceStore.activeTab()?.id === tabId) {
			entry.view.focus();
		}
	}

	cleanup() {
		this.#saveViewState.flush();
		editorPool.flush(this.tabId);
		const entry = editorPool.get(this.tabId);
		if (entry?.view) {
			entry.view.dom.removeEventListener('focusin', this.#onFocusIn);
			entry.view.dom.removeEventListener('focusout', this.#onFocusOut);
		}
	}

	#onFocusIn = () => uiStore.setEditorFocused(true);
	#onFocusOut = () => uiStore.setEditorFocused(false);
	#onAnyChange = () => this.#saveViewState();

	#restoreViewState(view) {
		const tab = workspaceStore.findTab(this.tabId)?.tab;
		const saved = tab?.view;
		if (!saved) return;
		try {
			// Inverse search from the preview lands here as a pending line.
			if (saved.pendingLine) {
				const line = view.state.doc.line(Math.min(saved.pendingLine, view.state.doc.lines));
				delete saved.pendingLine;
				view.dispatch({
					selection: { anchor: line.from },
					effects: [],
					scrollIntoView: true,
				});
				return;
			}
			if (saved.cursor && saved.cursor.head <= view.state.doc.length) {
				view.dispatch({ selection: saved.cursor });
			}
			if (saved.scrollTop) view.scrollDOM.scrollTop = saved.scrollTop;
		} catch { /* stale view state is harmless */ }
	}
}

customElements.define('clew-editor-view', ClewEditorView);
