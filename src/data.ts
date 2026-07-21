import type {
  ArmorType,
  Cell,
  EnemyGroup,
  LevelDefinition,
  TowerDefinition,
  TowerId,
  WaveDefinition,
} from './types';

export const ARMOR_LABELS: Record<ArmorType, string> = {
  unarmored: 'Unarmored',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
  fortified: 'Fortified',
};

export const ARMOR_CODES: Record<ArmorType, string> = {
  unarmored: 'U',
  light: 'L',
  medium: 'M',
  heavy: 'H',
  fortified: 'F',
};

export const TOWER_DEFINITIONS: Record<TowerId, TowerDefinition> = {
  sentry: {
    id: 'sentry',
    name: 'Vacuum Sentry',
    shortName: 'VACUUM',
    hotkey: '1',
    icon: 'crosshair',
    attackType: 'normal',
    role: 'Normal · Reliable',
    description: 'Steady suction bursts. Excels against Medium armor.',
    cost: 90,
    damage: 24,
    interval: 0.82,
    range: 2.7,
    projectileSpeed: 8.5,
  },
  needle: {
    id: 'needle',
    name: 'Brush Array',
    shortName: 'BRUSH',
    hotkey: '2',
    icon: 'locate-fixed',
    attackType: 'pierce',
    role: 'Pierce · Rapid',
    description: 'Rapid bristle fire. Shreds Light and Unarmored.',
    cost: 120,
    damage: 13,
    interval: 0.38,
    range: 3.15,
    projectileSpeed: 11,
  },
  mortar: {
    id: 'mortar',
    name: 'Toast Mortar',
    shortName: 'TOASTER',
    hotkey: '3',
    icon: 'bomb',
    attackType: 'siege',
    role: 'Siege · Splash',
    description: 'Lobs heavy toast with splash. Cracks Fortified armor.',
    cost: 175,
    damage: 58,
    interval: 1.7,
    range: 3.45,
    projectileSpeed: 5.7,
    splash: 0.8,
  },
  arcanum: {
    id: 'arcanum',
    name: 'Arcanum',
    shortName: 'ARCANUM',
    hotkey: '4',
    icon: 'sparkles',
    attackType: 'magic',
    role: 'Magic · Slow',
    description: 'Heavy-armor counter. Briefly slows each target.',
    cost: 160,
    damage: 33,
    interval: 1.05,
    range: 3,
    projectileSpeed: 7,
    slow: { factor: 0.78, duration: 1.8 },
  },
  toxin: {
    id: 'toxin',
    name: 'Fly Sprayer',
    shortName: 'SPRAYER',
    hotkey: '5',
    icon: 'flask-conical',
    attackType: 'pierce',
    role: 'Pierce · Poison',
    description: 'Sprays poison that stacks from up to three units.',
    cost: 145,
    damage: 8,
    interval: 0.75,
    range: 2.85,
    projectileSpeed: 8,
    poison: { dps: 6, duration: 4.5, maxStacks: 3 },
  },
  null: {
    id: 'null',
    name: 'Null Engine',
    shortName: 'NULL',
    hotkey: '6',
    icon: 'aperture',
    attackType: 'chaos',
    role: 'Chaos · Universal',
    description: 'Expensive generalist. Deals full type damage to all armor.',
    cost: 280,
    damage: 72,
    interval: 1.25,
    range: 3.25,
    projectileSpeed: 9,
  },
};

export const TOWER_ORDER: TowerId[] = ['sentry', 'needle', 'mortar', 'arcanum', 'toxin', 'null'];

function line(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  let x = from.x;
  let y = from.y;

  cells.push({ x, y });
  while (x !== to.x || y !== to.y) {
    x += dx;
    y += dy;
    cells.push({ x, y });
  }

  return cells;
}

function route(points: Cell[]): Cell[] {
  return points.flatMap((point, index) => {
    if (index === points.length - 1) return [];
    const cells = line(point, points[index + 1]);
    return index === 0 ? cells : cells.slice(1);
  });
}

function group(
  armorType: ArmorType,
  count: number,
  hp: number,
  speed: number,
  bounty: number,
  armor: number,
  interval: number,
  scale = 1,
): EnemyGroup {
  return { armorType, count, hp, speed, bounty, armor, interval, scale };
}

