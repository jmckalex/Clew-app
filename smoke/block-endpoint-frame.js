// Runs INSIDE each live-edit block frame (CLEW_SMOKE_FRAME_MATCH=__clew_block__);
// see block-endpoint-scenario.js. `SMOKE_FRAME` is the frame's hash.
// `content` is the bottom of the lowest in-flow body child — what the block
// really occupies (mermaid's absolute tooltip div takes no room). The scenario's `size=` must equal it: a size that tracks the
// FRAME instead (documentElement.scrollHeight never drops below the frame's
// viewport) is the bug this pins.
const cs = getComputedStyle(document.documentElement);
const content = Math.ceil(Math.max(0, ...[...document.body.children]
	.filter((c) => getComputedStyle(c).display !== 'none' && !/absolute|fixed/.test(getComputedStyle(c).position))
	.map((c) => c.getBoundingClientRect().bottom)));
console.log(`smoke-block-frame ${SMOKE_FRAME}: overflow=${cs.overflow} body-margin=${getComputedStyle(document.body).margin}`
	+ ` mermaid-svg=${Boolean(document.querySelector('.mermaid svg'))} content=${content} viewport=${innerHeight}`);
