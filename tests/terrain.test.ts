import { describe, expect, it } from 'vitest';
import {
  TERRAIN_E,
  TERRAIN_N,
  TERRAIN_NE,
  TERRAIN_NW,
  TERRAIN_SE,
  TerrainMap,
} from '../src/terrain/TerrainMap';
import { PATH_E, PATH_N, PATH_S, PATH_W } from '../src/render/autotile';

describe('TerrainMap path networks', () => {
  it('derives isolated, straight, corner, T, and four-way masks from a 2D array', () => {
    const isolated = TerrainMap.fromArray(['#']);
    expect(isolated.getPathMask(0, 0)).toBe(0);

    const network = TerrainMap.fromArray([
      '.#.',
      '###',
      '.#.',
    ]);
    expect(network.getPathMask(1, 1)).toBe(PATH_N | PATH_E | PATH_S | PATH_W);
    expect(network.getPathMask(1, 0)).toBe(PATH_S);

    network.set(2, 1, 'grass');
    expect(network.getPathMask(1, 1)).toBe(PATH_N | PATH_S | PATH_W);
  });

  it('does not join nearby ordered route folds unless visual branch cells request it', () => {
    const terrain = TerrainMap.fromOrderedPath(3, 2, [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 2, y: 1 }, { x: 1, y: 1 },
    ]);
    expect(terrain.getPathMask(1, 0)).toBe(PATH_E | PATH_W);
    expect(terrain.getPathMask(1, 1)).toBe(PATH_E | PATH_W);

    terrain.set(0, 1, 'path');
    expect(terrain.getPathMask(1, 1)).toBe(PATH_N | PATH_E | PATH_W);
    expect(terrain.getPathMask(0, 1)).toBe(PATH_N | PATH_E);
  });

  it('supports runtime path editing and increments its render revision', () => {
    const terrain = TerrainMap.fromArray(['.#.']);
    const before = terrain.revision;
    terrain.set(0, 0, 'path');
    expect(terrain.getPathMask(0, 0)).toBe(PATH_E);
    expect(terrain.getPathMask(1, 0)).toBe(PATH_W);
    expect(terrain.revision).toBe(before + 1);
  });
});

describe('TerrainMap 8-neighbour blob masks', () => {
  it('reports all eight neighbours and gates unsupported diagonal corners', () => {
    const terrain = TerrainMap.fromArray([
      '.dd',
      '.dd',
      '...',
    ]);
    expect(terrain.getNeighborMask8(1, 1, 'dirt')).toBe(TERRAIN_N | TERRAIN_NE | TERRAIN_E);
    expect(terrain.getBlobMask8(1, 1, 'dirt')).toBe(TERRAIN_N | TERRAIN_NE | TERRAIN_E);

    terrain.set(1, 0, 'grass');
    expect(terrain.getNeighborMask8(1, 1, 'dirt')).toBe(TERRAIN_NE | TERRAIN_E);
    expect(terrain.getBlobMask8(1, 1, 'dirt')).toBe(TERRAIN_E);
  });

  it('builds deterministic procedural terrain', () => {
    const make = () => TerrainMap.generate(4, 3, (x, y) => (x === y ? 'dirt' : 'grass'), 42);
    expect(make().getNeighborMask8(1, 1, 'dirt')).toBe(TERRAIN_NW | TERRAIN_SE);
    expect(make().seed).toBe(42);
  });
});
