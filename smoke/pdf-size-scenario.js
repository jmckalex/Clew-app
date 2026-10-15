// A PDF embed's size (preview-client/pdf-size.js): one page tall at "fit
// width", or the link's #height= / #width=, in live edit's block frames AND
// reading view. Until 2026-10-15 the viewer was `height: 70vh`, which in a
// live-edit block frame is 70% of a frame sized to its own content: the
// frame went 480 → 325 → 211 → … → 176px, a toolbar over a sliver of page.
// Fixture: `node smoke/make-pdf-size-vault.mjs <dir>`.
//
// Every number comes from inside the viewer's document through pdf-embed.js's
// `test-pdf-size` hook (EmbedPDF's own metrics and layout), asked once the
// viewer has settled — two asks 600ms apart that agree. Expect, per line:
// `equal=true` (the viewport is exactly the one-page sum: the viewport's gap,
// the tallest page at its fit-width scale, the gap to the next page),
// `zoom=fit-width fit=true` (the scale is (width − 2·gap) / widest page),
// `at-top=true` (scrollTop within a pixel of the top of the page the link
// names — page one, or #page=N's — and `page=<shown>/<named>`). The lines:
// - live|reading `full` / `split` / `split+sidebars` / `full-again`: three
//   widths, the same viewer throughout (`same-viewer=true`);
// - `wide-button button=false` in live edit (no ⟷ in a block frame: there it
//   could only narrow the box), `button=true` in reading view, then `wide` /
//   `unwide`: ⟷ on (one page at 96vw) and off;
// - `height=400`: `host=400` (the link's height), still fit width;
// - `width=60%`: an A4 in a box 60% of its column (`box/column=0.600`, the
//   content widths — CSS's rule; the box's padding is on top);
// - `landscape`, `one-page` (one page, rounded up with 10px of room below:
//   `scrolls=false`, and the width it was fitted to stays — on this machine's
//   classic scrollbars the viewer flickered between two widths for ever);
// - `broken`: EmbedPDF's own error card (`status=error`) under its toolbar,
//   the host as tall as the card (`card=… card-fits=true`), not a letter page;
// - `edit-*`: Edit.md's link changed in place — in live edit a new block
//   frame, in reading view the SAME viewer re-sized.
// Then `title` lines: "Paper.pdf", never "Paper.pdf § height=400". Last, when
// the fixture has Locked.pdf (qpdf): `locked` — the password prompt, the
// viewport 440px — then the password typed by REAL input into EmbedPDF's own
// prompt — first at narrow widths (`locked-narrow`, `locked-208` and
// `broken-208` — an iPad's, `#width=208`, the card WHOLE: `card-fits=true
// past=0`, everything in it inside it (pdf-card-fit.js) — `broken-narrow`:
// a taller card, still `card-fits=true`) — and `unlocked`: one page, like any
// other. The run's log must hold
// no ResizeObserver loop error and no `smoke-pdf-leak:`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-pdfsize: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

let seq = 0;
/** The viewers in `win`'s document, as pdf-embed.js describes them. */
const ask = (win, press = false, scrollTo) => new Promise((resolve) => {
	const id = ++seq;
	const done = (value) => { removeEventListener('message', on); clearTimeout(timer); resolve(value); };
	const on = (event) => {
		if (event.source === win && event.data?.type === 'test-pdf-sized' && event.data.id === id) done(event.data.sizes);
	};
	const timer = setTimeout(() => done(null), 3000);
	addEventListener('message', on);
	win.postMessage({ source: 'clew-preview-host', type: 'test-pdf-size', id, press, scrollTo }, '*');
});

const shown = (el) => el && !el.closest('[data-clew-retiring]') && el.getBoundingClientRect().width > 0;
/** The document holding the note's PDF viewer: live edit's block frame, or the reading view's. */
function frameOf(mode, note) {
	if (mode === 'live') {
		const slot = [...document.querySelectorAll('.le-frame-slot[data-kind="pdf"]')].find(shown);
		return slot && document.querySelector(`.le-frames iframe[data-frame-id="${CSS.escape(slot.dataset.frameId)}"]`);
	}
	return [...document.querySelectorAll('iframe.preview-frame')].find((f) => shown(f) && decodeURIComponent(f.src).includes(`/${note}`));
}

const same = (a, b) => a && b && a.viewer === b.viewer && a.host === b.host && a.failed === b.failed
	&& a.viewport?.height === b.viewport?.height && a.viewport?.width === b.viewport?.width
	&& a.zoom === b.zoom && a.scale === b.scale && a.viewport?.top === b.viewport?.top;

