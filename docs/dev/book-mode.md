# Book / manuscript mode — the Clew side (design, no code)

*Written 2026-10-03 for the owner to read (FEATURE-IDEAS #5). Builds on
jmarkdown's engine note, `docs/dev/book-mode-engine.md` at `at-migration`
8a55b00 (read, not copied: "the engine note" below, its sections as §E2 …
§E7). Nothing here is built. The owner's questions from both documents are
merged into ONE list at the end (§9).*

A **book** in Clew is a set of ordinary notes, read and exported as one
document: chapters in an order, numbering that runs across them, references
between them, one bibliography, one contents list, one index — a monograph,
a thesis, a set of course notes, a long report. Every chapter stays a note
like any other: it opens, previews, links and syncs as now, and Obsidian
sees nothing it cannot read.

---

## 1. What exists already

On the engine side (§E2), a book is ONE document assembled by inclusion:
headings, figures, theorems and equations are numbered across files;
`@label`/`@ref` resolve across files; there is one References and one
Index; LaTeX gets `\chapter`s and front/main/back matter. On Clew's side:

| Piece | Where it is today | What a book needs from it |
|---|---|---|
| Numbering mirror for the editor | `editor/live/numbering.js` (§5.13): the engine's post-processor numbering over ONE note's text, parity asserted by `crossref-scenario.js` | the same, offset by the chapters before |
| Label completion, jump, hover | per note | across the book's chapters |
| Citations | the vault's bibliography, additively merged with a note's (jmarkdown 909af7a); pills via `cite-text.js`, per note | one bibliography; numeric styles numbered in book order |
| Exports | one note → HTML / LaTeX / PDF (`main/export.js`), the LaTeX engine picked off the `.tex` | a whole book → the same three |
| Site export | the vault as pages (`export-site.js`) | a book as one section with contents and prev/next |
| Rename | `rename-links.js` rewrites `[[links]]` vault-wide | the chapter list must survive a rename |
| Inclusion | `[[file.md]]` on its own line — but Clew sets `"File inclusion": false` (it is the wikilink, §E3 G2) | a channel of its own for the chapter list |

---

## 2. Where the book lives: a master note

The engine note leaves this open (§E7 Q6: "a Clew-side manifest handed to the
engine, or a master note the author edits?"). **Both, at once:** the
manifest IS a note. A book is a **master note** whose front matter lists its
chapters as wikilinks:

```yaml
---
book: true
title: Evolution of the Social Contract
author: Brian Skyrms
numbering: per chapter        # or: continuous  (§9 Q1)
documentclass: book
frontmatter:
  - "[[Preface]]"
chapters:
  - "[[Sex and Justice]]"
  - "[[Fairness]]"
  - "[[Mutual Aid]]"
appendices:
  - "[[Proofs]]"
bibliography: Library/skyrms.bib
---

The master's body is what goes before chapter 1 in the book's own pages:
a dedication, an epigraph — or nothing.
```

Why a note and not a `.book` file:

- **It travels and it is readable everywhere:** a YAML list of wikilinks is
  a note any Obsidian user can open; Dataview and Bases can query it.
- **Renames keep it whole for free:** `rename-links.js` already rewrites
  `[[Fairness]]` wherever it appears, front matter included (to be checked
  in phase 1; a test would hold it).
- **One place for the book's configuration:** the master's front matter is
  the book's header, exactly the engine's rule (§E6: "the master's header is
  the book's configuration").
- Clew READS the list and hands the engine an ordered `chapters` array
  (§E6's interface) — no `[[…]]` inclusion needed, so `"File inclusion":
  false` stays as it is (G2).

A note may be a chapter of more than one book (course notes reused in two
courses) — nothing stops it; whether Clew should show "chapter 3 of 2
books" is §9 Q10.

**Ordering UI.** Editing the YAML list works, but the natural gesture is a
**chapter list** — a panel (or the master note's reading view): the chapters
in order, drag to reorder (which rewrites the list), per-chapter word count
and an optional `status:` from each chapter's own front matter, "Add the
active note to this book", and Build. The panel writes the master note
through the normal guarded write (2f5d80d), so a conflict on the master is
handled like any other note's.

---

## 3. Inside a chapter: numbers and references while writing

A chapter edited alone is a note edited alone — today it numbers from 1.
In a book, Figure 3 of chapter 2 should READ "Figure 2.3" (or "Figure 17",
continuous) in live edit, and `@ref{fig:arrow}` to a figure in chapter 1
should show chapter 1's number and jump there.

**Proposal — a Clew-side book map, computed, not built.** `numbering.js`
already mirrors the engine's numbering for one note, held to parity by a
scenario. For a book, run it over each chapter in order (texts the indexer
already has; the master's list gives the order) and keep:

- per chapter, the counter offsets at its start (continuous) or its chapter
  number (per chapter) — what the live view adds to its own counts;
- a label table across the book: label → chapter, number, line.

Chips, equation tags, heading prefixes, completion, jump and hover read the
book map when the open note is a chapter; nothing else changes. It updates
incrementally: a chapter's edit re-counts that chapter and shifts the offsets
of the ones after it — counting is cheap (it is a scan, not a render).

**Where this differs from the engine note.** §E5.3 suggests the book map come
from the engine's whole-book pass (option C writing a JSON beside the
output). A built map is exact but stale between builds; a computed one is
always current but can drift. Clew already chose the mirror for single notes
and keeps it honest by a parity scenario; I propose the same here, with a
book parity scenario against the engine's map once option A/C writes one.
This is §9 Q9 for the owner.

**Reading view of one chapter** shows the chapter as rendered alone (its own
numbering) until the engine can number from offsets (§E4 B, or the book map
read by a lone-chapter render, §E5.3). Until then, a quiet line at the top
of a chapter's reading view — "Chapter 2 of Evolution of the Social
Contract · numbers as in the book: Build" — says so rather than letting the
reader be surprised.

**Navigation.** When the active note is a chapter: the status bar says
"Ch. 2 of *Book*"; commands "Book: next chapter" / "previous chapter";
"Book: open the chapter list". The outline panel can show the whole book's
headings with the active chapter expanded.

---

## 4. One bibliography

- A book's bibliography is the vault's (as configured) plus the master's
  `bibliography:` — the additive rule notes have had since jmarkdown 909af7a,
  applied once, for the whole book.
- A chapter's own `Bibliography:` is NOT read in a book build (the engine's
  G8 default: "one configuration"); Clew says so as a build warning naming
  the chapter, rather than silently ignoring it. §9 Q3.
- Numeric styles number in BOOK order (the engine does it in its one pass).
  Live edit's citation pills (`cite-text.js`) ask the engine per note today;
  for a chapter they would ask with the book's order — the engine accepts a
  list of preceding citations, or Clew renders the pills from the last book
  build's map. Phase 2.
- One References at the end of the book (or per chapter — §9 Q11).

---

## 5. Export

| Target | Phase 1 (engine option A) | Later (engine option C) |
|---|---|---|
| PDF via LaTeX | one `.tex` (book/report class) → `latexmk` with the engine picked off the `.tex` (`main/latex-engine.js`, as for notes) | master `.tex` + `\include{ch-N}` (§E6 `latexLayout: 'include'`), `\includeonly` for a quick chapter proof |
| LaTeX | the `.tex` (and its `-bibliography.bib`) beside the master | the master + chapter files |
| HTML | one page, with contents | one page per chapter (`htmlLayout: 'split'`), prev/next |
| Site export | the book as one page in the site | the book as a section: contents page + chapter pages, cross-chapter links rewritten (G9) |
| Reading-view PDF (print) | the whole book's HTML printed (`print-pdf.js` path) | per chapter |

- **Commands and menu:** File → Export → Book as PDF / LaTeX / HTML, enabled
  when the active note is a master or a chapter of exactly one book; the
  chapter list's Build button; `clew export --pdf <master>` (the CLI of
  FEATURE-IDEAS #8) does the same.
- **Errors where they help:** the engine's line map (§E5 A, G4) gives every
  warning a `file:line`; Clew's build-warning list (`renderer/
  build-warnings.js`) then opens the chapter at the line, as it does for a
  note. Before the line map, warnings would point into the assembled
  stream — useless — so the line map is a phase-1 requirement, not a nicety.
- **Trust:** a book export runs under the vault's trust like any export
  (`paths.restrictedExport` for a restricted vault).
- **Where it goes:** beside the master (`Book.pdf`), overwritten on rebuild,
  never inside `.clew/` — or a `build/` folder (§9 Q12).

---

## 6. How it fits the rest of Clew

- **The vault and the index.** The indexer learns `book: true` notes and
  their chapter lists (a reverse map chapter → books), so anything can ask
  "is this note a chapter, of what, and where". A chapter missing from the
  vault (a dangling link in the list) shows in the chapter list in the
  danger colour and stops a build by name.
- **The engine.** Clew never assembles text itself: it hands the engine
  `chapters` (§E6) and reads back outputs, warnings with locations, and
  (later) the book map. Engine changes stay upstream, config-gated, and a
  single-note build ignores all of them (§E6 "What stays the same").
- **Live edit.** Only `numbering.js`'s consumers change (§3), plus the
  status bar and two commands. Frames, the preview pane and the toolbar are
  untouched.
- **Obsidian compatibility.** The master is a note with front matter; the
  chapters are notes. Nothing goes into `.obsidian/`; nothing new is a file
  format Obsidian cannot open.
- **iOS.** Everything above is renderer + main, the master note format is
  text: Clew-iOS takes the chapter list panel and the numbering mirror with
  the shared code, and builds books only if its export path can run the
  engine's book option (as for notes).

---

## 7. What has to happen, in order

**Engine (the engine note's §E5, option A first):** a `chapters` input;
strip each chapter's front matter (G1 — needed whatever else); a line map
for warnings and source lines (G4); `Numbering: per chapter | continuous` in
both outputs (G3); per-chapter footnote lists in HTML (G7); optionally the
LaTeX `include` layout (G5).

**Clew, phase 1 — a book you can export:** the master-note format and its
reader (pure, tested), the reverse map in the indexer, the chapter list
panel (order, add, word counts, Build), Export → Book as PDF/LaTeX/HTML
through the engine's `chapters`, warnings opening the right chapter, the
status-bar indicator and next/previous chapter.

**Clew, phase 2 — writing inside a book:** the computed book map (§3) for
live edit's numbers, chips, completion, jump and hover across chapters; a
parity scenario; the reading-view banner; citation pills in book order.

**Phase 3 — big books (engine option C):** incremental rebuilds, one HTML
page per chapter, a book as a site section, `\includeonly` proofs, and the
engine's book map checked against Clew's.

---

## 8. Risks

- **Drift between the editor's numbers and the built book** (§3) — the same
  risk single notes carry today, managed the same way (a parity scenario).
- **A long book's rebuild** (G6) until option C: a phase-1 build of a
  300-page book is a full render each time. Builds are on request (Build,
  Export), never on every keystroke, so this costs waiting, not editing.
- **Front matter in chapters** (G1) is the one engine fix nothing works
  without.
- **A master note edited on two devices** is an ordinary note conflict
  (2f5d80d), resolved in the ordinary way.

---

## 9. Questions for the owner (both documents, merged)

From the engine note (§E7), with my view where I have one:

1. **Numbering policy:** per chapter (Figure 2.3 — the LaTeX `book`
   default) or continuous (Figure 7 — today's HTML)? Do theorems follow it?
   *My view: per chapter by default, `numbering: continuous` available —
   it is what readers of books expect, and both outputs can do it (G3).*
2. **A chapter's title:** its first `#` heading, its front-matter `title`,
   or its file name? *My view: the first `#` heading; failing that the
   front-matter title; failing that the file name.*
3. **Per-chapter settings (G8):** none (one configuration for the book), or
   a short whitelist? *My view: none — and a chapter that sets a
   `Bibliography:` gets a warning naming it, not silence.*
4. **HTML shape:** one long page first, or per-chapter pages from the
   start? *My view: one page first (phase 1, option A); split pages with
   option C.*
5. **Footnotes in HTML:** a list at the end of each chapter, or at the end
   of the book? *My view: the end of each chapter.*
6. **Where the order lives:** a Clew-side manifest or a master note? *My
   view, reconciling the two: a master NOTE whose front matter is the
   manifest; Clew reads it and hands the engine `chapters` (§2).*

From this document:

7. **Parts and matter:** should the list support `parts:` (Part I, II …) and
   front/back matter sections as sketched in §2, or only chapters at first?
8. **The chapter list:** a panel of its own, or the master note's reading
   view made into the list?
9. **Book numbers while writing:** a computed book map in the editor (always
   current, kept honest by a parity scenario — my proposal), or only the
   engine's built map (exact as of the last build — the engine note's
   §E5.3)?
10. **A note in two books:** allowed (my assumption) — and if so, which
    book's numbers does the editor show (the first? the one last built?)?
11. **References:** one list at the end of the book only, or also per
    chapter (some edited volumes want both)?
12. **Where builds go:** beside the master (`Book.pdf`), or a `build/`
    folder in the vault?
13. **Progress:** per-chapter word counts and a `status:` (draft, revised,
    done) in each chapter's front matter, shown in the chapter list — wanted?
