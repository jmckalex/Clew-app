// "Convert this vault" — the colon directives' retirement, phase 2
// (renderer/colon-conversion.js, main/colon-conversion.js), driven through its
// commands and the sheet's own buttons, as a user would. Any vault: the demo
// vault's copy (the round trip), make-colon-vault.mjs's 5k notes (the cost).
// Options come from `.colon-smoke.json` in the vault root (a dotfile: no walk
// sees it):
//   { "cycles": ["none", "all"],   one convert → second dry run → undo cycle
//                                  each: "none" ticks nothing (the default, all
//                                  but the output changes), "all" every box
//     "exportDir": "/abs",          export the notes the dry run lists as HTML
//                                  and LaTeX before (before/) and after each
//                                  conversion (after-<cycle>/), for a diff
//     "verify": true,               read every note first, and after each undo
//                                  say whether each is exactly as it was
//     "editor": "Guide/Live Edit.md" }   open in source mode first: converted
//                                  as a transaction on its editor and saved,
//                                  put back by undo (the editor reloads)
// Logs (smoke-colon:):
//   scan <cycle> wall=… frames: n=… max=… over16=… longtasks=…   the dry run,
//            the window's frames while it ran (rAF intervals; a frame longer
//            than 16.7 ms is `over16`) and the longtask observer's count
//   sheet <cycle> groups=[…] button="…"   what the sheet offered
//   words <cycle> [group: its line [box: …]]   each group's words, which agree
//            with its count ("1 directive … renders", "this one")
//   open-list <cycle> <group> folds=… frames …   the biggest folded list opened
//   apply <cycle> wall=… frames: …  result="…"
//   again <cycle> groups=[…]              the second dry run, after converting
//   undo <cycle> result="…"  identical=true changed=[]
//   editor <cycle> converted=true dirty=false disk=doc · after
//            undo: doc=original   the note open in an editor, when asked
//   loads <path> by=… auto=0 rows=[name:needs-you+anyway …]   each note that
//            loads directives, from a last dry run: all needs-you
// Main's own lines carry its cost: `colon-scan: … — <ms>, peak RSS, longest slice`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, workspaceStore, editorPool, registry, ipc } = window.__clew;
const log = (s) => console.log('smoke-colon: ' + s);
const until = async (test, ms = 600000) => {
	for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(20)) if (test()) return true;
	return false;
};
const sheet = () => document.querySelector('.clew-colon-sheet');
const state = () => sheet()?.dataset.state ?? null;
const click = (sel) => {
	const b = sheet()?.querySelector(sel);
	if (!b) throw new Error(`no ${sel} in the sheet (state ${state()})`);
	b.click();
};
const groups = () => [...(sheet()?.querySelectorAll('section[data-group]') ?? [])].map((s) => `${s.dataset.group}:${s.querySelector('h3')?.textContent}`);
const summary = () => sheet()?.querySelector('.clew-colon-summary')?.textContent ?? '';

/** The window's frames while `fn` runs: rAF intervals, tagged by the sheet's
 *  state when each ended, and longtasks (≥50 ms) seen meanwhile. */
