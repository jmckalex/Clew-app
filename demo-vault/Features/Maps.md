# Maps

Interactive maps, Leaflet-plugin style: a ```` ```leaflet ```` fence with
`lat`, `long`, `zoom`, an optional `height`, and any number of
`marker:` lines. Tiles stream from OpenStreetMap (so the first view
needs a network connection); pan and zoom like any map. A marker's
third field is a popup label — or a `[[wikilink]]`, which opens the
note when clicked.

```leaflet
lat: 51.5074
long: -0.1278
zoom: 13
height: 380
marker: 51.5007, -0.1246, Westminster
marker: 51.5145, -0.1163, [[Welcome|The LSE, roughly]]
marker: 51.5194, -0.1270, The British Museum
```

Other config keys: `minZoom` / `maxZoom`, `tileServer:` (a custom
`{z}/{x}/{y}` tile URL), and `image: [[file.png]]`, which replaces the
world map with a vault image in its own pixel coordinates — a floor
plan, a hand-drawn fantasy map — fully offline, with the same markers.
