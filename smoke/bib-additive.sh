#!/bin/bash
# smoke/bib-additive.sh <out-dir> [engines] — bib-additive-scenario.js on its
# own fixture (make-bib-vault.mjs), and the PDFs it exports read from OUTSIDE
# with pdftotext. A PDF via LaTeX is built in a temporary folder and only the
# PDF lands (export.js, since 2026-10-10), so the .tex, .log and .blg the
# scenario used to read beside it are not there: until 2026-10-20 it logged
# `bibliography=none undefined=0` for every note, whatever the PDF said.
#
#   node scripts/build.js && smoke/bib-additive.sh <out-dir> [pdflatex,lualatex]
#
# HOME is an empty folder of the run's own — the owner's ~/.jmarkdown loads
# fontspec, which no pdfLaTeX run survives — and the vault is TRUSTED through
# the profile's recentVaults (a restricted vault's PDF via LaTeX is refused).
# Prints the scenario's `smoke-bib:` lines, then for each PDF
#
#   pdf <engine> <note>: undefined=<natbib's ? marks> titles=<the fixture's
#       titles its references list holds, in the fixture's order>
#
# and fails by name (exit 1) a PDF that is not as EXPECT says, one that was
# never written, and a run that never started.
set -u
R=$(cd "$(dirname "$0")/.." && pwd); O=${1:?usage: bib-additive.sh <out-dir> [engines]}; ENGINES=${2:-pdflatex,lualatex}
(cd "$R" && node scripts/stale-check.mjs) || { echo "bib-additive: dist/ is not built from these sources — nothing was run" >&2; exit 3; }
case "$O" in /|"$HOME"|"$HOME/"|.|..) echo "bib-additive: refusing to clear $O" >&2; exit 1;; esac
command -v pdftotext >/dev/null || { echo "bib-additive: pdftotext is not installed (poppler)" >&2; exit 3; }
rm -rf "$O"; mkdir -p "$O/home"; cd "$R"
. smoke/sweep-lib.sh
E=node_modules/electron/dist/Electron.app/Contents/MacOS/Electron

V=$O/vault
node smoke/make-bib-vault.mjs "$V" >/dev/null && printf '%s\n' "$ENGINES" > "$V/bib-engines.txt"
UD=$(sweep_ud bib)
printf '{ "recentVaults": ["%s"] }\n' "$V" > "$UD/clew-settings.json"
env HOME="$O/home" CLEW_SMOKE_LOG=1 CLEW_USER_DATA="$UD" CLEW_SMOKE="$O/bib.png" CLEW_SMOKE_SCRIPT="$R/smoke/bib-additive-scenario.js" CLEW_SMOKE_VAULT="$V" \
	perl -e 'alarm shift; exec @ARGV' 600 $E . > "$O/bib.log" 2>&1
grep -h "smoke-bib:" "$O/bib.log" | sed -E 's/^\[smoke:[a-z]+\] //' | cut -c1-200
sweep_booted bib-additive "$O/bib.log"

# What each note's PDF must hold. The configured (vault's) file comes first,
# the note's after it, a later file winning a key both hold (jmarkdown
# 909af7a): Paper's shared:1999 is the note's "Note Title"; Replace drops the
# vault's file, so vaultonly is natbib's one `?`; Split's two files sit in two
# folders (BIBINPUTS); Merge names the vault's file again after its own, so
# its shared:1999 is the vault's "Vault Title". vaultonly:2001's title is
# "Edited In The Vault" by then: the scenario's restale step edits vault.bib
# before it exports.
TITLES=("Edited In The Vault" "Vault Title" "Only In The Note" "Note Title" "In Another Folder" "Beside The Note")
expect() {
	case $1 in
		Paper) echo "undefined=0 titles=Edited In The Vault|Only In The Note|Note Title" ;;
		Replace) echo "undefined=1 titles=Only In The Note|Note Title" ;;
		Cites) echo "undefined=0 titles=Edited In The Vault" ;;
		Split) echo "undefined=0 titles=In Another Folder|Beside The Note" ;;
		Merge) echo "undefined=0 titles=Edited In The Vault|Vault Title|Only In The Note" ;;
	esac
}
for engine in ${ENGINES//,/ }; do
	for note in Paper Replace Cites Split Merge; do
		pdf=$V/out/$note-$engine.pdf
		if [ ! -s "$pdf" ]; then echo "!!! pdf $engine $note: NO PDF"; sweep_failed "$engine-$note"; continue; fi
		text=$(pdftotext "$pdf" - 2>/dev/null)
		# natbib prints an undefined citation as a bold `?`; the fixture's notes
		# hold no question mark of their own.
		undefined=$(printf '%s' "$text" | grep -oE '(^|[[:space:]])\?([[:space:],.;)]|$)' | wc -l | tr -d ' ')
		found=""; for t in "${TITLES[@]}"; do printf '%s' "$text" | tr '\n' ' ' | grep -qF "$t" && found="$found${found:+|}$t"; done
		line="undefined=$undefined titles=$found"
		echo "pdf $engine $note: $line"
		[ "$line" = "$(expect $note)" ] || { echo "!!! pdf $engine $note: want $(expect $note)"; sweep_failed "$engine-$note"; }
	done
done
sweep_verdict bib-additive
