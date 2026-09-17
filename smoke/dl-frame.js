// Runs inside the preview iframe for dl-scenario.js: reports how the two
// `::` lines rendered and what the query table read from them.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deadline = Date.now() + 20000;
while (Date.now() < deadline && !(document.querySelector('dl') && document.querySelector('table'))) await sleep(400);

const dls = document.querySelectorAll('dl');
const first = dls[0];
const dt = first?.querySelector('dt')?.textContent.trim() ?? null;
const dd = first?.querySelector('dd')?.textContent.trim() ?? null;
// the bracketed form: the engine makes "The essay scored [grade" the term
const bracketDt = [...document.querySelectorAll('dt')].some((el) => /essay scored/.test(el.textContent));
const proseIntact = [...document.querySelectorAll('p')].some((el) => /essay scored \[grade:: 71\] overall/.test(el.textContent));
// the query table: rows are notes; the DL row's second cell is `mark`
const rows = [...document.querySelectorAll('table tr')].filter((tr) => tr.querySelector('td'));
const dlRow = rows.find((tr) => /^DL\b/.test(tr.querySelector('td')?.textContent.trim() ?? ''));
const markCell = dlRow ? (dlRow.querySelectorAll('td')[1]?.textContent.trim() ?? null) : null;

console.log('smoke-dl-frame: dl=' + dls.length
	+ ' dt=' + JSON.stringify(dt) + ' dd=' + JSON.stringify(dd)
	+ ' bracket-dt=' + bracketDt + ' prose-intact=' + proseIntact
	+ ' query-rows=' + rows.length + ' query-mark=' + JSON.stringify(markCell));
