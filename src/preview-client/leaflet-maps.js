// Interactive Leaflet maps in rendered notes (```leaflet fences — see
// src/engine/obsidian-fences.js for the config syntax). Leaflet loads
// lazily from the bundled assets the first time a document contains a map;
// tile layers come from OpenStreetMap by default (network required), or an
// `image:` map renders fully offline from a vault image.

let leafletLoading = null;

function loadLeaflet() {
	leafletLoading ??= new Promise((resolve, reject) => {
		const css = document.createElement('link');
		css.rel = 'stylesheet';
		css.href = '/__clew_assets__/leaflet/leaflet.css';
		document.head.append(css);
		const script = document.createElement('script');
		script.src = '/__clew_assets__/leaflet/leaflet.js';
		script.onload = () => {
			// Default marker icons resolve relative to the bundled assets.
			window.L.Icon.Default.prototype.options.imagePath = '/__clew_assets__/leaflet/images/';
			resolve();
		};
		script.onerror = () => reject(new Error('Leaflet failed to load'));
		document.head.append(script);
	});
	return leafletLoading;
}

const post = (msg) => window.parent.postMessage({ source: 'clew-preview', ...msg }, '*');

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export async function initLeafletMaps() {
	const pending = [...document.querySelectorAll('.clew-leaflet[data-leaflet]')]
		.filter((el) => !el.dataset.leafletInit);
	if (pending.length === 0) return;
	try {
		await loadLeaflet();
	} catch {
		for (const el of pending) el.textContent = '(map library failed to load)';
		return;
	}
	for (const el of pending) {
		el.dataset.leafletInit = '1';
		try {
			buildMap(el, JSON.parse(el.dataset.leaflet));
		} catch (err) {
			el.textContent = `(map failed: ${err.message})`;
		}
	}
}

function buildMap(el, config) {
	const L = window.L;
	let map;
	if (config.imageUrl) {
		// Image-based map (a floor plan, a fantasy map): simple CRS over the
		// image's own pixel space, fit to the image bounds once it loads.
		map = L.map(el, { crs: L.CRS.Simple, minZoom: -4 });
		const img = new Image();
		img.onload = () => {
			const bounds = [[0, 0], [img.naturalHeight, img.naturalWidth]];
			L.imageOverlay(config.imageUrl, bounds).addTo(map);
			map.fitBounds(bounds);
			addMarkers(map, config);
		};
		img.src = config.imageUrl;
		return;
	}
	map = L.map(el, {
		minZoom: config.minZoom,
		maxZoom: config.maxZoom,
	}).setView([config.lat ?? 0, config.long ?? 0], config.zoom ?? 5);
	const tiles = L.tileLayer(config.tileServer ?? OSM_TILES, {
		attribution: config.tileServer ? '' : OSM_ATTRIBUTION,
	});
	tiles.addTo(map);
	if (config.darkMode) el.classList.add('is-dark');
	addMarkers(map, config);
}

function addMarkers(map, config) {
	const L = window.L;
	for (const m of config.markers ?? []) {
		const marker = L.marker([m.lat, m.long]).addTo(map);
		if (m.link) {
			// A wikilink marker: popup with an internal link that opens in the app.
			const a = document.createElement('a');
			a.href = '#';
			a.textContent = m.label ?? m.link;
			a.addEventListener('click', (e) => {
				e.preventDefault();
				post({ type: 'link-click', target: m.link, newTab: e.metaKey || e.ctrlKey });
			});
			marker.bindPopup(a);
		} else if (m.label) {
			marker.bindPopup(document.createTextNode(m.label));
		}
	}
}
