// The fixture for tabbing-scenario.js: one note, six tabbing blocks, each
// exercising part of LaTeX's tabbing (src/engine/tabbing.js).
//
//   node smoke/make-tabbing-vault.mjs /tmp/tabbing-vault
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node smoke/make-tabbing-vault.mjs <dir>');
	process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const fence = (id, body) => `<div id="${id}">\n\n\`\`\`tabbing\n${body}\n\`\`\`\n\n</div>\n`;
fs.writeFileSync(path.join(dir, 'Tabbing.md'), [
	'# Tabbing', '',
	fence('ruler', 'Monday:    |= 10:00–11:00  |= Room 12 |kill\nTue        |> 9:00          |> Lab\nWednesdays and more |> 14:00 |> Hall'),
	fence('margin', 'while |= xxxx |= |kill\nwhile cond do |+\nbody one\nbody two |-\nend'),
	fence('label', 'Label: |= Text |kill\n|> Name |\' is right'),
	fence('right', 'Left side |` right'),
	fence('push', 'A |= B |= C\n|[\nMuch longer |= x |kill\n|> q\n|]\n|> r'),
	'<div id="latex">', '',
	'@begin(tabbing)',
	'*Bold* \\= $x^2$ \\= /italic/ \\\\',
	'a \\> b \\> c',
	'@end(tabbing)', '',
	'</div>', '',
].join('\n'));
