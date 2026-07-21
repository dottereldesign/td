import { describe, expect, it } from 'vitest';
import { LEVELS, TOWER_DEFINITIONS, TOWER_ORDER, WORLDS, WORLD_TOWER_DEFINITIONS } from '../src/data';

describe('game data', () => {
  it('ships six worlds with three complete eight-wave maps each', () => {
    expect(WORLDS).toHaveLength(6);
    expect(LEVELS).toHaveLength(18);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(18);
    for (const world of WORLDS) {
      expect(world.mapIds).toHaveLength(3);
      expect(LEVELS.filter((level) => level.worldId === world.id)).toHaveLength(3);
    }
    for (const level of LEVELS) {
      expect(level.waves).toHaveLength(8);
      expect(level.path.length).toBeGreaterThanOrEqual(40);
    }
  });

  it('uses unique, in-bounds, contiguous orthogonal path tiles', () => {
    for (const level of LEVELS) {
      const occupied = new Set(level.path.map((cell) => `${cell.x},${cell.y}`));
      expect(occupied.size, `${level.id} path repeats a tile`).toBe(level.path.length);

      for (const cell of level.path) {
        expect(cell.x, `${level.id} path x coordinate`).toBeGreaterThanOrEqual(0);
        expect(cell.x, `${level.id} path x coordinate`).toBeLessThan(level.cols);
        expect(cell.y, `${level.id} path y coordinate`).toBeGreaterThanOrEqual(0);
        expect(cell.y, `${level.id} path y coordinate`).toBeLessThan(level.rows);
      }

      for (let index = 1; index < level.path.length; index += 1) {
        const previous = level.path[index - 1];
        const current = level.path[index];
        const distance = Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
        expect(distance, `${level.id} path at index ${index}`).toBe(1);
      }
    }
  });

  it('runs edge-to-edge through multiple turns while retaining build space', () => {
    for (const level of LEVELS) {
      const isEdge = (cell: (typeof level.path)[number]) =>
        cell.x === 0 || cell.y === 0 || cell.x === level.cols - 1 || cell.y === level.rows - 1;
      const start = level.path[0];
      const end = level.path[level.path.length - 1];
      expect(isEdge(start), `${level.id} entrance`).toBe(true);
      expect(isEdge(end), `${level.id} exit`).toBe(true);

      let turns = 0;
      for (let index = 2; index < level.path.length; index += 1) {
        const before = level.path[index - 2];
        const corner = level.path[index - 1];
        const after = level.path[index];
        const firstDirection = `${corner.x - before.x},${corner.y - before.y}`;
        const secondDirection = `${after.x - corner.x},${after.y - corner.y}`;
        if (firstDirection !== secondDirection) turns += 1;
      }

      expect(turns, `${level.id} path turns`).toBeGreaterThanOrEqual(8);
      expect(level.cols * level.rows - level.path.length, `${level.id} buildable area`).toBeGreaterThanOrEqual(150);
    }
  });

  it('gives every shop entry a usable cost and combat profile', () => {
    expect(TOWER_ORDER).toHaveLength(6);
    for (const id of TOWER_ORDER) {
      const tower = TOWER_DEFINITIONS[id];
      expect(tower.cost).toBeGreaterThan(0);
      expect(tower.damage).toBeGreaterThan(0);
      expect(tower.interval).toBeGreaterThan(0);
      expect(tower.range).toBeGreaterThan(2);
    }
  });

  it('gives every world six unique themed tower names', () => {
    for (const world of WORLDS) {
      const towers = TOWER_ORDER.map((id) => WORLD_TOWER_DEFINITIONS[world.id][id]);
      expect(new Set(towers.map((tower) => tower.name)).size).toBe(6);
      expect(towers.every((tower) => tower.cost > 0)).toBe(true);
    }
    expect(TOWER_DEFINITIONS.sentry.name).toBe('Mycelium Network');
  });
});
