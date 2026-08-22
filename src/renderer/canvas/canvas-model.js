// The canvas document model: pure data + geometry, no DOM. Files are JSON
// Canvas 1.0 (Obsidian-compatible .canvas: nodes + edges); Clew's drawing
// layer (freehand strokes) and shape layer (Excalidraw-style rect/ellipse/
// diamond/arrow/line) live under a top-level "clew" key that other apps
// ignore. All coordinates are world-space; y grows downward.

export function newId() {
	let id = '';
	for (let i = 0; i < 16; i++) id += Math.floor(Math.random() * 16).toString(16);
	return id;
}

export const NODE_MIN_W = 60;
export const NODE_MIN_H = 40;
export const SIDES = ['top', 'right', 'bottom', 'left'];

// ---- document --------------------------------------------------------------

export function createCanvas() {
	return { nodes: [], edges: [], strokes: [], shapes: [] };
}

/** Parse .canvas JSON text, tolerating unknown fields and bad input. */
export function parseCanvas(text) {
	const doc = createCanvas();
	let json;
	try { json = JSON.parse(text); } catch { return doc; }
	if (!json || typeof json !== 'object') return doc;
	for (const n of Array.isArray(json.nodes) ? json.nodes : []) {
		if (!n || typeof n !== 'object' || !n.id) continue;
		const node = {
			id: String(n.id),
			type: ['text', 'file', 'link', 'group'].includes(n.type) ? n.type : 'text',
			x: num(n.x), y: num(n.y),
			width: Math.max(NODE_MIN_W, num(n.width, 250)),
			height: Math.max(NODE_MIN_H, num(n.height, 60)),
		};
		if (n.color != null) node.color = String(n.color);
		if (node.type === 'text') node.text = String(n.text ?? '');
		if (node.type === 'file') {
			node.file = String(n.file ?? '');
			if (n.subpath != null) node.subpath = String(n.subpath);
		}
		if (node.type === 'link') node.url = String(n.url ?? '');
		if (node.type === 'group' && n.label != null) node.label = String(n.label);
		doc.nodes.push(node);
	}
	const ids = new Set(doc.nodes.map((n) => n.id));
	for (const e of Array.isArray(json.edges) ? json.edges : []) {
		if (!e || typeof e !== 'object' || !e.id) continue;
		if (!ids.has(e.fromNode) || !ids.has(e.toNode)) continue;
		const edge = {
			id: String(e.id),
			fromNode: String(e.fromNode),
			fromSide: SIDES.includes(e.fromSide) ? e.fromSide : 'right',
			toNode: String(e.toNode),
			toSide: SIDES.includes(e.toSide) ? e.toSide : 'left',
		};
		if (e.color != null) edge.color = String(e.color);
		if (e.label != null && e.label !== '') edge.label = String(e.label);
		doc.edges.push(edge);
	}
	const clew = json.clew && typeof json.clew === 'object' ? json.clew : {};
	for (const s of Array.isArray(clew.strokes) ? clew.strokes : []) {
		if (!s || !Array.isArray(s.points) || s.points.length < 4) continue;
		doc.strokes.push({
			id: String(s.id ?? newId()),
			color: String(s.color ?? 'ink'),
			width: num(s.width, 3),
			points: s.points.map((v) => num(v)),
		});
	}
	for (const s of Array.isArray(clew.shapes) ? clew.shapes : []) {
		if (!s || typeof s !== 'object') continue;
		const shape = {
			id: String(s.id ?? newId()),
			kind: ['rect', 'ellipse', 'diamond', 'arrow', 'line'].includes(s.kind) ? s.kind : 'rect',
			x: num(s.x), y: num(s.y),
			width: num(s.width, 100), height: num(s.height, 80),
			color: String(s.color ?? 'ink'),
		};
		if (s.label != null && s.label !== '') shape.label = String(s.label);
		if (s.fill === true) shape.fill = true;
		if (s.style === 'clean') shape.style = 'clean'; // default is sketchy
		doc.shapes.push(shape);
	}
	return doc;
}

export function serializeCanvas(doc) {
	const out = { nodes: doc.nodes, edges: doc.edges };
	if (doc.strokes.length || doc.shapes.length) {
		out.clew = {};
		if (doc.strokes.length) out.clew.strokes = doc.strokes;
		if (doc.shapes.length) out.clew.shapes = doc.shapes;
	}
	return JSON.stringify(out, null, '\t');
}

