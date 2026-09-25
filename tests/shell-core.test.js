// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The shell panel's back end (src/main/shell-core.js) — one real shell per
// window, under a real pty, with no native addon. The mechanism is the
// owner's own, from Godot/jmacs; these tests pin the parts that were learned
// the hard way there, because each of them fails SILENTLY when it regresses:
// a shell with no prompt, a resized panel whose shell still believes its
// first geometry, or a leaked pty that outlives its window.
//
// The last test runs a REAL pty and asks a real shell to echo something.
// Everything above it is pure, so a machine without python3 still pins the
// shape of the thing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import {
	PYTHON_PTY_SCRIPT, ShellSessions, userShell, resizeLine, hasPythonPty, resetPythonProbe,
} from '../src/main/shell-core.js';

/** A spawn that records instead of forking. */
function fakeSpawn() {
	const calls = [];
	const child = {
		stdin: { writes: [], write(d) { this.writes.push(d); return true; } },
		stdout: { on() {} },
		stderr: { on() {} },
		stdio: [null, null, null, { writable: true, writes: [], write(d) { this.writes.push(d); return true; } }],
		killed: null,
		handlers: {},
		on(event, fn) { this.handlers[event] = fn; },
		kill(signal) { this.killed = signal; },
	};
	const spawnFn = (command, args, options) => { calls.push({ command, args, options }); return child; };
	return { spawnFn, calls, child };
}

const openOptions = (over = {}) => ({
	cwd: '/vault', onData() {}, onExit() {}, ...over,
});

test('the pty child is python3 running the helper, with the shell as its argument', () => {
	// node-pty would be a compiled module rebuilt for every Electron version
	// on every platform Clew ships to; python3's stdlib pty is not.
	const { spawnFn, calls } = fakeSpawn();
	const sessions = new ShellSessions();
	const info = sessions.open('w1', openOptions({ spawnFn, pty: true }));
	assert.equal(calls.length, 1);
	assert.equal(calls[0].command, 'python3');
	assert.equal(calls[0].args[0], '-c');
	assert.equal(calls[0].args[1], PYTHON_PTY_SCRIPT);
	assert.equal(calls[0].args[2], info.shell);
	assert.equal(calls[0].options.cwd, '/vault');
	assert.equal(info.pty, true);
});

test('fd 3 is opened as a pipe — it is the resize sidechannel', () => {
	// Four stdio entries, not three. The helper selects on fd 3 and turns
	// each line into TIOCSWINSZ on the pty master; without the extra pipe the
	// helper's select() raises and the session dies on the first resize.
	const { spawnFn, calls } = fakeSpawn();
	new ShellSessions().open('w1', openOptions({ spawnFn, pty: true }));
	assert.deepEqual(calls[0].options.stdio, ['pipe', 'pipe', 'pipe', 'pipe']);
});

test('TERM says xterm-256color, so a prompt has colour', () => {
	const { spawnFn, calls } = fakeSpawn();
	new ShellSessions().open('w1', openOptions({ spawnFn, pty: true }));
	assert.equal(calls[0].options.env.TERM, 'xterm-256color');
});

test('the helper resets SIGTERM to the default disposition', () => {
	// A child spawned by Electron can INHERIT an ignored SIGTERM across exec,
	// which makes kill() a silent no-op: the helper then sits in select() for
	// ever and the pty, with the shell inside it, leaks.
	assert.match(PYTHON_PTY_SCRIPT, /signal\.signal\(signal\.SIGTERM, signal\.SIG_DFL\)/);
	// And it must be set BEFORE the fork, or the child inherits the ignore.
	assert.ok(PYTHON_PTY_SCRIPT.indexOf('SIG_DFL') < PYTHON_PTY_SCRIPT.indexOf('pty.fork()'));
});

