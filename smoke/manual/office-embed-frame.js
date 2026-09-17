const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 240000;
let img = null;
while (Date.now() < deadline) {
	img = document.querySelector('.office-thumb-img');
	if (img?.complete && img.naturalWidth > 0) break;
	if (document.querySelector('.office-thumb-missing')) break;
	await sleep(1000);
}
console.log('smoke-manual: thumb=' + (img ? img.naturalWidth + 'x' + img.naturalHeight : 'none')
	+ ' missing=' + JSON.stringify(document.querySelector('.office-thumb-missing')?.textContent ?? null));
