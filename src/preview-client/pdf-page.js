// The standalone PDF viewer page.
//
// The file tab (<clew-file-view>) and canvas PDF nodes point an iframe at a
// raw PDF today, which is what makes Chromium's plugin appear. There is no
// HTML document there, so there is nothing for the preview client to upgrade
// — those surfaces need a page of their own. This is it:
//
//   clew-preview://vault/<sid>/__clew_assets__/clewpdf/pdf-page.html?src=<url>
//
// It is served from the clew-preview origin, so it can fetch the PDF and
// postMessage its saves to the app page exactly as the note-embed viewer
// does. Same pdf-core.js, same autosave, same annotations.
import { createViewer } from './pdf-core.js';

const params = new URLSearchParams(location.search);
const src = params.get('src');

const root = document.getElementById('viewer');
const status = document.getElementById('status');
const onStatus = (text) => {
	status.textContent = text;
	status.style.opacity = text ? '1' : '0';
};

let viewer = null;

/** Scroll to `page` once the viewer has laid its pages out: a scroll asked
 *  for too early lands nowhere (measured — it worked only when something
 *  slowed the page down), so try until the current page says so. */
async function showPage(page) {
	for (let i = 0; i < 20; i += 1) {
		viewer?.scrollToPage?.(page);
		await new Promise((r) => setTimeout(r, 250));
		if (viewer?.currentPage?.() === page) return true;
	}
	return false;
}
if (!src) {
	onStatus('no PDF given');
} else {
	createViewer({ target: root, src, onStatus }).then((handle) => {
		viewer = handle;
		window.__clewPdfHandle = handle;   // scenarios
		// `[[paper.pdf#page=12]]` (§5.15): open there.
		const page = Number(params.get('page'));
		if (page > 1) showPage(page);
	}).catch((err) => {
		console.warn('[clew pdf] page viewer failed:', err);
		window.__clewPdfError = String(err?.message ?? err);
		onStatus('viewer failed');
		root.textContent = `PDF viewer failed: ${err?.message ?? err}`;
	});
}

// Thumbnail mode (`&thumb=1`, main/pdf-thumbs.js): an offscreen window asks
// for page 1 as a PNG, base64, its long side `maxPx`. null until the document
// is open (main asks again); { error } when it cannot be drawn.
window.__clewThumb = async (maxPx = 1024) => {
	if (!params.get('thumb') || !viewer?.container) return window.__clewPdfError ? { error: window.__clewPdfError } : null;
	try {
		const registry = await viewer.container.registry;
		const render = registry?.getPlugin('render')?.provides();
		if (!render) return null;
		const draw = async (scaleFactor) => {
			const task = render.renderPage({ pageIndex: 0, options: { scaleFactor, dpr: 1, imageType: 'image/png' } });
			return typeof task?.toPromise === 'function' ? task.toPromise() : task;
		};
		// Once at a scale of 1 (points) to learn the page's size, then at the
		// scale that makes its long side maxPx.
		let blob = await draw(1);
		const probe = await createImageBitmap(blob);
		const scale = Math.min(4, maxPx / Math.max(probe.width, probe.height));
		probe.close?.();
		if (Math.abs(scale - 1) > 0.01) blob = await draw(scale);
		const bytes = new Uint8Array(await blob.arrayBuffer());
		let binary = '';
		for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		return { png: btoa(binary) };
	} catch (err) {
		// "Document … not loaded": not yet — ask again.
		return /not loaded/i.test(String(err?.message)) ? null : { error: String(err?.message ?? err) };
	}
};

// The app page owns the theme; follow it so a PDF tab is not a white slab in
// a dark window (and vice versa). Same message shape the preview client uses.
window.addEventListener('message', (event) => {
	const msg = event.data;
	if (msg?.source === 'clew-preview-host' && msg.type === 'theme') {
		document.documentElement.dataset.theme = msg.theme;
	}
	// The host asks for the annotations (renderer/pdf-annotations.js) or a
	// page (a page anchor into an open tab) — the app page only (window.top;
	// a tab's viewer has it as its parent, a canvas scene's viewer inside a
	// note does not), or this page's own parent; never another frame that
	// happens to hold a reference to this one. Answers go back to the asker.
	if (event.source !== window.parent && event.source !== window.top) return;
	const asker = event.source;
	if (msg?.source === 'clew-preview-host' && msg.type === 'pdf-page' && viewer?.scrollToPage) {
		showPage(msg.page).then((ok) => {
			if (ok) asker.postMessage({ source: 'clew-preview', type: 'pdf-page-shown', page: msg.page }, '*');
		});
	}
	if (msg?.source === 'clew-preview-host' && msg.type === 'test-create-annotations') {
		viewer?.createAnnotations?.(msg.specs ?? []).then((made) => asker.postMessage({ source: 'clew-preview', type: 'test-created', made }, '*'));
	}
	if (msg?.source === 'clew-preview-host' && msg.type === 'list-annotations') {
		const reply = (annotations, error) => asker.postMessage({ source: 'clew-preview', type: 'annotations', requestId: msg.requestId, annotations, error }, '*');
		if (!viewer?.listAnnotations) reply([], 'The viewer is still loading');
		else viewer.listAnnotations().then((a) => reply(a, null), (err) => reply([], String(err?.message ?? err)));
	}
});
