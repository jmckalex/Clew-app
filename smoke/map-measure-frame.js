// Runs INSIDE the map note's reading view; see map-measure-scenario.js.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log('smoke-mm-frame: ' + s);
let map = null;
for (const t0 = Date.now(); Date.now() - t0 < 15000 && !map; await sleep(200)) map = document.querySelector('.leaflet-container');
if (!map) log('no map');
else {
	const r = map.getBoundingClientRect();
	// Leaflet takes a click from the DOM; shift is what arms the tool.
	const click = (fx, fy) => {
		const x = r.left + r.width * fx;
		const y = r.top + r.height * fy;
		const at = document.elementFromPoint(x, y) ?? map;
		for (const type of ['mousedown', 'mouseup', 'click']) {
			at.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, shiftKey: true, bubbles: true, cancelable: true, button: 0 }));
		}
	};
	const count = () => ({
		lines: map.querySelectorAll('path[stroke-dasharray]').length,
		readouts: [...map.querySelectorAll('.clew-leaflet-note')].filter((d) => /\d\s*(km|m|mi|ft)$/.test(d.textContent.trim())).length,
	});
	const show = (label) => { const c = count(); log(`${label} lines=${c.lines} readouts=${c.readouts}`); };
	show('real');
	click(0.3, 0.4); await sleep(150);
	click(0.7, 0.6); await sleep(150);
	show('measured');
	click(0.4, 0.3); await sleep(150);
	show('third');
	click(0.6, 0.7); await sleep(150);
	show('fourth');
	map.focus();
	const esc = () => {
		const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		map.dispatchEvent(e);
		return e.defaultPrevented;
	};
	let claimed = esc();
	await sleep(100);
	const c = count();
	log(`esc lines=${c.lines} readouts=${c.readouts} claimed=${claimed}`);
	claimed = esc();
	log(`esc-idle claimed=${claimed}`);
}
