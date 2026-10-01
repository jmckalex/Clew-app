// ⌘1–⌘8 go to the Nth tab of the CURRENT pane and ⌘9 to its last
// (builtin.js workspace:goto-tab-N / goto-last-tab; the owner's choice
// 2026-10-01), pressed for REAL. Fixture:
//
//   mkdir -p <dir> && for n in 1 2 3 4 5; do printf '# N%s\n' $n > <dir>/N$n.md; done
//   printf '# Side\n' > <dir>/Side.md
//
// Left pane N1…N5, right pane N5 (the split's copy) and Side. One line per
// tab change: `active pane=L|R tab=i/count path=…`. Expect `editor-focused=
// true` (N1 in live edit), then, in order:
//   (from N1) ⌘2 → `pane=L tab=2/5 path=N2`;  ⌘9 → `pane=L tab=5/5 path=N5`;
//   ⌘7 → nothing (only 5 tabs: the chord falls through) — `after-7 L tab=5/5`;
//   the right pane made current (`pane=R tab=2/2`, where the split left it),
//   ⌘1 → `pane=R tab=1/2`, ⌘9 → `pane=R tab=2/2`;
//   the shell panel opened and FOCUSED, ⌘1 → `pane=R tab=1/2` with
//   `terminal-unchanged=true` (the app's chord wins; on mac ⌘ never reaches
//   the pty). Run with CLEW_SMOKE_MENU=1 for `Go > Tab > Tab 1 [CmdOrCtrl+1]`
//   … `Go > Tab > Last Tab [CmdOrCtrl+9]`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const META = 4, CTRL = 2;
const { workspaceStore, vaultStore, registry } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
workspaceStore.setShell({ open: false });
for (let n = 1; n <= 5; n++) workspaceStore.openNote(`N${n}.md`, { newTab: true });
await sleep(400);
// Whatever the fresh workspace started with goes, so the pane holds N1…N5.
let left = workspaceStore.activeGroup();
for (const tab of [...left.tabs]) if (!/^N\d\.md$/.test(tab.path ?? '')) workspaceStore.closeTab(tab.id, { force: true });
await sleep(200);
registry.runCommand('workspace:split-right');
await sleep(400);
workspaceStore.openNote('Side.md', { newTab: true });
await sleep(400);
const right = workspaceStore.activeGroup();
left = workspaceStore.allGroups().find((g) => g.id !== right.id);
// Start on N1, so ⌘2 and ⌘9 each make a change to see — with N1's EDITOR
// focused, in live edit, so CodeMirror's keymaps are the first in line after
// the app's capture-phase dispatcher.
workspaceStore.activateTab(left.tabs[0].id);
workspaceStore.setActiveGroup(left.id);
workspaceStore.setTabMode(left.tabs[0].id, 'live');
await sleep(600);
window.__clew.editorPool.get(left.tabs[0].id)?.view.focus();
await sleep(200);
console.log(`smoke-gt: editor-focused=${Boolean(document.activeElement?.closest?.('.cm-editor'))}`);
console.log(`smoke-gt: setup left=${left.tabs.map((t) => t.path).join(',')} right=${right.tabs.map((t) => t.path).join(',')}`);

const term = () => window.__clew.shellTerminal;
const termText = () => {
	const b = term()?.buffer.active;
	if (!b) return '';
	let out = '';
	for (let y = 0; y < b.length; y++) out += b.getLine(y)?.translateToString(true) + '\n';
	return out;
};
const where = () => {
	const g = workspaceStore.activeGroup();
	const i = g.tabs.findIndex((t) => t.id === g.activeTabId);
	return `pane=${g.id === left.id ? 'L' : 'R'} tab=${i + 1}/${g.tabs.length} path=${(g.tabs[i]?.path ?? '').replace(/\.md$/, '')}`;
};
let last = where();
const seen = [];
workspaceStore.on('active-changed', () => {
	const now = where();
	if (now !== last) { console.log(`smoke-gt: active ${now}`); seen.push(now); }
	last = now;
});

window.__clewSmokeInput = [
	{ wait: 500 },
	{ combo: { key: '2', modifiers: META } }, { wait: 700 },
	{ combo: { key: '9', modifiers: META } }, { wait: 700 },
	{ combo: { key: '7', modifiers: META } }, { wait: 2500 },   // the right pane is made current in here
	{ combo: { key: '1', modifiers: META } }, { wait: 700 },
	{ combo: { key: '9', modifiers: META } }, { wait: 700 },
	{ combo: { key: '`', modifiers: CTRL } }, { wait: 5000 },  // the shell: a login zsh, its first prompt
	{ combo: { key: '1', modifiers: META } }, { wait: 1500 },
];

(async () => {
	const until = async (test, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (test()) return true; await sleep(100); } return false; };
	await until(() => seen.some((s) => /pane=L tab=5\/5/.test(s)));   // ⌘9
	await sleep(1200);   // ⌘7 lands at +700
	console.log(`smoke-gt: after-7 ${where().replace('pane=', '').replace(' path=', ' ').split(' ').slice(0, 2).join(' ')}`);
	workspaceStore.setActiveGroup(right.id);
	const mark = seen.length;
	await until(() => seen.slice(mark).some((s) => /pane=R tab=1\/2/.test(s)));   // ⌘1
	await until(() => seen.slice(mark).some((s) => /pane=R tab=2\/2/.test(s)) && term());   // ⌘9, then the shell
	await until(() => document.activeElement?.closest?.('clew-shell-panel') && /\$/.test(termText()), 10000);
	const before = termText();
	console.log(`smoke-gt: terminal focused=${Boolean(document.activeElement?.closest?.('clew-shell-panel'))}`);
	await until(() => /pane=R tab=1\/2/.test(last), 6000);
	await sleep(500);
	console.log(`smoke-gt: after-shell ${last} terminal-unchanged=${termText() === before}`);
})();
