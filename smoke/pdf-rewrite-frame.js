// Runs INSIDE every preview frame; see pdf-rewrite-scenario.js.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (location.pathname.includes('/clewpdf/')) {
	const params = new URLSearchParams(location.search);
	if (params.get('page')) {
		let page = null;
		for (let i = 0; i < 40; i++) { page = window.__clewPdfHandle?.currentPage?.(); if (page === 3) break; await sleep(250); }
		console.log(`smoke-pr-frame viewer asked=${params.get('page')} page=${page}`);
	}
} else if (document.querySelector('h1')?.textContent.trim() === 'Reading') {
	const viewers = [...document.querySelectorAll('iframe[data-clew-pdf]')];
	const raw = [...document.querySelectorAll('iframe, embed, object')].filter((el) => {
		if (el.matches('[data-clew-pdf]') || el.classList.contains('pdf-embed')) return false;
		const target = el.getAttribute('src') ?? el.getAttribute('data') ?? '';
		return /\.pdf(#|\?|$)/i.test(target);
	});
	const first = viewers.find((v) => v.dataset.clewPdf === 'Paper.pdf' && v.getAttribute('width') === '600');
	const textFrame = [...document.querySelectorAll('iframe')].find((f) => f.getAttribute('src') === 'notes.txt');
	const ownEmbed = document.querySelector('.pdf-embed-box');
	console.log(`smoke-pr-frame viewers=${viewers.length} raw-pdf=${raw.length} sizes=${Boolean(first && first.getAttribute('height') === '400')}`
		+ ` text-frame-untouched=${Boolean(textFrame)} fallback-gone=${!document.body.textContent.includes('fallback text')}`
		+ ` own-embed=${Boolean(ownEmbed)} targets=${JSON.stringify(viewers.map((v) => v.dataset.clewPdf))}`);
}
