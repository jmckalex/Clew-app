// Editing callout definitions re-renders what is open and invalidates what is
// cached (fixture: smoke/make-custom-callout-vault.sh <dir> dark; frame
// script custom-callout-refresh-frame.js, CLEW_SMOKE_FRAME_MATCH=vault/).
// Callouts.md is shown in READING view first (rendered and cached with
// remark's #2e8b57), then in live edit beside Embed.md (live edit, the
// transclusion a block frame). Then:
//   1. the Settings path (vaultSettingsStore.set, what Settings → Callouts
//      calls): remark → #c0392b;
//   2. a HAND edit of .clew/vault-settings.json (written atomically from
//      outside the settings stores, as an editor saves): remark → teal, and a
//      new type `fresh`.
// Live edit logs `smoke-cr: <step> remark=<border> fresh=<border>`; at the
// end Callouts.md goes back to reading view, and the frame script logs the
// reading view's and the embed frame's remark and fresh borders. All three
// must end teal (remark) and #d35400's dark-theme colour (fresh) — `fresh`
// being, until the hand edit, an UNKNOWN type drawn in note's blue
// (jmarkdown a7de8c6).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, vaultSettingsStore, editorPool, ipc, registry } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const left = workspaceStore.openNote('Callouts.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(left.id, 'reading');
await sleep(4000);
workspaceStore.setTabMode(left.id, 'live');
registry.runCommand('workspace:split-right');
await sleep(400);
const right = workspaceStore.openNote('Embed.md', { newTab: false, defaultMode: 'live' });
workspaceStore.setTabMode(right.id, 'live');
await sleep(4000);

const view = editorPool.get(left.id).view;
// A head is measured scrolled into view: CodeMirror draws only what is near
// the screen, and the note is longer than one.
const borderOf = async (written) => {
	const pos = view.state.doc.toString().indexOf(`> [!${written}]`);
	view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(pos).top - 100);
	await sleep(200);
	const line = [...view.dom.querySelectorAll('.cm-line.le-callout-head')].find((l) => { try { return view.posAtDOM(l) === pos; } catch { return false; } });
	return line ? getComputedStyle(line).borderLeftColor : 'none';
};
const measure = async (step) => {
	console.log(`smoke-cr: ${step} remark=${await borderOf('remark')} fresh=${await borderOf('fresh')}`);
};
view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('The end.') } });
await sleep(600);
await measure('before');

const stored = (await ipc.invoke('clew:vault-settings-get')).callouts;
const recolour = (list, color) => list.map((e) => (e.name === 'remark' ? { ...e, color } : e));
await vaultSettingsStore.set('callouts', recolour(stored, '#c0392b'));
await sleep(3000);
await measure('after-settings');

const byHand = { callouts: [...recolour(stored, 'teal'), { name: 'fresh', icon: 'leaf', color: '#d35400' }] };
await ipc.invoke('clew:note-write', { path: '.clew/vault-settings.json', content: `${JSON.stringify(byHand, null, 2)}\n` });
for (let i = 0; i < 60; i++) {
	await sleep(250);
	if ((await borderOf('fresh')) !== 'rgb(91, 141, 239)') break;
}
await sleep(600);
await measure('after-hand');

workspaceStore.activateTab(left.id);
workspaceStore.setTabMode(left.id, 'reading');
await sleep(5000);
