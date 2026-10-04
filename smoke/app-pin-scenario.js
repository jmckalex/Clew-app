// Pinning an app within its note (`pin=top|bottom`, shared/app-pin.js; the
// owner's ask 2026-10-04) and live edit's @app forms. Over `node
// smoke/make-app-pin-vault.mjs <dir> <mode>`, CLEW_SMOKE_VAULT=<dir>/vault,
// CLEW_USER_DATA=<dir>/ud (restricted: each app behind its prompt, answered
// Allow by a real click). Modes (pin-mode.txt):
//   reading  Pin.md in reading view; with CLEW_SMOKE_FRAME_SCRIPT=
//            smoke/app-pin-frame.js CLEW_SMOKE_FRAME_MATCH=Pin.md the
//            preview scrolls itself and logs, at each position, where the
//            two holders are (`pin-read: y=… ticker=… timer=…`), that the
//            frames are the same elements with no load since, and no jump
//   live     Pin.md in live edit: the same from the app page (`pin-live:`),
//            plus the caret kept clear of the bottom band (scrollMargins)
//            and a SPLIT pane holding the same note pinned on its own
//   control  `live` over the same note WITHOUT its pins: CodeMirror's own
//            height-map settling (a line re-measured on a second visit moves
//            the scroll by its delta, ~26 px at y=2800) — the pinned run's
//            positions must match this one's exactly, pass for pass
//   forms    Forms.md in live edit: `forms frames=2 slots=2 chip=…` — the
//            `@app+[…]` and `@begin(app)` forms are frames, the inline
//            `@app[…]` a chip
// and, at the end, `pin: starts={…}` — each app welcomed ONCE (a reload
// would say hello again).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const { workspaceStore, vaultStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-pin: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const mode = String(await ipc.invoke('clew:note-read', { path: 'pin-mode.txt' }).then((r) => r?.content ?? r)).trim();
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const note = mode === 'forms' ? 'Forms.md' : 'Pin.md';
const viewMode = mode === 'reading' ? 'reading' : 'live';
const tab = workspaceStore.openNote(note, { newTab: true, defaultMode: viewMode });
workspaceStore.setTabMode(tab.id, viewMode);
log(`mode=${mode} note=${note}`);
const allowOnce = [{ wait: 2000 }, { click: { selector: '.clew-app-sheet .clew-trust-button' } }];
window.__clewSmokeInput = [...Array(8)].flatMap(() => allowOnce).concat([{ wait: mode === 'live' ? 26000 : 4000 }]);
const starts = () => JSON.stringify(Object.values(window.__clew.appHost?.appStarts?.() ?? {}));

