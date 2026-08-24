// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Generates the app icon: renders build-resources/icon source SVG with
// Electron's own Chromium (offscreen, transparent), writes icon.png (1024²),
// then downsamples with sips and packs an .icns with iconutil (macOS tools)
// plus a Windows .ico (PNG-compressed entries, hand-packed — valid since
// Vista). Linux builds use icon.png directly.
// Run via: npx electron scripts/make-icon.js
import { app, BrowserWindow } from 'electron';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'build-resources');
fs.mkdirSync(outDir, { recursive: true });

// A clew: a ball of thread on a dark squircle, in the app's accent purples.
//
// Drawn as a detailed cartoon rather than a photograph. Two things do most of
// the work:
//
//   1. Real winding structure. Yarn wound about one axis lies along a family
//      of great circles sharing two antipodal poles, which project to ellipses
//      sharing their major axis. So a "band" here is a fan of ellipses at one
//      rotation with growing minor axes — geometrically what a wound ball is,
//      instead of arcs scattered by hand. Four bands at different axes overdraw
//      each other the way successive layers of winding do.
//   2. Every strand is stroked three times — a dark spread underneath for the
//      shadow in the groove, the cord itself, then a thin off-centre sheen —
//      so each one reads as a round cord and not a flat ribbon. No blur filter
//      is needed for it, which keeps the small sizes crisp.
//
// Cartoon, not render: flat saturated palette, one specular, a firm outline.
const CX = 512, CY = 474, R = 238;

// Deterministic jitter, so the icon is reproducible byte-for-byte.
const wobble = (i) => {
	const v = Math.sin((i + 1) * 12.9898) * 43758.5453;
	return (v - Math.floor(v)) * 2 - 1; // -1..1
};

/**
 * One winding band: `n` strands at rotation `angle`, minor axes sweeping
 * `ryMin`→`ryMax` so they fan out from the band's centre line the way real
 * wraps do. `w` is the cord width.
 */
function band(angle, n, ryMin, ryMax, w) {
	const arcs = [];
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? 0 : i / (n - 1);
		// rx and the centre are jittered per strand so the ellipses do NOT all
		// meet at the same two points: coincident poles produce a hard starburst
		// where every wrap converges, which is the one thing that gives the
		// construction away. Scattering them reads as wraps crossing instead.
		arcs.push({
			ry: ryMin + (ryMax - ryMin) * t,
			rx: R * (0.99 + wobble(i * 3 + angle) * 0.055),
			ox: wobble(i * 5 + angle) * 13,
			oy: wobble(i * 7 + angle) * 13,
			rot: angle + wobble(i + angle) * 3.5,
		});
	}
	const pass = (dx, dy, grow) => arcs.map(({ ry, rx, ox, oy, rot }) =>
		`<ellipse cx="${(CX + dx + ox).toFixed(1)}" cy="${(CY + dy + oy).toFixed(1)}"`
		+ ` rx="${rx.toFixed(1)}" ry="${Math.max(3, ry + grow).toFixed(1)}"`
		+ ` transform="rotate(${rot.toFixed(2)} ${CX} ${CY})"/>`).join('\n      ');
	return `
    <g stroke="#33215f" stroke-width="${w + 8}" opacity="0.42">
      ${pass(0, 0, 0)}
    </g>
    <g stroke="url(#yarn)" stroke-width="${w}">
      ${pass(0, 0, 0)}
    </g>
    <g stroke="#efe7ff" stroke-width="${(w * 0.22).toFixed(1)}" opacity="0.26">
      ${pass(-2.5, -3.5, -1.5)}
    </g>`;
}

// The free end: same three-pass cord treatment, so it is visibly the same yarn.
function cord(d, w) {
	return `
    <path d="${d}" stroke="#2a1a4e" stroke-width="${w + 9}" opacity="0.45"/>
    <path d="${d}" stroke="url(#yarn)" stroke-width="${w}"/>
    <path d="${d}" stroke="#efe7ff" stroke-width="${(w * 0.24).toFixed(1)}"
          opacity="0.38" transform="translate(-2.5 -3.5)"/>`;
}

const TAIL = 'M 690 646 C 806 716 852 766 812 818 C 774 866 686 856 666 806'
	+ ' C 648 762 692 736 730 754 C 774 774 800 812 856 822';

