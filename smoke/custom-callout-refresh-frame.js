// callout-refresh-scenario.js's frame half: in each preview frame (reading
// view, live edit's block frames) the remark callout's border and whether
// [!fresh] is a callout.
const remark = document.querySelector('.callout[data-callout="remark"]');
// A block frame's URL ends in its hash; reading view's in the note's name.
const where = /^[0-9a-f]{16,}/.test(SMOKE_FRAME) ? 'embed' : 'reading';
if (!remark) console.log(`smoke-cr-frame: ${where} NO-REMARK body=${JSON.stringify(document.body?.textContent.trim().slice(0, 60))}`);
if (remark) {
	console.log(`smoke-cr-frame: ${where} remark=${getComputedStyle(remark).borderLeftColor}`
		+ ` fresh=${(() => { const f = document.querySelector('.callout[data-callout="fresh"]'); return f ? getComputedStyle(f).borderLeftColor : 'none'; })()}`);
}
