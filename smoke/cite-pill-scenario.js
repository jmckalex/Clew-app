// A citation pill in live edit reads what READING MODE shows for it — the
// engine's own text (editor/live/cite-text.js), not a label made up here
// (the owner's report 2026-10-01: \cite{Akerlof/Kranton:2000} read "Kranton
// 2000"). Fixture: `smoke/make-cite-vault.sh <dir>` — Cites.md (a chicago
// header, every form) and Plain.md (no header: the vault's bibliography in
// vancouver, a numeric style).
//
// Per note: `<note> t=… [ … ]` each time the pills change — the LOCAL
// labels (cite-label.js) first, then the engine's texts — and, once they
// settle, one `pill i … reading … equal=` line against reading mode's own
// document (fetched like the reading view's frame). Expect equal=true for
// every citation that resolves (Plain.md's `[1]`, `[2]`, `[1,3]` too).
// Each note's last key is unknown, so its pill reads `nosuchkey` with
// `missing=true` while reading mode shows the command as written (chicago)
// or `[undefined]` (vancouver, an engine quirk). Then
// refs.bib is edited (lewis1969 → 1970) with Cites.md open: its four
// Lewis pills follow (`followed=true`), the local labels standing in between
// rather than bare keys. Last, Cites.md's OWN `Bibliography style` changed in
// its editor (chicago → vancouver, a note in no book): its pills follow and
// equal reading mode again (`own-style followed=true`, every pill
// `equal=true` but the unknown key) — until cite-text.js waited for the
// header's auto-save, the ask raced it and the old style stayed (2026-10-10).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const pills = () => [...document.querySelectorAll('.cm-editor .le-cite')];

async function readingTexts(path) {
	const url = `clew-preview://vault/${vaultStore.vault.sessionId}/${path.split('/').map(encodeURIComponent).join('/')}.html`;
	const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html');
	return [...doc.querySelectorAll('p')].filter((p) => / here\.$/.test(clean(p.textContent))).map((p) => {
		const span = p.querySelector('[data-bibtex]');
		return span ? clean(span.textContent) : clean(p.textContent).replace(/^\w /, '').replace(/ here\.$/, '');
	});
}

/** Log each change of the pills until they have been still for 2 s. */
async function watch(note) {
	const t0 = performance.now();
	let last = '';
	let quiet = 0;
	for (let i = 0; i < 400 && quiet < 40; i++) {
		await sleep(50);
		const now = JSON.stringify(pills().map((p) => p.textContent));
		if (now !== last && pills().length) console.log(`smoke-ct: ${note} t=${Math.round(performance.now() - t0)} ${now}`);
		quiet = now === last ? quiet + 1 : 0;
		last = now;
	}
}
async function compare(note) {
	const reading = await readingTexts(note);
	pills().forEach((p, i) => console.log(`smoke-ct: ${note} pill ${i} "${p.textContent}" reading "${reading[i]}" equal=${p.textContent === reading[i]} missing=${p.classList.contains('le-cite-missing')}`));
}

for (const note of ['Plain.md', 'Cites.md']) {
	const tab = workspaceStore.openNote(note, { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(tab.id, 'live');
	await watch(note);
	await compare(note);
}

// A .bib edited while Cites.md is open: its pills follow (cite-text.js drops
// its texts on the file change; fragment-deps.js retires the server's block).
const { ipc } = window.__clew;
const bib = await ipc.invoke('clew:note-read', { path: 'refs.bib' });
await ipc.invoke('clew:note-write', { path: 'refs.bib', content: String(bib.content ?? bib).replace('year = {1969}', 'year = {1970}') });
console.log('smoke-ct: bib-edited lewis1969 → 1970');
await watch('Cites.md');
// Reading mode itself does NOT follow a .bib edit — a note re-renders only
// when it changes (render-service.js), a separate, older staleness — so the
// pills are checked for the new year rather than against it.
const after = pills().map((p) => p.textContent);
console.log(`smoke-ct: after-edit lewis=${JSON.stringify(after.filter((t) => /Lewis|^19/.test(t)))} followed=${after.filter((t) => /1970/.test(t)).length === 4 && !after.some((t) => /1969/.test(t))}`);

// The note's own style, changed in its editor (cite-text.js#headerSaved).
const { editorPool } = window.__clew;
const citesTab = workspaceStore.activeTab();
const view = editorPool.get(citesTab.id)?.view;
const before = pills().map((p) => p.textContent);
const at = view.state.doc.toString().indexOf('Bibliography style: chicago');
view.dispatch({ changes: { from: at, to: at + 'Bibliography style: chicago'.length, insert: 'Bibliography style: vancouver' } });
console.log('smoke-ct: own-style chicago → vancouver (in the editor)');
const t0 = performance.now();
for (let i = 0; i < 200 && JSON.stringify(pills().map((p) => p.textContent)) === JSON.stringify(before); i++) await sleep(50);
await watch('Cites.md');
const own = pills().map((p) => p.textContent);
console.log(`smoke-ct: own-style after=${Math.round(performance.now() - t0)}ms followed=${own.some((t) => /^\[\d/.test(t)) && !own.some((t) => /\(\d{4}\)|\d{4}\)$/.test(t))}`);
await compare('Cites.md');
