import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	createCanvas, parseCanvas, serializeCanvas, nodeAt, shapeAt, canvasBounds,
	anchorPoint, edgeGeometry, bestSides, strokeHit, strokePath, resizeRect,
	rectsIntersect, segmentDistance, repickEdgeSides, reorder,
} from '../src/renderer/canvas/canvas-model.js';

const node = (over = {}) => ({
	id: 'n1', type: 'text', text: 'hi', x: 0, y: 0, width: 200, height: 100, ...over,
});

test('parse round-trips a JSON Canvas doc with the clew extension', () => {
	const doc = createCanvas();
	doc.nodes.push(node(), { id: 'n2', type: 'file', file: 'A.md', x: 400, y: 0, width: 200, height: 100 });
	doc.edges.push({ id: 'e1', fromNode: 'n1', fromSide: 'right', toNode: 'n2', toSide: 'left' });
	doc.strokes.push({ id: 's1', color: 'ink', width: 3, points: [0, 0, 10, 10, 20, 5] });
	doc.shapes.push({ id: 'sh1', kind: 'ellipse', x: 5, y: 5, width: 50, height: 40, color: '3' });
	const round = parseCanvas(serializeCanvas(doc));
	assert.deepEqual(round, doc);
});

test('parse drops edges to missing nodes and junk input', () => {
	const doc = parseCanvas(JSON.stringify({
		nodes: [node()],
		edges: [{ id: 'e1', fromNode: 'n1', toNode: 'ghost' }],
	}));
	assert.equal(doc.nodes.length, 1);
	assert.equal(doc.edges.length, 0);
	assert.deepEqual(parseCanvas('not json'), createCanvas());
});

test('serialized doc is Obsidian-shaped: nodes/edges at top level', () => {
	const doc = createCanvas();
	doc.nodes.push(node());
	const json = JSON.parse(serializeCanvas(doc));
	assert.ok(Array.isArray(json.nodes));
	assert.ok(!('clew' in json)); // no extension key when unused
});

test('nodeAt prefers regular nodes over groups, later wins', () => {
	const doc = createCanvas();
	doc.nodes.push(
		{ id: 'g', type: 'group', x: -50, y: -50, width: 500, height: 400 },
		node({ id: 'a' }),
		node({ id: 'b', x: 100 }),
	);
	assert.equal(nodeAt(doc, 150, 50).id, 'b'); // overlap → topmost
	assert.equal(nodeAt(doc, -20, -20).id, 'g'); // only the group is there
	assert.equal(nodeAt(doc, 900, 900), null);
});

test('shapeAt: filled hits interior, outline only near border, line by distance', () => {
	const doc = createCanvas();
	doc.shapes.push({ id: 'r', kind: 'rect', x: 0, y: 0, width: 100, height: 100, color: '1' });
	assert.equal(shapeAt(doc, 50, 50), null); // hollow middle
	assert.equal(shapeAt(doc, 2, 50).id, 'r'); // near border
	doc.shapes.push({ id: 'f', kind: 'rect', x: 0, y: 0, width: 100, height: 100, color: '1', fill: true });
	assert.equal(shapeAt(doc, 50, 50).id, 'f');
	doc.shapes = [{ id: 'l', kind: 'line', x: 0, y: 0, width: 100, height: 0, color: 'ink' }];
	assert.equal(shapeAt(doc, 50, 4).id, 'l');
	assert.equal(shapeAt(doc, 50, 30), null);
});

test('canvasBounds spans nodes, shapes, and strokes', () => {
	const doc = createCanvas();
	assert.equal(canvasBounds(doc), null);
	doc.nodes.push(node());
	doc.strokes.push({ id: 's', color: 'ink', width: 2, points: [-50, -10, 10, 10] });
	doc.shapes.push({ id: 'sh', kind: 'line', x: 300, y: 0, width: -20, height: 150, color: 'ink' });
	assert.deepEqual(canvasBounds(doc), { x: -50, y: -10, width: 350, height: 160 });
});

test('anchors and edge geometry', () => {
	const a = node();
	assert.deepEqual(anchorPoint(a, 'right'), { x: 200, y: 50 });
	assert.deepEqual(anchorPoint(a, 'top'), { x: 100, y: 0 });
	const b = node({ id: 'n2', x: 400 });
	const geo = edgeGeometry(a, 'right', b, 'left');
	assert.ok(geo.d.startsWith('M 200 50 C'));
	assert.deepEqual(geo.to, { x: 400, y: 50 });
	assert.ok(Math.abs(geo.angle) < 0.01); // pointing right
	assert.deepEqual(bestSides(a, b), { fromSide: 'right', toSide: 'left' });
	assert.deepEqual(bestSides(b, a), { fromSide: 'left', toSide: 'right' });
	assert.deepEqual(bestSides(a, node({ y: 500 })), { fromSide: 'bottom', toSide: 'top' });
});

test('stroke hit testing and path building', () => {
	const stroke = { id: 's', color: 'ink', width: 4, points: [0, 0, 100, 0] };
	assert.ok(strokeHit(stroke, 50, 5, 4));
	assert.ok(!strokeHit(stroke, 50, 20, 4));
	assert.ok(strokePath(stroke).startsWith('M 0 0'));
});

test('resizeRect enforces minimums and anchors the opposite side', () => {
	const r = { x: 100, y: 100, width: 200, height: 100 };
	assert.deepEqual(resizeRect(r, 'se', 50, 20), { x: 100, y: 100, width: 250, height: 120 });
	const nw = resizeRect(r, 'nw', 30, 40);
	assert.deepEqual(nw, { x: 130, y: 140, width: 170, height: 60 });
	const clamped = resizeRect(r, 'w', 500, 0);
	assert.equal(clamped.width, 60);
	assert.equal(clamped.x + clamped.width, 300); // right edge anchored
});

