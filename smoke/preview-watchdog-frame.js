// Runs INSIDE every preview frame; see preview-watchdog-scenario.js. The
// theme attribute is set by the host's first message after 'ready', so it
// says whether the bridge opened; A also gets a synthetic later pageshow.
const note = decodeURIComponent(location.pathname).match(/\/([ABC])\.md\.html/)?.[1] ?? '?';
console.log(`smoke-wd-frame ${note}: theme=${document.documentElement.dataset.theme ?? 'none'}`);
if (note === 'A') {
	window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
	await new Promise((r) => setTimeout(r, 500));
}
