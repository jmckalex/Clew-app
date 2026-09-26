# Live edit — kickoff brief for the build session

You are building Clew's **live edit mode** (Obsidian's Live Preview) on
branch `feat/live-edit`, in this worktree. The design is in
`docs/dev/live-edit-plan.md`; this brief is how to start, how to work, and
how to stop. It is written to you, the model doing the build.

## 1. Read, in this order, before touching anything

1. `CLAUDE.md` — the architecture and the rules. All of it.
2. `HANDOVER.md` §10 — the session that produced the plan, and the
   decisions it took. (The rest of HANDOVER describes `main`; it is true
   but not your concern.)
3. `docs/dev/live-edit-plan.md` — all of it, once, before any code. Then
   §2 (ground truth) again with the files it names open beside it.
4. The files in the plan's §2 table as you reach them. Do not design from
   memory of what an editor "usually" does; the plan was written against
   the code at `ed2aabc`, and the code wins where they differ — then fix
   the plan in the same commit.

## 2. Set up

```sh
cd /Users/jalex/Source/Clew/Clew-app-live-edit     # this worktree; main stays in ../Clew-app
git status --short                                  # only docs/ should show (plan + this brief)
npm install                                         # the worktree shares no node_modules with main
npm test                                            # 644 green before you start
node scripts/build.js                               # must pass
```

Then commit the two documents as your first commit (explicit paths):

```sh
git add docs/dev/live-edit-plan.md docs/dev/live-edit-kickoff.md
git commit -m "Live edit: design plan and kickoff brief"
```

`npm run dev` runs the app and re-syncs the engine and EmbedPDF from their
masters on this machine (they exist; CLAUDE.md says where). The figures
scenarios need `npm run sync-mptikz` once; nothing else needs staging for
this feature. Never run the smoke harness without `CLEW_SMOKE_VAULT`
(CLAUDE.md, HANDOVER §9). Generated fixtures go in your scratchpad or
`smoke/`, never in a vault the owner uses.

## 3. Rules that will tempt you (each has a reason in CLAUDE.md)

- **Never edit `vendor/`.** The one engine change (plan Appendix D) is
  made in the jmarkdown master at `~/Sites/jmckalex/software/jmarkdown`
  (branch `at-migration`; read ITS CLAUDE.md and HANDOVER.md first; stage
  by explicit path) and then `npm run sync-engine`. Only phase 5 needs it.
- **The engine never runs in the renderer.** Rendering markdown to HTML in
  the app is limited to the tiny inline subset in plan §5.3. If you find
  yourself writing a markdown renderer, stop.
- **One EditorView.** Live edit is a `Compartment` reconfiguration of the
  pooled state (plan §3.1). No second editor, no second state, no copy of
  the document.
- **Block-level replacements come from a StateField; inline decorations
  from a ViewPlugin over `visibleRanges`** (plan §3.2). CodeMirror will
  throw or misbehave if you mix these up, and the failure is subtle.
- **Iframes never live inside widgets** (plan §7.1). CodeMirror recycles
  widget DOM; a moved iframe reloads.
- **Shortcuts are commands.** No ad-hoc keydown listeners. Toolbar buttons
  dispatch command ids.
- **Refuse by name.** What reading mode refuses, live edit refuses with the
  same words. Do not add Obsidian behaviours the plan does not list.
- **Plain JS, web components, tabs.** No frameworks, no TypeScript, no new
  dependencies without asking (MathJax is already loaded in the app page;
  that is the one library the plan leans on).
- **Stage explicit paths. Never `git add -A`. Never push.** `main` has 20
  unpushed commits and is not tracking `origin`; that is the owner's to
  sort out. Never switch `../Clew-app` off `main`.
- **Every UI change is verified with the smoke harness**, with an
  assertion that can fail, and an eyeballed screenshot. Computed style,
  not markup, when the question is layout.
- **The manual (`../Clew-docs`) and the demo vault are part of the
  deliverable.** Nothing in this repo's `git status` reminds you.
