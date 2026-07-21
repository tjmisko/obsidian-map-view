import { describe, it, expect } from 'vitest';
import { filterOutDisabledBoundaryLayers } from 'src/boundaryLayers';
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
