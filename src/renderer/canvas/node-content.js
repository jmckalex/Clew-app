// Canvas node content builders. Content is inert by default (pointer-events
// none) so the canvas owns dragging; a double-clicked ("engaged") node turns
// its content interactive. Note embeds are live jmarkdown previews — the
// canvas view drives their render subscription and postMessage traffic.
import { fileKind, vaultFileUrl } from '../lib/file-types.js';
import { isNotePath } from '../state/vault-store.js';
import { previewUrl } from '../components/workspace/clew-preview-view.js';

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
		el.textContent = node.text ?? '';
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
		wrap.append(webview, titleBar(node));
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