const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b2440"/>
      <stop offset="1" stop-color="#171321"/>
    </linearGradient>
    <!-- The cord colour, lit from the upper left across the whole ball. -->
    <linearGradient id="yarn" x1="0.12" y1="0.05" x2="0.88" y2="0.95">
      <stop offset="0" stop-color="#d7c6ff"/>
      <stop offset="0.42" stop-color="#a684f7"/>
      <stop offset="1" stop-color="#6a44cf"/>
    </linearGradient>
    <!-- Under-colour in the gaps between wraps. Kept close to the cord colour
         rather than near-black: too dark and the gaps read as holes punched in
         the ball instead of more yarn lying deeper. -->
    <radialGradient id="core" cx="0.36" cy="0.30" r="0.92">
      <stop offset="0" stop-color="#8468d4"/>
      <stop offset="1" stop-color="#432c7e"/>
    </radialGradient>
    <!-- Turns the flat disc of strands into a sphere: clear in the lit
         quarter, deepening to shadow at the rim. -->
    <radialGradient id="volume" cx="0.34" cy="0.28" r="0.95">
      <stop offset="0.30" stop-color="#1a0f38" stop-opacity="0"/>
      <stop offset="0.68" stop-color="#1a0f38" stop-opacity="0.30"/>
      <stop offset="0.88" stop-color="#150b2e" stop-opacity="0.56"/>
      <stop offset="1" stop-color="#0d0620" stop-opacity="0.85"/>
    </radialGradient>
    <radialGradient id="spec" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="contact" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000000" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="ballclip"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
  </defs>

  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>

  <!-- contact shadow, so the ball sits on the tile rather than floating -->
  <ellipse cx="${CX + 14}" cy="${CY + R + 24}" rx="${R * 0.86}" ry="34" fill="url(#contact)"/>

  <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#core)"/>

  <g clip-path="url(#ballclip)" fill="none" stroke-linecap="round">
    ${band(-24, 5, 40, 176, 22)}
    ${band(96, 5, 34, 166, 22)}
    ${band(40, 4, 30, 132, 21)}
    ${band(-68, 3, 26, 96, 20)}
  </g>

  <!-- sphere volume + specular, over the winding -->
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#volume)"/>
  <ellipse cx="${CX - 96}" cy="${CY - 112}" rx="104" ry="74"
           transform="rotate(-28 ${CX - 96} ${CY - 112})" fill="url(#spec)"/>

  <!-- the firm outline that keeps it cartoon, and legible at 16px -->
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#1c1036"
          stroke-width="11" opacity="0.85"/>

  <!-- the trailing thread, paying out to a loose loop -->
  <g fill="none" stroke-linecap="round">${cord(TAIL, 21)}</g>
</svg>`;

const html = `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`;

app.whenReady().then(async () => {
	const win = new BrowserWindow({
		show: false,
		width: 1024,
		height: 1024,
		frame: false,
		transparent: true,
		webPreferences: { offscreen: true },
	});
	await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
	await new Promise((r) => setTimeout(r, 600));
	const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
	const png = path.join(outDir, 'icon.png');
	fs.writeFileSync(png, image.toPNG());
	fs.writeFileSync(path.join(outDir, 'icon.svg'), svg.trim());

	// PNG → .icns via the macOS toolchain.
	const iconset = path.join(outDir, 'icon.iconset');
	fs.rmSync(iconset, { recursive: true, force: true });
	fs.mkdirSync(iconset);
	const sizes = [[16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'], [32, 'icon_32x32.png'],
		[64, 'icon_32x32@2x.png'], [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
		[256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'], [512, 'icon_512x512.png'],
		[1024, 'icon_512x512@2x.png']];
	for (const [size, name] of sizes) {
		execSync(`sips -z ${size} ${size} "${png}" --out "${path.join(iconset, name)}" >/dev/null`);
	}
	execSync(`iconutil -c icns "${iconset}" -o "${path.join(outDir, 'icon.icns')}"`);
	fs.rmSync(iconset, { recursive: true, force: true });

	// PNG → .ico for Windows: an ICO is a 6-byte header, one 16-byte
	// directory entry per image, then the image blobs — which may be whole
	// PNG files (supported since Vista).
	const icoSizes = [16, 24, 32, 48, 64, 128, 256];
	const blobs = icoSizes.map((size) => {
		const tmp = path.join(outDir, `ico-${size}.png`);
		execSync(`sips -z ${size} ${size} "${png}" --out "${tmp}" >/dev/null`);
		const data = fs.readFileSync(tmp);
		fs.rmSync(tmp);
		return { size, data };
	});
	const header = Buffer.alloc(6);
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(blobs.length, 4);
	const entries = [];
	let offset = 6 + 16 * blobs.length;
	for (const { size, data } of blobs) {
		const entry = Buffer.alloc(16);
		entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
		entry.writeUInt8(size === 256 ? 0 : size, 1); // height
		entry.writeUInt16LE(1, 4); // color planes
		entry.writeUInt16LE(32, 6); // bits per pixel
		entry.writeUInt32LE(data.length, 8);
		entry.writeUInt32LE(offset, 12);
		entries.push(entry);
		offset += data.length;
	}
	fs.writeFileSync(path.join(outDir, 'icon.ico'),
		Buffer.concat([header, ...entries, ...blobs.map((b) => b.data)]));

	console.log('icon: wrote build-resources/icon.{svg,png,icns,ico}');
	app.quit();
});
