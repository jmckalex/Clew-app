# Queries

Two fences turn the vault into a database — Clew's built-in answer to
Obsidian's Dataview and Tasks plugins.

## Notes as rows

```` ```query ```` filters notes by folder (`from:`), tag (`tag:`), and
frontmatter fields (`where:`, repeatable), with `sort:` and `limit:`.
`table:` names frontmatter columns; omit it for a plain list. Built-in
fields: `name`, `path`, `modified`.

```query
table: status, priority, due
from: Projects
sort: priority asc
```

A list instead — every guide note:

```query
tag: #guide
limit: 6
```

## Tasks across the vault

```` ```tasks ```` gathers checkbox items from every note (`not done`,
`done`, or `all`; same `from:`/`tag:` filters; `group: none` for one
flat list). **The checkboxes are live** — ticking one writes back to
the note it came from.

```tasks
not done
```

Queries re-run whenever this note re-renders; edit any listed note and
reopen (or touch this note) to refresh.
