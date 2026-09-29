// A tour of everything that reads Clew's preview protocol (clew-preview://),
// for changes to the protocol itself (the 2026-09-29 hardening): one demo
// note per run, opened in reading mode — or a canvas as a canvas tab — named
// in `tour-target.txt` in the vault root. smoke/protocol-tour.sh runs the
// whole list over a scratch copy of the demo vault and prints each run's
// lines; protocol-tour-frame.js reports what rendered inside the note, and
// every console line is kept so a CORS failure shows (grep for "CORS",
// "blocked", "Failed to load", "net::ERR").
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-tour: ' + s);
const raw = await ipc.invoke('clew:note-read', { path: 'tour-target.txt' }).catch(() => null);
const target = String(raw?.content ?? raw ?? '').trim();
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
if (target.endsWith('.canvas')) {
	workspaceStore.openCanvas(target, { newTab: true });
	await sleep(8000);
	const view = document.querySelector('.canvas-view');
	const text = [...(view?.querySelectorAll('.canvas-node-text') ?? [])];
	log(`${target} canvas nodes=${view?.querySelectorAll('.canvas-node').length ?? 0} text-cards=${text.length} rendered=${text.filter((n) => n.textContent.trim().length > 0).length} frames=${view?.querySelectorAll('iframe').length ?? 0}`);
} else {
	const tab = workspaceStore.openNote(target, { newTab: true, defaultMode: 'reading' });
	workspaceStore.setTabMode(tab.id, 'reading');
	await sleep(9000);   // render, then maps, figures, PDF viewers, canvas scenes
	log(`${target} opened`);
}
