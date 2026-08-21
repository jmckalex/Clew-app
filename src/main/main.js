// Clew — Electron main process entry point.
import { app, BrowserWindow, Menu, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './ipc.js';
import { settings } from './settings.js';
import { vaults } from './vault.js';
import { RenderService } from './render-service.js';
import { registerPreviewScheme, installPreviewProtocol } from './protocol.js';
import { indexer } from './indexer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.dirname(__dirname); // dist/
const rootDir = path.dirname(distDir);

export const renderService = new RenderService(distDir);
registerPreviewScheme();

vaults.hooks = {
	onOpen: (root) => {
		renderService.openVault(root);
		indexer.openVault(root);
	},
	onClose: () => {
		renderService.closeVault();
		indexer.closeVault();
	},
	onFileChanged: (rel) => {
		renderService.onFileChanged(rel);
		indexer.onFileChanged(rel);
	},
	onStructureChanged: () => indexer.onStructureChanged(),
};

let win = null;

function createWindow() {
	win = new BrowserWindow({
		width: 1280,
		height: 850,
		minWidth: 640,
		minHeight: 400,
		titleBarStyle: 'hiddenInset',
		backgroundColor: '#1e1e1e',
		webPreferences: {
			preload: path.join(distDir, 'preload', 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			plugins: true, // Chromium's built-in PDF viewer
		},
	});

	const send = (channel, payload) => {
		if (!win?.isDestroyed()) win?.webContents.send(channel, payload);
	};
	vaults.send = send;
	renderService.send = send;
	indexer.send = send;

	win.loadFile(path.join(distDir, 'renderer', 'index.html'));

	// External links open in the browser, never inside the app window.
	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	// Defense in depth for the unsandboxed preview frames: nothing may
	// navigate the app's main frame away from the bundled index.html.
	win.webContents.on('will-navigate', (event) => event.preventDefault());

	win.on('closed', () => { win = null; });

	if (process.env.CLEW_DEV) {
		watchRendererDist();
		// Surface renderer console output in the dev terminal.
		win.webContents.on('console-message', (details) => {
			const { level, message, lineNumber, sourceId } = details;
			if (level === 'error' || level === 'warning') {
				console.log(`[renderer:${level}] ${message} (${sourceId}:${lineNumber})`);
			}
		});
	}
}

// Dev mode: reload the window whenever esbuild rewrites the renderer bundle
// or scripts/dev.js recopies static assets.
function watchRendererDist() {
	let timer = null;
	try {
		fs.watch(path.join(distDir, 'renderer'), { recursive: true }, () => {
			clearTimeout(timer);
			timer = setTimeout(() => win?.webContents.reloadIgnoringCache(), 150);
		});
	} catch (err) {
		console.error('dist watcher failed:', err);
	}
}

function buildMenu() {
	const isMac = process.platform === 'darwin';
	const template = [
		...(isMac ? [{ role: 'appMenu' }] : []),
		{
			label: 'File',
			submenu: [
				{
					label: 'Open Vault…',
					accelerator: 'CmdOrCtrl+Shift+O',
					click: () => vaults.openDialog(win),
				},
				// No { role: 'close' }: Cmd+W belongs to the renderer (close tab).
				...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
			],
		},
		{ role: 'editMenu' },
		{ role: 'viewMenu' },
		{ role: 'windowMenu' },
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
	settings.load();
	registerIpc();
	installPreviewProtocol({
		vaults,
		renderService,
		distDir,
		nodeModulesDir: path.join(rootDir, 'node_modules'),
	});
	buildMenu();
	createWindow();

	// Reopen the last vault automatically.
	const last = settings.get('lastVault');
	if (last && fs.existsSync(last)) {
		win.webContents.once('did-finish-load', () => {
			try { vaults.open(last); } catch (err) { console.error('Failed to reopen vault:', err); }
		});
	}

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	app.quit();
});

// Smoke-test hook for headless verification during development:
//   CLEW_SMOKE=/path/out.png            screenshot after boot, then quit
//   CLEW_SMOKE_SCRIPT=/path/scenario.js run this in the renderer first
if (process.env.CLEW_SMOKE) {
	app.whenReady().then(() => {
		setTimeout(async () => {
			try {
				if (process.env.CLEW_SMOKE_SCRIPT) {
					const script = fs.readFileSync(process.env.CLEW_SMOKE_SCRIPT, 'utf8');
					await win.webContents.executeJavaScript(`(async () => { ${script} })()`);
				}
				// Optionally drive the preview iframe's document (cross-origin from
				// the app, but reachable from main via webFrameMain).
				if (process.env.CLEW_SMOKE_FRAME_SCRIPT) {
					const frameScript = fs.readFileSync(process.env.CLEW_SMOKE_FRAME_SCRIPT, 'utf8');
					const frame = win.webContents.mainFrame.frames
						.find((f) => f.url.startsWith('clew-preview:'));
					if (frame) await frame.executeJavaScript(`(async () => { ${frameScript} })()`);
					else console.error('smoke: no preview frame found');
					await new Promise((r) => setTimeout(r, 1500));
				}
				await new Promise((r) => setTimeout(r, 800));
				const image = await win.webContents.capturePage();
				fs.writeFileSync(process.env.CLEW_SMOKE, image.toPNG());
				console.log('smoke: screenshot written');
			} catch (err) {
				console.error('smoke failed:', err);
			}
			app.quit();
		}, 3000);
	});
}