async function frames(fn, phase) {
	const out = [];
	let on = true, last = null;
	const loop = (t) => {
		if (last !== null) out.push({ dt: t - last, state: state() });
		last = t;
		if (on) requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
	let longtasks = 0;
	const po = new PerformanceObserver((list) => { longtasks += list.getEntries().length; });
	try { po.observe({ type: 'longtask', buffered: false }); } catch { /* not offered */ }
	const result = await fn();
	await sleep(300);
	on = false;
	po.disconnect();
	const during = out.filter((f) => f.state === phase);
	const stat = (list) => {
		const dts = list.map((f) => f.dt).sort((a, b) => a - b);
		const p = (q) => dts.length ? dts[Math.min(dts.length - 1, Math.floor(q * dts.length))].toFixed(1) : '-';
		return `n=${dts.length} max=${dts.length ? dts.at(-1).toFixed(1) : '-'} p99=${p(0.99)} median=${p(0.5)} over16=${dts.filter((d) => d > 16.7).length}`;
	};
	return { result, text: `${phase}: ${stat(during)} · whole: ${stat(out)} longtasks=${longtasks}` };
}

function notePaths() {
	const out = [];
	const walk = (entries) => { for (const e of entries ?? []) e.type === 'folder' ? walk(e.children) : /\.(md|jmd)$/i.test(e.path) && out.push(e.path); };
	walk(vaultStore.tree);
	return out;
}

async function exportAll(paths, dir) {
	for (const p of paths) {
		for (const [format, ext] of [['html', 'html'], ['latex', 'tex']]) {
			await ipc.invoke('clew:export-note', { path: p, format, outFile: `${dir}/${p.replace(/\.(md|jmd)$/i, '')}.${ext}` })
				.catch((err) => log(`export-failed ${p} ${format}: ${err.message}`));
		}
	}
}

try {
	await until(() => vaultStore.vault?.sessionId && vaultStore.tree?.length, 30000);
	const cfg = JSON.parse(await ipc.invoke('clew:note-read', { path: '.colon-smoke.json' }).catch(() => '{}'));
	const cycles = cfg.cycles ?? ['none'];
	const originals = new Map();
	if (cfg.verify) for (const p of notePaths()) originals.set(p, await ipc.invoke('clew:note-read', { path: p }));
	log(`vault notes=${notePaths().length}`);
	let listed = null;
	let editorTab = null;
	if (cfg.editor) {
		editorTab = workspaceStore.openNote(cfg.editor, { newTab: true, defaultMode: 'source' });
		workspaceStore.setTabMode(editorTab.id, 'source');
		await until(() => editorPool.get(editorTab.id)?.view, 15000);
		await sleep(500);
	}
	const editorView = () => editorPool.get(editorTab.id).view;
	if (cfg.exportDir) {
		const dry = await ipc.invoke('clew:colon-scan');
		listed = dry.notes.map((n) => n.path);
		log(`export-notes=${JSON.stringify(listed)}`);
		await exportAll(listed, `${cfg.exportDir}/before`);
	}
	for (const cycle of cycles) {
		// The dry run.
		const t0 = performance.now();
		const scan = await frames(async () => {
			registry.runCommand('vault:convert-colons');
			await until(() => state() === 'ready');
		}, 'scanning');
		log(`scan ${cycle} wall=${Math.round(performance.now() - t0)}ms frames ${scan.text}`);
		log(`sheet ${cycle} groups=${JSON.stringify(groups())} button=${JSON.stringify(sheet().querySelector('[data-colon-action="convert"]')?.textContent)}`);
		log(`words ${cycle} ${JSON.stringify([...sheet().querySelectorAll('section[data-group]')].map((sec) => `${sec.dataset.group}: ${sec.querySelector('.clew-colon-explain')?.textContent ?? ''}${sec.querySelector('.clew-colon-pick-all') ? ` [box:${sec.querySelector('.clew-colon-pick-all').textContent.trim()}]` : ''}`))}`);
		// A folded list (a group of more than 200 notes), opened: its folds are
		// built a few milliseconds' worth per frame.
		const folded = [...sheet().querySelectorAll('details.clew-colon-list:not([open])')];
		if (cycle === cycles[0] && folded.length) {
			const biggest = folded.sort((a, b) => parseInt(b.querySelector('summary').textContent.replace(/,/g, '')) - parseInt(a.querySelector('summary').textContent.replace(/,/g, '')))[0];
			const opened = await frames(async () => {
				biggest.querySelector('summary').click();
				await sleep(2500);
			}, 'ready');
			log(`open-list ${cycle} ${biggest.closest('section').dataset.group} (${biggest.querySelector('summary').textContent}) folds=${biggest.querySelectorAll('details.clew-colon-note').length} frames ${opened.text}`);
		}
		if (cycle === 'all') for (const box of sheet().querySelectorAll('input[data-colon-pick-all]')) box.click();
		if (cycle === 'all') log(`sheet ${cycle} ticked button=${JSON.stringify(sheet().querySelector('[data-colon-action="convert"]')?.textContent)}`);
		// Convert.
		const t1 = performance.now();
		const apply = await frames(async () => {
			click('[data-colon-action="convert"]');
			await until(() => state() === 'done');
		}, 'converting');
		log(`apply ${cycle} wall=${Math.round(performance.now() - t1)}ms frames ${apply.text} result=${JSON.stringify([...sheet().querySelectorAll('.clew-colon-body p')].map((p) => p.textContent).join(' | '))}`);
		if (editorTab) {
			// Changed through its editor (an undo step there), saved, and on disk.
			const doc = editorView().state.doc.toString();
			const disk = await ipc.invoke('clew:note-read', { path: cfg.editor });
			const { undoDepth } = window.__clew.cmCommands ?? {};
			log(`editor ${cycle} converted=${doc.includes('@begin(TeX)')} dirty=${editorPool.isDirty(editorTab.id)} disk=${disk === doc ? 'doc' : 'DIFFERENT'}${undoDepth ? ` undo-steps=${undoDepth(editorView().state)}` : ''}`);
		}
		click('[data-colon-action="done"]');
		await until(() => !sheet());
		if (cfg.exportDir) await exportAll(listed, `${cfg.exportDir}/after-${cycle}`);
		// A second dry run.
		registry.runCommand('vault:convert-colons');
		await until(() => state() === 'ready');
		log(`again ${cycle} groups=${JSON.stringify(groups())} summary=${JSON.stringify(summary())}`);
		click('[data-colon-action="cancel"], [data-colon-action="done"]');
		await until(() => !sheet());
		// Undo.
		registry.runCommand('vault:undo-colon-conversion');
		await until(() => state() === 'confirm');
		const t2 = performance.now();
		click('[data-colon-action="undo"]');
		await until(() => state() === 'undone');
		log(`undo ${cycle} wall=${Math.round(performance.now() - t2)}ms result=${JSON.stringify(summary())}`);
		if (editorTab) {
			await until(() => editorView().state.doc.toString() === originals.get(cfg.editor), 5000);
			log(`editor ${cycle} after undo: doc=${editorView().state.doc.toString() === originals.get(cfg.editor) ? 'original' : 'NOT original'}`);
		}
		click('[data-colon-action="done"]');
		await until(() => !sheet());
		if (cfg.verify) {
			const changed = [];
			for (const [p, text] of originals) if (await ipc.invoke('clew:note-read', { path: p }) !== text) changed.push(p);
			const now = notePaths();
			log(`undo ${cycle} identical=${changed.length === 0 && now.length === originals.size} notes=${now.length}/${originals.size} changed=${JSON.stringify(changed.slice(0, 10))}`);
		}
	}
	// The notes that load directives: every row needs-you, nothing by default.
	const last = await ipc.invoke('clew:colon-scan');
	for (const n of last.notes.filter((x) => x.loads)) {
		log(`loads ${n.path} by=${n.loads.by}${n.loads.file ? `(${n.loads.file})` : ''} auto=${n.autoItems} rows=${JSON.stringify(n.rows.map((r) => `${r.items.map((i) => i.name).join('+')}:${r.kind}${r.choice ? '+anyway' : ''}`))}`);
	}
	log('done');
} catch (err) { log('ERROR ' + err.stack); }
window.__clewSmokeInput = [{ wait: 300 }];
