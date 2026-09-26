# Handover — 2026-09-26 (0.10.0 built for all four platforms, mac signed/notarized/stapled and boot-verified; 19 commits unpushed; the website is NOT live)

Session-rollover state. Durable architecture, conventions and gotchas live
in **CLAUDE.md** (trust it; it gained the shell panel and the watch-order
policy this session); the original design plan is at
`~/.claude/plans/groovy-forging-shell.md`. This file is rewritten each
session — keep it short, and prefer deleting a settled item to explaining
it again.

## 0. Where things stand

Tree CLEAN, 644 tests green, `node scripts/build.js` passes,
`make check-links` clean in Clew-docs.

**This session (the eighth) built two things and corrected one lie in the
manual.**

1. **A shell panel** (`c96c0f5`) — ⌃` opens a real terminal, under a real
   pty, at the vault root, pinned under the workspace. §2.
2. **The watcher was taught where to spend its budget** (`941d3ec`) —
   markdown first, then the documents Clew edits, then everything else
   breadth-first. The owner's policy, after a measurement showed the old
   behaviour watching 6 of a vault's 81 notes. §3.
3. Plus `701c37c` (the smoke harness was dispatching fake keyCodes — it had
   been dropping every hyphen a scenario typed, for as long as the
   `{text:…}` path has existed) and `aa51a70` (documentation: the shell
   panel, and two exclusion traps a real vault found).

**0.10.0 is cut for all four targets** — §4. The mac universal image is
signed, notarized, stapled, and verified by BOOTING it, not just by
`codesign`.

**The website is not live**, and an earlier claim of mine in this session
that it was serving a stale manual was WRONG — §5. Nothing is published.

## 1. STILL OPEN

Nothing blocked in the code. Two things wait on the owner and gate
everything downstream:

- **The GoDaddy DNS change.** All four names still resolve to GoDaddy
  parking. Until they point at the droplet there is no site, no
  certificate, and no download.
- **19 commits unpushed** on a repo that now HAS a remote (§6).

## 2. The shell panel

⌃` (View → Shell Panel) opens a terminal under the workspace. The owner's
two decisions: **one shell per WINDOW, at the vault root**, and **no
restrictions — it is their shell**. Height and open state live in the
workspace, per vault; the session outlives the panel being hidden (a build
that runs while you go back to writing is the whole point) and is reaped by
`session.js#dispose`.

They also named the mechanism to copy: their own jmacs/Godot editor,
`~/Source/jmacs/main/apps/desktop/src/shell.js` (NOT `~/Source/Godot`,
which is the engine). It earns the copying — **a pty with no native
addon**: the child is `python3 -c <script>` calling stdlib `pty.fork()`.
node-pty would be a compiled module rebuilt per Electron version per
platform. Two details in that script are load-bearing and both fail
SILENTLY; `tests/shell-core.test.js` pins each:

- SIGTERM is reset to `SIG_DFL` **before** the fork. A child spawned by
  Electron can inherit an ignored disposition across exec, which makes
  `kill()` a no-op and leaks the pty with its shell inside.
- Resizing rides a **sidechannel on fd 3** (`<cols>:<rows>` → `TIOCSWINSZ`
  → SIGWINCH), never down the pty, where it would be typed input.

Shape: `main/shell-core.js` (electron-free, 17 unit tests, one running a
REAL pty and asserting the double echo), six `clew:shell-*` channels,
handlers keyed on the session id, and
`renderer/components/workspace/clew-shell-panel.js` (xterm.js + fit addon)
in a new `.center-column`. `smoke/shell-panel-scenario.js` drives it.

Three things the build taught:

1. **The grid must be monospace.** It was wired to `--clew-editor-font`,
   which is Avenir Next; xterm sizes one cell from the font and puts every
   character in its own cell, so a proportional face leaves a gap around
   each letter. The owner spotted it in the first screenshot.
   `--clew-mono-font` fixed it — and the same box went from 61 columns to
   92, which is the same fact from the other side.
2. **The harness was dispatching fake keyCodes** — `-` as 45, which is
   Insert, so xterm swallowed every hyphen; named keys as 0, so `Enter` was
   not Enter. Fixed in main.js (`NAMED_KEYS`, `PUNCT_KEYS`). Every scenario
   that types punctuation was affected and nobody had noticed.
3. **A scenario must not assume a fresh workspace** (§9).

## 3. Where the watcher's budget goes

