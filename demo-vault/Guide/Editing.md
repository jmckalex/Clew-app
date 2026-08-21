---
tags: [guide]
---
# Editing

Notes are edited in **source mode** with full jmarkdown-dialect
highlighting: `/italics/`, `*strong*`, `**intense**`, `==highlights==`,
directives, `@begin(…)` environments, math, citations, and footnotes all
get faces (see [[Dialect Demo]] for a tour).

Everything auto-saves about a second after you stop typing, and on
blur/tab-switch. **Undo history survives navigation** — leave a note and
come back, and ⌘Z still works.

## Completions

- `[[` completes note names, aliases, and (after `#`) headings.
- `#` completes tags, including nested ones like `#project/clew`.
- `\cite{` (and `\citep`, `\fullcite`, …) completes citation keys from
  every `.bib` file in the vault, showing author, year, and title.

## Links and files

- **⌘-click** a `[[wikilink]]` to follow it (⌥ for a new tab).
- **Paste or drop** images and files straight into a note — they're saved
  to the attachment folder and embedded (see [[Attachments and Files]]).
- ⌘F searches within the note.

See also: [[Reading Mode]], [[Links and Embeds]].
