// The fixture for canvas-engage-scenario.js and canvas-esc-scenario.js: one
// canvas, four note cards — `a` coloured (the case whose engaged ring the
// selected style used to outrank), `b` plain, `c` a note that is one big text
// field, and `d` a note whose block keeps its own Esc (a script calls
// preventDefault, as Web Awesome's widgets do).
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
fs.writeFileSync(path.join(dir, 'Field.md'), '# Field\n\n<textarea rows="30" cols="60">typing here</textarea>\n');
fs.writeFileSync(path.join(dir, 'Owner.md'), [
	'# Owner', '',
	'<div id="esc-owner" tabindex="0" style="height: 600px; border: 1px dashed gray">This block keeps its own Esc.</div>', '',
	'<script>',
	"document.getElementById('esc-owner').addEventListener('keydown', (e) => { if (e.key === 'Escape') e.preventDefault(); });",
	'</script>', '',
].join('\n'));
fs.writeFileSync(path.join(dir, 'Board.canvas'), JSON.stringify({
	nodes: [
		{ id: 'a', type: 'file', file: 'Card.md', x: 0, y: 0, width: 360, height: 240, color: '1' },
		{ id: 'b', type: 'file', file: 'Other.md', x: 440, y: 0, width: 360, height: 240 },
		{ id: 'c', type: 'file', file: 'Field.md', x: 0, y: 320, width: 360, height: 240 },
		{ id: 'd', type: 'file', file: 'Owner.md', x: 440, y: 320, width: 360, height: 240 },
	],
	edges: [],
}, null, '\t') + '\n');
