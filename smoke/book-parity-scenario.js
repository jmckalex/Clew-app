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
//           master's page read back: each item's printed @ref and @cref;
//   map     the same build's BOOK MAP (jmarkdown b5c7732, `bookMap: true`:
//           every label as the engine numbered it, in Clew's own shape) held
//           against Clew's label table field by field: number, type and file
//           (as handed to the engine: master-relative) must be equal; kind
//           and line differences are notes (compareMaps says why).
//
// Logs, for each numbering:
//   parity <mode> keys=<n> equal=<n> mismatches=[…] warnings=<n>
//   map <mode> labels=<n> compared=<n> mismatches=[…] notes=[…]
//   numbers <mode> <key>=<number> …   (the engine's, to read by eye)
// The gate passes when every line says mismatches=[] with keys equal to the
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
	const shown = new Map(keys.map((k) => [k, [flat(refDisplay(numbering, k, 'ref').text), flat(refDisplay(numbering, k, 'cref').text)]]));
	return { shown, labels: numbering.labels };
}

/** What the built book prints for each key: [ref, cref]. */
async function engineNumbers() {
	const result = await ipc.invoke('clew:export-book', { master: MASTER, format: 'html', bookMap: true });
	const html = await read(result.outputRel);
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const out = new Map();
	for (const li of doc.querySelectorAll('li')) {
		const m = /^R ([\w-]+): (.*?) ; (.*)$/.exec(flat(li.textContent));
		if (m) out.set(m[1], [m[2], m[3]]);
	}
	return { out, warnings: result.warnings ?? [], map: result.bookMap ?? null };
}

async function compare(mode) {
	const numbers = await clewNumbers();
	if (!numbers) { log(`parity ${mode} error=no book numbering`); return; }
	const clew = numbers.shown;
	const { out: engine, warnings, map } = await engineNumbers();
	const mismatches = [];
	for (const k of keys) {
		const c = clew.get(k);
		const e = engine.get(k);
		if (!e || c[0] !== e[0] || c[1] !== e[1]) mismatches.push(`${k}: clew ${c.join(' ; ')} ≠ engine ${e ? e.join(' ; ') : '(missing)'}`);
	}
	log(`parity ${mode} keys=${keys.length} equal=${keys.length - mismatches.length} mismatches=${JSON.stringify(mismatches)} warnings=${warnings.length}`);
	log(`map ${mode} ${compareMaps(numbers.labels, map)}`);
	log(`numbers ${mode} ${keys.map((k) => `${k}=${engine.get(k)?.[0] ?? '-'}`).join(' ')}`);
	for (const w of warnings) log(`warning ${mode} ${w.path ?? ''}:${w.line ?? ''} ${w.text ?? w}`);
}

/**
 * Clew's label table against the engine's book map, field by field. What the
 * writer sees rests on `number`, `type` (the word @cref prints) and `file`:
 * those must be equal for every label the engine maps, and every label it
 * maps must be Clew's too — `mismatches`. `line` and `kind` are each side's
 * own bookkeeping (where a label inside a theorem lives, a subfigure's kind,
 * a footnote label's line, the master's own lines), and a label Clew knows
 * that prints ?? either way may be missing from the engine's map: those are
 * `notes`, to read, not to fail on (2026-10-10, jmarkdown cf5ed60).
 */
function compareMaps(labels, map) {
	if (!map?.labels) return 'error=no book map from the engine';
	const dir = MASTER.slice(0, MASTER.lastIndexOf('/') + 1);
	const clewFields = (info) => ({
		number: info.status === 'ok' && info.number ? String(info.number) : null,
		type: info.type ?? null,
		file: info.path?.startsWith(dir) ? info.path.slice(dir.length) : info.path,
		kind: info.kind,
		line: info.line ?? null,
	});
	const all = [...new Set([...labels.keys(), ...Object.keys(map.labels)])].sort();
	const mismatches = [];
	const notes = [];
	let compared = 0;
	for (const key of all) {
		const c = labels.has(key) ? clewFields(labels.get(key)) : null;
		const e = map.labels[key] ?? null;
		if (!e) {
			(c.number === null ? notes : mismatches).push(`${key}: not in the engine's map${c.number === null ? ' (?? either way)' : ''}`);
			continue;
		}
		if (!c) { mismatches.push(`${key}: not in Clew's labels`); continue; }
		compared += 1;
		const differ = (fields) => fields.filter((f) => String(c[f]) !== String(e[f] ?? null)).map((f) => `${f} clew ${c[f]} ≠ engine ${e[f] ?? null}`);
		const hard = differ(['number', 'type', 'file']);
		const soft = differ(['kind', 'line']);
		if (hard.length) mismatches.push(`${key}: ${hard.join(', ')}`);
		if (soft.length) notes.push(`${key}: ${soft.join(', ')}`);
	}
	return `labels=${all.length} compared=${compared} mismatches=${JSON.stringify(mismatches)} notes=${JSON.stringify(notes)}`;
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
