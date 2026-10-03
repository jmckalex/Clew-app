// A vault for crossref-scenario.js: `node smoke/make-crossref-vault.mjs <dir>`.
// Crossrefs.md exercises every counter the engine keeps — numeric headings,
// two equations, the shared theorem counter (a theorem and a lemma), a
// figure — plus a plain (numberless) label, a label inside a footnote (the
// engine prints ?? for it — its footnote branch never matches), an unknown
// key and a colon twin — and, under numeric headings, a `{-}` heading and a
// titled mid-note @endnotes, which take no number (jmarkdown b212e82).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-crossref-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'Crossrefs.md'), `---
Headings: numeric
---
# Crossrefs

## Setup @label[sec-setup]

Setup prose with an aside[fn(early): an early note.].

@begin(equation){#eq-a}
a = b
@end(equation)

@begin(theorem)[Fundamental Triviality]{#thm-main}
Everything is itself.
@end(theorem)

@begin(lemma){#lem-one}
A lemma about nothing.
@end(lemma)

@endnotes(early){title="Early notes"}

## Interlude {-}

Between the sections: an unnumbered heading, and a titled endnotes list
above it — neither takes a number nor moves the ones after (jmarkdown
b212e82).

## Results

@begin(equation){#eq-b}
c = d
@end(equation)

@begin(figure)[A caption]{id=fig-1}
The figure's body.
@end(figure)

A loose @label[loose] paragraph.

References: @ref[eq-b], @cref[thm-main], @Cref[fig-1], @ref[sec-setup], @ref[loose], @ref[nowhere], :ref[eq-a], @cref[lem-one].

Last line.

A note[fn: See @label[fnl].] and @ref[fnl].
`);
