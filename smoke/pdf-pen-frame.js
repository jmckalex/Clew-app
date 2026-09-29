// Runs INSIDE every preview frame; see pdf-pen-scenario.js. Acts only where a
// PDF viewer lives.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const handles = () => window.__clewPdfHandles ?? new Set();
for (const t0 = Date.now(); Date.now() - t0 < 20000 && ![...handles()].some((h) => h.container); ) await sleep(200);
const handle = [...handles()].find((h) => h.container);
if (handle) {
	const tag = location.pathname.includes('clewpdf') ? 'tab' : 'embed';
	const log = (s) => console.log(`smoke-pen-frame ${tag}: ${s}`);
	const touch = window.__clewPdfTouch;
	log(`handles=${handles().size} armed=${touch.armed}`);
	const cap = (await handle.container.registry).getPlugin('annotation').provides();
	const root = handle.container.shadowRoot;
	// The viewer's scroller, and a point on the page inside it.
	let scroller = null;
	for (const t0 = Date.now(); Date.now() - t0 < 10000 && !scroller; await sleep(200)) {
		scroller = [...root.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 40
			&& /auto|scroll/.test(getComputedStyle(el).overflowY));
	}
	const r = scroller.getBoundingClientRect();
	const x = Math.round(r.left + r.width / 2);
	const y = Math.round(r.top + r.height / 2);
	let id = 100;
	// One gesture: down, a 120 px move up, up — reports whether the module
	// took it (preventDefault on the down) and how far the scroller moved.
	const gesture = (pointerType) => {
		const pointerId = ++id;
		const at = root.elementFromPoint(x, y) ?? handle.target;
		const fire = (type, cy) => at.dispatchEvent(new PointerEvent(type, {
			pointerType, pointerId, clientX: x, clientY: cy, bubbles: true, composed: true, cancelable: true,
			isPrimary: true, buttons: type === 'pointerup' ? 0 : 1,
		}));
		const top0 = scroller.scrollTop;
		const taken = !fire('pointerdown', y);
		fire('pointermove', y - 60);
		fire('pointermove', y - 120);
		fire('pointerup', y - 120);
		return { taken, moved: scroller.scrollTop - top0 };
	};
	cap.setActiveTool('ink');
	await sleep(200);
	let g = gesture('touch');
	log(`touch-before-pen intercepted=${g.taken}`);
	gesture('pen');
	touch.sync();
	await sleep(300);
	log(`pen armed=${touch.armed} watching=${touch.watching} drawing=${touch.drawing}`);
	cap.setActiveTool('ink');
	await sleep(200);
	scroller.scrollTop = 0;
	g = gesture('touch');
	log(`touch-drawing intercepted=${g.taken} panned=${g.moved >= 100}`);
	g = gesture('mouse');
	log(`mouse-drawing intercepted=${g.taken}`);
	cap.setActiveTool(null);
	await sleep(200);
	g = gesture('touch');
	log(`touch-no-tool intercepted=${g.taken}`);
}
