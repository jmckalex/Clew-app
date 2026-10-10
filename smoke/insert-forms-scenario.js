// What the Insert commands WRITE and what each draws — the colon directives'
// retirement, phase 1 (jmarkdown is retiring `:::name`, `::name[…]` and
// `:name[…]`, the owner's decision 2026-10-10; shared/format-spec.js#
// BLOCK_INSERTS). Any vault, e.g. an empty folder: the run writes Inserts.md
// (CLEW_SMOKE_VAULT=<dir>/vault CLEW_USER_DATA=<dir>/ud CLEW_SMOKE_LOG=1 — a
// fresh profile, so the vault is restricted and Mathematica is REFUSED by name,
// never run). Pair with insert-forms-frame.js and CLEW_SMOKE_FRAME_MATCH=Inserts.
//
// Every block Insert of the Format menu, then "Insert environment…" (theorem)
// and Today's Date, each run by its command id in live edit:
//   written  colon=false, then the opener of every block in order
//            (`@begin(mermaid)` … `@begin(<name>)`, `@begin(theorem)`) and
//            today=@today
//   live     frames=[mermaid,TiKZ,Mathematica,game,markdown-demo] — the rich
//            ones drawn as frames (RICH_ENVIRONMENTS); heads=[…] the rest as an
//            environment head, the theorem's numbered ("Theorem 1"), the HTML
//            block's noted "HTML only", the comment dimmed (comment-dim=true)
// then reading view, reported by the frame script (insert-forms-frame.js).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, workspaceStore, editorPool, registry, ipc } = window.__clew;
const log = (s) => console.log('smoke-if: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (test()) return true;
	return false;
};
const BLOCKS = ['format:mermaid', 'format:tikz', 'format:mathematica', 'format:game', 'format:markdown-demo',
	'format:tex-block', 'format:html-block', 'format:abstract', 'format:title-box', 'format:comment',
	'format:container', 'format:env'];
try {
	await until(() => vaultStore.vault?.sessionId);
	await ipc.invoke('clew:note-write', { path: 'Inserts.md', content: '# Inserts\n\nToday is ' });
	const tab = workspaceStore.openNote('Inserts.md', { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(tab.id, 'live');
	await until(() => document.querySelector('.cm-editor.cm-live'));
	const view = editorPool.get(tab.id).view;
	const doc = () => view.state.doc.toString();
	view.focus();
	view.dispatch({ selection: { anchor: doc().length } });
	registry.runCommand('format:today');
	for (const id of BLOCKS) {
		view.dispatch({ changes: { from: doc().length, insert: '\n' }, selection: { anchor: doc().length + 1 } });
		registry.runCommand(id);
		await sleep(50);
	}
	const text = doc();
	const colon = /^[ \t]*:{3,}|(^|[\s(]):{1,2}[A-Za-z][\w-]*/m.test(text.replace(/^# Inserts$/m, ''));
	log(`written colon=${colon} today=${/Today is (@today|:today)/.exec(text)?.[1] ?? 'none'}`);
	log(`openers=${JSON.stringify(text.split('\n').filter((l) => /^@begin|^:::/.test(l)))}`);

	// Live edit: scroll through, collecting what is drawn (only what is near the
	// viewport exists).
	await sleep(1500);
	const frames = new Set(), heads = new Set();
	let commentDim = false;
	for (let top = 0; top <= view.scrollDOM.scrollHeight; top += 250) {
		view.scrollDOM.scrollTop = top;
		await sleep(250);
		for (const s of document.querySelectorAll('.cm-live .le-frame-slot[data-kind]')) frames.add(s.dataset.kind);
		for (const h of document.querySelectorAll('.cm-live .le-env-head')) {
			heads.add([h.querySelector('.le-env-name')?.textContent, h.querySelector('.le-env-note')?.textContent].filter(Boolean).join(' · '));
		}
		const c = document.querySelector('.cm-live .cm-line.le-env-comment');
		if (c) commentDim = getComputedStyle(c).opacity === '0.55';
	}
	log(`live frames=${JSON.stringify([...frames])} heads=${JSON.stringify([...heads])} comment-dim=${commentDim}`);

	await editorPool.saveNow(tab.id);
	workspaceStore.setTabMode(tab.id, 'reading');
	await sleep(6000);
	log('done');
} catch (err) { log('ERROR ' + err.stack); }
window.__clewSmokeInput = [{ wait: 300 }];