/** Wait for the viewer to settle (`until` it is what the step expects), then one line. */
async function report(mode, note, label, { until = () => true, ms = 25000 } = {}) {
	let last = null;
	let frame = null;
	// 600ms apart: EmbedPDF re-zooms 150ms after a resize stops (debounced),
	// and an answer from before that has the old scale.
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(600)) {
		frame = frameOf(mode, note);
		const now = frame && (await ask(frame.contentWindow))?.[0];
		const ready = now && (now.failed || now.status === 'error' || now.zoom) && until(now);
		if (ready && same(now, last)) break;
		last = ready ? now : null;
	}
	if (!last) {
		log(`${mode} ${label} UNSETTLED`);
		return null;
	}
	const s = last;
	const vp = s.viewport;
	const parts = [`${mode} ${label}`, `viewer=${s.viewer}`, `status=${s.status}`];
	// EmbedPDF unmounts its viewport for a message: the host is its toolbar
	// (pdf-size.js's 56px guess) and 440px for the message.
	if (s.status === 'error') parts.push(`card=${s.card?.height} card-fits=${s.card?.fits} past=${s.card?.past} card-width=${s.card?.width} box=${s.box}`);
	else if (vp) {
		// pdf-size.js's target: down for a PDF of pages, up and 10px of room
		// for one of a single page.
		const sum = s.pages > 1 ? Math.floor(s.onePage) : Math.ceil(s.onePage) + 10;
		const fitScale = (vp.width - 2 * s.viewportGap) / s.widest;
		parts.push(`width=${vp.width}`, `viewport=${vp.height}`, `sum=${sum}`, `equal=${vp.height === sum}`,
			`zoom=${s.zoom}`, `scale=${s.scale?.toFixed(4)}`, `fit=${Math.abs(s.scale - fitScale) < 1e-3}`, `top=${+vp.top.toFixed(2)}`, `at-top=${Math.abs(vp.top - (s.wantedTop ?? 0)) < 1}`, `page=${s.current}/${s.wanted ?? '-'}`,
			`content=${vp.contentHeight}`, `scrolls=${vp.contentHeight > vp.height}`, `pages=${s.pages}`);
	}
	parts.push(`host=${s.host}`, `failed=${s.failed}`, `box=${s.box}`, `column=${s.column}`, `wide=${s.wide}`);
	if (mode === 'live') parts.push(`block-frame=${Math.round(frame.getBoundingClientRect().height)}`);
	log(parts.join(' '));
	return s;
}

// ---- three widths, ⟷, the same viewer throughout ----
async function widths(mode, tab) {
	const left = workspaceStore.activeGroupId;
	const first = await report(mode, 'Embed.md', 'full');
	workspaceStore.splitWithClone(left, 'right', tab.id);
	const right = workspaceStore.activeGroupId;
	workspaceStore.openNote('Spacer.md', { defaultMode: mode });
	const split = await report(mode, 'Embed.md', 'split', { until: (s) => s.viewport?.width < first.viewport.width - 40 });
	workspaceStore.setSidebar('left', { open: true });
	workspaceStore.setSidebar('right', { open: true });
	const narrow = await report(mode, 'Embed.md', 'split+sidebars', { until: (s) => s.viewport?.width < split.viewport.width - 40 });
	workspaceStore.setSidebar('left', { open: false });
	workspaceStore.setSidebar('right', { open: false });
	workspaceStore.closeGroup(right, { force: true });
	workspaceStore.setActiveGroup(left);
	const again = await report(mode, 'Embed.md', 'full-again', { until: (s) => s.viewport?.width === first.viewport.width });
	log(`${mode} widths=${[first, split, narrow, again].map((s) => s?.viewport?.width).join(',')} same-viewer=${[split, narrow, again].every((s) => s?.viewer === first?.viewer)}`);

	// ⟷: reading view's only — a live-edit block frame is the column itself,
	// where it could only narrow the box (pdf-embed.js#IN_BLOCK).
	log(`${mode} wide-button button=${first.button}`);
	if (mode === 'live') return;
	await ask(frameOf(mode, 'Embed.md').contentWindow, true);
	await report(mode, 'Embed.md', 'wide', { until: (s) => s.wide });
	await ask(frameOf(mode, 'Embed.md').contentWindow, true);
	await report(mode, 'Embed.md', 'unwide', { until: (s) => !s.wide && s.viewport?.width === first.viewport.width });
}

