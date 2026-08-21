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
