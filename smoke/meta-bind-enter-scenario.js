// ENTER commits a Meta Bind number or text field (preview-client/meta-bind.js;
// the owner's decision 2026-09-30 — Web Awesome's inputs commit only on
// leaving), a textArea keeps Enter for its newlines, and a locked-then-
// unlocked widget relocks on that commit. Real input in reading mode, the
// harness's `frameClick` finding each target inside the preview. Fixture:
//
//   mkdir -p <dir> && printf -- '---\nscore: 1\ntitle: draft\nbody: one\ngrade: 7\n---\n# Enter\n\nScore: INPUT[number:score]\n\nTitle: INPUT[text:title]\n\nBody: INPUT[textArea:body]\n\nGrade: INPUT[number(locked):grade]\n' > <dir>/Enter.md
//
// Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/meta-bind-enter-frame.js
// CLEW_SMOKE_FRAME_MATCH=Enter.md. Expect `number score=5`, `text
// title=final` — each written on Enter, focus still in the field (nothing
// left it to fire a blur) — `textarea body=one` (not written: Enter made a
// newline), `locked grade=9`, and from the frame `body-has-newline=true
// grade-relocked=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Enter.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(5000);   // the render, and Web Awesome's lazy load

/** A frontmatter value as the file holds it now. */
const fm = async (key) => [...(await ipc.invoke('clew:note-read', { path: 'Enter.md' })).matchAll(/^(\w+):\s*(.*)$/gm)]
	.find((m) => m[1] === key)?.[2];
const at = (selector) => ({ frameClick: { match: 'Enter.md', selector } });
// Enter as a keyboard sends it — with its "\r" — so a textarea gets its newline.
const ENTER = { combo: { key: 'Enter', text: '\r' } };
const clear = (n) => [{ combo: { key: 'End' } }, ...Array.from({ length: n }, () => ({ combo: { key: 'Backspace' } }))];
window.__clewSmokeInput = [
	at('wa-number-input[data-edit-field="score"]'), { wait: 200 }, ...clear(1), { text: '5' }, ENTER, { wait: 2500 },
	at('wa-input[data-edit-field="title"]'), { wait: 200 }, ...clear(5), { text: 'final' }, ENTER, { wait: 2500 },
	at('wa-textarea[data-edit-field="body"]'), { wait: 200 }, { combo: { key: 'End' } }, ENTER, { text: 'two' }, { wait: 2500 },
	at('.clew-mb-lock'), { wait: 400 }, ...clear(1), { text: '9' }, ENTER, { wait: 4000 },
];
(async () => {
	for (let t = 0; t < 6000 && (await fm('score')) !== '5'; t += 200) await sleep(200);
	console.log(`smoke-mbe: number score=${await fm('score')}`);
	for (let t = 0; t < 6000 && (await fm('title')) !== 'final'; t += 200) await sleep(200);
	console.log(`smoke-mbe: text title=${await fm('title')}`);
	await sleep(2600);
	console.log(`smoke-mbe: textarea body=${await fm('body')}`);
	for (let t = 0; t < 8000 && (await fm('grade')) !== '9'; t += 200) await sleep(200);
	console.log(`smoke-mbe: locked grade=${await fm('grade')}`);
})();
