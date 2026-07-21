import type { Cell, TerrainDefinition, TerrainKind } from '../types';
import {
  PATH_E,
  PATH_N,
  PATH_S,
  PATH_W,
  oppositePathDirection,
  pathDirection,
  validateOrderedPath,
} from '../render/autotile';

export const TERRAIN_N = 1;
export const TERRAIN_NE = 2;
export const TERRAIN_E = 4;
export const TERRAIN_SE = 8;
export const TERRAIN_S = 16;
export const TERRAIN_SW = 32;
export const TERRAIN_W = 64;
export const TERRAIN_NW = 128;

const OFFSETS = [
  { bit: TERRAIN_N, dx: 0, dy: -1 },
  { bit: TERRAIN_NE, dx: 1, dy: -1 },
  { bit: TERRAIN_E, dx: 1, dy: 0 },
  { bit: TERRAIN_SE, dx: 1, dy: 1 },
  { bit: TERRAIN_S, dx: 0, dy: 1 },
  { bit: TERRAIN_SW, dx: -1, dy: 1 },
  { bit: TERRAIN_W, dx: -1, dy: 0 },
  { bit: TERRAIN_NW, dx: -1, dy: -1 },
] as const;

const CARDINAL_CONNECTIONS = [
  { bit: PATH_N, dx: 0, dy: -1 },
  { bit: PATH_E, dx: 1, dy: 0 },
  { bit: PATH_S, dx: 0, dy: 1 },
  { bit: PATH_W, dx: -1, dy: 0 },
] as const;

const KIND_TO_VALUE: Record<TerrainKind, number> = { grass: 0, path: 1, dirt: 2 };
const VALUE_TO_KIND: TerrainKind[] = ['grass', 'path', 'dirt'];

/**
 * Mutable terrain data with no rendering dependencies. The ordered enemy route
 * and the visual path network intentionally remain separate.
 */
