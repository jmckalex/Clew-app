// "Export notes as PDF (reading view)" and `@begin(clew-only)` (the owner's ask,
// 2026-11-24: a folder of marked essays, a PDF each, without the marking
// controls at the top of each). By REAL input: a folder's explorer menu opens
// the sheet with its notes ticked, the filter and "Untick all shown" leave one
// out, Export prints the rest; then the explorer's background menu opens it
// for the whole vault (none ticked), the filter and "Tick all shown" pick the
// three, and the two PDFs already there are replaced (their old copies to the
// Trash). The single note's "Export as PDF (reading view)" of the same essay
// comes first — what `@begin(clew-only)` did before this change.
//
// Writes its own notes into any empty vault. Run with CLEW_SMOKE_VAULT=<it>,
// CLEW_SMOKE_LOG=1, a CLEW_USER_DATA of its own, CLEW_SMOKE_EXPORT_DIR=<an
// empty folder outside it> (the folder dialog's answer), CLEW_SMOKE_REPLACE=
// replace (the "already exist" question's), and CLEW_SMOKE_FRAME_SCRIPT=
// smoke/print-batch-frame.js (reading view of Essays/Ann.md, last). Then
// smoke/print-batch-stop-scenario.js over the same vault and folder.
// Logs (smoke-print-batch:), in order:
//   single <vault>/Single/Ann.pdf      the one-note export (pdftotext it)
//   menu "Export notes as PDF (reading view)…"
//   folder-sheet title="Export notes in \"Essays\" as PDF (reading view)"
//          rows=["Late/Cat.md","Ann.md","Ben.md"] ticked=3 "3 of 3 notes ticked" export-disabled=false
//          (the explorer's order: a folder's subfolders first)
//   before-export shown=[…all three] ticked=2 button="Export 2 PDFs…"
//   progress ["Printing 1 of 2 — Essays/Ann.md","Printing 2 of 2 — Essays/Ben.md"]
//   folder-done "Exported 2 PDFs to <out>."
//   menu "Export notes as PDF (reading view)…"
//   vault-sheet title="Export notes as PDF (reading view)" rows=[the four notes] ticked=0 "0 of 4 notes ticked" export-disabled=true
//   before-export shown=["Essays/Late/Cat.md","Essays/Ann.md","Essays/Ben.md"] ticked=3 button="Export 3 PDFs…"
//   vault-done "Exported 3 PDFs to <out>." | "2 older PDFs of the same name went to the Trash."
//   closed sheet=false
// and the frame script's line (print-batch-frame.js), main's `smoke-reveal: <out>/Ann.pdf` (Show in Finder), two `smoke-trash:`
// lines (the replaced Ann.pdf and Ben.pdf). On disk: <out>/Ann.pdf, Ben.pdf,
// Late/Cat.pdf; pdftotext of each holds its essay and KEPT, none of
// MARKED-BUTTON, SCREEN-NOTE, INLINE-SCREEN — the single note's export of
// before this change held all three.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-print-batch: ' + s);
const $ = (s) => document.querySelector(s);
const sheet = () => $('.clew-print-sheet');
const shownRows = () => [...document.querySelectorAll('.clew-print-row')].filter((r) => !r.hidden).map((r) => r.querySelector('.clew-print-path').textContent);
const tickedCount = () => document.querySelectorAll('.clew-print-row input:checked').length;
const exportButton = () => $('[data-print-action="export"]');
const paragraphs = () => [...sheet().querySelectorAll('.clew-sheet-body > p')].map((p) => JSON.stringify(p.textContent)).join(' | ');

const essay = (name) => [
	`# Essay by ${name}`,
	'',
	'@begin(clew-only)',
	'Marking: <button class="mark-done">MARKED-BUTTON</button> <input class="grade" size="4">',
	'',
	'SCREEN-NOTE for the marker.',
	'@end(clew-only)',
	'',
	`The essay's own text, ESSAY-${name.toUpperCase()}.`,
	'',
	'A remark @clew-only[INLINE-SCREEN] in passing, KEPT.',
	'',
].join('\n');
for (const name of ['Ann', 'Ben']) await ipc.invoke('clew:note-write', { path: `Essays/${name}.md`, content: essay(name) });
await ipc.invoke('clew:note-write', { path: 'Essays/Late/Cat.md', content: essay('Cat') });
await ipc.invoke('clew:note-write', { path: 'Other.md', content: '# Other\n\nNot an essay.\n' });

