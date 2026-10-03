// How a rendered block's source is reached in live edit (the owner's design,
// 2026-10-03; frame-layer.js#revealButton): an "Edit source" icon over the
// block's upper-right corner, shown on hover — never a click on the graphic,
// never the old thin bar along its top. Over `node
// smoke/make-figure-click-vault.mjs <dir> [main|extra]`, dark theme, REAL
// input.
//
// main — for TikZ, MetaPost and mermaid in turn: a hover on the block, a move
// away, a click on the graphic, a hover then a click on the old top edge,
// then a hover and a click on the icon. Logs:
//   `fc: tikz: shows=3 hides=3 reveals=1 via-icon=1 scroll-delta=0`,
//   the same for metapost, and `fc: mermaid: shows=3 hides=2 …`
//   (shown by the hover, the graphic click's pointer and the icon hover;
//   hidden by leaving, by the edge and — for all but the LAST block — by
//   the pointer moving on to the next block after the icon's click; ONE
//   reveal — the icon's, made while it was up — none from the graphic or
//   the edge)
//   `fc: fade-after-leave ms=…` and `fc: edge: lit=false cursor=auto`
// extra — the keyboard (ArrowDown into the MetaPost figure) and an
// interactive block's own click (the collapsible note embed's title link,
// which opens Other.md), with its icon OUTSIDE the corner:
//   `fc: keyboard revealed=true`
//   `fc: note-icon shown=true outside=true clear-of-frame=true` (read when
//   the icon comes up: by the last line the tab is Other.md, the icon gone)
//   `fc: own-click opened=Other.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, editorPool, settingsStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-fc: ' + s);
const until = async (test, ms = 15000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await test()) return true;
	return false;
};
const mode = String(await ipc.invoke('clew:note-read', { path: 'mode.txt' }).catch(() => 'main')).trim();
settingsStore.set('theme', 'dark');
const tab = workspaceStore.openNote('Note.md', { defaultMode: 'live' });
workspaceStore.setTabMode(tab.id, 'live');
await until(() => editorPool.get(tab.id)?.view);
const view = () => editorPool.get(tab.id).view;
const KINDS = ['tikz', 'metapost', 'mermaid', 'note'];
const slot = (kind) => document.querySelector(`.le-frame-slot[data-kind="${kind}"]`);
const body = (kind) => slot(kind)?.querySelector('.le-frame-body');
const edge = (kind) => slot(kind)?.querySelector('.le-frame-edge');
const iconOf = (kind) => document.querySelector(`.le-frame-reveal[data-kind="${kind}"]`);
const ready = await until(() => KINDS.every((k) => document.querySelector(`.le-frame-slot.is-measured[data-kind="${k}"]`)), 60000);
await sleep(1500);
log(`ready: ${ready} mode=${mode} heights=${KINDS.map((k) => Math.round(slot(k)?.getBoundingClientRect().height ?? -1)).join(',')}`);
const text = () => view().state.doc.toString();
const range = (kind) => {
	const t = text();
	if (kind === 'note') { const from = t.indexOf('![[Other'); return { from, to: t.indexOf(']]', from) + 2 }; }
	const from = t.indexOf('```' + kind);
	return { from, to: t.indexOf('```', from + 3) + 3 };
};
const inside = (kind) => {
	const { from, to } = range(kind);
	const head = view().state.selection.main.head;
	return head >= from && head <= to;
};
const restAt = () => text().indexOf('An opening');
const reset = () => view().dispatch({ selection: { anchor: restAt() } });
reset();
const opacity = (el) => (el ? Math.round(Number(getComputedStyle(el).opacity) * 100) / 100 : 'absent');

