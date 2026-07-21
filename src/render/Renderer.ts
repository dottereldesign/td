import { getTowerDefinition } from '../data';
import { Game } from '../game/Game';
import type { PerformanceMonitor } from '../performance/PerformanceMonitor';
import type { ArmorType, Cell, Impact, Projectile, Tower, TowerId } from '../types';
import { AssetStore, getTowerAssetId, PATH_TILE_ASSET_IDS, type RenderAssetId } from './assets';
import { sampleOrderedPath } from './autotile';
import {
  TERRAIN_E,
  TERRAIN_N,
  TERRAIN_NE,
  TERRAIN_NW,
  TERRAIN_S,
  TERRAIN_SE,
  TERRAIN_SW,
  TERRAIN_W,
} from '../terrain/TerrainMap';

interface Metrics {
  width: number;
  height: number;
  cell: number;
  originX: number;
  originY: number;
  boardWidth: number;
  boardHeight: number;
}

export class Renderer {
  private context: CanvasRenderingContext2D;
  private readonly dynamicContext: CanvasRenderingContext2D;
  private readonly terrainContext: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly assets = new AssetStore();
  private readonly reducedMotion: boolean;
  private readonly playfieldFit: HTMLElement | null;
  private dpr = 1;
  private cachedMetrics: Metrics | null = null;
  private metricsLevelKey = '';
  private canvasLeft = 0;
  private canvasTop = 0;
  private staticCacheKey = '';
  private staticRebuilds = 0;
  private profiler: PerformanceMonitor | null = null;
  private lowEffects = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: Game,
    playfieldFit: HTMLElement | null = document.getElementById('playfield-fit'),
    private readonly terrainCanvas = document.getElementById('terrain-canvas') as HTMLCanvasElement | null,
  ) {
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) throw new Error('Canvas 2D is not supported in this browser.');
    if (!terrainCanvas) throw new Error('Missing terrain canvas.');
    const terrainContext = terrainCanvas.getContext('2d', { alpha: false });
    if (!terrainContext) throw new Error('Canvas 2D terrain layer is not supported in this browser.');
    this.context = context;
    this.dynamicContext = context;
    this.terrainContext = terrainContext;
    this.playfieldFit = playfieldFit;
    this.reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    if (playfieldFit) this.resizeObserver.observe(playfieldFit);
    this.resize();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  setProfiler(profiler: PerformanceMonitor): void {
    this.profiler = profiler;
  }

  cellFromPointer(clientX: number, clientY: number): Cell {
    const { originX, originY, cell } = this.metrics();
    return {
      x: Math.floor((clientX - this.canvasLeft - originX) / cell),
      y: Math.floor((clientY - this.canvasTop - originY) / cell),
    };
  }

  draw(time: number): void {
    const metrics = this.metrics();
    const staticKey = this.getStaticCacheKey(metrics);
    if (staticKey !== this.staticCacheKey) {
      this.context = this.terrainContext;
      const ctx = this.terrainContext;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, metrics.width, metrics.height);
      const backdropMark = this.profiler?.beginPhase('backdrop') ?? Number.NaN;
      this.drawBackdrop(metrics);
      this.profiler?.endPhase('backdrop', backdropMark);

      const terrainMark = this.profiler?.beginPhase('terrain') ?? Number.NaN;
      ctx.save();
      ctx.translate(metrics.originX, metrics.originY);
      ctx.beginPath();
      ctx.rect(0, 0, metrics.boardWidth, metrics.boardHeight);
      ctx.clip();
      this.drawTerrain(metrics);
      this.drawPath(metrics);
      ctx.restore();
      this.drawBoardFrame(metrics);
      this.profiler?.endPhase('terrain', terrainMark);
      this.staticCacheKey = staticKey;
      this.staticRebuilds += 1;
      this.profiler?.increment('staticRebuilds');
    }

    this.context = this.dynamicContext;
    const ctx = this.dynamicContext;
    this.lowEffects = this.reducedMotion
      || this.canvas.width * this.canvas.height > 1_800_000
      || this.game.towers.length + this.game.enemies.length + this.game.projectiles.length + this.game.impacts.length > 90;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    ctx.translate(metrics.originX, metrics.originY);
    ctx.beginPath();
    ctx.rect(0, 0, metrics.boardWidth, metrics.boardHeight);
    ctx.clip();
    const overlayMark = this.profiler?.beginPhase('overlay') ?? Number.NaN;
    if (this.game.phase === 'build') this.drawPathFlow(metrics, time);
    if (this.game.selectedBuild) this.drawPlacementGrid(metrics);
    this.drawSelectedRange(metrics);
    this.profiler?.endPhase('overlay', overlayMark);
    const towersMark = this.profiler?.beginPhase('towers') ?? Number.NaN;
    this.drawTowers(metrics, time);
    this.profiler?.endPhase('towers', towersMark);
    const enemiesMark = this.profiler?.beginPhase('enemies') ?? Number.NaN;
    this.drawEnemies(metrics, time);
    this.profiler?.endPhase('enemies', enemiesMark);
    const projectilesMark = this.profiler?.beginPhase('projectiles') ?? Number.NaN;
    this.drawProjectiles(metrics);
    this.profiler?.endPhase('projectiles', projectilesMark);
    const effectsMark = this.profiler?.beginPhase('effects') ?? Number.NaN;
    this.drawImpacts(metrics);
    this.drawPlacementGhost(metrics, time);
    this.profiler?.endPhase('effects', effectsMark);
    ctx.restore();

    if (this.game.paused) this.drawPaused(metrics);
  }

  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.canvasLeft = bounds.left;
    this.canvasTop = bounds.top;
    const nativeDpr = Math.min(window.devicePixelRatio || 1, 1.35);
    const pixelBudgetDpr = Math.sqrt(2_200_000 / Math.max(1, bounds.width * bounds.height));
    this.dpr = Math.max(0.5, Math.min(nativeDpr, pixelBudgetDpr));
    const width = Math.max(1, Math.round(bounds.width * this.dpr));
    const height = Math.max(1, Math.round(bounds.height * this.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (this.terrainCanvas!.width !== width || this.terrainCanvas!.height !== height) {
      this.terrainCanvas!.width = width;
      this.terrainCanvas!.height = height;
    }
    this.cachedMetrics = this.measureMetrics(bounds);
    this.metricsLevelKey = this.levelMetricsKey();
    this.staticCacheKey = '';
  }

  private metrics(): Metrics {
    if (!this.cachedMetrics || this.metricsLevelKey !== this.levelMetricsKey()) this.resize();
    return this.cachedMetrics!;
  }

  private measureMetrics(canvasBounds: DOMRect): Metrics {
    let fitLeft = 0;
    let fitTop = 0;
    let fitWidth = canvasBounds.width;
    let fitHeight = canvasBounds.height;

    if (this.playfieldFit) {
      const fitBounds = this.playfieldFit.getBoundingClientRect();
      const left = Math.max(canvasBounds.left, fitBounds.left);
      const top = Math.max(canvasBounds.top, fitBounds.top);
      const right = Math.min(canvasBounds.right, fitBounds.right);
      const bottom = Math.min(canvasBounds.bottom, fitBounds.bottom);
      if (right - left > 20 && bottom - top > 20) {
        fitLeft = left - canvasBounds.left;
        fitTop = top - canvasBounds.top;
        fitWidth = right - left;
        fitHeight = bottom - top;
      }
    }

    const cell = Math.max(1, Math.min(
      fitWidth / this.game.level.cols,
      fitHeight / this.game.level.rows,
    ));
    const boardWidth = cell * this.game.level.cols;
    const boardHeight = cell * this.game.level.rows;

    return {
      width: canvasBounds.width,
      height: canvasBounds.height,
      cell,
      originX: fitLeft + (fitWidth - boardWidth) / 2,
      originY: fitTop + (fitHeight - boardHeight) / 2,
      boardWidth,
      boardHeight,
    };
  }

  private levelMetricsKey(): string {
    return `${this.game.level.id}:${this.game.level.cols}:${this.game.level.rows}`;
  }

  private getStaticCacheKey(metrics: Metrics): string {
    return [
      this.canvas.width,
      this.canvas.height,
      this.game.level.id,
      this.game.terrain.revision,
      this.assets.revision,
      this.game.towers.map((tower) => `${tower.cell.x},${tower.cell.y}`).join(';'),
      metrics.cell.toFixed(3),
      metrics.originX.toFixed(2),
      metrics.originY.toFixed(2),
    ].join(':');
  }

  getDiagnostics(): {
    cssWidth: number;
    cssHeight: number;
    backingWidth: number;
    backingHeight: number;
    effectiveDpr: number;
    megapixels: number;
    staticRebuilds: number;
    quality: 'standard' | 'reduced-fx';
  } {
    const metrics = this.metrics();
    return {
      cssWidth: metrics.width,
      cssHeight: metrics.height,
      backingWidth: this.canvas.width,
      backingHeight: this.canvas.height,
      effectiveDpr: this.dpr,
      megapixels: (this.canvas.width * this.canvas.height) / 1_000_000,
      staticRebuilds: this.staticRebuilds,
      quality: this.lowEffects ? 'reduced-fx' : 'standard',
    };
  }

  private makePattern(assetId: RenderAssetId, targetSize: number, offsetX = 0, offsetY = 0): CanvasPattern | null {
    const image = this.assets.get(assetId);
    if (!image) return null;
    const pattern = this.context.createPattern(image, 'repeat');
    if (!pattern) return null;
    const scale = targetSize / image.naturalWidth;
    pattern.setTransform(new DOMMatrix().translate(offsetX, offsetY).scale(scale));
    return pattern;
  }

  private drawBackdrop({ width, height, cell }: Metrics): void {
    const ctx = this.context;
    const grass = this.makePattern('terrain-ground-grass', Math.max(420, cell * 8.5));
    ctx.fillStyle = grass ?? '#a9d83f';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(47, 91, 29, 0.08)';
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * 0.48, height * 0.44, 0, width * 0.48, height * 0.44, Math.max(width, height) * 0.78);
    glow.addColorStop(0, 'rgba(255, 255, 235, 0.08)');
    glow.addColorStop(0.68, 'rgba(78, 119, 42, 0.025)');
    glow.addColorStop(1, 'rgba(34, 69, 27, 0.2)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  private drawTerrain({ boardWidth, boardHeight, cell, originX, originY }: Metrics): void {
    const ctx = this.context;
    const grass = this.makePattern('terrain-ground-grass', cell * 8.5, -originX, -originY);
    ctx.fillStyle = grass ?? '#addb41';
    ctx.fillRect(0, 0, boardWidth, boardHeight);

    const gradient = ctx.createRadialGradient(boardWidth * 0.48, boardHeight * 0.45, 0, boardWidth * 0.48, boardHeight * 0.45, boardWidth * 0.72);
    gradient.addColorStop(0, 'rgba(255, 255, 235, 0.055)');
    gradient.addColorStop(0.76, 'rgba(255, 255, 235, 0)');
    gradient.addColorStop(1, 'rgba(52, 93, 30, 0.09)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, boardWidth, boardHeight);

    this.drawDirtRegions(cell);
  }

  private drawPath({ cell }: Metrics): void {
    const ctx = this.context;
    const tiles = PATH_TILE_ASSET_IDS.map((id) => this.assets.get(id));

    if (tiles.every((tile) => tile !== null)) {
      for (let y = 0; y < this.game.terrain.rows; y += 1) {
        for (let x = 0; x < this.game.terrain.cols; x += 1) {
          if (!this.game.terrain.isPath(x, y)) continue;
          const mask = this.game.terrain.getPathMask(x, y);
          ctx.drawImage(
            tiles[mask]!,
            x * cell,
            y * cell,
            cell + 0.35,
            cell + 0.35,
          );
        }
      }
    } else {
      this.drawFallbackPath(cell);
    }

    this.drawTerrainDecorations(cell);

    const start = this.game.level.path[0];
    const end = this.game.level.path[this.game.level.path.length - 1];
    this.drawEndpoint(start, 'IN', cell, false);
    this.drawEndpoint(end, 'CORE', cell, true);
  }

  private drawDirtRegions(cell: number): void {
    const ctx = this.context;
    for (let y = 0; y < this.game.terrain.rows; y += 1) {
      for (let x = 0; x < this.game.terrain.cols; x += 1) {
        if (this.game.terrain.get(x, y) !== 'dirt') continue;
        const mask = this.game.terrain.getBlobMask8(x, y, 'dirt');
        this.fillBlobTile(x, y, cell, mask, '#8e744e', 0.055);
        this.fillBlobTile(x, y, cell, mask, '#b79a68', 0);

        const variation = this.hash(this.game.terrain.seed + x * 73, y * 97 + 19);
        ctx.fillStyle = variation > 0.5 ? 'rgba(255, 235, 181, 0.13)' : 'rgba(81, 58, 35, 0.1)';
        ctx.beginPath();
        ctx.ellipse(
          (x + 0.28 + variation * 0.42) * cell,
          (y + 0.3 + this.hash(x * 31, y * 59) * 0.38) * cell,
          cell * 0.055,
          cell * 0.025,
          variation * Math.PI,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  private fillBlobTile(x: number, y: number, cell: number, mask: number, color: string, expansion: number): void {
    const ctx = this.context;
    const left = x * cell;
    const top = y * cell;
    const half = cell * (0.36 + expansion);
    const centreX = left + cell * 0.5;
    const centreY = top + cell * 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(centreX - half, centreY - half, half * 2, half * 2, cell * 0.19);
    ctx.fill();
    if (mask & TERRAIN_N) ctx.fillRect(centreX - half, top, half * 2, cell * 0.5);
    if (mask & TERRAIN_E) ctx.fillRect(centreX, centreY - half, cell * 0.5, half * 2);
    if (mask & TERRAIN_S) ctx.fillRect(centreX - half, centreY, half * 2, cell * 0.5);
    if (mask & TERRAIN_W) ctx.fillRect(left, centreY - half, cell * 0.5, half * 2);
    if (mask & TERRAIN_NE) ctx.fillRect(centreX, top, cell * 0.5, cell * 0.5);
    if (mask & TERRAIN_SE) ctx.fillRect(centreX, centreY, cell * 0.5, cell * 0.5);
    if (mask & TERRAIN_SW) ctx.fillRect(left, centreY, cell * 0.5, cell * 0.5);
    if (mask & TERRAIN_NW) ctx.fillRect(left, top, cell * 0.5, cell * 0.5);
  }

  private drawTerrainDecorations(cell: number): void {
    const ctx = this.context;
    const rocks = this.assets.get('terrain-prop-rock-fern');
    const occupied = new Set(this.game.towers.map((tower) => `${tower.cell.x},${tower.cell.y}`));
    for (let y = 0; y < this.game.terrain.rows; y += 1) {
      for (let x = 0; x < this.game.terrain.cols; x += 1) {
        if (this.game.terrain.get(x, y) !== 'grass' || occupied.has(`${x},${y}`)) continue;
        let nearPath = false;
        for (let oy = -1; oy <= 1 && !nearPath; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (this.game.terrain.isPath(x + ox, y + oy)) nearPath = true;
          }
        }
        const chance = this.hash(this.game.terrain.seed + x * 101, y * 181 + 47);
        if (rocks && !nearPath && chance > 0.965) {
          const size = cell * (0.46 + this.hash(x * 37, y * 41) * 0.16);
          ctx.drawImage(rocks, (x + 0.5) * cell - size / 2, (y + 0.53) * cell - size / 2, size, size);
        } else if (chance > 0.82) {
          const px = (x + 0.25 + this.hash(x * 13, y * 17) * 0.5) * cell;
          const py = (y + 0.3 + this.hash(x * 29, y * 23) * 0.42) * cell;
          ctx.strokeStyle = 'rgba(61, 113, 39, 0.5)';
          ctx.lineWidth = Math.max(1, cell * 0.018);
          ctx.beginPath();
          ctx.moveTo(px, py + cell * 0.08);
          ctx.quadraticCurveTo(px - cell * 0.08, py, px - cell * 0.1, py - cell * 0.07);
          ctx.moveTo(px, py + cell * 0.08);
          ctx.quadraticCurveTo(px + cell * 0.07, py, px + cell * 0.11, py - cell * 0.05);
          ctx.stroke();
        }
      }
    }
  }

  private drawFallbackPath(cell: number): void {
    const ctx = this.context;
    const route = this.game.level.path;
    const first = route[0];
    const second = route[1];
    const beforeLast = route[route.length - 2];
    const last = route[route.length - 1];
    const points = [
      { x: first.x + 0.5 + first.x - second.x, y: first.y + 0.5 + first.y - second.y },
      ...route.map((pathCell) => ({ x: pathCell.x + 0.5, y: pathCell.y + 0.5 })),
      { x: last.x + 0.5 + last.x - beforeLast.x, y: last.y + 0.5 + last.y - beforeLast.y },
    ];

    const strokeRoute = (color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = cell * width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x * cell, point.y * cell);
        else ctx.lineTo(point.x * cell, point.y * cell);
      });
      ctx.stroke();
    };

    strokeRoute('#6d8f35', 0.68);
    strokeRoute('#a8d347', 0.62);
    strokeRoute('#a9936d', 0.52);
    strokeRoute('#f1ede4', 0.44);
  }

  private drawEndpoint(cellPosition: Cell, label: string, cell: number, reverse: boolean): void {
    const ctx = this.context;
    const x = (cellPosition.x + 0.5) * cell;
    const y = (cellPosition.y + 0.5) * cell;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(61, 80, 34, 0.2)';
    ctx.beginPath();
    ctx.ellipse(cell * 0.025, cell * 0.09, cell * 0.31, cell * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = reverse ? '#f7f1e7' : '#689c35';
    ctx.strokeStyle = reverse ? '#6f9638' : '#f8f3e8';
    ctx.lineWidth = Math.max(1.5, cell * 0.045);
    ctx.beginPath();
    ctx.roundRect(-cell * 0.3, -cell * 0.2, cell * 0.6, cell * 0.4, cell * 0.14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = reverse ? '#496d2c' : '#fffaf0';
    ctx.font = `800 ${Math.max(8, cell * 0.14)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  private drawPathFlow({ cell }: Metrics, time: number): void {
    const ctx = this.context;
    const path = this.game.level.path;
    const spacing = 3.05;
    const phase = this.reducedMotion ? 0.9 : (time * 0.00082) % spacing;

    for (let distance = 0.85 + phase; distance < path.length - 1.1; distance += spacing) {
      const sample = sampleOrderedPath(path, distance);
      const pulse = this.reducedMotion ? 1 : 0.92 + Math.sin(time * 0.004 + distance) * 0.08;
      ctx.save();
      ctx.translate(sample.x * cell, sample.y * cell);
      ctx.rotate(sample.angle);
      ctx.globalAlpha = 0.5 * pulse;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(68, 104, 38, 0.72)';
      ctx.lineWidth = Math.max(3, cell * 0.13);
      ctx.beginPath();
      ctx.moveTo(-cell * 0.09, -cell * 0.12);
      ctx.lineTo(cell * 0.065, 0);
      ctx.lineTo(-cell * 0.09, cell * 0.12);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 252, 238, 0.96)';
      ctx.lineWidth = Math.max(1.5, cell * 0.065);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPlacementGrid({ boardWidth, boardHeight, cell }: Metrics): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 246, 240, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (let x = 0; x <= this.game.level.cols; x += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x * cell) + 0.5, 0);
      ctx.lineTo(Math.round(x * cell) + 0.5, boardHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= this.game.level.rows; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y * cell) + 0.5);
      ctx.lineTo(boardWidth, Math.round(y * cell) + 0.5);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(230, 242, 238, 0.13)';
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
    ctx.fillStyle = 'rgba(185, 241, 226, 0.065)';
    ctx.strokeStyle = 'rgba(218, 249, 240, 0.72)';
    ctx.lineWidth = Math.max(1, cell * 0.025);
    ctx.setLineDash([cell * 0.08, cell * 0.08]);
    ctx.beginPath();
    ctx.arc(x, y, stats.range * cell, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f0f7f4';
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
    const baseSize = cell * 0.31;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(1, 8, 8, 0.54)';
    ctx.beginPath();
    ctx.ellipse(cell * 0.04, cell * 0.1, baseSize * 1.06, baseSize * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(12, 21, 22, 0.9)';
    ctx.strokeStyle = selected ? '#effff9' : 'rgba(180, 202, 197, 0.78)';
    ctx.lineWidth = selected ? Math.max(2, cell * 0.045) : Math.max(1.2, cell * 0.026);
    ctx.beginPath();
    ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const ambientPulse = this.lowEffects ? 1 : 1 + Math.sin(time * 0.003 + tower.id) * 0.016;
    ctx.scale(ambientPulse, ambientPulse);
    const spriteAsset = getTowerAssetId(this.game.level.worldId, tower.definitionId);
    const sprite = spriteAsset ? this.assets.get(spriteAsset) : null;
    if (sprite) {
      const size = cell * 1.08;
      const recoil = (tower.firePulse ?? 0) * cell * 0.07;
      ctx.save();
      ctx.translate(0, recoil * 0.4);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      this.drawTowerGlyph(tower.definitionId, baseSize);
    }

    if ((tower.firePulse ?? 0) > 0.05 && !this.lowEffects) {
      const pulse = tower.firePulse ?? 0;
      ctx.globalAlpha = pulse * 0.65;
      ctx.strokeStyle = this.effectColor(tower.definitionId);
      ctx.lineWidth = Math.max(1, cell * 0.025);
      ctx.beginPath();
      ctx.arc(0, 0, baseSize + (1 - pulse) * cell * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#f1f6f3';
    for (let tier = 0; tier < tower.level; tier += 1) {
      ctx.fillRect((tier - (tower.level - 1) / 2) * cell * 0.11 - cell * 0.022, baseSize + cell * 0.09, cell * 0.045, cell * 0.045);
    }
    ctx.restore();
  }

  private drawTowerGlyph(id: TowerId, size: number): void {
    const ctx = this.context;
    ctx.strokeStyle = '#f0f7f4';
    ctx.fillStyle = '#f0f7f4';
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
        ctx.strokeStyle = '#75e6a8';
        ctx.lineWidth = Math.max(1, cell * 0.025);
        ctx.setLineDash([cell * 0.055, cell * 0.055]);
        ctx.beginPath();
        const oscillation = this.lowEffects ? 0 : Math.sin(time * 0.007) * cell * 0.015;
        ctx.arc(0, 0, radius + cell * 0.09 + oscillation, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (enemy.slow) {
        ctx.strokeStyle = '#83d8ed';
        ctx.beginPath();
        ctx.arc(0, 0, radius + cell * 0.05, Math.PI * 0.1, Math.PI * 0.8);
        ctx.arc(0, 0, radius + cell * 0.05, Math.PI * 1.1, Math.PI * 1.8);
        ctx.stroke();
      }

      ctx.fillStyle = '#dde5e2';
      ctx.strokeStyle = '#08100f';
      ctx.lineWidth = Math.max(2, cell * 0.045);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawArmorMark(enemy.armorType, radius);

      const barWidth = cell * 0.56 * enemy.scale;
      const barY = -radius - cell * 0.16;
      ctx.fillStyle = '#07100e';
      ctx.fillRect(-barWidth / 2, barY, barWidth, cell * 0.07);
      ctx.fillStyle = '#edf5f1';
      ctx.fillRect(-barWidth / 2, barY, barWidth * Math.max(0, enemy.hp / enemy.maxHp), cell * 0.07);
      ctx.strokeStyle = '#07100e';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barWidth / 2, barY, barWidth, cell * 0.07);

      ctx.restore();
    }
  }

  private drawArmorMark(type: ArmorType, radius: number): void {
    const ctx = this.context;
    ctx.strokeStyle = '#17211e';
    ctx.fillStyle = '#17211e';
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
      if (projectile.visual === 'sentry') this.drawReliableProjectile(projectile, x, y, cell);
      else if (projectile.visual === 'needle') this.drawBrushProjectile(projectile, x, y, cell);
      else if (projectile.visual === 'mortar') this.drawSplashProjectile(projectile, x, y, cell);
      else if (projectile.visual === 'toxin') this.drawSprayProjectile(projectile, x, y, cell);
      else this.drawEnergyProjectile(projectile, x, y, cell);
    }
    ctx.globalAlpha = 1;
  }

  private projectileAngle(projectile: Projectile): number {
    const target = this.game.enemies.find((enemy) => enemy.id === projectile.targetId && enemy.alive);
    if (target) return Math.atan2(target.y - projectile.y, target.x - projectile.x);
    return Math.atan2(projectile.y - (projectile.originY ?? projectile.y), projectile.x - (projectile.originX ?? projectile.x));
  }

  private drawReliableProjectile(projectile: Projectile, x: number, y: number, cell: number): void {
    const ctx = this.context;
    const originX = (projectile.originX ?? projectile.x) * cell;
    const originY = (projectile.originY ?? projectile.y) * cell;
    ctx.save();
    const beam = ctx.createLinearGradient(originX, originY, x, y);
    beam.addColorStop(0, 'rgba(100, 219, 231, 0.08)');
    beam.addColorStop(1, 'rgba(215, 252, 250, 0.88)');
    ctx.strokeStyle = beam;
    ctx.lineWidth = Math.max(1.5, cell * 0.045);
    ctx.setLineDash([cell * 0.05, cell * 0.08]);
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(x, y);
    ctx.rotate(this.projectileAngle(projectile));
    ctx.strokeStyle = '#b7f6f2';
    ctx.lineWidth = Math.max(1, cell * 0.02);
    const rings = this.lowEffects ? 1 : 3;
    for (let index = 0; index < rings; index += 1) {
      ctx.globalAlpha = 0.86 - index * 0.22;
      ctx.beginPath();
      ctx.ellipse(-index * cell * 0.1, 0, cell * (0.07 + index * 0.018), cell * (0.12 + index * 0.025), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBrushProjectile(projectile: Projectile, x: number, y: number, cell: number): void {
    const ctx = this.context;
    const angle = this.projectileAngle(projectile);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(155, 144, 255, 0.34)';
    ctx.lineWidth = Math.max(2, cell * 0.075);
    ctx.beginPath();
    ctx.moveTo(-cell * 0.34, 0);
    ctx.lineTo(cell * 0.05, 0);
    ctx.stroke();
    ctx.strokeStyle = '#f4f6ff';
    ctx.lineWidth = Math.max(1, cell * 0.026);
    ctx.beginPath();
    ctx.moveTo(-cell * 0.15, 0);
    ctx.lineTo(cell * 0.2, 0);
    ctx.stroke();
    ctx.fillStyle = '#9287f4';
    ctx.beginPath();
    ctx.moveTo(cell * 0.25, 0);
    ctx.lineTo(cell * 0.1, -cell * 0.045);
    ctx.lineTo(cell * 0.1, cell * 0.045);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawSplashProjectile(projectile: Projectile, x: number, y: number, cell: number): void {
    const ctx = this.context;
    const originX = projectile.originX ?? projectile.x;
    const originY = projectile.originY ?? projectile.y;
    const travelled = Math.hypot(projectile.x - originX, projectile.y - originY);
    const progress = Math.min(1, travelled / Math.max(0.001, projectile.initialDistance ?? 1));
    const lift = this.lowEffects ? 0 : Math.sin(progress * Math.PI) * cell * 0.5;
    ctx.save();
    ctx.translate(x, y - lift);
    ctx.rotate(this.lowEffects ? 0 : (projectile.age ?? 0) * 4.2);
    const width = cell * 0.2;
    const height = cell * 0.17;
    ctx.fillStyle = '#d7e0df';
    ctx.strokeStyle = '#172122';
    ctx.lineWidth = Math.max(1, cell * 0.022);
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, cell * 0.045);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(72, 88, 89, 0.7)';
    ctx.strokeRect(-width * 0.28, -height * 0.22, width * 0.56, height * 0.44);
    ctx.restore();
  }

  private drawSprayProjectile(projectile: Projectile, x: number, y: number, cell: number): void {
    const ctx = this.context;
    const angle = this.projectileAngle(projectile);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const dots = this.lowEffects ? 2 : 6;
    for (let index = 0; index < dots; index += 1) {
      const seed = this.hash(projectile.id + index * 13, index + 31);
      const back = index * cell * 0.055;
      const spread = (seed - 0.5) * cell * (0.12 + index * 0.012);
      ctx.globalAlpha = 0.92 - index * 0.11;
      ctx.fillStyle = index % 2 ? '#a7f5cc' : '#57d9ad';
      ctx.beginPath();
      ctx.arc(-back, spread, Math.max(1.4, cell * (0.025 + seed * 0.018)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawEnergyProjectile(projectile: Projectile, x: number, y: number, cell: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = projectile.visual === 'arcanum' ? '#d7b7ff' : '#f2f8f5';
    ctx.strokeStyle = projectile.visual === 'null' ? '#8fe7ef' : '#11191a';
    ctx.shadowColor = this.effectColor(projectile.visual);
    ctx.shadowBlur = this.lowEffects ? 0 : cell * 0.16;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2.2, cell * 0.055), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawImpacts({ cell }: Metrics): void {
    for (const impact of this.game.impacts) {
      const progress = Math.min(1, impact.age / impact.duration);
      if (impact.visual === 'sentry') this.drawReliableImpact(impact, progress, cell);
      else if (impact.visual === 'needle') this.drawBrushImpact(impact, progress, cell);
      else if (impact.visual === 'mortar') this.drawSplashImpact(impact, progress, cell);
      else if (impact.visual === 'toxin') this.drawSprayImpact(impact, progress, cell);
      else this.drawGenericImpact(impact, progress, cell);
    }
  }

  private drawReliableImpact(impact: Impact, progress: number, cell: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(impact.x * cell, impact.y * cell);
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#b9f5f0';
    ctx.lineWidth = Math.max(1, cell * 0.024);
    const rings = this.lowEffects ? 1 : 3;
    for (let index = 0; index < rings; index += 1) {
      const radius = cell * (0.3 - progress * 0.18 + index * 0.07);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(cell * 0.04, radius), Math.max(cell * 0.025, radius * 0.48), index * 0.65, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBrushImpact(impact: Impact, progress: number, cell: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(impact.x * cell, impact.y * cell);
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#c7c0ff';
    ctx.lineWidth = Math.max(1, cell * 0.022);
    const rays = this.lowEffects ? 4 : 8;
    for (let index = 0; index < rays; index += 1) {
      const angle = (index / rays) * Math.PI * 2;
      const inner = cell * 0.05;
      const outer = cell * (0.15 + progress * 0.18);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSplashImpact(impact: Impact, progress: number, cell: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(impact.x * cell, impact.y * cell);
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#d9e2e0';
    ctx.lineWidth = Math.max(1, cell * 0.024);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(cell * 0.1, impact.radius * cell * progress), 0, Math.PI * 2);
    ctx.stroke();
    const crumbs = this.lowEffects ? 3 : 8;
    for (let index = 0; index < crumbs; index += 1) {
      const angle = (index / crumbs) * Math.PI * 2 + this.hash(impact.id, index) * 0.45;
      const distance = cell * (0.08 + progress * (0.18 + this.hash(index, impact.id) * 0.24));
      const size = Math.max(1.5, cell * 0.035 * (1 - progress * 0.45));
      ctx.save();
      ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance);
      ctx.rotate(angle + progress);
      ctx.fillStyle = index % 2 ? '#eff4f2' : '#667477';
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawSprayImpact(impact: Impact, progress: number, cell: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(impact.x * cell, impact.y * cell);
    ctx.globalAlpha = (1 - progress) * 0.88;
    const droplets = this.lowEffects ? 4 : 12;
    for (let index = 0; index < droplets; index += 1) {
      const angle = this.hash(impact.id + index, index + 4) * Math.PI * 2;
      const distance = cell * (0.05 + progress * (0.18 + this.hash(index + 8, impact.id) * 0.25));
      const size = cell * (0.025 + this.hash(index, impact.id + 15) * 0.035);
      ctx.fillStyle = index % 3 === 0 ? '#d6fae5' : '#58d5a4';
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, Math.max(1.2, size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGenericImpact(impact: Impact, progress: number, cell: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(impact.x * cell, impact.y * cell);
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = impact.kind === 'leak' ? '#ffffff' : this.effectColor(impact.visual);
    ctx.lineWidth = Math.max(1, cell * 0.025);
    ctx.setLineDash(impact.kind === 'sell' ? [3, 3] : []);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(cell * 0.08, impact.radius * cell * progress), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawPlacementGhost({ cell }: Metrics, time: number): void {
    const towerId = this.game.selectedBuild;
    const hover = this.game.hoverCell;
    if (!towerId || !hover) return;
    const definition = getTowerDefinition(towerId, this.game.level.worldId);
    const placement = this.game.getPlacement(hover, towerId);
    const x = (hover.x + 0.5) * cell;
    const y = (hover.y + 0.5) * cell;
    const ctx = this.context;

    ctx.save();
    ctx.fillStyle = placement.valid ? 'rgba(187,244,228,0.08)' : 'rgba(239,239,233,0.018)';
    ctx.strokeStyle = placement.valid ? '#dffbf2' : '#9baba6';
    ctx.lineWidth = Math.max(1.5, cell * 0.035);
    ctx.setLineDash(placement.valid ? [] : [cell * 0.08, cell * 0.06]);
    ctx.beginPath();
    ctx.arc(x, y, definition.range * cell, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = placement.valid ? 0.86 : 0.44;
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
      facing: -Math.PI / 2,
      firePulse: 0,
    };
    this.drawTower(ghost, x, y, cell, time, placement.valid);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = placement.valid ? '#f4fffb' : '#a8b5b1';
    ctx.strokeRect(hover.x * cell + 2, hover.y * cell + 2, cell - 4, cell - 4);
    if (!placement.valid) this.drawCross(hover.x * cell, hover.y * cell, cell, '#eff5f2');

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
    ctx.fillStyle = placement.valid ? '#f4fffb' : '#c3ceca';
    ctx.font = `700 ${Math.max(9, cell * 0.14)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, hover.y * cell - cell * 0.1);
    ctx.restore();
  }

  private drawBoardFrame({ originX, originY, boardWidth, boardHeight, cell }: Metrics): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = 'rgba(220, 240, 234, 0.34)';
    ctx.lineWidth = Math.max(1, cell * 0.022);
    ctx.strokeRect(originX + 0.5, originY + 0.5, boardWidth - 1, boardHeight - 1);
    ctx.restore();
  }

  private drawPaused({ width, height, originX, originY, boardWidth, boardHeight }: Metrics): void {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = 'rgba(3, 9, 9, 0.58)';
    ctx.fillRect(0, 0, width, height);
    const centerX = originX + boardWidth / 2;
    const centerY = originY + boardHeight / 2;
    ctx.fillStyle = '#eff7f3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 22px ui-monospace, monospace';
    ctx.fillText('SIMULATION PAUSED', centerX, centerY - 8);
    ctx.font = '500 11px ui-monospace, monospace';
    ctx.fillStyle = '#a8b7b2';
    ctx.fillText('PRESS SPACE TO RESUME', centerX, centerY + 18);
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

  private effectColor(id?: TowerId): string {
    if (id === 'sentry') return '#9deee9';
    if (id === 'needle') return '#bdb5ff';
    if (id === 'mortar') return '#d9e2e0';
    if (id === 'arcanum') return '#d4aaff';
    if (id === 'toxin') return '#71e4ad';
    if (id === 'null') return '#87dbe3';
    return '#d9e5e1';
  }

  private hash(x: number, y: number): number {
    const value = Math.sin(x * 12.9898 + y * 78.233 + this.game.level.difficulty * 4.71) * 43_758.5453;
    return value - Math.floor(value);
  }
}

type PlacementResultReason = ReturnType<Game['getPlacement']>['reason'];
