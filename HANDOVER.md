# Handover — 2026-09-02 (office work SETTLED into CLAUDE.md; next: the launch list)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

The whole ZetaOffice arc is DONE and MOVED: punch list (9/9), office
embeds (thumbnail/`|live` in notes and canvases), the Sifr icon splice
and small icons — everything shipped, smoke-verified, documented in the
manual, and its durable architecture now lives in **CLAUDE.md § Office
documents** (written 2026-09-02; trust it, including the teardown
gotchas and the new smoke-harness knobs). Trees clean here and in
../Clew-docs; 408 unit tests green. Recent commits: `2a2a4c4` →
`3bc44bf` tell the story; the "Finishing ZetaOffice" artifact holds the
per-item outcomes. Owner is trialling the Sifr/small-icons look — the
two reverts are independent (size block in zeta-thread.js#loadFile;
vendored zip in vendor/libreoffice-icons/).

## 1. THE PLAN (agreed with the owner, 2026-09-02): launch readiness

The strategic read the owner signed off on: the app needs USERS more
than features. In order — **the next session starts at item 1**:

1. **Atomic vault writes** — `vault.writeNote` (and writePdf/
   writeOffice/saveState/kv-store) are bare `writeFileSync`; a crash
   mid-write can truncate a note. Adopt the `.part` + rename pattern
   (pdf-fonts.js is the in-repo exemplar) across every vault write.
2. **Note history snapshots** — `.clew/history/` keeping the last N
   versions per note (cap by count/age), with a restore affordance.
   Closes the "auto-save ate my paragraphs" gap Obsidian users assume
   is covered. Manual chapter needed (the rule with no mechanism!).
3. **First-run experience** — install the packaged app somewhere fresh
   and look: what does a stranger see, and can they reach the demo
   vault (the de-facto tutorial)? Fix what that shows.
4. **One real packaged run** of the office engine download (verified in
   dev via CLEW_ZETA_DIR; never from an actual .dmg into real userData).
5. **Win/Linux artefacts on real machines** (a VM is fine) — or keep
   them off the download page; untested installers are worse than none.
6. **Big-vault stress** — synthetic ~5k-note vault through indexer,
   search, and query fences; find the cliff before Reddit does.

**Owner's own action, the gate for all of it**: the GoDaddy DNS change
(A records for clew-app.com/.net → 144.126.236.254), then in Clew-docs
`make dns-check` → `provision` → `sync` → `tls`.

## 2. Small residue (none blocks anything)

- Real-keyboard checks inside LibreOffice: ⌘S/Ctrl+S and clipboard
  (synthetic input can't settle them; manual says "toolbar Save").
- office-convert's actual conversion needs a machine WITH desktop
  LibreOffice (refusal paths verified here).
- Restore-boot policy: a workspace restored with a visible office tab
  boots LibreOffice (1.6 GB) at launch — deliberate, unreviewed.
- Rename of an OPEN pdf/office/canvas file leaves its tab pointing at
  the old path (`remapPaths` only handles note tabs) — fold into the
  launch work.
- Kanban-board card drag (write path) — v2 of a shipped feature.
- Smoke scenarios live only in session scratchpads and die with them —
  consider a committed `smoke/` directory of the reusable ones
  (office boot/save/guard, regression) so sessions stop rewriting them.

## 3. Traps for THIS stretch of work

- **Toolbar-click smoke coordinates changed** with the small icons —
  any scenario clicking LibreOffice's toolbar by offset must be
  re-derived (old Save offset ~(60,39) from the dock rect is stale).
- Long smoke runs (double LibreOffice boots) look like hangs from the
  terminal — run them `run_in_background` with output to a file; the
  owner should never watch a silent 90-second pipe.
- Older traps (centered-text suffix, execCommand insertText, blanket
  dist/ gitignore, EmbedPDF shadow DOM, wa.css tokens, Meta Bind morph
  guard, canvas-card CSS) are in this file's git history — still true.

## 4. The owner works in this tree concurrently

The tree was left CLEAN on 2026-09-02: main at `39ac229` + the
CLAUDE.md/HANDOVER settlement commit, Clew-docs at `059a326`. The
gitignored `zeta-assets/` here is deliberate (PROVENANCE.md inside it).
Anything uncommitted you find is NEW owner work — leave it unstaged and
note it here. Never switch THIS tree off main. Live testing flips demo
widgets — reset `status:`/`done:`/`^motto` baselines before committing
demo files.

## 5. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. App settings (theme, autoFill, fillColumn)
  are GLOBAL and persist — smoke scenarios that flip them must restore
  them.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail — and eyeball the artefact anyway.**
- **Verify artefacts by content**, never the log line.
- **Prefer measuring to guessing** — and re-measure.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND the
  EmbedPDF viewer from their masters; `sync-engine` + `sync-embedpdf`
  + `git status` BEFORE tagging.
