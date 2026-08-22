// Read-only canvas embeds in rendered notes: ![[X.canvas]] emits a shell div
// (see src/engine/wikilinks.js); this module fetches the canvas JSON over the
// same clew-preview:// origin and renders the scene — cards, file nodes, live
// note previews (nested iframes), web links, groups, edges, ink, and shapes —
// scaled to fit the note column. The host posts {type:'canvas-changed'} when
// a .canvas file changes and the scene rebuilds in place.
import { parseCanvas, canvasBounds, nodeRect, strokePath } from '../renderer/canvas/canvas-model.js';
import { inkColor, shapeSvg, edgeSvg, escapeXml } from '../renderer/canvas/shape-svg.js';
import { renderCardHtml } from '../renderer/canvas/card-markdown.js';

// Nesting guard: a canvas embed renders note nodes as iframes (?cdepth=N+1);
// inside those, canvas embeds render as a plain title box, so a canvas that
// embeds a note that embeds the canvas terminates instead of recursing.
const DEPTH = Number(new URLSearchParams(location.search).get('cdepth') ?? 0);
const SID = location.pathname.replace(/^\/+/, '').split('/')[0];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|flac)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const NOTE_EXT = /\.(md|jmd)$/i;

const sitePath = (rel) => `/${SID}/` + rel.split('/').map(encodeURIComponent).join('/');
const MAX_SCENE_H = 480;

export function initCanvasEmbeds() {
	for (const embed of document.querySelectorAll('.canvas-embed[data-canvas-path]')) {
		const scene = embed.querySelector('.canvas-embed-scene');
		if (!scene || scene.dataset.built) continue;
		scene.dataset.built = '1';
		const rel = decodeURIComponent(
			embed.dataset.canvasPath.replace(/^\/+/, '').split('/').slice(1).join('/'));
		scene.dataset.canvasRel = rel;
		if (DEPTH >= 1) {
			scene.classList.add('is-deep');
			scene.textContent = '(open the canvas to view it)';
			continue;
		}
		buildScene(embed, scene).catch((err) => {
			scene.textContent = `(canvas failed to load: ${err.message})`;
		});
	}
}

/** A .canvas file changed on disk — rebuild every embed showing it. */
export function refreshCanvasEmbeds(vaultPath) {
	for (const scene of document.querySelectorAll('.canvas-embed-scene[data-canvas-rel]')) {
		if (scene.dataset.canvasRel !== vaultPath || DEPTH >= 1) continue;
		const embed = scene.closest('.canvas-embed');
		buildScene(embed, scene).catch(() => {});
	}
}

