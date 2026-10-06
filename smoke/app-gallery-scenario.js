// The demo vault's sample apps (Features/App Gallery.md) — each runs behind
// its prompt, and each bridge call it makes works by REAL input. Over `node
// smoke/make-app-gallery-vault.mjs <dir> <case>`, CLEW_SMOKE_VAULT=<dir>/vault,
// CLEW_USER_DATA=<dir>/ud-trusted or <dir>/ud-restricted, and
// CLEW_SMOKE_FRAME_SCRIPT=smoke/app-gallery-frame.js
// CLEW_SMOKE_FRAME_MATCH=clew-frame (each app's own state, `smoke-ag-app:`).
// Every prompt is answered Allow by a real click; this logs each prompt's
// text (`ag: prompt …`) and then, per case:
//   gallery   `ag: live=[…]` — the six apps holding a port
//   insert    `ag: insert doc-has-summary=true` (Replicator → editor.insert)
//   timer     `ag: timer logged=true line="- <date>: ran a 3-second exercise at …"`
//   picker    the frame's `picked=… copied=… clipboard=…` (clipboard)
//   progress  `ag: progress typed=true words=<n>`, the frame's `events>=1 words=<n>`
//   ticker    `ag: ticker phase=…` markers around the click on ECB rates (with
//             CLEW_SMOKE_NET_LOG=1: no `smoke-net:` before, only
//             api.frankfurter.dev after)
//   reading   `ag: reading active=Reading/…` (a click opened the note)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-ag: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const kase = String(await ipc.invoke('clew:note-read', { path: 'gallery-case.txt' }).then((r) => r?.content ?? r)).trim();
const NOTES = { gallery: 'Features/App Gallery.md', insert: 'Tests/Insert.md', timer: 'Tests/Timer.md', picker: 'Tests/Picker.md',
	progress: 'Tests/Progress.md', ticker: 'Tests/Ticker.md', reading: 'Tests/Reading.md' };
const LIVE = new Set(['insert', 'progress']);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const mode = LIVE.has(kase) ? 'live' : 'reading';
const tab = workspaceStore.openNote(NOTES[kase], { newTab: true, defaultMode: mode });
workspaceStore.setTabMode(tab.id, mode);
log(`case=${kase} note=${NOTES[kase]} mode=${mode}`);

// Each prompt, as it comes, by its text.
const seen = new Set();
const watchPrompts = setInterval(() => {
	const sheet = document.querySelector('.clew-app-sheet');
	if (!sheet || seen.has(sheet.dataset.appKey)) return;
	seen.add(sheet.dataset.appKey);
	log(`prompt ${sheet.querySelector('h2')?.textContent} — ${sheet.querySelector('p')?.textContent}`);
}, 100);
const allowOnce = [{ wait: 2500 }, { click: { selector: '.clew-app-sheet .clew-trust-button' } }];
// One app's prompt comes when its frame does — later in live edit: try a few
// times (a try with no sheet up is skipped by the harness).
const allow = [...allowOnce, ...allowOnce, ...allowOnce, ...allowOnce];
const app = (selector) => ({ frameClick: { match: 'clew-frame', selector } });
const doc = () => editorPool.get(tab.id)?.view?.state.doc.toString() ?? '';
const disk = async (rel) => String(await ipc.invoke('clew:note-read', { path: rel }).then((r) => r?.content ?? r));

if (kase === 'gallery') {
	// A real Space while the first prompt is up must NOT answer it: the
	// prompt focuses its question, not Allow (app-host.js#drawPrompt).
	window.__clewSmokeInput = [{ wait: 4000 }, { combo: { key: ' ', code: 'Space', text: ' ' } }, { wait: 700 },
		...[...Array(6)].flatMap(() => allowOnce), { wait: 12000 }];
	(async () => {
		await sleep(4500);
		const sheet = document.querySelector('.clew-app-sheet');
		log(`space-pressed sheet-still-up=${Boolean(sheet)} focus=${document.activeElement?.className} live=${window.__clew.appHost?.liveEmbeds().length}`);
	})();
	(async () => {
		await sleep(6 * 2600 + 14000);
		clearInterval(watchPrompts);
		const live = window.__clew.appHost?.liveEmbeds().map((e) => e.name).sort();
		log(`live=${JSON.stringify(live)}`);
	})();
} else if (kase === 'insert') {
	window.__clewSmokeInput = [...allow, { wait: 5000 }, app('#insert'), { wait: 10000 }];
	(async () => {
		await sleep(3000);
		// The cursor at the end, where "The result goes here:" points.
		const view = editorPool.get(tab.id)?.view;
		view?.dispatch({ selection: { anchor: view.state.doc.length } });
		await sleep(20000);
		log(`insert doc-has-summary=${doc().includes('*Replicator dynamics — Stag Hunt.*')} tail=${JSON.stringify(doc().slice(-160))}`);
	})();
} else if (kase === 'timer') {
	window.__clewSmokeInput = [...allow, { wait: 4000 }, app('#minutes'), { text: '0.05' }, app('#set'), app('#start'), { wait: 14000 }];
	(async () => {
		await sleep(27000);
		const text = await disk('Tests/Timer.md');
		const line = text.split('\n').find((l) => /ran a 3-second exercise at \d\d:\d\d/.test(l));
		log(`timer logged=${Boolean(line)} line=${JSON.stringify(line ?? null)}`);
	})();
} else if (kase === 'picker') {
	window.__clewSmokeInput = [...allow, { wait: 4000 }, app('#spin'), { wait: 5000 }, app('#copy'), { wait: 3000 }];
} else if (kase === 'progress') {
	const typed = ' Six more words typed right here.';
	window.__clewSmokeInput = [...allow, { wait: 3000 }, { click: { selector: '.cm-content .cm-line:last-child' } },   // the text, not the app's frame
		{ combo: { key: 'ArrowDown', modifiers: 4 } }, { text: typed }, { wait: 18000 }];
	(async () => {
		// Off the first line, so the app's block is drawn (a cursor touching
		// it reveals its source — the reveal rule), as in `insert`.
		await sleep(2000);
		const view = editorPool.get(tab.id)?.view;
		view?.dispatch({ selection: { anchor: view.state.doc.length } });
		await sleep(22000);
		const words = doc().replace(/^@\w+\+?\[.*$/gm, '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
		log(`progress typed=${doc().includes(typed.trim())} saved=${(await disk('Tests/Progress.md')).includes(typed.trim())} words=${words}`);
	})();
} else if (kase === 'ticker') {
	// ECB rates (#modeEcb; the one-button #live went with the Finnhub mode,
	// 7bbfdb1): api.frankfurter.dev, the only host it may reach here.
	window.__clewSmokeInput = [...allow, { wait: 8000 }, app('#modeEcb'), { wait: 10000 }];
	(async () => {
		await sleep(10200);
		log('ticker phase=allowed (simulated; no network expected)');
		await sleep(7300);
		log('ticker phase=clicking-ecb');
	})();
} else if (kase === 'reading') {
	window.__clewSmokeInput = [...allow, { wait: 6000 }, app('li:first-child button'), { wait: 8000 }];
	(async () => {
		await sleep(21000);
		log(`reading active=${workspaceStore.activeTab()?.path} tabs=${JSON.stringify(workspaceStore.allGroups().flatMap((g) => g.tabs).map((t) => t.path))}`);
	})();
}
