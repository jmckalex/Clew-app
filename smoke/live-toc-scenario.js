// Live edit's `{{TOC}}` follows the note's headings as they are edited, with
// the cursor nowhere near it (the owner's report, 2026-10-19: the contents
// changed only after the cursor had entered `{{TOC}}` and left it). Writes
// its own note, Toc.md, into any vault (CLEW_SMOKE_VAULT=<an empty folder>,
// CLEW_SMOKE_LOG=1). Each edit is a transaction with the cursor at the end
// of the note; then the entries are read from the widget. Logs (smoke-toc:):
//   initial    entries=["Title","Alpha","Beta"] indents=[0,1,1] goto-ok=true
//   renamed    entries=["Title","Gamma","Beta"] …   `## Alpha` → `## Gamma`
//   deeper     … indents=[0,1,2] …                  `## Beta` → `### Beta`
//   added      entries=[…,"Delta"] …                a heading appended
//   shifted    … goto-ok=true                       a paragraph inserted above
//              every heading: each entry's jump still names its heading
//   click Beta line="### Beta"                      REAL input: the entry
//              clicked puts the cursor on its heading
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-toc: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'Toc.md', content: '# Title\n\n{{TOC}}\n\n## Alpha\n\nOne.\n\n## Beta\n\nTwo.\n' });
const tab = workspaceStore.openNote('Toc.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-toc li'));
const view = editorPool.get(tab.id).view;
const end = () => ({ anchor: view.state.doc.length });
view.dispatch({ selection: end() });
await sleep(200);

const entries = () => [...document.querySelectorAll('.le-toc li')];
// Does each entry name its own heading? An entry carries its heading's
// ordinal, which a click resolves against the document as it is then.
const gotoOk = () => {
	const headings = view.state.doc.toString().split('\n').filter((l) => /^#{1,6} /.test(l)).map((l) => l.replace(/^#+ /, ''));
	return entries().every((li, i) => li.dataset.leHeading === String(i) && headings[i] === li.textContent);
};
const report = (what) => {
	const lis = entries();
	// Each level is 1.2em of padding (widgets/blocks.js#TocWidget).
	log(`${what} entries=${JSON.stringify(lis.map((li) => li.textContent))}`
		+ ` indents=${JSON.stringify(lis.map((li) => Math.round(parseFloat(li.style.paddingLeft || '0') / 1.2)))}`
		+ ` goto-ok=${gotoOk()}`);
};
const replace = (from, to) => {
	const at = view.state.doc.toString().indexOf(from);
	view.dispatch({ changes: { from: at, to: at + from.length, insert: to }, selection: end() });
};
const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

report('initial');
replace('## Alpha', '## Gamma');
await settle();
report('renamed');
replace('## Beta', '### Beta');
await settle();
report('deeper');
view.dispatch({ changes: { from: view.state.doc.length, insert: '\n## Delta\n' }, selection: { anchor: view.state.doc.length + 10 } });
await settle();
report('added');
replace('{{TOC}}\n', '{{TOC}}\n\nA paragraph above every heading but the first.\n');
await settle();
report('shifted');

const beta = entries().find((li) => li.textContent === 'Beta');
const r = beta.getBoundingClientRect();
// The harness sends queued input once the scenario has returned.
window.__clewSmokeInput = [{ click: { x: Math.round(r.left + 10), y: Math.round(r.top + r.height / 2) } }, { wait: 2000 }];
const line = () => view.state.doc.lineAt(view.state.selection.main.head).text;
const before = line();
setTimeout(async () => {
	await until(() => line() !== before, 1200);
	log(`click Beta line=${JSON.stringify(line())}`);
	log('done');
}, 0);
