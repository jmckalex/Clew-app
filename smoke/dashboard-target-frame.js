// Inside Guide/Dashboards.md's chart — its reading view, or the live-edit
// block frame that holds it (dashboard-target-scenario.js): the chart AS
// DRAWN (Chart.js's own instance, not the attribute), the line above it, and
// when this document loaded (a reload after the change would show).
const div = document.querySelector('.clew-chart');
if (div) {
	let chart = null;
	for (let i = 0; i < 100 && !(chart = window.Chart?.getChart(div.querySelector('canvas'))); i++) await new Promise((r) => setTimeout(r, 100));
	const line = [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => /^\d+ active project/.test(t)) ?? null;
	console.log(`smoke-dt-frame: ${SMOKE_FRAME.slice(0, 12)} chart=${JSON.stringify(chart?.data?.datasets?.[0]?.data ?? null)} labels=${JSON.stringify(chart?.data?.labels ?? null)} title=${JSON.stringify(chart?.options?.plugins?.title?.text ?? null)} line=${JSON.stringify(line)} loaded-at=${Math.round(performance.timeOrigin)}`);
} else if (/dataviewjs|Projects/.test(document.body?.textContent ?? '')) {
	console.log(`smoke-dt-frame: ${SMOKE_FRAME.slice(0, 12)} no-chart text=${JSON.stringify((document.body?.textContent ?? '').trim().slice(0, 120))}`);
}
