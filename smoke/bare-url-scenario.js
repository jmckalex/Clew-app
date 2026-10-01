// Bare URLs and slashes, reading view vs live edit (jmarkdown 3134543:
// italics got flanking rules and bare URLs are autolinked; jmarkdown-scan.js
// mirrors the rule and live/model.js draws bare URLs as links). Fixture:
// smoke/make-url-vault.sh. Each keyed paragraph (`Kn:`) logs its italics and
// links in LIVE edit here (`smoke-url-live: Kn em=[…] links=[…]`), and
// bare-url-frame.js logs the same from READING view (`smoke-url-read: …`);
// the two lists must match key by key (sort both and diff).
// The table is read from its widget's cells and the footnote with the cursor
// inside it (a concealed footnote is a badge).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, editorPool } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const tab = workspaceStore.openNote('Urls.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
for (let i = 0; i < 100 && !editorPool.get(tab.id)?.view; i++) await sleep(20);
const view = editorPool.get(tab.id).view;
const src = view.state.doc.toString();
view.dispatch({ selection: { anchor: src.indexOf('The end.') } });
await sleep(1200);

// A mark CodeMirror splits around a nested one (a link holding an italic)
// is several spans with one href: joined, so the two views compare.
const joined = (pairs) => {
	const out = [];
	for (const [text, href] of pairs) {
		if (out.length && out.at(-1)[1] === href) out.at(-1)[0] += text;
		else out.push([text, href]);
	}
	return out.map(([text, href]) => `${text}→${href}`);
};
const fmt = (el) => {
	const em = [...el.querySelectorAll('.le-italic, em')].map((e) => e.textContent);
	const links = joined([...el.querySelectorAll('[data-le-href]')]
		.filter((a) => !a.parentElement.closest('[data-le-href]')).map((a) => [a.textContent, a.dataset.leHref]));
	return `em=${JSON.stringify(em)} links=${JSON.stringify(links)}`;
};
const scroller = view.scrollDOM;
const report = (key, el) => console.log(`smoke-url-live: ${key} ${el ? fmt(el) : 'MISSING'}`);
for (let k = 1; k <= 22; k++) {
	const key = `K${k}`;
	if (k === 18) continue;
	if (k === 21) {
		// The table: its widget draws the cells (inline-dom.js).
		scroller.scrollTop = 0;
		const cells = [...document.querySelectorAll('.cm-editor td')].filter((td) => !/K21|other/.test(td.textContent));
		const holder = document.createElement('div');
		for (const td of cells) holder.append(td.cloneNode(true));
		report(key, cells.length ? holder : null);
		continue;
	}
	if (k === 22) {
		view.dispatch({ selection: { anchor: src.indexOf('with /foot/') + 2 } });
		await sleep(600);
	}
	const at = src.indexOf(`${key}:`);
	const block = view.lineBlockAt(at);
	view.scrollDOM.scrollTop = Math.max(0, block.top - 100);
	await sleep(150);
	const line = [...document.querySelectorAll('.cm-editor .cm-line')].find((l) => l.textContent.includes(`${key}:`));
	report(key, line);
}
{
	const at = src.indexOf('/K18/');
	view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(at).top - 100);
	view.dispatch({ selection: { anchor: src.indexOf('The end.') } });
	await sleep(400);
	const line = [...document.querySelectorAll('.cm-editor .cm-line')].find((l) => l.textContent.includes('at the start and at the end'));
	report('K18', line);
}

// Now reading view, for the frame script.
workspaceStore.setTabMode(tab.id, 'reading');
await sleep(4000);
