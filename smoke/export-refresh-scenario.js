// Every Clew path that writes a NEW file into the vault shows it in the
// explorer at once, whether or not the watcher ever reports it (the owner's
// PDF exported into ph341, 2026-09-30: invisible for 6+ minutes). Run with the
// watch budget FORCED spent, so the watcher sees nothing new:
//
//   mkdir -p <dir>/Notes && for i in $(seq 1 30); do printf '# Note %s\n\nText.\n' $i > "<dir>/Notes/Note $i.md"; done
//   CLEW_WATCH_BUDGET=10 … CLEW_SMOKE_VAULT=<dir>
//   and, from the runner, 6 s after launch: echo x > "<dir>/External.md"
//
// First the CONTROL, checked before Clew writes anything (every refresh walks
// the disk, so any later one would show the file too): `external
// visible=false` — the watcher really is blind, so what follows is not the
// watcher's doing (without CLEW_WATCH_BUDGET it reads `visible=true`). Then
// one `ok=true` per path — export html / print-pdf / latex, the website, a
// canvas PNG, an attachment, a new note written, clewdata.json.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(3000);   // chokidar's ready, and the cap notice
console.log(`smoke-er: capped=${!!vaultStore.vault?.watchCap || !!(await ipc.invoke('clew:vault-current'))?.watchCap}`);
// The control: written by the runner at 6 s; give the watcher until 14 s.
await sleep(Math.max(0, 14000 - performance.now()));
console.log(`smoke-er: external visible=${vaultStore.pathExists('External.md')}`);

async function shows(label, path, act) {
	const before = vaultStore.pathExists(path);
	const t0 = performance.now();
	await act();
	let ms = -1;
	for (let t = 0; t < 3000; t += 50) {
		if (vaultStore.pathExists(path)) { ms = Math.round(performance.now() - t0); break; }
		await sleep(50);
	}
	console.log(`smoke-er: ${label} ok=${!before && ms >= 0} ms=${ms}`);
}

await shows('export-html', 'Exported Note 1.html',
	() => ipc.invoke('clew:export-note', { path: 'Notes/Note 1.md', format: 'html', outFile: 'Exported Note 1.html' }));
await shows('export-print-pdf', 'Exports/Note 2.pdf',
	() => ipc.invoke('clew:export-note', { path: 'Notes/Note 2.md', format: 'print-pdf', outFile: 'Exports/Note 2.pdf' }));
await shows('export-latex', 'Exports/Note 3.tex',
	() => ipc.invoke('clew:export-note', { path: 'Notes/Note 3.md', format: 'latex', outFile: 'Exports/Note 3.tex' }));
await shows('export-site', 'Site/Notes/Note 4.html',
	() => ipc.invoke('clew:export-site', { outDir: `${vaultStore.vault.path ?? vaultStore.vault.root}/Site` }));
await shows('canvas-png', 'Drawing.png',
	() => ipc.invoke('clew:canvas-export-png', { data: btoa('\x89PNG\r\n'), filePath: `${vaultStore.vault.path ?? vaultStore.vault.root}/Drawing.png` }));
await shows('attachment', 'Attachments/pasted.png',
	() => ipc.invoke('clew:attach-save', { name: 'pasted.png', data: new Uint8Array([137, 80, 78, 71]) }));
await shows('note-write', 'Annotations/New note.md',
	() => ipc.invoke('clew:note-write', { path: 'Annotations/New note.md', content: '# New\n' }));
await shows('kv-first', 'clewdata.json', async () => {
	await ipc.invoke('clew:kv-set', { key: 'x', value: 1 });
	await sleep(1500);   // the store's save debounce
});
