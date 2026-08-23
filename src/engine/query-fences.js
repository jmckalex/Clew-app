// Vault queries for the render worker — Clew's answer to Obsidian's
// Dataview and Tasks plugins, as two fences:
//
//   ```query                      ```tasks
//   table: status, due            not done
//   from: Projects                from: Projects
//   tag: #active                  tag: #work
//   where: status != done         group: note
//   sort: due asc                 limit: 50
//   limit: 20
//   ```
//
// ```query lists (or tabulates) NOTES by folder, tag, and frontmatter
// fields; ```tasks aggregates checkbox items across the vault, and the
// rendered checkboxes write back to their source notes when clicked
// (the preview client routes them by data-task-path/-line).
//
// Everything scans the live vault at render time (this file runs inside
// the one-shot worker, which has fs); results refresh whenever the note
// holding the fence re-renders. Pure helpers are exported for tests.
import fs from 'node:fs';
import path from 'node:path';

const NOTE_FILE = /\.(md|jmd)$/i;
const IGNORED = new Set(['.obsidian', '.clew', '.git', 'node_modules', '.trash']);

const escapeHtml = (s) => String(s)
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- frontmatter (a tiny reader: scalars, inline arrays, tag blocks) -------

/** Flat frontmatter object: strings, numbers, booleans, arrays. */
export function readFrontmatter(text) {
	const fm = /^---\n([\s\S]*?)\n---/.exec(text);
	if (!fm) return {};
	const out = {};
	const lines = fm[1].split('\n');
	for (let i = 0; i < lines.length; i++) {
		const m = /^([\w][\w -]*?):\s*(.*?)\s*$/.exec(lines[i]);
		if (!m) continue;
		const key = m[1];
		let value = m[2];
		if (value === '') {
			// Block list?
			const items = [];
			while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
				items.push(clean(lines[++i].replace(/^\s*-\s+/, '')));
			}
			out[key] = items.length ? items : '';
			continue;
		}
		const inline = /^\[(.*)\]$/.exec(value);
		if (inline) {
			out[key] = inline[1].split(',').map((v) => clean(v)).filter((v) => v !== '');
			continue;
		}
		out[key] = clean(value);
	}
	return out;
}

