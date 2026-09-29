// Runs in every card frame after canvas-esc-scenario.js: where focus sat
// when the last Esc was pressed (nothing moves it afterwards), and what the
// card shows at its centre — the point the triple click landed on.
const el = document.activeElement;
const mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
console.log(`smoke-cx-frame ${decodeURIComponent(location.pathname.split('/').pop())} active=${el?.tagName}${el?.id ? '#' + el.id : ''}`
	+ ` centre=${mid?.tagName}${mid?.id ? '#' + mid.id : ''} textarea=${!!document.querySelector('textarea')} owner=${!!document.getElementById('esc-owner')} size=${innerWidth}x${innerHeight}`);
