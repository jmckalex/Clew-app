---
done: false
rating: 6
status: drafting
stars: 3.5
ink: "#8b7ec8"
due: 2026-09-15
url: "https://clew-app.com"
tags:
  - guide
---
# Obsidian Compatibility

Clew opens Obsidian vaults. Not by embedding Obsidian's code — by
implementing the **formats** an Obsidian vault leaves on disk, measured
against real public vaults rather than worked through a reference page.
One rule governs all of it: **what is not supported is refused by
name.** A query that silently dropped a filter would show numbers that
are wrong, which is worse than showing nothing.

## What an Obsidian vault gets

Wikilinks and embeds, properties, callouts, block references, tags —
the core language. Then the plugin formats that put data in files:
**Dataview** (DQL with FLATTEN, real GROUP BY and lambdas; `dataviewjs`
behind a per-vault switch), **Bases** (tables, cards, and map views),
**Kanban** boards (open [[Project Board]] in reading mode), the
**Tasks** plugin's query dialect and emoji metadata, **Excalidraw**
drawings with embedded images, **Charts** (see [[Charts]]),
`obsidian://` links, GitHub-style `#anchors` — and the three below.

## Admonitions

The callout syntax vaults used *before* Obsidian had callouts. An
` ```ad-type ` fence renders as the callout it always meant:

```ad-tip
title: Old syntax, same box
collapse: open
This box is written as an Admonition fence — switch to source mode to
see it. `title:` and `collapse:` work; `icon:` and `color:` were the
plugin's cosmetic overrides, and the callout's own styling applies.
```

## Embedded searches

Core Obsidian's ` ```query ` block holds a *search*, not a database
query. Clew tells the dialects apart by the colon: `key: value` (with a
space) is [[Queries|Clew's query language]], `operator:value` (without)
is a search. This one finds guide notes mentioning callouts:

```query
tag:#guide "callout"
```

Terms combine with AND, `"quotes"` make phrases, `tag:`, `path:` and
`file:` scope the search, `-` negates, `OR` offers alternatives, and
`[property:value]` matches frontmatter. Regexes, parentheses and
`line:`/`section:`/`task:` scopes are refused by name.

## Meta Bind widgets

`INPUT[…]` renders a live control **two-way bound to a property** —
these three are bound to this very note's frontmatter, so flip them and
watch the Properties panel follow (the file is the truth; the widgets
are just a view of it):

Done: INPUT[toggle:done] · Rating: INPUT[slider(minValue(0), maxValue(10)):rating] — currently VIEW[{rating}] · Status: INPUT[inlineSelect(option(drafting), option(review), option(shipped)):status]

The widgets are [Web Awesome](https://webawesome.com) components (MIT,
bundled, loaded only when a note carries one). Beyond Meta Bind's own
toggle, slider, text, number and select, Clew renders its `textArea`,
`datePicker` and `time` types, a bound read-only `progressBar` — and
adds two types of its own, worth knowing are Clew-native: **rating**
and **color**.

Stars: INPUT[rating(stepSize(0.5)):stars] · Ink: INPUT[color:ink] · Due: INPUT[datePicker:due] — which is VIEW[relativeTime:{due}] · Progress: INPUT[progressBar(minValue(0), maxValue(10)):rating]

`VIEW[…]` grew formatter kinds the same way (Clew-native):
`relativeTime`, `formatDate`, `formatNumber`, `formatBytes`, `badge` —
status as a badge: VIEW[badge:{status}] — and `qr`, which turns a bound
URL into something an iPad can scan straight off the screen:

VIEW[qr:{url}]

Everything writes through the same path as
[[Queries|editable query cells]] — the frontmatter safety valve
included. Other input types, `VIEW[…]` expressions, and the plugin's
button system are refused by name.

## Where the line is

This is where explicit compatibility work **stops**. The formats above
are owned and tested; plugin *behaviors* beyond them are not chased.
Clew is GPL — the extension story for everything else is the code
itself: a vault plugin (see [[Plugins]] — the engine surface can add
syntax, which Obsidian plugins cannot), a vault script, or a patch.
A named refusal is the signal a gap exists; real demand against a real
refusal is what reopens the question, and nothing else does.
