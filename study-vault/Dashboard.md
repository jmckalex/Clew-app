# Dashboard

Live views over the whole vault. Every block below re-runs whenever any
note changes — edit a paper's frontmatter (or drag it on [[Pipeline]])
and watch this page follow.

## Due in the next month

```query
table: status, venue, due
where: due
where: due < today + 31d
sort: due asc
```

## Papers by status

```query
table: venue, due
from: Papers
group: status
```

## Reading now

```query
table: author, rating
from: Reading
where: status = reading
```

## Everything still to do

```tasks
not done
limit: 12
```
