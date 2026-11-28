// Spell checking in the note editor (renderer/editor/spellcheck.js,
// main/spellcheck.js; the owner's ask 2026-11-28), with REAL clicks, keys and
// right-clicks over Spell.md (`node smoke/make-spell-vault.mjs <dir>`). Main
// logs each menu it would draw as `smoke-context-menu: misspelled=<word>
// items=…` — the platform checker's own verdict on the word clicked — and
// this scenario logs `smoke-sp: <step>` before each, so the lines pair in
// order. A HIDDEN window's checker marks only the paragraph being typed in
// (Chromium checks the rest when idle, which a hidden window never is —
// measured with a bare Electron page, 2026-11-28), so each step first clicks
// the end of its word's line and types " qzxw" there, which checks that
// line. (A space typed and deleted does not: CodeMirror redraws the line
// after its own Backspace, and the marks wait for the idle check.)
//   source mode, the setting on (the default):
//   1. `attr spellcheck=true`; "wrod" (prose)
//                    → misspelled=wrod items=<suggestions>|-|Learn Spelling|-|Cut|Copy|Paste|-|Select All
//   2–5. "inlnecode" (a code span), "betta" ($…$), "tagret" ([[…]]), "Smithh" (\cite{…})
//                    → misspelled= items=Cut|Copy|Paste|-|Select All
//   6. "wrod", the menu's "word" chosen → `replaced prose="A misspelt word in prose."`
//   7. "wrod", Learn Spelling chosen → `smoke-spell-learn: wrod` (never the OS dictionary)
//   8. the setting off → `attr spellcheck=false`; "wrod" → misspelled=
//   live edit, the setting on:
//   9. "wrod"        → misspelled=wrod
//  10. the wikilink's "tagret" → misspelled=
//  11. a table cell clicked into → `cell spellcheck=true`; End, " qzxw",
//      then "celll" right-clicked → misspelled=celll (a cell's words are checked)
//  12. the row's other cell, not being edited, right-clicked → its table
//      menu (`table-menu=true`), and no smoke-context-menu line (the page took it)
//  13. Settings → Appearance (run with CLEW_SMOKE_SPELL_LANGUAGES=1, which
//      shows the Windows/Linux languages row on a Mac): `settings check-row=true
//      checked=true languages-row=true placeholder="en-GB (your system’s)"`;
//      "en_gb, xx" entered → `stored=["en_gb","xx"] not-available=xx`; the
//      box unticked → `unticked spellcheck=false`
// Without the marks (spellcheck.js's decorations taken out, measured): steps
// 2–5 say misspelled=inlnecode, betta, tagret, Smithh.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore } = window.__clew;
const log = (s) => console.log('smoke-sp: ' + s);
const until = async (test, ms = 8000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
settingsStore.set('spellcheck', true);
settingsStore.set('linkPreview', 'off');
const tab = workspaceStore.openNote('Spell.md', { newTab: true, defaultMode: 'source' });
workspaceStore.setTabMode(tab.id, 'source');
await until(() => editorPool.get(tab.id)?.view);
await sleep(800);
const view = () => editorPool.get(tab.id).view;
const text = () => view().state.doc.toString();
const coords = (pos) => {
	const c = view().coordsAtPos(pos);
	return { x: Math.round(c.left), y: Math.round((c.top + c.bottom) / 2) };
};
/** A word's middle, and the end of its line, on screen. */
const spot = (word) => {
	const at = text().indexOf(word);
	return { word: coords(at + Math.floor(word.length / 2)), end: coords(view().state.doc.lineAt(at).to) };
};
const src = { wrod: spot('wrod'), code: spot('inlnecode'), maths: spot('betta'), link: spot('tagret'), cite: spot('Smithh') };
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-wikilink[data-le-target="Notte tagret"]') && document.querySelector('.le-table-wrap [data-le-cell]'));
await sleep(800);
const mid = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
/** The middle of `word` in an element's text, on screen. */
const wordIn = (el, word) => {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const i = n.data.indexOf(word);
		if (i < 0) continue;
		const r = document.createRange();
		r.setStart(n, i + Math.floor(word.length / 2));
		r.setEnd(n, i + Math.floor(word.length / 2) + 1);
		const b = r.getBoundingClientRect();
		return { x: Math.round(b.left), y: Math.round(b.top + b.height / 2) };
	}
	return null;
};
const td = [...document.querySelectorAll('.le-table-wrap [data-le-cell]')].find((el) => el.textContent.includes('celll'));
const live = {
	wrod: spot('wrod'),
	link: { word: wordIn(document.querySelector('.le-wikilink[data-le-target="Notte tagret"]'), 'tagret'), end: spot('tagret').end },
	other: mid([...document.querySelectorAll('.le-table-wrap [data-le-cell]')].find((el) => el.textContent.trim() === 'one')),
	celll: wordIn(td, 'celll'),
};
workspaceStore.setTabMode(tab.id, 'source');
await sleep(800);
view().focus();

const mark = (id) => document.body.append(Object.assign(document.createElement('i'), { id: `smoke-sp-${id}`, hidden: true }));
const go = (n) => ({ until: { selector: `#smoke-sp-${n}`, ms: 20000 } });
/** Check `s`'s line (" qzxw" typed at its end), then right-click its word. */
const check = (s) => [{ click: s.end }, { wait: 200 }, { text: ' qzxw' }, { wait: 1500 },
	{ click: s.word, button: 'right' }, { wait: 800 }];
