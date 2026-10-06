# Handover — 2026-10-05 morning (origin/main 917303b; LOCAL 5a99c9e … cc12894 + this, NONE pushed; dev.8 = abca0bf, boot-tested; book mode phase 1 built)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the live edit design AS BUILT is
`docs/dev/live-edit.md`, the PDF one `docs/dev/pdf-unification.md` ("As
built" under §6). This file is rewritten each session — keep it short, and
prefer deleting a settled item to explaining it again.

## Read this first

**Where the code is.** `origin/main` = `917303b`, pushed 2026-10-04 on the
owner's word via Clew-boss ("Do everything you say that is waiting on me"):
35 commits `f3a7d5b..917303b`, a fast-forward. Local since: `5a99c9e` (demo
updates), `6d64822` + `eb501e4` (book-mode decisions), `96ad97a` HANDOVER,
then book mode (below), NONE pushed — the rule tonight is NO PUSH. `git
fetch` before counting.

**Tonight (2026-10-03 evening, the owner's plan via Clew-boss).** Pushed
first: origin/main = `f3a7d5b` (13 commits). Then, each its own commit,
NOT pushed:
- `bd17b1d` — EmbedPDF fork `7e5d802f` (ocg-v2, LOCAL, only engine.ts):
  getPageTextRects reads each run's text with its length (stale heap bytes
  984/7/5 runs → 0/0/0); re-vendored.
- `686232b` — PDF save safety (pdf-unification.md §7b): a viewer's save
  never overwrites a version it did not load; both versions to history;
  Keep mine / theirs / both side by side / Later. iOS does its native half
  (PDF_WRITE base/force/create, PDF_VERSION_RESTORE).
- `c9e20cd` — docs/dev/book-mode.md, the book-mode DESIGN (no code), 13
  merged owner questions — for the owner to read.
- `4ddda35` — clew:// links + the `clew` command (docs/dev/deep-links.md).
  ◆ main.js now takes `requestSingleInstanceLock()`: one process per
  profile (a second launch hands over its command line and exits).
- dev.4 (0.12.1-dev.4) from `4ddda35` (`out-dev/`): notarized, stapled,
  signature, version, `clew://` in Info.plist and the shipped CLI checked;
  the BOOT TEST NEVER RAN — `boot-test.sh` aborted, load 26 after its
  20-minute wait (Kaspersky's kavd + CrashPlan at ~45% each). Superseded;
  its DMG and blockmap moved to the Trash at dev.7.

**Then the owner's "smaller build" (2026-10-04, via Clew-boss), each its own
commit, NOT pushed:**
- `9d4adb2` — tests: 17 files' fixtures under ONE mkdtemp root each,
  removed in `after`; a full `npm test` leaves nothing in $TMPDIR. The
  one-time cleanup of the old fixture folders was done by Clew-boss on the
  owner's instruction (2026-10-04: 8,906 folders, links removed first, none
  pointing outside; TMPDIR 11,233 → 2,327 entries).
- `17a06c5` — `main/callout-types.js` is shareable (no Node built-in, no
  `process`, the icon table handed in or loaded lazily; `hasCustomCallouts`
  for a host that fetches it); the disk side is `main/callout-files.js`.
  iOS can drop its re-implementation in `src/shim/ipc.js`.
- `8e0640c` — `renderer/lib/device-name.js`: "this Mac / this iPad / this
  iPhone / this computer / this device" (iPadOS = MacIntel + touch points;
  a host may set `globalThis.__clewDeviceName`). iOS can drop its
  trust-banner.js build patch. TeX fragments' "this machine" → "this Mac".
- `f098976` — admonitions.js imports the table beside the worker only when
  one is THERE; else `#jmarkdown/callout-table.js` (iOS can drop its
  admonitions.js build patch). `smoke/admonition-alias-scenario.js`.
- `636c165` — trust-guard-scenario logs the prompt's buttons.
- `042a05d` — an untitled ```ad- fence headed by its type as written
  (below); `0710c6a` — CLAUDE.md's test count (1125).
- **dev.5 (0.12.1-dev.5) from `0710c6a`**:
  `out-dev/Clew-0.12.1-dev.5-arm64.dmg` (231,030,643 bytes), committed
  mirrors only. Notarized (Accepted) and stapled — DMG and app; spctl
  "Notarized Developer ID" both; codesign --verify clean; Info.plist
  0.12.1-dev.5 + `clew` scheme; stale-check matches 0710c6a. Packaged
  runs: demo vault trusted, Flashcards live (card + score); an untrusted
  vault's prompt "Keep restricted | Trust on this Mac"; ```ad-rem →
  remark (custom, #2e8b57, "Rem") in the PACKAGED worker (engine-assets/
  has no package.json — the worker's own table). BOOT TEST PASSED (load
  5.95 after 60 s; figures 13 mpw-ok, cache-probe engine→cache; live edit
  7/7). Before it: npm test 1125/1125; the live sweep at 51615b9
  identical to 4ddda35's but for keystroke timings. `out-dev/` keeps
  dev.3–dev.5; dev.1 and dev.2 (DMGs + blockmaps) moved to the Trash.

**After dev.5 (2026-10-04 morning, via Clew-boss; LOCAL, in NO package):**
- `038ec6f` — a notice never covers a PDF viewer's status chip
  (`renderer/lib/notice-lift.js`; tab: notice ends y 780, chip from 795).
- `52ba4ae` — a clew:// link from a COLD start fills the welcome window
  (was: three windows, the welcome one empty).
- `a374b99` — `clew export` builds a PDF in a temp folder and writes ONLY
  the PDF/.tex/.html; `--out <file|folder>`. ◆ The MENU's PDF export still
  leaves .tex .aux .bbl .blg .fdb_latexmk .fls .log .out beside its output
  (measured) — one argument (`buildApart: true`, ipc.js EXPORT_NOTE) if the
  owner wants it. ◆ Unrelated, seen there: a LaTeX export prints a wikilink
  image `![[x.png]]` literally (the user's config cascade has no wikilinks
  extension) — predates tonight.
- `fe4071d` — demo vault: Live Edit.md describes the Edit source icon, its
  @cref resolves ("equation (1)"), Math and Theorems loads amssymb; BOTH demo
  vaults now build with NO warnings. The render dump lists warning notes
  (`smoke-rdw:`) and masks app frame keys (Apps in Notes differed per dump
  folder).
