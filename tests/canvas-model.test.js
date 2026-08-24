// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	createCanvas, parseCanvas, serializeCanvas, nodeAt, shapeAt, canvasBounds,
	anchorPoint, edgeGeometry, bestSides, strokeHit, strokePath, resizeRect,
	rectsIntersect, segmentDistance, repickEdgeSides, reorder,
	strokeAt, strokeBounds, translateStroke, groupOf, groupBounds,
	expandSelection, groupSelection, ungroupSelection, pruneGroups,
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

// ---- ink strokes: selection + movement -------------------------------------

const stroke = (over = {}) => ({ id: 'k1', color: 'ink', width: 4, points: [0, 0, 10, 10, 20, 0], ...over });

test('strokeAt finds the topmost stroke under a point, or null', () => {
	const doc = createCanvas();
	doc.strokes.push(stroke({ id: 'under' }), stroke({ id: 'over' }));
	assert.equal(strokeAt(doc, 10, 10, 4).id, 'over'); // later paints on top
	assert.equal(strokeAt(doc, 500, 500, 4), null);
});

test('strokeBounds encloses the ink, grown by half the nib width', () => {
	const r = strokeBounds(stroke());
	assert.deepEqual(r, { x: -2, y: -2, width: 24, height: 14 });
	// A stroke with no points must still yield a usable rect, not NaN.
	assert.deepEqual(strokeBounds({ points: [], width: 2 }), { x: 0, y: 0, width: 0, height: 0 });
});

test('translateStroke moves every point from the snapshot, not cumulatively', () => {
	const s = stroke();
	const from = s.points.slice();
	translateStroke(s, from, 5, -5);
	assert.deepEqual(s.points, [5, -5, 15, 5, 25, -5]);
	// Re-applying from the same snapshot replaces rather than accumulates,
	// which is what keeps a long drag free of drift.
	translateStroke(s, from, 10, 0);
	assert.deepEqual(s.points, [10, 0, 20, 10, 30, 0]);
});

// ---- groups ----------------------------------------------------------------

function grouped() {
	const doc = createCanvas();
	doc.nodes.push(node({ id: 'n1' }));
	doc.shapes.push({ id: 'sh1', kind: 'rect', x: 300, y: 0, width: 50, height: 40, color: 'ink' });
	doc.strokes.push(stroke({ id: 'k1' }));
	doc.groups.push({ id: 'g1', members: [
		{ kind: 'node', id: 'n1' }, { kind: 'shape', id: 'sh1' }, { kind: 'stroke', id: 'k1' },
	] });
	return doc;
}

test('groups round-trip under the clew key and stay out of spec fields', () => {
	const doc = grouped();
	const json = JSON.parse(serializeCanvas(doc));
	assert.ok(Array.isArray(json.clew.groups));
	assert.ok(!('groups' in json)); // never a top-level/spec field
	assert.deepEqual(parseCanvas(serializeCanvas(doc)), doc);
});

test('parse enforces the group invariants', () => {
	// Dead members dropped; an object joins only its first group; a group of
	// fewer than two dissolves.
	const doc = parseCanvas(JSON.stringify({
		nodes: [node({ id: 'n1' }), node({ id: 'n2', x: 500 })],
		clew: {
			groups: [
				{ id: 'g1', members: [{ kind: 'node', id: 'n1' }, { kind: 'node', id: 'ghost' }, { kind: 'node', id: 'n2' }] },
				{ id: 'g2', members: [{ kind: 'node', id: 'n1' }, { kind: 'node', id: 'n2' }] },
				{ id: 'g3', members: [{ kind: 'bogus', id: 'n1' }] },
			],
		},
	}));
	assert.equal(doc.groups.length, 1);
	assert.equal(doc.groups[0].id, 'g1');
	assert.deepEqual(doc.groups[0].members, [{ kind: 'node', id: 'n1' }, { kind: 'node', id: 'n2' }]);
});

test('a group whose members are all claimed elsewhere releases its claims', () => {
	// g1 is left with one live member, so it dissolves — and n2 must then be
	// free for g2 rather than stranded by g1's abandoned claim.
	const doc = parseCanvas(JSON.stringify({
		nodes: [node({ id: 'n1' }), node({ id: 'n2', x: 500 }), node({ id: 'n3', x: 900 })],
		clew: {
			groups: [
				{ id: 'g1', members: [{ kind: 'node', id: 'n2' }, { kind: 'node', id: 'ghost' }] },
				{ id: 'g2', members: [{ kind: 'node', id: 'n2' }, { kind: 'node', id: 'n3' }] },
			],
		},
	}));
	assert.equal(doc.groups.length, 1);
	assert.equal(doc.groups[0].id, 'g2');
	assert.equal(groupOf(doc, 'node', 'n2').id, 'g2');
});

test('expandSelection pulls in every group-mate across all three kinds', () => {
	const doc = grouped();
	const out = expandSelection(doc, { nodes: new Set(['n1']), shapes: new Set(), strokes: new Set() });
	assert.deepEqual([...out.nodes], ['n1']);
	assert.deepEqual([...out.shapes], ['sh1']);
	assert.deepEqual([...out.strokes], ['k1']);
	// Touching the ink pulls the node back the other way.
	const back = expandSelection(doc, { nodes: new Set(), shapes: new Set(), strokes: new Set(['k1']) });
	assert.deepEqual([...back.nodes], ['n1']);
});

test('groupBounds unions members, including ink', () => {
	const b = groupBounds(grouped(), grouped().groups[0]);
	assert.equal(b.x, -2);           // stroke's padded left edge
	assert.equal(b.y, -2);
	assert.equal(b.x + b.width, 350); // shape's right edge
});

test('groupSelection absorbs touched groups and stays flat', () => {
	const doc = grouped();
	doc.nodes.push(node({ id: 'n2', x: 800 }));
	// Selecting one member of g1 plus a loose node merges into ONE group.
	const g = groupSelection(doc, { nodes: new Set(['n1', 'n2']), shapes: new Set(), strokes: new Set() });
	assert.equal(doc.groups.length, 1);
	assert.equal(doc.groups[0], g);
	assert.equal(g.members.length, 4); // n1, n2, sh1, k1
	assert.equal(groupOf(doc, 'node', 'n2').id, g.id);
});

test('groupSelection refuses fewer than two members', () => {
	const doc = createCanvas();
	doc.nodes.push(node({ id: 'n1' }));
	assert.equal(groupSelection(doc, { nodes: new Set(['n1']), shapes: new Set(), strokes: new Set() }), null);
	assert.equal(doc.groups.length, 0);
});

test('ungroupSelection dissolves only the groups it touches', () => {
	const doc = grouped();
	doc.nodes.push(node({ id: 'n2', x: 800 }), node({ id: 'n3', x: 1200 }));
	doc.groups.push({ id: 'g2', members: [{ kind: 'node', id: 'n2' }, { kind: 'node', id: 'n3' }] });
	assert.equal(ungroupSelection(doc, { nodes: new Set(['n2']), shapes: new Set(), strokes: new Set() }), true);
	assert.deepEqual(doc.groups.map((g) => g.id), ['g1']);
	assert.equal(ungroupSelection(doc, { nodes: new Set(), shapes: new Set(), strokes: new Set() }), false);
});

test('pruneGroups drops dead members and dissolves groups below two', () => {
	const doc = grouped();
	doc.strokes = [];                       // erased
	doc.shapes = [];                        // deleted
	pruneGroups(doc);
	assert.equal(doc.groups.length, 0);     // only n1 left → not a group
});