if (mode !== 'reading') {
	(async () => {
		// Off the first line (the reveal rule), then wait for the prompts.
		await sleep(1500);
		const view = editorPool.get(tab.id)?.view;
		view?.dispatch({ selection: { anchor: view.state.doc.length } });
		await sleep(17000);
		const all = () => [...document.querySelectorAll('iframe.le-frame')].filter((f) => f.style.visibility !== 'hidden');
		if (mode === 'forms') {
			const firstLine = [...view.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes('sits in this sentence'));
			log(`forms frames=${all().length} slots=${view.contentDOM.querySelectorAll('.le-frame-slot').length} chip=${JSON.stringify(firstLine?.textContent ?? null)} live=${JSON.stringify(window.__clew.appHost?.liveEmbeds().map((e) => e.name).sort())}`);
			log(`starts=${starts()}`);
			return;
		}
		const scroller = view.scrollDOM;
		const box = () => scroller.getBoundingClientRect();
		// The ticker's frame is the shorter one (150 against 280).
		const pick = () => {
			const list = all().sort((a, b) => a.offsetHeight - b.offsetHeight);
			return { ticker: list[0], timer: list[1] };
		};
		const first = pick();
		let loads = 0;
		for (const f of [first.ticker, first.timer]) f?.addEventListener('load', () => { loads++; });
		const height = scroller.scrollHeight;
		const max = scroller.scrollHeight - scroller.clientHeight;
		// Twice over: the first pass meets lines CodeMirror has only
		// estimated, and its height map settles as they are drawn; on the
		// second every height is known, so any jump would be the pin's.
		for (const [pass, y] of [0, 600, 2800, max].flatMap((v) => [[1, v]]).concat([0, 600, 2800, max].map((v) => [2, v]))) {
			scroller.scrollTop = y;
			await frames();
			await sleep(250);
			const { ticker, timer } = pick();
			const s = box();
			const t = ticker?.getBoundingClientRect();
			const b = timer?.getBoundingClientRect();
			log(`pin-live: pass=${pass} y=${y} scrollTop=${Math.round(scroller.scrollTop)} height-same=${scroller.scrollHeight === height}`
				+ ` ticker=${t ? `top-off=${Math.round(t.top - s.top)} stuck=${ticker.classList.contains('is-pinned')}` : 'none'}`
				+ ` timer=${b ? `bottom-off=${Math.round(s.bottom - b.bottom)} stuck=${timer.classList.contains('is-pinned')}` : 'none'}`
				+ ` same-frames=${ticker === first.ticker && timer === first.timer} loads=${loads}`);
		}
		// The caret is kept clear of the bottom band: a line scrolled to just
		// above the bottom edge, the cursor put there — CodeMirror scrolls it
		// up past the band (EditorView.scrollMargins from the frame layer).
		scroller.scrollTop = Math.round(max / 2);
		await frames();
		await sleep(250);
		const bottomPos = view.posAtCoords({ x: box().left + 80, y: box().bottom - 30 });
		view.dispatch({ selection: { anchor: bottomPos }, scrollIntoView: true });
		await frames();
		await sleep(300);
		const caret = view.coordsAtPos(view.state.selection.main.head);
		const band = pick().timer?.getBoundingClientRect();
		log(`pin-caret: caret-bottom=${Math.round(caret?.bottom ?? -1)} band-top=${Math.round(band?.top ?? -1)} clear=${(caret?.bottom ?? Infinity) <= (band?.top ?? -Infinity)}`);
		log(`starts-before-split=${starts()}`);
		// A split: the same note beside it, scrolled on its own, pinned on its own.
		const split = { id: 't-pin-split', kind: 'note', path: 'Pin.md', view: { mode: 'live' }, history: { back: [], forward: [] } };
		workspaceStore.splitGroup(workspaceStore.activeGroupId, 'right', split);
		workspaceStore.setTabMode(split.id, 'live');
		await sleep(7000);
		const views = editorPool.tabsFor('Pin.md').map((id) => editorPool.get(id)?.view).filter(Boolean);
		const other = views.find((v) => v !== view);
		if (other) {
			other.dispatch({ selection: { anchor: other.state.doc.length } });
			other.scrollDOM.scrollTop = Math.round((other.scrollDOM.scrollHeight - other.scrollDOM.clientHeight) / 2);
			await frames();
			await sleep(400);
			const sb = other.scrollDOM.getBoundingClientRect();
			const mine = [...other.scrollDOM.querySelectorAll('iframe.le-frame')].filter((f) => f.style.visibility !== 'hidden').sort((a, b) => a.offsetHeight - b.offsetHeight);
			const [t, b] = mine.map((f) => f.getBoundingClientRect());
			log(`pin-split: panes=${workspaceStore.allGroups().length} ticker-top-off=${t ? Math.round(t.top - sb.top) : 'none'} timer-bottom-off=${b ? Math.round(sb.bottom - b.bottom) : 'none'} within-pane=${Boolean(t && b && t.left >= sb.left - 1 && b.right <= sb.right + 1)}`);
		} else log('pin-split: no second view');
		log(`starts=${starts()} loads=${loads}`);
	})();
} else {
	(async () => {
		await sleep(18000);
		log(`starts=${starts()}`);
	})();
}
