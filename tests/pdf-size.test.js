// A PDF embed's height (src/preview-client/pdf-size.js; Clew-iOS 9b0b67e's
// tests, ported): the sizes a link sets, the one-page sum against EmbedPDF's
// own "fit page", and the host held there over a viewer's lifetime — a fake
// host and a fake EmbedPDF registry under plain Node. The real viewer, in
// reading mode and in live edit, is measured by smoke/pdf-size-scenario.js
// (and in Clew-iOS's simulator).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfSizeOptions, plainTitle, onePageHeight, estimateHeight, sizePdfHost, fitPdfToPage, pdfPageOption, pageTop, messageHeight, MESSAGE_CARD } from '../src/preview-client/pdf-size.js';

test('pdfSizeOptions: none by default; height and width from the fragment, Obsidian-style', () => {
	const none = { height: null, width: null };
	assert.deepEqual(pdfSizeOptions('x.pdf'), none);
	assert.deepEqual(pdfSizeOptions(undefined), none);
	assert.deepEqual(pdfSizeOptions('x.pdf#Some heading'), none);
	assert.deepEqual(pdfSizeOptions('x.pdf#height=600'), { height: 600, width: null });
	assert.deepEqual(pdfSizeOptions('x.pdf#height=600px'), { height: 600, width: null });
	assert.deepEqual(pdfSizeOptions('x.pdf# Height = 700 '), { height: 700, width: null }, 'case and spaces');
	assert.deepEqual(pdfSizeOptions('x.pdf#width=480'), { height: null, width: '480px' });
	assert.deepEqual(pdfSizeOptions('x.pdf#width=60%'), { height: null, width: '60%' });
	assert.deepEqual(pdfSizeOptions('Papers/x.pdf#page=3&height=500&width=75%'), { height: 500, width: '75%' }, 'joined by &; page left alone');
});

test('pdfSizeOptions: what is not a size is not one; sizes are held to sense', () => {
	assert.equal(pdfSizeOptions('x.pdf#height=50%').height, null, 'a percentage height would be of the frame: refused');
	assert.equal(pdfSizeOptions('x.pdf#height=abc').height, null);
	assert.equal(pdfSizeOptions('x.pdf#height=600em').height, null);
	assert.equal(pdfSizeOptions('x.pdf#height=10').height, 120, 'too short to use: the least');
	assert.equal(pdfSizeOptions('x.pdf#height=99999').height, 8000);
	assert.equal(pdfSizeOptions('x.pdf#width=20').width, '160px');
	assert.equal(pdfSizeOptions('x.pdf#width=150%').width, '100%');
});

test('plainTitle: the engine\'s "x.pdf § height=600" back to the file\'s name; any other title stays', () => {
	assert.equal(plainTitle('x.pdf#height=600', 'x.pdf § height=600'), 'x.pdf');
	assert.equal(plainTitle('Papers/x.pdf#page=3&height=500&width=75%', 'Papers/x.pdf § page=3&height=500&width=75%'), 'Papers/x.pdf');
	assert.equal(plainTitle('x.pdf#height=600', ' x.pdf § height=600 '), 'x.pdf', 'whitespace round it');
	assert.equal(plainTitle('x.pdf#height=600', 'My paper'), null, 'an alias is the author\'s');
	assert.equal(plainTitle('x.pdf#Methods', 'x.pdf § Methods'), null, 'a fragment that is not sizes');
	assert.equal(plainTitle('x.pdf#height=600&Methods', 'x.pdf § height=600&Methods'), null);
	assert.equal(plainTitle('x.pdf', 'x.pdf'), null, 'no fragment: nothing to do');
	assert.equal(plainTitle(undefined, ''), null);
});

const letter = { width: 612, height: 792 };
const landscape = { width: 792, height: 612 };
const single = (...pages) => pages.map((p) => [{ rotatedSize: p }]);

