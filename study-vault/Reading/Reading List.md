# Reading List

An **editable table**: click a `status` or `rating` cell, type, press
Enter — the value is written into that book's note. (Escape cancels;
the first column always links to the note.)

```query
table: author, status, rating
from: Reading
sort: rating desc
```

The `where:` clause makes shelves — the good shelf:

```query
table: author, rating
from: Reading
where: rating >= 9
```
