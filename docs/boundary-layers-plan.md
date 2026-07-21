# Boundary Layers — Design & Implementation Plan

> Toggleable, note-sourced map overlays for political boundaries (modern now,
> historical later), with subtle hover highlighting and correct nested-region
> behavior. This document is the source of truth for the feature and the task
> list agents work from.

## 1. Goal

Use Map View as a base for **toggleable layers/views** of the map. The first
concrete use case: a set of **modern political boundaries** (countries, states,
counties) where:

- Each region is authored as an ordinary **note** containing an inline
  `geojson` polygon (notes are the source of truth).
- Each boundary "level" (country / state / county) is an independently
  **toggleable layer**.
- Hovering a region **animates in a subtle highlight** (fill fades in, fine
  border) with no rendering throttling.
- **Nested regions** (county inside state inside country) behave correctly —
  the innermost region under the cursor highlights.

This generalizes later to **historical boundaries** (a boundary layer with a
temporal query + time slider).

## 2. Locked design decisions

| Decision                            | Choice                                                                | Consequence                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| How a note declares its layer/level | **Tags** (`#boundary/country`, `#boundary/state`, `#boundary/county`) | Each level is `tag:#boundary/<level>`; reuses the query engine; extends to historical (`#boundary/1800`). |
| What highlights on hover            | **Innermost region only**                                             | No containment hierarchy needed. Pane z-order + native `mouseover`/`mouseout` does everything.            |
| Toggle granularity                  | **One toggle per level**                                              | Each level is a `BoundaryLayer` with its own pane, style, and checkbox.                                   |

## 3. How this maps onto the existing skeleton

The notes-as-boundary-sources model already exists: a note with a `locations:`
frontmatter key and an inline ` ```geojson ` block becomes a `GeoJsonLayer`
polygon (`src/geojsonLayer.ts`). The feature is built as **sugar over the
existing pipeline** (cache → query filter → display rules → render), _not_ as a
parallel Leaflet layer-control system.

- **Filtering** rides `MapContainer.filterMarkers` (`src/mapContainer.ts:926`).
- **Styling** rides the existing display-rule pipeline (`geojsonLayer.ts:80`).
- **Per-view toggle state** rides `MapState` (persisted in presets, embeds, URLs).
- **Hover** is done at the Leaflet-layer level (CSS class on the SVG `<path>`),
  which is inherently per-container.

Why not real `L.control.layers` / separate feature groups: everything currently
flows through **one** `MarkerClusterGroup` (`mapContainer.ts:602`) and **one**
query string. A parallel layer-group system would duplicate the whole
pipeline and the state model. Design-A (queries + display rules + a persisted
toggle set) rides the existing rails. Real layer groups become worth it only
later (many independent overlays / historical time slider); the `BoundaryLayer`
model generalizes to that cleanly.

## 4. Main constraints of the current system (design around these)

1. **Inline geojson requires a frontmatter `locations:` key.** `buildGeoJsonLayers`
   won't scan a note for a ` ```geojson ` block unless `hasFrontMatterLocations`
   is true (`geojsonLayer.ts:160` → `utils.ts:504`). Every boundary note needs
   `locations:` present.
2. **The singular `location:` spawns a centroid marker** (`fileMarker.ts:506`) —
   the unwanted "anchor". Boundary-note convention: **empty `locations:` key, no
   singular `location:`** → polygon renders, no pin.
3. **`tag:` for a `GeoJsonLayer` matches only `layer.tags`** (`query.ts:90`), and
   those are populated _only_ from tags appended inline after the geojson block
   (`geojsonLayer.ts:186`) — **not** the note's frontmatter/body tags. A
   `FileMarker` inherits note tags via `getAllTags` (`fileMarker.ts:510`); a
   `GeoJsonLayer` does not. **This must be fixed** for the tag-based model
   (Task A). `layer.tags` and `getAllTags` both use the `#tag` form, so merging
   is format-safe.
4. **One cluster group + one query string.** No native per-layer visibility;
   toggling _is_ query participation. Hence a **separate** `enabledBoundaryLayerIds`
   field on `MapState` (do **not** cram toggles into the query string).
5. **Display rules are global and applied at cache-build time** (`geojsonLayer.ts:231`),
   not per-view. Base styling is shared across open maps (fine). **Hover styling
   must live at the Leaflet-layer level** (CSS class / `setStyle`), never in
   display rules.
6. **Layer diffing reuses unchanged layers** via `isSame` (`mapContainer.ts:958`,
   `geojsonLayer.ts:70`). Toggling add/removes layers — fine. Style changes from
   hover must be Leaflet-level (`isSame` won't detect them and won't re-diff).
