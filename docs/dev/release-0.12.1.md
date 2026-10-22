# Release 0.12.1 — notes, gaps, blockers (prep, nothing published)

The owner's "Go … B" (via Clew-boss, 2026-10-22): draft the release notes
since 0.12.0 from the commit log, user-facing; update the release checklist;
say what blocks a release candidate. Nothing here is published, tagged or
bumped. Prepared from Clew-app's log `9268aa3` (0.12.0) `..a14ec13` — 252
commits — against Clew-docs' held draft of the public notes,
`site/manual/whats-new.html#v0-12-1` on its `release-0.12.1` branch
(`14b4363`, worktree `../Clew-docs-0.12.1`, never deployed). That page is
the release notes users read — the update feed's `notes` link points at its
anchor — so this file does not rewrite it: §1 is the short form (a GitHub
release's body, a download page's summary), §2 what the long form lacks.

## 1. Clew 0.12.1 — in short

**New**

- **Trusting a vault.** A vault's code — scripts, plugins, notes that
  compute — runs only where this computer trusts it; a new vault with code
  opens restricted and asks once.
- **Apps in notes** (`@app[Folder]`), each in its own sandbox with the
  permissions you grant; six to try in the demo vault's App Gallery.
- **Books:** a master note lists chapters; the Book panel, the book's
  numbers and citations while you write, one-step PDF, LaTeX or HTML
  builds, and *Proof This Chapter*.
- **LaTeX in Clew's style:** EB Garamond and Garamond-Math, 12pt, your
  region's paper, the note's language; title pages from `@title`,
  `@author`, … as LaTeX's own title.
- **Quote a passage from a PDF** into the note you are writing, cited at
  the printed page.
- **A note — or an annotated PDF — changed in two places never loses a
  version:** both are kept and you choose.
- **`clew://` links and the `clew` command** (open, new, export).
- **Update check:** Clew says when a newer version exists; it never
  downloads anything itself.
- **Your own callout types**, and callouts in every export.
- **Figures draw PostScript** (PSTricks, EPS, `\rotatebox`) and any font
  family on this computer; **an export's figures need no TeX
  installation.**
- **Obsidian's `%%` comments are hidden** everywhere but live edit.
- **Converting colon directives** to the `@` forms, previewed, backed up and
  undoable.

**Better**

The mode switch in the tab strip; ⌘1–⌘9 for tabs; the Window menu lists
every vault; live edit draws callouts, citations, lists, quotes and title
pages as reading mode does; PDF embeds one page tall with Obsidian's
`#page=`/`#height=`; exports keep `[[links]]` as text and `![[images]]`, and
an HTML export cites as reading view does; the demo vault brings new demo
notes into your copy; brighter text in the dark theme; **a PDF via LaTeX now
says when TeX could not find an image**, which it used to leave out without
a word.

**Fixed**

Citations, a custom font, a Clew fence, a `%` and escaped characters in PDF
via LaTeX; a figure's live preview covering the typo it shows; splits
reloading each other; a note's first line taken for a header (an empty
export); scroll sync after a long inline footnote; ⌥ shortcuts in reading
mode.

**Changed**

A vault's code runs only where you trust it (the vaults you already used
stay trusted); Enter stays in a list item, ⌘Enter starts the next, ⌘L
toggles a task; a `---` block is a note's only header; a PDF link opens
beside the note, never over it.

## 2. What the long draft lacks (for Clew-docs)

User-facing changes in Clew-app's log that `whats-new.html#v0-12-1`
(`14b4363`) does not mention. Each is worth a line; Clew-docs decides the
wording and the section.

| Change | Commit | Section |
| --- | --- | --- |
| A PDF via LaTeX that leaves out an image TeX could not find — a full path that is not there, an embed the vault lacks — says so: a warning naming the file, and the export's notice names it first ("TeX could not find picture.png") | `076ddb0`, `2018bb8` | Better |
| Markup inside code is text: `</>`, `<b>…</b>` in a code span, a table cell, a fence or an embed show as written (they were swallowed), and a `<script>` in inline code stays code — it ran in a trusted vault | `ef8577e`, `cddeba9`, `1b3f321` | Fixed |
| An image's alt text and attribute values with quotes or `<` no longer break the page | `1b3f321` | Fixed |
| PDF via LaTeX never runs a configuration file it finds in the folder it builds in: latexmk and biber take only your own (a `latexmkrc` or `biber.conf` there — left by a vault, or written by a document's own TeX — was run), and only programs from absolute folders on the PATH | `d83b49b`, `f23173d` | Changed (security) |
| Mathematica in a vault, or a profile, whose folder name contains `.m` (`my.math notes/`) failed | `cfdf3ef` (jmarkdown f2c6a3a) | Fixed |
| A header `Title` with an entity (`Caf&eacute; &mdash; …`) shows its characters in an HTML export's page title, not the codes | `cfdf3ef` (jmarkdown d63a871) | Fixed |
| A LaTeX export that leaves out a Mermaid diagram says why and how to get it — on the Mac, mermaid-cli and where Clew looks for it | `c504a9e` | Better |
| Live edit: `{{TOC}}` follows headings as they are edited; a renamed heading kept its old entry until the note was reopened | `33bf174` | Fixed |
| Live edit: a note's own front matter, edited, re-renders the query and dataviewjs blocks that read it (the demo dashboard's chart) | `478cfdf` | Fixed |
| Live edit: a table's cells wrap at words, not a letter a line, and a table wider than the column scrolls | `9a5c896` | Better |
| Live edit: tab-indented and numbered list items line up with their text, and so do quotes inside them, in any font | `89d6a8b`, `2fc3459`, `7c46c38` | Better |
| A large vault stays responsive while its index is saved (written in slices, off the main thread) | `ef5f7f2` | Better |
| A bare `:target` prints as written | `e8fdad2` (jmarkdown ff7facd) | Fixed |

