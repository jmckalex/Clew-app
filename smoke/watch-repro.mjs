// VaultManager#startWatcher, reproduced OUTSIDE Electron over the SAME
// electron-free helpers (fs-utils.js watchFilter/watchPlan and the budget,
// vault-excludes.js), to measure what happens to a root-level file created
// after chokidar's `ready`.
//   node smoke/watch-repro.mjs <vault> [<vault2> …]
// One "window" per vault, sharing the process-wide count, opened in order,
// over smoke/make-watch-vault.mjs fixtures. Measured 2026-09-30, before the
// fix: one window saw both new root files; with TWO, the second window's
// scan got nothing (the budget is process-wide), its first root event
// admitted its whole tree (~1000 spurious `add`s) and hit WATCH_CEILING, and
// after that NEITHER window saw a new file. After (scanShare + knownPaths):
// each window's scan gets a share, events carry only the new file, and every
// window sees every new file.
import fs from 'node:fs';
import path from 'node:path';
const APP = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { direntKind, shouldRecurse, walkGuard, watchFilter, watchPlan, WATCH_BUDGET, WATCH_CEILING, scanShare, knownPaths } = await import(`${APP}/src/main/fs-utils.js`);
const { compileExcludes } = await import(`${APP}/src/main/vault-excludes.js`);
const chokidar = (await import(`${APP}/node_modules/chokidar/index.js`));
let watchedTotal = 0;
const log = (...a) => console.log(`[${(performance.now() / 1000).toFixed(1)}s]`, ...a);

function walk(root, excludes, duplicates, files) {
	const seen = walkGuard(root);
	const go = (dir, rel) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			if (excludes.isHidden(childRel)) continue;
			const kind = direntKind(dir, entry);
			if (kind === 'dir') {
				const abs = path.join(dir, entry.name);
				if (!shouldRecurse(abs, seen)) { duplicates.add(childRel); continue; }
				go(abs, childRel);
			} else if (kind === 'file') files.push(childRel);
		}
	};
	go(root, '');
}

async function open(root) {
	const excludes = compileExcludes({});
	const duplicates = new Set();
	const files = [];
	walk(root, excludes, duplicates, files);
	let settled = false;
	// As vault.js#startWatcher: this window's share of the scan budget.
	const share = scanShare(WATCH_BUDGET - watchedTotal);
	let scanned = 0;
	const take = () => {
		if (!settled && scanned >= share) return false;
		if (watchedTotal >= (settled ? WATCH_CEILING : WATCH_BUDGET)) return false;
		watchedTotal += 1;
		if (!settled) scanned += 1;
		return true;
	};
	const plan = watchPlan(files.filter((rel) => !excludes.isUnindexed(rel)), take);
	const { ignored, state } = watchFilter({ root, isExcluded: (rel) => excludes.isUnindexed(rel), duplicates, take, admit: plan.admit, settled: () => settled, known: knownPaths(files) });
	state.skipped = plan.skipped;
	const events = [];
	const watcher = chokidar.watch('.', { cwd: root, ignored, ignoreInitial: true });
	watcher.on('all', (event, rel) => events.push(`${event} ${rel}`));
	await new Promise((r) => watcher.once('ready', r));
	settled = true;
	log(`${path.basename(path.dirname(root))}: ready — files ${files.length}, duplicates ${duplicates.size}, plan admitted ${plan.admit.size}, skipped ${plan.skipped}; process total ${watchedTotal}/${WATCH_CEILING}`);
	return { root, watcher, events, state };
}

const sessions = [];
for (const v of process.argv.slice(2)) sessions.push(await open(v));
await new Promise((r) => setTimeout(r, 1000));
for (const s of sessions) s.events.length = 0;

// A new root-level file in the LAST window's vault, as an export would write it.
const target = sessions.at(-1);
const name = `Exported ${Date.now()}.pdf`;
fs.writeFileSync(path.join(target.root, name), '%PDF-1.4\n');
log(`wrote ${name} at the root of ${target.root}`);
const t0 = performance.now();
while (performance.now() - t0 < 10000 && !target.events.some((e) => e.endsWith(name))) await new Promise((r) => setTimeout(r, 100));
const seen = target.events.some((e) => e.endsWith(name));
log(`add for the new file: ${seen ? `YES after ${Math.round(performance.now() - t0)} ms` : 'NO within 10 s'}; events in that window ${target.events.length} (first: ${target.events.slice(0, 3).join(' | ')}); process total now ${watchedTotal}/${WATCH_CEILING}`);
// Then one more new root file in EVERY window, now that the count is where
// the first one left it.
for (const s of sessions) {
	s.events.length = 0;
	const next = `Second ${Date.now()}.pdf`;
	fs.writeFileSync(path.join(s.root, next), '%PDF-1.4\n');
	const t1 = performance.now();
	while (performance.now() - t1 < 10000 && !s.events.some((e) => e.endsWith(next))) await new Promise((r) => setTimeout(r, 100));
	const ok = s.events.some((e) => e.endsWith(next));
	log(`${path.basename(path.dirname(s.root))}: next new root file — add ${ok ? 'YES' : 'NO within 10 s'}; process total ${watchedTotal}/${WATCH_CEILING}`);
}
for (const s of sessions) await s.watcher.close();
process.exit(0);
