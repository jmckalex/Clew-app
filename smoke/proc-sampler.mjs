#!/usr/bin/env node
// The memory an export's processes hold, sampled from outside every 200 ms
// until <root-pid> exits (smoke/figure-engine-compare.sh):
//
//   node smoke/proc-sampler.mjs <root-pid> <out.tsv>
//
// Each line: epoch ms, then the summed RSS in KB of three groups among
// <root-pid>'s DESCENDANTS (never another program's TeX on the machine):
//   worker  the export worker (engine/export-worker.mjs)
//   tools   everything below the worker (the installed lualatex, dvisvgm,
//           mpost, mptopdf a figure sends it to) and every TeX process main
//           runs for a PDF via LaTeX (latexmk and what it runs)
//   total   worker + tools
// RSS counts shared pages in each process, so the sum overstates what the
// machine gave up; it compares like with like.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const [rootArg, out] = process.argv.slice(2);
if (!rootArg || !out) {
	console.error('usage: node smoke/proc-sampler.mjs <root-pid> <out.tsv>');
	process.exit(2);
}
const root = Number(rootArg);
const TEX = /\b(latexmk|lualatex|luatex|luahbtex|pdflatex|xelatex|xetex|pdftex|dvisvgm|mpost|mptopdf|bibtex|biber|kpsewhich)\b/;
fs.writeFileSync(out, 'ms\tworker_kb\ttools_kb\ttotal_kb\n');

function sample() {
	let text;
	try { text = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { maxBuffer: 1 << 24 }).toString(); } catch { return false; }
	const procs = new Map();
	for (const line of text.split('\n')) {
		const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);
		if (m) procs.set(Number(m[1]), { ppid: Number(m[2]), rss: Number(m[3]), cmd: m[4] });
	}
	if (!procs.has(root)) return false;
	const children = new Map();
	for (const [pid, p] of procs) (children.get(p.ppid) ?? children.set(p.ppid, []).get(p.ppid)).push(pid);
	const below = (pid, acc = []) => { for (const c of children.get(pid) ?? []) { acc.push(c); below(c, acc); } return acc; };
	let worker = 0, tools = 0;
	const counted = new Set();
	for (const pid of below(root)) {
		const p = procs.get(pid);
		if (counted.has(pid)) continue;
		if (/export-worker\.mjs/.test(p.cmd)) {
			worker += p.rss; counted.add(pid);
			for (const d of below(pid)) if (!counted.has(d)) { tools += procs.get(d).rss; counted.add(d); }
		} else if (TEX.test(p.cmd)) {
			tools += p.rss; counted.add(pid);
			for (const d of below(pid)) if (!counted.has(d)) { tools += procs.get(d).rss; counted.add(d); }
		}
	}
	fs.appendFileSync(out, `${Date.now()}\t${worker}\t${tools}\t${worker + tools}\n`);
	return true;
}

while (sample()) await new Promise((r) => setTimeout(r, 200));
