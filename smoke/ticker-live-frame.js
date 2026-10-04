// ticker-live-scenario.js's app side (FRAME_MATCH clew-frame): the ticker's
// own state at the end, its storage, and Finnhub's two ways of taking a key.
if (location.protocol === 'clew-frame:') {
	const d = document.body.dataset;
	let stored = 'unreadable';
	try { stored = localStorage.getItem('finnhub-key') === null ? 'none' : 'present'; } catch { /* storage refused */ }
	const items = [...document.querySelectorAll('#track .item')].slice(0, 3).map((i) => i.textContent);
	console.log(`smoke-tl-app: mode=${d.mode} badges=${d.badgeLog} badge=${JSON.stringify(d.badge)} requests=${d.requests ?? 0} backoff=${d.backoff ?? '-'} refused=${d.refused ?? '-'} has-key=${d.hasKey} stored=${stored}`);
	console.log(`smoke-tl-app: status=${JSON.stringify(document.getElementById('status').textContent)} items=${JSON.stringify(items)}`);
	// Only where the manifest allows the real finnhub.io (not the stub's test
	// copy): the header route against its real CORS, and the query route (no
	// key: a readable 401).
	const manifest = await fetch('clew-app.json').then((r) => r.json()).catch(() => null);
	if (manifest?.network?.includes('https://finnhub.io')) {
		const real = await fetch('https://finnhub.io/api/v1/quote?symbol=AAPL', { headers: { 'X-Finnhub-Token': 'not-a-key' } })
			.then((r) => `reached ${r.status}`).catch(() => 'blocked');
		const query = await fetch('https://finnhub.io/api/v1/quote?symbol=AAPL&token=not-a-key')
			.then((r) => `reached ${r.status}`).catch(() => 'blocked');
		console.log(`smoke-tl-app: header-route=${real} query-route=${query}`);
	}
}
