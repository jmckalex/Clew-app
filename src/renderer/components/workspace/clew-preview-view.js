// <clew-preview-view>: reading mode for one note tab — a sandboxed iframe
// showing the jmarkdown-rendered document served via clew-preview://, updated
// in place (morphdom in the preview client) on re-renders.
import { ClewElement } from '../base/clew-element.js';
import { workspaceStore } from '../../state/workspace-store.js';
import { settingsStore } from '../../state/settings-store.js';
import { ipc, CH } from '../../ipc.js';
import * as actions from '../../commands/actions.js';
import { scrollSyncBus, makeSuppressor } from '../../preview/scroll-sync.js';

const HOST_SOURCE = 'clew-preview-host';

export function previewUrl(path) {
	return 'clew-preview://vault/' + path.split('/').map(encodeURIComponent).join('/') + '.html';
}

class ClewPreviewView extends ClewElement {
	tabId = null;
	path = null;
	#iframe = null;
	#clientReady = false;
	#pending = [];
	#suppressor = makeSuppressor();

	subscribe() {
		this.listen({ on: ipc.on }, CH.EV_RENDER_DONE, ({ path }) => {
			if (path === this.path) this.#refresh();
		});
		this.listen({ on: ipc.on }, CH.EV_RENDER_ERROR, ({ path, message }) => {
			if (path === this.path) this.#post({ type: 'error', message });
		});
		this.listen(scrollSyncBus, 'scroll', ({ path, line, from }) => {
			if (from === 'preview' || path !== this.path) return;
			this.#suppressor.suppress();
			this.#post({ type: 'scroll-to-line', line, behavior: 'auto' });
		});
		this.listen(settingsStore, 'settings-changed', () => {
			this.#post({ type: 'theme', theme: document.body.dataset.theme ?? 'dark' });
		});
		window.addEventListener('message', this.#onMessage);
	}

	cleanup() {
		window.removeEventListener('message', this.#onMessage);
		ipc.invoke(CH.RENDER_UNSUBSCRIBE, { path: this.path }).catch(() => {});
	}

	render() {
		this.classList.add('preview-host');
		ipc.invoke(CH.RENDER_SUBSCRIBE, { path: this.path }).catch(() => {});
		this.#iframe = document.createElement('iframe');
		this.#iframe.className = 'preview-frame';
		this.#iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
		this.#iframe.src = previewUrl(this.path);
		this.replaceChildren(this.#iframe);
	}

	#post(msg) {
		if (!this.#clientReady) {
			this.#pending.push(msg);
			return;
		}
		this.#iframe?.contentWindow?.postMessage({ source: HOST_SOURCE, ...msg }, '*');
	}

	async #refresh() {
		try {
			const response = await fetch(previewUrl(this.path));
			const html = await response.text();
			this.#post({ type: 'render', html });
		} catch (err) {
			console.error('Preview refresh failed:', err);
		}
	}

	#onMessage = (event) => {
		if (event.source !== this.#iframe?.contentWindow) return;
		const msg = event.data;
		if (!msg || msg.source !== 'clew-preview') return;

		switch (msg.type) {
			case 'ready': {
				this.#clientReady = true;
				this.#post({ type: 'theme', theme: document.body.dataset.theme ?? 'dark' });
				// Land where the editor's cursor was when reading mode opened.
				const cursorLine = workspaceStore.findTab(this.tabId)?.tab.view.cursorLine;
				if (cursorLine > 1) {
					this.#suppressor.suppress();
					this.#post({ type: 'scroll-to-line', line: cursorLine, behavior: 'auto' });
				}
				for (const queued of this.#pending.splice(0)) this.#post(queued);
				break;
			}
			case 'link-click':
				actions.openWikilink(msg.target, { newTab: msg.newTab, mode: 'reading' });
				break;
			case 'external-link':
				ipc.invoke(CH.SHELL_OPEN_EXTERNAL, { url: msg.url }).catch(() => {});
				break;
			case 'source-line-click': {
				// Inverse search: flip this tab to source mode at the clicked line.
				const found = workspaceStore.findTab(this.tabId);
				if (found) {
					found.tab.view.pendingLine = Math.max(1, msg.line);
					workspaceStore.setTabMode(this.tabId, 'source');
				}
				break;
			}
			case 'checkbox-toggle':
				actions.toggleTaskLine(this.path, msg.line, msg.checked);
				break;
			case 'chord': {
				const key = msg.key;
				if (key === 'e') actions.toggleReadingMode();
				else if (key === 'w') actions.closeActiveTab();
				else if (key === 't') actions.newTab();
				else if (key === '\\') actions.splitActive(msg.shift ? 'bottom' : 'right');
				break;
			}
			case 'morph-failed':
				this.#clientReady = false;
				if (this.#iframe) this.#iframe.src = previewUrl(this.path) + '?t=' + Date.now();
				break;
			case 'scrolled':
				if (!this.#suppressor.active()) {
					scrollSyncBus.emit('scroll', { path: this.path, line: msg.line, from: 'preview' });
				}
				break;
		}
	};
}

customElements.define('clew-preview-view', ClewPreviewView);