test('repickEdgeSides fixes inverted sides, keeps sensible ones', () => {
	const doc = createCanvas();
	doc.nodes.push(node({ id: 'a' }), node({ id: 'b', x: 400 }));
	doc.edges.push({ id: 'e', fromNode: 'a', fromSide: 'right', toNode: 'b', toSide: 'left' });

	// b moves to the left of a: right→left now faces away on both ends.
	doc.nodes[1].x = -400;
	assert.equal(repickEdgeSides(doc, new Set(['b'])), true);
	assert.equal(doc.edges[0].fromSide, 'left');
	assert.equal(doc.edges[0].toSide, 'right');

	// A deliberate-but-still-facing choice survives: top→top between
	// horizontal neighbors both face... actually use bottom→top stacked.
	doc.nodes[1].x = 0;
	doc.nodes[1].y = 400;
	doc.edges[0].fromSide = 'bottom';
	doc.edges[0].toSide = 'top';
	assert.equal(repickEdgeSides(doc, new Set(['b'])), false);

	// An untouched edge is never re-picked.
	doc.edges[0].fromSide = 'top';
	assert.equal(repickEdgeSides(doc, new Set(['zzz'])), false);
	assert.equal(doc.edges[0].fromSide, 'top');
});

test('misc geometry helpers', () => {
	assert.ok(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }));
	assert.ok(!rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 5, height: 5 }));
	assert.equal(segmentDistance(0, 5, 0, 0, 10, 0), 5);
});

// ---- style extras (Excalidraw/Advanced-Canvas parity) ----------------------

test('shape style extras round-trip', () => {
	const doc = createCanvas();
	doc.shapes.push(
		{ id: 'a'.repeat(16), kind: 'rect', x: 0, y: 0, width: 100, height: 80, color: '2', strokeStyle: 'dashed', rough: 2, opacity: 0.5, fill: true, fillStyle: 'hachure' },
		{ id: 'b'.repeat(16), kind: 'text', x: 10, y: 10, width: 200, height: 40, color: 'ink', text: 'Hello', font: 'mono', fontSize: 32 },
	);
	const round = parseCanvas(serializeCanvas(doc));
	const [rect, text] = round.shapes;
	assert.equal(rect.strokeStyle, 'dashed');
	assert.equal(rect.rough, 2);
	assert.equal(rect.opacity, 0.5);
	assert.equal(rect.fillStyle, 'hachure');
	assert.equal(text.kind, 'text');
	assert.equal(text.text, 'Hello');
	assert.equal(text.font, 'mono');
	assert.equal(text.fontSize, 32);
});

test('legacy clean style maps to rough 0', () => {
	const doc = parseCanvas(JSON.stringify({
		nodes: [], edges: [],
		clew: { shapes: [{ id: 'c'.repeat(16), kind: 'rect', x: 0, y: 0, width: 10, height: 10, style: 'clean' }] },
	}));
	assert.equal(doc.shapes[0].rough, 0);
});

test('node and edge styles round-trip, orphans pruned', () => {
	const doc = createCanvas();
	doc.nodes.push({ id: 'n1', type: 'text', x: 0, y: 0, width: 100, height: 60, text: '' });
	doc.nodes.push({ id: 'n2', type: 'text', x: 0, y: 0, width: 100, height: 60, text: '' });
	doc.edges.push({ id: 'e1', fromNode: 'n1', fromSide: 'right', toNode: 'n2', toSide: 'left', fromEnd: 'arrow', toEnd: 'none' });
	doc.nodeStyles.n1 = { shape: 'diamond', border: 'dashed', bg: 'transparent', opacity: 0.7 };
	doc.nodeStyles.ghost = { shape: 'pill' };
	doc.edgeStyles.e1 = { dash: 'dotted', path: 'square' };
	const round = parseCanvas(serializeCanvas(doc));
	assert.deepEqual(round.nodeStyles.n1, { shape: 'diamond', border: 'dashed', bg: 'transparent', opacity: 0.7 });
	assert.equal(round.nodeStyles.ghost, undefined);
	assert.deepEqual(round.edgeStyles.e1, { dash: 'dotted', path: 'square' });
	assert.equal(round.edges[0].fromEnd, 'arrow');
	assert.equal(round.edges[0].toEnd, 'none');
});

test('reorder moves items front/back/forward/backward', () => {
	const mk = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
	let list = mk();
	assert.equal(reorder(list, new Set(['b']), 'front'), true);
	assert.deepEqual(list.map((i) => i.id), ['a', 'c', 'd', 'b']);
	list = mk();
	reorder(list, new Set(['c']), 'back');
	assert.deepEqual(list.map((i) => i.id), ['c', 'a', 'b', 'd']);
	list = mk();
	reorder(list, new Set(['b']), 'forward');
	assert.deepEqual(list.map((i) => i.id), ['a', 'c', 'b', 'd']);
	list = mk();
	reorder(list, new Set(['b']), 'backward');
	assert.deepEqual(list.map((i) => i.id), ['b', 'a', 'c', 'd']);
	assert.equal(reorder(mk(), new Set(['a', 'b', 'c', 'd']), 'front'), false);
});

test('edge geometry supports straight and square paths', () => {
	const a = { x: 0, y: 0, width: 100, height: 60 };
	const b = { x: 300, y: 200, width: 100, height: 60 };
	const straight = edgeGeometry(a, 'right', b, 'left', 'straight');
	assert.match(straight.d, /^M 100 30 L 300 230$/);
	const square = edgeGeometry(a, 'right', b, 'left', 'square');
	assert.ok(square.d.includes('L'));
	assert.ok(Number.isFinite(square.angle));
	assert.ok(Number.isFinite(square.mid.x));
});
