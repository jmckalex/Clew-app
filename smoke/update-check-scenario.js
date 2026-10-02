// The update check (docs/dev/auto-update.md v1, main/updater.js) against a
// LOOPBACK feed — a test never reaches the real one. Run with
// CLEW_UPDATE_FEED=http://127.0.0.1:<port>/downloads/latest.json,
// CLEW_UPDATE_DELAY_MS=1500 and CLEW_SMOKE_NET_LOG=1 while
// `node smoke/update-feed.mjs <port> <version>` serves the feed:
//   smoke-update: scheduled available <v>       (main)
//   smoke-update-ui: notice=true text="Clew <v> is available." buttons=…
//   smoke-open-external: …/whats-new…, …/Clew-<v>-arm64.dmg   (What's new, Download)
//   smoke-update-ui: after-skip skipped=<v> manual=available
// and the only smoke-net: line is the loopback feed. Without CLEW_UPDATE_FEED
// the manual check answers `off` and no smoke-net: line appears at all.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { vaultStore, registry, ipc } = window.__clew;
for (let i = 0; i < 150 && !vaultStore.vault?.sessionId; i++) await sleep(100);
const notice = () => document.querySelector('.clew-update-notice');
for (let i = 0; i < 60 && !notice(); i++) await sleep(250);
const n = notice();
console.log(`smoke-update-ui: notice=${!!n} text="${n?.querySelector('span')?.textContent ?? ''}" buttons=${[...(n?.querySelectorAll('button') ?? [])].map((b) => b.textContent).join('|')}`);
if (n) {
	const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
	const [notes, download, skip] = [...n.querySelectorAll('button')];
	window.__clewSmokeInput = [{ click: centre(notes) }, { wait: 400 }, { click: centre(download) }, { wait: 400 }, { click: centre(skip) }, { wait: 2500 }];
	(async () => {
		for (let i = 0; i < 40 && notice(); i++) await sleep(150);
		const manual = await ipc.invoke('clew:update-check');
		console.log(`smoke-update-ui: after-skip gone=${!notice()} manual=${manual.status}`);
	})();
} else {
	const manual = await ipc.invoke('clew:update-check');
	console.log(`smoke-update-ui: manual=${manual.status} reason=${manual.reason ?? ''}`);
}
