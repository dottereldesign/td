import { getLevel, getTowerDefinition } from '../data';
import type {
  Cell,
  Enemy,
  GameEvent,
  GamePhase,
  Impact,
  LevelDefinition,
  Projectile,
  SpawnEntry,
  TargetMode,
  Tower,
  TowerId,
} from '../types';
import { calculateDamage } from './damage';

export interface TowerStats {
  damage: number;
  interval: number;
  range: number;
  dps: number;
}

export interface PlacementResult {
  valid: boolean;
  reason: 'valid' | 'path' | 'occupied' | 'funds' | 'bounds';
}

type Speed = 1 | 2 | 3;

export class Game {
  level: LevelDefinition;
  cash = 0;
  lives = 0;
  phase: GamePhase = 'build';
  paused = false;
  speed: Speed = 1;
  currentWave = -1;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  impacts: Impact[] = [];
  selectedBuild: TowerId | null = null;
  selectedTowerId: number | null = null;
  hoverCell: Cell | null = null;
  onEvent: (event: GameEvent) => void = () => undefined;

  private nextEntityId = 1;
  private spawnSchedule: SpawnEntry[] = [];
  private spawnCursor = 0;
  private waveClock = 0;

  constructor(levelId = 'switchback') {
    this.level = getLevel(levelId);
    this.startLevel(levelId);
  }

  startLevel(levelId: string): void {
    this.level = getLevel(levelId);
    this.cash = this.level.startCash;
    this.lives = this.level.startLives;
    this.phase = 'build';
    this.paused = false;
    this.speed = 1;
    this.currentWave = -1;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.impacts = [];
    this.selectedBuild = null;
    this.selectedTowerId = null;
    this.hoverCell = null;
    this.spawnSchedule = [];
    this.spawnCursor = 0;
    this.waveClock = 0;
    this.nextEntityId = 1;
  }

