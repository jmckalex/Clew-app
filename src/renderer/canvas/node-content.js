// Canvas node content builders. Content is inert by default (pointer-events
// none) so the canvas owns dragging; a double-clicked ("engaged") node turns
// its content interactive. Note embeds are live jmarkdown previews — the
// canvas view drives their render subscription and postMessage traffic.
import { fileKind, vaultFileUrl } from '../lib/file-types.js';
import { isNotePath } from '../state/vault-store.js';
import { previewUrl } from '../components/workspace/clew-preview-view.js';
import { renderCardHtml } from './card-markdown.js';
import { openWikilink } from '../commands/actions.js';
import { ipc, CH } from '../ipc.js';

/** Fill a card's content element from its raw text (also used on updates). */
export function setCardText(el, text) {
	el.dataset.cardText = text ?? '';
	el.innerHTML = renderCardHtml(text ?? '');
}

export function nodeTitle(node) {
	if (node.type === 'file') return node.file.split('/').pop();
	if (node.type === 'link') {
		try { return new URL(node.url).host || node.url; } catch { return node.url; }
	}
	if (node.type === 'group') return node.label ?? 'Group';
	return '';
}

/**
 * Build the content element for a node. For note embeds, `embedHooks.register`
 * is called with (nodeId, iframe, path) so the view can wire live rendering.
 */
export function buildNodeContent(node, embedHooks) {
	if (node.type === 'text') {
		const el = document.createElement('div');
		el.className = 'canvas-text';
		setCardText(el, node.text);
		// Links are clickable once the card is engaged (double-click).
		el.addEventListener('click', (e) => {
			const wikilink = e.target.closest('a.card-wikilink');
			if (wikilink) {
				e.preventDefault();
				openWikilink(wikilink.dataset.href, { newTab: true });
				return;
			}
			const external = e.target.closest('a.card-extlink');
			if (external) {
				e.preventDefault();
				ipc.invoke(CH.SHELL_OPEN_EXTERNAL, { url: external.dataset.url }).catch(() => {});
			}
		});
		return el;
	}

	if (node.type === 'group') {
		const el = document.createElement('div');
		el.className = 'canvas-group-label';
		el.textContent = node.label ?? '';
		return el;
	}

	if (node.type === 'link') {
		const wrap = document.createElement('div');
		wrap.className = 'canvas-embed';
		const webview = document.createElement('webview');
		webview.className = 'canvas-webview';
		webview.setAttribute('partition', 'persist:clew-canvas');
		webview.setAttribute('src', node.url);

		// Load-failure chrome (offline, bad host): overlay with a retry.
		const error = document.createElement('div');
		error.className = 'canvas-web-error';
		error.hidden = true;
		const message = document.createElement('div');
		message.className = 'canvas-web-error-text';
		const retry = document.createElement('button');
		retry.className = 'canvas-web-retry';
		retry.textContent = 'Retry';
		retry.addEventListener('click', () => {
			error.hidden = true;
			try { webview.reload(); } catch { webview.setAttribute('src', node.url); }
		});
		error.append(message, retry);
		webview.addEventListener('did-fail-load', (e) => {
			if (e.errorCode === -3 || e.isMainFrame === false) return; // aborted / subframe
			message.textContent = `Couldn’t load ${node.url}${e.errorDescription ? ` (${e.errorDescription})` : ''}`;
			error.hidden = false;
		});
		webview.addEventListener('did-start-loading', () => { error.hidden = true; });

		wrap.append(webview, error, titleBar(node));
		return wrap;
	}

	// file nodes
	const path = node.file;
	const wrap = document.createElement('div');
	wrap.className = 'canvas-embed';
	if (isNotePath(path)) {
		const iframe = document.createElement('iframe');
		// Unsandboxed like every preview frame (PDF embeds inside notes);
		// isolation comes from the clew-preview:// origin. See CLAUDE.md.
		iframe.className = 'canvas-note-frame';
		iframe.src = previewUrl(path);
		wrap.append(iframe, titleBar(node));
		embedHooks?.register?.(node.id, iframe, path);
		return wrap;
	}
	const kind = fileKind(path);
	const url = vaultFileUrl(path);
	if (kind === 'image') {
		const img = document.createElement('img');
		img.className = 'canvas-image';
		img.src = url;
		img.draggable = false;
		wrap.append(img);
	} else if (kind === 'pdf') {
		const iframe = document.createElement('iframe');
		iframe.className = 'canvas-pdf-frame';
		iframe.src = url;
		wrap.append(iframe, titleBar(node));
	} else if (kind === 'audio') {
		const audio = document.createElement('audio');
		audio.controls = true;
		audio.src = url;
		wrap.append(audio, titleBar(node));
	} else if (kind === 'video') {
		const video = document.createElement('video');
		video.controls = true;
		video.src = url;
		wrap.append(video, titleBar(node));
	} else {
		const missing = document.createElement('div');
		missing.className = 'canvas-missing';
		missing.textContent = path ? `No viewer for ${path}` : 'Missing file';
		wrap.append(missing, titleBar(node));
	}
	return wrap;
}

function titleBar(node) {
	const bar = document.createElement('div');
	bar.className = 'canvas-node-title';
	bar.textContent = nodeTitle(node);
	return bar;
}

/** A stable content identity — when this changes, content must be rebuilt. */
export function contentKey(node) {
	if (node.type === 'file') return `file:${node.file}`;
	if (node.type === 'link') return `link:${node.url}`;
	return node.type;
}
