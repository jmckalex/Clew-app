// Generate a synthetic ~5k-note vault for stress-testing the indexer,
// search, and query fences. Deterministic (seeded LCG), no dependencies.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const NOTES = Number(process.argv[3] ?? 5000);
if (!root) { console.error('usage: gen-big-vault.mjs <dir> [notes]'); process.exit(1); }

let seed = 42;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const FOLDERS = ['Projects', 'Areas', 'Resources', 'Archive', 'Daily', 'People', 'Meetings', 'Reading'];
const STATUSES = ['idea', 'active', 'blocked', 'done'];
const TAGS = ['research', 'writing', 'teaching', 'admin', 'personal', 'urgent', 'someday'];
const WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
	'incididunt labore dolore magna aliqua enim minim veniam quis nostrud exercitation ' +
	'philosophy identity computation model theory argument premise conclusion evidence').split(' ');

fs.rmSync(root, { recursive: true, force: true });
for (const f of FOLDERS) fs.mkdirSync(path.join(root, f), { recursive: true });

const names = [];
for (let i = 0; i < NOTES; i++) {
	names.push(`${pick(FOLDERS)}/Note ${String(i).padStart(4, '0')}`);
}

for (let i = 0; i < NOTES; i++) {
	const lines = [];
	lines.push('---');
	lines.push(`status: ${pick(STATUSES)}`);
	lines.push(`priority: ${int(1, 5)}`);
	lines.push(`created: 2026-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`);
	lines.push(`tags: [${pick(TAGS)}, ${pick(TAGS)}]`);
	lines.push('---');
	lines.push(`# ${names[i].split('/').pop()}`);
	lines.push('');
	for (let p = 0; p < int(2, 6); p++) {
		const words = [];
		for (let w = 0; w < int(30, 80); w++) words.push(pick(WORDS));
		// Sprinkle wikilinks into the prose (the link graph is the point).
		for (let l = 0; l < int(1, 4); l++) {
			words.splice(int(0, words.length - 1), 0, `[[${pick(names).split('/').pop()}]]`);
		}
		lines.push(words.join(' ') + '.');
		lines.push('');
	}
	if (rand() < 0.3) {
		lines.push(`- [ ] task for note ${i} 📅 2026-${String(int(1, 12)).padStart(2, '0')}-15`);
		lines.push(`- [x] finished task ${i}`);
		lines.push('');
	}
	fs.writeFileSync(path.join(root, names[i] + '.md'), lines.join('\n'));
}

// A handful of query-fence dashboards over the whole vault.
fs.writeFileSync(path.join(root, 'Dashboard.md'), `# Dashboard

\`\`\`query
table: status, priority, created
where: status = "active"
sort: priority asc
\`\`\`

\`\`\`tasks
not done
\`\`\`
`);
fs.writeFileSync(path.join(root, 'Board.md'), `# Board

\`\`\`kanban
group: status
from: Projects
columns: idea, active, blocked, done
\`\`\`
`);
console.log(`generated ${NOTES} notes in ${root}`);
