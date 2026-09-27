// Citations as objects (docs/dev/live-edit.md §5.14) with real input.
// Fixture: `node smoke/make-citations-vault.mjs <dir>` (the run edits A.md).
//
// Laid out first, so every click has a place: A.md in live edit, the
// References panel's Library in the right sidebar, the graph in a split.
//   1. `rows=3 cited-in=[2,1,0]` (the pandoc form in C.md does not count with
//      the vault's pandocCitations off), `uncited=1`, search "alex" → `search=1`
//   2. a real move onto the \cite{alexander2023} chip → `preview=visible
//      author=true` (no bibliography named: the .bib's own fields, on a card)
//   3. a real click on the chip → `panel-focused=alexander2023`
//   4. a real click on lamport's Insert → `inserted=true` (\cite{lamport1994}
//      at the caret)
//   5. a real ⌥-click on the chip → `alt-revealed=true`
//   6. a real click on the graph's References toggle → `graph nodes=+3
//      links=+4` (A cites alexander, knuth and — since step 4 — lamport;
//      B cites alexander; C's pandoc form does not count)
//   7. a real click on alexander's PDF → `pdf-tab=true`
//   8. pandocCitations on → `pandoc cited-in=[2,1,2]` (lamport: A since step 4,
//      and now C's [@lamport1994])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, vaultSettingsStore, settingsStore, actions } = window.__clew;
const log = (s) => console.log('smoke-ci: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
const center = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
settingsStore.set('graphReferences', false);
settingsStore.set('linkPreview', 'hover');
workspaceStore.setSidebar('left', { open: false });
const tab = workspaceStore.openNote('A.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
actions.splitActive('right');
actions.openGraph();
await sleep(500);
workspaceStore.activateTab(tab.id);
workspaceStore.setSidebar('right', { open: true, activeTool: 'bibliography' });
await until(() => document.querySelector('clew-bibliography .bib-row'), 10000);
document.querySelector('clew-bibliography .bib-mode:nth-child(2)')?.click(); // Library
await until(() => document.querySelectorAll('clew-bibliography .bib-row').length === 3, 8000);
await until(() => document.querySelector('.cm-content .le-cite'), 8000);
await sleep(800);
const view = editorPool.get(tab.id).view;
const doc = () => view.state.doc.toString();
const panel = document.querySelector('clew-bibliography');
const row = (key) => panel.querySelector(`.bib-row[data-key="${key}"]`);
const counts = () => ['alexander2023', 'knuth1984', 'lamport1994'].map((k) => Number(row(k)?.querySelector('.bib-cited').dataset.count));

// 1
log(`rows=${panel.querySelectorAll('.bib-row').length} cited-in=${JSON.stringify(counts())}`);
const filter = panel.querySelector('.bib-filter');
filter.value = 'uncited'; filter.dispatchEvent(new Event('change'));
log(`uncited=${panel.querySelector('.bib-library').dataset.count}`);
filter.value = 'all'; filter.dispatchEvent(new Event('change'));
const search = panel.querySelector('.bib-search');
search.value = 'alex'; search.dispatchEvent(new Event('input'));
log(`search=${panel.querySelector('.bib-library').dataset.count}`);
search.value = ''; search.dispatchEvent(new Event('input'));
await sleep(200);

view.dispatch({ selection: { anchor: doc().indexOf('Last line.') + 'Last line.'.length } });
const chip = document.querySelector('.cm-content .le-cite');
const CHIP = center(chip);
const INSERT = center(row('lamport1994').querySelector('.bib-insert'));
const PDF = center(row('alexander2023').querySelector('.bib-pdf'));
const graph = document.querySelector('clew-graph-view');
const TOGGLE = center(graph.querySelector('.graph-references-toggle input'));
const graphBefore = { nodes: Number(graph.dataset.nodes), links: Number(graph.dataset.links) };

window.__clewSmokeInput = [
	{ move: CHIP }, { wait: 1300 },                            // 2
	{ click: CHIP }, { wait: 1000 },                           // 3
	{ wait: 800 },                                             // the scenario: the caret to the end
	{ click: INSERT }, { wait: 1000 },                         // 4
	{ click: CHIP, modifiers: 1 }, { wait: 1000 },             // 5
	{ click: TOGGLE }, { wait: 1500 },                         // 6
	{ click: PDF }, { wait: 2000 },                            // 7
	{ wait: 2500 },                                            // 8
];

(async () => { try {
	// 2
	await until(() => window.__clew.linkPreview().describe().visible, 5000);
	const p = window.__clew.linkPreview().describe();
	log(`preview=${p.visible ? 'visible' : 'none'} author=${(p.card ?? '').includes('Alexander')} card=${JSON.stringify(p.card)}`);

	// 3
	await until(() => panel.querySelector('.bib-row.is-focused'), 4000);
	log(`panel-focused=${panel.querySelector('.bib-row.is-focused')?.dataset.key}`);
	view.dispatch({ selection: { anchor: doc().indexOf('Last line.') + 'Last line.'.length } });
	view.focus();

	// 4
	await until(() => doc().includes('\\cite{lamport1994}'), 4000);
	log(`inserted=${doc().includes('Last line.\\cite{lamport1994}')}`);

	// 5
	await until(() => !document.querySelector('.cm-content .le-cite[data-le-cite="alexander2023"]'), 3000);
	log(`alt-revealed=${!document.querySelector('.cm-content .le-cite[data-le-cite="alexander2023"]') && doc().includes('\\cite{alexander2023}')}`);

	// 6
	await until(() => Number(graph.dataset.nodes) !== graphBefore.nodes, 4000);
	log(`graph nodes=+${Number(graph.dataset.nodes) - graphBefore.nodes} links=+${Number(graph.dataset.links) - graphBefore.links} toggle=${settingsStore.get('graphReferences')}`);

	// 7
	await until(() => workspaceStore.allGroups().some((g) => g.tabs.some((t) => t.path === 'Papers/alexander.pdf')), 4000);
	log(`pdf-tab=${workspaceStore.allGroups().some((g) => g.tabs.some((t) => t.path === 'Papers/alexander.pdf'))}`);

	// 8
	await vaultSettingsStore.set('pandocCitations', true);
	panel.showEntry('lamport1994');
	await sleep(600);
	log(`pandoc cited-in=${JSON.stringify(counts())}`);
	await vaultSettingsStore.set('pandocCitations', false);
	settingsStore.set('graphReferences', false);
} catch (err) { log('ERROR ' + err.stack); } })();
