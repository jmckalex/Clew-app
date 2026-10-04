// Book mode, Clew's half of phase 1 (docs/dev/book-mode.md; renderer/
// books.js, components/panels/clew-book.js), by REAL input. Over
// `node smoke/make-book-vault.mjs <dir>`: CLEW_SMOKE_VAULT=<dir>/vault (or
// <dir>/plain, the control) CLEW_USER_DATA=<dir>/ud.
//
// plain: `case=plain tabs=[…no Book…] book-item=none masters=0` — with
// Reading Note.md (`book: true`, no `chapters:`) the active note.
// book: the right sidebar's tabs (Book among them), then EVERY CHANGE of
// state as one `smoke-book: state …` line — the active note, the status
// bar's book item, the panel's rows (`n:title/words/status`, `!` for a
// chapter that is no note), its totals, and both masters' `chapters:` AS
// ON DISK — while real input drives it:
//   1. the Book tab clicked → Signals' three chapters;
//   2. row 3's grip dragged above row 1 → Deception first, on disk too;
//   3. row 1 focused, Alt+↓ → it moves down one;
//   4. row 3's status chip → Clew's menu → done (Conventions.md says so);
//   5. row 2's × → Deception out of the list, its note still there;
//   6. Notes/Alone.md opened, "Add …" → Alone last, as [[Alone]];
//   7. Conventions opened → "Ch. 2 of Signals: A Short Book · also in
//      Course"; the item clicked → "Ch. 1 of Course · also in Signals…",
//      and the panel shows Course with its missing chapter flagged;
//   8. `Book: next chapter` from Conventions: in Course (next is missing)
//      nothing; with Signals the recent book, Notes/Alone.md.
// The first link's alias (`|Ch. 1`, set by the fixture) survives every
// rewrite. Ends with `smoke-book: final …`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-book: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const read = async (p) => String(await ipc.invoke('clew:note-read', { path: p }).then((r) => r?.content ?? r).catch(() => ''));
const kind = (await read('book-case.txt')).trim();
for (let i = 0; i < 50 && !Object.keys(vaultStore.index).length; i++) await sleep(100);
await sleep(800);
const tabs = () => [...document.querySelectorAll('.tool-tabs[data-side="right"] .tool-tab')].map((t) => t.textContent);

if (kind === 'plain') {
	workspaceStore.openNote('Reading Note.md');
	await sleep(1200);
	log(`case=plain tabs=${JSON.stringify(tabs())} book-item=${document.querySelector('.clew-book-indicator')?.textContent ?? 'none'} masters=${vaultStore.masters().length}`);
	window.__clewSmokeInput = [{ wait: 300 }];
} else {
	const SIGNALS = 'Books/Signals/Signals.md';
	const CONVENTIONS = 'Books/Signals/Conventions.md';
	const listed = async (p) => (/^chapters:\n((?:[ \t]+- .*\n)*)/m.exec(await read(p))?.[1] ?? '')
		.trim().split('\n').map((l) => l.replace(/^\s*- /, '').replace(/^"(.*)"$/, '$1')).filter(Boolean);
	const tab = workspaceStore.openNote(CONVENTIONS, { newTab: true });
	workspaceStore.setTabMode(tab.id, 'source');
	await sleep(1200);
	const bookAt = tabs().indexOf('Book');
	log(`case=book tabs=${JSON.stringify(tabs())}`);

	const state = async () => {
		const rows = [...document.querySelectorAll('clew-book .book-row')].map((r) =>
			`${r.querySelector('.book-num')?.textContent}:${r.classList.contains('is-dangling') ? '!' : ''}${r.querySelector('.book-chapter-title')?.textContent}`
			+ `/${r.querySelector('.book-words')?.textContent ?? ''}/${r.querySelector('.book-status')?.textContent ?? ''}`);
		return `active=${workspaceStore.activeTab()?.path} item=${JSON.stringify(document.querySelector('.clew-book-indicator')?.textContent ?? null)}`
			+ ` panel=${JSON.stringify(rows)} totals=${JSON.stringify(document.querySelector('clew-book .book-totals')?.textContent ?? null)}`
			+ ` disk-signals=${JSON.stringify(await listed(SIGNALS))} disk-course=${JSON.stringify(await listed('Course.md'))}`;
	};
	(async () => {
		let last = '';
		let phase = 'start';
		const end = Date.now() + 45000;
		while (Date.now() < end) {
			const now = await state();
			if (now !== last) { log(`state ${now}`); last = now; }
			const disk = await listed(SIGNALS);
			// The steps between input that only the page can take (opening a
			// note), each when the state before it has landed.
			if (phase === 'start' && disk.length === 2 && !disk.includes('[[Alone]]')) {
				phase = 'alone';
				workspaceStore.openNote('Notes/Alone.md');
			} else if (phase === 'alone' && disk.includes('[[Alone]]')) {
				phase = 'conventions';
				workspaceStore.openNote(CONVENTIONS);
			} else if (phase === 'conventions' && workspaceStore.recentBook === 'Course.md') {
				phase = 'next';
				await sleep(800);
				log(`switched item=${JSON.stringify(document.querySelector('.clew-book-indicator')?.textContent ?? null)} shown=${document.querySelector('clew-book .book-pick')?.value}`);
				const registry = window.__clew.registry;
				const next = registry.allCommands().find((c) => c.id === 'book:next-chapter');
				next.run();
				await sleep(400);
				log(`next-in-course active=${workspaceStore.activeTab()?.path}`);
				workspaceStore.setRecentBook(SIGNALS);
				await sleep(300);
				next.run();
				await sleep(600);
				log(`next-in-signals active=${workspaceStore.activeTab()?.path}`);
				phase = 'done';
				const status = /^status: (.*)$/m.exec(await read(CONVENTIONS))?.[1];
				const deception = (await read('Books/Signals/Deception.md')).length > 0;
				log(`final signals=${JSON.stringify(disk)} conventions-status=${status} deception-note-kept=${deception} recent=${workspaceStore.recentBook}`);
			}
			await sleep(200);
		}
	})();

	const at = (selector, extra = {}) => ({ click: { selector }, ...extra });
	window.__clewSmokeInput = [
		{ wait: 800 },
		at(`.tool-tabs[data-side="right"] .tool-tab:nth-child(${bookAt + 1})`), { wait: 1800 },
		{ drag: { from: { selector: '.book-row[data-row="2"] .book-grip' }, to: { selector: '.book-row[data-row="0"]', dy: -6 } } }, { wait: 2500 },
		at('.book-row[data-row="0"] .book-num'), { combo: { key: 'ArrowDown', modifiers: 1 } }, { wait: 2500 },
		at('.book-row[data-row="2"] .book-status'), { wait: 400 }, at('.clew-menu .menu-item:nth-child(3)'), { wait: 2500 },
		{ move: { selector: '.book-row[data-row="1"] .book-chapter-title' } }, at('.book-row[data-row="1"] .book-remove'), { wait: 3000 },
		at('clew-book .book-add'), { wait: 3000 },
		at('.clew-book-indicator'), { wait: 5000 },
	];
}
