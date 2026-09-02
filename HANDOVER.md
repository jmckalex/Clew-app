# Handover — 2026-09-02 (launch list: 6/6 worked; what's left is owner-side)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

The whole launch-readiness list from 2026-09-02 was worked in one
session. Commits `5b70193` → `28af145` here, `7bc52fa` + `e618ed9` in
../Clew-docs. 423 unit tests green; every feature smoke-verified with
artefacts eyeballed.

1. **Atomic vault writes — DONE** (`5b70193`). `writeFileAtomic` in
   fs-utils.js (dot-temp + fsync + rename, symlink-following,
   mode-preserving) behind every durable write. Measured: the rename
   reaches chokidar as a plain 'change', so nothing downstream moved.
2. **Note history — DONE** (`22c59b4`). `.clew/history/` snapshots
   (5 min interval / 40 versions / 60 days, newest always spared),
   "View note history…" browse-and-restore modal, per-vault `history`
   setting (default ON), manual chapter + guide-note section shipped.
3. **First-run — DONE** (`dd703e7`). The packaged app ships the demo
   vault (Resources/demo-vault), copies it to ~/Documents/Clew Demo
   Vault on first use; welcome screen gained Create new vault… +
   Explore the demo vault; Help → Clew Documentation works installed;
   a vault with no saved workspace opens its Welcome.md. Verified on
   the real packaged .app against fresh userData (`CLEW_USER_DATA` —
   HOME alone does NOT isolate Electron on macOS).
4. **Packaged office-engine download — DONE.** Real CDN download from
   the packaged .app into (isolated) userData: 5 files hash-verified,
   brotli twins on disk, LibreOffice booted, docx opened
   (smoke/office-download-scenario.js). Not literally run from a
   mounted .dmg into the owner's real userData — same code path; do
   that once by hand if you want the last inch.
5. **Win/Linux artefacts — BUILT, NOT RUN.** `Clew Setup 0.9.0.exe`,
   `.AppImage`, `.deb` all build with today's changes (demo vault
   verified inside both unpacked trees). Runtime on real machines
   still untested — keep them off the download page until a VM run, or
   say "untested" next to them. This is the one genuinely open item.
6. **Big-vault stress — DONE, no cliff.** 5003 synthetic notes: cold
   index 412ms / warm 64ms; search 1–6ms; query dashboard ~1s first
   render, ~1.5s save→requery (600ms debounce included); ~800MB total.
   Kit + baseline in `smoke/README.md`. Honest cost, not a cliff: any
   save re-renders every open query dashboard (~1s of worker per save).

**Owner's own actions, unchanged**: the GoDaddy DNS change (A records
for clew-app.com/.net → 144.126.236.254), then in Clew-docs
`make dns-check` → `provision` → `sync` → `tls`. Plus item 5's VM run
if the Win/Linux artefacts are to ship, and the Sifr/small-icons
verdict (still untried; the two independent reverts are documented in
git history — size block in zeta-thread.js#loadFile, vendored zip in
vendor/libreoffice-icons/).

## 1. For the Clew-iOS catch-up session (owner is starting one now)

This session changed ON-DISK CONTRACTS and SHARED MANUAL text that the
iOS app must either match or consciously diverge from. The manual in
../Clew-docs serves BOTH apps — that is why it lives outside each repo.

- **Note history is a new vault-level format.** Layout mirrors the
  vault: `.clew/history/<note path>/<stamp><ext>`, where the note's
  name becomes a directory and each snapshot is a plain copy. Stamp is
  `YYYY-MM-DD HH.mm.ss` (dots, no colons — Windows/APFS-safe), optional
  `-N` counter for same-second copies; the file is named AND mtime'd
  for when its content was last written, not when displaced. Policy:
  snapshot the PRE-write content, ≥5 min apart (force on restore),
  never for identical content; prune to 40 versions / 60 days but
  always spare the newest; covers `.md/.jmd/.canvas`; history moves
  with renames. Reference implementation: `src/main/history.js` (unit
  tests in `tests/history.test.js`). Per-vault switch: `history` in
  `.clew/vault-settings.json` — `false` disables, an object overrides
  `{minIntervalMinutes, maxVersions, maxAgeDays}`, absent = on. If iOS
  writes notes it should produce/respect the same snapshots, or the
  manual chapter (note-history.html) needs an iOS caveat.
- **Atomic write convention.** Desktop writes everything durable via
  temp + fsync + rename; the temp is `.<basename>.clew-tmp` BESIDE the
  target (dotfile, so walks/watchers skip it; fixed name, so the next
  save sweeps an orphan). iOS should use the same pattern and the same
  temp shape so each app ignores the other's temps. Exemplar:
  `src/main/fs-utils.js#writeFileAtomic`.