  selectBuild(id: TowerId | null): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.selectedBuild = this.selectedBuild === id ? null : id;
    if (this.selectedBuild) this.selectedTowerId = null;
  }

  selectTowerAt(cell: Cell): Tower | null {
    const tower = this.towers.find((candidate) => this.sameCell(candidate.cell, cell)) ?? null;
    this.selectedTowerId = tower?.id ?? null;
    this.selectedBuild = null;
    return tower;
  }

  deselect(): void {
    this.selectedBuild = null;
    this.selectedTowerId = null;
  }

  setHoverCell(cell: Cell | null): void {
    this.hoverCell = cell;
  }

  getSelectedTower(): Tower | null {
    return this.towers.find((tower) => tower.id === this.selectedTowerId) ?? null;
  }

  getTowerStats(tower: Tower): TowerStats {
    const definition = getTowerDefinition(tower.definitionId);
    const tier = tower.level - 1;
    const damage = definition.damage * (1 + 0.34 * tier);
    const interval = definition.interval * Math.pow(0.88, tier);
    const range = definition.range + 0.22 * tier;
    return { damage, interval, range, dps: damage / interval };
  }

  getUpgradeCost(tower: Tower): number | null {
    if (tower.level >= 3) return null;
    const definition = getTowerDefinition(tower.definitionId);
    const multiplier = tower.level === 1 ? 0.72 : 1.08;
    return Math.ceil((definition.cost * multiplier) / 5) * 5;
  }

  getSellValue(tower: Tower): number {
    return Math.floor((tower.invested * 0.72) / 5) * 5;
  }

  getPlacement(cell: Cell, towerId = this.selectedBuild): PlacementResult {
    if (!towerId || cell.x < 0 || cell.y < 0 || cell.x >= this.level.cols || cell.y >= this.level.rows) {
      return { valid: false, reason: 'bounds' };
    }
    if (this.isPathCell(cell)) return { valid: false, reason: 'path' };
    if (this.towers.some((tower) => this.sameCell(tower.cell, cell))) {
      return { valid: false, reason: 'occupied' };
    }
    if (this.cash < getTowerDefinition(towerId).cost) return { valid: false, reason: 'funds' };
    return { valid: true, reason: 'valid' };
  }

  placeTower(cell: Cell, repeat = false): Tower | null {
    if (!this.selectedBuild) return null;
    const placement = this.getPlacement(cell);
    if (!placement.valid) {
      const messages: Record<PlacementResult['reason'], string> = {
        valid: '',
        path: 'The route must remain clear.',
        occupied: 'That tile is already occupied.',
        funds: 'Not enough credits for that tower.',
        bounds: 'Choose a tile inside the sector.',
      };
      this.emit({ type: 'toast', message: messages[placement.reason], tone: 'warning' });
      return null;
    }

    const definition = getTowerDefinition(this.selectedBuild);
    const tower: Tower = {
      id: this.nextId(),
      definitionId: this.selectedBuild,
      cell: { ...cell },
      level: 1,
      cooldown: 0.16,
      targetMode: 'first',
      invested: definition.cost,
      totalDamage: 0,
      kills: 0,
      facing: -Math.PI / 2,
      firePulse: 0,
    };
    this.cash -= definition.cost;
    this.towers.push(tower);
    this.impacts.push(this.makeImpact(cell.x + 0.5, cell.y + 0.5, 'build', 0.58));
    this.emit({ type: 'tower-built', tower });
    this.emit({ type: 'toast', message: `${definition.name} deployed.`, tone: 'success' });

    if (!repeat) {
      this.selectedBuild = null;
      this.selectedTowerId = tower.id;
    }
    return tower;
  }

  upgradeSelected(): boolean {
    const tower = this.getSelectedTower();
    if (!tower) return false;
    const cost = this.getUpgradeCost(tower);
    if (cost === null) {
      this.emit({ type: 'toast', message: 'This tower is at maximum tier.' });
      return false;
    }
    if (this.cash < cost) {
      this.emit({ type: 'toast', message: `Upgrade needs $${cost - this.cash} more.`, tone: 'warning' });
      return false;
    }
    this.cash -= cost;
    tower.invested += cost;
    tower.level += 1;
    this.impacts.push(this.makeImpact(tower.cell.x + 0.5, tower.cell.y + 0.5, 'build', 0.72));
    this.emit({ type: 'toast', message: `${getTowerDefinition(tower.definitionId).name} advanced to tier ${tower.level}.`, tone: 'success' });
    return true;
  }

  sellSelected(): boolean {
    const tower = this.getSelectedTower();
    if (!tower) return false;
    const value = this.getSellValue(tower);
    this.cash += value;
    this.towers = this.towers.filter((candidate) => candidate.id !== tower.id);
    this.projectiles = this.projectiles.filter((projectile) => projectile.sourceTowerId !== tower.id);
    this.impacts.push(this.makeImpact(tower.cell.x + 0.5, tower.cell.y + 0.5, 'sell', 0.7));
    this.selectedTowerId = null;
    this.emit({ type: 'toast', message: `Tower recovered for $${value}.` });
    return true;
  }

  setTargetMode(mode: TargetMode): void {
    const tower = this.getSelectedTower();
    if (tower) tower.targetMode = mode;
  }

  startWave(): boolean {
    if (this.phase !== 'build' || this.currentWave >= this.level.waves.length - 1) return false;
    this.currentWave += 1;
    this.phase = 'wave';
    this.paused = false;
    this.waveClock = 0;
    this.spawnCursor = 0;
    this.spawnSchedule = this.makeSpawnSchedule(this.level.waves[this.currentWave]);
    this.emit({ type: 'wave-started', wave: this.currentWave });
    return true;
  }

  togglePause(force?: boolean): boolean {
    if (this.phase !== 'wave') return this.paused;
    this.paused = force ?? !this.paused;
    this.emit({ type: 'toast', message: this.paused ? 'Simulation paused.' : 'Simulation resumed.' });
    return this.paused;
  }

  cycleSpeed(): Speed {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    return this.speed;
  }

  update(dt: number): void {
    this.updateImpacts(dt);
    if (this.phase !== 'wave' || this.paused) return;

    this.waveClock += dt;
    while (
      this.spawnCursor < this.spawnSchedule.length &&
      this.spawnSchedule[this.spawnCursor].at <= this.waveClock
    ) {
      this.spawnEnemy(this.spawnSchedule[this.spawnCursor]);
      this.spawnCursor += 1;
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.enemies = this.enemies.filter((enemy) => enemy.alive);
    this.projectiles = this.projectiles.filter((projectile) => projectile.alive);

    if (this.lives <= 0) {
      this.phase = 'defeat';
      this.paused = false;
      this.selectedBuild = null;
      this.emit({ type: 'outcome', outcome: 'defeat' });
      return;
    }

    if (this.spawnCursor >= this.spawnSchedule.length && this.enemies.length === 0) {
      const wave = this.level.waves[this.currentWave];
      this.cash += wave.clearBonus;
      this.emit({ type: 'wave-cleared', wave: this.currentWave, bonus: wave.clearBonus });
      if (this.currentWave === this.level.waves.length - 1) {
        this.phase = 'victory';
        this.emit({ type: 'outcome', outcome: 'victory' });
      } else {
        this.phase = 'build';
      }
    }
  }

  isPathCell(cell: Cell): boolean {
    return this.level.path.some((pathCell) => this.sameCell(pathCell, cell));
  }

  private updateTowers(dt: number): void {
    for (const tower of this.towers) {
      tower.firePulse = Math.max(0, (tower.firePulse ?? 0) - dt * 5.5);
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const target = this.chooseTarget(tower);
      if (!target) {
        tower.cooldown = Math.max(tower.cooldown, -0.1);
        continue;
      }

      const definition = getTowerDefinition(tower.definitionId);
      const stats = this.getTowerStats(tower);
      const tierScale = 1 + (tower.level - 1) * 0.25;
      const originX = tower.cell.x + 0.5;
      const originY = tower.cell.y + 0.5;
      tower.facing = Math.atan2(target.y - originY, target.x - originX);
      tower.firePulse = 1;
      this.projectiles.push({
        id: this.nextId(),
        sourceTowerId: tower.id,
        targetId: target.id,
        x: originX,
        y: originY,
        speed: definition.projectileSpeed,
        damage: stats.damage,
        attackType: definition.attackType,
        splash: definition.splash ? definition.splash + (tower.level - 1) * 0.06 : undefined,
        poison: definition.poison
          ? { ...definition.poison, dps: definition.poison.dps * tierScale }
          : undefined,
        slow: definition.slow
          ? { ...definition.slow, factor: Math.max(0.62, definition.slow.factor - (tower.level - 1) * 0.04) }
          : undefined,
        alive: true,
        visual: tower.definitionId,
        originX,
        originY,
        initialDistance: Math.max(0.001, Math.hypot(target.x - originX, target.y - originY)),
        age: 0,
      });
      tower.cooldown += stats.interval;
      this.emit({ type: 'tower-fired', tower });
    }
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      projectile.age = (projectile.age ?? 0) + dt;
      const target = this.enemies.find((enemy) => enemy.id === projectile.targetId && enemy.alive);
      if (!target) {
        projectile.alive = false;
        continue;
      }

      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const travel = projectile.speed * dt;
      if (distance > travel + 0.08) {
        projectile.x += (dx / distance) * travel;
        projectile.y += (dy / distance) * travel;
        continue;
      }

      projectile.alive = false;
      const radius = projectile.splash ?? 0;
      const victims = radius > 0
        ? this.enemies.filter((enemy) => enemy.alive && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius)
        : [target];

      for (const victim of victims) {
        const falloff = victim.id === target.id ? 1 : 0.68;
        this.damageEnemy(victim, projectile.damage * falloff, projectile.attackType, projectile.sourceTowerId);
      }

      if (target.alive && projectile.poison) {
        this.applyPoison(target, projectile.sourceTowerId, projectile.poison.dps, projectile.poison.duration, projectile.poison.maxStacks);
      }
      if (target.alive && projectile.slow) {
        this.applySlow(target, projectile.slow.factor, projectile.slow.duration);
      }
      this.impacts.push(this.makeImpact(target.x, target.y, radius > 0 ? 'splash' : 'hit', radius || 0.3, projectile.visual));
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      enemy.poisons = enemy.poisons.filter((poison) => {
        poison.remaining -= dt;
        if (poison.remaining <= 0) return false;
        this.damageEnemy(enemy, poison.dps * dt, null, poison.sourceTowerId);
        return enemy.alive;
      });
      if (!enemy.alive) continue;

      if (enemy.slow) {
        enemy.slow.remaining -= dt;
        if (enemy.slow.remaining <= 0) enemy.slow = undefined;
      }
      const speed = enemy.baseSpeed * (enemy.slow?.factor ?? 1);
      this.moveEnemy(enemy, speed * dt);
    }
  }

  private moveEnemy(enemy: Enemy, distance: number): void {
    let remaining = distance;
    while (remaining > 0 && enemy.alive) {
      const targetCell = this.level.path[enemy.segment + 1];
      if (!targetCell) {
        enemy.alive = false;
        this.lives = Math.max(0, this.lives - 1);
        this.impacts.push(this.makeImpact(enemy.x, enemy.y, 'leak', 0.9));
        this.emit({ type: 'enemy-leaked' });
        return;
      }

      const targetX = targetCell.x + 0.5;
      const targetY = targetCell.y + 0.5;
      const dx = targetX - enemy.x;
      const dy = targetY - enemy.y;
      const segmentDistance = Math.hypot(dx, dy);
      if (segmentDistance <= remaining) {
        enemy.x = targetX;
        enemy.y = targetY;
        enemy.segment += 1;
        enemy.segmentProgress = 0;
        enemy.distanceTravelled += segmentDistance;
        remaining -= segmentDistance;
      } else {
        enemy.x += (dx / segmentDistance) * remaining;
        enemy.y += (dy / segmentDistance) * remaining;
        enemy.segmentProgress += remaining;
        enemy.distanceTravelled += remaining;
        remaining = 0;
      }
    }
  }

  private chooseTarget(tower: Tower): Enemy | null {
    const stats = this.getTowerStats(tower);
    const x = tower.cell.x + 0.5;
    const y = tower.cell.y + 0.5;
    const candidates = this.enemies.filter(
      (enemy) => enemy.alive && Math.hypot(enemy.x - x, enemy.y - y) <= stats.range,
    );
    if (candidates.length === 0) return null;

    return candidates.reduce((best, candidate) => {
      if (tower.targetMode === 'strong') {
        if (candidate.maxHp === best.maxHp) return candidate.distanceTravelled > best.distanceTravelled ? candidate : best;
        return candidate.maxHp > best.maxHp ? candidate : best;
      }
      if (tower.targetMode === 'last') {
        return candidate.distanceTravelled < best.distanceTravelled ? candidate : best;
      }
      return candidate.distanceTravelled > best.distanceTravelled ? candidate : best;
    });
  }

  private damageEnemy(
    enemy: Enemy,
    rawDamage: number,
    attackType: Projectile['attackType'] | null,
    sourceTowerId: number,
  ): void {
    if (!enemy.alive) return;
    const amount = attackType
      ? calculateDamage(rawDamage, attackType, enemy.armorType, enemy.armor)
      : rawDamage;
    const applied = Math.min(enemy.hp, amount);
    enemy.hp -= amount;
    const tower = this.towers.find((candidate) => candidate.id === sourceTowerId);
    if (tower) tower.totalDamage += applied;
    // Poison is applied every fixed simulation tick. Emitting a public event
    // for each tiny DOT slice created thousands of callbacks per second at 3×.
    // Direct attacks keep the event; continuous status damage stays internal.
    if (attackType !== null) this.emit({ type: 'enemy-hit', amount });
    if (enemy.hp <= 0) this.killEnemy(enemy, sourceTowerId);
  }

  private killEnemy(enemy: Enemy, sourceTowerId: number): void {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.cash += enemy.bounty;
    const tower = this.towers.find((candidate) => candidate.id === sourceTowerId);
    if (tower) tower.kills += 1;
    this.emit({ type: 'enemy-killed' });
  }

  private applyPoison(
    enemy: Enemy,
    sourceTowerId: number,
    dps: number,
    duration: number,
    maxStacks: number,
  ): void {
    const existing = enemy.poisons.find((poison) => poison.sourceTowerId === sourceTowerId);
    if (existing) {
      existing.dps = Math.max(existing.dps, dps);
      existing.remaining = duration;
      return;
    }
    if (enemy.poisons.length >= maxStacks) {
      enemy.poisons.sort((a, b) => a.remaining - b.remaining).shift();
    }
    enemy.poisons.push({ sourceTowerId, dps, remaining: duration });
  }

  private applySlow(enemy: Enemy, factor: number, duration: number): void {
    if (!enemy.slow) {
      enemy.slow = { factor, remaining: duration };
      return;
    }
    enemy.slow.factor = Math.min(enemy.slow.factor, factor);
    enemy.slow.remaining = Math.max(enemy.slow.remaining, duration);
  }

  private spawnEnemy(entry: SpawnEntry): void {
    const start = this.level.path[0];
    this.enemies.push({
      id: this.nextId(),
      armorType: entry.armorType,
      armor: entry.armor,
      hp: entry.hp,
      maxHp: entry.hp,
      baseSpeed: entry.speed,
      bounty: entry.bounty,
      scale: entry.scale ?? 1,
      x: start.x + 0.5,
      y: start.y + 0.5,
      segment: 0,
      segmentProgress: 0,
      distanceTravelled: 0,
      alive: true,
      poisons: [],
    });
  }

  private makeSpawnSchedule(wave: LevelDefinition['waves'][number]): SpawnEntry[] {
    const schedule: SpawnEntry[] = [];
    let at = 0.2;
    for (const group of wave.groups) {
      for (let index = 0; index < group.count; index += 1) {
        schedule.push({ ...group, at });
        at += group.interval;
      }
      at += 0.7;
    }
    return schedule;
  }

  private updateImpacts(dt: number): void {
    for (const impact of this.impacts) impact.age += dt;
    this.impacts = this.impacts.filter((impact) => impact.age < impact.duration);
  }

  private makeImpact(x: number, y: number, kind: Impact['kind'], radius: number, visual?: TowerId): Impact {
    const duration = visual === 'toxin' ? 0.55 : visual === 'mortar' ? 0.46 : kind === 'splash' ? 0.32 : 0.42;
    return { id: this.nextId(), x, y, kind, radius, age: 0, duration, visual };
  }

  private sameCell(a: Cell, b: Cell): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private nextId(): number {
    const id = this.nextEntityId;
    this.nextEntityId += 1;
    return id;
  }

  private emit(event: GameEvent): void {
    this.onEvent(event);
  }
}
