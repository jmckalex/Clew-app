// Runs inside the preview iframe for dl-layout-scenario.js: reports how the
// description list laid itself out. Computed styles, not source — the
// assertion is what the browser did, and the regression this guards against
// (no rule for `dl` anywhere in the pipeline) is invisible in the HTML.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deadline = Date.now() + 20000;
while (Date.now() < deadline && !document.querySelector('dl')) await sleep(400);

const dl = document.querySelector('dl');
if (!dl) {
	console.log('smoke-dl-layout-frame: NO DL');
} else {
	const cs = getComputedStyle(dl);
	console.log('smoke-dl-layout-frame: display=' + cs.display
		+ ' cols=' + cs.gridTemplateColumns
		+ ' dts=' + dl.querySelectorAll('dt').length
		+ ' dds=' + dl.querySelectorAll('dd').length);
	const dts = [...dl.querySelectorAll('dt')];
	const dds = [...dl.querySelectorAll('dd')];
	dts.forEach((dt, i) => {
		const dd = dds[i];
		console.log(`smoke-dl-layout-frame: row${i}`
			+ ' dt-top=' + Math.round(dt.getBoundingClientRect().top)
			+ ' dd-top=' + Math.round(dd.getBoundingClientRect().top)
			+ ' dd-left=' + Math.round(dd.getBoundingClientRect().left)
			+ ' (equal tops = one line)');
	});
	console.log('smoke-dl-layout-frame: dd-margin=' + getComputedStyle(dds[0]).marginInlineStart
		+ ' blocks-per-dd=' + JSON.stringify(dds.map((dd) => dd.children.length))
		+ ' ul-in-dd=' + dl.querySelectorAll('dd ul').length);
	// The first block of a definition must sit on the term's own line: a
	// paragraph's default top margin would drop it half a line.
	const firstBlock = dds[0].firstElementChild;
	console.log('smoke-dl-layout-frame: first-block-margin-top='
		+ (firstBlock ? getComputedStyle(firstBlock).marginTop : 'NONE'));
}
