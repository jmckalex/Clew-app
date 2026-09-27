// Runs INSIDE each live-edit block frame (CLEW_SMOKE_FRAME_MATCH=__clew_block__);
// see live-blocks-scenario.js.
const text = document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 60);
// In-flow content only: mermaid appends an absolutely positioned tooltip
// div that counts in scrollHeight but occupies nothing.
const content = Math.ceil(Math.max(0, ...[...document.body.children]
	.filter((c) => getComputedStyle(c).display !== 'none' && !/absolute|fixed/.test(getComputedStyle(c).position))
	.map((c) => c.getBoundingClientRect().bottom + parseFloat(getComputedStyle(c).marginBottom))));
const refused = document.querySelector('.clew-embed-refused, .clew-figure-refused');
console.log(`smoke-lb-frame ${SMOKE_FRAME.slice(0, 6)}: text=${JSON.stringify(text)}`
	+ ` refused-by-name=${Boolean(refused)} has-UPDATED=${document.body.innerText.includes('UPDATED')}`
	+ (document.body.innerText.includes('styled') ? ` styled=${[...document.querySelectorAll('em, strong')].find((e) => e.textContent === 'styled')?.tagName.toLowerCase() ?? 'none'}` : '')
	+ ` mermaid-svg=${Boolean(document.querySelector('.mermaid svg'))} content=${content} frame=${innerHeight}`);
