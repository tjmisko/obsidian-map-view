import { describe, it, expect } from 'vitest';
import {
    filterOutDisabledBoundaryLayers,
    getBoundaryLayerForLayer,
    boundaryPaneName,
} from 'src/boundaryLayers';
import { type BoundaryLayer } from 'src/settings';

// Minimal mock layer, mirroring tests/query.test.ts.
function mockLayer(overrides: Record<string, any> = {}): any {
    return {
        tags: [],
        extraName: null,
        fileLine: null,
        file: {
            name: 'test.md',
            path: 'folder/test.md',
            basename: 'test',
        },
        ...overrides,
    };
}

// Build a BoundaryLayer with sensible defaults; override id/query per test.
function boundary(overrides: Partial<BoundaryLayer> = {}): BoundaryLayer {
    return {
        id: 'boundary',
        name: 'Boundary',
        query: 'tag:#boundary',
        level: 0,
        enabledByDefault: false,
        style: {},
        ...overrides,
    };
}

// Tag queries do not use the App, so `null` is sufficient (see query.test.ts).
const app = null as any;

describe('filterOutDisabledBoundaryLayers', () => {
    const country = boundary({
        id: 'boundary-country',
        query: 'tag:#boundary/country',
    });
    const state = boundary({
        id: 'boundary-state',
        query: 'tag:#boundary/state',
    });

    it('keeps a layer matching an enabled boundary layer', () => {
        const layer = mockLayer({ tags: ['#boundary/country'] });
        const result = filterOutDisabledBoundaryLayers(
            [layer],
            [country],
            ['boundary-country'],
            app,
        );
        expect(result).toContain(layer);
    });

    it('removes a layer matching only a disabled boundary layer', () => {
        const layer = mockLayer({ tags: ['#boundary/country'] });
        const result = filterOutDisabledBoundaryLayers(
            [layer],
            [country],
            [],
            app,
        );
        expect(result).not.toContain(layer);
    });

    it('keeps a layer matching no boundary layer', () => {
        const layer = mockLayer({ tags: ['#restaurant'] });
        const result = filterOutDisabledBoundaryLayers(
            [layer],
            [country, state],
            [],
            app,
        );
        expect(result).toContain(layer);
    });

    it('keeps a layer matching two boundaries when only one is enabled', () => {
        const layer = mockLayer({
            tags: ['#boundary/country', '#boundary/state'],
        });
        const result = filterOutDisabledBoundaryLayers(
            [layer],
            [country, state],
            ['boundary-state'],
            app,
        );
        expect(result).toContain(layer);
    });

    it('ignores boundary layers with an empty/whitespace query', () => {
        const emptyBoundary = boundary({ id: 'empty', query: '   ' });
        const layer = mockLayer({ tags: ['#restaurant'] });
        const result = filterOutDisabledBoundaryLayers(
            [layer],
            [emptyBoundary],
            [],
            app,
        );
        expect(result).toContain(layer);
    });

    it('returns layers unchanged when there are no boundary layers', () => {
        const layer = mockLayer({ tags: ['#boundary/country'] });
        expect(filterOutDisabledBoundaryLayers([layer], [], [], app)).toEqual([
            layer,
        ]);
    });
});

describe('getBoundaryLayerForLayer', () => {
    const country = boundary({
        id: 'boundary-country',
        query: 'tag:#boundary/country',
        level: 0,
    });
    const state = boundary({
        id: 'boundary-state',
        query: 'tag:#boundary/state',
        level: 1,
    });
    const county = boundary({
        id: 'boundary-county',
        query: 'tag:#boundary/county',
        level: 2,
    });

    it('returns the matching boundary layer', () => {
        const layer = mockLayer({ tags: ['#boundary/state'] });
        expect(
            getBoundaryLayerForLayer(layer, [country, state, county], app),
        ).toBe(state);
    });

    it('returns the most-nested (highest level) match when several match', () => {
        const layer = mockLayer({
            tags: ['#boundary/state', '#boundary/county'],
        });
        expect(
            getBoundaryLayerForLayer(layer, [country, state, county], app),
        ).toBe(county);
    });

    it('returns null when the layer matches no boundary layer', () => {
        const layer = mockLayer({ tags: ['#restaurant'] });
        expect(
            getBoundaryLayerForLayer(layer, [country, state, county], app),
        ).toBeNull();
    });

    it('skips boundary layers with an empty/whitespace query', () => {
        const empty = boundary({ id: 'empty', query: '  ', level: 5 });
        const layer = mockLayer({ tags: ['#boundary/state'] });
        expect(getBoundaryLayerForLayer(layer, [empty, state], app)).toBe(
            state,
        );
    });

    it('returns null when there are no boundary layers', () => {
        const layer = mockLayer({ tags: ['#boundary/state'] });
        expect(getBoundaryLayerForLayer(layer, [], app)).toBeNull();
    });
});

describe('boundaryPaneName', () => {
    it('derives a distinct, stable pane name per level', () => {
        expect(boundaryPaneName(0)).toBe('mv-boundary-pane-0');
        expect(boundaryPaneName(2)).toBe('mv-boundary-pane-2');
        expect(boundaryPaneName(0)).not.toBe(boundaryPaneName(1));
    });
});
