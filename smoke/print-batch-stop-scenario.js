// "Export notes as PDF (reading view)", second run (after
// smoke/print-batch-scenario.js, over the same vault and CLEW_SMOKE_EXPORT_DIR):
// the PDFs already there are KEPT (CLEW_SMOKE_REPLACE=keep — the new ones
// numbered), and Stop, pressed by REAL input while the first note prints, ends
// the batch after it.
// Logs (smoke-print-batch-stop:):
//   sheet ticked=3
//   stopping "Printing 1 of 3 — Essays/Late/Cat.md"
//   done "Exported 1 of 3 PDFs to <out>." | "Stopped: 2 notes not exported."
// On disk: <out>/Late/Cat 2.pdf beside the Late/Cat.pdf the first run left; no
// Ann 2.pdf or Ben 2.pdf; no `smoke-trash:` line.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log('smoke-print-batch-stop: ' + s);
const $ = (s) => document.querySelector(s);
const sheet = () => $('.clew-print-sheet');
for (let i = 0; i < 200 && !$('.tree-item[data-path="Essays"]'); i++) await sleep(50);

let seen = null;
const timer = setInterval(() => {
	const el = sheet();
	const state = el?.dataset.state ?? null;
	if (state === seen) return;
	seen = state;
	if (state === 'pick') log(`sheet ticked=${document.querySelectorAll('.clew-print-row input:checked').length}`);
	if (state === 'done') {
		log(`done ${[...el.querySelectorAll('.clew-sheet-body > p')].map((p) => JSON.stringify(p.textContent)).join(' | ')}`);
		clearInterval(timer);
	}
}, 10);
window.addEventListener('click', (e) => {
	if (e.target.closest?.('[data-print-action="stop"]')) log(`stopping ${JSON.stringify(sheet().querySelector('.clew-sheet-body p').textContent)}`);
}, true);

window.__clewSmokeInput = [
	{ click: { selector: '.tree-item[data-path="Essays"]' }, button: 'right' },
	{ until: { selector: '.clew-menu' } },
	{ click: { selector: '.clew-menu > .menu-item:nth-child(6)' } },
	{ until: { selector: '.clew-print-sheet[data-state="pick"]' } }, { wait: 200 },
	{ click: { selector: '[data-print-action="export"]' } },
	// The first note's progress, then Stop while it prints.
	{ until: { selector: '.clew-sheet-progress:not(.is-indeterminate)' } },
	{ click: { selector: '[data-print-action="stop"]' } },
	{ until: { selector: '.clew-print-sheet[data-state="done"]', ms: 60000 } }, { wait: 200 },
	{ click: { selector: '[data-print-action="done"]' } }, { wait: 300 },
];
