// The colon-conversion fixture ("Convert this vault", the colon directives'
// retirement phase 2): gen-big-vault.mjs's notes (5,000 by default), each
// given colon directives from a deterministic mix, plus the notes the rules
// are about. Plain node: `node smoke/make-colon-vault.mjs <dir> [notes]`.
//
//   every note   one of: a generic block (same), a theorem (changes output), an
//                inline :today/:span line (same), a ::title block (same), a block
//                with two names (left as written) — and a Meta Bind field
//                (prose: never shown) in some
//   Loads/Header.md          `Load directives: callout from my.js` in its header
//   Loads/Folder/Note.md     beside a .jmarkdown/config.json with Directives
//   Edges/CRLF.md            CRLF line endings (converted, CRLF kept)
//   Edges/Mixed.md           CRLF and LF (refused by name)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.argv[2];
const notes = process.argv[3] ?? '5000';
if (!root) { console.error('usage: make-colon-vault.mjs <dir> [notes]'); process.exit(1); }
execFileSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'gen-big-vault.mjs'), root, notes], { stdio: 'inherit' });

const BLOCKS = [
	(i) => `:::note\nA note's body, written :today.\n:::`,
	(i) => `:::theorem[Result ${i}]\nEvery premise has its conclusion.\n:::`,
	(i) => `Signed :today, see :span[this part]{.hl}.`,
	(i) => `::title[A title for ${i}]`,
	(i) => `:::aside notes\nTwo names on the line.\n:::`,
];
let seed = 7;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const files = [];
const walk = (dir) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p);
		else if (e.name.endsWith('.md') && !/^(Dashboard|Board)\.md$/.test(e.name)) files.push(p);
	}
};
walk(root);
files.sort();
let n = 0;
for (const file of files) {
	const extra = [BLOCKS[n % BLOCKS.length](n), BLOCKS[(n + 2) % BLOCKS.length](n)];
	if (rand() < 0.3) extra.push('Done? INPUT[toggle:done]');
	fs.appendFileSync(file, `\n${extra.join('\n\n')}\n`);
	n++;
}

const write = (rel, text) => {
	fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
	fs.writeFileSync(path.join(root, rel), text);
};
write('Loads/Header.md', '---\nLoad directives: callout from my.js\n---\n\n# Header\n\n:::callout\nIts own.\n:::\n\n:::note\nA generic block.\n:::\n\n:::theorem[T]\nNumbered once converted.\n:::\n\nNow :today.\n');
write('Loads/Folder/.jmarkdown/config.json', JSON.stringify({ Directives: ['/nonexistent/my-directives.js'] }, null, 2));
write('Loads/Folder/Note.md', '# Folder\n\n:::note\nA generic block.\n:::\n\nNow :today and :span[x]{.y}.\n');
write('Edges/CRLF.md', '# CRLF\r\n\r\n:::note\r\nWindows lines.\r\n:::\r\n');
write('Edges/Mixed.md', '# Mixed\r\n\n:::note\nTwo kinds.\r\n:::\n');
console.log(`colon directives added to ${files.length} notes, plus Loads/ and Edges/`);
