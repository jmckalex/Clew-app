// The file explorer's indentation, guides and icons (the owner's ask,
// 2026-11-12): a folder's contents a level in from its name, a guide down
// them, and an icon for what each row is.
//
// Fixture (disposable; run from the folder that will hold V):
//   mkdir -p V/Lectures/Week\ 1 V/Lectures/Week\ 2 V/Pictures V/Office V/Boards V/Many && \
//     echo '# R' > V/README.md && echo 'all:' > V/Makefile && echo '<?php' > V/index.php && \
//     for f in 'Lectures/Plan.md' 'Lectures/Plan.tex' 'Lectures/Plan.pdf' 'Lectures/Plan.html' \
//       'Lectures/Week 1/Notes.md' 'Lectures/Week 1/Handout.pdf' 'Lectures/Week 2/Notes.jmd' \
//       'Pictures/a.png' 'Pictures/b.svg' 'Office/Essay.docx' 'Office/Marks.xlsx' 'Office/Slides.pptx' \
//       'Boards/Map.canvas' 'Boards/Sketch.excalidraw.md' 'Boards/List.base' 'Boards/page.jinja' \
//       'refs.bib' 'site.zip'; do printf 'x\n' > "V/$f"; done && \
//     for i in $(seq -w 1 300); do printf 'x\n' > "V/Many/item-$i.md"; done
//
// Run with CLEW_SMOKE_LOG=1 (the lines are console output), a profile of its
// own (CLEW_USER_DATA) and CLEW_SMOKE_VAULT=V; seed that profile's
// clew-settings.json with {"theme":"light"} for the light run.
// Expect: indent-ok=true (every row's icon exactly 16px right of its
// folder's, siblings' icons in one column, each name after its icon),
// guides-ok=true (a row's guide band is its depth × 16px), loaded-ok=true,
// probe-ok=true (the measured row height is a real row's), the kinds line
// naming each fixture file's icon, light-variant=jinja_light.svg→jinja.svg (a
// theme switch repaints the icons), and cached=N/N control-cached=false: an
// icon on screen is the page's already — a new <img> of it is complete the
// moment its src is set, as each row windowing rebuilds is — while one never
// shown is not (resource timing records no clew-app:// load, so this is the
// measure). Every folder starts closed (2026-11-17): the scenario opens each
// but Many, and leaves Many closed whatever it found.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { settingsStore, workspaceStore } = window.__clew;
const explorer = document.querySelector('clew-file-explorer');
const tree = explorer.querySelector('.file-tree');
const rows = () => [...explorer.querySelectorAll('.file-tree-sizer > .tree-item')];
const iconOf = (row) => row.querySelector('img.tree-icon');
const base = (src) => src.split('/').pop();

await sleep(1500);
// Every folder but the long one open, so every other row is on screen at
// once — from whatever state the vault's workspace kept.
for (const path of ['Lectures', 'Lectures/Week 1', 'Lectures/Week 2', 'Pictures', 'Office', 'Boards', 'Many']) {
	if (workspaceStore.expandedFolders.includes(path) === (path !== 'Many')) continue;
	explorer.querySelector(`.tree-item.is-folder[data-path="${CSS.escape(path)}"]`)?.click();
	await sleep(300);
}

const drawn = rows().map((row) => {
	const icon = iconOf(row);
	const name = row.querySelector('.tree-name');
	return {
		path: row.dataset.path,
		depth: Number(row.style.getPropertyValue('--tree-depth')),
		iconLeft: icon.getBoundingClientRect().left,
		iconRight: icon.getBoundingClientRect().right,
		nameLeft: name.getBoundingClientRect().left,
		guide: parseFloat(getComputedStyle(row, '::before').width) || 0,
		height: row.offsetHeight,
		top: parseFloat(row.style.top),
		src: base(icon.src),
		loaded: icon.complete && icon.naturalWidth > 0,
	};
});
const byPath = new Map(drawn.map((r) => [r.path, r]));
const parentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : null);
const indentBad = [];
for (const r of drawn) {
	const parent = byPath.get(parentOf(r.path));
	if (parent && Math.abs(r.iconLeft - parent.iconLeft - 16) > 0.5) indentBad.push(`${r.path}: ${r.iconLeft - parent.iconLeft}`);
	if (!parent && r.depth !== 0) indentBad.push(`${r.path}: no parent row`);
	if (r.nameLeft < r.iconRight) indentBad.push(`${r.path}: name over icon`);
}
const columns = new Map();
for (const r of drawn) columns.set(r.depth, [...(columns.get(r.depth) ?? []), r.iconLeft]);
for (const [depth, lefts] of columns) {
	if (new Set(lefts).size !== 1) indentBad.push(`depth ${depth}: icons at ${[...new Set(lefts)]}`);
}
console.log('smoke-explorer: rows=' + drawn.length + ' indent-ok=' + (indentBad.length === 0) + (indentBad.length ? ' ' + JSON.stringify(indentBad) : ''));
const guidesBad = drawn.filter((r) => r.guide !== r.depth * 16).map((r) => `${r.path}: ${r.guide}`);
console.log('smoke-explorer: guides-ok=' + (guidesBad.length === 0) + (guidesBad.length ? ' ' + JSON.stringify(guidesBad) : ''));
const notLoaded = drawn.filter((r) => !r.loaded).map((r) => r.path);
console.log('smoke-explorer: loaded-ok=' + (notLoaded.length === 0) + (notLoaded.length ? ' ' + JSON.stringify(notLoaded) : ''));
// The windowing places row i at i × the PROBE's height: a real row must be
// that tall, or every row below drifts.
const step = drawn.length > 1 ? drawn[1].top - drawn[0].top : 0;
console.log('smoke-explorer: probe-ok=' + drawn.every((r) => r.height === step) + ' row-height=' + step + ' heights=' + JSON.stringify([...new Set(drawn.map((r) => r.height))]));
console.log('smoke-explorer: kinds=' + JSON.stringify(Object.fromEntries(drawn.map((r) => [r.path, r.src]))));

// A light page takes an icon's light variant; a theme switch repaints.
const theme = settingsStore.get('theme') ?? 'dark';
const jinja = () => base(iconOf(explorer.querySelector('.tree-item[data-path="Boards/page.jinja"]')).src);
settingsStore.set('theme', 'light');
await sleep(200);
const lightSrc = jinja();
settingsStore.set('theme', 'dark');
await sleep(200);
console.log('smoke-explorer: light-variant=' + lightSrc + '→' + jinja());
settingsStore.set('theme', theme);
await sleep(200);

// Windowing rebuilds every row it paints, so each icon must come from the
// page's own images, not a request (app-page files are served no-store).
const shown = [...new Set(rows().map((row) => iconOf(row).src))];
const cached = shown.filter((src) => { const img = new Image(); img.src = src; return img.complete; }).length;
const control = new Image();
control.src = new URL('file-icons/python.svg', location.href).href;
console.log('smoke-explorer: cached=' + cached + '/' + shown.length + ' control-cached=' + control.complete);
await sleep(300);
