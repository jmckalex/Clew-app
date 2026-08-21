---
tags: [guide]
---
# Links and Embeds

Obsidian-style wikilinks, resolved by shortest path, aliases included:

- `[[Welcome]]` — link by name
- `[[Clew Design|the design note]]` — with display text
- `[[Math and Theorems#Dialect extras]]` — to a heading
- `[[Syntax Showcase]]` — via a frontmatter alias
- Unresolved links are dashed; **clicking one creates the note**.

## Embeds (transclusion)

`![[Note]]` embeds a note's rendered content in a styled box —
`![[Note#Heading]]` embeds just that section. Embeds nest (cycle-safe).

Media embeds render natively: `![[clew-gradient.png]]` shows the image,
`![[sample.pdf]]` embeds Chromium's PDF viewer, and audio/video get
players — see [[Attachments and Files]].

Renaming or moving a note rewrites every link to it, across the whole
vault. The backlinks panel shows who links *here* — see [[Panels]].