test('onePageHeight: the gap above, the tallest page at the widest page\'s fit-width scale, the gap to the next', () => {
	const k = 640 / 612;
	assert.equal(onePageHeight({ spreads: single(letter, letter), pageGap: 10, viewportGap: 10, width: 660 }), 10 + 792 * k + 10 * k);
	assert.equal(onePageHeight({ spreads: single(letter), pageGap: 10, viewportGap: 10, width: 660 }), 10 + 792 * k + 10,
		'one page: the viewport\'s gap below it, not a page gap');
	const m = 640 / 792;
	assert.equal(onePageHeight({ spreads: single(letter, landscape), pageGap: 10, viewportGap: 10, width: 660 }), 10 + 792 * m + 10 * m,
		'a landscape page sets the scale, a portrait one the height');
	const spread = [[{ rotatedSize: letter }, { rotatedSize: letter }], [{ rotatedSize: letter }]];
	const s = 640 / (612 * 2 + 8);
	assert.equal(onePageHeight({ spreads: spread, pageGap: 8, viewportGap: 10, width: 660 }), 10 + 792 * s + 8 * s, 'two-page spreads');
	assert.equal(onePageHeight({ spreads: [], viewportGap: 10, width: 660 }), null);
	assert.equal(onePageHeight({ spreads: single(letter), viewportGap: 10, width: 20 }), null);
	assert.equal(onePageHeight({ spreads: single({ width: 0, height: 0 }), width: 660 }), null);
});

test('onePageHeight: in EmbedPDF\'s vertical layout, exactly one page shows, at the top and at the end', () => {
	// The layout as the bundle has it: pages stacked from viewportGap down,
	// pageGap·scale apart, viewportGap after the last; the zoom fit width,
	// (clientWidth − 2·viewportGap) / widest page.
	const gap = 10;
	const pageGap = 10;
	for (const [pages, width] of [[[letter, letter, letter, letter], 660], [[letter, landscape], 980], [[{ width: 420, height: 595 }, { width: 420, height: 595 }], 512]]) {
		const height = Math.floor(onePageHeight({ spreads: single(...pages), pageGap, viewportGap: gap, width }));
		const scale = (width - 2 * gap) / Math.max(...pages.map((p) => p.width));
		const tops = [];
		let y = gap;
		for (const p of pages) { tops.push(y); y += p.height * scale + pageGap * scale; }
		const content = y - pageGap * scale + gap;
		const tallest = Math.max(...pages.map((p) => p.height)) * scale;
		// At the top: page one whole, page two not begun.
		assert.ok(tops[0] + pages[0].height * scale <= height, `${width}px: page one whole`);
		assert.ok(tops[1] >= height, `${width}px: nothing of page two (${tops[1].toFixed(2)} ≥ ${height})`);
		assert.ok(height - gap >= tallest - 1e-9 - pageGap * scale, 'room for the tallest page');
		// At the end: the last page whole.
		const lastTop = tops[tops.length - 1] - (content - height);
		assert.ok(lastTop >= 0, `${width}px: the last page's top in view at the end`);
	}
});

test('estimateHeight: a portrait letter page and a toolbar, before the PDF has said', () => {
	assert.equal(estimateHeight(612), Math.round(612 * 11 / 8.5 + 56));
	assert.equal(estimateHeight(0), estimateHeight(240), 'not yet laid out: still a usable height');
});

/** A `.clew-pdf-inline` host in its engine box, as far as pdf-size.js looks. */
function fakeHost(href, { width = 660 } = {}) {
	const link = { dataset: { href }, textContent: '' };
	const box = { style: { width: '', maxWidth: '' }, querySelector: (sel) => (sel === '.embed-title a[data-href]' ? link : null) };
	const host = {
		failed: false, isConnected: true, clientWidth: width, link, box,
		style: { height: '' },
		get offsetHeight() { return parseFloat(this.style.height) || 0; },
		querySelector: (sel) => (sel === ':scope > .clew-pdf-message' && host.failed ? {} : null),
		closest: (sel) => (sel === '.pdf-embed-box' ? box : null),
	};
	return host;
}

test('sizePdfHost: one page\'s guess by default; the link\'s height and width when it sets them', () => {
	const plain = fakeHost('x.pdf');
	sizePdfHost(plain);
	assert.equal(plain.style.height, `${estimateHeight(660)}px`);
	assert.deepEqual(plain.box.style, { width: '', maxWidth: '' }, 'the box as the engine drew it: the column\'s width');

	const set = fakeHost('x.pdf#height=600&width=480');
	sizePdfHost(set);
	assert.equal(set.style.height, '600px');
	assert.deepEqual(set.box.style, { width: '480px', maxWidth: '100%' }, 'the width on the box, never past the column');
	const percent = fakeHost('x.pdf#width=60%');
	sizePdfHost(percent);
	assert.deepEqual(percent.box.style, { width: '60%', maxWidth: '100%' }, 'a percentage of the column');
	percent.box.style = { width: '', maxWidth: '' };   // a morph: the engine's markup again
	sizePdfHost(percent);
	assert.equal(percent.box.style.width, '60%', 'set again after it');
});

