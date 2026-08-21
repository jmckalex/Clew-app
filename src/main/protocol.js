// The clew-preview:// protocol: serves rendered notes (from the render
// cache), the note's own directory for relative assets (images, TikZ/
// mermaid caches), Clew's vendored preview assets, and the preview client.
//
// URL space (host is always 'vault'):
//   clew-preview://vault/<note path>.html      rendered note (renders on demand)
//   clew-preview://vault/<any other path>      the real file from the vault
//   clew-preview://vault/__clew_assets__/…     vendored assets (mathjax, …)
//   clew-preview://vault/__clew_preview__/client.js   the preview client bundle
//
// Because a rendered note's URL sits in its real directory, relative
// references in the document resolve through this handler untouched.
import { protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { NOTE_EXTENSIONS } from '../shared/channels.js';

const MIME = {
	'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
	'.mjs': 'text/javascript', '.json': 'application/json',
	'.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
	'.avif': 'image/avif', '.pdf': 'application/pdf', '.woff': 'font/woff',
	'.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
	'.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4', '.wav': 'audio/wav', '.txt': 'text/plain',
	'.md': 'text/plain', '.jmd': 'text/plain',
};

export const PREVIEW_SCHEME = 'clew-preview';

/** Must run before app.whenReady(). */
export function registerPreviewScheme() {
	protocol.registerSchemesAsPrivileged([{
		scheme: PREVIEW_SCHEME,
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true,
			stream: true,
		},
	}]);
}

const RENDERED_SUFFIX = new RegExp(`(${NOTE_EXTENSIONS.map((e) => e.replace('.', '\\.')).join('|')})\\.html$`, 'i');

/** After app.whenReady(). */
export function installPreviewProtocol({ vaults, renderService, distDir, nodeModulesDir }) {
	const assetRoots = {
		mathjax: path.join(nodeModulesDir, 'mathjax', 'es5'),
		mermaid: path.join(nodeModulesDir, 'mermaid', 'dist'),
		highlight: path.join(nodeModulesDir, 'highlight.js', 'styles'),
		fontawesome: path.join(nodeModulesDir, '@fortawesome', 'fontawesome-free', 'js'),
		jquery: path.join(nodeModulesDir, 'jquery', 'dist'),
		preview: path.join(distDir, 'engine'), // preview.css
	};

	const headers = (type) => ({
		'Content-Type': type,
		'Cache-Control': 'no-store',
		'Access-Control-Allow-Origin': '*',
	});

	const fileResponse = (absPath, extraHeaders = {}) => {
		if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
			return new Response('Not found', { status: 404, headers: headers('text/plain') });
		}
		const type = MIME[path.extname(absPath).toLowerCase()] ?? 'application/octet-stream';
		return new Response(fs.readFileSync(absPath), { headers: { ...headers(type), ...extraHeaders } });
	};

	protocol.handle(PREVIEW_SCHEME, async (request) => {
		try {
			const url = new URL(request.url);
			const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');

			// Vendored assets and the preview client bundle.
			if (pathname.startsWith('__clew_assets__/')) {
				const rest = pathname.slice('__clew_assets__/'.length);
				const [root, ...restParts] = rest.split('/');
				const base = assetRoots[root];
				if (!base) return new Response('Unknown asset root', { status: 404, headers: headers('text/plain') });
				const abs = path.normalize(path.join(base, ...restParts));
				if (!abs.startsWith(base + path.sep)) {
					return new Response('Forbidden', { status: 403, headers: headers('text/plain') });
				}
				return fileResponse(abs);
			}
			if (pathname.startsWith('__clew_preview__/')) {
				return fileResponse(path.join(distDir, 'preview-client', 'client.js'));
			}

			if (!vaults.isOpen) {
				return new Response('No vault open', { status: 503, headers: headers('text/plain') });
			}

			// Rendered note: "<note path>.html" → render on demand, inject client.
			if (RENDERED_SUFFIX.test(pathname)) {
				const relPath = pathname.replace(/\.html$/i, '');
				vaults.resolve(relPath); // path-escape validation
				let html;
				try {
					const htmlFile = await renderService.ensureRendered(relPath);
					html = fs.readFileSync(htmlFile, 'utf8');
				} catch (err) {
					// First render failed — an error document that still loads the
					// client, so the pane shows the error and recovers on rebuild.
					html = `<!DOCTYPE html><html><head><meta charset="utf-8">`
						+ `<link rel="stylesheet" href="/__clew_assets__/preview/preview.css"></head>`
						+ `<body><div id="__clew_err">${String(err.message ?? err)
							.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div></body></html>`;
				}
				const injected = html.replace(
					/<\/body>/i,
					`<script src="/__clew_preview__/client.js"></script></body>`,
				);
				return new Response(injected, { headers: headers('text/html') });
			}

			// Anything else: the real file from the vault (relative images etc.).
			return fileResponse(vaults.resolve(pathname));
		} catch (err) {
			return new Response(`Preview error: ${String(err.message ?? err)}`,
				{ status: 500, headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' } });
		}
	});
}
