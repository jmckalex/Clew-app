// A loopback update feed for update-check-scenario.js:
//   node smoke/update-feed.mjs <port> <version>
// serves /downloads/latest.json in the schema docs/dev/auto-update.md §3
// gives Clew-docs, until killed.
import http from 'node:http';
const [port, version] = process.argv.slice(2);
const feed = {
	version,
	released: '2026-10-03',
	notes: `../manual/whats-new.html#v${version.replace(/\./g, '-')}`,
	files: {
		'mac-arm64': { url: `Clew-${version}-arm64.dmg`, sha512: 'test', size: 1 },
		'mac-x64': { url: `Clew-${version}-x64.dmg`, sha512: 'test', size: 1 },
		'win-x64': { url: `Clew-Setup-${version}.exe`, sha512: 'test', size: 1 },
		'linux-appimage': { url: `Clew-${version}.AppImage`, sha512: 'test', size: 1 },
		'linux-deb': { url: `clew_${version}_amd64.deb`, sha512: 'test', size: 1 },
	},
};
http.createServer((req, res) => {
	if (req.url === '/downloads/latest.json') {
		res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
		res.end(JSON.stringify(feed));
	} else {
		res.writeHead(404);
		res.end();
	}
}).listen(Number(port), '127.0.0.1', () => console.log(`feed on 127.0.0.1:${port} (${version})`));
