// Reading mode follows a .bib edit (render-service.js#onFileChanged,
// main/citation-header.js#noteBibFiles; 2026-10-01 — before, a note
// re-rendered only when IT changed, so its citations kept the old entry).
// Fixture: `smoke/make-cite-vault.sh <dir>`; run with
// CLEW_SMOKE_FRAME_SCRIPT=smoke/bib-reading-frame.js CLEW_SMOKE_FRAME_MATCH=vault/.
// Two previews side by side: Cites.md (its header names refs.bib) and
// Later.md (written here: no header — the VAULT's bibliography — citing
// lewis1969 and a key refs.bib does not have yet). Then refs.bib is edited:
// lewis1969's year → 1970, and `later2020` added. Each frame then prints
// its citations: Cites.md `Lewis (1970)` …, Later.md `[1]` `[2]` (the new
// key resolved — it was `\cite{later2020}` as written).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc, registry } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
await ipc.invoke('clew:note-write', { path: 'Later.md', content: '# Later\n\nA \\cite{lewis1969} here.\n\nB \\cite{later2020} here.\n' });
await sleep(500);
const left = workspaceStore.openNote('Cites.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(left.id, 'reading');
registry.runCommand('workspace:split-right');
await sleep(400);
const right = workspaceStore.openNote('Later.md', { newTab: false, defaultMode: 'reading' });
workspaceStore.setTabMode(right.id, 'reading');
await sleep(5000);
const bib = await ipc.invoke('clew:note-read', { path: 'refs.bib' });
const text = String(bib.content ?? bib).replace('year = {1969}', 'year = {1970}')
	+ '\n@Article{later2020,\n  author = {Later, Lou},\n  title = {After the Fact},\n  journal = {Journal of Hindsight},\n  year = {2020}\n}\n';
await ipc.invoke('clew:note-write', { path: 'refs.bib', content: text });
console.log('smoke-br2: bib-edited lewis1969 → 1970, later2020 added');
await sleep(6000);
