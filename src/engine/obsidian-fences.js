// Obsidian-compatibility fences for the render worker. Obsidian writes
// mermaid diagrams as ```mermaid code fences; jmarkdown's native forms are
// :::mermaid / @begin(mermaid). This extension makes the fence render as a
// client-side mermaid diagram in HTML previews. (For LaTeX export use the
// native forms — those rasterise via mmdc; a fence exports as nothing.)
//
// Loaded via the vault's generated .jmarkdown/config.json:
//     "Extensions": [..., "mermaidFence from <dist>/engine/obsidian-fences.js"]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveFileTarget, sitePath } from './wikilinks.js';
import { exifGps } from './exif-gps.js';

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
		else if (key === 'tiles' || key === 'style') config.tiles = value.toLowerCase();
		else if (key === 'darkmode') config.darkMode = value === 'true';
		else if (key === 'image') {
			const wiki = /\[\[([^\[\]|]+)\]\]/.exec(value);
			config.image = (wiki ? wiki[1] : value).trim();
		} else if (key === 'photos') {
			const wiki = /\[\[([^\[\]|]+)\]\]/.exec(value);
			config.photos = (wiki ? wiki[1] : value).trim();
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
		if (config.photos) {
			const scanned = scanPhotoFolder(config.photos);
			config.photoMarkers = scanned.markers;
			config.photosSkipped = scanned.skipped;
			config.photosError = scanned.error;
			delete config.photos;
		}
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

// ---- photo maps ------------------------------------------------------------

const JPEG_EXT = /\.(jpe?g)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;

/** Resolve a photos folder: vault-relative path first, else a walk for a
 *  directory whose path ends with the target (case-insensitive). */
function resolvePhotoFolder(target) {
	const root = process.env.CLEW_VAULT_ROOT;
	if (!root) return null;
	const direct = path.join(root, target);
	if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
	const wanted = ('/' + target).toLowerCase();
	const IGNORED = new Set(['.obsidian', '.clew', '.git', 'node_modules', '.trash']);
	const stack = [''];
	while (stack.length) {
		const rel = stack.pop();
		let entries;
		try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { continue; }
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			if (('/' + childRel).toLowerCase().endsWith(wanted)) return path.join(root, childRel);
			stack.push(childRel);
		}
	}
	return null;
}

/**
 * Scan a vault folder for geotagged photos → map markers. HEIC files are
 * auto-converted to JPEG alongside the original (macOS sips; skipped with
 * a count elsewhere) so iPhone photos never need manual conversion; the
 * conversion runs once — an existing, newer .jpg wins.
 */
function scanPhotoFolder(target) {
	const root = process.env.CLEW_VAULT_ROOT;
	const dir = resolvePhotoFolder(target);
	if (!dir) return { markers: [], skipped: 0, error: `folder not found: ${target}` };
	let names;
	try { names = fs.readdirSync(dir); } catch { return { markers: [], skipped: 0, error: `unreadable: ${target}` }; }

	// HEIC → JPEG first, so the JPEG pass below picks the conversions up.
	if (process.platform === 'darwin') {
		for (const name of names) {
			if (!HEIC_EXT.test(name)) continue;
			const src = path.join(dir, name);
			const dst = src.replace(HEIC_EXT, '.jpg');
			try {
				if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;
				execFileSync('sips', ['-s', 'format', 'jpeg', src, '--out', dst], { stdio: 'ignore' });
			} catch { /* counted as skipped below when no jpg exists */ }
		}
		names = fs.readdirSync(dir);
	}

	const markers = [];
	let skipped = 0;
	for (const name of names.sort()) {
		if (HEIC_EXT.test(name)) {
			// Only counts as skipped when conversion didn't produce a JPEG.
			if (!names.includes(name.replace(HEIC_EXT, '.jpg'))) skipped++;
			continue;
		}
		if (!JPEG_EXT.test(name)) continue;
		const abs = path.join(dir, name);
		let gps = null;
		try {
			// EXIF lives at the front of the file; 256KB is generous.
			const fd = fs.openSync(abs, 'r');
			const head = Buffer.alloc(Math.min(262144, fs.statSync(abs).size));
			fs.readSync(fd, head, 0, head.length, 0);
			fs.closeSync(fd);
			gps = exifGps(head);
		} catch { /* unreadable — skipped */ }
		if (!gps) { skipped++; continue; }
		const rel = path.relative(root, abs).split(path.sep).join('/');
		markers.push({
			lat: gps.lat, long: gps.long,
			url: sitePath(rel), file: rel,
			name: name.replace(JPEG_EXT, ''),
			...(gps.time ? { time: gps.time } : {}),
		});
	}
	return { markers, skipped, error: null };
}

export default [mermaidFence, leafletFence];
