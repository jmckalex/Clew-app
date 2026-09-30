// A LOCKED Meta Bind widget (engine/meta-bind.js `locked`,
// preview-client/meta-bind.js) — the owner's grade that must not change by
// accident — driven with REAL input in reading mode. Fixture:
//
//   mkdir -p <dir> && printf -- '---\ngrade: 7\nscore: 1\n---\n# Grades\n\nGrade: INPUT[number(locked):grade]\n\nScore: INPUT[number:score]\n' > <dir>/Grades.md
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/meta-bind-lock-frame.js
// CLEW_SMOKE_FRAME_MATCH=Grades.md. The harness's `frameClick` finds each
// target inside the preview frame. Expect, in order:
//   `control score=5` — the UNLOCKED widget takes a click and typing (so the
//     locked one's refusal below is not the input failing to arrive);
//   `locked grade=7` — clicking the locked widget and typing changed nothing;
//   `unlocked grade=9` — the padlock clicked, the value typed, committed by
//     leaving the field (Tab), the frontmatter written;
//   and from the frame, after the write's re-render: `relocked=true
//   pressed=true value=9`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Grades.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(5000);   // the render, and Web Awesome's lazy load

/** A frontmatter value as the file holds it now. */
const fm = async (key) => [...(await ipc.invoke('clew:note-read', { path: 'Grades.md' })).matchAll(/^(\w+):\s*(.*)$/gm)]
	.find((m) => m[1] === key)?.[2];
// Clear the one-digit value: End, then Backspace (⌘A does not reach inside
// the component's shadow input from the harness).
const CLEAR = [{ combo: { key: 'End' } }, { combo: { key: 'Backspace' } }];
// A text or number field commits by LEAVING it (Enter does not commit a Web
// Awesome number input). Tab from the grade moves to its padlock.
const TAB = { combo: { key: 'Tab' } };
window.__clewSmokeInput = [
	// Control: the unlocked widget.
	{ frameClick: { match: 'Grades.md', selector: 'wa-number-input[data-edit-field="score"]' } },
	{ wait: 200 }, ...CLEAR, { text: '5' }, TAB, { wait: 2500 },
	// Locked: a click and typing must do nothing.
	{ frameClick: { match: 'Grades.md', selector: 'wa-number-input[data-edit-field="grade"]' } },
	{ wait: 200 }, ...CLEAR, { text: '1' }, TAB, { wait: 2500 },
	// Unlock, edit, commit.
	{ frameClick: { match: 'Grades.md', selector: '.clew-mb-lock' } },
	{ wait: 400 }, ...CLEAR, { text: '9' }, TAB, { wait: 5000 },
];
(async () => {
	for (let t = 0; t < 8000 && (await fm('score')) !== '5'; t += 200) await sleep(200);
	console.log(`smoke-mbl: control score=${await fm('score')}`);
	await sleep(2800);
	console.log(`smoke-mbl: locked grade=${await fm('grade')}`);
	for (let t = 0; t < 8000 && (await fm('grade')) !== '9'; t += 200) await sleep(200);
	console.log(`smoke-mbl: unlocked grade=${await fm('grade')}`);
})();