test('sizePdfHost: the title loses the options, and again after a re-render puts them back', () => {
	const host = fakeHost('x.pdf#height=600');
	host.link.textContent = 'x.pdf § height=600';
	sizePdfHost(host);
	assert.equal(host.link.textContent, 'x.pdf');
	host.link.textContent = 'x.pdf § height=600';   // the morph's
	sizePdfHost(host);
	assert.equal(host.link.textContent, 'x.pdf');
	host.failed = true;
	host.link.textContent = 'x.pdf § height=600';
	sizePdfHost(host);
	assert.equal(host.link.textContent, 'x.pdf', 'a failed viewer\'s title too');
});

test('sizePdfHost after a re-render: an edited link changes the sizes; a measured height is kept', () => {
	const host = fakeHost('x.pdf#height=600&width=480');
	sizePdfHost(host);
	host.link.dataset.href = 'x.pdf';
	sizePdfHost(host);
	assert.equal(host.style.height, `${estimateHeight(660)}px`, 'the size taken out: one page again');
	assert.deepEqual(host.box.style, { width: '', maxWidth: '' }, 'and the width');
	host.style.height = '901px';   // as a viewer would have fitted it
	sizePdfHost(host);
	assert.equal(host.style.height, '901px', 'a plain re-render leaves it be');
	host.failed = true;
	sizePdfHost(host);
	assert.equal(host.style.height, '', 'a viewer that failed: as tall as its message');
});

/** EmbedPDF as fitPdfToPage reaches it: a viewport under a toolbar of `chrome` px. */
function fakeViewer(host, { pages, chrome = 50, gap = 10, status = 'loaded' }) {
	const listeners = new Set();
	const events = { zoom: new Set(), opened: new Set(), error: new Set(), scroll: new Set() };
	const on = (set) => (cb) => { set.add(cb); return () => set.delete(cb); };
	const view = { top: 0, status };   // where the document is scrolled; whether it opened
	const metrics = () => ({ clientWidth: host.clientWidth - 2, clientHeight: host.offsetHeight - chrome, scrollTop: view.top });
	const calls = { zoom: [], center: [], scrollTo: [] };
	let zoomLevel = 'fit-page';   // EmbedPDF's default, as the viewport mounts
	const plugins = {
		viewport: {
			// A scroll it is asked for is reported, as EmbedPDF's scroll event is.
			getMetrics: metrics, getViewportGap: () => gap,
			scrollTo: (to) => { calls.scrollTo.push(to); view.top = to.y; for (const cb of [...events.scroll]) cb({ documentId: 'doc' }); },
			onViewportResize: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
			onScrollChange: on(events.scroll),
		},
		zoom: {
			getState: () => ({ zoomLevel }),
			requestZoom: (level, center) => { calls.zoom.push(level); calls.center.push(center); zoomLevel = level; },
			onZoomChange: on(events.zoom),
		},
		scroll: {
			getPageGap: () => 10,
			forDocument: (id) => ({ getSpreadPagesWithRotatedSize: () => (id === 'doc' && view.status === 'loaded' ? single(...pages) : []) }),
		},
		'document-manager': {
			getActiveDocumentId: () => 'doc', getDocumentState: (id) => (id === 'doc' ? { status: view.status } : null),
			onDocumentOpened: on(events.opened), onDocumentError: on(events.error),
		},
	};
	let disposed = 0;
	const handle = {
		container: { registry: Promise.resolve({ getPlugin: (id) => ({ provides: () => plugins[id] }) }) },
		dispose() { disposed += 1; },
	};
	// The viewer's own resize report: what EmbedPDF's ResizeObserver sends.
	// Each is answered on the next frame (a timer under Node).
	const resize = async () => {
		for (const cb of [...listeners]) cb({ documentId: 'doc', metrics: metrics() });
		await frame();
	};
	// EmbedPDF's other reports: a re-zoom, a document opened or not.
	const emit = async (name) => {
		for (const cb of [...events[name]]) cb({ documentId: 'doc' });
		await frame();
	};
	return { handle, resize, emit, listeners, events, view, calls, disposed: () => disposed };
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 5));

