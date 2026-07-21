import { describe, expect, it } from 'vitest';
import {
  getOrderedPathMasks,
  PATH_E,
  PATH_N,
  PATH_S,
  PATH_W,
  pathDirection,
  sampleOrderedPath,
  validateOrderedPath,
} from '../src/render/autotile';

describe('ordered path autotiling', () => {
  it('uses the canonical NESW bit values', () => {
    expect({ north: PATH_N, east: PATH_E, south: PATH_S, west: PATH_W }).toEqual({
      north: 1,
      east: 2,
      south: 4,
      west: 8,
    });
  });

  it('continues a horizontal route outward at both endpoints', () => {
    const masks = getOrderedPathMasks([
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
    ]);

    expect(masks).toEqual([
      PATH_E | PATH_W,
      PATH_E | PATH_W,
      PATH_E | PATH_W,
    ]);
  });

  it('continues turns and vertical endpoints in their direction of travel', () => {
    const masks = getOrderedPathMasks([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);

    expect(masks).toEqual([
      PATH_E | PATH_W,
      PATH_S | PATH_W,
      PATH_N | PATH_S,
      PATH_N | PATH_S,
    ]);
  });

  it('ignores spatially adjacent cells that are not ordered neighbours', () => {
    const masks = getOrderedPathMasks([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ]);

    // The last path cell sits directly below index 1, but must not create a
    // south-facing branch on that earlier east/west tile.
    expect(masks[1]).toBe(PATH_E | PATH_W);
    expect(masks[4]).toBe(PATH_E | PATH_W);
  });

  it('rejects diagonal, skipped, repeated, and fractional path steps', () => {
    expect(() => validateOrderedPath([{ x: 0, y: 0 }])).toThrow(/at least two/i);
    expect(() => validateOrderedPath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow(/cardinal neighbours/i);
    expect(() => validateOrderedPath([{ x: 0, y: 0 }, { x: 2, y: 0 }])).toThrow(/cardinal neighbours/i);
    expect(() => validateOrderedPath([{ x: 0, y: 0 }, { x: 0, y: 0 }])).toThrow(/cardinal neighbours/i);
    expect(() => validateOrderedPath([{ x: 0, y: 0 }, { x: 0.5, y: 0 }])).toThrow(/integer coordinates/i);
    expect(() => pathDirection({ x: 0, y: 0 }, { x: -1, y: -1 })).toThrow(/not cardinal/i);
  });
});

describe('ordered path sampling', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ];

  it('samples tile centres and direction along each segment', () => {
    expect(sampleOrderedPath(path, 0.25)).toMatchObject({
      x: 0.75,
      y: 0.5,
      angle: 0,
      segment: 0,
      segmentProgress: 0.25,
    });

    expect(sampleOrderedPath(path, 1.5)).toMatchObject({
      x: 1.5,
      y: 1,
      angle: Math.PI / 2,
      segment: 1,
      segmentProgress: 0.5,
    });
  });

  it('clamps sampling to the route endpoints', () => {
    expect(sampleOrderedPath(path, -10)).toMatchObject({ x: 0.5, y: 0.5, segment: 0, segmentProgress: 0 });
    expect(sampleOrderedPath(path, 99)).toMatchObject({ x: 1.5, y: 1.5, segment: 1, segmentProgress: 1 });
  });
});
