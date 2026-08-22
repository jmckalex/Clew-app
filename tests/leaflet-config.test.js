import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLeafletConfig } from '../src/engine/obsidian-fences.js';

test('basic map config', () => {
	const c = parseLeafletConfig('lat: 51.5\nlong: -0.12\nzoom: 13\nheight: 380');
	assert.equal(c.lat, 51.5);
	assert.equal(c.long, -0.12);
	assert.equal(c.zoom, 13);
	assert.equal(c.height, '380px');
	assert.deepEqual(c.markers, []);
});

test('markers with labels and wikilinks', () => {
	const c = parseLeafletConfig([
		'marker: 51.5007, -0.1246, Westminster',
		'marker: 51.5145, -0.1163, [[Welcome|The LSE]]',
		'marker: default, 48.85, 2.35',
		'marker: not-a-number, x',
	].join('\n'));
	assert.equal(c.markers.length, 3);
	assert.deepEqual(c.markers[0], { lat: 51.5007, long: -0.1246, label: 'Westminster' });
	assert.deepEqual(c.markers[1], { lat: 51.5145, long: -0.1163, link: 'Welcome', label: 'The LSE' });
	assert.deepEqual(c.markers[2], { lat: 48.85, long: 2.35 });
});

test('aliases, image, tile server, dark mode', () => {
	const c = parseLeafletConfig([
		'lng: 10', 'defaultZoom: 4', 'minZoom: 2', 'maxZoom: 9',
		'image: [[map.png]]', 'tileServer: https://x/{z}/{x}/{y}.png', 'darkMode: true',
		'height: 50vh',
	].join('\n'));
	assert.equal(c.long, 10);
	assert.equal(c.zoom, 4);
	assert.equal(c.minZoom, 2);
	assert.equal(c.maxZoom, 9);
	assert.equal(c.image, 'map.png');
	assert.equal(c.tileServer, 'https://x/{z}/{x}/{y}.png');
	assert.equal(c.darkMode, true);
	assert.equal(c.height, '50vh');
});

test('unknown keys and junk lines are ignored', () => {
	const c = parseLeafletConfig('id: my-map\nnot a config line\nbounds: [[1,2],[3,4]]');
	assert.deepEqual(c.markers, []);
	assert.equal(c.lat, undefined);
});

test('photos folder key', () => {
	assert.equal(parseLeafletConfig('photos: [[Holiday/Day 3]]').photos, 'Holiday/Day 3');
	assert.equal(parseLeafletConfig('photos: Trips/Rome').photos, 'Trips/Rome');
});

test('named tile styles', () => {
	assert.equal(parseLeafletConfig('tiles: Satellite').tiles, 'satellite');
	assert.equal(parseLeafletConfig('style: dark').tiles, 'dark');
});

test('leaflet-plugin parity keys', () => {
	const c = parseLeafletConfig([
		'width: 80%', 'zoomDelta: 0.5', 'unit: mi', 'scale: 2',
		'bounds: [[10,20],[30,40]]',
		'noScrollZoom: true', 'lock: true', 'recenter: true',
		'zoomFeatures: true', 'showAllMarkers: true', 'noUI: true',
		'overlayColor: blue',
		'overlay: red, 51.5, -0.1, 500m, Blast radius',
		'overlay: 48.85, 2.35, 2km',
		'geojson: [[regions.json]]', 'geojsonColor: green',
		'gpx: [[walk.gpx]]', 'gpxColor: orange',
		'markerFile: [[Rome Trip]]', 'markerFolder: Trips', 'markerTag: #travel',
		'tileOverlay: https://x/{z}/{x}/{y}.png', 'tileSubdomains: abcd',
		'imageOverlay: [[old-map.png]], [[41.8,12.4],[41.95,12.55]]',
		'marker: red, 41.9, 12.5, Colosseum',
	].join('\n'));
	assert.equal(c.width, '80%');
	assert.equal(c.zoomDelta, 0.5);
	assert.equal(c.unit, 'mi');
	assert.equal(c.scale, 2);
	assert.deepEqual(c.bounds, [[10, 20], [30, 40]]);
	assert.equal(c.noScrollZoom, true);
	assert.equal(c.lock, true);
	assert.equal(c.recenter, true);
	assert.equal(c.zoomFeatures, true);
	assert.equal(c.showAllMarkers, true);
	assert.equal(c.noUI, true);
	assert.equal(c.overlays.length, 2);
	assert.deepEqual(c.overlays[0], { lat: 51.5, long: -0.1, radius: 500, color: 'red', label: 'Blast radius' });
	assert.equal(c.overlays[1].radius, 2000);
	assert.deepEqual(c.geojsonFiles, ['regions.json']);
	assert.equal(c.geojsonColor, 'green');
	assert.deepEqual(c.gpxFiles, ['walk.gpx']);
	assert.deepEqual(c.markerFiles, ['Rome Trip']);
	assert.deepEqual(c.markerFolders, ['Trips']);
	assert.deepEqual(c.markerTags, ['travel']);
	assert.equal(c.tileOverlays.length, 1);
	assert.equal(c.tileSubdomains, 'abcd');
	assert.deepEqual(c.imageOverlays[0], { file: 'old-map.png', bounds: [[41.8, 12.4], [41.95, 12.55]] });
	assert.equal(c.markers[0].type, 'red');
});