const fitted = (host, pages, chrome, gap = 10) =>
	chrome + Math.floor(onePageHeight({ spreads: single(...pages), pageGap: 10, viewportGap: gap, width: host.clientWidth - 2 }));

test('fitPdfToPage: fit width, one page tall, at the top of page one; it follows the width', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter, letter, letter] });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	assert.deepEqual(viewer.calls.zoom, ['fit-width'], 'fit width, asked of the mounted viewport');
	assert.equal(host.offsetHeight, fitted(host, [letter, letter, letter], 50), 'one page under the toolbar');
	assert.equal(viewer.calls.scrollTo.length, 0, 'not scrolled before it has settled');
	await viewer.resize();
	assert.equal(host.offsetHeight, fitted(host, [letter, letter, letter], 50), 'its own resize report changes nothing');
	assert.deepEqual(viewer.calls.scrollTo, [{ x: 0, y: 0, behavior: 'instant' }], 'settled: the top of page one');

	host.clientWidth = 420;   // a rotation, a split, the ⟷ toggle
	await viewer.resize();
	assert.equal(host.offsetHeight, fitted(host, [letter, letter, letter], 50));
	await viewer.resize();
	assert.equal(viewer.calls.scrollTo.length, 1, 'scrolled to the top once only — the reader\'s place is theirs');
	assert.deepEqual(viewer.calls.zoom, ['fit-width'], 'and the zoom asked for once only');

	host.link.dataset.href = 'x.pdf#height=500';   // the note sets a height
	sizePdfHost(host);
	assert.equal(host.style.height, '500px');
	host.clientWidth = 700;
	await viewer.resize();
	assert.equal(host.style.height, '500px', 'a set height is the note\'s, whatever the width');

	host.link.dataset.href = 'x.pdf';   // and takes it out again
	sizePdfHost(host);
	await frame();
	assert.equal(host.offsetHeight, fitted(host, [letter, letter, letter], 50), 'fitted at once, the viewer being up');

	viewer.handle.dispose();
	assert.equal(viewer.disposed(), 1, 'the viewer\'s own dispose still runs');
	assert.equal(viewer.listeners.size, 0, 'and the resize listener goes with it');
	assert.deepEqual(Object.values(viewer.events).map((set) => set.size), [0, 0, 0, 0], 'and the zoom, document and scroll listeners');
});

test('fitPdfToPage: fit width is asked at the top-left corner, so the page grows down from the top', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter, letter] });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	assert.deepEqual(viewer.calls.center, [{ vx: 0, vy: 0 }], 'EmbedPDF\'s own anchor, the centre, left the page 36px down');
});

test('fitPdfToPage: a PDF of one page is rounded UP, with room below — a viewport a fraction short of it would scroll', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter] });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();
	const exact = onePageHeight({ spreads: single(letter), pageGap: 10, viewportGap: 10, width: host.clientWidth - 2 });
	assert.notEqual(Math.ceil(exact), Math.floor(exact), 'a sum with a fraction, or this proves nothing');
	assert.equal(host.offsetHeight, 50 + Math.ceil(exact) + 10, 'and room for the line box under EmbedPDF\'s page');
	assert.deepEqual(viewer.calls.zoom, ['fit-width']);
});

test('fitPdfToPage: two widths taking turns (a scrollbar that comes and goes) are corrected a few times, never forever', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter, letter] });
	const registry = await viewer.handle.container.registry;
	let flip = false;
	registry.getPlugin('viewport').provides().getMetrics = () => {
		flip = !flip;
		return { clientWidth: flip ? 600 : 608, clientHeight: host.offsetHeight - 50, scrollTop: 0 };
	};
	await fitPdfToPage(host, viewer.handle);
	await frame();
	const heights = [host.offsetHeight];
	for (let i = 0; i < 30; i++) {
		await viewer.resize();
		heights.push(host.offsetHeight);
	}
	assert.equal(new Set(heights.slice(-10)).size, 1, `it stops: ${heights.join(', ')}`);
	assert.ok(new Set(heights).size <= 6, `a few corrections: ${heights.join(', ')}`);
});

