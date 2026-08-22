// Shared SVG builders for canvas shapes — used by the editable canvas view
// and by read-only canvas embeds in note previews (preview-client). Colors
// are emitted as var(--clew-canvas-*) references; the surrounding document
// (app theme or preview.css) supplies the values.
import { seededRand, roughLine, roughRect, roughDiamond, roughEllipse } from './rough.js';
import * as model from './canvas-model.js';

export function inkColor(color) {
	return color === 'ink' ? 'var(--clew-canvas-ink)' : `var(--clew-canvas-${color})`;
}

export function edgeColor(color) {
	return color ? inkColor(color) : 'var(--clew-canvas-edge)';
}

export function escapeXml(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function shapeSvg(shape, selected, temp = false) {
	const color = inkColor(shape.color);
	const cls = `canvas-shape${selected ? ' is-selected' : ''}${temp ? ' is-temp' : ''}`;
	const sketchy = shape.style !== 'clean';
	const rand = seededRand(shape.id);
	const fillColor = `color-mix(in srgb, ${color} 22%, transparent)`;
	const r = model.shapeRect(shape);
	const label = shape.label
		? `<text class="canvas-shape-label" x="${r.x + r.width / 2}" y="${r.y + r.height / 2}" text-anchor="middle" dominant-baseline="middle">${escapeXml(shape.label)}</text>`
		: '';
	const boxy = !['line', 'arrow'].includes(shape.kind);

	if (boxy) {
		// Filled shapes paint a clean translucent underlay; the visible
		// outline is either clean geometry or the hand-drawn rough path.
		const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
		const underlay = !shape.fill ? ''
			: shape.kind === 'rect' ? `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="6" style="fill:${fillColor};stroke:none"/>`
			: shape.kind === 'ellipse' ? `<ellipse cx="${cx}" cy="${cy}" rx="${r.width / 2}" ry="${r.height / 2}" style="fill:${fillColor};stroke:none"/>`
			: `<polygon points="${cx},${r.y} ${r.x + r.width},${cy} ${cx},${r.y + r.height} ${r.x},${cy}" style="fill:${fillColor};stroke:none"/>`;
		let outline;
		if (sketchy) {
			const d = shape.kind === 'rect' ? roughRect(r.x, r.y, r.width, r.height, rand)
				: shape.kind === 'ellipse' ? roughEllipse(cx, cy, r.width / 2, r.height / 2, rand)
				: roughDiamond(r.x, r.y, r.width, r.height, rand);
			outline = `<path d="${d}" style="stroke:${color};fill:none"/>`;
		} else {
			outline = shape.kind === 'rect' ? `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="8" style="stroke:${color};fill:none"/>`
				: shape.kind === 'ellipse' ? `<ellipse cx="${cx}" cy="${cy}" rx="${r.width / 2}" ry="${r.height / 2}" style="stroke:${color};fill:none"/>`
				: `<polygon points="${cx},${r.y} ${r.x + r.width},${cy} ${cx},${r.y + r.height} ${r.x},${cy}" style="stroke:${color};fill:none"/>`;
		}
		return `<g class="${cls}" data-id="${shape.id}">${underlay}${outline}${label}</g>`;
	}

	// line / arrow: endpoints are (x,y) → (x+width, y+height).
	const x2 = shape.x + shape.width, y2 = shape.y + shape.height;
	const angle = Math.atan2(y2 - shape.y, x2 - shape.x) * 180 / Math.PI;
	const shaft = sketchy
		? `<path d="${roughLine(shape.x, shape.y, x2, y2, rand)}" style="stroke:${color};fill:none"/>`
		: `<line x1="${shape.x}" y1="${shape.y}" x2="${x2}" y2="${y2}" style="stroke:${color}"/>`;
	const head = shape.kind === 'arrow'
		? `<path style="fill:${color}" transform="translate(${x2},${y2}) rotate(${angle})" d="M 2 0 L -11 6 L -11 -6 Z"/>`
		: '';
	const labelMid = shape.label
		? `<text class="canvas-shape-label" x="${(shape.x + x2) / 2}" y="${(shape.y + y2) / 2 - 8}" text-anchor="middle">${escapeXml(shape.label)}</text>`
		: '';
	return `<g class="${cls}" data-id="${shape.id}">${shaft}${head}${labelMid}</g>`;
}

/** One edge (bezier + arrowhead + optional label) as an SVG fragment. */
export function edgeSvg(edge, fromNode, toNode, selected = false) {
	const geo = model.edgeGeometry(fromNode, edge.fromSide, toNode, edge.toSide);
	const colorAttr = edgeColor(edge.color);
	return `<g class="canvas-edge${selected ? ' is-selected' : ''}" data-id="${edge.id}">`
		+ `<path class="canvas-edge-line" d="${geo.d}" style="stroke:${colorAttr}"/>`
		+ `<path class="canvas-edge-head" style="fill:${colorAttr}" transform="translate(${geo.to.x},${geo.to.y}) rotate(${geo.angle * 180 / Math.PI})" d="M 2 0 L -10 5.5 L -10 -5.5 Z"/>`
		+ (edge.label ? `<text class="canvas-edge-label" x="${geo.mid.x}" y="${geo.mid.y - 6}" text-anchor="middle">${escapeXml(edge.label)}</text>` : '')
		+ `</g>`;
}
