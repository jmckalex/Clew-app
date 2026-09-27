// PDF annotations → note (docs/dev/live-edit.md §5.15) over Paper.pdf (two
// pages of text, no annotations). Fixture: `node smoke/make-pdf-vault.mjs
// <dir>`. Run with CLEW_SMOKE_FRAME_SCRIPT=smoke/pdf-annotations-frame.js
// CLEW_SMOKE_FRAME_MATCH=pdf-page — the frame reports the viewer's page.
//
//   1. two highlights (one with a comment) and a sticky note (page 3) are made in the
//      viewer from script, as the UI makes them; autosave writes the PDF →
//      reopened, `persisted=3`
//   2. the command → `note=true pages=2 quotes=3 texts=2 comment=true ids=3
//      links=3` (the highlighted words, by the engine's text extraction)
//   3. again → `unchanged=true` (byte-identical)
//   4. one more highlight, again → `appended=1 kept=true`
//   5. a real click on the note's page-3 link in live edit → the frame
//      script: `page=3 annotations=4` (the step-4 highlight survived its
//      tab's rebuild: the command flushed the pending autosave)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, registry, ipc, pdfAnnotations, vaultStore } = window.__clew;
const log = (s) => console.log('smoke-pa: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const frame = () => [...document.querySelectorAll('clew-file-view')].find((v) => v.path === 'Paper.pdf')?.querySelector('iframe.pdf-frame');
const create = (specs) => new Promise((resolve) => {
	const on = (e) => { if (e.data?.type === 'test-created') { window.removeEventListener('message', on); resolve(e.data.made); } };
	window.addEventListener('message', on);
	frame().contentWindow.postMessage({ source: 'clew-preview-host', type: 'test-create-annotations', specs }, '*');
	setTimeout(() => resolve(-1), 10000);
});
const note = 'Paper — Annotations.md';
const read = () => ipc.invoke('clew:note-read', { path: note }).catch(() => null);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });

try {
	// 1
	const tab = workspaceStore.openFile('Paper.pdf', { newTab: true });
	await until(() => frame());
	await sleep(3000);
	const made = await create([
		{ kind: 'highlight', page: 1, match: 'Morality evolves' },
		{ kind: 'highlight', page: 1, match: 'A second line', contents: 'My comment.' },
		{ kind: 'note', page: 3, contents: 'A sticky note.' },
	]);
	log(`made=${made}`);
	await sleep(6000); // the 2.5 s autosave debounce, and the write
	workspaceStore.closeTab(tab.id);
	await sleep(500);
	workspaceStore.openFile('Paper.pdf', { newTab: true });
	await until(() => frame());
	const reopened = await pdfAnnotations.listAnnotations('Paper.pdf');
	log(`persisted=${reopened.length} kinds=${JSON.stringify(reopened.map((a) => a.kind))}`);

	// 2
	registry.runCommand('pdf:extract-annotations');
	await until(async () => Boolean(await read()));
	const first = await read();
	const count = (re) => (first.match(re) ?? []).length;
	log(`note=${Boolean(first)} pages=${count(/^## Page \d+$/gm)} quotes=${count(/\^pdf-/g)} texts=${[/Morality evolves/, /A second line/].filter((re) => re.test(first)).length} comment=${first.includes('My comment.')} ids=${count(/\^pdf-[\w-]+$/gm)} links=${count(/\[\[Paper\.pdf#page=\d\|p\. \d\]\]/g)}`);

	// 3
	await registry.runCommand('pdf:extract-annotations');
	await sleep(2500);
	log(`unchanged=${(await read()) === first}`);

	// 4
	await create([{ kind: 'highlight', page: 3, match: 'Signals acquire' }]);
	await sleep(500);
	registry.runCommand('pdf:extract-annotations');
	await until(async () => (await read()) !== first, 8000);
	const second = await read();
	log(`appended=${(second.match(/\^pdf-/g) ?? []).length - (first.match(/\^pdf-/g) ?? []).length} kept=${second.includes(first.split('## Page 3')[0].trim())} signals=${second.includes('Signals acquire')}`);

	// 5: the note in live edit, its page-3 link clicked for real.
	const noteTab = workspaceStore.openNote(note, { newTab: true, defaultMode: 'live' });
	workspaceStore.setTabMode(noteTab.id, 'live');
	await until(() => document.querySelector('.cm-content .le-wikilink[data-le-target="Paper.pdf#page=3"]'));
	await sleep(600);
	const link = document.querySelector('.cm-content .le-wikilink[data-le-target="Paper.pdf#page=3"]').getBoundingClientRect();
	window.__clewSmokeInput = [{ click: { x: Math.round(link.left + link.width / 2), y: Math.round(link.top + link.height / 2) } }, { wait: 7000 }];
} catch (err) { log('ERROR ' + err.stack); }
