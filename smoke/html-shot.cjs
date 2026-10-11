// An exported HTML page as a reader's browser would draw it, to a PNG — for
// comparing exports (smoke/figure-engine-compare.sh). Not the smoke harness:
// a bare Electron main that loads one file:// page in a HIDDEN window and
// captures its whole height. Run with Electron's own binary:
//
//   <Electron> smoke/html-shot.cjs <page.html> <out.png> [width=900]
//
// Its profile is a temporary folder, removed on exit; it never touches Clew's.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [page, out, widthArg] = process.argv.slice(process.defaultApp ? 2 : 1);
if (!page || !out) {
	console.error('usage: <Electron> smoke/html-shot.cjs <page.html> <out.png> [width]');
	process.exit(2);
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clew-html-shot-'));
app.setPath('userData', profile);
app.dock?.hide();
const width = Number(widthArg) || 900;

app.whenReady().then(async () => {
	const win = new BrowserWindow({ show: false, width, height: 800, webPreferences: { offscreen: false } });
	try {
		await win.loadFile(path.resolve(page));
		// MathJax, fonts and images settle; a page with none settles at once.
		await win.webContents.executeJavaScript(`new Promise((done) => {
			const ready = () => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))]);
			const mj = window.MathJax?.startup?.promise ?? Promise.resolve();
			Promise.all([ready(), mj]).then(() => setTimeout(done, 500));
			setTimeout(done, 15000);
		})`);
		const height = await win.webContents.executeJavaScript('Math.ceil(document.documentElement.scrollHeight)');
		win.setContentSize(width, Math.min(height, 16000));
		await new Promise((r) => setTimeout(r, 400));
		const image = await win.webContents.capturePage();
		fs.writeFileSync(out, image.toPNG());
		console.log(`html-shot: ${out} ${width}x${height}`);
	} catch (err) {
		console.error(`html-shot: ${err.message}`);
		process.exitCode = 1;
	}
	fs.rmSync(profile, { recursive: true, force: true });
	app.exit(process.exitCode ?? 0);
});
