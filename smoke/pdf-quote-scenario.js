// Quote-and-cite from a PDF (FEATURE-IDEAS #2; renderer/pdf-quote.js) over
// `node smoke/make-quote-vault.mjs <dir> [--pandoc] [--real a.pdf]
// [--real-unlisted b.pdf]`. Draft.md is written in live edit on the left;
// the PDFs open on the right. Selections are made with EmbedPDF's own
// setSelection (what a drag ends in) through the viewer's scenario hook.
//
//   0. the command with nothing selected → `nothing: notice=true`
//   1. Paper.pdf, a selection across three lines with a hyphen-broken word →
//      `tab: cite=true dehyphen=true link=true placed=true`
//   2. a line holding `$5`, `$10`, `x^2` → escaped, and the note RENDERED:
//      `render: dollars=true sup=false cite=true link=true`
//   3. across pages 1–2 → `pages: page=1 joined=true`
//   4. Unlisted.pdf (no entry): the picker (`picker: rows=4`), "Quote
//      without a citation" → `nocite: cite=false link=true`; again, choosing
//      lewis:1969 → `chosen: cite=true`
//   5. Draft in reading mode → `reading: refused=true unchanged=true`
//   6. Embed.md's embed of Unlisted.pdf (reading mode) → into Draft, which
//      is back in live edit: `embed: into-draft=true`
//   7. with `--real`: Real.pdf, cited by its file field → `real: …`;
//      with `--real-unlisted`: the picker, no citation → `real-unlisted: …`
//   8. REAL input: a click on "Quote in note" in Paper.pdf's own selection
//      menu → (after the scenario) `menu: quoted=true`
// `--pandoc` runs the same steps; the citations are then `[@key, p. N]`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, actions, registry, ipc, vaultSettingsStore } = window.__clew;
const log = (s) => console.log('smoke-pq: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const pandoc = vaultSettingsStore.get('pandocCitations') === true;
const cite = (key, page) => (pandoc ? `[@${key}, p. ${page}]` : `\\cite[p. ${page}]{${key}}`);
const notices = () => [...document.querySelectorAll('.clew-notice')].map((n) => n.textContent);
const lastNotice = () => notices().pop() ?? '';

const pdfFrame = (path) => [...document.querySelectorAll('clew-file-view')].find((v) => v.path === path)?.querySelector('iframe.pdf-frame')?.contentWindow;
const select = (win, page, match, to = null) => new Promise((resolve) => {
	const on = (e) => {
		if (e.source !== win || e.data?.type !== 'test-selected') return;
		window.removeEventListener('message', on);
		if (e.data.ok) log(`selected: ${JSON.stringify(e.data.text)}`);
		resolve(e.data.ok);
	};
	window.addEventListener('message', on);
	win.postMessage({ source: 'clew-pdf-host', type: 'test-select-text', page, match, to }, '*');
	setTimeout(() => { window.removeEventListener('message', on); resolve(null); }, 4000);
});
/** Select once the viewer has the document (the first tries arrive early). */
const selectIn = async (getWin, ...args) => {
	for (let i = 0; i < 60; i++) {
		const win = getWin();
		if (win && await select(win, ...args)) return true;
		await sleep(500);
	}
	return false;
};
const quote = () => registry.runCommand('pdf:quote-selection');

// ---- Draft in live edit, the cursor at the end of "Notes so far." ----
const draft = workspaceStore.openNote('Draft.md', { defaultMode: 'live' });
workspaceStore.setTabMode(draft.id, 'live');
await until(() => editorPool.get(draft.id)?.view);
const view = () => editorPool.get(draft.id).view;
const text = () => view().state.doc.toString();

// `quote-mode.txt` holding `chord` (make-quote-vault.mjs --chord): the
// command by its REAL chord from inside a note's reading view — a click
// into Embed.md, then ⌥⌘Q as a Mac sends it (key "œ" on code "KeyQ"),
// which the preview forwards to the app → `chord: quoted=true`.
const mode = String(await ipc.invoke('clew:note-read', { path: 'quote-mode.txt' }).catch(() => '')).trim();
if (mode === 'chord') {
	actions.splitActive('right');
	const embedTab = workspaceStore.openNote('Embed.md', { defaultMode: 'reading' });
	workspaceStore.setTabMode(embedTab.id, 'reading');
	await sleep(800);
	{
		const at = text().indexOf('Notes so far.') + 'Notes so far.'.length;
		view().focus();
		view().dispatch({ selection: { anchor: at } });
		view().dom.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
	}
	await sleep(1200);
	const win = () => [...document.querySelectorAll('clew-preview-view')].find((v) => v.offsetParent)?.querySelector('iframe')?.contentWindow;
	const ok = await selectIn(win, 1, 'A paper that no entry names.');
	const before = text();
	(async () => {
		// Inside the harness's post-input wait, so a chord that never
		// arrived still logs `quoted=false`.
		await until(() => document.querySelector('.clew-modal .modal-result'), 2500);
		document.querySelector('.clew-modal .modal-result')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		const quoted = await until(() => text() !== before, 400);
		log(`chord: selected=${ok} quoted=${quoted} placed=${text().includes('Notes so far.\n\n> A paper that no entry names.')}`);
	})();
	window.__clewSmokeInput = [
		{ frameClick: { match: 'Embed.md', selector: 'h1' } },
		{ wait: 300 },
		{ combo: { key: 'œ', code: 'KeyQ', modifiers: 5 } },
		{ wait: 3000 },
	];
	return;
}

// 0. Nothing selected anywhere yet.
await quote();
log(`nothing: notice=${/Select some text/.test(lastNotice())}`);

// The PDF beside the note; then the cursor put at the end of "Notes so far."
// — after the split, as a click into the note would be (a scripted cursor
// set before it does not survive the split's re-parenting; a real click
// does — measured with real input, smoke/README).
actions.splitActive('right');
const right = workspaceStore.activeGroupId;
/** Open in the right-hand pane, whichever pane has the focus. */
const openRight = (path) => { workspaceStore.setActiveGroup(right); return workspaceStore.openFile(path); };
openRight('Papers/Paper.pdf');
const paper = () => pdfFrame('Papers/Paper.pdf');
await sleep(800);
{
	const at = text().indexOf('Notes so far.') + 'Notes so far.'.length;
	view().focus();
	view().dispatch({ selection: { anchor: at } });
	// The tab records its cursor on pointerup (clew-editor-view.js).
	view().dom.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
}
await sleep(1200);

// 1. Three lines of page 1, one word broken by a hyphen.
let ok = await selectIn(paper, 1, 'Conventions are', { page: 1, match: 'are slow.' });
await quote();
await until(() => text().includes('dynamics are slow'));
{
	const t = text();
	const block = `> Conventions are equilibria in a game of coordination; their evolutionary dynamics are slow.\n>\n> ${cite('skyrms:1996', 1)} · [[Paper.pdf#page=1|PDF p. 1]]`;
	log(`tab: selected=${ok} cite=${t.includes(cite('skyrms:1996', 1))} dehyphen=${t.includes('evolutionary dynamics')} link=${t.includes('[[Paper.pdf#page=1|PDF p. 1]]')} placed=${t.includes(`Notes so far.\n\n${block}\n\nA closing line.`)} notice=${JSON.stringify(lastNotice())}`);
}

// 2. Dollars and a superscript — escaped, then rendered to prove it.
ok = await selectIn(paper, 1, 'A bet costs', { page: 1, match: 'x^2 > 4.' });
const before2 = text();
await quote();
await until(() => text() !== before2);
{
	const t = text();
	log(`escaped: selected=${ok} dollars=${t.includes('costs \\$5 and pays \\$10')} sup=${t.includes('x\\^2')} line=${JSON.stringify(t.split('\n').find((l) => l.includes('A bet')))}`);
	await editorPool.flush?.(draft.id);
	await sleep(1500);
	let html = '';
	await until(async () => {
		html = (await ipc.invoke('clew:render-html', { path: 'Draft.md' }).catch(() => '')) ?? '';
		return html.includes('A bet costs');
	}, 20000);
	// The paragraph holding `needle`, from the rendered document.
	const paraOf = (needle) => {
		const at = html.indexOf(needle);
		if (at < 0) return '';
		const open = Math.max(html.lastIndexOf('<p>', at), html.lastIndexOf('<p ', at));
		return html.slice(open, html.indexOf('</p>', at) + 4);
	};
	const para = paraOf('A bet costs');
	const citeHtml = paraOf('PDF p. 1</');
	log(`render: dollars=${/class="escaped">\$<\/span>5/.test(para) && /class="escaped">\$<\/span>10/.test(para)} sup=${/<sup/.test(para)} cite=${/Skyrms|1996/.test(citeHtml) && !citeHtml.includes('\\cite')} link=${/Paper\.pdf/.test(citeHtml)}`);
	log(`render-para: ${JSON.stringify(para.replace(/\s+/g, ' ').slice(0, 160))}`);
	log(`render-cite: ${JSON.stringify(citeHtml.replace(/\s+/g, ' ').slice(0, 300))}`);
}

// 3. Across pages: the last line of page 1 into page 2.
ok = await selectIn(paper, 1, 'pays', { page: 2, match: 'by reinforcement.' });
const before3 = text();
await quote();
await until(() => text() !== before3);
{
	const block = text().split('\n\n').find((b) => b.includes('Signals acquire')) ?? '';
	log(`pages: selected=${ok} page1=${block.includes(cite('skyrms:1996', 1)) && block.includes('#page=1|PDF p. 1]]')} joined=${/4\. Signals acquire meaning by reinforcement\./.test(block)}`);
}

// 4. A PDF no entry names: the picker.
openRight('Papers/Unlisted.pdf');
const unlisted = () => pdfFrame('Papers/Unlisted.pdf');
ok = await selectIn(unlisted, 1, 'A paper that no entry names.');
const before4 = text();
const quoting = quote();
await until(() => document.querySelector('.clew-modal .modal-result'));
{
	const rows = [...document.querySelectorAll('.clew-modal .modal-result')];
	log(`picker: selected=${ok} rows=${rows.length} first=${JSON.stringify(rows[0]?.textContent ?? '')} placeholder=${JSON.stringify(document.querySelector('.clew-modal .modal-input')?.placeholder ?? '')}`);
	rows[0]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
}
await quoting;
await until(() => text() !== before4);
{
	const added = text().slice(text().indexOf('A paper that no entry'));
	log(`nocite: cite=${/\\cite|\[@/.test(added.split('\n').slice(0, 3).join('\n'))} link=${added.includes('[[Unlisted.pdf#page=1|PDF p. 1]]')} notice=${JSON.stringify(lastNotice())}`);
}
// 4b. The choice is REMEMBERED (.clew/pdf-citations.json): no picker the
// second time, and the notice says so — once.
ok = await selectIn(unlisted, 1, 'Its second line.');
let before4b = text();
await quote();
await until(() => text() !== before4b, 4000);
log(`remembered: picker=${!!document.querySelector('.clew-modal')} cite=${/\\cite|\[@/.test(text().slice(before4b.length > 0 ? text().lastIndexOf('Its second line.') : 0))} notice=${JSON.stringify(lastNotice())}`);
document.querySelector('.clew-modal')?.remove();
// 4c. Changed by the command, on the active PDF tab: lewis:1969 now.
const changing = registry.runCommand('pdf:change-citation');
await until(() => document.querySelector('.clew-modal .modal-result'));
log(`change: placeholder=${JSON.stringify(document.querySelector('.clew-modal .modal-input')?.placeholder ?? '')} current=${JSON.stringify([...document.querySelectorAll('.clew-modal .modal-result')].find((r) => /current/.test(r.textContent))?.querySelector('.result-label')?.textContent ?? '')}`);
[...document.querySelectorAll('.clew-modal .modal-result')].find((r) => r.textContent.includes('lewis:1969'))
	?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
await changing;
await sleep(300);
const meta = await ipc.invoke('clew:pdf-meta-get', { path: 'Papers/Unlisted.pdf' });
log(`changed: stored=${JSON.stringify(meta?.key)} notice=${JSON.stringify(lastNotice())}`);
ok = await selectIn(unlisted, 1, 'A paper that no entry names.');
before4b = text();
await quote();
await until(() => text() !== before4b, 4000);
log(`chosen: cite=${text().includes(cite('lewis:1969', 1))} picker=${!!document.querySelector('.clew-modal')}`);
// 4d. A remembered key no .bib holds any more asks again.
await ipc.invoke('clew:pdf-meta-set', { path: 'Papers/Unlisted.pdf', patch: { key: 'gone:2000' } });
const stale = quote();
await until(() => document.querySelector('.clew-modal .modal-result'), 4000);
log(`stale: picker=${!!document.querySelector('.clew-modal')} placeholder=${JSON.stringify(document.querySelector('.clew-modal .modal-input')?.placeholder ?? '')}`);
[...document.querySelectorAll('.clew-modal .modal-result')].find((r) => r.textContent.includes('lewis:1969'))
	?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
await stale;
// 4e. The .bib's `file` field still wins over a remembered choice.
await ipc.invoke('clew:pdf-meta-set', { path: 'Papers/Paper.pdf', patch: { key: 'lewis:1969' } });
openRight('Papers/Paper.pdf');
ok = await selectIn(paper, 2, 'Signals acquire meaning by reinforcement.');
before4b = text();
await quote();
await until(() => text() !== before4b, 4000);
log(`file-wins: cite=${text().includes(cite('skyrms:1996', 2))} lewis=${text().split('\n\n').filter((b) => b.includes('reinforcement.') && b.includes('page=2')).some((b) => b.includes('lewis'))}`);
await ipc.invoke('clew:pdf-meta-set', { path: 'Papers/Paper.pdf', patch: { key: undefined } });
// 4f. A rename carries what is remembered.
await ipc.invoke('clew:fs-rename', { path: 'Papers/Unlisted.pdf', newPath: 'Papers/Unlisted Moved.pdf' }).catch((e) => log(`rename-error ${e.message}`));
await sleep(800);
log(`renamed: old=${JSON.stringify(await ipc.invoke('clew:pdf-meta-get', { path: 'Papers/Unlisted.pdf' }))} new=${JSON.stringify((await ipc.invoke('clew:pdf-meta-get', { path: 'Papers/Unlisted Moved.pdf' }))?.key)}`);
await ipc.invoke('clew:fs-rename', { path: 'Papers/Unlisted Moved.pdf', newPath: 'Papers/Unlisted.pdf' }).catch(() => {});
await sleep(800);
openRight('Papers/Unlisted.pdf');
// The viewer reloaded with the renames: select again for step 5.
await selectIn(unlisted, 1, 'Its second line.');

// 5. The note in reading mode is not written into.
workspaceStore.setTabMode(draft.id, 'reading');
await sleep(300);
const before5 = text();
await quote();
await sleep(300);
log(`reading: refused=${/No note is being edited/.test(lastNotice())} unchanged=${text() === before5}`);
workspaceStore.setTabMode(draft.id, 'live');
await sleep(500);

// 6. An embed in a note's reading view: the quote goes to Draft, the note
// last edited (Embed.md is in reading mode, so it is never the target).
workspaceStore.setActiveGroup(right);
const embedTab = workspaceStore.openNote('Embed.md', { newTab: true, defaultMode: 'reading' });
workspaceStore.setTabMode(embedTab.id, 'reading');
const embedWin = () => [...document.querySelectorAll('clew-preview-view')].find((v) => v.offsetParent)?.querySelector('iframe')?.contentWindow;
ok = await selectIn(embedWin, 1, 'Its second line.');
const before6 = text();
await quote();
await until(() => text() !== before6, 5000);
if (document.querySelector('.clew-modal')) {
	[...document.querySelectorAll('.clew-modal .modal-result')][0]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	await until(() => text() !== before6, 5000);
}
log(`embed: selected=${ok} into-draft=${text() !== before6 && text().split('Its second line.').length > 2}`);
workspaceStore.closeTab(embedTab.id, { force: true });

// 7. Real PDFs, when the fixture has them.
const has = (name) => JSON.stringify(window.__clew.vaultStore.tree ?? []).includes(`"${name}"`);
if (has('Papers/Real.pdf')) {
	openRight('Papers/Real.pdf');
	ok = await selectIn(() => pdfFrame('Papers/Real.pdf'), 2, { index: 600, length: 320 });
	const before7 = text();
	await quote();
	await until(() => text() !== before7);
	const block = text().split('\n\n').find((b) => b.includes('[[Real.pdf#page=2'));
	log(`real: selected=${ok} cite=${text().includes(cite('real:paper', 2))} link=${text().includes('[[Real.pdf#page=2|PDF p. 2]]')} notice=${JSON.stringify(lastNotice())}`);
	log(`real-block: ${JSON.stringify(block ?? '')}`);
}
if (has('Papers/Real Unlisted.pdf')) {
	openRight('Papers/Real Unlisted.pdf');
	ok = await selectIn(() => pdfFrame('Papers/Real Unlisted.pdf'), 1, { index: 400, length: 260 });
	const before7b = text();
	const quoting3 = quote();
	await until(() => document.querySelector('.clew-modal .modal-result'));
	const rows = document.querySelectorAll('.clew-modal .modal-result').length;
	document.querySelector('.clew-modal .modal-result')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	await quoting3;
	await until(() => text() !== before7b);
	const block = text().split('\n\n').find((b) => b.includes('[[Real Unlisted.pdf#page=1'));
	log(`real-unlisted: selected=${ok} rows=${rows} cite=${/\\cite|\[@/.test(block ?? '')} link=${Boolean(block)}`);
	log(`real-unlisted-block: ${JSON.stringify(block ?? '')}`);
}

// 8. REAL input: the item in the viewer's own selection menu.
openRight('Papers/Paper.pdf');
ok = await selectIn(paper, 2, 'The end of the second page.');
log(`menu-select: selected=${ok}`);
const before8 = text();
(async () => {
	const quoted = await until(() => text() !== before8 && text().includes('The end of the second page.'), 20000);
	log(`menu: quoted=${quoted} cite=${text().includes(cite('skyrms:1996', 2))} notice=${JSON.stringify(lastNotice())}`);
	const count = (text().match(/^> /gm) ?? []).length;
	log(`final: quote-lines=${count} chars=${text().length}`);
	log(`final-text: ${JSON.stringify(text())}`);
})();
await sleep(800);
window.__clewSmokeInput = [
	{ frameClick: { match: 'Paper.pdf', selector: 'path[d^="M5 7h4v5H5z"]' } },
	{ wait: 3000 },
];