To check before writing (whether 0.12.0 had the fault, or it came and went
between releases): live edit's `@begin(equation)` showing its number twice
(`3d39952`); an unchanged note exported to PDF again handing back the last
PDF (`6ab62ae` — latexmk now always runs); notices over a PDF viewer's page
chip (`038ec6f`).
Not for the notes: C4 (`a14ec13`, Garamond-Math loaded only for a document
with maths) changes no page a user sees — measured identical in text,
pixels and fonts over 61 notes.

## 3. What blocks a release candidate

**Work queued before an RC** (Clew-boss's order, 2026-10-22):

1. `demo-vault/Guide/Export.md` says PDF via LaTeX "runs your TeX toolchain
   (latexmk …)" — untrue on the iPad, whose seed vault is synced from it
   (Clew-iOS `scripts/sync-upstream.js`): the wording, then
   `npm run gen-demo-history` (packaging refuses a stale history).
2. A dev.N → commit table in HANDOVER.
3. The harnesses into the repo (`smoke/export-identity/`,
   `smoke/packaged-checks.sh`) — not user-facing; the RC's checks use them.
4. `pdfViaLatexFailure` adds the first error's help paragraph.
5. Clew-docs: §2's lines, the manual's `%%` and TeX-not-found lines, the
   screenshot pass and the version grep (its HANDOVER's release checklist).

**Waiting on the owner:**

- **An unclosed `%%`.** Clew keeps it as text; Obsidian hides the rest of
  the note (its own help). If the owner wants Obsidian's behaviour, it is a
  change to `obsidian-comments.js` and to the draft's `%%` line before the
  RC, not after.
- **The engine's uncommitted hunk.** Every vendoring since 0.12.0 records
  `Synced from: at-migration@<sha> (dirty tree)`: the owner's own
  `src/index.js` hunk in the jmarkdown master is in no jmarkdown commit, so
  0.12.1 would ship engine code that exists only in this mirror. Commit it
  upstream (then re-vendor at a clean tree), or say it ships as is.
- **Windows and Linux** builds remain unsigned and never run (as 0.12.0
  shipped them) — a release decision, restated.
- Not blocking (Clew-boss): the GitHub Actions workflow; C2 (citation
  style).

**Risks to clear in the RC run itself:**

- **No Intel build since 0.12.0.** Every dev build (dev.2–dev.18) is arm64;
  the x64 DMG is first built at the RC. Its app should at least boot under
  Rosetta on this Mac (`arch -x86_64` on the packaged binary) — the boot
  test has only ever run arm64.
- **The first release with an update check.** 0.12.0 has none, so its users
  hear of 0.12.1 only from the site; 0.12.1 asks
  `https://clew-app.com/downloads/latest.json`, which Clew-docs uploads
  last (`write-latest-json.mjs`). A missing feed is harmless (a failed check
  says nothing); a feed naming a file not yet uploaded is not.
- Clew-iOS syncs `obsidian-comments.js` (`EXPORT_EXTENSIONS`),
  `texMissingFiles` and `mathFontOnlyWithMaths` — its release, not this
  one, but the shared code is what both ship. For `texMissingFiles` it
  passes `result.texLogBytes ?? result.log`: mp-tikz-wasm has the byte log
  on latex-doc `190ccb1` and byte-joined diagnostics on `662aae9` (CI
  green, unreleased — a release is the owner's call); the pinned 0.5.0
  has the string alone, which under its pdfTeX has already lost a letter
  cut at a line break.

## 4. The checklist

The release recipe in `HANDOVER.md` ("Release recipe") is updated for
0.12.1: what packaging has had to check since 0.12.0 (the pinned
mp-tikz-wasm's STAGED.json and bundles, the demo history, the notices, the
`clew` command) and the packaged-app checks every dev build has run since
dev.13.