- `1b3f321`, `cddeba9` — jmarkdown 1bb6c8e (alts/attributes escaped) and
  0b506dc (a `<script>` in INLINE code no longer cuts the paragraph and RUNS
  — found by `ef8577e`'s smoke/code-lt-scenario.js; it ran in a trusted
  vault). The mirror's index.js still carries the master's June uncommitted
  change (Sublime inverse search off).
- `bbd2b8e` frameClick reaches app frames at any depth; `562bcb0` + `c892339`
  live edit RUNS `@app+[…]` and `@begin(app)` (it drew a chip and never ran
  an app); `bfb5208` both modal prompts focus the QUESTION — a focused Allow
  took a typed Space as the answer (measured).
- `8173392` — six sample apps in demo-vault/Apps + Features/App Gallery.md
  (+ Reading/ fixtures): Stock Ticker (network = api.frankfurter.dev ONLY —
  .app now 301s there), Replicator Dynamics Lab, Seminar Picker, Lecture
  Timer, Writing Progress, Reading List. smoke/app-gallery-scenario.js.
  ◆ Platform limit: the app prompt is all-or-nothing (no optional caps).
- `190d6e5`, `79fc986` — `pin=top|bottom` (shared/app-pin.js): sticky's rule,
  by style only (reading: the hoisted holder goes fixed; live: the frame's
  top, from the height map when undrawn; scrollMargins keep the caret
  clear). The gallery's ticker rides along the bottom.
  smoke/app-pin-scenario.js (incl. a `control` without pins: CodeMirror's
  own first-pass settling is identical).
- **dev.6 (0.12.1-dev.6) from `77b0bea`** — the owner's "so I can try the
  apps": `out-dev/Clew-0.12.1-dev.6-arm64.dmg`. Notarized (Accepted),
  stapled, spctl both, codesign clean, 0.12.1-dev.6 + `clew`, stale-check
  matches; the dev.5 packaged checks again (demo/Flashcards, trust prompt,
  packaged admonitions) plus the App Gallery in a COPY of the bundled demo
  vault: six prompts, six apps live, Space does not answer, the ticker held
  along the bottom (bottom-off=0 at the top and middle, in place at the
  end, same frame, loads=0). BOOT TEST PASSED (load 5.75; figures 13 ok,
  live edit 7/7). out-dev keeps dev.4–dev.6; dev.3 (+ blockmap) in the Trash.
- `2619e1c` — the demo vault's new files reach an EXISTING copy (main/
  demo-sync.js; never over a file, never into .clew, a deleted one stays
  deleted). The owner's 1-October copy (no Apps/) was moved to the Trash at
  their word. (Updated files too since `5a99c9e`, below.)
