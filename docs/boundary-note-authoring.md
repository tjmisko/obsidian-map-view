# Authoring boundary notes

A boundary region is an ordinary note in your vault with three ingredients:

1. a **`locations:` frontmatter key** (leave it empty) — this is what tells Map
   View to scan the note for a geojson block at all,
2. a **`#boundary/<level>` tag** identifying which layer the region belongs to,
3. **one fenced `geojson` block** containing the region's polygon.

> **Do not add a singular `location:` key.** That drops a pin at the note's
> coordinate (the "anchor"). A boundary region should be the polygon only, with
> no marker.

## Tags per layer

Tag each note with exactly one of these (these are the defaults; edit them under
Settings → Boundary Layers):

| Region kind | Tag                 | Layer name | Level |
| ----------- | ------------------- | ---------- | ----- |
| Country     | `#boundary/country` | Countries  | 0     |
| State       | `#boundary/state`   | States     | 1     |
| County      | `#boundary/county`  | Counties   | 2     |

The tag can go **in frontmatter `tags:`** (write it _without_ the `#`, e.g.
`boundary/state`) **or inline in the note body** (`#boundary/state`). Either
works — Map View reads the note's own tags for geojson regions.

**Nesting is by level.** Higher levels draw on top: counties (2) sit above
states (1) above countries (0). So when regions overlap, hovering a county
highlights the county, not the state beneath it. If you add your own levels
(e.g. a city layer), give them the next level number.

## Minimal example

````markdown
---
locations:
tags:
    - boundary/state
---

# Example State

​`geojson
{"type":"Feature","properties":{"name":"Example State"},"geometry":{"type":"Polygon","coordinates":[[[-80,40],[-75,40],[-75,42],[-80,42],[-80,40]]]}}
​`
````

That note becomes a fillable region on the **States** layer: a fine border that
fades in a subtle fill when you hover it, with no pin.

## Turning layers on and off

Open a map → the **Layers** section of the controls panel → toggle
Countries / States / Counties. The toggle state is per-view and is saved with
presets, embeds, and shared map URLs.

## Adding or customizing layers

Settings → **Boundary Layers** lets you:

- rename a layer,
- change its **tag query** (e.g. point the States layer at a different tag),
- set the **border color** and **weight**,
- set the **nesting level**,
- **add a new level** (e.g. `#boundary/city`) or remove one.

Each layer's `id` is a stable key used by saved view state, so it is shown but
not editable.

## Quick checklist

- [ ] `locations:` key present in frontmatter (empty is fine)
- [ ] **no** singular `location:` key
- [ ] a `#boundary/<level>` tag (frontmatter `tags:` or inline)
- [ ] exactly one `geojson` block with the polygon
- [ ] the matching layer is enabled in the map's **Layers** panel
