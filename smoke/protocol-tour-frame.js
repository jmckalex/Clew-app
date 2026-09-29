// Runs in the toured note's preview frame (protocol-tour-scenario.js): what
// each preview-protocol consumer actually drew.
const q = (sel) => document.querySelectorAll(sel);
const imgs = [...q('img')];
const out = {
	leaflet: q('.leaflet-container').length,
	'leaflet-data': q('.leaflet-overlay-pane path, .leaflet-marker-icon').length,
	'canvas-scenes': q('.canvas-embed-scene').length,
	'canvas-scene-nodes': q('.canvas-embed-scene [data-id], .canvas-embed-scene .ce-node').length,
	excalidraw: q('.excalidraw-embed svg, [data-excalidraw] svg').length,
	'pdf-viewers': q('.clew-pdf-inline').length,
	'pdf-ready': window.__clewPdfReady ?? 0,
	mermaid: q('.mermaid svg').length,
	math: q('mjx-container').length,
	'figures-ok': q('.mpw-ok').length,
	'figures-error': q('.mpw-error').length,
	iframes: q('iframe').length,
	images: imgs.length,
	'images-broken': imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
	'note-api': typeof window.clew?.kv?.get === 'function' || typeof window.clew?.get === 'function',
};
console.log(`smoke-tour-frame ${decodeURIComponent(location.pathname.split('/').pop())}: ` + Object.entries(out).map(([k, v]) => `${k}=${v}`).join(' '));
