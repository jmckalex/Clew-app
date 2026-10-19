// The title-page directives — `@title[…]`, `@subtitle+[…]`, `@author[…]`,
// `@institution+[…]`, `@date+[…]` alone on their lines — drawn as a title
// block in live edit, and sized so in reading view (the owner's report,
// 2026-10-19: they read as underlined directive text, in the link colour).
// Writes its own Title.md into any vault (CLEW_SMOKE_VAULT=<an empty folder>,
// CLEW_SMOKE_LOG=1, CLEW_SMOKE_FRAME_SCRIPT=smoke/live-title-frame.js,
// CLEW_SMOKE_FRAME_MATCH=Title.md). Logs (smoke-title:), sizes as a ratio to
// the note's text:
//   title lines=2 size=1.8 weight=700 heading-colour=true plain=true
//         underline=none starts=["Comments on “Agent-Based Models:","What They…"]
//   author size=1.15 plain=true underline=none   subtitle size=1 …
//   institution size=1 …   date size=1.15 today=<D Month YYYY, as the engine>
//   prose-date tp=false     the bare `19 October 2026` line is prose
//   inline tp=false directive=true    `@author[…]` mid-sentence stays a directive
//   sigil tp=true           `@<title>[…]` is the title (the sigils never change a
//                           known name); colon tp=true (`::title[…]`); single tp=false
//                           (`:title[…]`, a <title> element to the engine)
// Then REAL input: a click on the title reveals its source, the line's
// height unchanged — `revealed="@title[Comments on …" height-stable=true`;
// then the tab goes to reading view, where the frame script measures.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, ipc } = window.__clew;
const log = (s) => console.log('smoke-title: ' + s);
const until = async (test, ms = 10000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (test()) return true;
	return false;
};

await ipc.invoke('clew:note-write', { path: 'Title.md', content: [
	'{{TOC}}',
	'',
	'@title[Comments on “Agent-Based Models:',
	'  What They are Good For”]',
	'@author[J. McKenzie Alexander]',
	'19 October 2026',
	'',
	'@title+[A Block Title]',
	'@subtitle+[A subtitle]',
	'@author+[An Author]',
	'@institution+[The LSE]',
	'@date+[@today]',
	'',
	'Written by @author[Someone Else] in a sentence.',
	'',
	'@<title>[A sigil title]',
	'',
	'::title[A colon title]',
	'',
	':title[A single colon]',
	'',
	'# Introduction',
	'',
	'Text.',
	'',
].join('\n') });
const tab = workspaceStore.openNote('Title.md', { newTab: true, defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => document.querySelector('.cm-editor.cm-live .le-tp-title'));
const view = editorPool.get(tab.id).view;
view.dispatch({ selection: { anchor: view.state.doc.length } });
await sleep(300);

const lines = () => [...view.contentDOM.querySelectorAll('.cm-line')];
const lineWith = (s, n = 0) => lines().filter((l) => l.textContent.includes(s))[n];
const base = parseFloat(getComputedStyle(view.contentDOM).fontSize);
const size = (el) => Math.round(parseFloat(getComputedStyle(el).fontSize) / base * 100) / 100;
// Plain: every piece of text on the line is drawn in the line's own colour
// (not the link colour the grammar gives a `[…]`, nor the overlay's bracket
// grey) — the colour of the element holding the text, which is what shows —
// and nothing is underlined.
const texts = (line) => {
	const out = [];
	const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim()) out.push(n.parentElement);
	return out;
};
const plain = (line) => texts(line).every((el) => getComputedStyle(el).color === getComputedStyle(line).color);
const underline = (line) => [line, ...line.querySelectorAll('span')]
	.map((s) => getComputedStyle(s).textDecorationLine).find((d) => d !== 'none') ?? 'none';
const heading = (() => {
	const h = lines().find((l) => l.classList.contains('le-h1'));
	return h ? getComputedStyle(h).color : null;
})();
const report = (what, line, extra = '') => log(`${what} size=${size(line)} weight=${getComputedStyle(line).fontWeight}`
	+ ` plain=${plain(line)} underline=${underline(line)}${extra}`);

const titleLines = lines().filter((l) => l.classList.contains('le-tp-title'));
const t1 = titleLines[0];
log(`title lines=${titleLines.filter((l) => l.textContent.includes('Agent-Based') || l.textContent.includes('What They')).length}`
	+ ` size=${size(t1)} weight=${getComputedStyle(t1).fontWeight} heading-colour=${getComputedStyle(t1).color === heading}`
	+ ` plain=${titleLines.every(plain)} underline=${underline(t1)}`
	+ ` starts=${JSON.stringify(titleLines.slice(0, 2).map((l) => l.textContent.slice(0, 32)))}`);
report('author', lineWith('J. McKenzie Alexander'));
report('subtitle', lineWith('A subtitle'));
report('institution', lineWith('The LSE'));
const dateLine = lines().find((l) => l.classList.contains('le-tp-date'));
report('date', dateLine, ` today=${JSON.stringify(dateLine.textContent)} engine-form=${/^\d{1,2} [A-Z][a-z]+ \d{4}$/.test(dateLine.textContent)}`);
log(`prose-date tp=${lineWith('19 October 2026').classList.contains('le-tp')}`);
const inline = lineWith('in a sentence');
log(`inline tp=${inline.classList.contains('le-tp')} directive=${Boolean(inline.querySelector('.le-directive'))}`);
log(`sigil tp=${lineWith('A sigil title').classList.contains('le-tp')}` + ` colon tp=${lineWith('A colon title').classList.contains('le-tp')}` + ` single tp=${lineWith('A single colon').classList.contains('le-tp')}`);

// REAL input: click the title — its source shows, its height holds.
const height = t1.getBoundingClientRect().height;
const r = t1.getBoundingClientRect();
window.__clewSmokeInput = [{ click: { x: Math.round(r.left + 60), y: Math.round(r.top + r.height / 2) } }, { wait: 4000 }];
setTimeout(async () => {
	await until(() => lines().some((l) => l.textContent.startsWith('@title[Comments')), 2000);
	const shown = lines().find((l) => l.textContent.startsWith('@title[Comments'));
	log(`revealed=${JSON.stringify(shown?.textContent.slice(0, 24))} height-stable=${Math.abs(shown?.getBoundingClientRect().height - height) < 0.5}`);
	workspaceStore.setTabMode(tab.id, 'reading');
	log('done');
}, 300);
