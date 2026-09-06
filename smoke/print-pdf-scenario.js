// "Export as PDF (reading view)": print the note as the app draws it.
// Writes <vault>/Print Me.pdf via EXPORT_NOTE's outFile bypass (the save
// dialog would hang the harness, exactly as it would for EXPORT_SITE).
//
// Fixture: a note exercising the asynchronous parts — display maths, a
// mermaid fence, a highlighted code block, a table, a callout, and both a
// folded and an open embed. The point of the run is that none of those come
// out half-drawn.
//
// Verify on disk, not from the log:
//   python3 -c "import re;d=open('Print Me.pdf','rb').read();
//              print(len(re.findall(rb'/Type\s*/Page[^s]',d)),
//                    re.search(rb'/MediaBox\s*\[([^\]]*)\]',d).group(1))"
//     → 2 pages, MediaBox 595.9 x 842.9 (A4)
//   pdftotext 'Print Me.pdf' -   → the open embed's body is there ONCE;
//                                  the folded embed contributes only its title
//   sips -s format png 'Print Me.pdf' --out p1.png   → eyeball page 1
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { workspaceStore, ipc } = window.__clew;
workspaceStore.openNote('Print Me.md', { defaultMode: 'reading' });
await sleep(6000);
try {
	const result = await ipc.invoke('clew:export-note', {
		path: 'Print Me.md', format: 'print-pdf', outFile: 'Print Me.pdf',
	});
	console.log('smoke-pdf: result=' + JSON.stringify(result));
} catch (err) {
	console.log('smoke-pdf: ERROR ' + err.message);
}
await sleep(1000);
