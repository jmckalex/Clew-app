// PDF save safety (main/pdf-guard.js, renderer/pdf-conflicts.js): an
// annotated PDF changed in two places never loses a version silently. Over
// `node smoke/make-pdf-conflict-vault.mjs <dir> <mine|theirs|both|later>`:
// Paper.pdf opens in a tab; "another device" writes a different version
// (the original + `%THEIRS-MARK`, unguarded, as a sync client would); the
// tab's viewer annotates ("MINE") and its autosave is REFUSED — nothing
// written, both versions in the PDF's history, the sheet up. A REAL click
// makes the choice. Logs:
//   `pc: refused sheet=true disk=theirs history=2 status=<viewer status>`
//   mine:   `pc: mine disk=mine copy=none`, then `pc: after saves-again=true conflict-again=false`
//   theirs: `pc: theirs disk=theirs viewer-has-mine=false`, then the same `after` line
//   both:   `pc: both disk=theirs copy=mine side-by-side=true`
//   later:  `pc: later notice=true disk=theirs held=true` (an edit while held saves nothing)
// `embed`: the viewer is Embed.md's `![[Paper.pdf]]` in reading view (inside
// the note's frame) — the same lines. `gone`: the tab is closed after the
// refusal, before the choice — the versions in history do it (`mine` →
// `disk=mine`, `both` → `copy=mine`).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-pc: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const kase = JSON.parse(await ipc.invoke('clew:note-read', { path: 'case.json' }));
await until(() => vaultStore.vault?.sessionId);
const sid = vaultStore.vault.sessionId;
const MARK = '%THEIRS-MARK';
const diskBytes = async (rel = 'Paper.pdf') => new Uint8Array(await (await fetch(`clew-preview://vault/${sid}/${encodeURI(rel)}`, { cache: 'no-store' })).arrayBuffer());
const hasMark = (bytes) => new TextDecoder('latin1').decode(bytes).includes(MARK);
// The window holding the viewer: the PDF tab's, or the note's (the embed's
// viewer lives in the note's own document, which answers for it).
const frameOf = (rel) => (kase.surface === 'embed'
	? [...document.querySelectorAll('clew-preview-view')].find((v) => v.offsetParent)?.querySelector('iframe')
	: [...document.querySelectorAll('clew-file-view:not([data-clew-retiring])')].find((v) => v.path === rel)?.querySelector('iframe.pdf-frame'));
const annotate = (contents) => new Promise((resolve) => {
	const win = frameOf('Paper.pdf')?.contentWindow;
	const on = (e) => { if (e.source === win && e.data?.type === 'test-created') { window.removeEventListener('message', on); resolve(e.data.made); } };
	window.addEventListener('message', on);
	win?.postMessage({ source: 'clew-preview-host', type: 'test-create-annotations', specs: [{ kind: 'note', page: 1, contents }] }, '*');
	setTimeout(() => { window.removeEventListener('message', on); resolve(-1); }, 8000);
});
const annotations = () => new Promise((resolve) => {
	const win = frameOf('Paper.pdf')?.contentWindow;
	const requestId = `pc-${Date.now()}`;
	const on = (e) => { if (e.source === win && e.data?.type === 'annotations' && e.data.requestId === requestId) { window.removeEventListener('message', on); resolve(e.data.annotations ?? []); } };
	window.addEventListener('message', on);
	win?.postMessage({ source: 'clew-preview-host', type: 'list-annotations', requestId }, '*');
	setTimeout(() => { window.removeEventListener('message', on); resolve(null); }, 8000);
});
const sheet = () => document.querySelector('.clew-conflict-sheet');

workspaceStore.setSidebar('left', { open: false });
if (kase.surface === 'embed') {
	const t = workspaceStore.openNote('Embed.md', { defaultMode: 'reading' });
	workspaceStore.setTabMode(t.id, 'reading');
} else workspaceStore.openFile('Paper.pdf', { newTab: true });
await until(() => frameOf('Paper.pdf'));
await sleep(kase.surface === 'embed' ? 6000 : 3500);
// The other device: a different version, written unguarded.
{
	const theirs = await diskBytes();
	const marked = new Uint8Array([...theirs, ...new TextEncoder().encode(`\n${MARK}\n`)]);
	await ipc.invoke('clew:pdf-write', { path: 'Paper.pdf', bytes: marked });
}
// This viewer annotates; its autosave (2.5 s) is refused.
await annotate('MINE');
await until(() => sheet(), 12000);
const history = await ipc.invoke('clew:history-list', { path: 'Paper.pdf' }).catch(() => []);
log(`refused sheet=${Boolean(sheet())} disk=${hasMark(await diskBytes()) ? 'theirs' : 'mine'} history=${history.length} buttons=${JSON.stringify([...(sheet()?.querySelectorAll('button') ?? [])].map((b) => b.textContent))}`);

// `gone`: the viewer's tab closed before the choice is made.
if (kase.gone) {
	const tab = workspaceStore.allGroups().flatMap((g) => g.tabs).find((t) => t.path === 'Paper.pdf' || t.path === 'Embed.md');
	if (tab) workspaceStore.closeTab(tab.id, { force: true });
	await sleep(1500);
	log(`gone viewer=${Boolean(frameOf('Paper.pdf'))}`);
}
const choiceSel = kase.choice === 'later' ? '.clew-conflict-sheet button[data-choice="later"]' : `.clew-conflict-sheet button[data-choice="${kase.choice}"]`;
window.__clewSmokeInput = [{ click: { selector: choiceSel } }, { wait: 6000 }, { wait: 6000 }];
(async () => {
	await until(() => !sheet(), 6000);
	await sleep(2500);
	const tree = JSON.stringify(vaultStore.tree ?? []);
	const copyRel = (tree.match(/Paper \(conflict [0-9-]+\)\.pdf/) ?? [null])[0];
	if (kase.choice === 'later') {
		const noticed = Boolean(document.querySelector('.clew-conflict-notice[data-conflict-key="pdf:Paper.pdf"]'));
		await annotate('MINE-AGAIN');
		await sleep(4000);
		log(`later notice=${noticed} disk=${hasMark(await diskBytes()) ? 'theirs' : 'mine'} held=${hasMark(await diskBytes())}`);
		return;
	}
	const disk = hasMark(await diskBytes()) ? 'theirs' : 'mine';
	if (kase.choice === 'both' && !kase.gone) {
		const copy = copyRel ? (hasMark(await diskBytes(copyRel)) ? 'theirs' : 'mine') : 'none';
		const side = workspaceStore.allGroups().some((g) => g.tabs.some((t) => t.path === copyRel)) && workspaceStore.allGroups().length > 1;
		log(`both disk=${disk} copy=${copy} side-by-side=${side} name=${JSON.stringify(copyRel)}`);
		return;
	}
	if (kase.gone || kase.surface === 'embed') {
		log(`${kase.choice} disk=${disk} copy=${copyRel ? (hasMark(await diskBytes(copyRel)) ? 'theirs' : 'mine') : 'none'}`);
		return;
	}
	const list = await annotations();
	log(`${kase.choice} disk=${disk} copy=${copyRel ?? 'none'} viewer-has-mine=${Boolean(list?.some((a) => a.contents === 'MINE'))}`);
	// Afterwards the viewer saves normally: no second conflict.
	const before = await diskBytes();
	await annotate('AFTER');
	await sleep(4500);
	const after = await diskBytes();
	log(`after saves-again=${after.length !== before.length || after.some((b, i) => b !== before[i])} conflict-again=${Boolean(sheet())}`);
})();
