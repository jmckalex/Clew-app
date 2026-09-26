// Runs inside every __clew_block__ document at the end of
// link-preview-scenario.js: the popover's (the one holding the Welcome
// note's "The guide" section) must show that section only, bare.
const headings = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.textContent.trim());
// The OUTER embed — the transclusion the popover asked for — is the body's
// first element; the note may embed others, with chrome of their own.
const embed = document.body.firstElementChild;
console.log(`smoke-lp-frame ${SMOKE_FRAME.slice(0, 6)}: headings=${JSON.stringify(headings)}`
	+ ` section-only=${headings.includes('The guide') && !headings.some((h) => h.startsWith('Welcome to Clew'))}`
	+ ` bare=${Boolean(embed?.classList.contains('is-bare')) && !document.querySelector('.internal-embed:not(.is-bare)')}`);
