// No false conflicts (main/write-guard.js): REAL typing into a watched note,
// every save guarded, the watcher echoing each one back. Clew-iOS's guard
// raised one on every second save — it recorded a pre-write mtime — and
// continuous typing hid it (one save per debounce), so this runs both:
//
//   1. ten SEPARATE saves — a word, then a pause past the 1 s autosave;
//   2. ~45 s of continuous typing (a word every 300 ms).
//
// Fixture: `mkdir -p <dir> && printf '# Typing\n\nStart.\n' > <dir>/Typing.md`.
// Expect `typing: saves=11 refused=0 conflicts=0 disk-matches-editor=true`
// (ten separate saves, and ONE for the continuous run: each keystroke resets
// the 1 s autosave, so it saves when the typing stops).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-ty: ' + s);
const tab = workspaceStore.openNote('Typing.md', { defaultMode: 'source' });
workspaceStore.setTabMode(tab.id, 'source');
for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(100);
await sleep(1500);

// Count every save the pool makes, and what main answered.
let saves = 0;
let refused = 0;
const invoke = ipc.invoke;
ipc.invoke = async (channel, payload) => {
	const result = await invoke(channel, payload);
	if (channel === 'clew:note-write' && payload?.guard) {
		saves += 1;
		if (result?.conflict) refused += 1;
	}
	return result;
};
let conflicts = 0;
editorPool.on('conflict-changed', ({ active }) => { if (active) conflicts += 1; });

const view = editorPool.get(tab.id).view;
view.focus();
view.dispatch({ selection: { anchor: view.state.doc.length } });
const input = [];
for (let i = 1; i <= 10; i++) input.push({ text: ` save${i}` }, { wait: 1600 });
for (let i = 1; i <= 150; i++) input.push({ text: ` w${i}` }, { wait: 300 });
input.push({ text: ' THE-END' }, { wait: 3000 });
window.__clewSmokeInput = input;

(async () => {
	for (let i = 0; i < 1200 && !view.state.doc.toString().includes('THE-END'); i++) await sleep(100);
	await sleep(2500);   // the last autosave, and the watcher's echo of it
	const disk = await invoke('clew:note-read', { path: 'Typing.md' }).catch(() => null);
	const text = view.state.doc.toString();
	log(`typing: saves=${saves} refused=${refused} conflicts=${conflicts} disk-matches-editor=${disk === text} separate=${(text.match(/save\d+/g) ?? []).length} words=${(text.match(/ w\d+/g) ?? []).length}`);
})();
