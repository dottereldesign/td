export type AttackType = 'normal' | 'pierce' | 'siege' | 'magic' | 'chaos';
export type ArmorType = 'unarmored' | 'light' | 'medium' | 'heavy' | 'fortified';
export type TowerId = 'sentry' | 'needle' | 'mortar' | 'arcanum' | 'toxin' | 'null';
export type TargetMode = 'first' | 'strong' | 'last';
export type GamePhase = 'build' | 'wave' | 'victory' | 'defeat';

export interface Cell {
  x: number;
  y: number;
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
  number: string;
  name: string;
  subtitle: string;
  briefing: string;
  cols: number;
  rows: number;
  startCash: number;
  startLives: number;
  path: Cell[];
  waves: WaveDefinition[];
  difficulty: number;
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
}

export interface Impact {
  id: number;
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
  kind: 'hit' | 'splash' | 'build' | 'sell' | 'leak';
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
