import { describe, expect, it } from 'vitest';
import { LEVELS, TOWER_DEFINITIONS, TOWER_ORDER } from '../src/data';

describe('game data', () => {
  it('ships three complete eight-wave sectors', () => {
    expect(LEVELS).toHaveLength(3);
    for (const level of LEVELS) {
      expect(level.waves).toHaveLength(8);
      expect(level.path.length).toBeGreaterThan(18);
    }
  });

  it('uses contiguous orthogonal path tiles', () => {
    for (const level of LEVELS) {
      for (let index = 1; index < level.path.length; index += 1) {
        const previous = level.path[index - 1];
        const current = level.path[index];
        const distance = Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
        expect(distance, `${level.id} path at index ${index}`).toBe(1);
      }
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
});
