import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFrontmatter, parseQueryConfig, runQuery, parseTasksConfig, extractTasks } from '../src/engine/query-fences.js';

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