test('fitPdfToPage: after a width change, a document within the viewport\'s gap of the top goes back to it; further down is the reader\'s', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter, letter, letter] });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();
	assert.equal(viewer.calls.scrollTo.length, 1, 'the top of page one, at the start');

	viewer.view.top = 4;   // EmbedPDF's re-zoom after a narrowing: at most its 10px gap
	host.clientWidth = 420;
	await viewer.resize();
	await viewer.resize();
	assert.equal(viewer.calls.scrollTo.length, 2, 'back to the top');
	assert.equal(viewer.view.top, 0);

	viewer.view.top = 300;   // the reader, on page two
	host.clientWidth = 560;
	await viewer.resize();
	await viewer.resize();
	assert.equal(viewer.calls.scrollTo.length, 2, 'left where the reader is');
	assert.equal(viewer.view.top, 300);
});

test('fitPdfToPage: a PDF EmbedPDF cannot open is as tall as its message; opened after a password, it is one page', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter, letter], status: 'error' });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();
	assert.equal(host.style.height, `${56 + 440}px`, 'EmbedPDF\'s card or password prompt under its toolbar (56px, the guess: no viewport to measure)');
	assert.deepEqual(viewer.calls.zoom, [], 'no zoom asked of a document that is not there');
	assert.equal(viewer.calls.scrollTo.length, 0);

	viewer.view.status = 'loaded';   // the password was right
	await viewer.emit('opened');
	await viewer.resize();
	assert.deepEqual(viewer.calls.zoom, ['fit-width']);
	assert.equal(host.offsetHeight, fitted(host, [letter, letter], 50), 'one page');

	const set = fakeHost('x.pdf#height=600');
	sizePdfHost(set);
	const locked = fakeViewer(set, { pages: [letter, letter], status: 'error' });
	await fitPdfToPage(set, locked.handle);
	await frame();
	await locked.resize();
	assert.equal(set.style.height, `${56 + 440}px`, 'the message, whatever height the link sets');
	sizePdfHost(set);   // a re-render
	assert.equal(set.style.height, `${56 + 440}px`, 'still the message');
	locked.view.status = 'loaded';
	await locked.emit('opened');
	assert.equal(set.style.height, '600px', 'opened: the link\'s height');
});

test('fitPdfToPage: EmbedPDF\'s own re-zoom after a resize is measured, once a frame', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter, letter] });
	const registry = await viewer.handle.container.registry;
	const vp = registry.getPlugin('viewport').provides();
	let reads = 0;
	const getMetrics = vp.getMetrics;
	vp.getMetrics = () => { reads += 1; return getMetrics(); };
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();   // settled, and placed at its page
	const before = reads;
	await viewer.emit('zoom');
	assert.equal(reads, before + 1);
});

test('fitPdfToPage: a set height still reads at fit width; a zoom that is not the default is left alone', async () => {
	const host = fakeHost('x.pdf#height=400');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter, letter] });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	assert.deepEqual(viewer.calls.zoom, ['fit-width']);
	assert.equal(host.style.height, '400px');

	const other = fakeHost('x.pdf');
	sizePdfHost(other);
	const chosen = fakeViewer(other, { pages: [letter, letter] });
	const registry = await chosen.handle.container.registry;
	registry.getPlugin('zoom').provides().getState = () => ({ zoomLevel: 1.5 });
	await fitPdfToPage(other, chosen.handle);
	await frame();
	await chosen.resize();
	assert.deepEqual(chosen.calls.zoom, [], 'a zoom of 150% stays');
});

test('fitPdfToPage: one resize answered per frame, however many reports come', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter] });
	const registry = await viewer.handle.container.registry;
	const vp = registry.getPlugin('viewport').provides();
	let reads = 0;
	const getMetrics = vp.getMetrics;
	vp.getMetrics = () => { reads += 1; return getMetrics(); };
	await fitPdfToPage(host, viewer.handle);
	for (const cb of [...viewer.listeners]) { cb({}); cb({}); cb({}); }
	await frame();
	assert.equal(reads, 1, 'four asks before the frame: one measure');
});

