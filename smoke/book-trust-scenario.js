// A book built in a RESTRICTED vault and in a trusted one (docs/dev/
// book-mode.md §5; frame-bridge.md §4), over `node smoke/make-book-vault.mjs
// <dir> trust`: CLEW_SMOKE_VAULT=<dir>/vault with CLEW_USER_DATA=<dir>/ud (a
// fresh userData: restricted, undecided) or <dir>/ud-trusted (the vault
// known: trusted). Signals has a fourth chapter, Code.md, with code the
// ENGINE runs (a jmarkdown script block; Math.max, calc, math.sqrt in prose)
// and an inline <script> the engine passes through.
//
// The panel's Build HTML clicked TWICE (the second build moves the first's
// pages to the Trash — main logs `smoke-trash: Books/Signals/build/Signals`).
// Logged: `trusted=`; the Code chapter's page — `refused=[…]` (the engine's
// in-place markers), `script-ran=`, `inline-script=` (present in the page
// source either way); the SAME note exported alone as HTML through the
// ordinary note export — `single refused=[…]`, which a book build must match;
// and the notice. Main logs what happened to the pages: `smoke-open-path:
// …/index.html` (trusted: the browser) or `smoke-reveal: …/index.html`
// (restricted: Finder, never the browser).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-book-trust: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const read = async (p) => String(await ipc.invoke('clew:note-read', { path: p }).then((r) => r?.content ?? r).catch((e) => `ERR ${e.message}`));
for (let i = 0; i < 50 && !Object.keys(vaultStore.index).length; i++) await sleep(100);
await sleep(800);
const trust = await ipc.invoke('clew:vault-trust-get').catch(() => null);
log(`trusted=${trust?.trusted ?? '?'}`);
const tab = workspaceStore.openNote('Books/Signals/Signals.md', { newTab: true });
workspaceStore.setTabMode(tab.id, 'source');
workspaceStore.setSidebar('right', { open: true, activeTool: 'book' });
await sleep(1500);

const facts = (html) => ({
	refused: [...html.matchAll(/data-jmd-refused="([^"]*)"/g)].map((m) => m[1]),
	ran: ['SCRIPT-RAN', '>41<', ' 41 ', '42', 'INLINE-RAN'].filter((s) => s !== 'INLINE-RAN' && html.includes(s)),
	inline: html.includes("dataset.inline = 'INLINE-RAN'"),
});
(async () => {
	// Both builds land within the queue's waits; every "Built …" notice is
	// caught while it is up (they leave after 6–12 s).
	const seen = new Set();
	for (const end = Date.now() + 46000; Date.now() < end; await sleep(250)) {
		for (const n of document.querySelectorAll('.clew-notice')) if (/^Built /.test(n.textContent.trim())) seen.add(n.textContent.trim());
	}
	log(`last=${JSON.stringify(document.querySelector('.book-build-last')?.textContent ?? null)} notices=${JSON.stringify([...seen])}`);
	const page = facts(await read('Books/Signals/build/Signals/Code.html'));
	log(`book refused=${JSON.stringify(page.refused)} ran=${JSON.stringify(page.ran)} inline-script=${page.inline}`);
	const single = await ipc.invoke('clew:export-note', { path: 'Books/Signals/Code.md', format: 'html', outFile: 'xn/code.html' }).catch((e) => ({ error: e.message }));
	const alone = facts(await read('xn/code.html'));
	log(`single refused=${JSON.stringify(alone.refused)} ran=${JSON.stringify(alone.ran)} inline-script=${alone.inline} warnings=${single.warnings?.filter((w) => /not run/.test(w)).length ?? single.error}`);
})();

window.__clewSmokeInput = [
	{ click: { selector: '.book-build-button[data-format="html"]' } }, { wait: 20000 },
	{ click: { selector: '.book-build-button[data-format="html"]' } }, { wait: 30000 },
];
