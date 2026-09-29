// Runs INSIDE Thumb.md's reading view (CLEW_SMOKE_FRAME_MATCH=Thumb.md); see
// office-bridges-scenario.js. The thumbnail arrives through the office-thumb
// bridge — rendered by an offscreen LibreOffice, so allow minutes.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let img = null;
for (const deadline = Date.now() + 300000; Date.now() < deadline; await sleep(1000)) {
	img = document.querySelector('.office-thumb-img');
	if (img?.complete && img.naturalWidth > 0) break;
	if (document.querySelector('.office-thumb-missing')) break;
}
console.log(`smoke-office-frame thumb=${img?.naturalWidth ? `${img.naturalWidth}x${img.naturalHeight}` : 'none'}`
	+ ` missing=${JSON.stringify(document.querySelector('.office-thumb-missing')?.textContent ?? null)}`);