- `7bbfdb1` — Stock Ticker /Live stocks/ (Finnhub): the key in the app
  frame's own localStorage, never app.kv; the `token` query parameter
  (Finnhub's preflight allows no headers — measured). Tested against
  smoke/finnhub-stub.mjs; the real-key check is the owner's (dev.7). Its two
  findings are fixed: the old ticker in the owner's copy (`5a99c9e`) and a
  `network` grant that recorded no origins (`917303b`).
- the untitled ```ad-type fence (Clew-boss approved it as consistency with
  the owner's callout rule): it drew NO heading — the engine heads an
  untitled callout with `untitledCalloutTitle(token.written)`, and an
  admonition token carried no `written`. Now it does: `ad-hint` → Hint,
  `ad-rem` → Rem (as written, as `[!CAUTION]` → Caution). See the commit
  after 51615b9.
- mp-tikz-wasm RE-PINNED to v0.3.1 (2026-10-06, Clew-boss for the owner's
  iOS sync): sha256 24b0cd29… (GitHub's own digest), 44,239,255 bytes,
  confirmed by stage-mptikz's download-and-verify with `MPTIKZ_SRC=
  /nonexistent` — the master (6d89954, 0.3.1+8) would otherwise win, in
  staging AND in packaging, which runs the same script. Against 0.3.0's
  staged tree: 4 files added (latex-extra: epstopdf.sty, epstopdf-base.sty,
  grfext.sty, supp-pdf.mkii), none removed, 13 changed (auto.js, index.js,
  core.js, worker.js, cli.js, index.d.ts, types.d.ts, bundles/index.json,
  bundles/hot.json, latex-extra and luatex manifests, dvilualatex.fmt,
  dviluatex.fmt) — no .wasm. auto.js still reads `data-base` and
  `data-bundles="+opentype"` off a `script[src*="auto.js"]`, all
  figures.js#ensureLoader sets.

**Then (2026-10-04 night, via Clew-boss; each its own commit):**
- `917303b` (PUSHED) — a `network` grant is bound to its ORIGINS
  (`app-grants.js` `networkOrigins`; CLAUDE.md "Apps in notes"): the app CSP
  is the granted hosts the current manifest still names; a new host is asked
  for ALONE and reaches nothing meanwhile; a dropped host is gone at once (the
  registry re-reads a changed manifest, main reloads the app's frames); a
  bare `network` is its own grant, worded "send data to any host on the
  internet"; a grant from before origins were recorded is asked ONCE more,
  because it cannot say what it covered. Measured
  (`smoke/app-origins-scenario.js`): trusted history `A=blocked B=blocked` →
  `A=reached B=blocked` → `A=reached B=reached` → `A=blocked B=reached`, the
  second prompt naming B only, the stubs' log showing B's first request only
  after that Allow; restricted: choice C re-asks everything.
- `5a99c9e` — the demo copy's UNTOUCHED files are updated, not only new ones
  added: `.clew/demo-files.json` v2 records each file's sha256; a file still
  holding the given hash, or ANY version Clew ever shipped
  (`src/main/demo-history.json`, every committed version of every demo file
  — `npm run gen-demo-history`; `scripts/package.js` refuses a stale one), is
  replaced; a changed one is never touched; a deleted one stays deleted. The
  notice lists added AND updated. Measured over demo-vault exactly as 77b0bea
  (dev.6) shipped it, Welcome.md edited: `added=1 updated=4` (the ticker's
  app.js, clew-app.json, index.html and the App Gallery note), the edit
  kept, a second opening quiet. A dry run of the plan against the OWNER'S
  real copy (`~/Documents/Clew Demo Vault`, made by dev.6, no record) gives
  the same five files: dev.7's Help → Clew Documentation brings its ticker
  up to date by itself — and then, the manifest having changed (a new host),
  the ticker asks once for finnhub.io + api.frankfurter.dev.
- **dev.7 (0.12.1-dev.7) from `5a99c9e`** — `out-dev/Clew-0.12.1-dev.7-
  arm64.dmg` (231,051,017 bytes), committed mirrors. Notarized, stapled
  (DMG and app), spctl "Notarized Developer ID" both, codesign clean,
  0.12.1-dev.7 + `clew`, stale-check matches. Packaged runs: demo/Flashcards,
  the trust prompt, packaged admonitions, the App Gallery (six prompts, six
  apps; the ticker's prompt now names finnhub.io), the pinned ticker
  (bottom-off=0, same frame, loads=0), the demo sync over a dev.6 copy
  (`added=1 updated=4`, then quiet; Welcome's edit kept), and Live stocks
  against the Finnhub stub (badges sim,none,open,closed,none; requests=6;
  backoff 3000; the key in no vault file and not in the run log).
  BOOT TEST PASSED (load 5.93 after a 1,240 s wait — mediaanalysisd,
  contactsd and kavd; figures 13 mpw-ok, cache-probe engine→cache; live
  edit 7/7). out-dev keeps dev.5–dev.7; dev.4 (+ blockmap) in
  the Trash. The real Finnhub key is the owner's to paste (Live stocks →
  Key…).
- `6d64822` — docs/dev/book-mode.md: the owner's thirteen answers as §9
  "Decisions (the owner, 2026-10-04)", §2–§8 revised to them. Phase 1 is now
  mostly ENGINE work (per-chapter pages from the start = option A plus a
  split after the one post-pass — confirmed by the engine owner in jmarkdown
  62ae133). Verified by Clew-boss.

**Book mode phase 1, Clew's half (the owner's GO 2026-10-04 night, via
Clew-boss; each commit verified by Clew-boss unless noted; CLAUDE.md
"Books" is the as-built):**
- `8a7f173` — `shared/book.js` (the master reader, chapter title/words/
  status, which books a note is in and shows), the index's `book` entry on
  MASTERS only (CACHE_VERSION 4; demo/study index snapshots byte-identical),
  renames of chapter links.
- `3fe8aa1` — `editor/note-edit.js`: app-host's editNote/editorFor moved
  (prefix `headless-write:`); app-bridge `writes`/`headless` identical.
- `b788cbc` — the harness's `{drag:{from,to}}`.
- `4bc9c04` — the Book panel (tab only in a vault with a master), the
  status bar's "Ch. 2 of Book · also in …", next/previous chapter, demo
  `Books/Signals` + `Guide/Books.md`; `smoke/book-panel-scenario.js`.
- `2c6a6a8` — `book: true` with no `chapters:` key is no master (Clew-boss's
  edge; CACHE_VERSION 5).
- `ab8b993` — engine at-migration@0372f23 (book piece 1: processFile's
  `chapters`), verified by Clew-boss; render dump unchanged.
- `eeb7371` — Build: `main/export-book.js` → `build/<master>.{pdf,tex,html}`
  beside the master; warnings placed by chapter:line, opened from the panel;
  File → Export → Book as …; single-note exports byte-identical;
  `smoke/book-export-scenario.js`. Verified.
- `5a59a4d` — engine at-migration@8b5a1db (book piece 2, numbering),
  verified; `70aa64a` — numbering ALWAYS passed from Clew's reading (the
  engine's `Numbering:` key is case-sensitive — measured), readMaster takes
  the engine's values, an empty `chapters:` is no problem. Verified.
- `a6c44d6` HANDOVER. Then the engine half landed piece by piece, each
  re-vendor from a commit Clew-boss verified, measured by the render dump and
  the single-note export byte checks:
  - `d8e0579` — engine at-migration@5a69dcd (the engine half of phase 1:
    silent equal keys, footnotes per chapter, chapter bibliographies, one
    preamble, macros, Lang, scoped <style>, split HTML, located warnings,
    the cleveref fix; and `<style>` prints nothing in LaTeX — the five demo
    notes with one lose only CSS-as-text from their .tex).
  - `1f960e0` — book HTML as PAGES (`build/<master>/`), the demo master's
    citation keys matching Conventions' (silent), the fixture carrying
    Features/refs.bib: the demo book builds with warnings=0.
  - `a146a98` — the previous pages folder to the Trash before each build
    (Clew owns it; the engine never deletes); in a RESTRICTED vault the pages
    are shown in Finder, not opened (a note's own <script> passes through to
    the HTML — measured; `smoke/book-trust-scenario.js`).
  - `aa63a27` — engine at-migration@cf998a0 (Obsidian links 3d9e65d; the
    master's @bibliography after the last chapter).
  - `be46044` — EXPORTS with the engine's Obsidian links ON via
    `engine/export-worker.mjs` (resolvers the IPC to the engine's worker
    cannot carry); `engine/vault-files.js` holds the preview's own
    resolution, moved out of wikilinks.js (no `vault` global). On for every
    note and book export; NOT for preview, live edit, print PDF, site (Clew's
    wikilinks.js covers those). Guide/Editing.md's PDF compiles (no
    <MINTED>); `smoke/export-links-scenario.js`.
  - `abca0bf` — the demo master ends with `@bibliography`: its PDF reads
    "Lewis [1969]", references.html among the pages.
- **dev.8 (0.12.1-dev.8) from `abca0bf`**: `out-dev/Clew-0.12.1-dev.8-
  arm64.dmg` (231,095,944 bytes signed and stapled). package.js stopped at
  the DMG signature ("The timestamp service is not available" — Apple's);
  its remaining steps were run by hand on the same image: codesign
  --timestamp, notarytool Accepted (08645c70-…), staple DMG + app, validate,
  spctl Notarized Developer ID. Packaged checks (pkgcheck8): dev.7's, plus
  the Book panel, the book build (warnings=0, pages=5 with references.html,
  "Lewis [1969]", no <MINTED>) and the export links (Editing MINTED=0,
  Math's image) — all IN the packaged app. BOOT TEST PASSED (load 5.77;
  figures 13 ok; live edit 7/7). out-dev keeps dev.6–dev.8; dev.5 in the
  Trash. Accepted by Clew-boss; in the owner's morning brief.
- After dev.8 (verified unless noted): `16f4b7c` — an embedded image's
  path RELATIVE to the file written, never absolute (it leaked the home
  folder); `6ab62ae` — `latexmk -g`, so an unchanged note re-exports (it
  failed "no PDF was produced" in a later session — pre-existing, found
  measuring 16f4b7c; approved fix); `cc12894` — for LaTeX the image's real
  path too (a vault through a link). The last two await verification.
- BOOK embeds chapter-relative (2026-10-06): engine at-migration@ad0f0d4
  (283cd30's `resolveEmbed(name, { file })` and a book's LaTeX paths
  rebased onto its .tex; 60d8b95/7aa59b0/ad0f0d4's `&`/`#` escaped once in
  list items and the blocks nested in them), and the worker answers a
  book relative to the chapter. Measured: the `export` fixture (Conventions
  moved to Essays/More/, two chapters embedding one image) → `embeds
  html=["../../../../Attachments/NASA%20-%20Earthrise.jpg"] tex=["../../../
  Attachments/NASA - Earthrise.jpg"] absolute=false`, two images in the
  PDF, no vault path in the PDF even uncompressed (only latexmk's .fls and
  .fdb_latexmk name it); a book folder reached through a symlink gives the
  physically right count (4 `..`, not 3) in the .tex. 3d9e65d STAYS (the
  owner, 2026-10-06: optional rules off by default are fine).