The manual used to claim "your own notes are reached first". False, and
measurably: chokidar takes what its walk meets, so on ph226-426 the budget
was spent inside a font icon set after **6 of the vault's 81 notes**. I
documented the truth; the owner chose the other repair — "watch all the
markdown documents first, then develop a heuristic for the other document
types that need to be watched, and then do everything else on a
breadth-first-search policy."

`fs-utils.js#watchOrder`/`#watchPlan` decide what the budget buys BEFORE
chokidar walks, which costs nothing because Clew already walks the vault
for the tree — `tree()` collects the file list on the way past, and the
order is the only thing the watcher could not have worked out for itself.
Tiers: notes (`.md`/`.jmd`), then documents Clew EDITS (canvas, base, bib,
pdf, office, excalidraw), then everything else breadth-first.

**The heuristic worth remembering is the one about what is NOT a tier.**
Giving every image a high tier hands the budget straight back to the icon
set that caused the problem — 20,000 `.svg` files are 20,000 images. Depth
answers it instead: a vault's own attachments sit beside its notes, a
vendored library is five or six folders down. At equal depth, a file Clew
has a use for goes first.

| vault | walk order | planned |
| --- | --- | --- |
| ph226-426 (41,318 files) | 6/81 notes, 1/288 documents | **81/81, 288/288** |
| ph341 (40,350 files) | 15/42 notes, 6/151 documents | **42/42, 151/151** |
| demo-vault (61 files) | everything | everything (nothing to pay) |

Two implementation notes. The plan claims each file WITH its ancestor
directories, because chokidar cannot descend into a directory it was told
to ignore. And it governs the SCAN only: after `ready` the budget alone
applies, or a file created during the session would be in no plan and never
watched.

`renderer/lib/file-types.js` moved to `src/shared/` (re-exported from its
old path, so no caller changed): main cannot import a renderer module, and
two copies of "what is an image" would drift.

**The owner's `*/libs` lesson, worth carrying.** They set
`"hidden": ["*/libs"]` on ph226-426 and were still told 6,863 files were
being watched. Two reasons, and the second is the surprising one: `*` is
exactly one folder deep (theirs live at two depths), and — because every
`libs` is a symlink to ONE shared tree and Clew's walk realpath-dedupes —
excluding one route excludes nothing, the walk simply arrives by another.
With `**/libs` the vault is 1,446 files. Both traps are now in the manual,
the demo guide and the Settings placeholder.

## 4. 0.10.0 — four artefacts, one of them signed

| artefact | size | state |
| --- | --- | --- |
| `Clew-0.10.0-universal.dmg` | 307 MB | signed · notarized · stapled |
| `Clew Setup 0.10.0.exe` | 183 MB | NSIS x64, unsigned (no Windows cert) |
| `Clew-0.10.0.AppImage` | 214 MB | ELF x86-64 |
| `clew_0.10.0_amd64.deb` | 169 MB | well-formed |

Built by `node scripts/package.js --dmg --sign --notarize --universal` then
`npm run package:win` / `package:linux`. The version bump is package.json
ONLY — Clew-docs still says 0.9.0 in its Makefile, README and the landing
page's four download links, deliberately (§5).

Verified: `stapler validate` + `spctl -a -t open` on the IMAGE; the same
two plus `codesign -dv` on the `Clew.app` INSIDE it (so a dragged copy
launches offline); `flags=0x10000(runtime)` with all four entitlements;
`lipo -archs` = `x86_64 arm64` on the main binary, all four helpers and the
Electron framework; and the PACKAGED binary booted under `CLEW_SMOKE` over
the figures fixture — 13/13 `mpw-ok`, `pending=0`, LuaLaTeX ×2 + LuaTeX,
`cache-probe first=engine second=cache`.

**That last check failed the first time and the failure was not the
build.** Eight figures pending, five `latex made no progress for 20000 ms`.
The run came straight after three back-to-back packaging runs with the load
average at ~20, and mp-tikz-wasm's watchdog is 20 s of no progress from a
worker; an arm64 control passed 13/13 at load ~6, and the SAME universal
binary passed 13/13 at load ~4 ten minutes later. Now a standing rule (§9).