- **First-open greeting rule.** A vault opening with NO saved workspace
  opens its root `Welcome.md` if present (that is what makes the demo
  vault a tutorial from the first screen). Cheap parity win.
- **The demo vault ships with the desktop app** and is copied to
  `~/Documents/Clew Demo Vault` on first use (bundle copy is read-only
  payload; the user owns the copy). iOS likely wants the same idea
  (bundle + copy-out on first run).
- **Manual sections that now speak desktop truths** — check them
  against iOS reality and caveat where needed: `note-history.html`
  (new chapter), `getting-started.html` (#first-launch welcome-screen
  buttons, #example-vaults "ships inside the app"),
  `vaults-and-files.html` (the `.clew/` table gained `history/`; the
  "no writing in here" claim was reworded), `settings-and-hotkeys.html`
  (ninth per-vault key `history`).

## 2. Small residue (none blocks anything)

- **Meta Bind widget polish, DONE** (`c579d11`; manual `45c1b1f`): number
  pickers were a text field's 11em (mostly empty for a 2-digit mark) and
  any narrower host width overflowed the + stepper — the component's
  intrinsic min is ~277px (a 20-char input). Fix: size="small" + shrink
  the INPUT PART to 3.5em (host sizes naturally to ~9.5em). Also
  `class(…)` is now honored, not dropped — author classes land on the
  element (Obsidian-parity), so a vault script can restyle one widget.
- **Settings-leak incident, fixed same day**: smoke runs had been
  writing recentVaults/lastVault into the REAL settings for several
  sessions (vault.open → rememberVault), and the owner's launch
  restored the 5k stress vault via the lastVault fallback. Fix:
  settings.js#save no-ops under CLEW_SMOKE; the owner's settings file
  was scrubbed by hand; verified byte-identical across a smoke run.
- `smoke/` is now committed — extend it, don't rewrite scenarios in
  scratchpads. big-vault note folders are RANDOM: touch a path from the
  index, never a guessed one (an add-not-change cost an hour here).
- Query-dashboard renders served from a warm cache emit NO
  EV_RENDER_DONE — a scenario timing "first render" must delete the
  vault's .clew/ first (smoke/README says so).
- History restore on a note in READING mode: verified via the external
  change path. Canvas files snapshot too, but the modal/restore UI is
  notes-only (command gated `needsNote`) — a future affordance.
- Toggling the history switch OFF then ON from Settings writes a plain
  boolean and so discards a hand-edited tuning object (documented in
  the manual).
- Rename of an OPEN pdf/office/canvas tab still leaves the tab on the
  old path (`remapPaths` only handles note tabs) — survived the list.
- Real-keyboard checks inside LibreOffice (⌘S, clipboard) and
  office-convert on a machine with desktop LO: still unverifiable here.
- Restore-boot policy unchanged: a restored office tab boots
  LibreOffice at launch (deliberate, unreviewed).
- Kanban card drag (write path) — v2 of a shipped feature.

## 3. The owner works in this tree concurrently

Tree left CLEAN on 2026-09-02: main at `28af145`, Clew-docs at
`e618ed9`. `zeta-assets/` here is deliberate and gitignored
(PROVENANCE.md inside). `out/` holds fresh mac/win/linux artefacts from
this session. Anything uncommitted you find is NEW owner work — leave
it unstaged and note it here. Never switch THIS tree off main. Live
testing flips demo widgets — reset `status:`/`done:`/`^motto`
baselines before committing demo files.

## 4. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths.
- Always pass `CLEW_SMOKE_VAULT`; `git status` demo and study vaults
  after every smoke run. Settings NEVER persist under CLEW_SMOKE
  (settings.js#save no-ops) — the old restore-after-flip chore is
  gone. `CLEW_USER_DATA` still isolates a run entirely (fresh-install
  sim; also the only isolation packaged runs WITHOUT CLEW_SMOKE get).
- Long smoke runs go `run_in_background` with output to a file.
- **The owner's bug reports have been consistently right.**
- **Write assertions that can fail — and eyeball the artefact anyway.**
- **Verify artefacts by content**, never the log line.
- **Prefer measuring to guessing** — and re-measure (the chokidar
  rename measurement is why atomic writes shipped in an afternoon).
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you.
- `npm run dev` / `npm run package` re-sync the engine AND the
  EmbedPDF viewer from their masters; `sync-engine` + `sync-embedpdf`
  + `git status` BEFORE tagging.
