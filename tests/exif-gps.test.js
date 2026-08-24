// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exifGps } from '../src/engine/exif-gps.js';

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

test('reads GPS + capture time from a geotagged JPEG', () => {
	const gps = exifGps(fixture('geotagged.jpg'));
	assert.ok(gps);
	assert.ok(Math.abs(gps.lat - 51.5007) < 0.0001);
	assert.ok(Math.abs(gps.long - -0.1246) < 0.0001);
	assert.equal(gps.time, '2026:08:15 14:30:00');
});

test('southern/eastern hemisphere signs', () => {
	const gps = exifGps(fixture('geotagged-south.jpg'));
	assert.ok(gps);
	assert.ok(Math.abs(gps.lat - -33.8568) < 0.0001);
	assert.ok(Math.abs(gps.long - 151.2153) < 0.0001);
	assert.equal(gps.time, undefined);
});

test('JPEG without GPS yields null', () => {
	assert.equal(exifGps(fixture('no-gps.jpg')), null);
});

test('garbage input yields null, never throws', () => {
	assert.equal(exifGps(Buffer.from('not a jpeg')), null);
	assert.equal(exifGps(Buffer.alloc(0)), null);
	assert.equal(exifGps(fixture('geotagged.jpg').subarray(0, 40)), null);
});
