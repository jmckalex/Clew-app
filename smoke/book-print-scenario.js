// The whole-book print PDF (docs/dev/book-mode.md, phase 3: the book as ONE
// preview document, render-service.js#renderBook, printed by print-pdf.js,
// each chapter from a new page, no TeX), by REAL input over `node
// smoke/make-book-vault.mjs <dir> export` (CLEW_SMOKE_VAULT=<dir>/vault
// CLEW_USER_DATA=<dir>/ud CLEW_SMOKE_LOG=1): Signals with Conventions in
// another folder, two chapters embedding an image, and Deception holding a
// second `#` heading (a chapter of its own).
//
//   panel    the Book panel's Build row → `buttons=["PDF","LaTeX","HTML","Print PDF"]`
//   print    a real click on Print PDF → `last="… (reading view).pdf"`
//   document the book document as served (`?book=1` on the master's URL):
//            `sections=3 h1=[…] numbers=["Proposition 1.1","Theorem 2.1"]
//            references=true images=2/2` (each image fetched: the engine's
//            master-relative paths resolve at the master's URL)
//   pdf      `%PDF-` and `pages=N` — a page per break: the master's text,
//            Senders and Receivers, Conventions, Deception, its second
//            heading, the references
//   note     the master's own reading view is untouched: `master-own=… book=false`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-book-print: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const MASTER = 'Books/Signals/Signals.md';
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
for (let i = 0; i < 50 && !vaultStore.index[MASTER]?.book; i++) await sleep(100);
await sleep(600);
const tab = workspaceStore.openNote(MASTER, { newTab: true });
workspaceStore.setTabMode(tab.id, 'source');
workspaceStore.setSidebar('right', { open: true, activeTool: 'book' });
await until(() => document.querySelector('.book-build-button[data-format="print"]'));
log(`panel buttons=${JSON.stringify([...document.querySelectorAll('.book-build-button')].map((b) => b.textContent))}`);

window.__clewSmokeInput = [{ click: { selector: '.book-build-button[data-format="print"]' } }, { wait: 60000 }];

(async () => { try {
	await until(() => /reading view\)\.pdf/.test(document.querySelector('.book-build-last')?.textContent ?? ''), 60000);
	log(`print last=${JSON.stringify(document.querySelector('.book-build-last')?.textContent ?? '')}`);

	const sid = vaultStore.vault.sessionId;
	const base = `clew-preview://vault/${encodeURIComponent(sid)}/${MASTER.split('/').map(encodeURIComponent).join('/')}.html`;
	const html = await (await fetch(`${base}?book=1`)).text();
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const images = [...doc.querySelectorAll('section.jmd-chapter img')].map((img) => new URL(img.getAttribute('src'), `${base}?book=1`).href);
	const loaded = (await Promise.all(images.map((src) => fetch(src).then((r) => r.ok, () => false)))).filter(Boolean).length;
	log(`document sections=${doc.querySelectorAll('section.jmd-chapter').length} h1=${JSON.stringify([...doc.querySelectorAll('section.jmd-chapter h1')].map((h) => h.textContent.trim()))} numbers=${JSON.stringify([...new Set(doc.body.textContent.match(/(?:Proposition|Theorem) \d+\.\d+/g) ?? [])].sort())} references=${Boolean(doc.querySelector('section.jmd-book-references'))} images=${loaded}/${images.length}`);

	const pdf = String(await ipc.invoke('clew:note-read', { path: 'Books/Signals/build/Signals (reading view).pdf' }).then((r) => r?.content ?? r).catch((e) => `ERR ${e.message}`));
	log(`pdf header=${JSON.stringify(pdf.slice(0, 5))} pages=${(pdf.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length} tex-free=true`);

	const own = await (await fetch(base)).text();
	log(`note master-own=${own.length > 0} book=${/class="jmd-chapter"/.test(own)}`);
} catch (err) { log(`error ${err?.message ?? err}`); } })();
