// Frame script for smoke/print-batch-scenario.js: reading view of
// Essays/Ann.md draws what `@begin(noprint)` holds — the box, its button and
// field, the inline form in its sentence — and the document's print rules hide
// the box (preview.css, which the reading-view PDF prints with).
// Logs (smoke-print-batch-frame:):
//   boxes=2 shown=[true,true] button=true input=true inline-in-sentence=true print-rule=true
const boxes = [...document.querySelectorAll('.clew-noprint')];
const shown = boxes.map((b) => getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0);
const inline = boxes.find((b) => b.tagName === 'SPAN');
let printRule = false;
for (const sheet of document.styleSheets) {
	let rules = [];
	try { rules = [...sheet.cssRules]; } catch { continue; }
	for (const rule of rules) {
		if (rule instanceof CSSMediaRule && rule.media.mediaText === 'print') {
			printRule ||= [...rule.cssRules].some((r) => r.selectorText === '.clew-noprint' && r.style.display === 'none');
		}
	}
}
console.log('smoke-print-batch-frame: ' + [
	`boxes=${boxes.length}`, `shown=${JSON.stringify(shown)}`,
	`button=${Boolean(document.querySelector('.clew-noprint button.mark-done'))}`,
	`input=${Boolean(document.querySelector('.clew-noprint input.grade'))}`,
	`inline-in-sentence=${Boolean(inline && /in passing, KEPT/.test(inline.parentElement.textContent))}`,
	`print-rule=${printRule}`,
].join(' '));
