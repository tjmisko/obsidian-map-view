import { App } from 'obsidian';
import { Query } from 'src/query';
import { BaseGeoLayer } from 'src/baseGeoLayer';
import { type BoundaryLayer } from 'src/settings';

/**
 * Filters out layers that belong to disabled boundary layers.
 *
 * A layer "belongs to" a boundary layer B iff B's compiled query matches it.
 * Visibility rule:
 *  - A layer that belongs to no boundary layer is always kept (this function
 *    does not affect it).
 *  - A layer that belongs to at least one boundary layer is kept only if at
 *    least one of the boundary layers it belongs to is enabled (its `id` is in
 *    `enabledIds`).
 *
 * Boundary layers whose query is empty/whitespace are skipped entirely — an
 * empty query would otherwise match every layer.
 *
 * This is intentionally pure and layer-type-agnostic: it tests the layer, not
 * its class.
 *
 * @param layers The candidate layers (already filtered by the base query).
 * @param boundaryLayers The configured boundary layers.
 * @param enabledIds The ids of the boundary layers currently toggled on.
 * @param app The Obsidian app, used to compile the boundary queries.
 */
export function filterOutDisabledBoundaryLayers(
    layers: BaseGeoLayer[],
    boundaryLayers: BoundaryLayer[],
    enabledIds: string[],
    app: App,
): BaseGeoLayer[] {
    // Nothing to do if there are no boundary layers configured.
    if (!boundaryLayers || boundaryLayers.length === 0) return layers;

    // Compile each boundary query once, skipping empty/whitespace queries.
    const compiled = boundaryLayers
        .filter(
            (boundary) => boundary.query && boundary.query.trim().length > 0,
        )
        .map((boundary) => ({
            id: boundary.id,
            query: new Query(app, boundary.query),
        }));
    if (compiled.length === 0) return layers;

    const enabledSet = new Set(enabledIds ?? []);

    return layers.filter((layer) => {
        let belongsToAnyBoundary = false;
        for (const boundary of compiled) {
            if (boundary.query.testLayer(layer)) {
                belongsToAnyBoundary = true;
                if (enabledSet.has(boundary.id)) return true;
            }
        }
        // Belongs to no boundary layer → unaffected (keep). Belongs to boundary
        // layers but none are enabled → hide.
        return !belongsToAnyBoundary;
    });
}
