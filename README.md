# Asteroid Cluster Map

A lightweight web app that renders a 30x30 hex map for a fictional asteroid cluster. The page loads POI data from `data/pois.json`, maps each POI to a hex cell, and draws a custom icon plus a visible title inside the corresponding hex.

## Run locally

From the project directory, start a simple static server:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Customize POIs

Edit the `data/pois.json` file to change:

- the hex coordinates (`row`, `col`)
- the displayed icon (`icon`)
- the visible title (`title`)

The map is intentionally plain HTML/CSS/JS, so it is easy to modify for your own D&D campaign map.
