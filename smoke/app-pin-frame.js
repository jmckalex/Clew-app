// app-pin-scenario.js's reading-view half (FRAME_MATCH Pin.md): the preview
// scrolls itself and logs where the pinned holders are at each position.
if (location.protocol === 'clew-preview:' && document.querySelector('clew-app-embed[data-app-pin]')) {
	const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
	const holderFor = (pin) => {
		const el = document.querySelector(`clew-app-embed[data-app-pin="${pin}"]`);
		const key = el?.dataset.appKey;
		return key ? document.querySelector(`.clew-app-holder[data-app-id^="${key}:"]`) : null;
	};
	const top = holderFor('top');
	const bottom = holderFor('bottom');
	const firstFrames = [top?.querySelector('iframe'), bottom?.querySelector('iframe')];
	let loads = 0;
	for (const f of firstFrames) f?.addEventListener('load', () => { loads++; });
	const height = document.documentElement.scrollHeight;
	const max = height - innerHeight;
	for (const y of [0, 600, Math.round(max / 2), max]) {
		window.scrollTo(0, y);
		await frames();
		await new Promise((r) => setTimeout(r, 200));
		const t = top?.getBoundingClientRect();
		const b = bottom?.getBoundingClientRect();
		console.log(`smoke-pin-read: y=${y} scrollY=${Math.round(scrollY)} height-same=${document.documentElement.scrollHeight === height}`
			+ ` ticker=${t ? `top=${Math.round(t.top)} stuck=${top.classList.contains('is-pinned')}` : 'none'}`
			+ ` timer=${b ? `bottom-off=${Math.round(innerHeight - b.bottom)} stuck=${bottom.classList.contains('is-pinned')}` : 'none'}`
			+ ` same-frames=${top?.querySelector('iframe') === firstFrames[0] && bottom?.querySelector('iframe') === firstFrames[1]} loads=${loads}`
			+ ` backdrop=${getComputedStyle(bottom ?? document.body).backgroundColor}`);
	}
}
