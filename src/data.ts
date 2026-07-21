import type {
  ArmorType,
  Cell,
  EnemyGroup,
  LevelDefinition,
  TowerDefinition,
  TowerId,
  WaveDefinition,
  WorldDefinition,
  WorldId,
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

const FOREST_TOWER_DEFINITIONS: Record<TowerId, TowerDefinition> = {
  sentry: {
    id: 'sentry',
    name: 'Mycelium Network',
    shortName: 'MYCELIUM',
    hotkey: '1',
    icon: 'crosshair',
    attackType: 'normal',
    role: 'Normal · Reliable',
    description: 'Linked mushrooms share steady spore bursts across the forest floor.',
    cost: 90,
    damage: 24,
    interval: 0.82,
    range: 2.7,
    projectileSpeed: 8.5,
  },
  needle: {
    id: 'needle',
    name: 'Pollinator Post',
    shortName: 'POLLINATOR',
    hotkey: '2',
    icon: 'locate-fixed',
    attackType: 'pierce',
    role: 'Pierce · Rapid',
    description: 'Busy pollinators launch rapid pollen darts at light targets.',
    cost: 120,
    damage: 13,
    interval: 0.38,
    range: 3.15,
    projectileSpeed: 11,
  },
  mortar: {
    id: 'mortar',
    name: 'Canopy Guardian',
    shortName: 'CANOPY',
    hotkey: '3',
    icon: 'bomb',
    attackType: 'siege',
    role: 'Siege · Splash',
    description: 'Drops heavy seed pods that burst across clustered invaders.',
    cost: 175,
    damage: 58,
    interval: 1.7,
    range: 3.45,
    projectileSpeed: 5.7,
    splash: 0.8,
  },
  arcanum: {
    id: 'arcanum',
    name: 'Root Snare',
    shortName: 'ROOT SNARE',
    hotkey: '4',
    icon: 'sparkles',
    attackType: 'magic',
    role: 'Magic · Slow',
    description: 'Living roots grasp heavy targets and briefly slow their advance.',
    cost: 160,
    damage: 33,
    interval: 1.05,
    range: 3,
    projectileSpeed: 7,
    slow: { factor: 0.78, duration: 1.8 },
  },
  toxin: {
    id: 'toxin',
    name: 'Seed Slinger',
    shortName: 'SEED SLINGER',
    hotkey: '5',
    icon: 'flask-conical',
    attackType: 'pierce',
    role: 'Pierce · Poison',
    description: 'Fires clinging burr seeds that keep dealing damage over time.',
    cost: 145,
    damage: 8,
    interval: 0.75,
    range: 2.85,
    projectileSpeed: 8,
    poison: { dps: 6, duration: 4.5, maxStacks: 3 },
  },
  null: {
    id: 'null',
    name: 'Weathered Oak',
    shortName: 'OLD OAK',
    hotkey: '6',
    icon: 'aperture',
    attackType: 'chaos',
    role: 'Chaos · Universal',
    description: 'An ancient all-round defender whose acorns ignore armor matchups.',
    cost: 280,
    damage: 72,
    interval: 1.25,
    range: 3.25,
    projectileSpeed: 9,
  },
};

export const TOWER_ORDER: TowerId[] = ['sentry', 'needle', 'mortar', 'arcanum', 'toxin', 'null'];

const WORLD_TOWER_NAMES: Record<WorldId, readonly string[]> = {
  forest: ['Mycelium Network', 'Pollinator Post', 'Canopy Guardian', 'Root Snare', 'Seed Slinger', 'Weathered Oak'],
  workshop: ['Gearbox Turret', 'Magnet Crane', 'Pressure Piston', 'Spark Relay', 'Conveyor Cannon', 'Chain-Reaction Engine'],
  word: ['Letter Launcher', 'Rhymecaster', 'Punctuation Station', 'Storykeeper', 'Syllable Splitter', 'Dictionary Dragon'],
  number: ['Plus Pulse', 'Divider Array', 'Pattern Prism', 'Sequence Sentry', 'Fraction Fortress', 'Logic Engine'],
  space: ['Gravity Well', 'Comet Cannon', 'Orbit Array', 'Solar Flare', 'Satellite Sentry', 'Nebula Forge'],
  music: ['Beat Blaster', 'Tempo Tower', 'Bass Bastion', 'Melody Mortar', 'Echo Chamber', 'Conductor Core'],
};

export const WORLD_IDS: WorldId[] = ['forest', 'workshop', 'word', 'number', 'space', 'music'];

function makeWorldTowerDefinitions(worldId: WorldId): Record<TowerId, TowerDefinition> {
  const names = WORLD_TOWER_NAMES[worldId];
  return Object.fromEntries(TOWER_ORDER.map((id, index) => {
    const base = FOREST_TOWER_DEFINITIONS[id];
    return [id, {
      ...base,
      name: names[index],
      shortName: names[index].toUpperCase(),
      description: worldId === 'forest'
        ? base.description
        : `${names[index]} uses the ${base.role.toLowerCase()} combat role. Final world-specific art and lesson text are planned.`,
    }];
  })) as Record<TowerId, TowerDefinition>;
}

export const WORLD_TOWER_DEFINITIONS: Record<WorldId, Record<TowerId, TowerDefinition>> =
  Object.fromEntries(WORLD_IDS.map((id) => [id, makeWorldTowerDefinitions(id)])) as Record<WorldId, Record<TowerId, TowerDefinition>>;

/** Forest remains the compatibility/default roster for systems without a level context. */
export const TOWER_DEFINITIONS = WORLD_TOWER_DEFINITIONS.forest;

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

const FOREST_LEVELS: LevelDefinition[] = [
  {
    id: 'forest-1',
    worldId: 'forest',
    number: '1-1',
    name: 'Mossy Crossing',
    subtitle: 'Food webs / forgiving',
    briefing: 'Protect a young woodland crossing while learning how every organism has a role.',
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
    terrain: {
      seed: 101,
      // Connects the two vertical route folds, producing real T and four-way
      // visual junctions while enemies retain their authored ordered route.
      pathBranches: [
        { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 13, y: 5 }, { x: 14, y: 5 },
      ],
      dirt: [
        { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 },
        { x: 7, y: 1 }, { x: 8, y: 1 },
      ],
    },
    waves: waves(1),
    difficulty: 1,
  },
  {
    id: 'forest-2',
    worldId: 'forest',
    number: '1-2',
    name: 'Sunpetal Grove',
    subtitle: 'Pollination / moderate',
    briefing: 'Defend a flowering grove and discover how pollinators connect plants across an ecosystem.',
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
    terrain: {
      seed: 202,
      pathBranches: [{ x: 7, y: 5 }, { x: 6, y: 5 }],
      // Eight dirt cells surrounding grass demonstrate an enclosed grass island.
      dirt: [
        { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 },
        { x: 9, y: 9 }, { x: 11, y: 9 },
        { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 11, y: 10 },
      ],
    },
    waves: waves(1.16),
    difficulty: 2,
  },
  {
    id: 'forest-3',
    worldId: 'forest',
    number: '1-3',
    name: 'Elderwood Heart',
    subtitle: 'Forest layers / challenging',
    briefing: 'Guard the oldest tree and combine defenders from the forest floor to the canopy.',
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
    terrain: {
      seed: 303,
      pathBranches: [{ x: 4, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }],
      dirt: [
        { x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 },
        { x: 13, y: 9 }, { x: 14, y: 9 },
      ],
    },
    waves: waves(1.34),
    difficulty: 3,
  },
];

const WORLD_CONTENT: Record<WorldId, {
  name: string;
  theme: string;
  learningFocus: string;
  description: string;
  icon: string;
  color: string;
  maps: readonly [string, string, string];
}> = {
  forest: {
    name: 'Forest World', theme: 'Ecosystems and nature', learningFocus: 'Food webs, pollination, adaptation, and forest layers',
    description: 'Grow a living defence and learn how woodland systems support one another.', icon: 'trees', color: '#6f9f3b',
    maps: ['Mossy Crossing', 'Sunpetal Grove', 'Elderwood Heart'],
  },
  workshop: {
    name: 'Workshop World', theme: 'Machines and cause-and-effect', learningFocus: 'Forces, simple machines, energy transfer, and sequences',
    description: 'Trace what makes mechanisms move and how one action produces another.', icon: 'cog', color: '#c47d31',
    maps: ['Cogworks Entry', 'Assembly Line', 'Boiler Core'],
  },
  word: {
    name: 'Word World', theme: 'Literacy and language', learningFocus: 'Letters, rhyme, punctuation, syllables, and vocabulary',
    description: 'Build meaning from sounds, symbols, sentences, and stories.', icon: 'book-open', color: '#a55e9f',
    maps: ['Alphabet Avenue', 'Rhyme River', 'Storybook Keep'],
  },
  number: {
    name: 'Number World', theme: 'Patterns, counting and logic', learningFocus: 'Operations, patterns, fractions, sequences, and reasoning',
    description: 'Spot relationships and solve increasingly clever numerical paths.', icon: 'shapes', color: '#3f91b8',
    maps: ['Counting Garden', 'Fraction Fields', 'Logic Lab'],
  },
  space: {
    name: 'Space World', theme: 'Planets, gravity and science', learningFocus: 'Orbits, gravity, solar energy, satellites, and nebulae',
    description: 'Explore the forces and objects that shape our neighbourhood in space.', icon: 'orbit', color: '#665db4',
    maps: ['Moonbase Approach', 'Orbit Junction', 'Nebula Gate'],
  },
  music: {
    name: 'Music World', theme: 'Rhythm and sequencing', learningFocus: 'Beat, tempo, pitch, melody, echo, and conducting',
    description: 'Arrange musical ideas in time and hear how individual parts cooperate.', icon: 'music-2', color: '#d05f78',
    maps: ['Rhythm Road', 'Harmony Hall', 'Finale Stage'],
  },
};

function cloneLevelForWorld(template: LevelDefinition, worldId: WorldId, worldIndex: number, mapIndex: number): LevelDefinition {
  const content = WORLD_CONTENT[worldId];
  const difficulty = 1 + mapIndex * 0.16 + worldIndex * 0.04;
  return {
    ...template,
    id: `${worldId}-${mapIndex + 1}`,
    worldId,
    number: `${worldIndex + 1}-${mapIndex + 1}`,
    name: content.maps[mapIndex],
    subtitle: `${content.theme} / ${mapIndex === 0 ? 'guided' : mapIndex === 1 ? 'developing' : 'challenge'}`,
    briefing: `${content.learningFocus}. ${mapIndex === 0 ? 'Start with clear build space.' : mapIndex === 1 ? 'Combine roles around central pressure.' : 'Apply the full world roster.'}`,
    startCash: template.startCash + worldIndex * 10,
    waves: waves(difficulty),
    difficulty: mapIndex + 1,
    terrain: template.terrain ? { ...template.terrain, seed: (worldIndex + 1) * 1000 + (mapIndex + 1) * 101 } : undefined,
  };
}

export const LEVELS: LevelDefinition[] = WORLD_IDS.flatMap((worldId, worldIndex) =>
  FOREST_LEVELS.map((template, mapIndex) => cloneLevelForWorld(template, worldId, worldIndex, mapIndex)),
);

export const WORLDS: WorldDefinition[] = WORLD_IDS.map((id, index) => ({
  id,
  number: index + 1,
  ...WORLD_CONTENT[id],
  mapIds: LEVELS.filter((level) => level.worldId === id).map((level) => level.id),
  artStatus: id === 'forest' ? 'complete' : 'placeholder',
}));

export function getTowerDefinition(id: TowerId, worldId: WorldId = 'forest'): TowerDefinition {
  return WORLD_TOWER_DEFINITIONS[worldId][id];
}

export function getLevel(id: string): LevelDefinition {
  const legacyIds: Record<string, string> = { switchback: 'forest-1', crosscut: 'forest-2', gauntlet: 'forest-3' };
  return LEVELS.find((level) => level.id === (legacyIds[id] ?? id)) ?? LEVELS[0];
}

export function getWorld(id: WorldId): WorldDefinition {
  return WORLDS.find((world) => world.id === id) ?? WORLDS[0];
}
