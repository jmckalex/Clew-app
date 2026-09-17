// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Packages Clew: sync the engine mirror and the wasm figure engines, build
// bundles, stage the engine
// with its production dependencies (a plain-node child can't read inside
// app.asar, so the engine ships unpacked in the resources dir), generate
// the icon if missing, then run electron-builder. The staged engine tree is
// pure JS, so the same staging ships on every platform.
//
//   npm run package          → out/mac-arm64/Clew.app (fast, UNSIGNED, for testing)
//   npm run package:dmg      → + a distributable .dmg (unsigned)
//   npm run package:dist     → signed + notarized + stapled .dmg (see below)
//   npm run package:win      → out/Clew Setup <version>.exe (NSIS, x64)
//   npm run package:linux    → out/Clew-<version>.AppImage + .deb (x64)
//
// macOS signing (--sign) uses the "Developer ID Application" identity in the
// login keychain; without the flag CSC_IDENTITY_AUTO_DISCOVERY is forced off
// so ordinary test builds never touch the certificate.
//
// Notarization (--notarize, implies --sign) needs Apple credentials, in order
// of preference:
//   1. APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID in the env.
//   2. a notarytool keychain profile — CLEW_NOTARY_PROFILE (default
//      "clew-notary"), created once with:
//        xcrun notarytool store-credentials clew-notary \
//          --apple-id <you@example.com> --team-id <TEAMID> \
//          --password <app-specific-password>
// The env is preferred despite exposing the password to every process the user
// runs, because it is the only path proven to work from inside a build — see
// resolveNotaryCreds() for the evidence.
//
// An app-specific password is scoped to the APPLE ID, not to an app: the name
// refers only to the label chosen at appleid.apple.com, so one password
// notarizes every app on the account. A password minted for something else is
// not "wrong for Clew".
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run = (cmd, cwd = root, env = undefined) => {
	console.log(`\n> ${cmd}`);
	execSync(cmd, { cwd, stdio: 'inherit', env: env ? { ...process.env, ...env } : process.env });
};
// execFile form for commands carrying secrets — arguments are never echoed.
const runArgs = (file, args, label) => {
	console.log(`\n> ${label}`);
	execFileSync(file, args, { cwd: root, stdio: 'inherit' });
};

// Resolved once and used for BOTH electron-builder's own notarize step (through
// the environment variables it documents) and our notarytool call, so the two
// can never disagree about who we are.
//
// The env is tried FIRST, and there is deliberately no probe of the keychain
// profile. Both of those reverse an earlier design, for reasons worth keeping:
//
//   - The old code probed with `notarytool history --keychain-profile`. That
//     is a NETWORK call which Apple throttles, so a failure means "ask again
//     later" at least as often as it means "no such profile" — it would drop
//     to the env for no reason, or (with no env set) fail an otherwise fine
//     build outright.
//   - Worse, a *successful* probe proves nothing. On 2026-08-23 the probe
//     passed from a shell and electron-builder's own notarytool child then
//     died on the very same profile minutes later ("No Keychain password item
//     found for profile"). The profile is reachable interactively but not
//     reliably from inside a build.
//   - The env path has now notarized successfully twice, including the 0.8.0
//     universal dmg. A shipped release beats a tidy environment.
//
// Note for anyone re-diagnosing this: `security find-generic-password` CANNOT
// see a store-credentials profile — notarytool keeps it in the data-protection
// ("iCloud") keychain, which the legacy security(1) tool does not search. Its
// silence is not evidence that the profile is missing. Confirm with
// `xcrun notarytool history --keychain-profile <name>` instead.
function resolveNotaryCreds(profile) {
	const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
	if (APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID) {
		return {
			builderEnv: { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID },
			notarytoolArgs: ['--apple-id', APPLE_ID, '--password', APPLE_APP_SPECIFIC_PASSWORD, '--team-id', APPLE_TEAM_ID],
		};
	}
	// Fall back to the stored profile, unprobed: if it is absent, notarytool
	// says so itself with a better message than any check here could produce.
	// Deliberately NOT setting APPLE_KEYCHAIN — notarytool finds the profile
	// through its own search, and pointing it at an explicit keychain path
	// makes the very same lookup fail with "No Keychain password item found".
	console.log(`\n  ! APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID are not all set;`);
	console.log(`    falling back to the notarytool keychain profile "${profile}".`);
	console.log(`    If notarization fails on a missing profile, prefer the env vars.`);
	return {
		builderEnv: { APPLE_KEYCHAIN_PROFILE: profile },
		notarytoolArgs: ['--keychain-profile', profile],
	};
}

/** The Developer ID Application identity in the keychain, for signing the dmg. */
function developerIdIdentity() {
	const out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
	const found = out.split('\n')
		.map((line) => /"(Developer ID Application: [^"]+)"/.exec(line))
		.filter(Boolean)
		.map((m) => m[1]);
	if (found.length === 0) throw new Error('no "Developer ID Application" identity found in the keychain');
	if (found.length > 1) throw new Error(`ambiguous signing identity, found ${found.length}: ${found.join(', ')}`);
	return found[0];
}

run('node scripts/vendor-jmarkdown.js');
run('node scripts/vendor-embedpdf.js');
// The wasm TikZ/MetaPost engines (74 MB, extraResources → Resources/mptikz).
// --require: fail here rather than ship an app whose figures cannot render.
run('node scripts/stage-mptikz.js --require');
run('node scripts/build.js');

