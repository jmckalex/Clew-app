#!/bin/bash
# smoke/make-custom-callout-vault.sh <dir> [theme]: a vault whose
# .clew/vault-settings.json defines custom callout types (a new one with an
# alias, a built-in recoloured, a pale colour that must be darkened on the
# light page, a navy one that must be lightened on the dark one) next to
# entries that must be REFUSED by name (a bad name, a colour carrying CSS,
# an unknown icon), and Callouts.md using each — plain, folded `-`, open `+`
# — plus `[!fresh]`, which nothing defines until callout-refresh-scenario.js
# writes it in, and Embed.md transcluding Callouts.md.
# The theme (dark | light, default dark) is written into a userData dir at
# <dir>-ud for custom-callout-scenario.js, which also lists the vault as
# known (trusted) there.
D=$1; T=${2:-dark}; rm -rf "$D" "$D-ud"; mkdir -p "$D/.clew" "$D-ud"
printf '{ "recentVaults": ["%s"], "theme": "%s" }\n' "$D" "$T" > "$D-ud/clew-settings.json"
cat > "$D/.clew/vault-settings.json" <<'JSON'
{
  "callouts": [
    { "name": "remark", "title": "Remark", "icon": "flask", "color": "#2e8b57", "aliases": ["rem"] },
    { "name": "warning", "color": "rebeccapurple", "icon": "regular:bell" },
    { "name": "pale", "icon": "lightbulb", "color": "#fff59d" },
    { "name": "deep", "icon": "anchor", "color": "navy" },
    { "name": "1bad", "color": "red" },
    { "name": "evil", "color": "red; background-image: url(https://evil.example/x.png)" },
    { "name": "nosuch", "icon": "no-such-icon-anywhere" }
  ]
}
JSON
cat > "$D/Callouts.md" <<'MD'
# Callouts

Before the callouts.

> [!remark]
> A custom type, untitled: its own title.

> [!REM] Given a title
> Through its alias, in capitals.

> [!rem]- Folded
> Hidden body.

> [!remark]+ Open foldable
> Shown body.

> [!warning]
> A built-in, recoloured and re-iconed.

> [!pale]
> Pale yellow.

> [!deep]
> Navy.

> [!note]
> A built-in left alone.

> [!evil]
> Refused: a plain quote.

> [!nosuch]
> Refused: a plain quote.

> [!fresh]
> Defined by hand, later (callout-refresh-scenario.js).

The end.
MD
printf '%s\n' '# Embed' '' '![[Callouts]]' '' 'After the embed.' > "$D/Embed.md"
