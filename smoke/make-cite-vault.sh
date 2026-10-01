#!/bin/bash
# smoke/make-cite-vault.sh <dir>: a vault for cite-pill-scenario.js — refs.bib
# (two authors under a key with / and :, three authors, one); Cites.md, a
# chicago header and one paragraph per citation form, the last an unknown key;
# Plain.md, no header, under the VAULT's bibliography in a numeric style
# (vancouver numbers by first citation — the order a batch must keep);
# Many.md, 300 citations under Cites.md's header (cite-perf-scenario.js);
# lewis.pdf, lewis1969's `file` (cite-hover-scenario.js's ⌘-click).
D=$1; rm -rf "$D"; mkdir -p "$D/.clew"
cat > "$D/refs.bib" <<'BIB'
@Article{Akerlof/Kranton:2000,
  author = {Akerlof, George A. and Kranton, Rachel E.},
  title = {Economics and Identity},
  journal = {The Quarterly Journal of Economics},
  year = {2000},
  volume = {115},
  pages = {715--753}
}

@Book{lewis1969,
  author = {David Lewis},
  title = {Convention: A Philosophical Study},
  publisher = {Harvard University Press},
  year = {1969},
  file = {lewis.pdf}
}

@Article{smith2001,
  author = {Smith, Adam and Jones, Bea and Brown, Carl},
  title = {Three Authors Agree},
  journal = {Journal of Agreement},
  year = {2001}
}
BIB
cat > "$D/Cites.md" <<'MD'
---
Bibliography: refs.bib
Resolve citations: true
Bibliography style: chicago
---
# Cites

See [[Plain]] for the numeric style.

A \cite{Akerlof/Kranton:2000} here.

B \citep{smith2001} here.

C \citet{lewis1969} here.

D \citeauthor{smith2001} here.

E \citeyear{lewis1969} here.

F \cite[p. 5]{lewis1969} here.

G \citep[see][p. 7]{Akerlof/Kranton:2000} here.

H \citep{lewis1969, smith2001} here.

I \cite{nosuchkey} here.
MD
cp "$(dirname "$0")/../demo-vault/Attachments/sample.pdf" "$D/lewis.pdf"
cat > "$D/Plain.md" <<'MD'
# Plain

A \cite{smith2001} here.

B \citep{lewis1969} here.

C \cite{Akerlof/Kranton:2000, smith2001} here.

D \cite{nosuchkey} here.
MD
cat > "$D/.clew/vault-settings.json" <<'JSON'
{ "bibliography": "refs.bib", "bibliographyStyle": "vancouver" }
JSON
node -e "
const forms = ['\\\\cite{Akerlof/Kranton:2000}', '\\\\citep{smith2001}', '\\\\citet{lewis1969}', '\\\\citep[p. 5]{lewis1969, smith2001}', '\\\\citeauthor{smith2001}'];
const lines = ['---', 'Bibliography: refs.bib', 'Resolve citations: true', 'Bibliography style: chicago', '---', '# Many', ''];
for (let i = 0; i < 60; i++) lines.push('Paragraph ' + i + ' cites ' + forms.join(' and ') + ' in turn.', '');
require('fs').writeFileSync(process.argv[1] + '/Many.md', lines.join('\\n'));
" "$D"
