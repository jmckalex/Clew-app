#!/bin/bash
# smoke/make-callout-vault.sh <dir>: Callouts.md for callout-geometry-scenario.js —
# the owner's ph341 callout first (titled, foldable +, a numbered list whose
# second item wraps, a blank `>` line, then a paragraph), then a spread: an
# untitled one-liner, a folded `-` one, a nested list, a code block, a quote,
# a heading, maths, and a callout inside a callout.
D=$1; rm -rf "$D"; mkdir -p "$D/.clew"
cat > "$D/Callouts.md" <<'MD'
# Callouts

Before the callouts, a paragraph of prose long enough to set the column: it runs on so that the reader sees where the text column starts and ends.

> [!note]+ Argument
> 1. Identity research in psychology and sociology is broad and diverse.
> 2. Akerlof and Kranton take one strand of it and fit it into the standard utility framework without modifying that framework.
>
> *Conclusion:* It is an open question whether the framework shaped what was imported, and whether the import repairs the framework's existing lack of an account of personal identity.

Between the callouts.

> [!tip]
> A one-line tip.

> [!warning]- Folded at first
> Hidden until opened.

> [!example] Lists
> - First
>   - Nested
> - Second

> [!info] Code and maths
> Inline $x^2$ and a block:
>
> ```js
> const x = 1;
> ```

> [!quote] A quote and a heading
> ### Heading inside
> > Quoted inside.

> [!abstract] Outer
> Outer text.
>
> > [!danger] Inner
> > Inner text.

After the callouts.
MD