if (mode === 'extra') {
	// The keyboard: the cursor at the end of the paragraph before the
	// MetaPost figure, then ArrowDown until it is in the figure.
	const before = text().indexOf('A paragraph after the TikZ figure.') + 'A paragraph after the TikZ figure.'.length;
	view().focus();
	view().dispatch({ selection: { anchor: before } });
	// The note embed's frame, for a click resolved inside it at dispatch time.
	const noteFrame = document.querySelector(`iframe.le-frame[data-frame-id="${slot('note').dataset.frameId}"]`);
	const noteHash = noteFrame?.src.split('/').pop() ?? 'none';
	window.__clewSmokeInput = [
		{ combo: { key: 'ArrowDown' } }, { wait: 250 }, { combo: { key: 'ArrowDown' } }, { wait: 3000 },
		{ move: { selector: '.le-frame-slot[data-kind="note"] .le-frame-body' } }, { wait: 1500 },
		// The embed's title link: the block's own click.
		{ frameClick: { match: noteHash, selector: '.embed-title a, summary a' } }, { wait: 3500 }, { wait: 4000 },
	];
	(async () => {
		await until(() => inside('metapost'), 3000);
		log(`keyboard revealed=${inside('metapost')}`);
		reset();
		// The note embed into the middle of the window (it starts at the
		// window's bottom edge, under the status bar).
		await sleep(300);
		{
			const sd = view().scrollDOM;
			const top = view().lineBlockAt(range('note').from).top;
			sd.scrollTop = Math.max(0, view().documentTop - sd.getBoundingClientRect().top + sd.scrollTop + top - sd.clientHeight * 0.4);
		}
		// The note embed's icon, OUTSIDE its corner (its chevron is there).
		let iconSeen = false;
		let clear = null;
		let outside = null;
		const t0 = Date.now();
		while (Date.now() - t0 < 9000 && workspaceStore.activeTab()?.path !== 'Other.md') {
			const ic = iconOf('note');
			if (ic?.classList.contains('is-shown') && !iconSeen) {
				iconSeen = true;
				outside = ic.classList.contains('is-outside');
				const r = ic.getBoundingClientRect();
				clear = r.left >= body('note').getBoundingClientRect().right;
			}
			await sleep(50);
		}
		log(`note-icon shown=${iconSeen} outside=${outside} clear-of-frame=${clear}`);
		log(`own-click opened=${workspaceStore.activeTab()?.path}`);
	})();
} else {
	const sel = (kind, part) => (part === 'icon' ? `.le-frame-reveal[data-kind="${kind}"]` : `.le-frame-slot[data-kind="${kind}"] .le-frame-${part}`);
	// Away: onto the note's opening line — page content, which hears the
	// pointer (the title bar at the window's corner is a drag region, which
	// does not).
	const opening = view().coordsAtPos(restAt() + 3);
	const away = { move: { x: Math.round(opening.left + 10), y: Math.round((opening.top + opening.bottom) / 2) } };
	const PHASES = [];
	for (const kind of ['tikz', 'metapost', 'mermaid']) {
		PHASES.push(
			[`hover:${kind}`, [{ move: { selector: sel(kind, 'body') } }, { wait: 700 }]],
			[`away:${kind}`, [away, { wait: 700 }]],
			[`graphic:${kind}`, [{ click: { selector: sel(kind, 'body') } }, { wait: 1000 }]],
			[`edgehover:${kind}`, [{ move: { selector: sel(kind, 'edge') } }, { wait: 500 }]],
			[`edge:${kind}`, [{ click: { selector: sel(kind, 'edge') } }, { wait: 1000 }]],
			[`iconhover:${kind}`, [{ move: { selector: sel(kind, 'body') } }, { wait: 600 }]],
			[`icon:${kind}`, [{ click: { selector: sel(kind, 'icon') } }, { wait: 1400 }]],
		);
	}
	window.__clewSmokeInput = PHASES.flatMap(([, evs]) => evs).concat([{ wait: 1500 }]);
	const spans = [];
	let at = 0;
	for (const [name, evs] of PHASES) {
		const len = evs.reduce((n, e) => n + (e.wait ?? 0), 0);
		spans.push({ name, from: at, to: at + len });
		at += len;
	}
	// Verdicts from what happened, not from planned times (the harness's
	// input runs behind its schedule): every show and hide of every icon,
	// every reveal (the cursor entering a block) and whether its icon was
	// up then, and how long an icon took to go after the pointer left.
	(async () => {
		const t0 = Date.now();
		const trace = Object.fromEntries(KINDS.map((k) => [k, { shows: 0, hides: 0, reveals: 0, viaIcon: 0, scroll: [] }]));
		const shown = {};
		let leftAt = null;
		const fades = [];
		const onMove = (e) => {
			// Onto the note's text with an icon up: the pointer has left a block.
			if (e.target?.closest?.('.cm-line') && !e.target.closest('.le-frame-slot') && Object.values(shown).some(Boolean)) leftAt ??= Date.now();
		};
		window.addEventListener('pointermove', onMove, true);
		let lastInside = null;
		let scrollBefore = view().scrollDOM.scrollTop;
		while (Date.now() - t0 < at + 1500) {
			for (const kind of KINDS) {
				const on = Boolean(iconOf(kind)?.classList.contains('is-shown'));
				if (shown[kind] !== on) {
					if (shown[kind] !== undefined) trace[kind][on ? 'shows' : 'hides'] += 1;
					if (!on && leftAt !== null) { fades.push(Date.now() - leftAt); leftAt = null; }
					shown[kind] = on;
				}
			}
			const kind = KINDS.find(inside) ?? null;
			if (kind && kind !== lastInside) {
				trace[kind].reveals += 1;
				if (shown[kind]) trace[kind].viaIcon += 1;
				trace[kind].scroll.push(Math.round(view().scrollDOM.scrollTop - scrollBefore));
				await sleep(300);
				reset();
				await sleep(200);
				scrollBefore = view().scrollDOM.scrollTop;
			}
			lastInside = kind;
			if (!kind) scrollBefore = view().scrollDOM.scrollTop;
			await sleep(40);
		}
		window.removeEventListener('pointermove', onMove, true);
		for (const kind of ['tikz', 'metapost', 'mermaid']) {
			const t = trace[kind];
			log(`${kind}: shows=${t.shows} hides=${t.hides} reveals=${t.reveals} via-icon=${t.viaIcon} scroll-delta=${t.scroll.join(',') || 'none'}`);
		}
		log(`fade-after-leave ms=${fades.join(',')}`);
		log(`edge: lit=${getComputedStyle(edge('tikz')).backgroundColor !== 'rgba(0, 0, 0, 0)'} cursor=${getComputedStyle(edge('tikz')).cursor}`);
	})();
}
