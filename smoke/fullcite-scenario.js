// `\fullcite{…}` in live edit draws the FULL entry inline, as reading mode
// does — not a pill (widgets/fullcite.js; the owner, 2026-10-01). Fixture:
// `smoke/make-cite-vault.sh <dir>`: Cites.md's J (one key), K (two) and L
// (unknown) under chicago, Plain.md's E under vancouver.
//
// Expect, per \fullcite: `first …` the local entry while the engine's is on
// its way ("Akerlof and Kranton 2000. Economics and Identity."); then
// `equal=true italics=1/1` against reading mode's own document (K: 2/2),
// `lines=N stable=true` (its line a whole number of prose lines — it wraps
// like prose, no chip box); L `missing=true`, the key in red (reading mode
// draws nothing for it); Plain.md's E `[2]`, equal (a numeric style renders
// \fullcite as its number). Then the cursor into J: `reveal widget-gone=true
// source-shown=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const fulls = () => [...document.querySelectorAll('.cm-editor .le-fullcite')];

async function reading(note) {
	const url = `clew-preview://vault/${vaultStore.vault.sessionId}/${note}.html`;
	const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html');
	// The \fullcite paragraphs: Cites.md's J, K, L; Plain.md's E.
	const mine = note === 'Plain.md' ? /^E / : /^[JKL] /;
	return [...doc.querySelectorAll('p')].filter((p) => mine.test(clean(p.textContent)))
		.map((p) => {
			const el = p.querySelector('.fullcite, [data-bibtex]');
			return el ? { text: clean(el.textContent), italics: el.querySelectorAll('i, em').length } : { text: '', italics: 0 };
		});
}

for (const note of ['Cites.md', 'Plain.md']) {
	const tab = workspaceStore.openNote(note, { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(tab.id, 'live');
	for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(20);
	const view = editorPool.get(tab.id).view;
	// The cursor at the very end, out of every construct.
	view.dispatch({ selection: { anchor: view.state.doc.length } });
	for (let i = 0; i < 100 && !fulls().length; i++) await sleep(20);
	console.log(`smoke-fc: ${note} first ${JSON.stringify(fulls().map((f) => clean(f.textContent)))}`);
	let last = ''; let quiet = 0;
	for (let i = 0; i < 200 && quiet < 30; i++) {
		await sleep(50);
		const now = fulls().map((f) => f.innerHTML).join('|');
		quiet = now === last ? quiet + 1 : 0;
		last = now;
	}
	const want = await reading(note);
	// One prose line, for scale: a line holding nothing but text.
	const base = [...document.querySelectorAll('.cm-editor .cm-line')].find((l) => /^[A-Z] .* here\.$/.test(clean(l.textContent)) && !l.querySelector('.le-fullcite'));
	const unit = base?.getBoundingClientRect().height ?? 0;
	fulls().forEach((f, i) => {
		const line = f.closest('.cm-line');
		const h = line.getBoundingClientRect().height;
		const lines = h / unit;
		const w = want[i] ?? { text: '', italics: 0 };
		const text = clean(f.textContent);
		const missing = f.classList.contains('le-cite-missing');
		console.log(`smoke-fc: ${note} ${i} ${JSON.stringify(text.slice(0, 70))} equal=${text === w.text} italics=${f.querySelectorAll('i, em').length}/${w.italics} missing=${missing} lines=${lines.toFixed(2)} stable=${Math.abs(lines - Math.round(lines)) < 0.05}`);
	});
	if (note === 'Cites.md') {
		const before = fulls().length;
		const at = view.state.doc.toString().indexOf('\\fullcite{Akerlof') + 3;
		view.dispatch({ selection: { anchor: at } });
		await sleep(300);
		const lineText = clean(view.domAtPos(at).node.parentElement?.closest('.cm-line')?.textContent ?? '');
		console.log(`smoke-fc: reveal widget-gone=${fulls().length === before - 1} source-shown=${lineText.includes('\\fullcite{Akerlof/Kranton:2000}')}`);
	}
}
