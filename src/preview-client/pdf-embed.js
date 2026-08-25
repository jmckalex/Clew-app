// SPIKE (branch spike/embedpdf) — NOT a shipping decision.
//
// Replaces Chromium's <embed type="application/pdf"> inside note previews
// with an EmbedPDF viewer (MIT; Pdfium compiled to wasm), the same surface
// Clew-iOS uses, so the two platforms can offer the same PDF experience —
// annotation in particular, which the Chromium plugin does not give us.
//
// Architecture follows the lesson Clew-iOS paid for on a real iPad: heavy
// wasm belongs in a clew-preview document with the WORKER engine, never on
// the app page. On desktop that falls out for free — every PDF surface is
// already a clew-preview:// iframe, and those documents carry no CSP.
//
// Load-bearing details, both inherited from the iOS port:
//   * the viewer is fed an ArrayBuffer via openDocumentBuffer, not a URL:
//     third-party URL loaders allowlist http(s)/blob and mistake a
//     clew-preview:// path for base64 data;
//   * fonts and fallbacks are pinned to null — airgapped, no jsDelivr or
//     Google Fonts reaching out of the vault.
const EMBEDPDF_ASSETS = '/__clew_assets__/embedpdf';

// Template literal on purpose: esbuild cannot resolve it, so the ESM bundle
// (and its hashed chunks, which resolve relative to this URL) is fetched at
// runtime from our own assets rather than being pulled into the client.
let embedPdfPromise = null;
const loadEmbedPdf = () => (embedPdfPromise ??= import(`${EMBEDPDF_ASSETS}/embedpdf.js`));

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

// Live viewers, torn down when a re-render replaces their host element.
const viewers = new Set();
window.__clewPdfViewers = viewers; // smoke-test hook

function reapDetached() {
	for (const inst of viewers) {
		if (inst.host.isConnected) continue;
		viewers.delete(inst);
		inst.dispose();
	}
}

export function initPdfEmbeds() {
	reapDetached();
	for (const embed of document.querySelectorAll('embed.pdf-embed')) {
		// A morph re-inserts the engine's own <embed> next to the viewer we
		// kept (data-clew-keep), so without this a second Pdfium engine spins
		// up for the same PDF on every re-render. The viewer already showing
		// this file wins; the re-introduced element is just dropped.
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
	// Survive morphdom: the viewer is expensive to build and holds document
	// state, so it must not be discarded and rebuilt on every save.
	host.setAttribute('data-clew-keep', '');
	embed.replaceWith(host);

	const titleBar = host.closest('.pdf-embed-box')?.querySelector('.embed-title');
	let statusEl = titleBar?.querySelector('.clew-pdf-status');
	if (titleBar && !statusEl) {
		statusEl = document.createElement('span');
		statusEl.className = 'clew-pdf-status';
		titleBar.append(statusEl);
	}
	const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };

	// A note may hold several PDFs and each viewer is its own Pdfium engine,
	// so build one only as its box approaches the viewport.
	const observer = new IntersectionObserver((entries) => {
		if (!entries.some((entry) => entry.isIntersecting)) return;
		observer.disconnect();
		build(host, src, setStatus);
	}, { rootMargin: '100% 0%' });
	observer.observe(host);
}

async function build(host, src, setStatus) {
	const inst = { host, container: null, dispose() { this.container?.destroy?.(); } };
	viewers.add(inst);
	const started = performance.now();
	try {
		setStatus('loading…');
		const [{ default: EmbedPDF }, buffer] = await Promise.all([
			loadEmbedPdf(),
			fetch(src).then((r) => r.arrayBuffer()),
		]);
		if (!host.isConnected) return; // re-rendered away while loading

		const container = EmbedPDF.init({
			type: 'container',
			target: host,
			wasmUrl: new URL(`${EMBEDPDF_ASSETS}/pdfium.wasm`, location.href).href,
			fontFallback: null,                    // airgapped
			fonts: { ui: null, signature: null },  // airgapped
			theme: { preference: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark' },
			tabBar: 'never',
		});
		if (!container) throw new Error('EmbedPDF.init returned nothing');
		inst.container = container;

		const registry = await container.registry;
		const docManager = registry.getPlugin('document-manager')?.provides();
		if (!docManager) throw new Error('document-manager plugin unavailable');
		await docManager.openDocumentBuffer({
			buffer,
			name: decodeURIComponent(src.split('/').pop() ?? 'document.pdf'),
		}).toPromise();

		const ms = Math.round(performance.now() - started);
		setStatus(`ready ${ms}ms`);
		// Spike instrumentation: what the report is measuring.
		window.__clewPdfReady = (window.__clewPdfReady ?? 0) + 1;
		window.__clewPdfLastMs = ms;
		window.__clewPdfPlugins = registry.getPlugins?.().map?.((p) => p.id ?? p.name) ?? null;
	} catch (err) {
		console.warn('[clew pdf spike] viewer failed:', err);
		window.__clewPdfError = String(err?.message ?? err);
		setStatus('viewer failed');
		const message = document.createElement('div');
		message.className = 'clew-pdf-message';
		message.textContent = `PDF viewer failed: ${err?.message ?? err}`;
		host.replaceChildren(message);
	}
}
