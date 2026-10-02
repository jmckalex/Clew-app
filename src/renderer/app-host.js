// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The app page's half of the bridge (docs/dev/frame-bridge.md §7–§9). The
// app page is the HOST — never the preview document around an app, which is
// vault content:
//
//   1. A preview document that holds an `@app[…]` embed (preview-client/
//      app-embed.js) tells the host `app-embed` with the app's key. The host
//      asks main what the app may do (APP_STATUS) and, when something is
//      unanswered, draws the PROMPT — on the app page, outside every frame,
//      so neither the app nor the note can forge it. In a vault this device
//      has not trusted the frame is not even created until the answer (R1,
//      choice B); in a trusted one it starts at once and waits for its port.
//   2. The app's bridge client (clew-bridge.js) says hello to window.top.
//      The host knows WHICH app by the sender's origin — clew-frame://<key>,
//      which only Clew's handler serves — and accepts it only from a frame
//      whose parent is a document that announced that key. It answers with
//      a fresh MessageChannel port, transferred to that frame's origin.
//   3. Over the port: `{v, id, method, params}` → limits here (size, in
//      flight, rate) → main (APP_CALL), which checks the grant at call time.
//      `context` and `open` are answered here, `open` under `links.open`.
//   4. A grant revoked or changed (Settings, a new answer): every port of
//      that app closes and its frames reload — and ask again if they must.
import { ipc, CH } from './ipc.js';
import { fromPreviewOrigin, PREVIEW_ORIGIN } from '../shared/message-guard.js';
import { settingsStore } from './state/settings-store.js';
import { workspaceStore } from './state/workspace-store.js';
import { vaultStore } from './state/vault-store.js';

const MAX_REQUEST = 1024 * 1024;
const MAX_IN_FLIGHT = 32;
const RATE = 50;     // requests per second, refilled continuously
const BURST = 200;

/** key → Set<WindowProxy> of the documents embedding it */
const embedders = new Map();
/** WindowProxy → note path it announced */
const notePaths = new Map();
/** key → Promise of the prompt being shown */
const prompts = new Map();
/** key → Set<port record> */
const ports = new Map();

const queue = [];
let showing = null;

function tellEmbedders(key, type) {
	for (const win of embedders.get(key) ?? []) {
		try { win.postMessage({ source: 'clew-preview-host', type, key }, PREVIEW_ORIGIN); } catch { /* gone */ }
	}
}

// ---- the prompt -----------------------------------------------------------

function promptText(status) {
	const asks = status.ask.map((c) => status.describe?.[c] ?? c);
	const where = status.restricted ? 'a vault you haven\'t trusted' : 'this vault';
	let lead = status.changed
		? `“${status.name}” has changed since you allowed it.`
		: `“${status.name}” is an app in ${where}.`;
	const wants = [];
	if (status.askRun) wants.push('run here');
	if (asks.length) {
		// The pair that matters most, said as the pair it is (§9).
		const reads = status.ask.some((c) => c === 'note.read' || c === 'notes.read');
		const net = status.ask.includes('network');
		wants.push(`${wants.length ? 'and to ' : ''}${asks.join(', ').replace(/, ([^,]*)$/, ' and $1')}`);
		if (reads && net) lead += ' It asks both to read and to send data out.';
	}
	return { lead, wants: wants.length ? `It wants to ${wants.join(', ')}.` : '' };
}

