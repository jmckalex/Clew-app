// Quote-and-cite cites the page the article PRINTS (shared/pdf-quote.js#
// printedPage) — over `node smoke/make-printed-vault.mjs <dir> <a.pdf>:2,3 …`
// (real PDFs, copied). For each PDF and page: ~20 characters of the page are
// selected (EmbedPDF's own setSelection, through the viewer's scenario hook),
// quoted into Draft.md, and the citation line read back:
//   `printed: Papers/x.pdf pdf=2 → \cite[p. 268]{p3} · [[x.pdf#page=2|PDF p. 2]] | <notice>`
// Then "PDF: set the printed page number…" on the FIRST PDF, at its first
// listed page, by REAL input: 100 + Enter → that page quotes as p. 100 and the
// next as p. 101 (`manual: first=true next=true`); emptied + Enter → back to
// what the PDF says (`cleared: manual-gone=true back=true`).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, actions, registry, ipc } = window.__clew;
const log = (s) => console.log('smoke-pp: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const lastNotice = () => [...document.querySelectorAll('.clew-notice')].map((n) => n.textContent).pop() ?? '';
const list = JSON.parse(await ipc.invoke('clew:note-read', { path: 'printed.json' }));

const draft = workspaceStore.openNote('Draft.md', { defaultMode: 'live' });
workspaceStore.setTabMode(draft.id, 'live');
await until(() => editorPool.get(draft.id)?.view);
const view = () => editorPool.get(draft.id).view;
const text = () => view().state.doc.toString();
actions.splitActive('right');
const right = workspaceStore.activeGroupId;
const openRight = (path) => { workspaceStore.setActiveGroup(right); return workspaceStore.openFile(path); };
await sleep(800);
{
	const at = text().length;
	view().focus();
	view().dispatch({ selection: { anchor: at } });
	view().dom.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
}

const frameOf = (path) => [...document.querySelectorAll('clew-file-view')].find((v) => v.path === path)?.querySelector('iframe.pdf-frame')?.contentWindow;
const select = (win, page) => new Promise((resolve) => {
	const on = (e) => {
		if (e.source !== win || e.data?.type !== 'test-selected') return;
		window.removeEventListener('message', on);
		resolve(e.data.ok);
	};
	window.addEventListener('message', on);
	win.postMessage({ source: 'clew-pdf-host', type: 'test-select-text', page, match: { index: 40, length: 20 } }, '*');
	setTimeout(() => { window.removeEventListener('message', on); resolve(null); }, 4000);
});
const selectIn = async (path, page) => {
	for (let i = 0; i < 60; i++) {
		const win = frameOf(path);
		if (win && await select(win, page)) return true;
		await sleep(500);
	}
	return false;
};
/** Quote `page` of `path`; the citation line that went in, or null. */
const quoteFrom = async (path, page) => {
	const ok = await selectIn(path, page);
	if (!ok) return { line: null, notice: 'could not select' };
	const before = text();
	await registry.runCommand('pdf:quote-selection');
	await until(() => text() !== before, 6000);
	const name = path.split('/').pop();
	const line = text().split('\n').reverse().find((l) => l.includes(`[[${name}#page=${page}|`)) ?? null;
	return { line, notice: lastNotice() };
};

for (const { path, pages } of list) {
	openRight(path);
	for (const page of pages) {
		const { line, notice } = await quoteFrom(path, page);
		log(`printed: ${path} pdf=${page} → ${line} | ${notice}`);
	}
}

// ---- the printed page set by hand, by real input ----
const first = list[0];
const page = first.pages[0];
const tab = openRight(first.path);
actions.showPdfPage(tab.id, page);
await sleep(2500);
registry.runCommand('pdf:set-printed-page');
await until(() => document.querySelector('.clew-modal .modal-input'), 5000);
log(`modal: shown=${Boolean(document.querySelector('.clew-modal .modal-input'))} placeholder=${JSON.stringify(document.querySelector('.clew-modal .modal-input')?.placeholder ?? '')} value=${JSON.stringify(document.querySelector('.clew-modal .modal-input')?.value ?? '')} hint=${JSON.stringify(document.querySelector('.clew-modal .modal-hint')?.textContent ?? '')}`);
window.__clewSmokeInput = [
	{ text: '100' },
	{ combo: { key: 'Enter', text: '\r' } },
	// Room for the steps below, which run while the harness waits.
	{ wait: 15000 },
];
(async () => {
	await until(() => !document.querySelector('.clew-modal'), 8000);
	await sleep(500);
	const meta = await ipc.invoke('clew:pdf-meta-get', { path: first.path }).catch((e) => String(e));
	log(`stored: ${JSON.stringify(meta)} notice=${JSON.stringify(lastNotice())}`);
	const a = await quoteFrom(first.path, page);
	const b = await quoteFrom(first.path, page + 1);
	log(`manual: first=${/\[p\. 100\]/.test(a.line ?? '')} next=${/\[p\. 101\]/.test(b.line ?? '')} | ${a.line} | ${b.line}`);
	// Emptied: the number set by hand is forgotten, and what the PDF says
	// is cited again (a synthetic Enter — real input proved the modal above).
	const before = await quoteFrom(first.path, page);
	registry.runCommand('pdf:set-printed-page');
	await until(() => document.querySelector('.clew-modal .modal-input'), 5000);
	document.querySelector('.clew-modal .modal-input').value = '';
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	await until(() => !document.querySelector('.clew-modal'), 3000);
	await sleep(300);
	const metaAfter = await ipc.invoke('clew:pdf-meta-get', { path: first.path }).catch(() => null);
	const c = await quoteFrom(first.path, page);
	log(`cleared: manual-gone=${metaAfter?.offsetSource !== 'manual'} back=${c.line !== before.line && !/\[p\. 100\]/.test(c.line ?? '')} | ${c.line} | ${JSON.stringify(lastNotice())}`);
})();
