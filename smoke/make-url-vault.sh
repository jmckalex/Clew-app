#!/bin/bash
# smoke/make-url-vault.sh <dir>: Urls.md for bare-url-scenario.js — the
# slash cases of jmarkdown 3134543 (bare URLs, paths, and/or, fractions,
# which the engine used to italicise) and the cases that must stay italic,
# one per paragraph and keyed `Kn:` so reading and live can be compared
# line by line; plus a list, a table and an inline footnote.
D=$1; rm -rf "$D"; mkdir -p "$D/.clew"
cat > "$D/Urls.md" <<'MD'
# Urls

K1: see https://a.com/b/c?q=1&r=2#frag for this

K2: at the end https://a.com/x/y.

K3: in (/usr/local/bin/) parens

K4: either and/or both

K5: fractions 1/2/3 here

K6: paths ~/notes/ ./src/ ../lib/ C:/Users/x/

K7: www.example.com/a/b/ here

K8: ftp://files.example.org/pub/x/ ok

K9: mail me@example.com ok

K10: x https://example.com/foo-/bar/ y

K11: a /italic phrase/ here

K12: in (/word/) parens

K13: a /word/. dot

K14: in "/quoted/" quotes

K15: a /a *b* c/ nested

K16: [link /it/ text](https://example.com/l/) linked

K17: see /tmp/ here

/K18/ at the start and at the end /line/

- K19: list /item/ and https://li.example.com/p/q/
- K20: list and/or 1/2

| K21 | other |
| --- | --- |
| a /cell/ here | https://t.example.com/a/b/ and/or |

K22: Text[^n: with /foot/ and https://f.example.com/x/ inside.] after.

@reveal[http://localhost:8888/prez/teaching/ph341/econ-and-id/]{height='450px'}

The end.
MD
