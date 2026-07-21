import { getTowerDefinition } from '../data';
import type { ArmorType, Cell, Tower, TowerId } from '../types';
import { Game } from '../game/Game';

interface Metrics {
  width: number;
  height: number;
  cell: number;
}

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private dpr = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: Game,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not supported in this browser.');
    this.context = context;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  cellFromPointer(clientX: number, clientY: number): Cell {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: Math.floor(((clientX - bounds.left) / bounds.width) * this.game.level.cols),
      y: Math.floor(((clientY - bounds.top) / bounds.height) * this.game.level.rows),
    };
  }

  draw(time: number): void {
    const metrics = this.metrics();
    const ctx = this.context;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, metrics.width, metrics.height);

    this.drawTerrain(metrics);
    this.drawPath(metrics);
    if (this.game.selectedBuild) this.drawPlacementGrid(metrics);
    this.drawSelectedRange(metrics);
    this.drawTowers(metrics, time);
    this.drawEnemies(metrics, time);
    this.drawProjectiles(metrics);
    this.drawImpacts(metrics);
    this.drawPlacementGhost(metrics, time);

    if (this.game.paused) this.drawPaused(metrics);
  }

  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * this.dpr));
    const height = Math.max(1, Math.round(bounds.height * this.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private metrics(): Metrics {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      cell: bounds.width / this.game.level.cols,
    };
  }

  private drawTerrain({ width, height, cell }: Metrics): void {
    const ctx = this.context;
    ctx.fillStyle = '#151614';
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < this.game.level.rows; y += 1) {
      for (let x = 0; x < this.game.level.cols; x += 1) {
        const noise = this.hash(x, y);
        ctx.fillStyle = noise > 0.52 ? '#191a18' : '#171816';
        ctx.fillRect(x * cell, y * cell, cell, cell);

        if (noise > 0.78 && !this.game.isPathCell({ x, y })) {
          ctx.strokeStyle = '#292a27';
          ctx.lineWidth = Math.max(1, cell * 0.018);
          ctx.beginPath();
          const px = (x + 0.24 + noise * 0.2) * cell;
          const py = (y + 0.3) * cell;
          ctx.moveTo(px, py);
          ctx.lineTo(px + cell * 0.18, py + cell * 0.08);
          ctx.lineTo(px + cell * 0.04, py + cell * 0.15);
          ctx.stroke();
        }
      }
    }

    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, width * 0.72);
    gradient.addColorStop(0, 'rgba(255,255,255,0.025)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  private drawPath({ cell }: Metrics): void {
    const ctx = this.context;
    for (const pathCell of this.game.level.path) {
      const x = pathCell.x * cell;
      const y = pathCell.y * cell;
      ctx.fillStyle = '#343532';
      ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = '#454743';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);

      ctx.strokeStyle = 'rgba(238,238,232,0.06)';
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.14, y + cell * 0.72);
      ctx.lineTo(x + cell * 0.86, y + cell * 0.28);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(240,240,234,0.34)';
    ctx.lineWidth = Math.max(1, cell * 0.025);
    ctx.setLineDash([cell * 0.13, cell * 0.18]);
    ctx.beginPath();
    this.game.level.path.forEach((pathCell, index) => {
      const x = (pathCell.x + 0.5) * cell;
      const y = (pathCell.y + 0.5) * cell;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    for (let index = 2; index < this.game.level.path.length - 1; index += 4) {
      const previous = this.game.level.path[index - 1];
      const current = this.game.level.path[index];
      const angle = Math.atan2(current.y - previous.y, current.x - previous.x);
      const x = (current.x + 0.5) * cell;
      const y = (current.y + 0.5) * cell;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(242,242,236,0.42)';
      ctx.beginPath();
      ctx.moveTo(cell * 0.15, 0);
      ctx.lineTo(-cell * 0.08, -cell * 0.09);
      ctx.lineTo(-cell * 0.08, cell * 0.09);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const start = this.game.level.path[0];
    const end = this.game.level.path[this.game.level.path.length - 1];
    this.drawEndpoint(start, 'IN', cell, false);
    this.drawEndpoint(end, 'CORE', cell, true);
  }

  private drawEndpoint(cellPosition: Cell, label: string, cell: number, reverse: boolean): void {
    const ctx = this.context;
    const x = (cellPosition.x + 0.5) * cell;
    const y = (cellPosition.y + 0.5) * cell;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#e9e9e2';
    ctx.lineWidth = Math.max(1.5, cell * 0.035);
    ctx.strokeRect(-cell * 0.32, -cell * 0.32, cell * 0.64, cell * 0.64);
    ctx.fillStyle = '#e9e9e2';
    ctx.font = `700 ${Math.max(8, cell * 0.15)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.beginPath();
    const direction = reverse ? -1 : 1;
    ctx.moveTo(direction * cell * 0.44, 0);
    ctx.lineTo(direction * cell * 0.31, -cell * 0.08);
    ctx.lineTo(direction * cell * 0.31, cell * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawPlacementGrid({ width, height, cell }: Metrics): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = 'rgba(239,239,233,0.14)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (let x = 0; x <= this.game.level.cols; x += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x * cell) + 0.5, 0);
      ctx.lineTo(Math.round(x * cell) + 0.5, height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.game.level.rows; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y * cell) + 0.5);
      ctx.lineTo(width, Math.round(y * cell) + 0.5);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(239,239,233,0.08)';
    for (const pathCell of this.game.level.path) {
      this.drawCross(pathCell.x * cell, pathCell.y * cell, cell, ctx.strokeStyle);
    }
    for (const tower of this.game.towers) {
      this.drawCross(tower.cell.x * cell, tower.cell.y * cell, cell, ctx.strokeStyle);
    }
    ctx.restore();
  }

  private drawSelectedRange({ cell }: Metrics): void {
    const tower = this.game.getSelectedTower();
    if (!tower) return;
    const stats = this.game.getTowerStats(tower);
    const x = (tower.cell.x + 0.5) * cell;
    const y = (tower.cell.y + 0.5) * cell;
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = 'rgba(239,239,233,0.035)';
    ctx.strokeStyle = 'rgba(239,239,233,0.4)';
    ctx.lineWidth = Math.max(1, cell * 0.025);
    ctx.setLineDash([cell * 0.08, cell * 0.08]);
    ctx.beginPath();
    ctx.arc(x, y, stats.range * cell, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f0f0e9';
    ctx.strokeRect(tower.cell.x * cell + 2, tower.cell.y * cell + 2, cell - 4, cell - 4);
    ctx.restore();
  }

  private drawTowers({ cell }: Metrics, time: number): void {
    for (const tower of this.game.towers) {
      const x = (tower.cell.x + 0.5) * cell;
      const y = (tower.cell.y + 0.5) * cell;
      const selected = tower.id === this.game.selectedTowerId;
      this.drawTower(tower, x, y, cell, time, selected);
    }
  }

  private drawTower(tower: Tower, x: number, y: number, cell: number, time: number, selected: boolean): void {
    const ctx = this.context;
    const size = cell * 0.34;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#0f100f';
    ctx.strokeStyle = selected ? '#ffffff' : '#a8aaa5';
    ctx.lineWidth = selected ? Math.max(2, cell * 0.045) : Math.max(1.2, cell * 0.026);
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const pulse = 1 + Math.sin(time * 0.003 + tower.id) * 0.025;
    ctx.scale(pulse, pulse);
    this.drawTowerGlyph(tower.definitionId, size);

    ctx.fillStyle = '#efefe9';
    for (let tier = 0; tier < tower.level; tier += 1) {
      ctx.fillRect((tier - (tower.level - 1) / 2) * cell * 0.11 - cell * 0.022, size + cell * 0.09, cell * 0.045, cell * 0.045);
    }
    ctx.restore();
  }

  private drawTowerGlyph(id: TowerId, size: number): void {
    const ctx = this.context;
    ctx.strokeStyle = '#f0f0e9';
    ctx.fillStyle = '#f0f0e9';
    ctx.lineWidth = Math.max(1.5, size * 0.11);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (id === 'sentry') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.43, 0, Math.PI * 2);
      ctx.moveTo(-size * 0.7, 0);
      ctx.lineTo(size * 0.7, 0);
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(0, size * 0.7);
      ctx.stroke();
    } else if (id === 'needle') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.72);
      ctx.lineTo(size * 0.24, 0);
      ctx.lineTo(0, size * 0.72);
      ctx.lineTo(-size * 0.24, 0);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'mortar') {
      ctx.strokeRect(-size * 0.45, -size * 0.37, size * 0.9, size * 0.74);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(-size * 0.1, -size * 0.75, size * 0.2, size * 0.47);
    } else if (id === 'arcanum') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
      ctx.moveTo(-size * 0.5, size * 0.28);
      ctx.lineTo(0, -size * 0.6);
      ctx.lineTo(size * 0.5, size * 0.28);
      ctx.closePath();
      ctx.stroke();
    } else if (id === 'toxin') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.62);
      ctx.bezierCurveTo(size * 0.48, -size * 0.08, size * 0.43, size * 0.48, 0, size * 0.58);
      ctx.bezierCurveTo(-size * 0.43, size * 0.48, -size * 0.48, -size * 0.08, 0, -size * 0.62);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, size * 0.2, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2);
      ctx.arc(0, 0, size * 0.27, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.fillRect(-size * 0.09, -size * 0.78, size * 0.18, size * 1.56);
    }
  }

  private drawEnemies({ cell }: Metrics, time: number): void {
    const ctx = this.context;
    for (const enemy of this.game.enemies) {
      if (!enemy.alive) continue;
      const x = enemy.x * cell;
      const y = enemy.y * cell;
      const radius = cell * 0.22 * enemy.scale;
      ctx.save();
      ctx.translate(x, y);

      if (enemy.poisons.length > 0) {
        ctx.strokeStyle = '#d6d6cf';
        ctx.lineWidth = Math.max(1, cell * 0.022);
        ctx.setLineDash([cell * 0.055, cell * 0.055]);
        ctx.beginPath();
        ctx.arc(0, 0, radius + cell * 0.09 + Math.sin(time * 0.007) * cell * 0.015, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (enemy.slow) {
        ctx.strokeStyle = '#8e908b';
        ctx.beginPath();
        ctx.arc(0, 0, radius + cell * 0.05, Math.PI * 0.1, Math.PI * 0.8);
        ctx.arc(0, 0, radius + cell * 0.05, Math.PI * 1.1, Math.PI * 1.8);
        ctx.stroke();
      }

      ctx.fillStyle = '#d9d9d3';
      ctx.strokeStyle = '#080908';
      ctx.lineWidth = Math.max(2, cell * 0.045);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawArmorMark(enemy.armorType, radius);

      const barWidth = cell * 0.56 * enemy.scale;
      const barY = -radius - cell * 0.16;
      ctx.fillStyle = '#090a09';
      ctx.fillRect(-barWidth / 2, barY, barWidth, cell * 0.07);
      ctx.fillStyle = '#efefe9';
      ctx.fillRect(-barWidth / 2, barY, barWidth * Math.max(0, enemy.hp / enemy.maxHp), cell * 0.07);
      ctx.strokeStyle = '#090a09';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barWidth / 2, barY, barWidth, cell * 0.07);

      ctx.restore();
    }
  }

  private drawArmorMark(type: ArmorType, radius: number): void {
    const ctx = this.context;
    ctx.strokeStyle = '#171816';
    ctx.fillStyle = '#171816';
    ctx.lineWidth = Math.max(1, radius * 0.13);
    if (type === 'light') {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'medium') {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.48, -radius * 0.38);
      ctx.lineTo(radius * 0.48, radius * 0.38);
      ctx.moveTo(radius * 0.48, -radius * 0.38);
      ctx.lineTo(-radius * 0.48, radius * 0.38);
      ctx.stroke();
    } else if (type === 'heavy') {
      ctx.strokeRect(-radius * 0.42, -radius * 0.42, radius * 0.84, radius * 0.84);
    } else if (type === 'fortified') {
      ctx.beginPath();
      for (let point = 0; point < 6; point += 1) {
        const angle = -Math.PI / 2 + (point * Math.PI) / 3;
        const x = Math.cos(angle) * radius * 0.55;
        const y = Math.sin(angle) * radius * 0.55;
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawProjectiles({ cell }: Metrics): void {
    const ctx = this.context;
    for (const projectile of this.game.projectiles) {
      const x = projectile.x * cell;
      const y = projectile.y * cell;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0b0c0b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.2, cell * 0.055), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawImpacts({ cell }: Metrics): void {
    const ctx = this.context;
    for (const impact of this.game.impacts) {
      const progress = impact.age / impact.duration;
      ctx.save();
      ctx.translate(impact.x * cell, impact.y * cell);
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = impact.kind === 'leak' ? '#ffffff' : '#d7d7d1';
      ctx.lineWidth = Math.max(1, cell * 0.025);
      ctx.setLineDash(impact.kind === 'sell' ? [3, 3] : []);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(cell * 0.08, impact.radius * cell * progress), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPlacementGhost({ cell }: Metrics, time: number): void {
    const towerId = this.game.selectedBuild;
    const hover = this.game.hoverCell;
    if (!towerId || !hover) return;
    const definition = getTowerDefinition(towerId);
    const placement = this.game.getPlacement(hover, towerId);
    const x = (hover.x + 0.5) * cell;
    const y = (hover.y + 0.5) * cell;
    const ctx = this.context;

    ctx.save();
    ctx.fillStyle = placement.valid ? 'rgba(239,239,233,0.055)' : 'rgba(239,239,233,0.018)';
    ctx.strokeStyle = placement.valid ? '#efefe9' : '#8c8d88';
    ctx.lineWidth = Math.max(1.5, cell * 0.035);
    ctx.setLineDash(placement.valid ? [] : [cell * 0.08, cell * 0.06]);
    ctx.beginPath();
    ctx.arc(x, y, definition.range * cell, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = placement.valid ? 0.82 : 0.42;
    const ghost: Tower = {
      id: -1,
      definitionId: towerId,
      cell: hover,
      level: 1,
      cooldown: 0,
      targetMode: 'first',
      invested: 0,
      totalDamage: 0,
      kills: 0,
    };
    this.drawTower(ghost, x, y, cell, time, placement.valid);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = placement.valid ? '#ffffff' : '#a8aaa5';
    ctx.strokeRect(hover.x * cell + 2, hover.y * cell + 2, cell - 4, cell - 4);
    if (!placement.valid) this.drawCross(hover.x * cell, hover.y * cell, cell, '#e9e9e2');

    const labels: Record<PlacementResultReason, string> = {
      valid: 'PLACE',
      path: 'PATH',
      occupied: 'OCCUPIED',
      funds: 'NEED $',
      bounds: 'OUT',
    };
    const label = placement.reason === 'funds'
      ? `${labels.funds}${definition.cost - this.game.cash}`
      : labels[placement.reason];
    ctx.fillStyle = placement.valid ? '#f4f4ee' : '#c3c4be';
    ctx.font = `700 ${Math.max(9, cell * 0.14)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, hover.y * cell - cell * 0.1);
    ctx.restore();
  }

  private drawPaused({ width, height }: Metrics): void {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = 'rgba(8,9,8,0.58)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#f0f0ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 22px ui-monospace, monospace';
    ctx.fillText('SIMULATION PAUSED', width / 2, height / 2 - 8);
    ctx.font = '500 11px ui-monospace, monospace';
    ctx.fillStyle = '#a8aaa5';
    ctx.fillText('PRESS SPACE TO RESUME', width / 2, height / 2 + 18);
    ctx.restore();
  }

  private drawCross(x: number, y: number, cell: number, color: string): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, cell * 0.02);
    ctx.beginPath();
    ctx.moveTo(x + cell * 0.25, y + cell * 0.25);
    ctx.lineTo(x + cell * 0.75, y + cell * 0.75);
    ctx.moveTo(x + cell * 0.75, y + cell * 0.25);
    ctx.lineTo(x + cell * 0.25, y + cell * 0.75);
    ctx.stroke();
    ctx.restore();
  }

  private hash(x: number, y: number): number {
    const value = Math.sin(x * 12.9898 + y * 78.233 + this.game.level.difficulty * 4.71) * 43_758.5453;
    return value - Math.floor(value);
  }
}

type PlacementResultReason = ReturnType<Game['getPlacement']>['reason'];
