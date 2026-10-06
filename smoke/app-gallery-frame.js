// app-gallery-scenario.js's app side (FRAME_MATCH clew-frame): each sample
// app's own state, read inside its frame.
if (location.protocol === 'clew-frame:') {
	const d = document.body.dataset;
	const text = (id) => JSON.stringify((document.getElementById(id)?.textContent ?? '').trim().slice(0, 140));
	const name = document.title;
	let more = '';
	if (name === 'Stock Ticker') {
		// Its network is ONE origin: any other host is refused before a
		// request leaves (no `smoke-net:` line for it).
		const other = await fetch('https://example.com/', { cache: 'no-store' }).then(() => 'reached').catch(() => 'blocked');
		more = `mode=${d.mode} items=${d.items} other-host=${other} first=${JSON.stringify(document.querySelector('.item')?.textContent ?? null)}`;
	}
	else if (name === 'Replicator Dynamics Lab') more = `rest-points=${d.restPoints} inserted=${d.inserted ?? 0} summary=${text('summary')}`;
	else if (name === 'Seminar Picker') {
		const clip = window.clew?.can('clipboard') ? await window.clew.clipboard.paste().catch((e) => `ERR ${e.message}`) : 'no-cap';
		more = `picked=${d.picked ?? '-'} copied=${d.copied ?? '-'} clipboard=${JSON.stringify(clip)}`;
	} else if (name === 'Lecture Timer') more = `logged=${JSON.stringify(d.logged ?? null)} time=${text('time')}`;
	else if (name === 'Writing Progress') more = `words=${d.words} events=${d.events}`;
	else if (name === 'Reading List') more = `count=${d.count} items=${JSON.stringify([...document.querySelectorAll('li .title')].map((t) => t.textContent))}`;
	console.log(`smoke-ag-app: ${name} theme=${d.theme} granted=${JSON.stringify(window.clew ? ['note.read', 'notes.read', 'query', 'app.kv', 'app.secrets', 'clipboard', 'note.write', 'editor.insert', 'links.open', 'network'].filter((c) => window.clew.can(c)) : null)} status=${text('status')} ${more}`);
}
