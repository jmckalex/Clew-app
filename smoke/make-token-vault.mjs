// The fixture for caller-token-scenario.js: a canvas whose text card only the
// ENGINE can render (a callout — the instant card renderer leaves `[!note]`
// as text), embedded three ways that each reach the fragment endpoint from a
// different caller: a note in reading view (the preview document asks the
// app page for the caller token), a note in live edit (the block document
// asks), the reading-view PDF export (a top-level document, handed the
// token by main), and — from the app page itself — the canvas in a tab and
// as a portal inside another canvas (Wall).
//
//   node smoke/make-token-vault.mjs /tmp/token-vault
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node smoke/make-token-vault.mjs <dir>');
	process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'Inner.md'), '# Inner\n\nA note on the board.\n');
fs.writeFileSync(path.join(dir, 'Board.canvas'), JSON.stringify({
	nodes: [
		{ id: 't', type: 'text', text: '> [!note] Engine card\n> Rendered by the engine.', x: 0, y: 0, width: 360, height: 200 },
		{ id: 'n', type: 'file', file: 'Inner.md', x: 420, y: 0, width: 360, height: 200 },
	],
	edges: [],
}, null, '\t') + '\n');
// A portal: a canvas FILE node showing Board as a miniature (canvas/portal.js).
fs.writeFileSync(path.join(dir, 'Wall.canvas'), JSON.stringify({
	nodes: [{ id: 'p', type: 'file', file: 'Board.canvas', x: 0, y: 0, width: 800, height: 400 }],
	edges: [],
}, null, '\t') + '\n');
fs.writeFileSync(path.join(dir, 'Host.md'), '# Host\n\n![[Board.canvas]]\n');
fs.writeFileSync(path.join(dir, 'Live.md'), '# Live\n\n![[Board.canvas]]\n\nAfter the board.\n');
