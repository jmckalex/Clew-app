// A block widget inside one or more environments (live/env-rules.js): the
// widget's own DOM inside a box carrying the environments' rules and indent,
// so the rules run through the block and the block stands inside its frame.
// Everything else is the inner widget's — equality, height, events, updates
// (a table patches its cells in place, its cell editor kept: CodeMirror asks
// a wrapper to update only another wrapper, and this hands the inner DOM on
// only to a widget of the inner's own class).
import { WidgetType } from '@codemirror/view';

export class FramedBlockWidget extends WidgetType {
	/** @param {WidgetType} inner  @param {string} style - env-rules.js#envRuleStyle */
	constructor(inner, style) {
		super();
		this.inner = inner;
		this.style = style;
	}

	eq(other) {
		return other instanceof FramedBlockWidget && other.style === this.style
			&& other.inner.constructor === this.inner.constructor && this.inner.eq(other.inner);
	}

	toDOM(view) {
		const box = document.createElement('div');
		box.className = 'le-env-block';
		box.style.cssText = this.style;
		box.__leInner = this.inner.constructor;
		box.append(this.inner.toDOM(view));
		return box;
	}

	updateDOM(dom, view) {
		if (dom.__leInner !== this.inner.constructor || !dom.firstChild) return false;
		if (!this.inner.updateDOM(dom.firstChild, view)) return false;
		dom.style.cssText = this.style;
		return true;
	}

	get estimatedHeight() { return this.inner.estimatedHeight; }
	get lineBreaks() { return this.inner.lineBreaks; }
	get isHidden() { return this.inner.isHidden; }
	ignoreEvent(event) { return this.inner.ignoreEvent(event); }
	coordsAt(dom, pos, side) { return dom.firstChild ? this.inner.coordsAt(dom.firstChild, pos, side) : null; }
	destroy(dom) { if (dom.firstChild) this.inner.destroy(dom.firstChild); }
}
