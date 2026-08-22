// electron-builder afterPack hook: ship the staged engine node_modules.
// extraResources hard-refuses to copy any node_modules directory, but the
// forked engine worker (a plain node child, outside the asar) needs its
// dependencies resolvable next to it — so copy them in here, after the app
// directory is assembled and before any dmg/zip is produced.
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function afterPack(context) {
	const from = path.join(__dirname, '..', 'build-engine', 'jmarkdown', 'node_modules');
	const to = path.join(
		context.appOutDir,
		`${context.packager.appInfo.productFilename}.app`,
		'Contents', 'Resources', 'engine', 'jmarkdown', 'node_modules',
	);
	if (!fs.existsSync(from)) {
		throw new Error(`after-pack: staged engine deps missing at ${from} — run scripts/package.js, not electron-builder directly`);
	}
	fs.rmSync(to, { recursive: true, force: true });
	fs.cpSync(from, to, { recursive: true });
	console.log(`  • after-pack: engine node_modules → Resources/engine/jmarkdown (${fs.readdirSync(to).length} packages)`);
};
