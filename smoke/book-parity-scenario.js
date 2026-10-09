// THE GATE of book mode's phase 2 (docs/dev/book-mode.md §3): every label's
// number in Clew's book map equals the number the ENGINE prints when it builds
// the book — per chapter, then continuous. Over `node smoke/make-book-vault.mjs
// <dir> parity` (CLEW_SMOKE_VAULT=<dir>/vault CLEW_USER_DATA=<dir>/ud
// CLEW_SMOKE_LOG=1): Books/Parity, whose master refers to every label in the
// book, one list item each — `R <key>: @ref[key] ; @cref[key]`.
//
//   Clew    the master open in an editor, its numbers asked for exactly as
//           every consumer asks (numbering-source.js#numberingFor), each
//           reference shown as a chip shows it (numbering.js#refDisplay);
//   engine  the book built as HTML (clew:export-book, the panel's Build), the
//           master's page read back: each item's printed @ref and @cref.
//
// Logs, for each numbering:
//   parity <mode> keys=<n> equal=<n> mismatches=[…] warnings=<n>
//   numbers <mode> <key>=<number> …   (the engine's, to read by eye)
// The gate passes when both lines say mismatches=[] with keys equal to the
// fixture's label count.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-parity: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (await test()) return true;
	return false;
};
const read = async (p) => String(await ipc.invoke('clew:note-read', { path: p }).then((r) => r?.content ?? r).catch((e) => `ERR ${e.message}`));
const flat = (s) => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const MASTER = 'Books/Parity/Parity.md';
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
for (let i = 0; i < 80 && !vaultStore.index[MASTER]?.book; i++) await sleep(100);
await until(() => window.__clew.numberingSource && window.__clew.numbering);

const tab = workspaceStore.openNote(MASTER, { newTab: true });
workspaceStore.setTabMode(tab.id, 'source');
await until(() => editorPool.get(tab.id)?.view);
const view = () => editorPool.get(tab.id).view;
const keys = [...view().state.doc.toString().matchAll(/^- R ([\w-]+): /gm)].map((m) => m[1]);

/** What Clew shows for each key: [ref, cref]. */
async function clewNumbers() {
	const { numberingFor } = window.__clew.numberingSource;
	const { refDisplay } = window.__clew.numbering;
	let numbering = null;
	// The book's texts are read asynchronously: the master's own numbers until then.
	await until(() => (numbering = numberingFor(view().state.doc, MASTER))?.book, 10000);
	if (!numbering?.book) return null;
	return new Map(keys.map((k) => [k, [flat(refDisplay(numbering, k, 'ref').text), flat(refDisplay(numbering, k, 'cref').text)]]));
}

/** What the built book prints for each key: [ref, cref]. */
async function engineNumbers() {
	const result = await ipc.invoke('clew:export-book', { master: MASTER, format: 'html' });
	const html = await read(result.outputRel);
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const out = new Map();
	for (const li of doc.querySelectorAll('li')) {
		const m = /^R ([\w-]+): (.*?) ; (.*)$/.exec(flat(li.textContent));
		if (m) out.set(m[1], [m[2], m[3]]);
	}
	return { out, warnings: result.warnings ?? [] };
}

async function compare(mode) {
	const clew = await clewNumbers();
	if (!clew) { log(`parity ${mode} error=no book numbering`); return; }
	const { out: engine, warnings } = await engineNumbers();
	const mismatches = [];
	for (const k of keys) {
		const c = clew.get(k);
		const e = engine.get(k);
		if (!e || c[0] !== e[0] || c[1] !== e[1]) mismatches.push(`${k}: clew ${c.join(' ; ')} ≠ engine ${e ? e.join(' ; ') : '(missing)'}`);
	}
	log(`parity ${mode} keys=${keys.length} equal=${keys.length - mismatches.length} mismatches=${JSON.stringify(mismatches)} warnings=${warnings.length}`);
	log(`numbers ${mode} ${keys.map((k) => `${k}=${engine.get(k)?.[0] ?? '-'}`).join(' ')}`);
	for (const w of warnings) log(`warning ${mode} ${w.path ?? ''}:${w.line ?? ''} ${w.text ?? w}`);
}

try {
	await compare('per-chapter');
	// Continuous numbering, from the master's own header — an edit in its
	// editor, saved, as a writer would make it.
	const doc = view().state.doc.toString();
	const at = doc.indexOf('numbering: per chapter');
	view().dispatch({ changes: { from: at, to: at + 'numbering: per chapter'.length, insert: 'numbering: continuous' } });
	await until(async () => (await read(MASTER)).includes('numbering: continuous'), 8000);
	await compare('continuous');
} catch (err) { log(`error ${err?.message ?? err}`); }
log('done');
