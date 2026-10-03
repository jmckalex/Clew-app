// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The `clew` command (FEATURE-IDEAS #8). Run by the shim Help → Install the
// clew Command writes, as Node — Clew's own binary with ELECTRON_RUN_AS_NODE,
// so nothing else need be installed. It asks the RUNNING app over a socket
// in Clew's profile folder (main/deep-link-host.js answers; only this user
// can reach it), and starts Clew first when it is not running. Plain Node,
// no dependencies: it ships unpacked beside the app (Resources/cli).
//
//   clew open <file or folder>   clew new --daily | <note>   clew export --pdf <note>
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseCliArgs, USAGE } from '../main/deep-links.js';

/** Where the app listens: CLEW_CLI_SOCKET, else Clew's profile folder. */
export function socketPath(env = process.env, platform = process.platform) {
	if (env.CLEW_CLI_SOCKET) return env.CLEW_CLI_SOCKET;
	if (platform === 'win32') return `\\\\.\\pipe\\clew-cli-${os.userInfo().username}`;
	const userData = env.CLEW_USER_DATA
		?? (platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support', 'Clew')
			: path.join(env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'Clew'));
	return path.join(userData, 'clew-cli.sock');
}

function ask(sock, request) {
	return new Promise((resolve, reject) => {
		const c = net.connect(sock);
		let data = '';
		c.on('connect', () => c.write(JSON.stringify(request) + '\n'));
		c.on('data', (chunk) => {
			data += chunk;
			const nl = data.indexOf('\n');
			if (nl >= 0) { c.end(); resolve(JSON.parse(data.slice(0, nl))); }
		});
		c.on('error', reject);
		c.on('close', () => { if (!data.includes('\n')) reject(new Error('no answer')); });
	});
}

async function main() {
	const req = parseCliArgs(process.argv.slice(2));
	if (req.error) {
		console.error(`clew: ${req.error}\n${USAGE}`);
		return 2;
	}
	req.cwd = process.cwd();
	const sock = socketPath();
	try {
		return report(await ask(sock, req));
	} catch {
		// Not running: start it (the shim says how), then ask again.
		const launch = process.env.CLEW_CLI_LAUNCH;
		if (!launch) { console.error('clew: Clew is not running'); return 1; }
		// Not as Node: this process runs with ELECTRON_RUN_AS_NODE, and an app
		// started with it would be Node too — and exit at once.
		const env = { ...process.env };
		delete env.ELECTRON_RUN_AS_NODE;
		spawn('/bin/sh', ['-c', launch], { detached: true, stdio: 'ignore', env }).unref();
		for (let t = 0; t < 100; t++) {
			await new Promise((r) => setTimeout(r, 300));
			try { return report(await ask(sock, req)); } catch { /* still starting */ }
		}
		console.error('clew: Clew did not start');
		return 1;
	}
}

function report(answer) {
	if (answer?.ok) {
		if (answer.message) console.log(answer.message);
		return 0;
	}
	console.error(`clew: ${answer?.error ?? 'failed'}`);
	return 1;
}

process.exitCode = await main();