function clean(v) {
	const s = String(v).trim().replace(/^["']|["']$/g, '');
	if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
	if (s === 'true') return true;
	if (s === 'false') return false;
	return s;
}

// ---- vault scan ------------------------------------------------------------

function scanNotes() {
	const root = process.env.CLEW_VAULT_ROOT;
	if (!root) return [];
	const notes = [];
	const walk = (dir, rel) => {
		let entries;
		try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
		for (const entry of entries) {
			if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			if (entry.isDirectory()) walk(path.join(dir, entry.name), childRel);
			else if (NOTE_FILE.test(entry.name)) {
				try {
					const abs = path.join(dir, entry.name);
					const text = fs.readFileSync(abs, 'utf8');
					notes.push({
						path: childRel,
						name: entry.name.replace(NOTE_FILE, ''),
						modified: fs.statSync(abs).mtimeMs,
						text,
						fm: readFrontmatter(text),
					});
				} catch { /* unreadable — skipped */ }
			}
		}
	};
	walk(root, '');
	return notes;
}

const noteTags = (note) => {
	const tags = note.fm.tags;
	const list = Array.isArray(tags) ? tags : tags != null && tags !== '' ? [tags] : [];
	return list.map((t) => String(t).replace(/^#/, '').toLowerCase());
};

// ---- ```query --------------------------------------------------------------

export function parseQueryConfig(body) {
	const config = { mode: 'list', columns: [], where: [], from: null, tag: null, sort: null, limit: null };
	for (const line of body.split('\n')) {
		const m = /^\s*(\w+)\s*:\s*(.*?)\s*$/.exec(line);
		if (!m) continue;
		const key = m[1].toLowerCase();
		const value = m[2];
		if (key === 'table') {
			config.mode = 'table';
			config.columns = value.split(',').map((c) => c.trim()).filter(Boolean);
		} else if (key === 'list') config.mode = 'list';
		else if (key === 'from') config.from = value.replace(/\/$/, '');
		else if (key === 'tag') config.tag = value.replace(/^#/, '').toLowerCase();
		else if (key === 'where') {
			const w = /^([\w -]+?)\s*(=|!=|>=|<=|>|<|contains)\s*(.*)$/.exec(value);
			if (w) config.where.push({ field: w[1].trim(), op: w[2], value: clean(w[3]) });
			else config.where.push({ field: value.trim(), op: 'exists' });
		} else if (key === 'sort') {
			const s = /^([\w -]+?)(?:\s+(asc|desc))?$/.exec(value);
			if (s) config.sort = { field: s[1].trim(), dir: s[2] ?? 'asc' };
		} else if (key === 'limit') config.limit = Number(value) || null;
	}
	return config;
}

const fieldOf = (note, field) => {
	if (field === 'name') return note.name;
	if (field === 'path') return note.path;
	if (field === 'modified') return new Date(note.modified).toISOString().slice(0, 10);
	return note.fm[field];
};

/** Filter + sort + limit notes per a parsed query. Pure. */
export function runQuery(config, notes) {
	let rows = notes.filter((note) => {
		if (config.from && !note.path.startsWith(config.from + '/') && path.dirname(note.path) !== config.from) return false;
		if (config.tag && !noteTags(note).includes(config.tag)) return false;
		for (const w of config.where) {
			const v = fieldOf(note, w.field);
			if (w.op === 'exists') { if (v === undefined || v === '') return false; continue; }
			if (v === undefined) return false;
			const a = typeof v === 'number' && typeof w.value === 'number' ? v : String(v).toLowerCase();
			const b = typeof v === 'number' && typeof w.value === 'number' ? w.value : String(w.value).toLowerCase();
			switch (w.op) {
				case '=': if (a !== b) return false; break;
				case '!=': if (a === b) return false; break;
				case '>': if (!(a > b)) return false; break;
				case '<': if (!(a < b)) return false; break;
				case '>=': if (!(a >= b)) return false; break;
				case '<=': if (!(a <= b)) return false; break;
				case 'contains': {
					const haystack = Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : String(v).toLowerCase();
					if (!haystack.includes(String(w.value).toLowerCase())) return false;
					break;
				}
			}
		}
		return true;
	});
	if (config.sort) {
		const { field, dir } = config.sort;
		const sign = dir === 'desc' ? -1 : 1;
		rows = rows.slice().sort((x, y) => {
			const a = fieldOf(x, field);
			const b = fieldOf(y, field);
			if (a === undefined && b === undefined) return 0;
			if (a === undefined) return 1;
			if (b === undefined) return -1;
			if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
			return sign * String(a).localeCompare(String(b));
		});
	} else {
		rows = rows.slice().sort((x, y) => x.name.localeCompare(y.name));
	}
	if (config.limit) rows = rows.slice(0, config.limit);
	return rows;
}

const noteLink = (note) =>
	`<a class="internal-link" href="#" data-href="${escapeHtml(note.path.replace(NOTE_FILE, ''))}">${escapeHtml(note.name)}</a>`;

export const queryFence = {
	name: 'queryFence',
	level: 'block',
	start(src) { return src.match(/^```query/m)?.index; },
	tokenizer(src) {
		const match = /^```query[ \t]*\n([\s\S]*?)\n```[ \t]*(?:\n+|$)/.exec(src);
		if (!match) return;
		return { type: 'queryFence', raw: match[0], text: match[1] };
	},
	renderer(token) {
		if (global.isLatex) return '';
		const config = parseQueryConfig(token.text);
		const rows = runQuery(config, scanNotes());
		if (rows.length === 0) return `<div class="clew-query is-empty">No notes match this query.</div>\n`;
		if (config.mode === 'table') {
			const head = ['Note', ...config.columns].map((c) => `<th>${escapeHtml(c)}</th>`).join('');
			const body = rows.map((note) => {
				const cells = config.columns.map((c) => {
					const v = fieldOf(note, c);
					const shown = v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v);
					return `<td>${escapeHtml(shown)}</td>`;
				}).join('');
				return `<tr><td>${noteLink(note)}</td>${cells}</tr>`;
			}).join('\n');
			return `<table class="clew-query"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>\n`;
		}
		return `<ul class="clew-query">\n${rows.map((note) => `<li>${noteLink(note)}</li>`).join('\n')}\n</ul>\n`;
	},
};

// ---- ```tasks --------------------------------------------------------------

const TASK_RE = /^(\s*)[-*+] \[( |x|X)\] (.+)$/;

/** Checkbox items in a note's text (1-based lines; fenced code masked). */
export function extractTasks(text) {
	const tasks = [];
	let inFence = false;
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
		if (inFence) continue;
		const m = TASK_RE.exec(lines[i]);
		if (m) tasks.push({ line: i + 1, done: m[2] !== ' ', text: m[3].trim() });
	}
	return tasks;
}

export function parseTasksConfig(body) {
	const config = { status: 'todo', from: null, tag: null, group: 'note', limit: null };
	for (const line of body.split('\n')) {
		const bare = line.trim().toLowerCase();
		if (bare === 'not done' || bare === 'todo') config.status = 'todo';
		else if (bare === 'done') config.status = 'done';
		else if (bare === 'all') config.status = 'all';
		const m = /^\s*(\w+)\s*:\s*(.*?)\s*$/.exec(line);
		if (!m) continue;
		const key = m[1].toLowerCase();
		if (key === 'from') config.from = m[2].replace(/\/$/, '');
		else if (key === 'tag') config.tag = m[2].replace(/^#/, '').toLowerCase();
		else if (key === 'group') config.group = m[2].toLowerCase() === 'none' ? 'none' : 'note';
		else if (key === 'limit') config.limit = Number(m[2]) || null;
	}
	return config;
}

export const tasksFence = {
	name: 'tasksFence',
	level: 'block',
	start(src) { return src.match(/^```tasks/m)?.index; },
	tokenizer(src) {
		const match = /^```tasks[ \t]*\n([\s\S]*?)\n```[ \t]*(?:\n+|$)/.exec(src);
		if (!match) return;
		return { type: 'tasksFence', raw: match[0], text: match[1] };
	},
	renderer(token) {
		if (global.isLatex) return '';
		const config = parseTasksConfig(token.text);
		const groups = [];
		let total = 0;
		for (const note of runQuery({ from: config.from, tag: config.tag, where: [], sort: null, limit: null }, scanNotes())) {
			const tasks = extractTasks(note.text).filter((t) =>
				config.status === 'all' || (config.status === 'done') === t.done);
			if (tasks.length === 0) continue;
			groups.push({ note, tasks });
			total += tasks.length;
		}
		if (total === 0) return `<div class="clew-tasks is-empty">No matching tasks.</div>\n`;
		let remaining = config.limit ?? Infinity;
		const parts = ['<div class="clew-tasks">'];
		for (const { note, tasks } of groups) {
			if (remaining <= 0) break;
			const shown = tasks.slice(0, remaining);
			remaining -= shown.length;
			if (config.group !== 'none') parts.push(`<div class="clew-tasks-note">${noteLink(note)}</div>`);
			parts.push('<ul class="clew-tasks-list">');
			for (const task of shown) {
				// data-task-path/-line route the click back to the SOURCE note
				// (the preview client posts task-toggle with these).
				parts.push(`<li data-task-path="${escapeHtml(note.path)}" data-task-line="${task.line}">`
					+ `<input type="checkbox" disabled${task.done ? ' checked' : ''}> ${escapeHtml(task.text)}</li>`);
			}
			parts.push('</ul>');
		}
		parts.push('</div>');
		return parts.join('\n') + '\n';
	},
};

export default [queryFence, tasksFence];