test('fitPdfToPage: a viewer whose chrome grows with it is corrected a few times, never forever', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter] });
	// A sidebar stacked under the page, a third of the viewer's height: every
	// correction grows it too, so the viewport is never quite one page.
	const metrics = () => ({ clientWidth: host.clientWidth - 2, clientHeight: Math.round(host.offsetHeight * 2 / 3) - 50 });
	const registry = await viewer.handle.container.registry;
	registry.getPlugin('viewport').provides().getMetrics = metrics;
	await fitPdfToPage(host, viewer.handle);
	await frame();
	const heights = [host.offsetHeight];
	for (let i = 0; i < 20; i++) {
		await viewer.resize();
		heights.push(host.offsetHeight);
	}
	assert.equal(new Set(heights).size, 4, `four corrections, then it stops: ${heights.join(', ')}`);
});

test('fitPdfToPage: no viewer, no registry, no document — nothing happens and nothing throws', async () => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const before = host.style.height;
	await fitPdfToPage(host, null);
	await fitPdfToPage(host, { container: null });
	await fitPdfToPage(host, { container: { registry: Promise.reject(new Error('gone')) } });
	const viewer = fakeViewer(host, { pages: [] });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	assert.equal(host.style.height, before);
});

// ---- #page=N (the owner's yes, 2026-10-15) ----

test('pdfPageOption: the page a link names, Obsidian-style, with sizes or alone', () => {
	assert.equal(pdfPageOption('x.pdf'), null);
	assert.equal(pdfPageOption('x.pdf#page=3'), 3);
	assert.equal(pdfPageOption('x.pdf#page=3&height=600'), 3);
	assert.equal(pdfPageOption('Papers/x.pdf#height=600&page=12&width=60%'), 12);
	assert.equal(pdfPageOption('x.pdf# Page = 4 '), 4, 'case and spaces');
	assert.equal(pdfPageOption('x.pdf#page=0'), null, 'pages count from one');
	assert.equal(pdfPageOption('x.pdf#page=2.5'), null);
	assert.equal(pdfPageOption('x.pdf#page=abc'), null);
	assert.equal(pdfPageOption('x.pdf#Methods'), null, 'a heading, not a page');
	assert.equal(plainTitle('x.pdf#page=3', 'x.pdf § page=3'), 'x.pdf', 'and the title is the file\'s name');
});

test('pageTop: a page\'s top in EmbedPDF\'s layout — the spreads before it and their gaps, scaled', () => {
	const pages = single(letter, landscape, letter, letter);
	assert.equal(pageTop({ spreads: pages, page: 1, scale: 2, pageGap: 10 }), 0, 'page one at the top');
	assert.equal(pageTop({ spreads: pages, page: 2, scale: 2, pageGap: 10 }), (792 + 10) * 2);
	assert.equal(pageTop({ spreads: pages, page: 3, scale: 0.5, pageGap: 10 }), (792 + 10 + 612 + 10) * 0.5, 'each spread its own height');
	assert.equal(pageTop({ spreads: pages, page: 99, scale: 1, pageGap: 10 }), pageTop({ spreads: pages, page: 4, scale: 1, pageGap: 10 }), 'past the end: the last');
	const spread = [[{ rotatedSize: letter }, { rotatedSize: letter }], [{ rotatedSize: letter }, { rotatedSize: landscape }], [{ rotatedSize: letter }]];
	assert.equal(pageTop({ spreads: spread, page: 2, scale: 1, pageGap: 8 }), 0, 'two-page spreads: page two shares page one\'s');
	assert.equal(pageTop({ spreads: spread, page: 4, scale: 1, pageGap: 8 }), 792 + 8);
	assert.equal(pageTop({ spreads: spread, page: 5, scale: 1, pageGap: 8 }), (792 + 8) * 2);
});

/** The scale fitPdfToPage reads at: fit width, as the fakes have no zoom level. */
const fitScale = (host, pages) => (host.clientWidth - 2 - 2 * 10) / Math.max(...pages.map((p) => p.width));
const topOf = (host, pages, page, width = host.clientWidth) => pageTop({ spreads: single(...pages), page, scale: fitScale({ clientWidth: width }, pages), pageGap: 10 });
const four = [letter, letter, letter, letter];

test('fitPdfToPage: #page=3 opens at page three\'s top, one page tall', async () => {
	const host = fakeHost('x.pdf#page=3');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: four });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();
	assert.equal(host.offsetHeight, fitted(host, four, 50), 'the height is one page, as without #page=');
	assert.deepEqual(viewer.calls.scrollTo, [{ x: 0, y: topOf(host, four, 3), behavior: 'instant' }]);
	assert.ok(viewer.view.top > 0);
});

