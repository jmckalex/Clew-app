# Pipeline

The papers, as a board. Cards are the notes in `Papers/`; columns are
their `status:` frontmatter. **Drag a card to a new column and Clew
rewrites that note's frontmatter** — then every other view (the
[[Dashboard]] tables, queries anywhere) follows, because they all read
the same files. Double-click a card to open the paper.

```kanban
group: status
from: Papers
columns: drafting, submitted, revise, accepted
show: venue, due
```

This same board works embedded on a canvas — see `Pipeline Board.canvas`
in this folder, where it sits next to notes you can read in place.