function waves(difficulty: number): WaveDefinition[] {
  const hp = (value: number) => Math.round(value * difficulty);
  const speed = (value: number) => value * (0.96 + difficulty * 0.04);

  return [
    {
      name: 'Soft targets',
      description: 'Unarmored contacts in a loose column.',
      groups: [group('unarmored', 10, hp(52), speed(1.05), 9, 0, 0.72)],
      clearBonus: 35,
    },
    {
      name: 'Light screen',
      description: 'Fast Light armor. Pierce damage is ideal.',
      groups: [group('light', 13, hp(72), speed(1.22), 10, 1, 0.57)],
      clearBonus: 40,
    },
    {
      name: 'Working line',
      description: 'Medium armor reduces most specialist fire.',
      groups: [group('medium', 12, hp(112), speed(0.96), 12, 2, 0.68)],
      clearBonus: 45,
    },
    {
      name: 'Heavy bodies',
      description: 'Slow, durable Heavy armor. Magic hits hardest.',
      groups: [group('heavy', 10, hp(172), speed(0.78), 17, 4, 0.78, 1.08)],
      clearBonus: 50,
    },
    {
      name: 'Split doctrine',
      description: 'Alternating armor classes punish a single-tower plan.',
      groups: [
        group('light', 7, hp(112), speed(1.25), 12, 2, 0.48),
        group('medium', 7, hp(165), speed(0.98), 15, 4, 0.58),
      ],
      clearBonus: 55,
    },
    {
      name: 'Fortified push',
      description: 'Fortified shells resist Pierce and Magic.',
      groups: [group('fortified', 10, hp(275), speed(0.7), 23, 7, 0.9, 1.12)],
      clearBonus: 65,
    },
    {
      name: 'Pressure test',
      description: 'A compressed mixed wave with little recovery time.',
      groups: [
        group('unarmored', 8, hp(180), speed(1.32), 14, 3, 0.35),
        group('heavy', 6, hp(315), speed(0.88), 24, 7, 0.54, 1.08),
        group('light', 8, hp(205), speed(1.38), 17, 4, 0.33),
      ],
      clearBonus: 75,
    },
    {
      name: 'Final audit',
      description: 'Every armor class, ending with a fortified command unit.',
      groups: [
        group('medium', 7, hp(255), speed(1.06), 19, 6, 0.4),
        group('light', 7, hp(235), speed(1.36), 18, 5, 0.34),
        group('heavy', 6, hp(390), speed(0.91), 27, 9, 0.48, 1.08),
        group('fortified', 1, hp(1_250), speed(0.58), 125, 12, 1, 1.42),
      ],
      clearBonus: 120,
    },
  ];
}

export const LEVELS: LevelDefinition[] = [
  {
    id: 'switchback',
    number: '01',
    name: 'Switchback',
    subtitle: 'Long sightlines / forgiving',
    briefing: 'A long dog-leg route with generous early build space. Learn the counter table here.',
    cols: 18,
    rows: 11,
    startCash: 420,
    startLives: 20,
    path: route([
      { x: 0, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 7 },
      { x: 1, y: 7 },
      { x: 1, y: 9 },
      { x: 12, y: 9 },
      { x: 12, y: 3 },
      { x: 15, y: 3 },
      { x: 15, y: 8 },
      { x: 17, y: 8 },
    ]),
    waves: waves(1),
    difficulty: 1,
  },
  {
    id: 'crosscut',
    number: '02',
    name: 'Crosscut',
    subtitle: 'Central pressure / moderate',
    briefing: 'The route folds through the centre. Range is efficient, but premium tiles are limited.',
    cols: 18,
    rows: 11,
    startCash: 440,
    startLives: 18,
    path: route([
      { x: 0, y: 8 },
      { x: 4, y: 8 },
      { x: 4, y: 3 },
      { x: 8, y: 3 },
      { x: 8, y: 7 },
      { x: 12, y: 7 },
      { x: 12, y: 1 },
      { x: 16, y: 1 },
      { x: 16, y: 5 },
      { x: 14, y: 5 },
      { x: 14, y: 9 },
      { x: 17, y: 9 },
    ]),
    waves: waves(1.16),
    difficulty: 2,
  },
  {
    id: 'gauntlet',
    number: '03',
    name: 'Gauntlet',
    subtitle: 'Dense route / severe',
    briefing: 'A tightly folded route creates contested build pockets. Sell and rebuild around the wave forecast.',
    cols: 18,
    rows: 11,
    startCash: 470,
    startLives: 15,
    path: route([
      { x: 0, y: 5 },
      { x: 3, y: 5 },
      { x: 3, y: 1 },
      { x: 9, y: 1 },
      { x: 9, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 9 },
      { x: 12, y: 9 },
      { x: 12, y: 6 },
      { x: 16, y: 6 },
      { x: 16, y: 2 },
      { x: 17, y: 2 },
    ]),
    waves: waves(1.34),
    difficulty: 3,
  },
];

export function getTowerDefinition(id: TowerId): TowerDefinition {
  return TOWER_DEFINITIONS[id];
}

export function getLevel(id: string): LevelDefinition {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}
