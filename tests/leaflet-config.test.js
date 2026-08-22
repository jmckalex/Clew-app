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