- **Measure before naming a cause.** A timing needs a baseline; a symptom
  is not a cause; vary the construct, not just the document.

## 4. Order of work

The plan's §12 phases, in order. Each phase ends with its acceptance list
green, `npm test` green, every EXISTING smoke scenario the phase could
touch re-run (`fence-highlight`, `footnote-highlight`, `math-highlight`,
`editor-hotkeys`, `reading-scroll` for anything near the grammar or the
mode plumbing), and a commit. Do not start phase N+1 with phase N red.

- **Phase 0** foundations (no visible change) — the scanner's
  `constructs`, the sub/superscript grammar, the vault-settings store, the
  model and the reveal function with their tests, the fragment/block
  endpoints, the client's block flag, the harness knob.
- **Phase 1** the mode — live = source, visually. Everything in plan §3.3.
- **Phase 2** Tier A inline. **Phase 3** Tier A lines and blocks.
- **Phase 4** tables and images. **Phase 5** block frames.
- **Phase 6** toolbar. **Phase 7** docs, demo vault, polish, numbers.

Phases 1–4 are a coherent shippable product on their own; if the owner
asks for less, phase 5 and the selection bubble (§6.7) are what to drop —
never the substrate.

Commit granularity: one commit per coherent step within a phase, each
with its tests; a phase is several commits, not one. Commit messages in
the house style (`git log` shows it): a subject line that says what
changed and why, a body only when the why needs more than a line, and the
attribution lines your session reminder gives you.

## 5. Decisions already taken — do not re-open them yourself

Plan §13, with defaults: clicking a concealed link follows it (⌥-click
edits); remote `http(s)` images stay unloaded; ⌘⇧E toggles live/source;
new tabs still default to source; `|live` office embeds are thumbnails in
live edit; MathJax macro state is shared across notes (documented);
tables edit as source on activation; reading mode gets a slim bar with
the mode switch. If one of them turns out to be wrong in practice, say so
in HANDOVER with the measurement, and keep the default until the owner
decides.

## 6. When the plan is wrong

It will be, somewhere. When the code or a measurement contradicts it:
fix the plan in the same commit as the code, and note it in the commit
body ("plan §7.3 said X; measured Y"). Do not carry a known-wrong plan
and a private workaround.

## 7. Ending a session

Whether or not the feature is done:

1. `npm test` green; `node scripts/build.js` passes; the affected smoke
   scenarios pass; `git status` shows only what you mean to leave.
2. **Rewrite `HANDOVER.md`** on this branch in the established shape:
   where things stand (which phase, which commits), what is STILL OPEN,
   what the build taught (the measured facts, with numbers), owner's own
   actions, small residue, standing rules that earned their keep. Short;
   delete what is settled. The manual/demo status goes in explicitly —
   "not finished until the manual matches".
3. Reset any demo-vault widget state you flipped while testing
   (HANDOVER §8 on `main` lists the baselines).
4. When the feature is DONE: turn `docs/dev/live-edit-plan.md` into
   `docs/dev/live-edit.md` — the durable dev doc — by deleting §12–13 and
   the "Status: DESIGN" header, keeping the architecture sections true
   to what was built; add the CLAUDE.md subsection; delete this brief.

## 8. First hour

- [ ] Read the three documents (§1).
- [ ] `npm install`, `npm test`, `node scripts/build.js`.
- [ ] Commit the two docs.
- [ ] Run one existing smoke scenario end to end over a scratch copy of
      `demo-vault` to prove the harness works in this worktree (e.g.
      `math-highlight-scenario.js`; its header carries the fixture
      recipe). Note the exact command you used in HANDOVER — the next
      session will want it.
- [ ] Phase 0, first task: `src/renderer/editor/jmd/scan-cache.js` and
      the scanner's `constructs` array with
      `tests/jmarkdown-constructs.test.js` — the smallest change that
      everything downstream depends on. Keep `captures` byte-identical
      (the existing scanner tests are the proof).