test('fitPdfToPage: a page past the end opens at the last; with a height set, the page still', async () => {
	const host = fakeHost('x.pdf#page=99');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: four });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();
	assert.equal(viewer.view.top, topOf(host, four, 4), 'the nearest page: the fourth');

	const set = fakeHost('x.pdf#page=2&height=400');
	sizePdfHost(set);
	const other = fakeViewer(set, { pages: four });
	await fitPdfToPage(set, other.handle);
	await frame();
	assert.equal(set.style.height, '400px');
	assert.equal(other.view.top, topOf(set, four, 2));
});

test('fitPdfToPage: an edit to the link goes to its page; a re-render that leaves it as it was keeps the reader\'s place', async () => {
	const host = fakeHost('x.pdf#page=3');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: four });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();
	viewer.view.top = 1234;   // the reader scrolls on
	sizePdfHost(host);        // a re-render, the link unchanged
	await frame();
	assert.equal(viewer.view.top, 1234, 'left where the reader is');
	host.link.dataset.href = 'x.pdf#page=2';   // the link edited
	sizePdfHost(host);
	await frame();
	assert.equal(viewer.view.top, topOf(host, four, 2), 'page two');
	host.link.dataset.href = 'x.pdf';           // and the page taken out
	sizePdfHost(host);
	await frame();
	assert.equal(viewer.view.top, 0, 'page one');
});

test('fitPdfToPage: after a width change, a document a re-zoom left near its page\'s top goes back to it', async () => {
	const host = fakeHost('x.pdf#page=2');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: four });
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await viewer.resize();
	host.clientWidth = 420;
	// What EmbedPDF's re-zoom leaves (the fake has none): page two's top at
	// the new width, a few pixels off — its sums keep the viewport gap unscaled.
	viewer.view.top = topOf(host, four, 2) + 6;
	await viewer.resize();
	await viewer.resize();
	assert.equal(viewer.view.top, topOf(host, four, 2), 'page two\'s top at the new width');
	viewer.view.top = topOf(host, four, 3) + 40;   // the reader, on page three
	host.clientWidth = 600;
	await viewer.resize();
	await viewer.resize();
	assert.equal(viewer.view.top, topOf(host, four, 3, 420) + 40, 'far from it: the reader\'s place');
});

// ---- EmbedPDF's card for a PDF it cannot open, measured (Clew-iOS: a 516px
// password prompt clipped in a fixed 445px area at an iPad's 208px) ----

/** The area's padding, as a page's getComputedStyle has it (Node has none). */
function padded(t, area) {
	globalThis.getComputedStyle = (el) => (el === area ? { paddingTop: '32px', paddingBottom: '32px' } : {});
	t.after(() => { delete globalThis.getComputedStyle; });
}

/** A host whose EmbedPDF shows its message card: `card` px tall, the area
 *  under a 51px toolbar padded 32px each side. */
function withCard(host, card) {
	const area = { get offsetHeight() { return host.offsetHeight - 51; } };
	const el = { offsetHeight: card, parentElement: area };
	const root = { querySelector: (sel) => (sel === MESSAGE_CARD ? el : null) };
	const query = host.querySelector;
	host.querySelector = (sel) => (sel === '*' ? { shadowRoot: root } : query(sel));
	return { area, el };
}

test('messageHeight: the toolbar, the card and its area\'s padding — none before the card is drawn', (t) => {
	const host = fakeHost('x.pdf');
	host.style.height = '496px';
	assert.equal(messageHeight(host), null, 'no card yet');
	const { area } = withCard(host, 428);
	padded(t, area);
	assert.equal(messageHeight(host), 51 + 428 + 64);
});

test('fitPdfToPage: a PDF it cannot open is as tall as its card, measured — a narrow viewer\'s taller prompt fits', async (t) => {
	const host = fakeHost('x.pdf');
	sizePdfHost(host);
	const viewer = fakeViewer(host, { pages: [letter], status: 'error' });
	const { area } = withCard(host, 516);
	padded(t, area);
	await fitPdfToPage(host, viewer.handle);
	await frame();
	await frame();
	assert.equal(host.offsetHeight, 51 + 516 + 64, 'the whole prompt, not 56 + 440');
	await viewer.resize();
	assert.equal(host.offsetHeight, 51 + 516 + 64, 'and it stays');
});