Superseded artefacts still in `out/`, deliberately untouched — ask before
deleting: `Clew-0.9.0-universal.dmg` (26 Aug), `Clew-0.9.0-arm64.dmg`
(25 Sep 12:52, signed and stapled, never shipped), `Clew-0.10.0-arm64.dmg`
(the evening's first cut), and the 2 Sep 0.9.0 win/linux artefacts.

## 5. The website: not live, and I said otherwise

**Correction, for the record.** Earlier this session I said the droplet was
"serving the pre-today manual" and that clew-app.com "documents a Clew
without the shell panel". Both wrong. `make dns-check`:

```
WRONG  clew-app.com      -> 13.248.243.5     (GoDaddy parking)
WRONG  www.clew-app.com  -> 76.223.105.230
WRONG  clew-app.net      -> 15.197.148.33
WRONG  www.clew-app.net  -> 3.33.130.190
```

What is true: the droplet holds a staged copy (`/var/www/clew-app.com`,
landing page 17 Sep, manual 35 files, `downloads/` synced 23 Sep with the
**26 August** universal dmg and the 2 Sep win/linux ones). nginx serves it
on port 80 by name. No traffic reaches it, there is no clew-app.com
certificate in `/etc/letsencrypt/live/`, and the config has no 443 block —
so an https request for the domain, if DNS did point here, would fall to
the `jmckalex` default_server. What I fetched over https was GoDaddy's
parking page: hence `<title>clew-app.com</title>` and a certificate GoDaddy
issued for the parked name. The inference "the files are on the droplet, so
the droplet is serving them" is the whole of the mistake.

**The order, once DNS moves** (`make dns-check` is the gate, and it prints
the right IP — 139.59.191.156; an older handover said 144.126.236.254,
which was wrong): `dns-check` → `nginx-install` → `sync` → `tls`. Note that
`nginx-install` OVERWRITES the live config, so after `tls` has rewritten it
with the 443 blocks, running `nginx-install` again would remove them —
`make nginx-diff` is there to show that drift.

**Not yet synced even to the staging copy**: five manual pages
(links-and-embeds, panels, search, settings-and-hotkeys, vaults-and-files)
and `images/shell-panel.png`.

**Before 0.10.0 can be a download**: bump `VERSION` in the docs Makefile,
the README's two mentions, and the landing page's four hrefs + two version
strings; `make stage-downloads`; `make check-links`; `make sync` and
`make sync-downloads` (~870 MB).

## 6. Owner's own actions

- **The DNS change** (above). Everything about publishing waits on it.
- **Clew-app now HAS a remote** — `origin`
  `https://github.com/jmckalex/Clew-app.git`, with `main` at `c362a35`
  plus `feat/excalidraw` and `spike/embedpdf`. Local `main` is 0 behind,
  **19 ahead**, and is NOT tracking it (`git status` shows a bare
  `## main`), so nothing pushes or pulls by default:
  `git push -u origin main`. **Clew-docs still has no remote at all** —
  74 commits and ~50k words of manual exist only on this Mac, and the
  droplet is not a copy of them (§5).
- Two offers still waiting on a yes or no: the stray link face on plain
  `[text]` brackets, and a manual line about `\[ \begin{align*} … \]`
  rendering in the preview but failing a LaTeX export.
- **`font=note` waits on a release.** The manifest is pinned to
  mp-tikz-wasm 0.2.1; when 0.3.0 exists, re-pin
  `src/shared/mptikz-manifest.json` — that is the whole job.
- mp-tikz-wasm (owner's project), still parked: the **graphicx driver
  line**. `\rotatebox` does nothing because `graphics.cfg` picks
  `dvips.def` for any DVI engine, whose PostScript specials need
  Ghostscript. Verified fix, for the library to prepend beside its
  `\def\pgfsysdriver` line:
  `\ifx\PassOptionsToPackage\undefined\else\PassOptionsToPackage{dvisvgm}{graphics}\PassOptionsToPackage{dvisvgm}{color}\PassOptionsToPackage{dvisvgm}{xcolor}\fi`
  — rotate/scale/colour on both LaTeX engines, plain TeX untouched, an
  explicit `[dvips]` overridden. `\PassOptionsToPackage` takes ONE package
  name; a comma list silently passes nothing.
- **Decide on the dev docs** (asked, answered yes, never written): three
  on-demand topic docs — `docs/dev/rendering-pipeline.md`,
  `docs/dev/editor.md`, `docs/dev/figures.md` — indexed from CLAUDE.md,
  under the same "not finished until it matches" rule as the manual.
- Win/linux artefacts are cross-built from macOS and **still untested at
  runtime**; the Windows installer is unsigned.

## 7. Small residue (none blocks anything)

- A TeX fragment name containing a comma can never be asked for (the
  attribute is a comma list). The settings row says so; nothing stops the
  name being typed.
- `show=code` never builds a figure, so a bad fragment name in a
  `show=code` block is not refused — by construction, and harmless.
- A site export of a note containing a vault-path `@reveal` is untested.
- `marked-token-position@undefined` — electron-builder's warning on every
  package. Harmless (the engine is staged separately); the fix is upstream
  in the jmarkdown master's package.json, then `npm run sync-engine`.

Carried over, still true: `:::TiKZ` / `@begin(…)` BODIES keep the overlay's
uniform `jmd-embedded` face (only fences got grammars); `show=` is the
preview's only, a LaTeX export of `show=code` still draws the picture; a
plain `[text]` in prose still wears the link face in the source pane; the
library's element for a LaTeX document is still `<tikz-diagram>`; a wrapped
latex snippet's line width is standalone's 345pt; the engine's HTML
pretty-printer re-indents a figure's source; plugin checkbox toggles need a
vault reopen; rename of an OPEN pdf/office/canvas tab leaves it on the old
path; executable extensions refused by `open-file.js` unreviewed; the
history switch discards a hand-edited tuning object; LibreOffice
keyboard/clipboard and office-convert unverifiable here; kanban card drag
write path; warm-cache query renders emit no EV_RENDER_DONE.

## 8. The owner works in this tree concurrently

Tree CLEAN. `zeta-assets/` and `mptikz-assets/` are deliberate and
gitignored. Never switch THIS tree off main. Live testing flips demo
widgets — reset `status:`/`done:`/`^motto` baselines, and the foldable
embed in `Guide/Links and Embeds.md`, before committing demo files.

In Clew-docs the owner has uncommitted edits to `HANDOVER.md`, `Makefile`
and `README.md` — leave them alone.

## 9. Standing session rules (they keep earning their keep)

- **NEVER `git add -A`** — stage explicit paths. (Broken repeatedly this
  session. The commits are clean because the tree happened to be, which is
  luck, not method.)
- **A SIGNED build must be boot-tested, not just verified.** `codesign
  --verify` proves the signature and says nothing about whether the app
  runs. The hardened runtime is exactly what breaks this one — the forked
  render worker needs `allow-dyld-environment-variables`, the wasm TeX
  needs `allow-jit` + `allow-unsigned-executable-memory`, the unpacked
  engine tree needs `disable-library-validation`. Run the PACKAGED binary
  under `CLEW_SMOKE` with an isolated `CLEW_USER_DATA` and assert a latex
  figure reaches `mpw-ok`.
- **…but do not run the figures check on a busy machine.** The mp-tikz-wasm
  watchdog fires after 20 s with no progress from a worker, so a run
  straight after a packaging round (load ~20) reports `mpw-error: … made no
  progress for 20000 ms` on figures that are fine. **A figures timeout is a
  claim about the machine until a quiet re-run agrees with it.**
- **`spctl -a -t exec` on a signed-but-unnotarized app says `rejected —
  source=Unnotarized Developer ID`, and that is fine.** A locally BUILT
  bundle carries no quarantine flag. Gatekeeper stops only a copy that was
  TRANSFERRED. After notarizing, both the image and the app inside report
  `accepted — source=Notarized Developer ID`.
- **`--notarize` requires `--dmg`** (the ticket staples to the image), and
  `scripts/package.js` blanks the Apple env for its child unless asked — so
  a plain `--sign` build never silently notarizes. Budget ~12 minutes for
  the signing alone: a `--timestamp` round-trip per nested binary plus
  hashing 13,619 files. A universal build roughly doubles it.
- **Files on a server are not a site being served.** `ls` on the droplet
  and `dig` on the domain answer different questions; `make dns-check`
  answers the one that matters. Checking the artefact instead of the path
  to it is this session's second measurement mistake of the same shape.
- **A vault is whatever folder the user points at**, and some of them
  contain libraries. It can SAY so (`vault-excludes.js`, two lists), and
  every walk must consult it. Anything that walks or watches a vault also
  needs a bound: the descriptor ceiling (~10,240 held, then `fork` fails
  with EBADF) turns "slow" into "cannot render", and the DOM has the same
  shape of problem. Both bounds exist — `WATCH_BUDGET`, explorer
  windowing — and anything new that enumerates a vault should ask which
  bound it lives inside. A resource cap must not become a CORRECTNESS cap:
  bound the bulk operation, not the session.
- **Check the baseline before believing a timing.** A `performance.now()`
  difference against a variable that was never set subtracts zero and
  reports the age of the page.
- **A smoke run's ENV is the whole safety net.** Launching `…/Electron .`
  without the `CLEW_SMOKE*` variables boots the REAL app against the real
  userData. Build the whole command, env and all, in ONE go.
- Always pass `CLEW_SMOKE_VAULT`; `git status` the demo and study vaults
  after every run. `CLEW_USER_DATA` isolates a run entirely — and is where
  a scenario's GLOBAL settings can be staged.
- **A scenario must not assume a fresh workspace.** Tab layout, reading
  mode AND the shell panel's open flag are per vault in
  `.clew/workspace.json`, so a second run over a reused fixture starts
  where the first left off — which reads exactly like a broken feature. Set
  the state you need, then drive.
- **A scenario's own listener is registered too late for boot events.** The
  renderer registers its handlers at module load, before the smoke script
  is injected, so an event like `EV_WATCH_CAPPED` is already handled and
  its notice already in the DOM. Assert on the DOM, not on a listener you
  added afterwards — and do not "fix" the event path on that evidence.
- **A path already open is FOCUSED, not duplicated** — `newTab: true` does
  not override it, and the restored tab keeps the mode the last run left.
  Over a big vault, wait for `vaultStore.vault` AND a beat for the
  workspace to restore before opening anything.
- **Observations must wait on conditions, not on a clock.** Input starts
  only after the scenario RETURNS, and how long the boot before it took is
  not yours to know.
- **The frame script runs against whatever preview is open when the
  scenario ENDS.** Phases that leave another tab focused go FIRST.
- **A typeset figure no longer holds its source in the DOM** — read what
  the engine emitted from `<vault>/.clew/cache/html/<hash>.html`;
  `data-preamble` is the one input that survives on the element.
- **The preview document has its OWN palette** (`--preview-bg`, …), not the
  app's `--clew-*` variables.
- After a smoke run over a reusable fixture, `rm -rf` its `.clew/`; a
  scenario that TYPES also rewrites its fixture — regenerate before every
  run.
- Long smoke runs go `run_in_background` with output to a file — and NOT
  inside a `( … ) &` subshell, which the harness kills on return.
- Reusable scenarios live in `smoke/` — extend it, don't rewrite them in
  scratchpads; the README table carries the per-scenario assertions.
- **A smoke timeout must wrap Electron itself**: `perl -e 'alarm shift;
  exec @ARGV' N …/Electron .` — one around `npx electron .` kills npx and
  ORPHANS Electron. `ps -axE | grep <vault>` finds a stray by its env.
- **A native menu is invisible to `capturePage`** — `CLEW_SMOKE_MENU=1`
  dumps the real `Menu.getApplicationMenu()` and proves the template BUILT.
- **A face cannot un-parse a node.** When the overlay and lang-markdown
  disagree about a construct, fix the GRAMMAR.
- **In a lezer inline parser, `before:` is the whole design.** `Escape` is
  FIRST in the default list and eats `\(`; `Link` builds a
  shortcut-reference node whether or not a definition exists; `InlineCode`
  runs before both.
- **The owner's bug reports have been consistently right** — and so have
  their rollbacks: a hidden tweak that "fixes" a document is a behaviour
  the user cannot see; teach it in the manual instead.
- **Write assertions that can fail — and eyeball the artefact anyway.**
  Computed style, not markup, when the bug is layout.
- **A measured symptom is not a cause.** Vary the CONSTRUCT, not just the
  document, before naming the fault.
- **Prefer measuring to guessing** — and when a disagreement is about what
  a standard does, run the standard.
- A feature change is not finished until the MANUAL in `../Clew-docs`
  matches it — nothing in this repo's git status reminds you. The demo
  vault is the other half: a guide note must EXERCISE what it documents.
- `npm run dev` / `npm run package` re-sync the engine AND the EmbedPDF
  viewer from their masters; packaging also stages mp-tikz-wasm. Run all
  three + `git status` BEFORE tagging.
- Screenshot-kit lore, still true: splitting re-parents the editor and
  RESETS its scroll; CDP keystrokes need the caret's viewport coords for
  the focusing click; `CLEW_SMOKE_LOG=1` prefixes scenario `console.log`
  with `[smoke:info]`.
