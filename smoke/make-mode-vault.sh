#!/bin/bash
# smoke/make-mode-vault.sh <dir>: the fixture for the tab-strip mode switch
# (mode-buttons-, mode-split- and toolbar-panes-scenario.js): Long.md (120
# paragraphs, to scroll), Other.md, Frames.md (a mermaid block: a live-edit
# block frame), N01–N24.md (a crowded strip), a canvas
# and a .bib (tabs with no modes); and a second vault at <dir>-2 whose
# Welcome.md opens by itself in its own window.
D=$1; rm -rf "$D" "$D-2"; mkdir -p "$D/.clew" "$D-2/.clew"
node -e "require('fs').writeFileSync(process.argv[1] + '/Long.md', '# Long\n\n' + Array.from({length: 120}, (_, i) => 'Line ' + i + ' of the note, long enough to read.').join('\n\n') + '\n')" "$D"
printf '# Other\n\nThe other note, with *strong* text.\n' > "$D/Other.md"
printf '# Frames\n\nA diagram live edit draws in a block frame:\n\n```mermaid\ngraph LR\n  A --> B\n```\n\nAfter it.\n' > "$D/Frames.md"
for i in $(seq -w 1 24); do printf '# Note %s\n\nShort.\n' "$i" > "$D/N$i.md"; done
printf '{"nodes":[{"id":"a","type":"text","text":"Card","x":0,"y":0,"width":200,"height":80}],"edges":[]}\n' > "$D/Board.canvas"
printf '@book{lewis1969,\n  author = {Lewis, David},\n  title = {Convention},\n  year = {1969}\n}\n' > "$D/refs.bib"
printf '# Welcome\n\nThe second window'"'"'s note.\n' > "$D-2/Welcome.md"
