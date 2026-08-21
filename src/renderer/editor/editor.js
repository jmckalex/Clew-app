// Editor assembly: one function that builds a CodeMirror EditorView for a
// note. M1 uses stock lang-markdown; the jmarkdown dialect overlay and the
// wikilink/tag completion sources land in M3.
import { EditorState } from '@codemirror/state';
import {
	EditorView, keymap, drawSelection, dropCursor, highlightActiveLine,
} from '@codemirror/view';
import {
	defaultKeymap, history, historyKeymap, indentWithTab,
} from '@codemirror/commands';
import { indentOnInput, bracketMatching } from '@codemirror/language';
import {
	autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap,
} from '@codemirror/autocomplete';
import { search, searchKeymap } from '@codemirror/search';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { clewEditorTheme, clewHighlighting } from './theme.js';
import { wikilinkCompletions } from './complete/wikilinks.js';
import { tagCompletions } from './complete/tags.js';
import { wikilinkClick } from './wikilink-click.js';
import { jmdOverlay } from './jmd/overlay.js';
import { jmdFolding } from './jmd/folding.js';

/**
 * @param {object} opts
 * @param {string} opts.doc
 * @param {(update: import('@codemirror/view').ViewUpdate) => void} [opts.onUpdate]
 */
export function createNoteEditor({ doc = '', onUpdate }) {
	return new EditorView({
		state: makeNoteState(doc, onUpdate),
	});
}

export function makeNoteState(doc, onUpdate) {
	return EditorState.create({
		doc,
		extensions: [
			history(),
			drawSelection(),
			dropCursor(),
			highlightActiveLine(),
			indentOnInput(),
			bracketMatching(),
			closeBrackets(),
			markdown({
				base: markdownLanguage,
				// jmarkdown has no indented code blocks or setext headings; removing
				// them also stops the metadata header masquerading as a heading.
				extensions: [{ remove: ['IndentedCode', 'SetextHeading'] }],
			}),
			clewHighlighting,
			clewEditorTheme,
			jmdOverlay(),
			jmdFolding(),
			autocompletion({ override: [wikilinkCompletions, tagCompletions] }),
			wikilinkClick(),
			search({ top: true }),
			keymap.of([
				...closeBracketsKeymap,
				...markdownKeymap,
				...defaultKeymap,
				...historyKeymap,
				...searchKeymap,
				...completionKeymap,
				indentWithTab,
			]),
			EditorView.lineWrapping,
			EditorView.updateListener.of((update) => onUpdate?.(update)),
		],
	});
}