function drawPrompt(status, done) {
	const sheet = document.createElement('div');
	sheet.className = 'clew-trust-sheet clew-app-sheet';
	sheet.setAttribute('role', 'dialog');
	sheet.setAttribute('aria-modal', 'true');
	sheet.dataset.appKey = status.key;
	const card = document.createElement('div');
	card.className = 'clew-trust-card';
	const title = document.createElement('h2');
	title.textContent = `Allow “${status.name}”?`;
	const { lead, wants } = promptText(status);
	const p1 = document.createElement('p');
	p1.textContent = `${lead} ${wants}`.trim();
	const p2 = document.createElement('p');
	p2.className = 'clew-trust-why';
	p2.textContent = `Its code runs apart from Clew and from the vault, on an origin of its own; it reaches only what you allow here, on this device. From ${status.folder}/.`;
	const buttons = document.createElement('div');
	buttons.className = 'clew-trust-buttons';
	const no = document.createElement('button');
	no.className = 'clew-trust-keep';
	no.textContent = 'Don\'t allow';
	const yes = document.createElement('button');
	yes.className = 'clew-trust-button';
	yes.textContent = 'Allow';
	const answer = (allow) => {
		yes.disabled = no.disabled = true;
		ipc.invoke(CH.APP_ANSWER, { key: status.key, allow }).catch(() => null).then((after) => {
			sheet.remove();
			done(after);
		});
	};
	no.addEventListener('click', () => answer(false));
	yes.addEventListener('click', () => answer(true));
	buttons.append(no, yes);
	card.append(title, p1, p2, buttons);
	sheet.append(card);
	document.body.append(sheet);
	yes.focus();
}

function nextPrompt() {
	if (showing || queue.length === 0) return;
	const { status, resolve } = queue.shift();
	showing = status.key;
	drawPrompt(status, (after) => {
		showing = null;
		resolve(after);
		nextPrompt();
	});
}

/** The prompt for an app, once however many embeds ask; resolves to the
 *  status after the answer. */
function ensurePrompt(status) {
	if (!prompts.has(status.key)) {
		prompts.set(status.key, new Promise((resolve) => {
			queue.push({ status, resolve });
			nextPrompt();
		}).finally(() => prompts.delete(status.key)));
	}
	return prompts.get(status.key);
}

const status = (key) => ipc.invoke(CH.APP_STATUS, { key }).catch(() => null);
const needsAnswer = (st) => st && (st.askRun || st.ask.length > 0);

// ---- 1: a document announces an embed ---------------------------------------

async function onEmbed(event, msg) {
	const key = String(msg.key ?? '');
	if (!embedders.has(key)) embedders.set(key, new Set());
	embedders.get(key).add(event.source);
	if (typeof msg.notePath === 'string') notePaths.set(event.source, msg.notePath);
	let st = await status(key);
	if (!st) return tellEmbedders(key, 'app-denied');
	// Trusted: the frame starts now; only capabilities wait (for its port).
	if (st.mayRun && !st.askRun) {
		event.source.postMessage({ source: 'clew-preview-host', type: 'app-run', key }, PREVIEW_ORIGIN);
		if (st.ask.length) ensurePrompt(st);
		return;
	}
	if (needsAnswer(st)) st = (await ensurePrompt(st)) ?? (await status(key));
	tellEmbedders(key, st?.mayRun ? 'app-run' : 'app-denied');
}

// ---- 2: the app says hello ----------------------------------------------------

function keyOf(origin) {
	try {
		const url = new URL(origin);
		return url.protocol === 'clew-frame:' ? url.hostname : null;
	} catch {
		return null;
	}
}

async function onHello(event) {
	const key = keyOf(event.origin);
	const parent = event.source?.parent;
	if (!key || !parent || !embedders.get(key)?.has(parent)) return;   // not a frame a document announced
	if ([...(ports.get(key) ?? [])].some((r) => r.frame === event.source)) return;   // already has its port
	let st = await status(key);
	if (st && needsAnswer(st)) st = (await ensurePrompt(st)) ?? (await status(key));
	if (!st?.mayRun) {
		event.source.postMessage({ source: 'clew-app-host', type: 'refused', message: 'not allowed to run here' }, event.origin);
		return;
	}
	if ([...(ports.get(key) ?? [])].some((r) => r.frame === event.source)) return;
	const channel = new MessageChannel();
	const record = {
		key, frame: event.source, port: channel.port1, notePath: notePaths.get(parent) ?? null,
		granted: new Set(st.granted), inFlight: 0, tokens: BURST, at: performance.now(),
	};
	if (!ports.has(key)) ports.set(key, new Set());
	ports.get(key).add(record);
	channel.port1.onmessage = (e) => onRequest(record, e.data);
	event.source.postMessage({ source: 'clew-app-host', type: 'welcome', v: 1, granted: st.granted, tier2: false }, event.origin, [channel.port2]);
}

// ---- 3: requests over the port --------------------------------------------------