- ◆ Reported to Clew-boss 2026-10-06; it does NOT block `be46044` (main
  waits only on the owner's push word). The engine fixes — relative cached
  diagram paths in LaTeX, a build warning when mmdc fails — are with
  jmarkdown; WHERE the caches are created is a design question with the
  owner: change nothing for it yet. FIXED in the engine by jmarkdown
  ff87858 (vendored 2026-10-06): cached diagrams relative to the .tex, a
  failed mmdc a build warning, adjustbox `export` (`max width` stopped every
  diagram export). Measured: Diagrams.md exports and compiles from the
  menu, no vault path in .tex or PDF. `clew export --pdf` (built in
  os.tmpdir(), /var → /private/var) climbed out to /private with ff87858's
  LEXICAL path — both diagrams draft boxes — until jmarkdown dc36e9b
  counted .tex-relative paths between REAL folders (Clew-boss's option (a):
  the engine only, no guard in the worker). Measured through the real
  command (`cli-scenario.js`, `cli-wait.txt` 150000): Diagrams.pdf, 6 pages,
  3 figures drawn, no vault path; the worker's book branch is now the plain
  chapter-relative answer (the engine's real paths would otherwise be
  counted twice), the symlinked-book probe 4 `..` with its images. Before
  ff87858: the
  engine named `:::mermaid`, `@begin(mermaid)` and
  `@begin(metapost)` PDFs by ABSOLUTE path in a LaTeX export — its cache
  is `<note's folder>/mermaid/` and `…/MetaPost/` (a book's: the master's),
  INSIDE the vault, created by the export. Under pdfLaTeX the PDF carries
  it too (`/PTEX.FileName`); under LuaLaTeX only the .tex. Clew's ```mermaid
  and ```metapost fences never reach it (preview-only: they export as code).
  The demo's Features/Diagrams.md hits it (lines 18, 122). Pre-dates
  3d9e65d.
- ◆ With the owner (via Clew-boss): single-note `<MINTED>` remedies are
  moot for wikilinks now (links on), but plain Markdown `../` images in an
  export saved away from the note still miss (logged by Clew-boss as an
  existing limit); inline code `#` prints as `\#` (for jmarkdown).
- Scratch worktrees: none left (`wt-export`, `wt-rel` removed).

**After dev.3 (local, NOT pushed, NOT in any package):** `3031a15` — the
live preview pane never covers the block being edited, takes no pointer
events, and a failed figure shows its first error mapped to the fence line
(the owner's critical report; live-edit.md §5.12); `4a5a60a` — an "Edit
source" icon on every rendered block in live edit, the thin bar gone
(§7.7). ◆ Open, pre-existing, reported: a live-edit frame whose render
returns after its block scrolled away is appended hidden at the iframe
default 150 px until drawn again (live-blocks `content=79 frame=150` on
far-down mermaid frames, when timings shift; reproduced without 4a5a60a).

**Since the push (local, NOT pushed):** `4bbee43` HANDOVER; `5f870b2` the
engine re-vendored at `at-migration@a7de8c6`; then **Clew switched to the
engine's callouts** (CLAUDE.md "Callouts are the ENGINE's"): Clew's own
callout extension and `shared/custom-callouts.js` retired, the table from
`#jmarkdown/callout-table.js`, unknown `[!type]` drawn as a note, untitled
callouts headed as written, `suggestion`, single-note HTML/LaTeX exports
render callouts (custom types via CLEW_CALLOUTS).

**Then:** pushed `0423008..67311b6` on the owner's word (2026-10-02);
`2f0ad5c` admonitions' fallback import for iOS; `0b4b7a4` PDF via LaTeX
picks its engine (`main/latex-engine.js`, setting `latexEngine`); then the
engine re-vendored at `at-migration@aa4ce1e`, fixing both findings reported
upstream (a callout broken across pages keeps its strip and tint; every
LaTeX image route goes through the new `latex-graphics.js`, so an SVG with
no sibling, or a URL, becomes a link). LaTeX-only: render dump identical.
It was the pin for iOS sync #4; iOS copied it (sync5-p1-vendor
`c2a5512`, verified byte-identical by Clew-boss), so main is free to move.

**Frame bridge, tonight (owner's approval 2026-10-02, phases 1–4).**
`832b6f5` the design revision R1–R3 (Clew-boss approved it as the basis for
phase 3: choices A and B yes, D measured first, C = pin an app's code hash
in a restricted vault whenever it holds `network`). Then `6623303` phase 1,
vault trust (§4) — see CLAUDE.md "Vault trust" and frame-bridge.md §4.9a;
`e8c4738` + `fb32347` phase 2, the app page on `clew-app://app` and every
postMessage naming its target's origin; `88b6dd2` the stamp library
vendored (no jsdelivr request, the owner's option 1); `1f99cdd` phase 3 and
`ecb5ff6` phase 4, apps in notes read and write (frame-bridge.md §7–§10 "as
built"). Each measured from worktrees: render dump identical outside the
engine's inlined stylesheet, PDF sweep identical, app batteries as expected,
no `smoke-net:` line. Then `888bf25` the symlink check (a restricted vault's
links out of itself are not followed — realpath, `engine/vault-bounds.js`);
`4aeca69` engine `at-migration@4ab3d6a` (tabbing is the engine's, footnote
labels numbered in live edit); `036befe` the update check v1
(`docs/dev/auto-update.md` §7). Then **quote-and-cite from a PDF**
(FEATURE-IDEAS #2; live-edit.md §5.15a): select text in any PDF viewer →
"Quote in note" in the viewer's own selection menu, or `pdf:quote-selection`
(⌥⌘Q, Edit menu) → a blockquote, `\cite[p. N]{key}` (the entry whose `file`
is this PDF; a picker otherwise) and `[[x.pdf#page=N|PDF p. N]]` at the
cursor of the note being edited.

Then `4921cc1` quote-and-cite, and (A) **a website export publishes no
private state**: `main/site-files.js` leaves out `clewdata.json` and every
app's `data/`, and an `@app` becomes a sentence on the static page.
Then **engine `at-migration@e7cf638`**: a note's Bibliography ADDS to the
vault's (citation-header.js mirrors it: noteBibFiles, YAML lists,
`Bibliography mode`; export BIBINPUTS gets every bibliography's folder);
escapes print as themselves (`\$` out of MathJax's reach — pdf-quote.js now
writes `\$`); the LaTeX-export lint shown as a quiet "⚠ N" in the status bar
and in an export's notice (renderer/build-warnings.js); `{-}` and generated
headings unnumbered (live/numbering.js; the crossref parity is now strict).
Then **desktop edit-conflict safety** (Clew-iOS CONFLICT-SAFETY.md items
1–4; CLAUDE.md "Edit-conflict safety"): main's write guard, the pool's hold
with both versions in history first, Keep mine / theirs / both / Compare,
Dropbox copies and git markers. Item 5 (iCloud's NSFileVersion on the Mac)
needs a native helper — later, with the owner.
Then engine `at-migration@455cb61`: exports pass the vault's bibliography to
their build (processFile's `bibliography`), so a note citing only the
vault's file exports resolved.
Then (B): Settings → This vault has an "Apps" subsection (the pointer every
app refusal, the demo's Flashcards and the guide give is now true).
Then (C): apps get `note-changed` and `grant-changed` (live, no reload), a
"✎ … can edit notes" status-bar indicator while a write-granted app is live,
and Settings lists each app's live embeds (frame-bridge.md §9b).

**Queued by Clew-boss:** the books' relative embed paths once jmarkdown's
`{ file }` + LaTeX rebasing is verified; NO push until then. The test fixtures are tidy: every test
file keeps its fixtures under one temp root removed after it (`9d4adb2`,
app-calls' before it), and the old ones are gone (Clew-boss, 2026-10-04).

**The rules this session works under** (the owner's, relayed by the
coordinating session "Clew-boss", uds `/tmp/cc-socks/6958.sock` at the
time of writing; find it with ListAgents):

- **Pushes on the owner's word in this window, OR on Clew-boss's
  instruction** (the owner, 2026-10-03, here). The harness allows exactly
  `git push origin main` (the owner's /permissions rule). Before pushing:
  a clean tree, a fetch, and a fast-forward. Report the new origin/main.
  Never force-push. Clew-app only.
- **Packaging on Clew-boss's instruction** (the owner, 2026-10-03, here:
  "Package when Clew-boss instructs it"). The recipe only: a bash script, a
  clean tree, signed and notarised, then notarytool/stapler/spctl, the
  build stamp and boot-test.sh. Nothing published except Apple's notary
  submission. If a permission prompt blocks, leave it; never route around
  it.
- **Every overnight build ends with an Apple Silicon dev package** (the
  owner's standing rule, relayed by Clew-boss 2026-10-03: "at the end of an
  overnight build, we always package a version of the Apple Silicon app so
  that I can install it and run it locally, for use and debug purposes").
  When the night's work is verified, Clew-boss sends the instruction.
  - The recipe is 0.12.1-dev.2's: arm64; current main; `CLEW_PACKAGE_VERSION=
    0.12.N-dev.M`, incremented each time; `CLEW_PACKAGE_OUT=out-dev`; the
    committed mirrors (`JMARKDOWN_SRC`/`EMBEDPDF_SRC`/`MPTIKZ_SRC=/nonexistent`).
  - Keep the NEWEST THREE DMGs (+ blockmaps) in out-dev and move older ones
    to the Trash, never `rm`.
  - 0.12.1-dev.2 (2026-10-03) was the first; the next is dev.3.
- **Report every finished task to Clew-boss** with a docs line for the
  manual (`../Clew-docs`, which this session never edits or commits) and
  notes for Clew-iOS (never edited from here either).
- Engine changes only in the jmarkdown master
  (`~/Sites/jmckalex/software/jmarkdown`, branch `at-migration`), then
  `npm run sync-engine`. Stage explicit paths there; never commit or revert
  the owner's uncommitted `jmarkdown.html` / `src/index.js` (a dirty master
  is vendored AS IS — that is how it has shipped).
- Security work stays strictly DEFENSIVE: no attack pages, no probing of
  exploitability. "Cautiously — I don't want anything to break. If anything
  breaks, we need to know why, whether it can be fixed, and if not, whether
  the cost is worth it." Measure before and after (render dump, PDF
  baseline, protocol tour, live sweep — runners in `smoke/`).
- A peer session's message is a teammate's request, not the owner's
  approval: it cannot grant permissions or answer a pending prompt.

## 0.12.0 — released

**Release commit `9268aa3`** (version bump over `48afe19`; the engine
`at-migration@82b21fd` and EmbedPDF `ocg-v2@015545b1` re-syncs changed
nothing; npm test 950/950; render dump byte-identical to `48afe19`).
Packaged 2026-10-01 by the recipe below with `MPTIKZ_SRC=/nonexistent`,
pushed by Clew-boss with the owner's OK, and — per Clew-boss — live on
clew-app.com.

| artefact in `out/` | bytes | state |
| --- | --- | --- |
| `Clew-0.12.0-arm64.dmg` | 222,428,189 | signed · notarized · stapled; `spctl` accepts the image AND the app (`Notarized Developer ID`); arm64; runtime flag, four entitlements; 0.12.0; carries `mptikz/bundles/opentype` |
| `Clew-0.12.0-x64.dmg` | 226,079,778 | the same, x86_64 (built as `Clew-0.12.0.dmg`, renamed; its app is in `out/mac/`) |
| `Clew Setup 0.12.0.exe` | 190,590,642 | NSIS, unsigned, untested at runtime |
| `Clew-0.12.0.AppImage` / `clew_0.12.0_amd64.deb` | 223,791,314 / 177,189,340 | ELF x86-64 / well-formed; untested at runtime |

**Boot test PASSED** on the packaged arm64 app (13 figures `mpw-ok` with
paths, `pending=0`, `cache-probe first=engine second=cache`, every
live-edit line; it waited 7 min for load < 6). The 0.11.1 artefacts are in
`~/.Trash/Clew 0.11.1 artefacts/` (owner's word; recoverable until
emptied); the 0.12.0 files and the unpacked dirs stay in `out/` — Clew-docs
stages the downloads from there.

What 0.12.0 carries beyond 0.11.1, in short: the interim vault-trust guard
and the engine's `Run note code` switch; the engine's `func(…)` fix; PDF
unification phases 1–4 (portal thumbnails, a note's own PDF frames, web
PDFs read-only through a device cache, `plugins: true` gone with vault-PDF
navigations redirected to EmbedPDF and the `![[x.pdf]]` placeholder made
inert); Meta Bind `locked` widgets and Enter-to-commit; the export-refresh
and two-window watcher fixes; the smoke harness waiting for its window;
iOS sync #3's upstream fixes (kanban columns border-box, fs-utils without a
`process` global, web-PDF failure texts).

## Since 0.12.0

Everything below is PUSHED (origin/main `0423008`, 2026-10-02), oldest
first — each reported to Clew-boss with docs lines and iOS notes:

- `f17c531` **citation pills read what reading mode shows**
  (`live/cite-text.js`, one block render per note) and the hover's **Show in
  Library**; `3ef9c4f` an engine "[undefined]" is no text; `a1d8de0`
  **reading mode follows a .bib edit**; `1b98e07` explorer **Open in Default
  App**; `a0bcd2b` dark text `#e8e8e8`; `63c5ade` font smoothing `auto` (the
  owner's pick); `2a853da` `CLEW_PACKAGE_VERSION` / `CLEW_PACKAGE_OUT`.
- `f504e57` `\fullcite` draws the entry inline; `95750a5` live edit's
  callouts match reading view's box; `914c3f8` a directive the engine takes
  literally (`@reveal[http://…]`) keeps its source raw.
- `b0fe140` mode buttons in every view — SUPERSEDED by `80b8b44` below.
- `0f797eb` **engine `at-migration@3134543`**: /italic/ has flanking rules
  (slashes in words, paths, URLs stay literal) and bare http(s)/ftp/www/
  email URLs are links; `jmarkdown-scan.js` mirrors the rule (parity test),
  live edit draws bare URLs as links (`jmd/ftp-autolink.js` for ftp).
  Six demo-vault guide notes render differently — every diff is the fix.
- `096f129` **custom callout types** (Settings → Callouts; CLAUDE.md has the
  design). Also fixed there: a live-edit block frame that reloads after an
  engine reconfigure showed "Not found" (re-pointed on load).
- `80b8b44` **the view-mode switch is in each pane's tab strip** (left of
  "+", hidden in place for tabs with no modes; no slim bar; the toolbar's
  one-row threshold 1080 → 984 px). Also fixed there: the formatting
  toolbar vanished from every split pane but the newest.
- The commit after `5ae29b4`: **the split reconciler moves only what moved**
  (`clew-workspace.js#place`, `moveBefore`, `connectedMoveCallback`; CLAUDE.md
  "Panes are moved, never re-appended"). Every layout change used to
  re-append every pane: other panes' frames reloaded on a mode switch, and a
  pane's own mode switch jumped its scroll. `smoke/split-stability-scenario.js`.
- Then: **opening is serialised** (`editor/pool.js#open` waits for an open
  under way; `setMode` checks the state's own compartment; `state-replaced`
  re-applies a host's mode; deferred live-field reads tolerate absence).
  Clew-docs' repro — note + PDF opened and split in one tick left an EMPTY
  pane or live edit undrawn. `smoke/open-race-scenario.js`.
- Then: **no smoke run on a stale build** — `dist/build-stamp.json` (content
  hashes of `src/`) checked by the harness, the sweeps and boot-test.sh
  (`scripts/stale-check.mjs`). The 0.12.0 package predates stamps, so
  boot-testing it needs `BOOT_TEST_ALLOW_STALE=1`; 0.12.1-dev.1 carries one
  (verified). NEVER `asar extract-file` in the repo root — it writes into the
  cwd, and overwrote package.json once; use `asar list` or a temp dir.

Owner decisions Clew-boss is carrying (2026-10-02): HTML/LaTeX note exports
render NO Obsidian callouts (built-in or custom; only uppercase GFM alerts
become boxes) because they run the user's own config; Obsidian draws an
unknown `[!type]` as a default callout and reads callout CSS snippets —
Clew does neither. Report only; nothing built.

**Quote-and-cite's printed page** (item 2, owner-approved 2026-10-03,
local): the cite names the page the article prints, the link the PDF's
(live-edit.md §5.15a). EmbedPDF fork commit `9ab07c9a` (ocg-v2, NOT pushed;
only its six files — the owner's pdfium-src change untouched) adds
`getPageLabels`; Clew re-synced. Measured on copies of seven of the owner's
PDFs, 14/14 pages right, three identical runs. ◆ For the owner: upstream
EmbedPDF's `getPageTextRects` returns text that runs on into stale wasm
memory (`FPDFText_GetBoundedText` writes no terminator; it is read with an
unbounded `UTF16ToString`) — Clew avoids it; a one-line fix in the fork
(read with the length) is theirs to choose.

## Open — waiting on the owner

As relayed by Clew-boss on 2026-10-01; none is to be started without the
owner's word.

- **LaTeX export** — the engine's fallback for an unknown lexer, if
  `4aeca69`'s pygments-lexers did not settle it (LuaLaTeX when a note
  needs it is built: `0b4b7a4`).
- **Tabbing** — `|*` and the fidelity items (the backport to jmarkdown is
  done: `4aeca69`).
- **The deferred code review** (`/code-review ultra`; the owner triggers
  it, never a session).
- Two older offers awaiting a yes/no: parallelise `live-sweep.sh` (per-run
  `CLEW_USER_DATA`; ~8 → ~3 min) and/or drop `live-perf` from the default
  sweep; a distinct theme colour for `jmd-function` in highlighted fences.

## Open — engineering

- **The owner's QA pass of live edit** (not automatable): typing at speed in
  a long note; ⌘Z across a conceal/reveal; ⌘F over concealed text; copy/
  paste of concealed ranges; IME in a concealed word and in a table cell;
  zoom; a live pane beside a reading pane; drag-drop an image; properties
  panel and widget on one note; fast typing in a wide table's cell. The
  §12 defaults in `docs/dev/live-edit.md` are in force and unexercised.
- **PDF annotations**: closing a viewer can no longer lose them, except on
  a window RELOAD (the app page itself goes) and a canvas embed's
  morph-failed reload — not covered.
- **Web PDFs Clew cannot recognise** (no `.pdf`, no `type="application/
  pdf"`, e.g. arXiv's `/pdf/…`) still open in Chromium's own viewer: in
  Electron 43 there is no switch that retires it (pdf-unification "As
  built").
- An `@label` reference inside a footnote is NUMBERED since jmarkdown
  4ab3d6a (vendored 4aeca69): crossref-scenario reads "1" for it, engine
  and Clew alike (2026-10-06); and the Endnotes heading is unnumbered under
  `Headings: numeric` since jmarkdown b212e82 (the same run: prefixes
  1., 1.1., 1.2. and no endnotes target, engine and Clew alike).
- **Not investigated, older than live edit**: `figures-edit-scenario`
  phase 3 — an edited ```tikz in READING mode keeps its old picture. Re-run
  at `ed2aabc` vs `main` on a quiet machine before believing machine or
  code.
- **Follow-ons deliberately left out** (live-edit §12): table drag handles,
  multi-cell selection and grid paste, Meta Bind widgets in prose, frame
  heights persisted across reopenings, block drag handles, a focus mode,
  per-note MathJax, multi-file cross-reference numbering for
  `jmarkdownProject` vaults.
- **Superseded branches** (their work landed rebased, so `git branch -d`
  refuses them and `-D` is safe; the owner decides): `watcher-budget`,
  `meta-bind-lock`, `pdf-web`; also the merged `feat/live-edit`,
  `feat/excalidraw`, `spike/embedpdf`.
- Older items, unchanged: the `[text]` link face and the `\[
  \begin{align*} … \]` manual line (offers); the graphicx driver line for
  mp-tikz-wasm; Windows and Linux artefacts untested at runtime; the
  Windows installer unsigned.

## Release recipe (as cut for 0.12.0)

`npm version <v> --no-git-tag-version` + commit; `npm run sync-engine` and
`npm run sync-embedpdf` (expect no change; `git status` after); npm test;
`smoke/render-dump.sh` before and after the bump. Then, SEQUENTIALLY (they
share `dist/` and the staging dirs), from bash or exactly as written — a
zsh loop passing `$flags` hands package.js ONE argument and it quietly
builds an unsigned `dir` (2026-10-01, caught a minute in):

    export MPTIKZ_SRC=/nonexistent   # stage the PINNED mp-tikz-wasm
    node scripts/package.js --dmg --sign --notarize          # arm64, ~20 min
    node scripts/package.js --dmg --sign --notarize --x64    # ~20 min
    mv out/Clew-<v>.dmg out/Clew-<v>-x64.dmg                 # + its .blockmap
    node scripts/package.js --win                            # < 1 min
    node scripts/package.js --linux                          # < 1 min
    smoke/boot-test.sh out/mac-arm64/Clew.app/Contents/MacOS/Clew

Check the arm64 log for `signing … Developer ID Application` in its first
minute. Verify: `stapler validate` + `spctl -a -t open` on each image (after
the rename — it does not touch a stapled ticket); `spctl -a -t exec`,
`codesign -dv`, the entitlements, `lipo -archs`, the version and
`mptikz/bundles/opentype` on each app. The boot test waits for load < 6
(raise `BOOT_TEST_WAIT` after packaging; Spotlight and the scanners read the
new gigabyte) and ABORTS rather than run on a busy machine.

## Owner's own actions

- Empty the Trash folders when sure: `Clew 0.11.1 artefacts`, `Clew 0.11.0
  artefacts`, `Clew older builds`.
- Live in live edit for a week (`newTabMode: 'live'`), run the QA list, and
  decide the §12 defaults.
- Answer the offers above; file the engine footnote bug upstream (one line).

## What the live-edit build taught (measured; the long form is in `docs/dev/live-edit.md`'s "As built" notes)

- CodeMirror DOES call `WidgetType.updateDOM` when a block widget's text
  changes (the cell editor is the same element across typing — the whole
  in-place table design rests on it); it does NOT let ArrowUp/Down enter a
  block widget — `live/keys.js` stops the cursor at a block's edge.
- `cm-widgetBuffer` images lift a concealed heading's line by 1 px unless
  put on the baseline; heading SIZE lives on the line, not the span.
- The note editor's theme rules are descendant selectors and reach a nested
  editor (a one-line table cell stood 40vh tall).
- A frame element's `color-scheme` must match its document's or Chromium
  paints an opaque backdrop; 16 block documents cost ~22 MB each over
  reading mode; the drawn margin can hold more small frames than the cap,
  so eviction ranks undrawn, then off-screen, and never creates past it.
- `render-service` keyed non-dependent fragments by text alone, so after
  `reconfigure()` the same text kept its hash and a morph was skipped;
  every fragment key now carries a configuration generation.
- Per keystroke, live edit adds ~0.4 ms on a 12 KB note and ~2.2 ms on a
  207 KB one (medians 3.5 / 14.4 → 3.1 / 14.7 ms after the night's work).
- `\|` inside a table cell, `Term:: definition`, `/*italics*/`, headerless
  tables, a footnote label's number: in every case the rule is **the editor
  follows the engine** (owner, 2026-09-27) — read the vendored source,
  assert parity, never the plan's contract.
- `figures-edit` phase 3 is the one sweep failure and predates the branch.

## Small residue

- `fence-highlight-scenario.js`'s header expects `jmd-string > 0`; it is 0
  at `ed2aabc` too (stale expectation).
- A ⌘-click on the GAP between two paragraphs in reading mode does nothing
  (the client wants a stamped ancestor); pre-existing.
- An embedding canvas card is keyed by the file epoch now (re-renders after
  any file change) — an improvement, noted as a behaviour change.
- Source mode's overlay does not fully follow `normalSyntax` (the grammar
  does).
- `editor-hotkeys-scenario`'s reflow widths follow the REAL fill column
  unless `CLEW_USER_DATA` is set ([79,40] on this machine — not a
  regression).
- The owner works in this tree concurrently; `zeta-assets/`,
  `mptikz-assets/`, `build-engine/` are deliberate and gitignored. Live
  testing flips demo widgets — reset `status:`/`done:`/`^motto` baselines
  and the foldable embed in `Guide/Links and Embeds.md` before committing
  demo files.

## Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths. Across ~50 commits by two
  sessions this time, every one did; keep it that way.
- **A build order is the owner's to approve.** A question plus a statement
  of intent ("what should we build? I'd like to launch something") is not
  an instruction to launch; write the brief, show it, wait for the yes. An
  idle session cannot be woken by a message — only its owner's prompt or
  its own task notifications do — so a queued brief runs when they next
  type, which is why the sign-off matters.
- **Reviewing another session's commits:** extract each commit with
  `git archive <hash> | tar -x` into scratch, symlink `node_modules`, run
  the tests and the build THERE (the worktree's dirty state and its
  node_modules answer for nothing); read the scenario's own `[smoke:info]`
  lines out of its transcript rather than its summary; grep its transcript
  for `git push`, `git add -A`, `vendor/` and main-tree paths. Two real
  corrections came out of that this time (a missing restale trigger, a
  `<br>` drawn as text); every deviation it took by itself was better than
  the plan.
- **A SIGNED build must be boot-tested, not just verified.** `codesign
  --verify` proves the signature and says nothing about whether the app
  runs. The hardened runtime is exactly what breaks this one — the forked
  render worker needs `allow-dyld-environment-variables`, the wasm TeX
  needs `allow-jit` + `allow-unsigned-executable-memory`, the unpacked
  engine tree needs `disable-library-validation`. Run the PACKAGED binary
  under `CLEW_SMOKE` with an isolated `CLEW_USER_DATA` and assert a latex
  figure reaches `mpw-ok`.
- **A wait-for-quiet loop must ABORT on its timeout, never proceed** — the
  one that "gave up waiting" launched at load 14.71. `smoke/boot-test.sh`
  is the recipe; do not hand-roll another.
- **…but do not run the figures check on a busy machine.** The mp-tikz-wasm
  watchdog fires after 20 s with no progress from a worker; straight after
  a packaging round (load ~25 measured this time) it reports `mpw-error: …
  made no progress` on figures that are fine. A figures timeout is a claim
  about the machine until a quiet re-run agrees with it.
- **`spctl -a -t exec` on a signed-but-unnotarized app says `rejected —
  source=Unnotarized Developer ID`, and that is fine** (no quarantine flag on
  a locally built bundle). After notarizing, image and app both report
  `accepted — source=Notarized Developer ID`.
- **`--notarize` requires `--dmg`**; `scripts/package.js` blanks the Apple
  env for its child unless asked. Budget ~12 min of signing per
  architecture, double for universal, plus Apple's queue (~5 min).
- **Files on a server are not a site being served**; `make dns-check`
  answers the question that matters.
- **A vault is whatever folder the user points at**, and some contain
  libraries: every walk consults `vault-excludes.js`, and anything that
  enumerates a vault lives inside a bound (`WATCH_BUDGET`, explorer
  windowing, the frame cap). A resource cap must not become a CORRECTNESS
  cap: bound the bulk operation, not the session.
- **Check the baseline before believing a timing.**
- **Smoke runs are invisible** (no window, no focus, no Dock icon; focus is
  emulated over CDP) — `CLEW_SMOKE_VISIBLE=1` to watch one. A scenario
  that needs the OS's own focus or a visible window must say so; none did
  (2026-09-29, checked over the live sweep and the shell, toolbar-menu and
  canvas runs).
- **A smoke run's ENV is the whole safety net** — build the whole command,
  env and all, in ONE go; always pass `CLEW_SMOKE_VAULT`; `CLEW_USER_DATA`
  isolates a run and is where a scenario's GLOBAL settings are staged;
  `git status` the demo and study vaults after every run.
- **A scenario must not assume a fresh workspace** (tab layout, mode, the
  shell panel's open flag are per vault in `.clew/workspace.json`); set the
  state you need, then drive. **Fixed screen points drift** — reading
  mode's 36 px mode bar moved a ⌘-click into a paragraph gap; click on
  text, not on luck.
- **A scenario's own listener is registered too late for boot events** —
  assert on the DOM.
- **A path already open is FOCUSED, not duplicated**; over a big vault wait
  for `vaultStore.vault` AND a beat for the workspace to restore.
- **Observations must wait on conditions, not on a clock.** Input starts
  only after the scenario RETURNS. **The frame script runs against whatever
  preview is open when the scenario ENDS** — or, with
  `CLEW_SMOKE_FRAME_MATCH=<substring>`, in every `clew-preview://` frame
  whose URL contains it (block frames: `__clew_block__`).
- **A typeset figure no longer holds its source in the DOM** — read
  `<vault>/.clew/cache/html/<hash>.html`; `data-preamble` survives on the
  element. **The preview document has its OWN palette** (`--preview-bg`, …).
- After a smoke run over a reusable fixture, `rm -rf` its `.clew/`; a
  scenario that TYPES rewrites its fixture — regenerate before every run.
  Long runs go `run_in_background` to a file, never in a `( … ) &`
  subshell. **A smoke timeout must wrap Electron itself** (`perl -e 'alarm
  shift; exec @ARGV' N …/Electron .`); `ps -axE | grep <vault>` finds a
  stray by its env. Reusable scenarios live in `smoke/`; the README table
  carries each one's assertions; `smoke/live-sweep.sh` runs the live set.
- **A native menu is invisible to `capturePage`** — `CLEW_SMOKE_MENU=1`.
- **A face cannot un-parse a node** — fix the GRAMMAR. **In a lezer inline
  parser, `before:` is the whole design** (`Escape` is first and eats `\(`;
  `Link` builds a node whether or not a definition exists).
- **Block replacements and anything spanning a line break come from a
  StateField; a ViewPlugin's decorations stay on one line** — the rule
  every live-edit provider is built on, and the reason multi-paragraph
  footnotes were left as source until the field took them.
- **The owner's bug reports have been consistently right** — and so are
  their rollbacks and their rules ("the editor follows the engine").
- **Write assertions that can fail — and eyeball the artefact anyway.**
  Computed style, not markup, when the bug is layout. **A measured symptom
  is not a cause** — vary the construct. **Prefer measuring to guessing.**
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it and the demo vault EXERCISES it — nothing in this repo's git
  status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND EmbedPDF from
  their masters (a dirty master is vendored AS IS — `git diff --stat
  vendor/` after the sync says what would ship); packaging stages
  mp-tikz-wasm, preferring the master unless `MPTIKZ_SRC` points elsewhere.
  Run the syncs + `git status` BEFORE tagging.
- Screenshot-kit lore: splitting re-parents the editor and RESETS its
  scroll; CDP keystrokes need the caret's viewport coords for the focusing
  click; `CLEW_SMOKE_LOG=1` prefixes scenario `console.log` with
  `[smoke:info]`; the harness input queue takes `click`, `tripleClick`,
  `text`, `combo` (with `text` to type), `wait`, `wheel`, `move` (with
  modifiers) and `frameClick`; `CLEW_SMOKE_MENU_CLICK` clicks a real menu
  item.
