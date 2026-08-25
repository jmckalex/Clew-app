// SPIKE (branch spike/embedpdf) — the note-embed PDF surface.
//
// Upgrades the engine's <embed class="pdf-embed"> (from ![[paper.pdf]]) into a
// live EmbedPDF viewer at reading height: read, search, zoom and annotate in
// place, with annotations saved back into the vault's own file. The viewer
// itself lives in pdf-core.js, shared with the standalone viewer page that
// the file tab and canvas nodes use.
import { createViewer } from './pdf-core.js';

const CSS = `
.clew-pdf-inline { height: 70vh; position: relative; border-radius: 4px; overflow: hidden; }
.clew-pdf-status { float: right; font-size: 0.85em; opacity: 0.7; padding: 2px 8px; }
.clew-pdf-message { padding: 24px; text-align: center; opacity: 0.8; }
`;

function ensureStyles() {
	if (document.getElementById('clew-pdf-inline-css')) return;
	const style = document.createElement('style');
	style.id = 'clew-pdf-inline-css';
	style.textContent = CSS;
	document.head.append(style);
}

const viewers = new Set();
window.__clewPdfViewers = viewers; // smoke-test hook

function reapDetached() {
	for (const inst of viewers) {
		if (inst.host.isConnected) continue;
		viewers.delete(inst);
		inst.handle?.dispose();
	}
}

export function initPdfEmbeds() {
	reapDetached();
	for (const embed of document.querySelectorAll('embed.pdf-embed')) {
		// A morph re-inserts the engine's own <embed> beside the viewer we kept
		// (data-clew-keep), so without this a second Pdfium engine would spin up
		// for the same PDF on every re-render. The live viewer wins.
		const box = embed.closest('.pdf-embed-box');
		if (box?.querySelector('.clew-pdf-inline')) {
			embed.remove();
			continue;
		}
		mount(embed);
	}
}

function mount(embed) {
	ensureStyles();
	const src = embed.getAttribute('src');
	const host = document.createElement('div');
	host.className = 'clew-pdf-inline';
	// The viewer is expensive to build and holds document state (including
	// unsaved annotations), so it must survive morphdom rather than be rebuilt.
	host.setAttribute('data-clew-keep', '');
	embed.replaceWith(host);

	const titleBar = host.closest('.pdf-embed-box')?.querySelector('.embed-title');
	let statusEl = titleBar?.querySelector('.clew-pdf-status');
	if (titleBar && !statusEl) {
		statusEl = document.createElement('span');
		statusEl.className = 'clew-pdf-status';
		titleBar.append(statusEl);
	}
	const onStatus = (text) => { if (statusEl) statusEl.textContent = text; };

	// A note may hold several PDFs and each viewer is its own Pdfium engine,
	// so build one only as its box approaches the viewport.
	const observer = new IntersectionObserver((entries) => {
		if (!entries.some((entry) => entry.isIntersecting)) return;
		observer.disconnect();
		build(host, src, onStatus);
	}, { rootMargin: '100% 0%' });
	observer.observe(host);
}

async function build(host, src, onStatus) {
	const inst = { host, handle: null };
	viewers.add(inst);
	try {
		inst.handle = await createViewer({ target: host, src, onStatus });
	} catch (err) {
		console.warn('[clew pdf] inline viewer failed:', err);
		window.__clewPdfError = String(err?.message ?? err);
		onStatus('viewer failed');
		const message = document.createElement('div');
		message.className = 'clew-pdf-message';
		message.textContent = `PDF viewer failed: ${err?.message ?? err}`;
		host.replaceChildren(message);
	}
}
