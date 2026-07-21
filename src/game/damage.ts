import type { ArmorType, AttackType } from '../types';

export const DAMAGE_MATRIX: Record<AttackType, Record<ArmorType, number>> = {
  normal: {
    unarmored: 1,
    light: 1,
    medium: 1.5,
    heavy: 1,
    fortified: 0.7,
  },
  pierce: {
    unarmored: 1.5,
    light: 2,
    medium: 0.75,
    heavy: 0.9,
    fortified: 0.35,
  },
  siege: {
    unarmored: 1.5,
    light: 1,
    medium: 0.5,
    heavy: 1,
    fortified: 1.5,
  },
  magic: {
    unarmored: 1,
    light: 1.25,
    medium: 0.75,
    heavy: 2,
    fortified: 0.35,
  },
  chaos: {
    unarmored: 1,
    light: 1,
    medium: 1,
    heavy: 1,
    fortified: 1,
  },
};

export function armorFactor(armor: number): number {
  if (armor >= 0) {
    return 1 / (1 + 0.06 * armor);
  }

  return 2 - Math.pow(0.94, -armor);
}

export function calculateDamage(
  rawDamage: number,
  attackType: AttackType,
  armorType: ArmorType,
  armor: number,
): number {
  return rawDamage * DAMAGE_MATRIX[attackType][armorType] * armorFactor(armor);
}

export function matchupLabel(multiplier: number): string {
  if (multiplier >= 1.5) return 'Excellent';
  if (multiplier > 1) return 'Strong';
  if (multiplier === 1) return 'Neutral';
  if (multiplier >= 0.7) return 'Reduced';
  return 'Poor';
}
