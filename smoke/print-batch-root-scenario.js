// "Export notes as PDF (reading view)" into the VAULT'S OWN ROOT, over a PDF
// of the same name (the owner's report, 2026-11-26, on dev.22: Replace sent
// the old PDF to the Trash and wrote the new one, and the explorer did not
// show it). The batch refreshed the explorer with vault.js#refreshIfInside
// (its folder), which took the root itself for "outside"; and the watcher
// never said so either — the old file trashed and the new one written at its
// path within moments is one `change` to chokidar, not an unlink and an add.
// The trash had refreshed the explorer already, between the two.
//
// Writes its own notes into any empty vault. Run with CLEW_SMOKE_VAULT=<it>,
// CLEW_SMOKE_EXPORT_DIR=<the same folder> (the folder dialog's answer),
// CLEW_SMOKE_LOG=1 and a CLEW_USER_DATA of its own. Each export names its
// answer to the "already exist" question itself.
// Logs (smoke-print-batch-root:):
//   before rows=["Essay.md","Essay.pdf"]
//   replace written=["Essay.pdf"] replaced=1 row=true pdf=true
//          the explorer's Essay.pdf row as the export returns, then the file
//          on disk a PDF (no longer the stand-in's text)
//   keep written=["Essay 2.pdf"] row=true
//          Keep Both: a new name in the root
// and main's `smoke-trash: Essay.pdf`. Before the fix, `row=false` in the
// replace line, and still false 3 s later (`replace-later row=false`).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { ipc } = window.__clew;
const log = (s) => console.log('smoke-print-batch-root: ' + s);
const row = (p) => Boolean(document.querySelector(`.tree-item[data-path="${CSS.escape(p)}"]`));
const rows = () => [...document.querySelectorAll('.tree-item[data-path]')].map((el) => el.dataset.path);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'Essay.md', content: '# Essay\n\nA short essay, KEPT.\n' });
await ipc.invoke('clew:note-write', { path: 'Essay.pdf', content: 'an older export (a stand-in)\n' });
await until(() => row('Essay.md') && row('Essay.pdf'));
log(`before rows=${JSON.stringify(rows())}`);

const replaced = await ipc.invoke('clew:export-notes-print', { paths: ['Essay.md'], existing: 'replace' });
await sleep(50);
const pdf = await ipc.invoke('clew:note-read', { path: 'Essay.pdf' }).then((t) => String(t?.content ?? t).startsWith('%PDF-'), () => 'unreadable');
log(`replace written=${JSON.stringify(replaced.written)} replaced=${replaced.replaced} row=${row('Essay.pdf')} pdf=${pdf}`);
if (!row('Essay.pdf')) {
	await sleep(3000);
	log(`replace-later row=${row('Essay.pdf')}`);
}

const kept = await ipc.invoke('clew:export-notes-print', { paths: ['Essay.md'], existing: 'keep' });
await sleep(50);
log(`keep written=${JSON.stringify(kept.written)} row=${row('Essay 2.pdf')}`);
