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

// Named tile styles (all ToS-clean, attribution required). Voyager — the
// Google-Maps-like cartography from CARTO — is the default look.
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_ATTR = OSM_ATTR + ' © <a href="https://carto.com/attributions">CARTO</a>';
const TILE_STYLES = {
	voyager: {
		url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
		attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20,
	},
	light: {
		url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
		attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20,
	},
	dark: {
		url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
		attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, dark: true,
	},
	satellite: {
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		attribution: '© Esri, Maxar, Earthstar Geographics', maxZoom: 19, dark: true,
	},
	terrain: {
		url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
		attribution: OSM_ATTR + ', SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a>', maxZoom: 17,
	},
	osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR, maxZoom: 19 },
};

export async function initLeafletMaps() {
	const pending = [...document.querySelectorAll('.clew-leaflet[data-leaflet]')]
		.filter((el) => !el.dataset.leafletInit);
	if (pending.length === 0) return;
	// Claim BEFORE the async library load: init runs both at page load and
	// after every morph, and an unclaimed div would be double-initialized
	// ("Map container is already initialized") by the second caller.
	for (const el of pending) el.dataset.leafletInit = '1';
	try {
		await loadLeaflet();
	} catch {
		for (const el of pending) el.textContent = '(map library failed to load)';
		return;
	}
	for (const el of pending) {
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
	const style = config.tileServer
		? { url: config.tileServer, attribution: '' }
		: TILE_STYLES[config.tiles] ?? TILE_STYLES.voyager;
	map = L.map(el, {
		minZoom: config.minZoom,
		maxZoom: config.maxZoom ?? style.maxZoom,
	}).setView([config.lat ?? 0, config.long ?? 0], config.zoom ?? 5);
	const tiles = L.tileLayer(style.url, {
		attribution: style.attribution,
		...(style.subdomains ? { subdomains: style.subdomains } : {}),
		...(style.maxZoom ? { maxZoom: style.maxZoom } : {}),
	});
	tiles.addTo(map);
	// Styles that are already dark (or photographic) skip the dark-theme dim.
	if (style.dark) el.classList.add('is-light');
	if (config.darkMode) el.classList.add('is-dark');
	addMarkers(map, config);
	const photoPins = addPhotoMarkers(map, config);

	// Photo maps auto-fit unless the fence pinned an explicit view.
	const fitAll = [
		...photoPins,
		...(config.markers ?? []).map((m) => [m.lat, m.long]),
	];
	if (config.lat === undefined && fitAll.length) {
		map.fitBounds(fitAll, { padding: [40, 40], maxZoom: config.zoom ?? 15 });
	}
	if (config.photosSkipped || config.photosError) {
		const note = L.control({ position: 'bottomleft' });
		note.onAdd = () => {
			const div = document.createElement('div');
			div.className = 'clew-leaflet-note';
			div.textContent = config.photosError
				?? `${config.photosSkipped} photo${config.photosSkipped === 1 ? '' : 's'} without location`;
			return div;
		};
		note.addTo(map);
	}
}

/** Photo pins: thumbnail popup + open-the-photo + a note wikilink (which
 *  Clew creates on first click — the "add notes to the day" workflow). */
function addPhotoMarkers(map, config) {
	const L = window.L;
	const points = [];
	for (const p of config.photoMarkers ?? []) {
		points.push([p.lat, p.long]);
		const marker = L.marker([p.lat, p.long]).addTo(map);
		const popup = document.createElement('div');
		popup.className = 'clew-leaflet-photo';
		const img = document.createElement('img');
		img.src = p.url;
		img.alt = p.name;
		img.title = 'Open the photo';
		img.addEventListener('click', () => post({ type: 'link-click', target: p.file, newTab: true }));
		const caption = document.createElement('div');
		caption.className = 'photo-caption';
		const note = document.createElement('a');
		note.href = '#';
		note.textContent = p.name;
		note.title = `Open (or create) the note “${p.name}”`;
		note.addEventListener('click', (e) => {
			e.preventDefault();
			post({ type: 'link-click', target: p.name, newTab: true });
		});
		caption.append(note);
		if (p.time) {
			const time = document.createElement('span');
			const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2})/.exec(p.time);
			time.textContent = m ? ` ${m[3]}/${m[2]} ${m[4]}` : '';
			caption.append(time);
		}
		popup.append(img, caption);
		marker.bindPopup(popup, { minWidth: 180 });
	}
	return points;
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
