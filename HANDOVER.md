# Handover — 2026-08-25 (Obsidian compatibility: callouts, block refs, Dataview, Bases)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

- Everything is on **`main`**, working tree clean, `npm test` → **322
  green**. Demo and study vaults clean. `../Clew-docs` clean.
- The last stretch of work was **Obsidian compatibility**, chosen by
  measurement rather than impression (§2): callouts, block references,
  Dataview, Bases and dataviewjs all landed. Before that, in the same
  session: the PDF viewer became EmbedPDF, Excalidraw was shimmed in, and
  table-editing ergonomics were added.
- `feat/excalidraw` is merged and can be deleted.

## 1. The compatibility work, and how to re-check it

Two tools, both read-only, both calibrated so that Clew's own vaults come
back nearly empty:

```
npm run vault-report     -- <vault>   # what Clew would not understand at all
npm run dataview-report  -- <vault>   # Dataview/Bases usage, and how much runs
```

`dataview-report` imports `src/engine` rather than describing it, so it
measures the shipping code: **if a query stops working, it notices.** Every
number below came out of it and can be reproduced.

Public vaults worth keeping around (re-clone; they are not in this repo):

```
git clone --depth 1 https://github.com/obsidianmd/obsidian-help.git
git clone --depth 1 https://github.com/s-blu/obsidian_dataview_example_vault.git
git clone --depth 1 https://github.com/kepano/kepano-obsidian.git
git clone --depth 1 https://github.com/bramses/bramses-highly-opinionated-vault-2023.git
```

## 2. What the measurement actually said

The first survey ranked **Dataview** as the plugin that mattered and warned
that a vault *about* Dataview was a biased sample. Adding three real vaults
changed the picture twice over:

| vault | notes | ```dataview | ```dataviewjs | .base |
|---|---:|---:|---:|---:|
| s-blu (a vault ABOUT Dataview) | 262 | 253 | 130 | 0 |
| bramses (real) | 67 | 14 | **0** | 0 |
| OB_Template (real) | 48 | 11 | **0** | 0 |
| kepano (Obsidian's CEO, real) | 103 | **0** | **0** | **30** |

1. **`dataviewjs` is documentation, not usage** — 130 occurrences in the
   vault that teaches it, zero across three real ones.
2. **kepano has abandoned Dataview for Bases**, embedding one in 50 of his
   103 notes — every one of which Clew rendered as "(not found)".

All three formats are implemented now. The DQL subset covers **100% of the
queries in the three real vaults** (25/25) and 43% of the teaching vault.
Of s-blu's 130 dataviewjs blocks: 34 render, 56 correctly render nothing
(their conditions are false), 40 report a named failure.

**The rule that matters: what is unsupported is refused BY NAME.** A query
that silently dropped its FLATTEN would show numbers that are wrong, which
is worse than showing nothing.

`dataviewjs` runs only behind a per-vault opt-in (`dataviewJs`, off by
default). Unlike a query, whose unsupported parts can be listed before it
runs, JavaScript cannot be checked in advance — so the promise made
instead is that failure is named.

## 3. Open items, in the order I would take them

- **FLATTEN** is the one refused construct with real demand — 92
  occurrences, but all in the teaching vault, so the demand may be
  illusory. Check a fifth vault before building it.
- **Bases map views** are refused; Clew has Leaflet, so this is possible
  rather than hard.
- **Kanban and Tasks plugins** have still never appeared in a sample. Do
  not rank them until a vault shows them.
- **The 139 MB CJK font download has never been run end to end.** URL
  construction and per-file logic are verified separately; nobody has
  watched 26 files land.
- **Excalidraw drawings with embedded images (`files{}`)** are untested.
- **The v0.8.0 tag is on the wrong commit** — retag or go to 0.9.0. `out/`
  holds stale artefacts.
- `../Clew-docs` has its own HANDOVER; the DNS blocker there is unchanged.

**Settled, do not reopen:** `%%comments%%` (jmarkdown has comment syntax
already — the owner's call); Obsidian's `\[\[` escape (in a
LaTeX-flavoured engine `\[` opens display math, so it renders as broken
MathJax — backticks are Clew's way); and licensing (Clew is
GPL-3.0-or-later, `npm run notices` regenerates THIRD-PARTY-NOTICES.md,
citeproc's CPAL attribution is met by it, and the Excalidraw PLUGIN is
AGPL so its source must never enter this tree).

## 4. Things that cost hours to find

CLAUDE.md carries the architectural half of what was learned. These are the
traps — each is a bug that only shows up somewhere other than where you are
looking.

- **Date-only strings must parse as LOCAL midnight.**
  `new Date("2024-03-01")` is UTC, so west of Greenwich every such date
  silently became the day before. Run `TZ=Pacific/Midway npm test` after
  touching anything date-shaped; the suite passes at UTC+14 and UTC-11.
- **`^` is superscript in this dialect**, so a block-id marker claims the
  whitespace *before* the caret. `x^2` ending a paragraph is an exponent,
  not an identifier.
- **A blank line inside a fence is not a block boundary.** Both the block
  slicer and the indexer walk fence-aware; a masked walk strode straight
  over the code block a marker was naming.
- **linkKey must canonicalise.** A page keys as "places/japan" and the
  frontmatter string `loc: "[[Japan]]"` as "japan", so kepano's commonest
  filter matched nothing until bare names resolved like wikilinks.
- **Link identity applies only where a side really is a link**
  (`isLinkish`), or `contains(file.name, "ign")` becomes a failed link
  lookup instead of a substring test.
- **marked UNSHIFTS extension tokenizers**, so a host's extensions are
  offered before the engine's. That is what lets `tableBeforeAnchor` claim
  a table's rows before the table rule can swallow the marker beneath it.
- **A three-backtick fence cannot quote a three-backtick fence.** A
  demo-vault note had been rendering half its content as a code block
  because of this; the wrapper needs four.

## 5. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` the demo and study vaults
  after every smoke run.
- **The owner's bug reports have been consistently right.** When a report
  and the code disagree, look harder at the code.
- **Write assertions that can fail.** A table-editing smoke once came back
  4/4 green with two vacuous assertions (`doc.lines >= 9`, and a literal
  `true`). Rewritten to count rows and cursor cells, it proved the real
  thing.
- **Verify artefacts by content** — the `.canvas` file, the
  `.excalidraw.md` bytes, the saved PDF, the rendered HTML — never the log
  line that says it worked.
- **Prefer measuring to guessing.** Every good decision in this stretch
  came from a corpus; the one bad ranking came from a single biased vault.
- `npm run dev` and `npm run package` **re-sync the engine** from the
  golden master's working tree. That is how newer engine work arrives
  unbidden; it is not your edit.
