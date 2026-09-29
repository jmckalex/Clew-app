// The fixture for canvas-engage-scenario.js: one canvas, two note cards —
// `a` coloured (the case whose engaged ring the selected style used to
// outrank) and `b` plain.
//
//   node smoke/make-canvas-vault.mjs /tmp/canvas-vault
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node smoke/make-canvas-vault.mjs <dir>');
	process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'Card.md'), '# Card\n\nA note shown on a canvas.\n');
fs.writeFileSync(path.join(dir, 'Other.md'), '# Other\n\nThe second card.\n');
fs.writeFileSync(path.join(dir, 'Board.canvas'), JSON.stringify({
	nodes: [
		{ id: 'a', type: 'file', file: 'Card.md', x: 0, y: 0, width: 360, height: 240, color: '1' },
		{ id: 'b', type: 'file', file: 'Other.md', x: 440, y: 0, width: 360, height: 240 },
	],
	edges: [],
}, null, '\t') + '\n');
