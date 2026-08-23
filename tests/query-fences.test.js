import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFrontmatter, readInlineFields, resolveDateExpr, parseQueryConfig, parseKanbanConfig, runQuery, parseTasksConfig, extractTasks } from '../src/engine/query-fences.js';

test('frontmatter reader: scalars, arrays, block lists', () => {
	const fm = readFrontmatter('---\nstatus: active\npriority: 2\ndone: false\ntags: [a, b]\nlist:\n  - x\n  - y\n---\nbody');
	assert.deepEqual(fm, { status: 'active', priority: 2, done: false, tags: ['a', 'b'], list: ['x', 'y'] });
	assert.deepEqual(readFrontmatter('no fm'), {});
});

const notes = [
	{ path: 'Projects/A.md', name: 'A', modified: 3, text: '', fm: { status: 'active', priority: 2, tags: ['work'] } },
	{ path: 'Projects/B.md', name: 'B', modified: 2, text: '', fm: { status: 'done', priority: 1 } },
	{ path: 'Ideas/C.md', name: 'C', modified: 1, text: '', fm: { status: 'active', tags: ['work', 'fun'] } },
];

test('query: from, tag, where, sort, limit', () => {
	const q = (body) => runQuery(parseQueryConfig(body), notes).map((n) => n.name);
	assert.deepEqual(q('from: Projects'), ['A', 'B']);
	assert.deepEqual(q('tag: #work'), ['A', 'C']);
	assert.deepEqual(q('where: status = active'), ['A', 'C']);
	assert.deepEqual(q('where: status != done\nwhere: priority'), ['A']);
	assert.deepEqual(q('where: priority >= 1\nsort: priority desc'), ['A', 'B']);
	assert.deepEqual(q('where: tags contains fun'), ['C']);
	assert.deepEqual(q('sort: modified desc\nlimit: 2'), ['A', 'B']);
	assert.deepEqual(q('table: status, priority').length ? parseQueryConfig('table: status, priority').columns : null, ['status', 'priority']);
});

test('tasks: extraction masks fences, config parses', () => {
	const text = '# T\n- [ ] open one\n- [x] closed\n```\n- [ ] not a task (fenced)\n```\n  - [ ] indented open\nplain line';
	const tasks = extractTasks(text);
	assert.deepEqual(tasks, [
		{ line: 2, done: false, text: 'open one' },
		{ line: 3, done: true, text: 'closed' },
		{ line: 7, done: false, text: 'indented open' },
	]);
	assert.equal(parseTasksConfig('done\nfrom: X/').status, 'done');
	assert.equal(parseTasksConfig('all\ngroup: none').group, 'none');
	assert.equal(parseTasksConfig('').status, 'todo');
});

// ---- the writable-database layer ----

test('inline fields: own-line and bracketed, with line numbers', () => {
	const text = '# T\nRating:: 8\nSome prose with [chapter:: 5] inline.\n```\nMasked:: 1\n```\n';
	const { fields, lines } = readInlineFields(text);
	assert.deepEqual(fields, { Rating: 8, chapter: 5 });
	assert.deepEqual(lines, { Rating: 2, chapter: 3 });
});

test('date expressions resolve', () => {
	const now = new Date(2026, 7, 22); // 22 Aug 2026
	assert.equal(resolveDateExpr('today', now), '2026-08-22');
	assert.equal(resolveDateExpr('today + 7d', now), '2026-08-29');
	assert.equal(resolveDateExpr('today - 2w', now), '2026-08-08');
	assert.equal(resolveDateExpr('today + 1m', now), '2026-09-22');
	assert.equal(resolveDateExpr('2026-01-01', now), null);
});

test('where clauses with date expressions filter ISO dates', () => {
	const config = parseQueryConfig('where: due < today + 31d\nwhere: due');
	assert.equal(config.where[0].op, '<');
	assert.match(String(config.where[0].value), /^\d{4}-\d{2}-\d{2}$/);
});

test('group clause parses and kanban config parses', () => {
	assert.equal(parseQueryConfig('group: status').group, 'status');
	const k = parseKanbanConfig('group: status\nfrom: Papers/\ncolumns: a, b\nshow: due, venue');
	assert.deepEqual(k, { group: 'status', from: 'Papers', tag: null, columns: ['a', 'b'], show: ['due', 'venue'] });
});