7. **Polygons are NOT clustered** — Leaflet.markercluster drops non-point layers
   into a plain `_nonPointGroup` `FeatureGroup` in the default `overlayPane`.
   Two implications: (a) **we fully control z-order** (good for nesting), and
   (b) **no viewport culling** — every enabled polygon is a live SVG path.
   Hundreds of detailed boundaries = many SVG nodes = the real perf ceiling.
8. **The hover-popup system is already fragile** — there is an explicit polling
   work-around to force-close stuck popups (`mapContainer.ts:812`). Hover
   highlight must self-heal on a missed `mouseout` (clear-all-then-set on enter).
9. **Geojson `properties.stroke/fill` are ignored** — style comes only from
   `pathOptions`. `newLeafletGeoJson` hardcodes the `MarkerPopup` with `'mouse'`
   placement and an always-on elevation chart (`mapContainer.ts:2000-2069`).

## 5. Hover highlight — subtle, fine border (CSS-class driven)

Follow the existing idiom (`setHighlight` toggles `HIGHLIGHT_CLASS_NAME`,
`consts.ts:45`). Each polygon is `<path class="leaflet-interactive">`;
`layer.getElement()` returns it.

- Set the **border color** via `pathOptions` (per-layer, becomes an SVG attribute).
- **Own `fill-opacity` / `stroke-width` / `stroke-opacity` in CSS classes**, not
  inline — a CSS rule outranks Leaflet's presentation attributes in the cascade:

    ```css
    .mv-boundary {
        fill-opacity: 0;
        stroke-width: 1;
        transition:
            fill-opacity 0.15s ease,
            stroke-width 0.15s ease;
    }
    .mv-boundary-hover {
        fill-opacity: 0.12;
        stroke-width: 1.5;
    }
    ```

- On `mouseover` add `mv-boundary-hover`; on `mouseout` remove it. **The browser
  tweens it** — zero JS frames.
- SVG fact that makes "invisible until hover" work: with `fill: true` and
  Leaflet's `pointer-events: auto`, a polygon with `fill-opacity: 0` is **still
  fully hoverable across its area** (hit-testing keys off `fill != none`, not
  opacity). So the whole region is the hover target while invisible.

Default UX: a fine always-visible border (regions are discoverable) with the
fill fading in on hover.

## 6. Throttling — delegate hit-testing to the browser

The instinct to worry about throttling is right; the fix is **not** to debounce
mouse math but to avoid doing any:

- **Never bind `mousemove`; never do point-in-polygon hit testing.** That is the
  only thing that throttles.
- Leaflet path `mouseover`/`mouseout` are **edge-triggered by native SVG
  hit-testing** — once on enter, once on leave, regardless of pixels crossed.
  Highlighting on them is O(1) per region. The browser's hit-testing _is_ the
  "smart mouse position" logic — delegated for free.
- The visual change is CSS → no JS. **No debounce needed for the highlight.**
- Adding an already-present class is a no-op → no churn.
- The **one** timer: a ~100 ms **hover-intent debounce on the note popup** only
  (it runs `MarkdownRenderer`), built once on `mouseover`, cancelled on
  `mouseout` before it fires.

