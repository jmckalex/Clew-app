---
tags: [guide]
---
# Vaults and Files

A **vault** is any folder of `.md`/`.jmd` files. Open one from the welcome
screen or with **File → Open Vault…** (⌘⇧O). Existing Obsidian vaults open
as-is: Clew never touches `.obsidian/` and keeps its own state (workspace
layout, caches, bookmarks) in a `.clew/` folder.

## The file explorer

- Click a note to open it; ⌘-click opens a new tab.
- Click an image, PDF, audio, or video file to open a viewer tab.
- Right-click for **new note/folder, rename, reveal in Finder, delete**
  (deletes go to the system Trash).
- **Drag** a note or folder onto another folder — or the empty tree
  background for the vault root — to move it. Renames and moves rewrite
  every `[[wikilink]]` that points at the moved notes.

## Editing alongside other apps

Clew watches the vault. Files edited in another app reload in place when
your editor is clean. If you have **unsaved local edits** and the file
changes on disk, a banner appears and auto-save pauses until you choose
**Keep my version** or **Load disk version** — nothing is clobbered
silently.

See also: [[Attachments and Files]], [[Navigation]].