// What @begin(clew-only) did before: the single note's reading-view PDF.
const single = await ipc.invoke('clew:export-note', { path: 'Essays/Ann.md', format: 'print-pdf', outFile: 'Single/Ann.pdf' });
log(`single ${single?.output}`);
for (let i = 0; i < 200 && !$('.tree-item[data-path="Essays"]'); i++) await sleep(50);

// The trace: every sheet that opens, each state it reaches, every progress
// line — observed, since the input below is queued whole (the harness reads
// the queue once, after this script returns).
let sheets = 0;
let seenState = null;
let progress = [];
const observe = () => {
	const el = sheet();
	if (!el) {
		if (seenState) { seenState = null; if (sheets === 2) finish(); }
		return;
	}
	const state = el.dataset.state;
	if (state !== seenState) {
		seenState = state;
		if (state === 'pick') {
			sheets += 1;
			const tag = sheets === 1 ? 'folder' : 'vault';
			log(`${tag}-sheet title=${JSON.stringify(el.querySelector('h2').textContent)} rows=${JSON.stringify(shownRows())}`
				+ ` ticked=${tickedCount()} ${JSON.stringify($('.clew-print-count').textContent)} export-disabled=${exportButton().disabled}`);
		}
		if (state === 'printing') progress = [];
		if (state === 'done') {
			const tag = sheets === 1 ? 'folder' : 'vault';
			if (tag === 'folder') log(`progress ${JSON.stringify(progress)}`);
			log(`${tag}-done ${paragraphs()}`);
		}
	}
	const line = el.querySelector('.clew-sheet-body p')?.textContent ?? '';
	if (state === 'printing' && line.startsWith('Printing') && progress.at(-1) !== line) progress.push(line);
};
const timer = setInterval(observe, 10);
// Before each Export, what is ticked: the filter and the tick buttons' work.
window.addEventListener('click', (e) => {
	const action = e.target.closest?.('[data-print-action]')?.dataset.printAction;
	if (action === 'export') log(`before-export shown=${JSON.stringify(shownRows())} ticked=${tickedCount()} button=${JSON.stringify(e.target.textContent)}`);
	const item = e.target.closest?.('.clew-menu .menu-item');
	if (item) log(`menu ${JSON.stringify(item.textContent)}`);
}, true);
function finish() {
	clearInterval(timer);
	log(`closed sheet=${Boolean(sheet())}`);
	// Reading view of one essay, for the frame script: the controls drawn.
	workspaceStore.openNote('Essays/Ann.md', { newTab: true, defaultMode: 'reading' });
}

const back = { combo: { key: 'Backspace', code: 'Backspace', modifiers: 0 } };
const tree = $('.file-tree').getBoundingClientRect();
window.__clewSmokeInput = [
	// A folder's menu: its notes, all ticked; the filter and Untick leave Cat out.
	{ click: { selector: '.tree-item[data-path="Essays"]' }, button: 'right' },
	{ until: { selector: '.clew-menu' } },
	{ click: { selector: '.clew-menu > .menu-item:nth-child(6)' } },
	{ until: { selector: '.clew-print-sheet[data-state="pick"]' } }, { wait: 200 },
	{ click: { selector: '.clew-print-filter' } }, { text: 'late' }, { wait: 200 },
	{ click: { selector: '[data-print-action="none"]' } }, { wait: 200 },
	{ click: { selector: '.clew-print-filter' } }, back, back, back, back, { wait: 200 },
	{ click: { selector: '[data-print-action="export"]' } },
	{ until: { selector: '.clew-print-sheet[data-state="done"]', ms: 60000 } }, { wait: 200 },
	{ click: { selector: '[data-print-action="reveal"]' } }, { wait: 300 },
	{ click: { selector: '[data-print-action="done"]' } }, { wait: 400 },
	// The explorer's background (below the last row): the whole vault, none ticked.
	{ click: { x: Math.round(tree.left + tree.width / 2), y: Math.round(tree.bottom - 12) }, button: 'right' },
	{ until: { selector: '.clew-menu' } },
	{ click: { selector: '.clew-menu > .menu-item:nth-child(5)' } },
	{ until: { selector: '.clew-print-sheet[data-state="pick"]' } }, { wait: 200 },
	{ click: { selector: '.clew-print-filter' } }, { text: 'essays' }, { wait: 200 },
	{ click: { selector: '[data-print-action="all"]' } }, { wait: 200 },
	{ click: { selector: '[data-print-action="export"]' } },
	{ until: { selector: '.clew-print-sheet[data-state="done"]', ms: 60000 } }, { wait: 200 },
	{ click: { selector: '[data-print-action="done"]' } },
	{ wait: 3500 },   // reading view of Ann, drawn for the frame script
];
