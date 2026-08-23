# Why a Writable Vault

In 1994 the Mosaic browser looked like documents with blue underlines —
and it was reasonable to ask what possible use that could be. The
answer wasn't the documents. It was that **the link turned reading into
infrastructure**: once documents could point at each other, they
stopped being pages and became a *place*.

The same shift, one size smaller, is what structured fields do to a
folder of notes.

## Notes secretly carry state

Look at what's really in an academic's files: this paper is *under
review at Synthese, due back the 15th*. That book is *half-read, quite
good, relevant to chapter 3*. That essay is *unmarked*. That errand is
*not done*. Every note quietly carries a little **state** — and plain
text has nowhere to put it except prose, where nothing can find it.

Frontmatter gives state a place to live:

    status: submitted
    venue: Synthese
    due: 2026-09-15

So far, so Obsidian. A query can now *find* things ([[Dashboard]] is
nothing else). But queries only read. To change anything you still open
each file, one at a time, and edit YAML by hand. The state is visible
but not *operable*.

## The write-back is the Mosaic moment

Clew's tables and boards are **views you can act on**:

- Drag a card on [[Pipeline]] from *submitted* to *revise* — Clew
  rewrites `status:` in that paper's note.
- Click the rating cell in [[Reading List]], type 9 — the book's note
  now says `rating: 9`.
- Tick a task on [[Dashboard]] — the checkbox in the note it came from
  flips.

The view stops being a report and becomes a **control surface**. That's
the difference between a spreadsheet *about* your work and a
spreadsheet that *is* your work. You already know this pattern — it's
Notion, Trello, Airtable, every project tool of the last decade. What's
new is what's underneath: **there is no database.** Every row is a
Markdown file you own. Grep works. Git works. Pandoc works. If Clew
vanished tonight, nothing about your term would be lost or even
garbled — you'd just be back to opening files one at a time.

## Why this compounds

One writable view is a convenience. The reason it's a *platform* is
that views are just notes, so they go anywhere notes go: a kanban
embedded on a canvas next to the actual draft PDFs; a due-soon table
transcluded into your Monday morning daily note; the same tables baked
into a website when you publish the vault. And because the state lives
in the files, every tool — queries, boards, graph, search, your own
scripts via the `vault` API — reads and writes the *same* facts. No
sync between app and notes, because the notes are the app.

In 1994 the demo was a physics preprint with blue underlines. The
demo here is a reading list where you can click the rating. Both look
trivially small. Both are the whole idea.
