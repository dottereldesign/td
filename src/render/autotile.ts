import type { Cell } from '../types';

export const PATH_N = 1;
export const PATH_E = 2;
export const PATH_S = 4;
export const PATH_W = 8;

export type PathDirection =
  | typeof PATH_N
  | typeof PATH_E
  | typeof PATH_S
  | typeof PATH_W;

export interface PathSample {
  /** Position in grid coordinates, measured from the top-left of the board. */
  x: number;
  y: number;
  /** Direction of travel in radians, with 0 pointing east. */
  angle: number;
  segment: number;
  segmentProgress: number;
}

function describeCell(cell: Cell): string {
  return `(${cell.x}, ${cell.y})`;
}

/**
 * Validates the representation used by the game: at least two integer grid cells,
 * with every consecutive pair exactly one cardinal tile apart.
 */
export function validateOrderedPath(path: readonly Cell[]): void {
  if (path.length < 2) {
    throw new Error('An ordered path needs at least two cells.');
  }

  for (let index = 0; index < path.length; index += 1) {
    const cell = path[index];
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
      throw new Error(`Path cell ${index} ${describeCell(cell)} must use integer coordinates.`);
    }

    if (index === 0) continue;

    const previous = path[index - 1];
    const distance = Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y);
    if (distance !== 1) {
      throw new Error(
        `Path cells ${index - 1} ${describeCell(previous)} and ${index} ${describeCell(cell)} must be cardinal neighbours.`,
      );
    }
  }
}

/** Returns the cardinal bit that points from one neighbouring cell to the other. */
export function pathDirection(from: Cell, to: Cell): PathDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === -1) return PATH_N;
  if (dx === 1 && dy === 0) return PATH_E;
  if (dx === 0 && dy === 1) return PATH_S;
  if (dx === -1 && dy === 0) return PATH_W;

  throw new Error(`${describeCell(from)} and ${describeCell(to)} are not cardinal neighbours.`);
}

export function oppositePathDirection(direction: PathDirection): PathDirection {
  if (direction === PATH_N) return PATH_S;
  if (direction === PATH_E) return PATH_W;
  if (direction === PATH_S) return PATH_N;
  return PATH_E;
}

/**
 * Produces one bitmask per ordered path entry. A tile only considers its ordered
 * predecessor and successor, so a nearby but unrelated stretch cannot create a
 * false junction. Endpoints receive a virtual outward connection, allowing their
 * atlas tiles to continue cleanly through a board edge.
 */
export function getOrderedPathMasks(path: readonly Cell[]): number[] {
  validateOrderedPath(path);

  return path.map((cell, index) => {
    const previousDirection = index > 0
      ? pathDirection(cell, path[index - 1])
      : oppositePathDirection(pathDirection(cell, path[index + 1]));
    const nextDirection = index < path.length - 1
      ? pathDirection(cell, path[index + 1])
      : oppositePathDirection(pathDirection(cell, path[index - 1]));

    return previousDirection | nextDirection;
  });
}

/**
 * Samples the route in cell-distance units. Coordinates point at tile centres,
 * which makes the result suitable for enemies, route arrows, and other overlays.
 */
export function sampleOrderedPath(path: readonly Cell[], distance: number): PathSample {
  validateOrderedPath(path);

  const lastSegment = path.length - 2;
  const clampedDistance = Math.min(Math.max(Number.isFinite(distance) ? distance : 0, 0), path.length - 1);
  const segment = Math.min(Math.floor(clampedDistance), lastSegment);
  const segmentProgress = clampedDistance - segment;
  const from = path[segment];
  const to = path[segment + 1];
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return {
    x: from.x + 0.5 + dx * segmentProgress,
    y: from.y + 0.5 + dy * segmentProgress,
    angle: Math.atan2(dy, dx),
    segment,
    segmentProgress,
  };
}
