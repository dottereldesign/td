export type AttackType = 'normal' | 'pierce' | 'siege' | 'magic' | 'chaos';
export type ArmorType = 'unarmored' | 'light' | 'medium' | 'heavy' | 'fortified';
export type TowerId = 'sentry' | 'needle' | 'mortar' | 'arcanum' | 'toxin' | 'null';
export type WorldId = 'forest' | 'workshop' | 'word' | 'number' | 'space' | 'music';
export type TargetMode = 'first' | 'strong' | 'last';
export type GamePhase = 'build' | 'wave' | 'victory' | 'defeat';

export interface Cell {
  x: number;
  y: number;
}

export type TerrainKind = 'grass' | 'path' | 'dirt';

/** Optional visual terrain layered around the authoritative enemy route. */
export interface TerrainDefinition {
  /** Extra path cells may branch or reconnect without changing enemy movement. */
  pathBranches?: Cell[];
  /** Full-cell decorative dirt regions, independent from the narrow route. */
  dirt?: Cell[];
  /** Stable seed used for terrain variations and decorations. */
  seed?: number;
}

export interface PoisonSpec {
  dps: number;
  duration: number;
  maxStacks: number;
}

export interface SlowSpec {
  factor: number;
  duration: number;
}

export interface TowerDefinition {
  id: TowerId;
  name: string;
  shortName: string;
  hotkey: string;
  icon: string;
  attackType: AttackType;
  role: string;
  description: string;
  cost: number;
  damage: number;
  interval: number;
  range: number;
  projectileSpeed: number;
  splash?: number;
  poison?: PoisonSpec;
  slow?: SlowSpec;
}

export interface Tower {
  id: number;
  definitionId: TowerId;
  cell: Cell;
  level: number;
  cooldown: number;
  targetMode: TargetMode;
  invested: number;
  totalDamage: number;
  kills: number;
  /** Radians, with 0 facing to the right; used only for visual orientation. */
  facing?: number;
  /** Short 0..1 visual recoil pulse set whenever the tower fires. */
  firePulse?: number;
}

export interface EnemyGroup {
  armorType: ArmorType;
  armor: number;
  count: number;
  hp: number;
  speed: number;
  bounty: number;
  interval: number;
  scale?: number;
}

export interface WaveDefinition {
  name: string;
  description: string;
  groups: EnemyGroup[];
  clearBonus: number;
}

export interface LevelDefinition {
  id: string;
  worldId: WorldId;
  number: string;
  name: string;
  subtitle: string;
  briefing: string;
  cols: number;
  rows: number;
  startCash: number;
  startLives: number;
  path: Cell[];
  terrain?: TerrainDefinition;
  waves: WaveDefinition[];
  difficulty: number;
}

export interface WorldDefinition {
  id: WorldId;
  number: number;
  name: string;
  theme: string;
  learningFocus: string;
  description: string;
  icon: string;
  color: string;
  mapIds: string[];
  artStatus: 'complete' | 'placeholder';
}

export interface PoisonEffect {
  sourceTowerId: number;
  dps: number;
  remaining: number;
}

export interface SlowEffect {
  factor: number;
  remaining: number;
}

export interface Enemy {
  id: number;
  armorType: ArmorType;
  armor: number;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  bounty: number;
  scale: number;
  x: number;
  y: number;
  segment: number;
  segmentProgress: number;
  distanceTravelled: number;
  alive: boolean;
  poisons: PoisonEffect[];
  slow?: SlowEffect;
}

export interface Projectile {
  id: number;
  sourceTowerId: number;
  targetId: number;
  x: number;
  y: number;
  speed: number;
  damage: number;
  attackType: AttackType;
  splash?: number;
  poison?: PoisonSpec;
  slow?: SlowSpec;
  alive: boolean;
  visual?: TowerId;
  originX?: number;
  originY?: number;
  initialDistance?: number;
  age?: number;
}

export interface Impact {
  id: number;
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
  kind: 'hit' | 'splash' | 'build' | 'sell' | 'leak';
  visual?: TowerId;
}

export type GameEvent =
  | { type: 'toast'; message: string; tone?: 'default' | 'warning' | 'success' }
  | { type: 'tower-built'; tower: Tower }
  | { type: 'tower-fired'; tower: Tower }
  | { type: 'enemy-hit'; amount: number }
  | { type: 'enemy-killed' }
  | { type: 'enemy-leaked' }
  | { type: 'wave-started'; wave: number }
  | { type: 'wave-cleared'; wave: number; bonus: number }
  | { type: 'outcome'; outcome: 'victory' | 'defeat' };

export interface SpawnEntry extends EnemyGroup {
  at: number;
}