function reply(record, id, outcome) {
	try { record.port.postMessage({ v: 1, id, ...outcome }); } catch { /* closed */ }
}

function take(record) {
	const now = performance.now();
	record.tokens = Math.min(BURST, record.tokens + ((now - record.at) / 1000) * RATE);
	record.at = now;
	if (record.tokens < 1) return false;
	record.tokens -= 1;
	return true;
}

async function onRequest(record, msg) {
	if (!msg || msg.v !== 1 || typeof msg.id !== 'string' || typeof msg.method !== 'string') return;
	const fail = (code, message) => reply(record, msg.id, { ok: false, error: { code, message } });
	let size = 0;
	try { size = JSON.stringify(msg.params ?? null).length; } catch { size = 0; }
	if (msg.params?.data instanceof ArrayBuffer) size += msg.params.data.byteLength;
	if (size > MAX_REQUEST && msg.method !== 'files.write') return fail('too-large', 'a request is limited to 1 MB');
	if (record.inFlight >= MAX_IN_FLIGHT) return fail('rate-limited', 'too many requests in flight');
	if (!take(record)) return fail('rate-limited', 'too many requests');
	record.inFlight++;
	try {
		if (msg.method === 'context') {
			return reply(record, msg.id, { ok: true, result: { path: record.notePath, theme: settingsStore.get('theme') ?? 'dark', vault: vaultStore.vault?.name ?? null } });
		}
		if (msg.method === 'open') return reply(record, msg.id, await openTarget(record, msg.params?.target));
		const out = await ipc.invoke(CH.APP_CALL, { key: record.key, notePath: record.notePath, method: msg.method, params: msg.params ?? {} })
			.catch((err) => ({ ok: false, error: { code: 'internal', message: String(err?.message ?? err) } }));
		reply(record, msg.id, out);
	} finally {
		record.inFlight--;
	}
}

async function openTarget(record, target) {
	if (!record.granted.has('links.open')) return { ok: false, error: { code: 'denied', message: 'open needs "links.open"' } };
	const t = String(target ?? '').trim();
	if (/^(https?:|mailto:)/i.test(t)) {
		await ipc.invoke(CH.SHELL_OPEN_EXTERNAL, { url: t }).catch(() => {});
		return { ok: true, result: true };
	}
	if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return { ok: false, error: { code: 'denied', message: 'only notes, http(s) and mailto links' } };
	const [notePart] = t.split('#');
	const path = vaultStore.notePaths().includes(notePart) ? notePart : vaultStore.resolveNoteName(notePart);
	if (!path || !vaultStore.notePaths().includes(path)) return { ok: false, error: { code: 'not-found', message: `no note ${notePart}` } };
	workspaceStore.openNote(path, { newTab: true });
	return { ok: true, result: true };
}

// ---- 4: grants changed ------------------------------------------------------------

function closePorts(key) {
	for (const record of ports.get(key) ?? []) {
		try { record.port.postMessage({ v: 1, event: 'closed', payload: {} }); } catch { /* gone */ }
		try { record.port.close(); } catch { /* gone */ }
	}
	ports.delete(key);
}

export function installAppHost() {
	window.addEventListener('message', (event) => {
		const msg = event.data;
		if (msg?.source === 'clew-preview' && msg.type === 'app-embed' && fromPreviewOrigin(event)) {
			onEmbed(event, msg);
		} else if (msg?.source === 'clew-app' && msg.type === 'hello' && /^clew-frame:/.test(event.origin) && event.source) {
			onHello(event);
		}
	});
	ipc.on(CH.EV_APP_GRANTS_CHANGED, ({ key }) => {
		closePorts(key);
		tellEmbedders(key, 'app-reload');
	});
	settingsStore.on('settings-changed', (k) => {
		if (k !== 'theme') return;
		for (const set of ports.values()) {
			for (const record of set) {
				try { record.port.postMessage({ v: 1, event: 'theme', payload: { theme: settingsStore.get('theme') } }); } catch { /* gone */ }
			}
		}
	});
	ipc.on(CH.EV_VAULT_OPENED, () => {
		for (const key of [...ports.keys()]) closePorts(key);
		embedders.clear();
		notePaths.clear();
	});
}