async function buildScene(embed, scene) {
	const response = await fetch(embed.dataset.canvasPath);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const doc = parseCanvas(await response.text());
	const bounds = canvasBounds(doc);
	scene.replaceChildren();
	if (!bounds) {
		scene.classList.add('is-empty');
		scene.textContent = '(empty canvas)';
		return;
	}
	scene.classList.remove('is-empty');

	const pad = 30;
	const bx = bounds.x - pad, by = bounds.y - pad;
	const bw = bounds.width + pad * 2, bh = bounds.height + pad * 2;
	const width = scene.clientWidth || embed.clientWidth || 600;
	const scale = Math.min(width / bw, MAX_SCENE_H / bh, 1);
	scene.style.height = `${Math.round(bh * scale)}px`;

	const world = document.createElement('div');
	world.className = 'canvas-embed-world';
	world.style.transform = `scale(${scale}) translate(${-bx}px, ${-by}px)`;

	const svgLayer = (cls) => {
		const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		el.setAttribute('class', cls);
		el.setAttribute('viewBox', `${bx} ${by} ${bw} ${bh}`);
		el.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;overflow:visible;pointer-events:none`;
		return el;
	};

	// Layer order matches the canvas view: groups, edges, nodes, ink+shapes.
	const groups = doc.nodes.filter((n) => n.type === 'group');
	const others = doc.nodes.filter((n) => n.type !== 'group');
	for (const node of groups) world.append(groupEl(node));

	const edges = svgLayer('canvas-embed-edges');
	const byId = new Map(doc.nodes.map((n) => [n.id, n]));
	edges.innerHTML = doc.edges
		.map((edge) => {
			const from = byId.get(edge.fromNode);
			const to = byId.get(edge.toNode);
			return from && to ? edgeSvg(edge, from, to) : '';
		})
		.join('');
	world.append(edges);

	for (const node of others) world.append(nodeEl(node));

	const ink = svgLayer('canvas-embed-ink');
	ink.innerHTML = doc.strokes.map((stroke) =>
		`<path class="canvas-stroke" d="${strokePath(stroke)}"`
		+ ` style="stroke:${inkColor(stroke.color)};stroke-width:${stroke.width}"/>`).join('')
		+ doc.shapes.map((shape) => shapeSvg(shape, false)).join('');
	world.append(ink);

	scene.append(world);
}

function groupEl(node) {
	const el = document.createElement('div');
	el.className = 'canvas-embed-group';
	place(el, nodeRect(node));
	if (node.label) {
		const label = document.createElement('span');
		label.textContent = node.label;
		el.append(label);
	}
	return el;
}

function nodeEl(node) {
	const el = document.createElement('div');
	el.className = 'canvas-embed-node';
	if (node.color) el.dataset.color = node.color;
	place(el, nodeRect(node));

	if (node.type === 'text') {
		el.classList.add('is-card');
		el.innerHTML = renderCardHtml(node.text ?? '');
	} else if (node.type === 'link') {
		el.classList.add('is-web');
		const a = document.createElement('a');
		a.href = node.url;
		a.textContent = node.url;
		el.append(a);
	} else if (node.type === 'file' && node.file) {
		const src = sitePath(node.file);
		if (IMAGE_EXT.test(node.file)) {
			el.innerHTML = `<img src="${src}" alt="">`;
		} else if (node.file.toLowerCase().endsWith('.pdf')) {
			el.innerHTML = `<embed src="${src}" type="application/pdf">`;
		} else if (VIDEO_EXT.test(node.file)) {
			el.innerHTML = `<video controls src="${src}"></video>`;
		} else if (AUDIO_EXT.test(node.file)) {
			el.innerHTML = `<audio controls src="${src}"></audio>`;
		} else if (NOTE_EXT.test(node.file)) {
			// A live nested note preview; cdepth breaks embed cycles.
			el.innerHTML = `<iframe src="${src}.html?cdepth=${DEPTH + 1}"></iframe>`;
		} else {
			el.classList.add('is-chip');
			el.innerHTML = `<span>${escapeXml(node.file.split('/').pop())}</span>`;
		}
	}
	return el;
}

function place(el, r) {
	el.style.left = `${r.x}px`;
	el.style.top = `${r.y}px`;
	el.style.width = `${r.width}px`;
	el.style.height = `${r.height}px`;
}

/** The app theme changed — push it into nested note iframes too. */
export function broadcastThemeToNested(theme) {
	for (const frame of document.querySelectorAll('.canvas-embed-node iframe')) {
		frame.contentWindow?.postMessage(
			{ source: 'clew-preview-host', type: 'theme', theme }, '*');
	}
}

// Nested note iframes talk clew-preview protocol at us (their parent): greet
// them with the theme, and relay link clicks upward so they open app tabs.
window.addEventListener('message', (event) => {
	const msg = event.data;
	if (!msg || msg.source !== 'clew-preview') return;
	const fromNested = [...document.querySelectorAll('.canvas-embed-node iframe')]
		.some((f) => f.contentWindow === event.source);
	if (!fromNested) return;
	if (msg.type === 'ready') {
		event.source.postMessage({
			source: 'clew-preview-host',
			type: 'theme',
			theme: document.documentElement.dataset.theme ?? 'dark',
		}, '*');
	} else if (msg.type === 'link-click' || msg.type === 'external-link') {
		window.parent.postMessage(msg, '*');
	}
});
