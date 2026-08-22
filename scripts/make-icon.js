// Generates the app icon: renders build-resources/icon source SVG with
// Electron's own Chromium (offscreen, transparent), writes icon.png (1024²),
// then downsamples with sips and packs an .icns with iconutil (macOS tools).
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
const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b2440"/>
      <stop offset="1" stop-color="#171321"/>
    </linearGradient>
    <radialGradient id="ball" cx="0.38" cy="0.34" r="0.9">
      <stop offset="0" stop-color="#c0a7ff"/>
      <stop offset="0.55" stop-color="#a882ff"/>
      <stop offset="1" stop-color="#7852ee"/>
    </radialGradient>
    <clipPath id="ballclip"><circle cx="512" cy="486" r="238"/></clipPath>
  </defs>

  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>

  <!-- the ball: yarn wraps at irregular diagonal angles -->
  <circle cx="512" cy="486" r="238" fill="url(#ball)"/>
  <g clip-path="url(#ballclip)" fill="none" stroke-linecap="round">
    <g stroke="#5b449e" stroke-width="30">
      <path d="M 240 380 Q 512 560 784 400" transform="rotate(-38 512 486)" opacity="0.9"/>
      <path d="M 240 560 Q 512 400 784 580" transform="rotate(-16 512 486)" opacity="0.8"/>
      <path d="M 250 430 Q 512 620 774 420" transform="rotate(24 512 486)" opacity="0.9"/>
      <path d="M 250 600 Q 512 470 774 610" transform="rotate(47 512 486)" opacity="0.75"/>
      <path d="M 260 420 Q 512 580 764 430" transform="rotate(76 512 486)" opacity="0.85"/>
      <path d="M 260 580 Q 512 440 764 600" transform="rotate(100 512 486)" opacity="0.7"/>
    </g>
    <!-- the strand on top, catching the light -->
    <path d="M 245 470 Q 512 640 779 450" transform="rotate(-64 512 486)"
          stroke="#8b6ad6" stroke-width="30" opacity="0.9"/>
  </g>
  <circle cx="512" cy="486" r="238" fill="none" stroke="#4a3a75" stroke-width="10" opacity="0.55"/>

  <!-- the trailing thread, paying out to a loose loop -->
  <path d="M 700 640 C 810 720 840 760 800 806 C 764 846 690 842 668 800 C 650 764 686 738 726 752 C 770 767 800 800 850 812"
        fill="none" stroke="#cdbdff" stroke-width="26" stroke-linecap="round"/>

  <!-- soft highlight -->
  <ellipse cx="430" cy="380" rx="120" ry="86" fill="#ffffff" opacity="0.14"/>
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
	console.log('icon: wrote build-resources/icon.{svg,png,icns}');
	app.quit();
});