function num(v, fallback = 0) {
	return Number.isFinite(Number(v)) ? Number(v) : fallback;
}

// ---- geometry --------------------------------------------------------------

export function nodeRect(node) {
	return { x: node.x, y: node.y, width: node.width, height: node.height };
}

/** For line/arrow shapes, width/height may be negative (endpoint encoding). */
export function shapeRect(shape) {
	const x = Math.min(shape.x, shape.x + shape.width);
	const y = Math.min(shape.y, shape.y + shape.height);
	return { x, y, width: Math.abs(shape.width), height: Math.abs(shape.height) };
}

export function rectContains(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function rectsIntersect(a, b) {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Topmost regular node at a point; groups only when no regular node hits. */
export function nodeAt(doc, x, y) {
	for (let i = doc.nodes.length - 1; i >= 0; i--) {
		const n = doc.nodes[i];
		if (n.type !== 'group' && rectContains(nodeRect(n), x, y)) return n;
	}
	for (let i = doc.nodes.length - 1; i >= 0; i--) {
		const n = doc.nodes[i];
		if (n.type === 'group' && rectContains(nodeRect(n), x, y)) return n;
	}
	return null;
}

export function shapeAt(doc, x, y, slop = 6) {
	for (let i = doc.shapes.length - 1; i >= 0; i--) {
		const s = doc.shapes[i];
		if (s.kind === 'line' || s.kind === 'arrow') {
			if (segmentDistance(x, y, s.x, s.y, s.x + s.width, s.y + s.height) <= slop + 2) return s;
		} else if (s.fill) {
			if (rectContains(shapeRect(s), x, y)) return s;
		} else {
			// Outline-only: near the border, not the hollow middle.
			const r = shapeRect(s);
			const inOuter = rectContains({ x: r.x - slop, y: r.y - slop, width: r.width + 2 * slop, height: r.height + 2 * slop }, x, y);
			const inInner = rectContains({ x: r.x + slop, y: r.y + slop, width: r.width - 2 * slop, height: r.height - 2 * slop }, x, y);
			if (inOuter && !(r.width > 2 * slop && r.height > 2 * slop && inInner)) return s;
		}
	}
	return null;
}

/** Bounds of everything (for zoom-to-fit); null when empty. */
export function canvasBounds(doc) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	const grow = (r) => {
		minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
		maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
	};
	for (const n of doc.nodes) grow(nodeRect(n));
	for (const s of doc.shapes) grow(shapeRect(s));
	for (const s of doc.strokes) {
		for (let i = 0; i < s.points.length; i += 2) {
			grow({ x: s.points[i], y: s.points[i + 1], width: 0, height: 0 });
		}
	}
	if (minX === Infinity) return null;
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---- edges -----------------------------------------------------------------

export function anchorPoint(node, side) {
	const { x, y, width, height } = node;
	switch (side) {
		case 'top': return { x: x + width / 2, y };
		case 'bottom': return { x: x + width / 2, y: y + height };
		case 'left': return { x, y: y + height / 2 };
		default: return { x: x + width, y: y + height / 2 };
	}
}

export const SIDE_DIR = {
	top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 },
	left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

/** Where a side's connection dot sits: pushed out from the border so it
 *  never collides with the midpoint resize handles. `offset` is world px. */
export function anchorHandlePoint(node, side, offset) {
	const a = anchorPoint(node, side);
	return { x: a.x + SIDE_DIR[side].x * offset, y: a.y + SIDE_DIR[side].y * offset };
}

/**
 * Cubic bezier between two node sides. Returns { d, from, to, mid, angle }
 * where `d` is the SVG path, `angle` the arrowhead direction (radians) at
 * `to`, and `mid` the label midpoint.
 */
export function edgeGeometry(fromNode, fromSide, toNode, toSide) {
	const from = anchorPoint(fromNode, fromSide);
	const to = anchorPoint(toNode, toSide);
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	const bend = Math.max(40, Math.min(180, dist / 2));
	const c1 = { x: from.x + SIDE_DIR[fromSide].x * bend, y: from.y + SIDE_DIR[fromSide].y * bend };
	const c2 = { x: to.x + SIDE_DIR[toSide].x * bend, y: to.y + SIDE_DIR[toSide].y * bend };
	const d = `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
	const angle = Math.atan2(to.y - c2.y, to.x - c2.x);
	const mid = bezierPoint(from, c1, c2, to, 0.5);
	return { d, from, to, mid, angle };
}

function bezierPoint(p0, p1, p2, p3, t) {
	const u = 1 - t;
	return {
		x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
		y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
	};
}

/** The best sides to connect two nodes (used while dragging a new edge). */
export function bestSides(fromNode, toNode) {
	const dx = (toNode.x + toNode.width / 2) - (fromNode.x + fromNode.width / 2);
	const dy = (toNode.y + toNode.height / 2) - (fromNode.y + fromNode.height / 2);
	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0 ? { fromSide: 'right', toSide: 'left' } : { fromSide: 'left', toSide: 'right' };
	}
	return dy > 0 ? { fromSide: 'bottom', toSide: 'top' } : { fromSide: 'top', toSide: 'bottom' };
}

/** Distance from a point on an edge's bezier (sampled) — for edge hit tests. */
export function edgeDistance(fromNode, fromSide, toNode, toSide, x, y) {
	const { from, to } = { from: anchorPoint(fromNode, fromSide), to: anchorPoint(toNode, toSide) };
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	const bend = Math.max(40, Math.min(180, dist / 2));
	const c1 = { x: from.x + SIDE_DIR[fromSide].x * bend, y: from.y + SIDE_DIR[fromSide].y * bend };
	const c2 = { x: to.x + SIDE_DIR[toSide].x * bend, y: to.y + SIDE_DIR[toSide].y * bend };
	let best = Infinity;
	let prev = from;
	for (let i = 1; i <= 24; i++) {
		const p = bezierPoint(from, c1, c2, to, i / 24);
		best = Math.min(best, segmentDistance(x, y, prev.x, prev.y, p.x, p.y));
		prev = p;
	}
	return best;
}

// ---- strokes ---------------------------------------------------------------

export function segmentDistance(px, py, x1, y1, x2, y2) {
	const dx = x2 - x1, dy = y2 - y1;
	const lengthSq = dx * dx + dy * dy;
	let t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function strokeHit(stroke, x, y, threshold) {
	const pts = stroke.points;
	const pad = threshold + stroke.width / 2;
	for (let i = 0; i + 3 < pts.length; i += 2) {
		if (segmentDistance(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= pad) return true;
	}
	return false;
}

/** SVG path for a stroke's polyline. */
export function strokePath(stroke) {
	const pts = stroke.points;
	if (pts.length < 4) return '';
	let d = `M ${pts[0]} ${pts[1]}`;
	// Midpoint quadratics smooth the polyline without changing its footprint.
	for (let i = 2; i + 3 < pts.length; i += 2) {
		const mx = (pts[i] + pts[i + 2]) / 2;
		const my = (pts[i + 1] + pts[i + 3]) / 2;
		d += ` Q ${pts[i]} ${pts[i + 1]}, ${mx} ${my}`;
	}
	d += ` L ${pts[pts.length - 2]} ${pts[pts.length - 1]}`;
	return d;
}

// ---- resize handles --------------------------------------------------------

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function handlePositions(rect) {
	const { x, y, width: w, height: h } = rect;
	return {
		nw: { x, y }, n: { x: x + w / 2, y }, ne: { x: x + w, y },
		e: { x: x + w, y: y + h / 2 }, se: { x: x + w, y: y + h },
		s: { x: x + w / 2, y: y + h }, sw: { x, y: y + h }, w: { x, y: y + h / 2 },
	};
}

/** Apply a handle drag to a rect, enforcing minimums. Returns a new rect. */
export function resizeRect(rect, handle, dx, dy, minW = NODE_MIN_W, minH = NODE_MIN_H) {
	let { x, y, width, height } = rect;
	if (handle.includes('e')) width = Math.max(minW, rect.width + dx);
	if (handle.includes('s')) height = Math.max(minH, rect.height + dy);
	if (handle.includes('w')) {
		width = Math.max(minW, rect.width - dx);
		x = rect.x + rect.width - width;
	}
	if (handle.includes('n')) {
		height = Math.max(minH, rect.height - dy);
		y = rect.y + rect.height - height;
	}
	return { x, y, width, height };
}
