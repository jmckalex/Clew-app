# Book / manuscript mode — the Clew side (design, no code)

*Written 2026-10-03 for the owner to read (FEATURE-IDEAS #5); REVISED
2026-10-04 with the owner's answers to all thirteen questions — §9 is now
"Decisions", and §2–§8 follow them. Builds on jmarkdown's engine note,
`docs/dev/book-mode-engine.md` at `at-migration` 8a55b00 (read, not copied:
"the engine note" below, its sections as §E2 … §E7). Nothing here is built,
and building waits for the owner's go.*

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
engine, or a master note the author edits?"). **Both, at once** (decided,
§9 D6): the manifest IS a note. A book is a **master note** whose front
matter lists its chapters as wikilinks:

```yaml
---
book: true
title: Evolution of the Social Contract
author: Brian Skyrms
numbering: per chapter        # the default; or: continuous  (§9 D1)
documentclass: book
chapters:
  - "[[Sex and Justice]]"
  - "[[Fairness]]"
  - "[[Mutual Aid]]"
bibliography: Library/skyrms.bib
---

The master's body is what goes before chapter 1 in the book's own pages:
a dedication, an epigraph — or nothing.
```

**Chapters first** (§9 D7): phase 1 reads `chapters:` only. `parts:` and
front/back matter (`frontmatter:`, `appendices:`) come later; until then a
master that names them builds WITHOUT them and says so by name ("parts: are
not supported yet — the book was built from its chapters"), never silently.

**A chapter's title** (§9 D2) is its first `#` heading; failing that its
front-matter `title`; failing that its file name. In a book a `#` heading
STARTS a chapter, so:
- a note with NO `#` heading gets one at its start, from its `title` or its
  file name;
- a note whose first `#` heading comes after some text is warned by name —
  that text would fall before the chapter starts, at the end of the previous
  one;
- a second `#` heading inside a chapter note is warned by name ("Fairness has
  3 level-1 headings; each starts a chapter").

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

**A note in two books** (§9 D10) is allowed (course notes reused in two
courses). The editor shows the numbers of the book BUILT OR OPENED most
recently — opened meaning its master note or its Book panel — and says which:
the status bar reads "Ch. 3 of *Course A* · also in *Course B*", and a click
there switches. Which book that is lives in the window's workspace state
(device-local, `.clew/workspace.json`), never in the notes.

**The Book panel** (§9 D8) — a panel of its own, beside Outline and Refs, not
the master's reading view. It shows the book of the active note (or the
master open), and for each chapter, in order: its title (D2), word count and
`status:` — `draft`, `revised` or `done`, from the chapter's own front
matter, set from the panel through the guarded field edit — then the book's
TOTAL words and how many chapters are at each status (§9 D13). Drag to
reorder (which rewrites the list), "Add the active note to this book",
remove, open, and Build. A chapter whose link resolves to nothing is drawn
in the danger colour and stops a build by name. The panel writes the master
note through the normal guarded write (2f5d80d), so a conflict on the master
is handled like any other note's. The status bar already counts a note's
words, over its whole text; the panel counts PROSE — not front matter,
code, maths or comments — with the same idea of a word, in one pure counter
(`shared/book.js`, tested), shared with iOS. The status is a chip on Clew's
own menu.

---

## 3. Inside a chapter: numbers and references while writing

A chapter edited alone is a note edited alone — today it numbers from 1.
In a book, Figure 3 of chapter 2 should READ "Figure 2.3" (per chapter, the
default — theorems follow it, D1; "Figure 17" with `numbering: continuous`)
in live edit, and `@ref{fig:arrow}` to a figure in chapter 1 should show
chapter 1's number and jump there.

**Decided — a Clew-side book map, computed, not built** (§9 D9). `numbering.js`
already mirrors the engine's numbering for one note, held to parity by a
scenario. For a book, run it over each chapter in order (texts the indexer
already has; the master's list gives the order) and keep:

- per chapter, its chapter number (per chapter: the prefix of every number
  in it) or the counter offsets at its start (continuous) — what the live
  view adds to its own counts;
- a label table across the book: label → chapter, number, line.

Chips, equation tags, heading prefixes, completion, jump and hover read the
book map when the open note is a chapter; nothing else changes. It updates
incrementally: a chapter's edit re-counts that chapter and shifts the offsets
of the ones after it — counting is cheap (it is a scan, not a render).

**Where this differs from the engine note.** §E5.3 suggests the book map come
from the engine's whole-book pass (option C writing a JSON beside the
output). A built map is exact but stale between builds; a computed one is
always current but can drift. Clew already chose the mirror for single notes
and keeps it honest by a parity scenario; the owner chose the same here
(D9): a BOOK parity scenario builds a fixture book and asserts every number
the map computes equals the built book's, as `crossref-scenario.js` does for
one note (`numbers-match=true`) — never assumed.

**Reading view of one chapter** shows the chapter as rendered alone (its own
numbering) until the engine can number from offsets (§E4 B, or the book map
read by a lone-chapter render, §E5.3). Until then, a quiet line at the top
of a chapter's reading view — "Chapter 2 of Evolution of the Social
Contract · numbers as in the book: Build" — says so rather than letting the
reader be surprised.

**Navigation.** When the active note is a chapter: the status bar says
"Ch. 2 of *Book*"; commands "Book: next chapter" / "previous chapter";
"Book: open the Book panel". The outline panel can show the whole book's
headings with the active chapter expanded.

---

## 4. One bibliography, and what a chapter may set

**The bibliography.**
- A book's bibliography is the vault's (as configured) plus the master's
  `bibliography:` — the additive rule notes have had since jmarkdown 909af7a,
  applied once, for the whole book.
- A chapter's own `Bibliography:` ADDS for THAT chapter's citations (D3): its
  keys resolve for citations in that chapter, the book's for every chapter. A
  key cited in another chapter that only a chapter's file holds is a warning
  naming both ("Mutual Aid cites axelrod84, which only Fairness's
  bibliography holds"), and a key two scopes define DIFFERENTLY is a warning
  too (the chapter's own entry wins in that chapter; the one References list
  cannot hold two entries under one key).
- Numeric styles number in BOOK order (the engine does it in its one pass).
  Live edit's citation pills (`cite-text.js`) ask the engine per note today;
  for a chapter they would ask with the book's order — the engine accepts a
  list of preceding citations, or Clew renders the pills from the last book
  build's map. Phase 2.
- ONE References list, at the end of the book (D11) — in split HTML its own
  page, which every citation links to.

**What a chapter may set** (D3 — a short whitelist, not "none"; key names as
the engine's note has them, jmarkdown 62ae133 §6). Only the
master's header configures the book, except these, which a chapter may set
for itself — in its front matter, or, for styles, its own `<style>` elements:

| Key | In LaTeX | In HTML |
|---|---|---|
| `Bibliography` | its entries join the book's `.bib` input; the scoping above is the engine's | the same |
| `Packages`, `LaTeX preamble` | LaTeX has ONE preamble, so a chapter's lines join the book's, after the master's, in chapter order; a package loaded twice with different options is warned by name (LaTeX would stop on the clash) | no effect, as for a note |
| `Language` (hyphenation, quotation marks) | `otherlanguage` around the chapter (babel/polyglossia: the master's language main, the chapters' loaded too) | `lang` on the chapter's page, so the browser hyphenates by it; quotation marks by language — NEW engine work (Smart typography's quotes are one style today) |
| `Math macros` | issued at the chapter's start (`\providecommand` + `\renewcommand`), so the chapter's definition holds in that chapter even if another chapter defines the name differently — warned | that chapter's page's MathJax configuration: the book's macros plus the chapter's |
| `<style>` elements, "for chapter specific content" (the owner's words) | no effect | on that chapter's page only; in any one-document output (the print PDF, later) scoped to the chapter with CSS `@scope` |

Anything else a chapter's front matter sets for the engine is NOT applied,
and the build says so by name ("Fairness sets Bibliography style — a book
takes that from its master"). Keys that are the chapter's own data —
`title`, `status`, `aliases`, `tags` — are not settings and are never warned.

---

## 5. Export

**Per-chapter HTML pages from phase 1** (D4 — against my advice to start
with one page; the owner's call). The engine note offers two routes: A's one
assembled document split afterwards, or C sooner. Reading §E4 C closely, the
pages are NOT what C's machinery buys: C says "run the existing
post-processor once over the whole book … Split the result into one page per
chapter afterwards, rewriting cross-page `href`s from the label table the
pass already built". The split is a step AFTER the one post-pass, and it
works the same on A's assembled document. What C adds is INCREMENTAL
rendering (cached chapter fragments), and its cost list — moving footnote
numbering, endnote groups and `{{TOC}}` into the post-pass, a cache key over
everything a chapter's render depends on — buys speed, not pages. So:
**option A plus the split** in phase 1 (`htmlLayout: 'split'` as a final
pass over A's one document), C only when a long book's rebuild bites (G6).
The split, at chapter boundaries the line map already knows (G4):
- `index.html` — the book's title page, the master's body, the contents;
- one page per chapter, prev/next and "Contents" on each; its own footnote
  list at its end (D5 — the engine's endnote groups keyed to chapters, G7);
  its own `lang`, macros and styles (§4);
- `references.html` (D11) and, when the book has one, the index;
- every in-document link whose target landed on another page rewritten to
  `page.html#id` — `@ref`s, citations, footnote marks, and cross-chapter
  `[[wikilinks]]`, which in a book build emit an in-book `#anchor` (G9) and
  are then rewritten like any other.

Confirmed by the engine owner: jmarkdown 62ae133 (`docs/dev/book-mode-engine.md`,
its decisions table, "HTML shape": "option A plus a split at chapter
boundaries, in phase 1. Option C is not needed for it").

| Target | Phase 1 (engine option A + the split) | Later (engine option C) |
|---|---|---|
| PDF via LaTeX | one `.tex` (book/report class) → `latexmk` with the engine picked off the `.tex` (`main/latex-engine.js`, as for notes) | master `.tex` + `\include{ch-N}` (§E6 `latexLayout: 'include'`), `\includeonly` for a quick chapter proof |
| LaTeX | the `.tex` (and its `-bibliography.bib`) in `build/` | the master + chapter files |
| HTML | a contents page + one page per chapter + References (`htmlLayout: 'split'`, above) | the same pages, rebuilt incrementally |
| Site export | each chapter is a page as now (no book structure) | the book as a section: its split pages inside the site |
| Reading-view PDF (print) | — | the whole book printed (`print-pdf.js` path) |

- **Commands and menu:** File → Export → Book as PDF / LaTeX / HTML, enabled
  when the active note is a master or a chapter (of the book the status bar
  names, D10); the Book panel's Build button; `clew export --pdf <master>`
  (the CLI of FEATURE-IDEAS #8) does the same.
- **Errors where they help:** the engine's line map (§E5 A, G4) gives every
  warning a `file:line`; Clew's build-warning list (`renderer/
  build-warnings.js`) then opens the chapter at the line, as it does for a
  note. Before the line map, warnings would point into the assembled
  stream — useless — so the line map is a phase-1 requirement, not a nicety.
- **Trust:** a book export runs under the vault's trust like any export
  (`paths.restrictedExport` for a restricted vault).
- **Where it goes** (D12): a `build/` folder beside the master note, named by
  the master so two books in one folder never collide — `build/<Master>.pdf`,
  `build/<Master>.tex` (+ its `-bibliography.bib`), `build/<Master>/` holding
  the HTML pages. LaTeX's intermediates (`.aux`, `.bbl`, `.log`, …) stay in
  `build/` too, so a rebuild is latexmk's quick rerun, and never beside a
  chapter. Overwritten on rebuild, never inside `.clew/`, and the tree is
  refreshed at once (`vaults.refreshIfInside`, as every Clew write of a new
  file).

---

## 6. How it fits the rest of Clew

- **The vault and the index.** The indexer learns `book: true` notes and
  their chapter lists (a reverse map chapter → books), so anything can ask
  "is this note a chapter, of what, and where". A chapter missing from the
  vault (a dangling link in the list) shows in the Book panel in the
  danger colour and stops a build by name.
- **The engine.** Clew never assembles text itself: it hands the engine
  `chapters` (§E6) and reads back outputs, warnings with locations, and
  (later) the book map. Engine changes stay upstream, config-gated, and a
  single-note build ignores all of them (§E6 "What stays the same").
- **Live edit.** Only `numbering.js`'s consumers change (§3), plus the
  status bar and two commands. Frames, the preview pane and the toolbar are
  untouched.
- **Panels.** The Book panel (§2) is a panel like Outline and Refs; its word
  counter and status edit are shared code, so Clew-iOS takes them as they
  are.
- **Obsidian compatibility.** The master is a note with front matter; the
  chapters are notes. Nothing goes into `.obsidian/`; nothing new is a file
  format Obsidian cannot open.
- **iOS.** Everything above is renderer + main, the master note format is
  text: Clew-iOS takes the Book panel and the numbering mirror with
  the shared code, and builds books only if its export path can run the
  engine's book option (as for notes).

---

## 7. What has to happen, in order

**Engine, phase 1 (option A plus the split; upstream, config-gated, a
single-note build ignoring all of it):**
- a `chapters` input (§E6);
- each chapter's front matter stripped (G1), its whitelisted keys (§4) kept
  for that chapter, anything else warned by name;
- the chapter title rule and its warnings (§2, D2);
- a line map, so warnings and source lines name the chapter (G4);
- `Numbering: per chapter` (the default; theorems follow; LaTeX
  `numberwithin=chapter`) `| continuous`, in both outputs (G3, D1);
- per-chapter footnote lists in HTML (G7, D5);
- the per-chapter whitelist: scoped bibliographies with their two warnings,
  preambles joined, `Language` switched (with per-language quotation marks —
  new), macros issued per chapter, styles per page;
- `htmlLayout: 'split'` — contents, chapter pages, References, links
  rewritten across pages (§5, D4, D11);
- deferred: the LaTeX `include` layout (G5).

**Clew, phase 1 — a book you can export:**
- the master-note format and its reader (pure, tested; `chapters:` only,
  `parts:`/matter refused by name, D7);
- the indexer's reverse map (chapter → books);
- the Book panel: order by drag, add/remove, open, word counts, status
  (draft/revised/done), totals, Build, dangling chapters in the danger
  colour (D8, D13);
- File → Export → Book as PDF/LaTeX/HTML into `build/` beside the master
  (D12);
- build warnings opening the chapter at the line;
- the status-bar indicator ("Ch. 2 of *Book*", the most recent book of two,
  said — D10) and next/previous chapter;
- a test that a rename rewrites the master's front-matter wikilinks;
- a fixture book in the demo vault (its documentation, as every feature's).

**Clew, phase 2 — writing inside a book:** the computed book map (§3, D9) for
live edit's numbers, chips, completion, jump and hover across chapters; the
book parity scenario; the reading-view banner; citation pills in book order.

**Phase 3 — big books and structure (engine option C):** incremental
rebuilds, `parts:` and front/back matter (D7), the LaTeX `include` layout
with `\includeonly` proofs, a book as a site section, the whole-book print
PDF, and the engine's book map checked against Clew's.

---

## 8. Risks

- **Drift between the editor's numbers and the built book** (§3) — the same
  risk single notes carry today, managed the same way (a parity scenario).
- **A long book's rebuild** (G6) until option C: a phase-1 build of a
  300-page book is a full render each time. Builds are on request (Build,
  Export), never on every keystroke, so this costs waiting, not editing.
- **Front matter in chapters** (G1) is the one engine fix nothing works
  without.
- **A bigger phase 1.** Split pages (D4) and the per-chapter whitelist (D3)
  move engine work into phase 1 that the first draft left for later: the
  split and its link rewriting, scoped bibliographies, per-chapter `Language`
  (per-language quotes are new to the engine), macros and styles. Each is
  small and testable alone, but phase 1 is now mostly ENGINE work, and Clew's
  half can only be finished against it.
- **Settings that cannot be truly per chapter in LaTeX.** A preamble is one
  per document: a chapter's packages are the book's. The design says so (a
  clash is warned by name) rather than pretending otherwise.
- **A master note edited on two devices** is an ordinary note conflict
  (2f5d80d), resolved in the ordinary way.

---

## 9. Decisions (the owner, 2026-10-04)

The thirteen questions of the first draft (both documents, merged), answered.
"Was:" marks where an answer differs from the view the draft gave. The
sections above cite them as D1 … D13.

1. **Numbering:** PER CHAPTER (Figure 2.3, Theorem 4.1 — theorems follow
   it), with `numbering: continuous` available. (§3, §7)
2. **A chapter's title:** its first `#` heading, else its front-matter
   `title`, else its file name. (§2)
3. **Per-chapter settings:** a SHORT WHITELIST — a chapter's own
   Bibliography (which ADDS for that chapter's citations), LaTeX packages
   and preamble, Language (hyphenation, quotation marks), Math macros, and
   "<style> elements, for chapter specific content"; anything else a
   chapter sets is warned by name. *Was: none.* (§4)
4. **HTML shape:** PER-CHAPTER PAGES from phase 1. *Was: one page first.*
   Done as option A plus a split after the one post-pass, not option C
   sooner (§5's reasoning; confirmed in jmarkdown 62ae133). (§5, §7)
5. **Footnotes in HTML:** at the end of each chapter (each chapter's page).
   (§5)
6. **Where the order lives:** a master note. (§2)
7. **Parts and matter:** chapters first; `parts:` and front/back matter
   later (phase 3). (§2, §7)
8. **The chapter list:** a Book panel of its own. (§2)
9. **Numbers while writing:** COMPUTED live — the book map — kept honest by
   a book parity scenario. (§3)
10. **A note in two books:** allowed; the editor shows the numbers of the
    book built or opened most recently, and says which. (§2)
11. **References:** one list, at the end of the book. (§4, §5)
12. **Where builds go:** a `build/` folder beside the master note. (§5)
13. **Progress:** yes — word counts and a status (draft / revised / done)
    per chapter, plus the book's total, in the Book panel. (§2)