The real scaling lever is **SVG node count** (constraint #7) → geometry
simplification + zoom-gating (Phase 3), not mouse throttling.

## 7. Nested regions

County-inside-state-inside-country: interactive fills overlap, so whichever
`<path>` is **on top** at a pixel wins the event. Uncontrolled, hover is random
or the country eats everything.

- **Deterministic z-order via a dedicated Leaflet pane per level.**
  `map.createPane('mv-boundary-<level>')` with ascending `zIndex`
  (smaller/more-nested regions on top). Assign each geojson to the pane for its
  level. Panes give stable stacking that survives re-adds — cleaner than
  `bringToFront` wars, and polygons already live in the overlay pane.
- **Hover then targets the innermost region for free** — it is in the highest
  pane, so `mouseover` fires on the county; the state underneath gets nothing
  until the cursor reaches its exposed area (then child `mouseout` + parent
  `mouseover`). No containment math (innermost-only decision).
- **Toggles stay independent** — counties keep working even if the state layer
  is off (independent panes/levels).
- Minor: coincident parent/child borders can double-darken; nudge child stroke
  thinner or accept it. Enclaves authored as separate notes become a
  higher-pane region on top — handled.

Authoring: each note's level tag (`#boundary/state`) maps to pane + style via the
`BoundaryLayer` config.

## 8. Authoring convention for a boundary note

````yaml
---
locations: # required: enables geojson parsing; empty = no centroid pin
aliases:
    - Pennsylvania
tags:
    - boundary/state # drives the region's level (Task A makes this match)
---
# Pennsylvania

​```geojson
{ ...Polygon... }
​```
````

- **No singular `location:`** → no unwanted centroid marker.
- One `geojson` block per note.

## 9. Data model

```ts
// settings.ts
type BoundaryLayer = {
    id: string; // stable id, e.g. 'boundary-state'
    name: string; // 'States'
    query: string; // 'tag:#boundary/state'
    level: number; // 0=country, 1=state, 2=county … pane z-order
    enabledByDefault: boolean;
    style: PathOptions; // fine border: { color, weight: 1, fillOpacity: 0 }
    hoverStyle?: PathOptions; // reserved; hover is primarily CSS-driven
};
// PluginSettings gains: boundaryLayers: BoundaryLayer[]

// mapState.ts
// MapState gains: enabledBoundaryLayerIds: string[]   (persisted per view/embed/URL/preset)
```

## 10. Task list & dependency graph

Phases are a **chain** (0 → 1 → 2 → 3); parallelism exists **within** the early
work where file ownership is disjoint.

```
Wave 1 (parallel — disjoint files):
  A. geojson inherits note tags        [src/geojsonLayer.ts]
  B. MarkerPopup geojson fix           [src/components/MarkerPopup.svelte]
  C. data model (types + state)        [src/settings.ts, src/mapState.ts]
        │
        ▼
Wave 2 (sequential — shares mapContainer.ts, depends on C):
  D. filter integration (enabled layers only)   [mapContainer.ts]
  E. settings UI to edit boundary layers        [settingsTab.ts / Svelte]
  F. "Layers" toggle section                    [ViewControlsPanel.svelte]
        │
        ▼
Wave 3 (sequential — depends on D/F):
  G. per-level panes + z-order                  [mapContainer.ts]
  H. CSS hover classes + wire mouseover/out     [css + mapContainer.ts]
  I. hover-intent-debounced boundary popup      [mapContainer.ts / MarkerPopup]
        │
        ▼
Wave 4 (later): perf (simplify/zoom-gate), then historical (temporal + slider)
```

### Task A — GeoJsonLayer inherits note tags

**File:** `src/geojsonLayer.ts` (+ test `tests/geojsonLayer.test.ts`)
**Do:** In `buildGeoJsonLayers`, after building each md/inline layer, merge the
note's tags (`getAllTags` from the file's `CachedMetadata`) into `layer.tags`,
de-duplicated, alongside any inline geojson-block tags. Preserve existing
inline-tag behavior. Both sources use the `#tag` form.
**Done when:** a note tagged `#boundary/state` (frontmatter/body) whose inline
geojson has no inline tags matches `tag:#boundary/state`; inline-only tags still
work; a test covers note-tag inheritance.

### Task B — MarkerPopup geojson fix

**File:** `src/components/MarkerPopup.svelte`
**Do:** (1) Only set `showElevation` when the geometry actually has elevation
(z) values — a region polygon must not render a blank chart; GPX tracks with
elevation keep the chart. (2) For an inline-geojson layer in an `.md` file
(`sourceType === 'geojson'`, `fileLine != null`), build the note preview from the
**note's content** via `extractSnippet(content, N, layer.fileLine)` (like
`FileMarker`), falling back to `layer.text` (`properties.desc`) for standalone
`.geojson`/gpx. Keep Svelte 5 runes.
**Done when:** hovering the Pennsylvania region shows the note body around the
geojson block and shows **no** elevation chart; a gpx track still shows its chart.

### Task C — Data model (types + state plumbing)

**Files:** `src/settings.ts`, `src/mapState.ts` (+ test `tests/mapState.test.ts`)
**Do:** Add the `BoundaryLayer` type and `boundaryLayers: BoundaryLayer[]` to
`PluginSettings` + `DEFAULT_SETTINGS` (example country/state/county entries,
levels 0/1/2, `tag:#boundary/<level>` queries, fine-border styles). Add
`enabledBoundaryLayerIds: string[]` to `MapState`; default `[]` in
`DEFAULT_SETTINGS.defaultState`; wire through `areStatesEqual` (order-insensitive
set compare), `stateToRawObject`/`stateToUrl`, `stateFromParsedUrl`, and
`getCodeBlock`. No rendering behavior yet.
**Done when:** types compile; `defaultState` has the field; the enabled-id set
round-trips through URL serialization; `areStatesEqual` treats different enabled
sets as different; a test covers the round-trip.

> Wave 1 tasks touch disjoint files and are safe to implement in parallel. Do
> **not** run `git` or a production build inside a task; the integrator builds and
> verifies all changes together, then proceeds to Wave 2.
