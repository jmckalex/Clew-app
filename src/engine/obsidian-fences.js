// Obsidian-compatibility fences for the render worker. Obsidian writes
// mermaid diagrams as ```mermaid code fences; jmarkdown's native forms are
// :::mermaid / @begin(mermaid). This extension makes the fence render as a
// client-side mermaid diagram in HTML previews. (For LaTeX export use the
// native forms — those rasterise via mmdc; a fence exports as nothing.)
//
// Loaded via the vault's generated .jmarkdown/config.json:
//     "Extensions": [..., "mermaidFence from <dist>/engine/obsidian-fences.js"]
import { resolveFileTarget, sitePath } from './wikilinks.js';

const escapeHtml = (s) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const mermaidFence = {
	name: 'mermaidFence',
	level: 'block',
	start(src) { return src.match(/^```mermaid/m)?.index; },
	tokenizer(src) {
		const match = /^```mermaid[ \t]*\n([\s\S]*?)\n```[ \t]*(?:\n+|$)/.exec(src);
		if (!match) return;
		return { type: 'mermaidFence', raw: match[0], text: match[1] };
	},
	renderer(token) {
		if (global.isLatex) return '';
		// mermaid.js reads the element's textContent, so entity-escaping is safe
		// (and keeps diagram text from being parsed as HTML).
		return `<div class="mermaid">\n${escapeHtml(token.text)}\n</div>\n`;
	},
};

/**
 * Parse a ```leaflet fence body (obsidian-leaflet-compatible subset):
 * `key: value` lines — lat, long, zoom, minZoom, maxZoom, height,
 * defaultZoom (alias of zoom), tileServer, darkMode — plus repeatable
 * `marker: lat, long[, link or label]` lines and `image: [[file]]` for
 * image-based maps. Unknown keys are ignored. Pure; exported for tests.
 */
export function parseLeafletConfig(body) {
	const config = { markers: [] };
	const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
	for (const line of body.split('\n')) {
		const m = /^\s*([A-Za-z]+)\s*:\s*(.+?)\s*$/.exec(line);
		if (!m) continue;
		const key = m[1].toLowerCase();
		const value = m[2];
		if (key === 'lat') config.lat = num(value);
		else if (key === 'long' || key === 'lng') config.long = num(value);
		else if (key === 'zoom' || key === 'defaultzoom') config.zoom = num(value);
		else if (key === 'minzoom') config.minZoom = num(value);
		else if (key === 'maxzoom') config.maxZoom = num(value);
		else if (key === 'height') config.height = /^\d+$/.test(value) ? `${value}px` : value;
		else if (key === 'tileserver') config.tileServer = value;
		else if (key === 'darkmode') config.darkMode = value === 'true';
		else if (key === 'image') {
			const wiki = /\[\[([^\[\]|]+)\]\]/.exec(value);
			config.image = (wiki ? wiki[1] : value).trim();
		} else if (key === 'marker') {
			// marker: [type,] lat, long [, [[link]] or label text]
			const parts = value.split(',').map((s) => s.trim());
			if (parts.length && !/^-?[\d.]+$/.test(parts[0])) parts.shift(); // optional type
			const lat = num(parts[0]);
			const long = num(parts[1]);
			if (lat === undefined || long === undefined) continue;
			const rest = parts.slice(2).join(', ');
			const wiki = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/.exec(rest);
			const marker = { lat, long };
			if (wiki) {
				marker.link = wiki[1].trim();
				marker.label = (wiki[2] ?? wiki[1]).trim();
			} else if (rest) {
				marker.label = rest;
			}
			config.markers.push(marker);
		}
	}
	return config;
}

// ```leaflet fences → an interactive Leaflet.js map, initialized client-side
// by the preview client (leaflet-maps.js) from the JSON config carried in
// the data attribute. Tiles come from OpenStreetMap by default (network);
// `image: [[file.png]]` makes an offline image-based map instead.
export const leafletFence = {
	name: 'leafletFence',
	level: 'block',
	start(src) { return src.match(/^```leaflet/m)?.index; },
	tokenizer(src) {
		const match = /^```leaflet[ \t]*\n([\s\S]*?)\n```[ \t]*(?:\n+|$)/.exec(src);
		if (!match) return;
		return { type: 'leafletFence', raw: match[0], text: match[1] };
	},
	renderer(token) {
		if (global.isLatex) return '';
		const config = parseLeafletConfig(token.text);
		if (config.image) {
			// Resolve the image like any attachment wikilink and emit its URL.
			const rel = resolveFileTarget(config.image);
			config.imageUrl = rel ? sitePath(rel) : null;
		}
		const json = JSON.stringify(config)
			.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
		const height = config.height ?? '400px';
		return `<div class="clew-leaflet" data-leaflet="${json}" style="height:${height}"></div>\n`;
	},
};

export default [mermaidFence, leafletFence];