test('the helper is one statement per line — it is passed as a single -c argument', () => {
	// Python has no braces: an accidental joining of two lines is a
	// SyntaxError at spawn time, and the panel shows an empty grid.
	for (const line of PYTHON_PTY_SCRIPT.split('\n')) {
		assert.ok(!line.includes(';') || /^import |^\s+cols = /.test(line), line);
	}
	assert.match(PYTHON_PTY_SCRIPT, /select\.select\(\[0, fd, 3\]/);
	assert.match(PYTHON_PTY_SCRIPT, /TIOCSWINSZ/);
});

test('a resize is one line of <cols>:<rows>, integral and never zero', () => {
	// The kernel reads the struct as unsigned shorts; a 0 or a fraction is a
	// geometry no shell can reflow to.
	assert.equal(resizeLine(80, 24), '80:24\n');
	assert.equal(resizeLine(120.7, 30.2), '120:30\n');
	assert.equal(resizeLine(0, 0), '1:1\n');
	assert.equal(resizeLine(-5, NaN), '1:1\n');
	assert.equal(resizeLine(undefined, null), '1:1\n');
});

test('resize writes to fd 3 and never into the shell itself', () => {
	// Down the pty it would be typed input: a stray `80:24` on the command line.
	const { spawnFn, child } = fakeSpawn();
	const sessions = new ShellSessions();
	sessions.open('w1', openOptions({ spawnFn, pty: true }));
	assert.equal(sessions.resize('w1', 100, 40), true);
	assert.deepEqual(child.stdio[3].writes, ['100:40\n']);
	assert.deepEqual(child.stdin.writes, []);
});

test('without a pty there is no sidechannel, and a resize is simply declined', () => {
	const { spawnFn, calls } = fakeSpawn();
	const sessions = new ShellSessions();
	const info = sessions.open('w1', openOptions({ spawnFn, pty: false }));
	assert.equal(info.pty, false);
	assert.equal(calls[0].command, info.shell);
	assert.deepEqual(calls[0].args, ['-i']);
	assert.deepEqual(calls[0].options.stdio, ['pipe', 'pipe', 'pipe']);
	assert.equal(sessions.resize('w1', 100, 40), false);
});

test('keystrokes go down stdin, and a session that is gone swallows them', () => {
	const { spawnFn, child } = fakeSpawn();
	const sessions = new ShellSessions();
	sessions.open('w1', openOptions({ spawnFn, pty: true }));
	assert.equal(sessions.write('w1', 'ls\r'), true);
	assert.deepEqual(child.stdin.writes, ['ls\r']);
	assert.equal(sessions.write('nobody', 'ls\r'), false);
});

test('one session per key: opening again replaces the first and kills it', () => {
	// The key is the window's session id. Two ptys for one panel would leave
	// one of them unreachable and running.
	const a = fakeSpawn();
	const sessions = new ShellSessions();
	sessions.open('w1', openOptions({ spawnFn: a.spawnFn, pty: true }));
	const b = fakeSpawn();
	sessions.open('w1', openOptions({ spawnFn: b.spawnFn, pty: true }));
	assert.equal(a.child.killed, 'SIGTERM');
	assert.equal(sessions.size, 1);
});

test('closing kills the child; closeAll empties the map', () => {
	const a = fakeSpawn();
	const b = fakeSpawn();
	const sessions = new ShellSessions();
	sessions.open('w1', openOptions({ spawnFn: a.spawnFn, pty: true }));
	sessions.open('w2', openOptions({ spawnFn: b.spawnFn, pty: true }));
	assert.equal(sessions.size, 2);
	assert.equal(sessions.close('w1'), true);
	assert.equal(a.child.killed, 'SIGTERM');
	assert.equal(sessions.has('w1'), false);
	assert.equal(sessions.close('w1'), false);
	sessions.closeAll();
	assert.equal(sessions.size, 0);
	assert.equal(b.child.killed, 'SIGTERM');
});

test("the child's exit forgets the session and tells the panel", () => {
	const { spawnFn, child } = fakeSpawn();
	const sessions = new ShellSessions();
	const ends = [];
	sessions.open('w1', openOptions({ spawnFn, pty: true, onExit: (end) => ends.push(end) }));
	child.handlers.exit(0, null);
	assert.deepEqual(ends, [{ code: 0, signal: null }]);
	assert.equal(sessions.has('w1'), false);
});

test("a replaced session's late exit does not evict the new one", () => {
	// The kill and the 'exit' event are not simultaneous: the dying child's
	// handler fires after its replacement is already in the map.
	const a = fakeSpawn();
	const sessions = new ShellSessions();
	sessions.open('w1', openOptions({ spawnFn: a.spawnFn, pty: true }));
	const b = fakeSpawn();
	sessions.open('w1', openOptions({ spawnFn: b.spawnFn, pty: true }));
	a.child.handlers.exit(null, 'SIGTERM');
	assert.equal(sessions.has('w1'), true, 'the live session must survive its predecessor');
});

test("a spawn error is reported into the grid rather than thrown", () => {
	const { spawnFn, child } = fakeSpawn();
	const written = [];
	const sessions = new ShellSessions();
	sessions.open('w1', openOptions({ spawnFn, pty: true, onData: (d) => written.push(d) }));
	child.handlers.error(new Error('ENOENT python3'));
	assert.match(written.join(''), /could not start a shell: ENOENT python3/);
});

test('the shell is the login shell; Windows gets its own and never a pty', () => {
	assert.equal(userShell({ SHELL: '/bin/zsh' }, 'darwin'), '/bin/zsh');
	assert.equal(userShell({}, 'linux'), '/bin/sh');
	assert.equal(userShell({ COMSPEC: 'C:\\cmd.exe' }, 'win32'), 'C:\\cmd.exe');
	assert.equal(userShell({}, 'win32'), 'cmd.exe');
	resetPythonProbe();
	assert.equal(hasPythonPty({ platform: 'win32' }), false);
});

test('the python probe runs once, not once per spawn', () => {
	resetPythonProbe();
	let probes = 0;
	const run = () => { probes += 1; return { status: 0 }; };
	assert.equal(hasPythonPty({ platform: 'darwin', run }), true);
	assert.equal(hasPythonPty({ platform: 'darwin', run }), true);
	assert.equal(probes, 1);
	resetPythonProbe();
	assert.equal(hasPythonPty({ platform: 'darwin', run: () => { throw new Error('no python'); } }), false);
	resetPythonProbe();
});

// ---- the real thing ------------------------------------------------------

test('a real pty runs a real shell, echoes, and dies when killed', async (t) => {
	resetPythonProbe();
	if (os.platform() === 'win32' || !hasPythonPty()) return t.skip('no python3 with a pty here');
	const sessions = new ShellSessions();
	let output = '';
	const exited = [];
	const info = sessions.open('real', {
		cwd: os.tmpdir(),
		onData: (data) => { output += data; },
		onExit: (end) => exited.push(end),
	});
	assert.equal(info.pty, true);
	// A pty echoes what is typed, which is the whole difference from a pipe.
	sessions.write('real', 'echo clew-shell-ok\n');
	sessions.resize('real', 100, 30);
	const deadline = Date.now() + 15000;
	while (!/clew-shell-ok/.test(output.replace('echo clew-shell-ok', '')) && Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 100));
	}
	assert.match(output, /clew-shell-ok/);
	// The echo of the command plus its output: two occurrences, which is a pty.
	assert.ok(output.split('clew-shell-ok').length - 1 >= 2, `pty echo missing:\n${output}`);
	sessions.close('real');
	// And SIGTERM must actually reap it — the ignored-disposition trap above.
	const gone = Date.now() + 10000;
	while (exited.length === 0 && Date.now() < gone) await new Promise((r) => setTimeout(r, 100));
	assert.equal(exited.length, 1, 'SIGTERM did not reap the helper');
});
