// The fixture for bridges-scenario.js: the app page's postMessage bridges
// driven by their legitimate senders, which now must be on the preview
// origin (shared/message-guard.js). A drawing with an image whose bytes are a
// vault attachment named in its "## Embedded Files" section (the resolve
// bridge), opened in a tab (library load/save, drawing save) and embedded in
// a note, where the Excalidraw page sits two frames deep and posts to
// window.top (the nested sender).
//
//   node smoke/make-bridges-vault.mjs /tmp/bridges-vault
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node smoke/make-bridges-vault.mjs <dir>');
	process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'Attachments'), { recursive: true });
// A 1×1 PNG.
fs.writeFileSync(path.join(dir, 'Attachments', 'dot.png'), Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const base = { angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid',
	strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null,
	roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: null,
	updated: 1, link: null, locked: false };
const scene = {
	type: 'excalidraw', version: 2, source: 'https://clew-app.com',
	elements: [
		{ ...base, id: 'box1', type: 'rectangle', x: 0, y: 0, width: 200, height: 100 },
		{ ...base, id: 'pic1', type: 'image', x: 240, y: 0, width: 100, height: 100, fileId: 'dotfile', status: 'saved', scale: [1, 1] },
	],
	appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
	files: {},
};
fs.writeFileSync(path.join(dir, 'Draw.excalidraw.md'), [
	'---', '', 'excalidraw-plugin: parsed', 'tags: [excalidraw]', '', '---',
	'==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==', '', '',
	'# Excalidraw Data', '', '## Text Elements', '',
	'## Embedded Files', 'dotfile: [[dot.png]]', '',
	'%%', '## Drawing', '```json', JSON.stringify(scene, null, '\t'), '```', '%%', '',
].join('\n'));
fs.writeFileSync(path.join(dir, 'Embeds.md'), '# Embeds\n\n![[Draw.excalidraw.md]]\n');
