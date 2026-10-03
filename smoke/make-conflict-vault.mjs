// A vault for conflicts-scenario.js: `node smoke/make-conflict-vault.mjs <dir>`.
// Run with CLEW_WATCH_BUDGET=10, so the watcher's scan takes the first ten
// notes, breadth-first: the root's "A …" notes are watched, and
// Deep/Er/Target.md — two folders down, behind thirty fillers — is NOT, so
// a change to it from outside can only be caught by the write guard (a
// refused save), never by the watcher.
//
//   Deep/Er/Target.md   unwatched: the refused save → Keep both
//   A Watched.md        watched: unsaved edits + a change on disk → Keep theirs
//   A Mine.md           the same → Keep mine
//   Plan.md + "Plan (Jane's conflicted copy 2026-10-03).md"   Dropbox → Keep the copy
//   Merge.md            git's conflict markers → a notice
//   Z Filler 01–30.md   the budget's ballast
//
// The runner plays the other device: it writes the "theirs" text into a note
// when the scenario's log says `smoke-cf: write <which>` (recipe in the
// scenario's header).
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-conflict-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const put = (rel, text) => {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), text);
};
put('Deep/Er/Target.md', '# Target\n\nThe original text.\n');
put('A Watched.md', '# Watched\n\nThe original text.\n');
put('A Mine.md', '# Mine\n\nThe original text.\n');
put('Plan.md', '# Plan\n\nThe plan as this Mac has it.\n');
put("Plan (Jane's conflicted copy 2026-10-03).md", '# Plan\n\nThe plan as Jane\'s laptop has it.\n');
put('Merge.md', '# Merge\n\n<<<<<<< HEAD\nOur line.\n=======\nTheir line.\n>>>>>>> branch\n');
for (let i = 1; i <= 30; i++) put(`Z Filler ${String(i).padStart(2, '0')}.md`, `# Filler ${i}\n`);
