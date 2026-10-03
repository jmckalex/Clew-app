// A link from a note to a PDF never replaces the note's tab (the owner's
// ask, 2026-10-03; actions.openWikilink → tree.openFileBeside). Over
// `node smoke/make-pdf-link-vault.mjs <dir> <live|reading> <single|split|background> [mod]`,
// one REAL click on Note.md's `[[Five.pdf#page=3|PDF p. 3]]` — in live edit
// (the link widget) or reading view (the link inside the preview frame):
//   single      Note.md alone → a new tab beside it, at page 3
//   split       Five.pdf open (page 1) in the right pane → that tab, page 3
//   background  Five.pdf open behind Note.md in the same pane → that tab, page 3
// and with `mod` the ⌘-click: this pane — its tab for the PDF, else a new
// tab here. Logs `link: <case> note-kept=… note-tab-path=… pdf-tabs=…
// pdf-pane=… same-tab=… active=… page=…`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, actions, ipc } = window.__clew;
const log = (s) => console.log('smoke-pl: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const kase = JSON.parse(await ipc.invoke('clew:note-read', { path: 'link-case.json' }));
const PDF = 'Papers/Five.pdf';
const groups = () => workspaceStore.allGroups();
const pdfTabs = () => groups().flatMap((g) => g.tabs.filter((t) => t.path === PDF).map((t) => ({ tab: t, group: g })));

const note = workspaceStore.openNote('Note.md', { defaultMode: kase.mode });
workspaceStore.setTabMode(note.id, kase.mode);
const noteGroup = workspaceStore.activeGroupId;
let before = null;
if (kase.layout === 'split') {
	actions.splitActive('right');
	before = workspaceStore.openFile(PDF);
	workspaceStore.setActiveGroup(noteGroup);
	workspaceStore.activateTab(note.id);
} else if (kase.layout === 'background') {
	before = workspaceStore.openFile(PDF, { newTab: true });
	await sleep(1500);
	workspaceStore.activateTab(note.id);
}
await sleep(2500);

/** The viewer's page, asked of the tab's frame (pdf-core's pdf-current-page). */
const pageOf = (tabPath) => new Promise((resolve) => {
	const frame = [...document.querySelectorAll('clew-file-view:not([data-clew-retiring])')].find((v) => v.path === tabPath && v.offsetParent)?.querySelector('iframe.pdf-frame');
	if (!frame) { resolve(null); return; }
	const requestId = 9000 + Math.floor(Math.random() * 1000);
	const on = (e) => {
		if (e.source !== frame.contentWindow || e.data?.type !== 'pdf-current-page' || e.data.requestId !== requestId) return;
		window.removeEventListener('message', on);
		resolve(e.data.page);
	};
	window.addEventListener('message', on);
	frame.contentWindow.postMessage({ source: 'clew-pdf-host', type: 'pdf-current-page', requestId }, '*');
	setTimeout(() => { window.removeEventListener('message', on); resolve(null); }, 3000);
});

const modifiers = kase.mod ? 4 : 0;   // CDP: 4 = Meta
if (kase.mode === 'live') {
	await until(() => document.querySelector('.cm-content [data-le-target]'));
	const el = document.querySelector('.cm-content [data-le-target]');
	const r = el.getBoundingClientRect();
	window.__clewSmokeInput = [{ click: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }, modifiers }, { wait: 4000 }];
} else {
	window.__clewSmokeInput = [{ frameClick: { match: 'Note.md', selector: 'a.internal-link' }, modifiers }, { wait: 4000 }];
}
(async () => {
	await until(() => pdfTabs().length && workspaceStore.activeTab()?.path === PDF, 6000);
	await sleep(1500);
	let page = null;
	for (let i = 0; i < 20 && page !== 3; i++) { page = await pageOf(PDF); if (page !== 3) await sleep(300); }
	const tabs = pdfTabs();
	const noteNow = workspaceStore.findTab(note.id);
	const active = workspaceStore.activeTab();
	log(`link: ${kase.mode}/${kase.layout}${kase.mod ? '/mod' : ''} note-kept=${noteNow?.tab.path === 'Note.md'} note-tab-path=${noteNow?.tab.path ?? 'gone'} pdf-tabs=${tabs.length} pdf-pane=${tabs[0]?.group.id === noteGroup ? 'note' : 'other'} same-tab=${before ? tabs.some((t) => t.tab.id === before.id) : 'n/a'} active=${active?.path} page=${page} panes=${groups().length}`);
})();
