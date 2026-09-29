// Runs INSIDE every preview frame (CLEW_SMOKE_FRAME_MATCH=vault/); see
// caller-token-scenario.js. A card the engine rendered holds a callout; one
// that fell back to the instant renderer shows `[!note]` as text.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cards = () => [...document.querySelectorAll('.canvas-embed-node')].filter((n) => !n.querySelector('iframe'));
const engine = () => cards().filter((n) => n.querySelector('.callout-title')).length;
const scene = () => Boolean(document.querySelector('.canvas-embed-world'));
for (const t0 = Date.now(); Date.now() - t0 < 10000 && scene() && engine() < cards().length; ) await sleep(200);
const tag = `${SMOKE_FRAME.slice(0, 24)}${location.search}`;
console.log(`smoke-token-frame ${tag}: scene=${scene()} engine-cards=${engine()}`
	+ ` fallback-cards=${cards().filter((n) => n.textContent.includes('[!note]')).length}`);
