// Inside a document holding an EmbedPDF viewer (a note's embed, or
// pdf-page.html in a tab): the stamp tool's libraries, read from the
// viewer's own stamp plugin. `smoke-stamps-frame: <tag> libraries=<n>
// stamps=<n> names=<first few>` — the default library comes from
// __clew_assets__/stamps (pdf-core.js), never the CDN.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let handle = null;
for (let i = 0; i < 100 && !handle?.container; i++) {
	if (i === 15 && !window.__clewPdfHandles) break;   // a document with no viewer
	handle = [...(window.__clewPdfHandles ?? [])][0] ?? null;
	await sleep(200);
}
if (!handle?.container) { /* not a viewer's document */ }
else {
let line;
try {
	const registry = await handle.container.registry;
	const stamp = registry.getPlugin('stamp')?.provides();
	let libraries = [];
	for (let i = 0; i < 50; i++) {
		libraries = (await stamp?.getLibraries?.()) ?? [];
		if (libraries.some((l) => (l.stamps?.length ?? 0) > 0)) break;
		await sleep(200);
	}
	const stamps = libraries.flatMap((l) => l.stamps ?? []);
	line = `libraries=${libraries.length} stamps=${stamps.length} names=${stamps.slice(0, 3).map((s) => s.name).join(',')}`;
} catch (err) {
	line = `error ${String(err?.message ?? err).slice(0, 80)}`;
}
console.log(`smoke-stamps-frame: ${SMOKE_FRAME} ${line}`);
}