window.__clewSmokeInput = [
	go(1), ...check(src.wrod),
	go(2), ...check(src.code),
	go(3), ...check(src.maths),
	go(4), ...check(src.link),
	go(5), ...check(src.cite),
	go(6), ...check(src.wrod),
	go(7), ...check(src.wrod),
	go(8), ...check(src.wrod),
	go(9), ...check(live.wrod),
	go(10), ...check(live.link),
	go(11), { click: live.celll }, { wait: 1000 }, { combo: { key: 'End', modifiers: 0 } }, { text: ' qzxw' }, { wait: 1500 },
	{ click: live.celll, button: 'right' }, { wait: 1000 },
	go(12), { click: live.other, button: 'right' }, { wait: 1200 },
	go(13), { combo: { key: 'Escape', modifiers: 0 } }, { wait: 400 },
	go('end'), { wait: 500 },
];

(async () => { try {
	const content = () => view().contentDOM;
	log(`step 1 attr spellcheck=${content().getAttribute('spellcheck')}`);
	mark(1);
	for (const [n, what] of [[2, 'code'], [3, 'maths'], [4, 'link'], [5, 'cite']]) {
		await sleep(3000);
		log(`step ${n} ${what}`);
		mark(n);
	}
	await sleep(3000);
	window.__clewSmokeMenuChoice = 'word';
	log('step 6 choose word');
	mark(6);
	await until(() => text().includes('misspelt word in'), 6000);
	log(`replaced prose=${JSON.stringify(text().split('\n').find((l) => l.startsWith('A misspelt')))}`);
	// Put the word back for the steps after.
	window.__clewSmokeMenuChoice = null;
	const back = text().indexOf('misspelt word in') + 'misspelt '.length;
	if (back >= 'misspelt '.length) view().dispatch({ changes: { from: back, to: back + 4, insert: 'wrod' } });
	await sleep(500);
	window.__clewSmokeMenuChoice = 'Learn Spelling';
	log('step 7 choose Learn Spelling');
	mark(7);
	await sleep(3000);
	window.__clewSmokeMenuChoice = null;
	settingsStore.set('spellcheck', false);
	await sleep(300);
	log(`step 8 attr spellcheck=${content().getAttribute('spellcheck')}`);
	mark(8);
	await sleep(3000);
	settingsStore.set('spellcheck', true);
	workspaceStore.setTabMode(tab.id, 'live');
	await until(() => document.querySelector('.cm-editor.cm-live .le-wikilink[data-le-target="Notte tagret"]'));
	await sleep(800);
	view().focus();
	log(`step 9 live attr spellcheck=${content().getAttribute('spellcheck')}`);
	mark(9);
	await sleep(3000);
	log('step 10 live link');
	mark(10);
	await sleep(3000);
	mark(11);
	await until(() => document.querySelector('.le-cell-editor .cm-content'), 5000);
	await sleep(300);
	log(`step 11 cell spellcheck=${document.querySelector('.le-cell-editor .cm-content')?.getAttribute('spellcheck')}`);
	await sleep(3500);
	log('step 12 the other cell, right-clicked');
	mark(12);
	await until(() => [...document.querySelectorAll('.table-menu')].some((el) => el.getClientRects().length), 3000);
	log(`step 12 table-menu=${[...document.querySelectorAll('.table-menu')].some((el) => el.getClientRects().length)}`);
	mark(13);
	await until(() => ![...document.querySelectorAll('.table-menu')].some((el) => el.getClientRects().length), 3000);
	await sleep(300);
	// 13. The settings rows (a synthetic change, as the select rows' are
	// driven elsewhere: the editors' side of the setting is step 8's).
	window.__clew.actions.openSettings();
	await until(() => document.querySelector('.settings-view .settings-row'));
	const spellRow = [...document.querySelectorAll('.settings-view .settings-row')].find((r) => r.querySelector('label')?.textContent === 'Check spelling');
	const box = spellRow?.querySelector('input[type=checkbox]');
	const languages = () => document.querySelector('.settings-view .settings-spell-languages');
	await until(() => languages() && !languages().closest('.settings-row').hidden, 3000);
	log(`step 13 settings check-row=${Boolean(box)} checked=${box?.checked} languages-row=${Boolean(languages() && !languages().closest('.settings-row').hidden)} placeholder=${JSON.stringify(languages()?.placeholder)}`);
	if (languages()) {
		languages().value = 'en_gb, xx';
		languages().dispatchEvent(new Event('change'));
		await until(() => languages().closest('.settings-row').nextElementSibling.textContent.startsWith('Not available'), 3000);
		const said = languages().closest('.settings-row').nextElementSibling.textContent;
		log(`step 13 stored=${JSON.stringify(settingsStore.get('spellcheckLanguages'))} not-available=${said.match(/^Not available: ([^.]*)\./)?.[1] ?? 'none'}`);
	}
	if (box) { box.checked = false; box.dispatchEvent(new Event('change')); }
	await sleep(300);
	log(`step 13 unticked spellcheck=${settingsStore.get('spellcheck')}`);
	log(`prose line=${JSON.stringify(text().split('\n').find((l) => l.startsWith('A misspelt')))}`);
	mark('end');
} catch (err) { log('ERROR ' + err.stack); } })();
