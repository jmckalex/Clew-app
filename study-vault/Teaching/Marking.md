# Marking

Three frontmatter keys (`course`, `marked`, `grade`) and the pile
manages itself. The `marked` cells are editable — type `true` when an
essay is done, or put the grade straight into the table.

```query
table: course, marked, grade
from: Teaching
where: marked = false
```

## The whole cohort

```query
table: course, marked, grade
from: Teaching
sort: name asc
```
