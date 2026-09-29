// Runs INSIDE each board's reading view; see kanban-width-scenario.js.
const board = document.querySelector('.clew-kanban');
const note = decodeURIComponent(location.pathname).match(/(Board\d)/)?.[1] ?? '?';
if (board) {
	const cols = [...board.querySelectorAll('.kanban-col')];
	const b = board.getBoundingClientRect();
	const visible = () => cols.filter((c) => {
		const r = c.getBoundingClientRect();
		return r.left >= Math.max(0, b.left) - 1 && r.right <= Math.min(innerWidth, b.right) + 1;
	}).length;
	const shown = visible();
	const scrolls = board.scrollWidth > board.clientWidth + 1;
	const barRoom = board.offsetHeight - board.clientHeight;
	board.scrollLeft = board.scrollWidth;
	await new Promise((r) => requestAnimationFrame(r));
	const last = cols.at(-1).getBoundingClientRect();
	const lastReachable = last.right <= Math.min(innerWidth, board.getBoundingClientRect().right) + 1;
	board.scrollLeft = 0;
	await new Promise((r) => requestAnimationFrame(r));
	// A drop finds its column from the event target (query-interact.js), so a
	// point on each visible column must hit that column — through the board's
	// transform.
	const hits = cols.filter((c) => {
		const r = c.getBoundingClientRect();
		if (r.right > innerWidth || r.left < 0) return true;   // off screen: not asked
		return document.elementFromPoint(r.left + r.width / 2, r.top + 12)?.closest('.kanban-col') === c;
	}).length;
	console.log(`smoke-kb-frame ${note}: pane=${innerWidth} text=${Math.round(document.body.clientWidth)} board=${Math.round(b.width)}`
		+ ` cols=${cols.length} visible=${shown} scrolls=${scrolls} scrollbar=${barRoom > 0} last-reachable=${lastReachable}`
		+ ` hit-test=${hits === cols.length}`);
}
