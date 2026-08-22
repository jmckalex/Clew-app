---
tags: [guide]
---
# Canvas

A **canvas** is an infinite board for arranging notes, files, web pages,
cards, connections, drawings, and shapes. Open [[Demo Canvas.canvas]] to
see one; create your own with **File → New Canvas** (also in the
palette and the explorer's right-click menu). Canvases are `.canvas`
files in the open [JSON Canvas](https://jsoncanvas.org) format, so they
open in Obsidian too — Clew's drawing and shape layers travel in a
`clew` extension key that other apps simply ignore.

## Getting around

- **Scroll** to pan; **pinch** or **⌘-scroll** to zoom at the cursor;
  **Space-drag** or the hand tool (**H**) to pan by hand.
- The controls at the bottom right zoom, reset, and **fit** (⇧1).
- Everything is draggable in the select tool (**V**). Click selects;
  shift-click adds; drag on empty canvas makes a marquee. **Backspace**
  deletes the selection. **⌘Z / ⇧⌘Z** undo and redo canvas edits.

## Things a canvas holds

- **Cards** — double-click empty canvas (or press **C**). Double-click a
  card to edit its text.
- **Notes** — the add-file toolbar button embeds any note as a *live jmarkdown
  preview*: math, mermaid, citations, checkboxes all work. Double-click
  a note to interact with it (scroll it, click its links, tick its
  checkboxes); Escape or a click outside returns to canvas mode.
  Right-click → *Open in tab* for full editing.
- **Images, PDFs, media** — the same add-file picker adds any vault file; PDFs
  get Chromium's full viewer.
- **Web pages** — the globe toolbar button embeds a live web page. Paste a URL anywhere on the
  canvas for the same effect.
- **Connections** — hover a node and drag from a side dot to another
  node. Double-click a connection to label it; right-click to color it.
- **Groups** — select several nodes, right-click, *Group selection*.
  Dragging a group carries its members.

## Drawing and shapes

The pen (**P**) draws freehand ink; the eraser (**E**) removes strokes.
Rectangle (**R**), ellipse (**O**), diamond (**D**), arrow (**A**), and
line (**L**) drag out clean shapes — right-click one to fill it, recolor
it, or give it a label; a selected shape resizes by its handles. Colors
and pen widths sit in the toolbar. Right-click empty canvas → *Clear
drawing* wipes the ink layer.

## Canvases inside notes

`![[Demo Canvas.canvas]]` embeds a live, read-only view of a canvas in
any note — it re-renders whenever the canvas changes, and its title
link opens the real thing:

![[Demo Canvas.canvas]]

## Good to know

- Nodes take one of six accent colors (right-click → swatches).
- Renaming a note updates every canvas that embeds it.
- The canvas auto-saves; ⌘Z history lives per open tab.
- Right-click empty canvas → *Export drawing as PNG…* saves the ink and
  shape layers as a transparent PNG (2× resolution).
