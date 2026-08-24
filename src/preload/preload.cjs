// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Sandboxed preload: the renderer's entire main-process surface is
// window.clew.invoke / window.clew.on, restricted to clew:* channels.
const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_PREFIX = 'clew:';

contextBridge.exposeInMainWorld('clew', {
	invoke(channel, payload) {
		if (!channel.startsWith(ALLOWED_PREFIX)) {
			return Promise.reject(new Error(`Blocked channel: ${channel}`));
		}
		return ipcRenderer.invoke(channel, payload);
	},
	on(channel, fn) {
		if (!channel.startsWith(ALLOWED_PREFIX)) {
			throw new Error(`Blocked channel: ${channel}`);
		}
		const listener = (_event, data) => fn(data);
		ipcRenderer.on(channel, listener);
		return () => ipcRenderer.removeListener(channel, listener);
	},
});
