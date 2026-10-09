// The quiet line above a chapter's reading view (docs/dev/book-mode.md §3,
// phase 2; books.js#bookReadingBanner, drawn by clew-preview-view.js on the
// APP page, never in the note's document), over `node smoke/make-book-vault.mjs
// <dir> numbers` (CLEW_SMOKE_VAULT=<dir>/vault CLEW_USER_DATA=<dir>/ud
// CLEW_SMOKE_LOG=1). Conventions is chapter 2 of Signals and chapter 1 of
// Course; Notes/Alone.md is in no book.
//
//   chapter  Conventions in reading view → `banner="Chapter 2 of Signals: A
//            Short Book · numbers as in the book:" button=Build first=true`
//            (the line, then the frame)
//   switch   the book it shows switched to Course → `banner="Chapter 1 of
//            Course · …" frame-loads=0` (the frame never reloads for it)
//   reorder  the master's list rewritten, Conventions first → `banner=
//            "Chapter 1 of Signals: A Short Book · …" frame-loads=0`
//   build    a real click on Build → `built=true` (the book's index.html
//            written; a restricted vault shows it in Finder: main logs
//            `smoke-reveal:`)
//   alone    Notes/Alone.md → `banner=none children=["IFRAME"]`
//   master   Signals.md itself → `banner=none` (a master is no chapter)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-bb: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (await test()) return true;
	return false;
};
const MASTER = 'Books/Signals/Signals.md';
const CONV = 'Books/Signals/Conventions.md';
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
for (let i = 0; i < 50 && !vaultStore.index[MASTER]?.book; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

const openReading = async (path) => {
	const tab = workspaceStore.openNote(path, { newTab: true });
	workspaceStore.setTabMode(tab.id, 'reading');
	await until(() => document.querySelector('clew-preview-view')?.path === path && document.querySelector('clew-preview-view iframe'));
	await sleep(600);
	return document.querySelector('clew-preview-view');
};
const bannerOf = (host) => host.querySelector('.book-reading-banner');
const bannerText = (host) => bannerOf(host)?.querySelector('span')?.textContent ?? 'none';

const host = await openReading(CONV);
const frame = host.querySelector('iframe');
// Counted from the frame's first load on: a reload after it would be the
// banner's doing (a moved iframe reloads).
await new Promise((resolve) => { frame.addEventListener('load', resolve, { once: true }); setTimeout(resolve, 6000); });
await sleep(500);
let loads = 0;
frame.addEventListener('load', () => { loads += 1; });
log(`chapter banner=${JSON.stringify(bannerText(host))} button=${bannerOf(host)?.querySelector('button')?.textContent ?? '-'} first=${host.firstElementChild === bannerOf(host) && bannerOf(host)?.nextElementSibling === frame}`);

workspaceStore.setRecentBook('Course.md');
await until(() => bannerText(host).includes('Course'), 4000);
log(`switch banner=${JSON.stringify(bannerText(host))} frame-loads=${loads} same-frame=${host.querySelector('iframe') === frame}`);
workspaceStore.setRecentBook(MASTER);
await until(() => bannerText(host).includes('Signals'), 4000);

const text = String(await ipc.invoke('clew:note-read', { path: MASTER }));
const first = /^  - "\[\[Senders and Receivers[^\]]*\]\]"\n/m.exec(text)?.[0];
const reordered = first ? text.replace(first, '').replace('  - "[[Conventions]]"\n', `  - "[[Conventions]]"\n${first}`) : text;
if (reordered === text) log('error the master\'s chapter list is not as expected');
await ipc.invoke('clew:note-write', { path: MASTER, content: reordered });
await until(() => bannerText(host).startsWith('Chapter 1 of Signals'), 8000);
log(`reorder banner=${JSON.stringify(bannerText(host))} frame-loads=${loads} same-frame=${host.querySelector('iframe') === frame}`);

const B = bannerOf(host).querySelector('button').getBoundingClientRect();
window.__clewSmokeInput = [{ click: { x: Math.round(B.left + B.width / 2), y: Math.round(B.top + B.height / 2) } }, { wait: 30000 }];
(async () => { try {
	const built = await until(async () => /<html/i.test(String(await ipc.invoke('clew:note-read', { path: 'Books/Signals/build/Signals/index.html' }).catch(() => ''))), 25000);
	log(`build built=${built}`);
	const alone = await openReading('Notes/Alone.md');
	log(`alone banner=${bannerText(alone)} children=${JSON.stringify([...alone.children].map((c) => c.tagName))}`);
	const master = await openReading(MASTER);
	log(`master banner=${bannerText(master)}`);
} catch (err) { log(`error ${err?.message ?? err}`); } })();
