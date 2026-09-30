// A PDF in a canvas PORTAL (a canvas shown inside another) is a first-page
// picture rendered and cached by main (main/pdf-thumbs.js,
// docs/dev/pdf-unification.md §2), never a raw PDF iframe. Two runs over ONE
// fixture:
//
//   node smoke/make-pdf-vault.mjs <dir> && node -e "const fs=require('fs');
//     fs.writeFileSync('<dir>/Board.canvas', JSON.stringify({nodes:[{id:'p',type:'file',file:'Paper.pdf',x:0,y:0,width:400,height:520}],edges:[]}));
//     fs.writeFileSync('<dir>/Wall.canvas', JSON.stringify({nodes:[{id:'w',type:'file',file:'Board.canvas',x:0,y:0,width:600,height:700}],edges:[]}))"
//
// Run 1 (cold): `plate-first=true` (the name plate before the picture),
// `thumb loaded=true width=… ms=…`, `raw-pdf-frames=0`. Run 2 (warm):
// `thumb … ms=` far smaller and `stamp-same=true` (cached, not redrawn);
// then the PDF is rewritten and the wall reopened: `changed stamp-newer=true`.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, vaultStore, ipc } = window.__clew;
const log = (s) => console.log('smoke-pp: ' + s);
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
workspaceStore.setSidebar('left', { open: false });
workspaceStore.setSidebar('right', { open: false });
const thumbImg = () => document.querySelector('.canvas-portal .portal-pdf-thumb');
const stampOf = (img) => Number(new URL(img.src).searchParams.get('v'));
const openWall = async () => {
	const t0 = performance.now();
	const tab = workspaceStore.openCanvas('Wall.canvas', { newTab: true });
	let plateFirst = false;
	for (let i = 0; i < 400; i++) {
		if (document.querySelector('.canvas-portal .portal-pdf-plate') && !thumbImg()) plateFirst = true;
		const img = thumbImg();
		if (img?.complete && img.naturalWidth > 0) {
			return { tab, img, ms: Math.round(performance.now() - t0), plateFirst };
		}
		await sleep(50);
	}
	return { tab, img: null, ms: -1, plateFirst };
};
const marker = await ipc.invoke('clew:note-read', { path: 'run.txt' }).catch(() => null);
const warm = marker != null;
let { tab, img, ms, plateFirst } = await openWall();
const rawFrames = [...document.querySelectorAll('.canvas-portal iframe')].filter((f) => /\.pdf(\?|$)/i.test(f.src)).length;
log(`${warm ? 'warm' : 'cold'} plate-first=${plateFirst} thumb loaded=${Boolean(img)} width=${img?.naturalWidth ?? 0} ms=${ms} raw-pdf-frames=${rawFrames}`);
if (!warm) {
	await ipc.invoke('clew:note-write', { path: 'run.txt', content: String(stampOf(img)) });
} else {
	log(`stamp-same=${String(stampOf(img)) === String(typeof marker === 'string' ? marker : marker?.content).trim()}`);
	// Rewrite the PDF (the same bytes, a new mtime), then open the wall afresh.
	const sid = vaultStore.vault.sessionId;
	const bytes = new Uint8Array(await (await fetch(`clew-preview://vault/${sid}/Paper.pdf`)).arrayBuffer());
	await ipc.invoke('clew:pdf-write', { path: 'Paper.pdf', bytes });
	const before = stampOf(img);
	workspaceStore.closeTab(tab.id, { force: true });
	await sleep(1500);
	({ img } = await openWall());
	log(`changed stamp-newer=${Boolean(img) && stampOf(img) > before}`);
}
