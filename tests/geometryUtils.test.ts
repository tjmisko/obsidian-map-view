import { describe, it, expect } from 'vitest';
import { isPointInGeometry, geometryArea } from 'src/utils';

// A 10x10 square from (0,0) to (10,10), in GeoJSON [lng,lat] ring order.
const square = {
    type: 'Polygon',
    coordinates: [
        [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
        ],
    ],
};

// The same square with a 2x2 hole in the middle (4,4)-(6,6).
const squareWithHole = {
    type: 'Polygon',
    coordinates: [
        [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
        ],
        [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 4],
        ],
    ],
};

const twoSquares = {
    type: 'MultiPolygon',
    coordinates: [
        square.coordinates,
        [
            [
                [20, 20],
                [22, 20],
                [22, 22],
                [20, 22],
                [20, 20],
            ],
        ],
    ],
};

describe('isPointInGeometry', () => {
    it('is true for a point inside a polygon', () => {
        // isPointInGeometry(lat, lng, ...); point (lat=5, lng=5) is inside.
        expect(isPointInGeometry(5, 5, square)).toBe(true);
    });

    it('is false for a point outside a polygon', () => {
        expect(isPointInGeometry(15, 15, square)).toBe(false);
    });

    it('is false for a point inside a hole', () => {
        expect(isPointInGeometry(5, 5, squareWithHole)).toBe(false);
    });

    it('is true for a point in the ring but outside the hole', () => {
        expect(isPointInGeometry(1, 1, squareWithHole)).toBe(true);
    });

    it('matches any sub-polygon of a MultiPolygon', () => {
        expect(isPointInGeometry(5, 5, twoSquares)).toBe(true);
        expect(isPointInGeometry(21, 21, twoSquares)).toBe(true);
        expect(isPointInGeometry(15, 15, twoSquares)).toBe(false);
    });

    it('is false for non-area geometries and null', () => {
        expect(isPointInGeometry(5, 5, { type: 'LineString' } as any)).toBe(
            false,
        );
        expect(isPointInGeometry(5, 5, null)).toBe(false);
    });
});

describe('geometryArea', () => {
    it('computes the shoelace area of a polygon outer ring', () => {
        expect(geometryArea(square)).toBe(100);
    });

    it('orders a smaller region below a larger one', () => {
        const small = {
            type: 'Polygon',
            coordinates: [
                [
                    [0, 0],
                    [2, 0],
                    [2, 2],
                    [0, 2],
                    [0, 0],
                ],
            ],
        };
        expect(geometryArea(small)).toBeLessThan(geometryArea(square));
    });

    it('sums outer rings of a MultiPolygon', () => {
        // 10x10 (=100) plus 2x2 (=4).
        expect(geometryArea(twoSquares)).toBe(104);
    });

    it('is zero for non-area geometries and null', () => {
        expect(geometryArea({ type: 'Point' } as any)).toBe(0);
        expect(geometryArea(null)).toBe(0);
    });
});
