// Building a book (docs/dev/book-mode.md §5; main/export-book.js, the Book
// panel's Build row), by REAL input, over `node smoke/make-book-vault.mjs
// <dir> export` (CLEW_SMOKE_VAULT=<dir>/vault CLEW_USER_DATA=<dir>/ud):
// Signals' Deception.md carries a second # heading, which the engine warns
// about AT ITS LINE in that chapter.
//
// The master opened, the Book panel shown; its Build buttons clicked — HTML,
// LaTeX, then PDF — each logging `smoke-book-export: last=…` as the panel
// reports it. Then, from the files in build/ beside the master: the HTML's
// chapter sections and headings, no chapter's front matter as content; the
// .tex's \chapter lines; the PDF's presence; the numbers (`numbers html=
// ["Proposition 1.1","Theorem 2.1"] tex-within=true` per chapter, the
// master's own policy — `numbering: continuous` gives 1 and 2 and
// \counterwithout). Then the panel's ⚠ clicked and
// the list logged (`warnings=[…]`, each with its chapter:line), filtered by
// typing "level-1" and its first row clicked → `opened=<chapter> line=<n>
// text=<that line>` — the chapter at the line the warning names.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, editorPool } = window.__clew;
const log = (s) => console.log('smoke-book-export: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const read = async (p) => String(await ipc.invoke('clew:note-read', { path: p }).then((r) => r?.content ?? r).catch((e) => `ERR ${e.message}`));
for (let i = 0; i < 50 && !Object.keys(vaultStore.index).length; i++) await sleep(100);
await sleep(800);
const MASTER = 'Books/Signals/Signals.md';
const tab = workspaceStore.openNote(MASTER, { newTab: true });
workspaceStore.setTabMode(tab.id, 'source');
workspaceStore.setSidebar('right', { open: true, activeTool: 'book' });
await sleep(1500);
log(`panel=${!!document.querySelector('clew-book .book-build')} buttons=${JSON.stringify([...document.querySelectorAll('.book-build-button')].map((b) => `${b.textContent}${b.disabled ? '(off)' : ''}`))}`);

(async () => {
	let last = '';
	const end = Date.now() + 150000;
	while (Date.now() < end) {
		const now = document.querySelector('.book-build-last')?.textContent ?? '';
		if (now && now !== last) { log(`last=${JSON.stringify(now)}`); last = now; }
		if (/\.pdf/.test(now)) break;
		await sleep(300);
	}
	const html = await read('Books/Signals/build/Signals.html');
	const tex = await read('Books/Signals/build/Signals.tex');
	log(`html sections=${(html.match(/<section class="jmd-chapter"/g) ?? []).length} h1=${JSON.stringify([...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()))} front-matter-as-content=${/status: (done|revised|draft)/.test(html)}`);
	log(`numbers html=${JSON.stringify([...new Set(html.match(/(?:Proposition|Theorem) [0-9.]+/g) ?? [])])} tex-within=${/numberwithin=chapter/.test(tex)} tex-without=${/\\counterwithout\{equation\}\{chapter\}/.test(tex)}`);
	log(`tex chapters=${JSON.stringify([...tex.matchAll(/\\chapter\*?\{([^}]*)\}/g)].map((m) => m[1]))} front-matter-as-content=${/status: (done|revised|draft)/.test(tex)}`);
	const tree = vaultStore.allPaths?.() ?? [];
	log(`build-files=${JSON.stringify(tree.filter((p) => p.startsWith('Books/Signals/build/') && /\.(html|tex|pdf)$/.test(p)).sort())}`);
	for (let i = 0; i < 400 && !document.querySelector('.clew-modal .modal-result'); i++) await sleep(250);
	log(`warnings=${JSON.stringify([...document.querySelectorAll('.clew-modal .modal-result')].map((r) => `${r.querySelector('.result-hint')?.textContent ?? ''} ${r.querySelector('.result-label')?.textContent ?? ''}`))}`);
	for (let i = 0; i < 60 && document.querySelector('.clew-modal'); i++) await sleep(250);   // the filter typed, a row chosen
	await sleep(1500);
	const active = workspaceStore.activeTab();
	const view = editorPool.get(active?.id)?.view;
	const line = view ? view.state.doc.lineAt(view.state.selection.main.head) : null;
	log(`opened=${active?.path} line=${line?.number ?? '-'} text=${JSON.stringify(line?.text ?? null)}`);
})();

window.__clewSmokeInput = [
	{ click: { selector: '.book-build-button[data-format="html"]' } }, { wait: 25000 },
	{ click: { selector: '.book-build-button[data-format="latex"]' } }, { wait: 25000 },
	{ click: { selector: '.book-build-button[data-format="pdf"]' } }, { wait: 70000 },
	{ click: { selector: '.book-build-last .book-warn' } }, { wait: 800 },
	{ wait: 1500 }, { text: 'level-1' }, { wait: 500 },
	{ click: { selector: '.clew-modal .modal-result' } }, { wait: 3000 },
];
