// The fixture for kanban-width-scenario.js: eight papers with a `status`, a
// four-column board (the study vault's Pipeline shape) and a seven-column one.
//
//   node smoke/make-kanban-vault.mjs /tmp/kanban-vault
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node smoke/make-kanban-vault.mjs <dir>');
	process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'Papers'), { recursive: true });
const statuses = ['drafting', 'submitted', 'revise', 'accepted', 'published', 'shelved', 'ideas'];
for (let i = 1; i <= 8; i++) {
	fs.writeFileSync(path.join(dir, 'Papers', `Paper ${i}.md`),
		`---\nstatus: ${statuses[i % 4]}\nvenue: Journal ${i}\n---\n# Paper ${i}\n`);
}
const board = (cols) => '```kanban\ngroup: status\nfrom: Papers\ncolumns: ' + cols.join(', ') + '\nshow: venue\n```\n';
fs.writeFileSync(path.join(dir, 'Board4.md'), '# Four\n\n' + board(statuses.slice(0, 4)));
fs.writeFileSync(path.join(dir, 'Board7.md'), '# Seven\n\n' + board(statuses));
