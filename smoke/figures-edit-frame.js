// Runs inside the preview iframe for figures-edit-scenario.js. Three phases,
// timed against the scenario's writes; the mark on the rendered <svg> is how
// "the same element survived" is told from "a fresh one rendered".
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const el = () => document.querySelector('tikz-diagram');
const state = () => {
	const node = el();
	const svg = node?.querySelector('svg');
	const box = svg?.getBoundingClientRect();
	return {
		key: node?.dataset.figKey ?? null,
		cls: node?.querySelector('.mpw-figure')?.className.replace('mpw-figure ', '') ?? 'NO-HOST',
		mark: svg?.dataset.smokeMark === '1',
		size: box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none',
		prose: /PROSE-ONE/.test(document.body.textContent) ? 'ONE'
			: /PROSE-TWO/.test(document.body.textContent) ? 'TWO' : '?',
	};
};
const waitFor = async (predicate, ms) => {
	const deadline = Date.now() + ms;
	while (Date.now() < deadline) {
		if (predicate()) return true;
		await sleep(400);
	}
	return false;
};

// Phase 1: the first render, then mark the SVG.
const rendered = await waitFor(() => el()?.querySelector('svg'), 40000);
const first = state();
console.log('smoke-figures-edit-frame: phase1 rendered=' + rendered
	+ ' key=' + first.key + ' state=' + first.cls + ' size=' + first.size + ' prose=' + first.prose);
el()?.querySelector('svg')?.setAttribute('data-smoke-mark', '1');

// Phase 2: the prose edit lands. The figure must be untouched — the mark
// (which no re-render could reproduce) is the proof.
const prose = await waitFor(() => /PROSE-TWO/.test(document.body.textContent), 25000);
await sleep(1500);
const afterProse = state();
console.log('smoke-figures-edit-frame: phase2 prose-arrived=' + prose
	+ ' key-same=' + (afterProse.key === first.key)
	+ ' kept-mark=' + afterProse.mark
	+ ' state=' + afterProse.cls + ' size=' + afterProse.size);

// Phase 3: the figure edit. A new key, a fresh element (no mark), a new size.
const changed = await waitFor(() => el() && el().dataset.figKey !== first.key, 30000);
const settled = await waitFor(() => el()?.querySelector('svg'), 30000);
await sleep(1000);
const afterFigure = state();
console.log('smoke-figures-edit-frame: phase3 key-changed=' + changed
	+ ' rendered=' + settled
	+ ' kept-mark=' + afterFigure.mark
	+ ' size-changed=' + (afterFigure.size !== first.size)
	+ ' key=' + afterFigure.key + ' state=' + afterFigure.cls
	+ ' size=' + afterFigure.size + ' (was ' + first.size + ')'
	+ ' elements=' + document.querySelectorAll('tikz-diagram').length);
