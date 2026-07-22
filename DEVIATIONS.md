# Deviations from upstream

This repository is a fork of [esm7/obsidian-map-view](https://github.com/esm7/obsidian-map-view).
This file catalogs everything this fork adds or changes on top of upstream, so
the custom surface stays legible and rebasing onto future upstream releases is
tractable.

- **Upstream baseline:** `esm7/obsidian-map-view` `master` @ `1008df8` ("Skill
  update"), package version **6.1.4**.
- **Nature of the deviation:** one cohesive feature arc — **boundary layers**
  (note-sourced political/region overlays) — plus the interaction, styling, and
  per-note-color work that grew out of it.

Keep this file updated when you add another deviation. To see the raw diff at
any time: `git diff origin/master..HEAD`.

---

## 1. Feature: Boundary layers

Turns notes into toggleable region overlays (countries, states, counties,
cities). Each "level" is an independently toggleable layer whose regions are
selected by a query and drawn with a fine border and a light fill.

**Authoring convention** (see `docs/boundary-note-authoring.md`): a boundary
note has an empty `locations:` key (enables geojson parsing, no centroid pin),
exactly one `#boundary/<level>` tag, and one inline `geojson` block.

**Default levels** (in `DEFAULT_SETTINGS.boundaryLayers`):

| Layer     | id                 | Tag                 | Level | Color     |
| --------- | ------------------ | ------------------- | ----- | --------- |
| Countries | `boundary-country` | `#boundary/country` | 0     | `#c0392b` |
| States    | `boundary-state`   | `#boundary/state`   | 1     | `#2980b9` |
| Counties  | `boundary-county`  | `#boundary/county`  | 2     | `#27ae60` |
| Cities    | `boundary-city`    | `#boundary/city`    | 3     | `#8e44ad` |

Levels drive z-order: higher level → higher Leaflet pane → drawn on top and wins
native hover hit-testing, so the **smallest / most-nested region is on top**.

**Rendering integration:** boundary regions reuse the existing
cache → query-filter → display-rules → render pipeline. They are `GeoJsonLayer`s
whose belonging is decided by matching each boundary layer's query
(`getBoundaryLayerForLayer`). Per-level panes are named `mv-boundary-pane-<level>`
with z-index `410 + level` (below the marker pane at 600).

**Per-view toggle state** rides `MapState.enabledBoundaryLayerIds` (persisted in
embeds, presets, and view URLs). Toggles are exposed in the map controls under a
**Layers** section.

**Note-level default for embeds:** an embedded `mapview` inside a boundary note
defaults that note's own level on, so the region you're reading about shows
without a manual toggle. Applied only when the code block does **not** pin a
non-empty `enabledBoundaryLayerIds` (empty/missing is treated as "unspecified").
Consequence: a boundary note's embed always shows at least its own region.

**Settings migration:** `loadSettings` calls `ensureDefaultBoundaryLayers`,
which appends any built-in boundary layer (by stable `id`) missing from saved
settings. Non-destructive — never edits or removes user layers. This is how a
`data.json` predating a newly-added level (e.g. Cities) still gets it.

## 2. Feature: Per-note `map-color` frontmatter

A note can set a frontmatter property to a CSS color to override how it's drawn
on the map — its marker, its paths/regions, and its boundary outline + fill —
winning over display rules and the boundary layer's own color.

- The property name is configurable: setting `frontMatterColorKey`, default
  `map-color` (mirrors the existing `frontMatterKey` for locations).
- Applied last in `DisplayRulesCache.runOn` (marker + path color) and again in
  `newLeafletGeoJson` after the boundary style (so it beats the boundary color).
- Helper: `utils.getFrontMatterColorOverride`.
- Note: the marker library renders **named** colors best; hex works cleanly for
  paths/regions.

## 3. Interaction & styling changes

- **Click-to-pin regions.** Clicking a boundary region opens its note popup and
  gives the region a persistent selection highlight (`mv-boundary-selected`),
  driven by selection state — not `:hover` — so the popup stays reachable with
  the mouse. Clicking it again, clicking the map, pressing <kbd>Escape</kbd>, or
  closing the popup unpins. (Escape is a document capture-phase listener active
  only while a region is pinned, so it closes the popup before Obsidian acts on
  the key.)
- **Hover is a cue only.** Mouseover fades the fill in (`mv-boundary-hover`) for
  discoverability but no longer opens the popup.
- **Light resting fill.** Boundary regions have a nonzero resting
  `fill-opacity: 0.07` (hover `0.12`, selected `0.18`), so regions read as filled
  areas, not just outlines. All in `styles.css`.
- **Horizontal-scroll pan.** Horizontal mouse-wheel / trackpad scroll pans the
  map left–right (Leaflet keeps vertical scroll for zoom). Respects a locked map.
- **Right-click nested-region select.** Right-clicking a boundary region lists
  every boundary polygon stacked under the cursor ("Select region: <name>",
  smallest-first) so an occluded larger region is still reachable. Uses
  point-in-polygon (`utils.isPointInGeometry`) and `utils.geometryArea`.

## 4. Data-model & settings additions

- `PluginSettings.boundaryLayers: BoundaryLayer[]` and the `BoundaryLayer` type
  (`src/settings.ts`).
- `PluginSettings.frontMatterColorKey: string` (default `map-color`).
- `MapState.enabledBoundaryLayerIds: string[]`, wired through `mergeStates`,
  `areStatesEqual` (order-insensitive set compare), `stateToRawObject`,
  `stateFromParsedUrl`, and `getCodeBlock` (`src/mapState.ts`).
- `DEFAULT_SETTINGS.defaultState.enabledBoundaryLayerIds` seeds the default
  enabled set.
- Boundary CSS class-name constants in `src/consts.ts`
  (`BOUNDARY_CLASS_NAME`, `BOUNDARY_HOVER_CLASS_NAME`,
  `BOUNDARY_SELECTED_CLASS_NAME`).

## 5. New files

| File                              | Purpose                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/boundaryLayers.ts`           | Pure boundary logic: `filterOutDisabledBoundaryLayers`, `getBoundaryLayerForLayer`, `boundaryPaneName`, `boundaryLayerIdForNote`. |
| `docs/boundary-layers-plan.md`    | Design & implementation plan for the feature.                                                                                     |
| `docs/boundary-note-authoring.md` | How to tag a note as a boundary region.                                                                                           |
| `tests/boundaryLayers.test.ts`    | Tests for the boundary logic helpers.                                                                                             |
| `tests/geometryUtils.test.ts`     | Tests for point-in-polygon and area helpers.                                                                                      |

## 6. Modified upstream files

| File                                                                                      | What changed                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/settings.ts`                                                                         | `BoundaryLayer` type; `boundaryLayers` + `frontMatterColorKey` settings; `DEFAULT_SETTINGS` boundary layers and default enabled ids.                                |
| `src/mapState.ts`                                                                         | `enabledBoundaryLayerIds` field + (de)serialization + set-wise equality.                                                                                            |
| `src/mapContainer.ts`                                                                     | Boundary rendering with per-level panes; click-to-pin selection + hover cue; horizontal-scroll pan; `map-color` override at render; right-click nested-region menu. |
| `src/main.ts`                                                                             | Boundary-layer settings migration; note-level boundary default for embeds; passes settings to `DisplayRulesCache`.                                                  |
| `src/displayRulesCache.ts`                                                                | Takes `settings`; applies the `map-color` frontmatter override to marker + path color.                                                                              |
| `src/utils.ts`                                                                            | `getFrontMatterColorOverride`, `isPointInGeometry`, `geometryArea`.                                                                                                 |
| `src/consts.ts`                                                                           | Boundary CSS class-name constants.                                                                                                                                  |
| `src/settingsTab.ts`                                                                      | Boundary-layers editor UI; `map-color` key setting.                                                                                                                 |
| `src/geojsonLayer.ts`                                                                     | Inherit a note's own tags onto its geojson layers so `tag:` queries match regions.                                                                                  |
| `src/components/MarkerPopup.svelte`                                                       | Show note body for geojson region popups; gate the elevation chart to tracks with elevation.                                                                        |
| `src/components/ViewControlsPanel.svelte`                                                 | **Layers** toggle section in map controls.                                                                                                                          |
| `src/components/DisplayRules.svelte`                                                      | Pass `settings` to `DisplayRulesCache`.                                                                                                                             |
| `styles.css`                                                                              | `.mv-boundary` resting/hover/selected fill + transitions.                                                                                                           |
| `rollup.config.js`                                                                        | Keep the TS `outDir` off the project root so the dev build emits `main.js` to the plugin folder.                                                                    |
| `tests/__mocks__/obsidian.ts`                                                             | `getAllTags` mock returns the cache's tags.                                                                                                                         |
| `tests/displayRulesCache.test.ts`, `tests/geojsonLayer.test.ts`, `tests/mapState.test.ts` | Coverage for the above.                                                                                                                                             |

## 7. Rebasing / maintenance notes

- The feature deliberately plugs into upstream's existing pipeline rather than
  forking it, so most upstream changes merge cleanly.
- **Highest conflict risk on a rebase:** `src/mapContainer.ts` (large, central,
  and heavily extended here), then `src/settings.ts`, `src/main.ts`, and
  `src/mapState.ts`.
- The boundary logic itself (`src/boundaryLayers.ts`) and the pure helpers in
  `src/utils.ts` are self-contained and unlikely to conflict.
- If upstream adds fields to `MapState`, re-check the (de)serialization and
  `areStatesEqual` wiring for `enabledBoundaryLayerIds`.