export class TerrainMap {
  private readonly cells: Uint8Array;
  private readonly pathConnections: Uint8Array;
  private changeRevision = 0;

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly seed = 1,
  ) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
      throw new Error('Terrain dimensions must be positive integers.');
    }
    this.cells = new Uint8Array(cols * rows);
    this.pathConnections = new Uint8Array(cols * rows);
  }

  static fromOrderedPath(
    cols: number,
    rows: number,
    path: readonly Cell[],
    definition: TerrainDefinition = {},
  ): TerrainMap {
    validateOrderedPath(path);
    const terrain = new TerrainMap(cols, rows, definition.seed ?? 1);
    for (const cell of path) terrain.writeKind(cell.x, cell.y, 'path');

    path.forEach((cell, index) => {
      let mask = 0;
      if (index > 0) mask |= pathDirection(cell, path[index - 1]);
      else mask |= oppositePathDirection(pathDirection(cell, path[index + 1]));
      if (index < path.length - 1) mask |= pathDirection(cell, path[index + 1]);
      else mask |= oppositePathDirection(pathDirection(cell, path[index - 1]));
      terrain.pathConnections[terrain.index(cell.x, cell.y)] = mask;
    });

    terrain.addPathCells(definition.pathBranches ?? []);
    for (const cell of definition.dirt ?? []) terrain.set(cell.x, cell.y, 'dirt');
    terrain.changeRevision = 0;
    return terrain;
  }

  /** Build terrain from '.', '#', and 'd' rows (grass, path, and dirt). */
  static fromArray(rows: readonly string[], seed = 1): TerrainMap {
    if (rows.length === 0 || rows[0].length === 0 || rows.some((row) => row.length !== rows[0].length)) {
      throw new Error('Terrain rows must form a non-empty rectangle.');
    }
    const terrain = new TerrainMap(rows[0].length, rows.length, seed);
    rows.forEach((row, y) => [...row].forEach((symbol, x) => {
      const kind = symbol === '#' ? 'path' : symbol === 'd' ? 'dirt' : symbol === '.' ? 'grass' : null;
      if (!kind) throw new Error(`Unknown terrain symbol "${symbol}" at (${x}, ${y}).`);
      terrain.writeKind(x, y, kind);
    }));
    terrain.rebuildAllPathConnections();
    return terrain;
  }

  /** Generate a map from a pure coordinate callback. */
  static generate(
    cols: number,
    rows: number,
    generator: (x: number, y: number) => TerrainKind,
    seed = 1,
  ): TerrainMap {
    const terrain = new TerrainMap(cols, rows, seed);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) terrain.writeKind(x, y, generator(x, y));
    }
    terrain.rebuildAllPathConnections();
    return terrain;
  }

  get revision(): number {
    return this.changeRevision;
  }

  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  get(x: number, y: number): TerrainKind {
    return this.inBounds(x, y) ? VALUE_TO_KIND[this.cells[this.index(x, y)]] : 'grass';
  }

  isPath(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.cells[this.index(x, y)] === KIND_TO_VALUE.path;
  }

  set(x: number, y: number, kind: TerrainKind): void {
    this.assertBounds(x, y);
    if (this.get(x, y) === kind) return;
    this.writeKind(x, y, kind);
    this.reconnectAt(x, y);
    this.changeRevision += 1;
  }

  addPathCells(cells: readonly Cell[]): void {
    for (const cell of cells) {
      this.assertBounds(cell.x, cell.y);
      if (!this.isPath(cell.x, cell.y)) this.writeKind(cell.x, cell.y, 'path');
      this.connectNewPathCell(cell.x, cell.y);
    }
    if (cells.length > 0) this.changeRevision += 1;
  }

  getPathMask(x: number, y: number): number {
    return this.isPath(x, y) ? this.pathConnections[this.index(x, y)] : 0;
  }

  /** Raw clockwise 8-neighbour mask for a requested terrain kind. */
  getNeighborMask8(x: number, y: number, kind = this.get(x, y)): number {
    if (!this.inBounds(x, y)) return 0;
    let mask = 0;
    for (const { bit, dx, dy } of OFFSETS) {
      if (this.inBounds(x + dx, y + dy) && this.get(x + dx, y + dy) === kind) mask |= bit;
    }
    return mask;
  }

  /**
   * Removes corner bits unless both supporting cardinal neighbours exist. This
   * canonical blob mask yields the standard 47 useful 8-neighbour variants.
   */
  getBlobMask8(x: number, y: number, kind = this.get(x, y)): number {
    let mask = this.getNeighborMask8(x, y, kind);
    if ((mask & (TERRAIN_N | TERRAIN_E)) !== (TERRAIN_N | TERRAIN_E)) mask &= ~TERRAIN_NE;
    if ((mask & (TERRAIN_E | TERRAIN_S)) !== (TERRAIN_E | TERRAIN_S)) mask &= ~TERRAIN_SE;
    if ((mask & (TERRAIN_S | TERRAIN_W)) !== (TERRAIN_S | TERRAIN_W)) mask &= ~TERRAIN_SW;
    if ((mask & (TERRAIN_W | TERRAIN_N)) !== (TERRAIN_W | TERRAIN_N)) mask &= ~TERRAIN_NW;
    return mask;
  }

  private index(x: number, y: number): number {
    return y * this.cols + x;
  }

  private assertBounds(x: number, y: number): void {
    if (!this.inBounds(x, y)) throw new Error(`Terrain cell (${x}, ${y}) is out of bounds.`);
  }

  private writeKind(x: number, y: number, kind: TerrainKind): void {
    this.assertBounds(x, y);
    const index = this.index(x, y);
    this.cells[index] = KIND_TO_VALUE[kind];
    if (kind !== 'path') this.pathConnections[index] = 0;
  }

  private connectNewPathCell(x: number, y: number): void {
    const index = this.index(x, y);
    for (const connection of CARDINAL_CONNECTIONS) {
      const nx = x + connection.dx;
      const ny = y + connection.dy;
      if (!this.isPath(nx, ny)) continue;
      this.pathConnections[index] |= connection.bit;
      this.pathConnections[this.index(nx, ny)] |= oppositePathDirection(connection.bit);
    }
  }

  private reconnectAt(x: number, y: number): void {
    const affected = [{ x, y }, ...CARDINAL_CONNECTIONS.map(({ dx, dy }) => ({ x: x + dx, y: y + dy }))];
    for (const cell of affected) {
      if (!this.inBounds(cell.x, cell.y)) continue;
      const index = this.index(cell.x, cell.y);
      this.pathConnections[index] = 0;
      if (!this.isPath(cell.x, cell.y)) continue;
      for (const connection of CARDINAL_CONNECTIONS) {
        if (this.isPath(cell.x + connection.dx, cell.y + connection.dy)) {
          this.pathConnections[index] |= connection.bit;
        }
      }
    }
  }

  private rebuildAllPathConnections(): void {
    this.pathConnections.fill(0);
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        if (this.isPath(x, y)) this.connectNewPathCell(x, y);
      }
    }
  }
}
