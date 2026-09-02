// Packaged run of the office engine download into (isolated) userData,
// then a real LibreOffice boot on the downloaded engine.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
const CH = { status: 'clew:office-engine-status', download: 'clew:office-engine-download' };

let status = await ipc.invoke(CH.status);
console.log('smoke-office: initial=' + JSON.stringify(status));
if (!status.installed) {
	ipc.invoke(CH.download).catch((err) => console.log('smoke-office: download-error=' + err));
	for (let i = 0; i < 360 && !status.installed; i++) {
		await sleep(2000);
		status = await ipc.invoke(CH.status);
		if (i % 15 === 0) console.log('smoke-office: status=' + JSON.stringify(status));
	}
}
console.log('smoke-office: installed=' + status.installed);
if (!status.installed) return;

workspaceStore.openFile('Test Document.docx');
// LibreOffice-in-wasm boot: give it up to three minutes, then let the
// harness screenshot whatever state it reached.
let framePresent = false;
for (let i = 0; i < 90; i++) {
	await sleep(2000);
	framePresent = !!document.querySelector('.office-dock .office-frame');
	if (i % 15 === 0) console.log('smoke-office: waiting-boot iframe=' + framePresent);
	if (framePresent && i > 30) break; // give LibreOffice ~1 min after the frame exists
}
console.log('smoke-office: frame=' + framePresent);
await sleep(15000);
console.log('smoke-office: boot-wait-done');