// Stage the engine: mirror + production node_modules, resolvable by the
// forked worker at Resources/engine/jmarkdown/src/watch-worker.js.
const staging = path.join(root, 'build-engine', 'jmarkdown');
fs.rmSync(path.join(root, 'build-engine'), { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
fs.cpSync(path.join(root, 'vendor', 'jmarkdown'), staging, { recursive: true });
// --legacy-peer-deps matches the golden master's own installed reality
// (marked-emoji's peer range trails the marked the engine actually uses).
try {
	run('npm ci --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps', staging);
} catch {
	console.log('npm ci failed (lockfile drift?); falling back to npm install');
	run('npm install --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps', staging);
}

if (!fs.existsSync(path.join(root, 'build-resources', 'icon.icns'))) {
	run('npx electron scripts/make-icon.js');
}

if (process.argv.includes('--win')) {
	run('npx electron-builder --win nsis --x64');
	console.log('\nPackaged. Installer in out/');
} else if (process.argv.includes('--linux')) {
	run('npx electron-builder --linux AppImage deb --x64');
	console.log('\nPackaged. AppImage + deb in out/');
} else {
	const dmg = process.argv.includes('--dmg');
	const notarize = process.argv.includes('--notarize');
	const sign = notarize || process.argv.includes('--sign');
	// arm64 unless asked otherwise; --universal ships one binary for both Macs.
	const arch = process.argv.includes('--universal') ? '--universal'
		: process.argv.includes('--x64') ? '--x64' : '--arm64';

	if (notarize && !dmg) throw new Error('--notarize requires --dmg (a ticket is stapled to the disk image)');

	// Resolve credentials BEFORE electron-builder runs: it notarizes too, and
	// needs to be told the same thing we tell notarytool.
	const profile = process.env.CLEW_NOTARY_PROFILE ?? 'clew-notary';
	const creds = notarize ? resolveNotaryCreds(profile) : null;

	// electron-builder runs @electron/notarize itself the moment it finds Apple
	// credentials in the ENVIRONMENT. That step is wanted — it staples the .app
	// BEFORE the dmg is built, the only way the app a user drags out of the
	// image carries its own ticket and so launches offline. But driven by
	// ambient shell exports it is invisible in both directions: a plain --sign
	// build would silently notarize, and deleting an export from ~/.zshrc would
	// silently stop stapling the app while everything still "succeeds". So the
	// child's environment is stated explicitly here and never inherited.
	const builderEnv = Object.fromEntries(['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD',
		'APPLE_TEAM_ID', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER',
		'APPLE_KEYCHAIN', 'APPLE_KEYCHAIN_PROFILE'].map((k) => [k, undefined]));
	if (!sign) builderEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
	Object.assign(builderEnv, creds?.builderEnv ?? {});

	run(`npx electron-builder --mac ${dmg ? 'dmg' : 'dir'} ${arch}`, root, builderEnv);

	const outDir = path.join(root, 'out');
	const appDir = arch === '--universal' ? 'mac-universal' : arch === '--x64' ? 'mac' : 'mac-arm64';
	const appPath = path.join(outDir, appDir, 'Clew.app');

	if (sign) {
		// A signature that fails here would fail notarization minutes later.
		run(`codesign --verify --strict --deep --verbose=2 "${appPath}"`);
	}

	if (notarize) {
		// out/ accumulates artifacts across runs and platforms, so identify this
		// build's image by version and recency rather than assuming it is the
		// only .dmg present — notarizing last week's build would be worse than
		// failing outright.
		const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
		const dmgs = fs.readdirSync(outDir)
			.filter((f) => f.endsWith('.dmg') && f.includes(version))
			.map((f) => ({ f, mtime: fs.statSync(path.join(outDir, f)).mtimeMs }))
			.sort((a, b) => b.mtime - a.mtime);
		if (dmgs.length === 0) throw new Error(`no .dmg for version ${version} in out/`);
		const dmgName = dmgs[0].f;
		const dmgPath = path.join(outDir, dmgName);
		console.log(`\n  • notarizing ${dmgName}`);

		// Sign the disk image itself. electron-builder signs the app but leaves
		// the container unsigned, and an unsigned dmg has no signature for
		// Gatekeeper to assess even once a ticket is stapled to it. Apple's
		// order is sign → notarize → staple; stapling does not break it.
		run(`codesign --sign "${developerIdIdentity()}" --timestamp --force "${dmgPath}"`);

		runArgs('xcrun', ['notarytool', 'submit', dmgPath, ...creds.notarytoolArgs, '--wait'],
			`xcrun notarytool submit ${dmgName} --wait`);
		run(`xcrun stapler staple "${dmgPath}"`);
		// The app was already stapled by electron-builder before the dmg was
		// built; re-staple the copy left in out/ so a directly-zipped app is
		// equally self-sufficient.
		try { run(`xcrun stapler staple "${appPath}"`); } catch { console.log('  (app staple skipped)'); }
		// Final proof, and deliberately non-fatal: by this point the ticket is
		// already attached, so a grumpy assessor must not fail the release.
		// stapler validate is the authoritative "is the ticket there" check;
		// for a disk image the spctl assessment type is "open" against the
		// primary signature ("install" is for .pkg installers only).
		try {
			run(`xcrun stapler validate "${dmgPath}"`);
			run(`spctl -a -t open --context context:primary-signature -vv "${dmgPath}"`);
		} catch {
			console.log('  ! post-check reported non-zero — read the output above.');
			console.log('    The dmg is already notarized and stapled; this is a verification step only.');
		}
		console.log(`\nNotarized and stapled: ${dmgPath}`);
	} else {
		console.log(`\nPackaged${sign ? ' and signed' : ' (unsigned)'}. App at ${appPath}`);
	}
}
