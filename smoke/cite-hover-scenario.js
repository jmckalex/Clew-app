// A citation's hover preview: its button SHOWS THE ENTRY in the References
// panel's Library (§5.14), as a pill's click does, and says so — "Show in
// Library". Until 2026-10-01 it read "Open" and reopened the note already
// open: nothing happened (the owner's report). ⌘ on the button opens the
// entry's PDF when it has one. A note link's button still opens the note.
// Fixture: `smoke/make-cite-vault.sh <dir>`, real pointer input. Expect:
//   `A popover button="Show in Library"`, then `A library focused=Akerlof/Kranton:2000`
//   `H … focused=lewis1969` (several keys: the first, as a pill's click)
//   `C ⌘ active=lewis.pdf` (lewis1969's `file`, in a tab)
//   `link popover button="Open"`, then `link active=Plain.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, settingsStore, linkPreview } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
settingsStore.set('linkPreview', 'hover');
workspaceStore.setSidebar('left', { open: false });
// The right sidebar open throughout (on another tool), so showing the
// Library never reflows the note under the pointer.
workspaceStore.setSidebar('right', { open: true, activeTool: 'outline' });
const tab = workspaceStore.openNote('Cites.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
const pills = () => [...document.querySelectorAll('.cm-editor .le-cite')];
for (let i = 0; i < 100 && !pills().some((p) => p.textContent === 'Akerlof and Kranton (2000)'); i++) await sleep(100);
// The cursor on an EMPTY line: left at the top it keeps the header revealed
// as raw lines until the editor loses focus to the Library, and the note
// then shifts under the pointer; on the [[Plain]] line it would reveal it.
const view = window.__clew.editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('\n\nA \\cite') + 1 } });
await sleep(500);
// Pills and the link by selector, resolved when each move comes: a tab
// switch in between re-lays the note (the harness takes the first line box).
const A = { selector: '.cm-editor .le-cite[data-le-cite="Akerlof/Kranton:2000"]' };
const C = { selector: '.cm-editor .le-cite[data-le-cite="lewis1969"]' };
const H = { selector: '.cm-editor .le-cite[data-le-cite="lewis1969,smith2001"]' };
const L = { selector: '.cm-editor .le-wikilink' };
const scroller = document.querySelector('.cm-editor .cm-scroller').getBoundingClientRect();
const E = { x: Math.round(scroller.right - 30), y: Math.round(scroller.bottom - 30) };
const P = () => linkPreview().describe();
const OPEN = { click: { selector: 'clew-link-preview .link-preview-open' } };
const META = 4;

// 3 s on each popover before its button is clicked: a popover flipped ABOVE
// its link grows upward as its frame reports a height, which moves the
// button (the click is resolved where the button IS, not where it will be).
window.__clewSmokeInput = [
	{ move: A }, { wait: 3000 }, OPEN, { wait: 900 },                       // A
	{ move: E }, { wait: 900 }, { move: H }, { wait: 3000 }, OPEN, { wait: 900 }, // H
	{ move: E }, { wait: 900 }, { move: C }, { wait: 3000 },
	{ ...OPEN, modifiers: META }, { wait: 2500 },                            // C ⌘
	{ move: E }, { wait: 900 }, { move: L }, { wait: 3000 }, OPEN, { wait: 1500 }, // the note link
];

(async () => {
	const focused = () => document.querySelector('clew-bibliography .bib-row.is-focused')?.dataset.key ?? null;
	const until = async (test, ms = 6000) => { for (let t = 0; t < ms; t += 50) { if (test()) return true; await sleep(50); } return false; };
	await until(() => P().visible && P().label);
	console.log(`smoke-ch: A popover button=${JSON.stringify(P().button)} label=${JSON.stringify(P().label)}`);
	await until(() => focused());
	console.log(`smoke-ch: A library focused=${focused()} panel=${workspaceStore.state.sidebars.right.activeTool}`);
	await until(() => P().visible && /Lewis/.test(P().label ?? ''));
	console.log(`smoke-ch: H popover button=${JSON.stringify(P().button)} label=${JSON.stringify(P().label)}`);
	await until(() => focused() === 'lewis1969');
	console.log(`smoke-ch: H library focused=${focused()}`);
	await until(() => /\.pdf$/.test(workspaceStore.activeTab()?.path ?? ''), 9000);
	console.log(`smoke-ch: C ⌘ active=${workspaceStore.activeTab()?.path}`);
	workspaceStore.activateTab(tab.id);   // back to Cites.md for the note link
	await until(() => P().visible && P().kind === 'block' && !/Lewis|Smith|Akerlof/.test(P().label ?? ''), 9000);
	console.log(`smoke-ch: link popover button=${JSON.stringify(P().button)} label=${JSON.stringify(P().label)}`);
	await until(() => workspaceStore.activeTab()?.path === 'Plain.md');
	console.log(`smoke-ch: link active=${workspaceStore.activeTab()?.path}`);
})();
