import { describe, expect, it } from 'vitest';
import { DAMAGE_MATRIX, armorFactor, calculateDamage } from '../src/game/damage';

describe('Warcraft-inspired damage rules', () => {
  it('keeps the intended hard counters readable', () => {
    expect(DAMAGE_MATRIX.normal.medium).toBe(1.5);
    expect(DAMAGE_MATRIX.pierce.light).toBe(2);
    expect(DAMAGE_MATRIX.siege.fortified).toBe(1.5);
    expect(DAMAGE_MATRIX.magic.heavy).toBe(2);
    expect(DAMAGE_MATRIX.chaos.fortified).toBe(1);
  });

  it('uses the Warcraft III positive armor curve', () => {
    expect(armorFactor(0)).toBe(1);
    expect(armorFactor(1)).toBeCloseTo(0.9434, 4);
    expect(armorFactor(10)).toBeCloseTo(0.625, 4);
    expect(armorFactor(20)).toBeCloseTo(0.4545, 4);
  });

  it('uses the Warcraft III negative armor curve', () => {
    expect(armorFactor(-1)).toBeCloseTo(1.06, 4);
    expect(armorFactor(-10)).toBeCloseTo(1.4614, 4);
  });

  it('applies class multiplier before numerical armor reduction', () => {
    expect(calculateDamage(100, 'magic', 'heavy', 10)).toBeCloseTo(125, 5);
    expect(calculateDamage(100, 'pierce', 'fortified', 0)).toBe(35);
  });
});
