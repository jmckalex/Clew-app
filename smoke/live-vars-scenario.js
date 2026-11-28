// `{{name}}` in live edit (live/header-vars.js, live/inline-layer.js#varChip;
// the owner's ask 2026-11-28): the chip shows what reading view prints. Over
// Vars.md (`node smoke/make-vars-vault.mjs <dir>`), run with
// `CLEW_SMOKE_FRAME_SCRIPT=smoke/live-vars-frame.js CLEW_SMOKE_FRAME_MATCH=Vars.md`:
//   1. the chips → `chips ["Hello world:set","A. Writer:set","bold text:set","empty:set,empty",
//      "{{nothing}}:unset","{{ title }}:unset","LOF:marker"]`
//   2. `face note=true` (a value chip in the note's family, a name chip in mono)
//   3. a click on "A. Writer" → `revealed source=true` (the line shows {{author}})
//   4. the header's author changed → `edited chip="B. Writer"`
//   5. reading view (the frame script) → `smoke-vars-frame: heading="Hello world"
//      line="Written by B. Writer; then bold text; an empty []; an unknown {{nothing}}; spaced {{ title }}."`
// Before: every chip the NAME (`chips ["title","author","html","blank","nothing","title","LOF"]`).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool } = window.__clew;
const log = (s) => console.log('smoke-vars: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Vars.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelectorAll('.cm-editor.cm-live .le-var').length >= 7);
await sleep(600);
const view = () => editorPool.get(tab.id).view;
const kind = (el) => (el.classList.contains('le-var-set') ? `set${el.classList.contains('le-var-empty') ? ',empty' : ''}`
	: el.classList.contains('le-var-unset') ? 'unset' : 'marker');
const chips = () => [...document.querySelectorAll('.cm-editor.cm-live .le-var')];
log(`chips ${JSON.stringify(chips().map((el) => `${el.textContent}:${kind(el)}`))}`);
const author = chips().find((el) => el.textContent === 'A. Writer') ?? chips().find((el) => el.textContent === 'author');
const marker = chips().find((el) => kind(el) === 'marker');
const line = author?.closest('.cm-line');
const fam = (el) => el && getComputedStyle(el).fontFamily;
log(`face note=${Boolean(author) && fam(author) === fam(line) && fam(marker) !== fam(line)}`);
const r = author.getBoundingClientRect();
// The queue ends only once reading view is up, so the frame script reads it.
window.__clewSmokeInput = [{ click: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } }, { wait: 800 },
	{ until: { selector: '#smoke-vars-reading', ms: 30000 } }];
(async () => { try {
	await until(() => [...document.querySelectorAll('.cm-editor.cm-live .cm-line')].some((l) => l.textContent.includes('{{author}}')), 5000);
	log(`revealed source=${[...document.querySelectorAll('.cm-editor.cm-live .cm-line')].some((l) => l.textContent.includes('{{author}}'))}`);
	// Away from the line, then the header's value changed.
	const text = view().state.doc.toString();
	view().dispatch({ selection: { anchor: text.indexOf('Last.') } });
	const at = text.indexOf('A. Writer');
	view().dispatch({ changes: { from: at, to: at + 1, insert: 'B' } });
	await until(() => chips().some((el) => el.textContent === 'B. Writer'), 5000);
	log(`edited chip=${JSON.stringify(chips().find((el) => el.textContent.endsWith('. Writer'))?.textContent)}`);
	await sleep(1500);
	workspaceStore.setTabMode(tab.id, 'reading');
	await sleep(3500);
	document.body.append(Object.assign(document.createElement('i'), { id: 'smoke-vars-reading', hidden: true }));
} catch (err) { log('ERROR ' + err.stack); } })();
