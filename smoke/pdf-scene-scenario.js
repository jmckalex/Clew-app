// A PDF on a canvas embedded in a note (item 15): the scene shows it in the
// standard viewer page (pdf-page.html), two frames under the app page, and
// its annotations reach the file through window.top — both the autosave and
// the flush when the window closes with an edit pending (pdf-frames.js finds
// a dirty viewer however deep). Two runs over ONE fixture:
//
//   node smoke/make-pdf-vault.mjs <dir> && node -e "require('fs').writeFileSync('<dir>/Board.canvas',
//     JSON.stringify({nodes:[{id:'p',type:'file',file:'Paper.pdf',x:0,y:0,width:520,height:640}],edges:[]}))"
//   && printf '# Host\n\n![[Board.canvas]]\n' > <dir>/Host.md
//
//   1. with CLEW_SMOKE_CLOSE_WINDOW=1: `viewer=true` (a viewer page answered
//      from inside the scene), one highlight made and `autosaved=true` (its
//      dirty report went clean — the save went through the relay), then a
//      second made and the scenario returns at once — the harness closes
//      the window (`smoke-windows: 0`), which must wait for that edit.
//   2. without it: `scene kept=2/2` (read from the file through a PDF tab).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, pdfAnnotations } = window.__clew;
const log = (s) => console.log('smoke-ps: ' + s);
const until = async (test, ms) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (test()) return true;
	return false;
};
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const existing = (await pdfAnnotations.listAnnotations('Paper.pdf').catch(() => []))
	.filter((a) => a.kind === 'highlight').length;
if (existing > 0) {
	log(`scene kept=${existing}/2`);
} else {
	// (listAnnotations opened a PDF tab to read the file; the scene gets its own.)
	const t = workspaceStore.openNote('Host.md', { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(t.id, 'reading');
	const note = () => [...document.querySelectorAll('clew-preview-view')].find((v) => v.tabId === t.id)?.querySelector('iframe')?.contentWindow;
	// Every frame inside the note; the viewer page is the one that answers.
	const nested = () => {
		const w = note();
		const out = [];
		try { for (let i = 0; w && i < w.frames.length; i++) out.push(w.frames[i]); } catch { /* not yet */ }
		return out;
	};
	const dirtyBy = new Map();
	let viewerWin = null;
	window.addEventListener('message', (e) => {
		if (e.data?.source === 'clew-pdf' && e.data.type === 'pdf-dirty') dirtyBy.set(e.source, e.data.dirty);
	});
	const make = (specs) => new Promise((resolve) => {
		const on = (e) => {
			if (e.data?.type !== 'test-created') return;
			window.removeEventListener('message', on);
			viewerWin = e.source;
			resolve(e.data.made);
		};
		window.addEventListener('message', on);
		for (const w of nested()) w.postMessage({ source: 'clew-preview-host', type: 'test-create-annotations', specs }, '*');
		setTimeout(() => { window.removeEventListener('message', on); resolve(-1); }, 4000);
	});
	let made = -1;
	for (const t0 = Date.now(); Date.now() - t0 < 30000 && made < 1; await sleep(1000)) {
		made = await make([{ kind: 'highlight', page: 1, match: 'Morality evolves' }]);
	}
	log(`viewer=${Boolean(viewerWin)} nested=${Boolean(viewerWin && viewerWin.parent !== window)} made=${made}`);
	await until(() => dirtyBy.get(viewerWin) === true, 3000);
	const autosaved = await until(() => dirtyBy.get(viewerWin) === false, 8000);
	log(`autosaved=${autosaved}`);
	const second = await make([{ kind: 'highlight', page: 3, match: 'Signals acquire' }]);
	log(`made=${second} (pending when the window closes)`);
}
