#!/bin/bash
# smoke/make-page-number-pdfs.sh <dir> — the LaTeX PDFs that hold
# quote-and-cite's printed-page reader to its job (pdf-printed-scenario.js
# over make-printed-vault.mjs): LaTeX's default `article` numbers its pages in
# a footer well up from the bottom edge, outside a fixed 12% band.
#   article-letter.pdf        letter page and layout, p. 57 on PDF p. 1
#   article-a4.pdf            the same on A4
#   article-12pt-letter.pdf   12pt, letter
#   lone-numbered.pdf         a body of lone numbers (a one-column table,
#                             every row a number) WITH page numbers, p. 11 on
#                             PDF p. 1 — and a letter layout on pdflatex's
#                             default A4 page, the footer at 84% of its height
#   lone-empty.pdf            the same body, NO page numbers: must stay the
#                             PDF page
# Needs pdflatex and lipsum (TeX Live).
set -e
dir=${1:?usage: make-page-number-pdfs.sh <dir>}
mkdir -p "$dir" && cd "$dir"
article() {   # <name> <class options> — 45 paragraphs, numbered from 57
	cat > "$1.tex" <<TEX
\\documentclass[$2]{article}
\\usepackage{lipsum}\\pdfpagewidth=\\paperwidth \\pdfpageheight=\\paperheight
\\begin{document}
\\setcounter{page}{57}
\\section{Introduction}
\\lipsum[1-45]
\\end{document}
TEX
}
article article-letter letterpaper
article article-a4 a4paper
article article-12pt-letter 12pt,letterpaper
lone() {      # <name> <preamble line> <first-page line> <what>
	{
		printf '%s\n' '\documentclass{article}' '\usepackage{longtable}' "$2" '\begin{document}' "$3"
		printf 'A document %s, whose body is full of lone numbers.\n' "$4"
		printf '%s\n' '\begin{longtable}{r}'
		for i in $(seq 1 330); do printf '%d \\\\\n' $((i * 3)); done
		printf '%s\n' '\end{longtable}' '\end{document}'
	} > "$1.tex"
}
lone lone-numbered '\setcounter{page}{11}' '' 'with page numbers'
lone lone-empty '\pagestyle{empty}' '\thispagestyle{empty}' 'with no page numbers'
for f in article-letter article-a4 article-12pt-letter lone-numbered lone-empty; do
	pdflatex -interaction=batchmode "$f.tex" >/dev/null 2>&1 || true
	pdflatex -interaction=batchmode "$f.tex" >/dev/null 2>&1 || true
	echo "$f.pdf: $(pdfinfo "$f.pdf" 2>/dev/null | grep -E 'Pages' | tr -s ' ')"
done