const embed = workspaceStore.openNote('Embed.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(embed.id, 'live');
await widths('live', embed);
workspaceStore.setTabMode(embed.id, 'reading');
await widths('reading', embed);

// ---- the cases, each in both modes ----
const titles = [];
for (const [note, label, until] of [
	['Height.md', 'height=400', (s) => s.host === 400],
	['Width.md', 'width=60%', (s) => s.box < s.column * 0.75],
	['Wide.md', 'landscape'],
	['One.md', 'one-page'],
	['Broken.md', 'broken', (s) => s.status === 'error'],
	// #page=N: at that page's top, one page tall; with a height; past the end
	['Page.md', 'page=3', (s) => s.current === 3],
	['PageSized.md', 'page=2&height=400', (s) => s.host === 400 && s.current === 2],
	['PageFar.md', 'page=99', (s) => s.current === 4],
]) {
	const tab = workspaceStore.openNote(note, { newTab: true, defaultMode: 'live' });
	for (const mode of ['live', 'reading']) {
		workspaceStore.setTabMode(tab.id, mode);
		const s = await report(mode, note, label, { until });
		titles.push(`${mode}:${note}=${JSON.stringify(s?.title)}`);
		if (label === 'width=60%' && s) log(`${mode} ${label} box/column=${(s.boxContent / s.column).toFixed(3)} (content widths ${s.boxContent}/${s.column})`);
	}
}
log(`titles ${titles.join(' ')}`);

// ---- editing the link ----
const edit = workspaceStore.openNote('Edit.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(edit.id, 'live');
await report('live', 'Edit.md', 'edit-plain');
const view = editorPool.get(edit.id).view;
let link = '![[Paper.pdf]]';
const relink = (to) => {
	const at = view.state.doc.toString().indexOf(link);
	view.dispatch({ changes: { from: at, to: at + link.length, insert: to } });
	// the cursor at the end, off the embed's line, so the block is drawn
	view.dispatch({ selection: { anchor: view.state.doc.length } });
	link = to;
};
relink('![[Paper.pdf#height=400]]');
await report('live', 'Edit.md', 'edit-height=400', { until: (s) => s.host === 400 });
relink('![[Paper.pdf#width=60%]]');
await report('live', 'Edit.md', 'edit-width=60%', { until: (s) => s.box < s.column * 0.75 });
relink('![[Paper.pdf]]');
await report('live', 'Edit.md', 'edit-plain-again', { until: (s) => s.box > s.column * 0.9 && s.host !== 400 });
relink('![[Paper.pdf#page=3]]');
await report('live', 'Edit.md', 'edit-page=3', { until: (s) => s.current === 3 });
relink('![[Paper.pdf#page=2]]');
await report('live', 'Edit.md', 'edit-page=2', { until: (s) => s.current === 2 });
relink('![[Paper.pdf]]');
await report('live', 'Edit.md', 'edit-page-out', { until: (s) => s.current === 1 });
await sleep(1500);   // auto-save

workspaceStore.setTabMode(edit.id, 'reading');
const before = await report('reading', 'Edit.md', 'edit-plain');
const write = (to) => ipc.invoke('clew:note-write', { path: 'Edit.md', content: `# Edit\n\nAbove the embed.\n\n${to}\n\nBelow the embed.\n` });
await write('![[Paper.pdf#height=400]]');
const h = await report('reading', 'Edit.md', 'edit-height=400', { until: (s) => s.host === 400 });
await write('![[Paper.pdf#width=60%]]');
const w = await report('reading', 'Edit.md', 'edit-width=60%', { until: (s) => s.box < s.column * 0.75 });
await write('![[Paper.pdf]]');
const p = await report('reading', 'Edit.md', 'edit-plain-again', { until: (s) => s.box > s.column * 0.9 && s.host !== 400 });
// #page=N edited in place: the same viewer goes there; a re-render that
// leaves the link as it was leaves the reader's place.
await write('![[Paper.pdf#page=3]]');
const p3 = await report('reading', 'Edit.md', 'edit-page=3', { until: (s) => s.current === 3 });
await write('![[Paper.pdf#page=2]]');
const p2 = await report('reading', 'Edit.md', 'edit-page=2', { until: (s) => s.current === 2 });
await ask(frameOf('reading', 'Edit.md').contentWindow, false, 2000);   // the reader scrolls on, to page three
await report('reading', 'Edit.md', 'reader-scrolled', { until: (s) => s.current === 3 });
await ipc.invoke('clew:note-write', { path: 'Edit.md', content: '# Edit\n\nAbove the embed, edited.\n\n![[Paper.pdf#page=2]]\n\nBelow the embed.\n' });
await sleep(2500);   // the re-render: the text changed, the link did not
const kept = await report('reading', 'Edit.md', 'rerender-same-link');
log(`reading edits same-viewer=${[h, w, p, p3, p2, kept].every((s) => s?.viewer === before?.viewer)} reader-kept=${kept?.viewport?.top === 2000}`);

// The title's link opens the PDF's tab at the page too, sizes and all.
{
	const shown = new Promise((resolve) => {
		const on = (event) => {
			if (event.data?.source === 'clew-preview' && event.data.type === 'pdf-page-shown') { removeEventListener('message', on); resolve(event.data.page); }
		};
		addEventListener('message', on);
		setTimeout(() => resolve(null), 15000);
	});
	await window.__clew.actions.openWikilink('Paper.pdf#page=2&height=400');
	const page = await shown;
	log(`title-link tab=${workspaceStore.activeTab()?.path} pdfPage=${workspaceStore.activeTab()?.view?.pdfPage} shown=${page}`);
}

// ---- a PDF behind a password: EmbedPDF's prompt, then opened ----
const hasLocked = await ipc.invoke('clew:note-read', { path: 'Locked.md' }).then(() => true, () => false);
if (!hasLocked) {
	log('locked skipped (no qpdf when the fixture was made)');
	workspaceStore.activateTab(embed.id);
	workspaceStore.setTabMode(embed.id, 'live');
	await report('live', 'Embed.md', 'last');
	log('done');
	return;
}
const locked = workspaceStore.openNote('Locked.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(locked.id, 'reading');
// Narrow first — a split and both sidebars: the prompt is taller there, and
// the host is measured to it (Clew-iOS's 516px prompt in a 445px area).
{
	const left = workspaceStore.activeGroupId;
	workspaceStore.splitWithClone(left, 'right', locked.id);
	const right = workspaceStore.activeGroupId;
	workspaceStore.openNote('Spacer.md', { defaultMode: 'reading' });
	workspaceStore.setSidebar('left', { open: true });
	workspaceStore.setSidebar('right', { open: true });
	await report('reading', 'Locked.md', 'locked-narrow', { until: (s) => s.status === 'error' && s.box < 320 && s.card?.fits });
	const tiny = workspaceStore.openNote('LockedNarrow.md', { newTab: true, defaultMode: 'reading' });
	workspaceStore.activateTab(tiny.id);
	// An iPad's 208px (Clew-iOS): settled on the card, whatever its fit — the
	// line says it (`card-fits`, `past`: px over the edge).
	await report('reading', 'LockedNarrow.md', 'locked-208', { until: (s) => s.status === 'error' && s.box <= 230 && s.card?.height > 0 });
	const brokenTiny = workspaceStore.openNote('BrokenNarrow.md', { newTab: true, defaultMode: 'reading' });
	workspaceStore.activateTab(brokenTiny.id);
	await report('reading', 'BrokenNarrow.md', 'broken-208', { until: (s) => s.status === 'error' && s.box <= 230 && s.card?.height > 0 });
	const broken = workspaceStore.openNote('Broken.md', { newTab: true, defaultMode: 'reading' });
	workspaceStore.activateTab(broken.id);
	await report('reading', 'Broken.md', 'broken-narrow', { until: (s) => s.status === 'error' && s.box < 320 && s.card?.fits });
	workspaceStore.setSidebar('left', { open: false });
	workspaceStore.setSidebar('right', { open: false });
	workspaceStore.closeGroup(right, { force: true });
	workspaceStore.setActiveGroup(left);
	workspaceStore.activateTab(locked.id);
}
const prompt = await report('reading', 'Locked.md', 'locked', { until: (s) => s.status === 'error' && s.box > 600 });
// Typed for real once this script returns: EmbedPDF's own password field.
window.__clewSmokeInput = [
	{ frameClick: { match: 'Locked.md', selector: 'input[type="password"]' } },
	{ wait: 300 },
	{ text: 'secret' },
	{ combo: { key: 'Enter', modifiers: 0, text: '\r' } },
	{ wait: 8000 },
];
(async () => {
	const open = await report('reading', 'Locked.md', 'unlocked', { until: (s) => s.status === 'loaded' });
	log(`locked same-viewer=${open?.viewer === prompt?.viewer}`);
	log('done');
})();
