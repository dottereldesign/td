import type { Game } from '../game/Game';
import type { Renderer } from '../render/Renderer';
import type { PerformanceMonitor, PerformanceSnapshot } from './PerformanceMonitor';

export class PerformancePanel {
  private readonly root: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly copyButton: HTMLButtonElement;
  private lastUpdateAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly monitor: PerformanceMonitor,
    private readonly game: Game,
    private readonly renderer: Renderer,
  ) {
    const toggleButton = document.getElementById('performance-button');
    if (!(toggleButton instanceof HTMLButtonElement)) throw new Error('Missing performance monitor button.');
    this.toggleButton = toggleButton;

    this.root = document.createElement('aside');
    this.root.id = 'performance-panel';
    this.root.className = 'performance-panel';
    this.root.setAttribute('aria-label', 'Game performance monitor');
    this.root.innerHTML = `
      <div class="performance-panel__header">
        <div><span>DIAGNOSTICS</span><strong>Performance monitor</strong></div>
        <button type="button" data-perf-close aria-label="Close performance monitor">×</button>
      </div>
      <div class="performance-panel__hero">
        <strong id="perf-fps">-- FPS</strong>
        <span id="perf-frame">Collecting frame times…</span>
      </div>
      <div class="performance-panel__diagnosis" id="perf-diagnosis" data-severity="info">
        <strong id="perf-diagnosis-label">Collecting a baseline</strong>
        <span id="perf-diagnosis-detail">Keep this open during active play for a few seconds.</span>
      </div>
      <div class="performance-panel__section">
        <span class="performance-panel__eyebrow" id="perf-budget">MAIN THREAD / 16.7 MS BUDGET</span>
        <div class="performance-row"><span>Simulation</span><b id="perf-simulation">0.00 ms</b></div>
        <div class="performance-meter"><i id="perf-simulation-meter"></i></div>
        <div class="performance-row"><span>Canvas render</span><b id="perf-render">0.00 ms</b></div>
        <div class="performance-meter"><i id="perf-render-meter"></i></div>
        <div class="performance-row"><span>HUD / DOM</span><b id="perf-ui">0.00 ms</b></div>
        <div class="performance-meter"><i id="perf-ui-meter"></i></div>
        <div class="performance-row"><span>Long tasks</span><b id="perf-long-tasks">0 /s</b></div>
      </div>
      <div class="performance-panel__section performance-panel__section--grid">
        <div><span>CANVAS</span><b id="perf-canvas">--</b></div>
        <div><span>SCENE</span><b id="perf-scene">--</b></div>
        <div><span>ACTIVITY</span><b id="perf-activity">--</b></div>
        <div><span>JS HEAP</span><b id="perf-memory">--</b></div>
      </div>
      <div class="performance-panel__footer">
        <span>F3 toggle · Chrome task manager: Shift+Esc</span>
        <button type="button" data-perf-copy>Copy report</button>
      </div>
    `;
    document.getElementById('app')?.append(this.root);
    this.copyButton = this.root.querySelector<HTMLButtonElement>('[data-perf-copy]')!;

    this.toggleButton.addEventListener('click', () => this.toggle());
    this.root.querySelector<HTMLButtonElement>('[data-perf-close]')?.addEventListener('click', () => this.setOpen(false));
    this.copyButton.addEventListener('click', () => void this.copyReport());
    document.addEventListener('keydown', this.handleKeyDown);
    this.setOpen(this.monitor.open);
  }

  update(now: number): void {
    if (!this.monitor.open || now - this.lastUpdateAt < 500) return;
    this.lastUpdateAt = now;

    const poisons = this.game.enemies.reduce((total, enemy) => total + enemy.poisons.length, 0);
    this.monitor.sampleScene({
      towers: this.game.towers.length,
      enemies: this.game.enemies.length,
      projectiles: this.game.projectiles.length,
      impacts: this.game.impacts.length,
      poisons,
    });
    const canvas = this.renderer.getDiagnostics();
    this.monitor.sampleCanvas({
      cssWidth: canvas.cssWidth,
      cssHeight: canvas.cssHeight,
      backingWidth: canvas.backingWidth,
      backingHeight: canvas.backingHeight,
      dpr: canvas.effectiveDpr,
      liveBackdropBlur: false,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      quality: canvas.quality,
    });

    this.render(this.monitor.getSnapshot(now));
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.monitor.dispose();
    this.root.remove();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'F3') return;
    event.preventDefault();
    this.toggle();
  };

  private toggle(): void {
    this.setOpen(!this.monitor.open);
  }

  private setOpen(open: boolean): void {
    this.monitor.setOpen(open);
    this.root.hidden = !open;
    this.toggleButton.classList.toggle('is-active', open);
    this.toggleButton.setAttribute('aria-pressed', String(open));
    this.toggleButton.title = open ? 'Close performance monitor (F3)' : 'Open performance monitor (F3)';
    if (open) {
      this.lastUpdateAt = Number.NEGATIVE_INFINITY;
      this.update(performance.now());
    }
  }

  private render(snapshot: PerformanceSnapshot): void {
    this.text('perf-fps', `${snapshot.frame.fps || '--'} FPS`);
    this.text(
      'perf-frame',
      `${snapshot.frame.averageMs.toFixed(1)} ms avg · ${snapshot.frame.p95Ms.toFixed(1)} ms P95 · ${snapshot.frame.overBudgetPercent.toFixed(0)}% late`,
    );
    this.text('perf-diagnosis-label', snapshot.diagnosis.label);
    this.text('perf-diagnosis-detail', snapshot.diagnosis.detail);
    this.text('perf-budget', `MAIN THREAD / ${snapshot.frame.budgetMs.toFixed(1)} MS BUDGET`);
    const diagnosis = this.root.querySelector<HTMLElement>('#perf-diagnosis');
    if (diagnosis) diagnosis.dataset.severity = snapshot.diagnosis.severity;

    this.text('perf-simulation', `${snapshot.phases.simulation.averageMs.toFixed(2)} ms`);
    this.text('perf-render', `${snapshot.phases.render.averageMs.toFixed(2)} ms`);
    this.text(
      'perf-ui',
      `${snapshot.phases.ui.averageMs.toFixed(2)} ms · ${snapshot.counters.uiRenders.perSecond.toFixed(1)}/s`,
    );
    this.text(
      'perf-long-tasks',
      `${snapshot.longTasks.perSecond.toFixed(1)}/s · ${snapshot.longTasks.maximumMs.toFixed(0)} ms max`,
    );
    this.meter('perf-simulation-meter', snapshot.phases.simulation.averageMs);
    this.meter('perf-render-meter', snapshot.phases.render.averageMs);
    this.meter('perf-ui-meter', snapshot.phases.ui.averageMs);

    const canvas = snapshot.canvas;
    this.text(
      'perf-canvas',
      canvas ? `${canvas.megapixels.toFixed(2)} MP · ${canvas.effectiveDpr.toFixed(2)}× · ${canvas.quality}` : '--',
    );
    const scene = snapshot.scene.current;
    this.text('perf-scene', `${scene.towers}T ${scene.enemies}E ${scene.projectiles}P ${scene.impacts}FX`);
    this.text(
      'perf-activity',
      `${snapshot.counters.canvasFrames.perSecond.toFixed(0)} draws/s · ${snapshot.counters.events.perSecond.toFixed(0)} events/s`,
    );
    this.text(
      'perf-memory',
      snapshot.device.usedJsHeapBytes === null
        ? `${snapshot.device.hardwareConcurrency ?? '?'} logical cores`
        : `${(snapshot.device.usedJsHeapBytes / 1_048_576).toFixed(1)} MB`,
    );
  }

  private text(id: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element && element.textContent !== value) element.textContent = value;
  }

  private meter(id: string, durationMs: number): void {
    const meter = this.root.querySelector<HTMLElement>(`#${id}`);
    if (meter) meter.style.width = `${Math.min(100, (durationMs / (1_000 / 60)) * 100)}%`;
  }

  private async copyReport(): Promise<void> {
    const report = JSON.stringify(this.monitor.createReport(), null, 2);
    try {
      await navigator.clipboard.writeText(report);
      this.copyButton.textContent = 'Copied';
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      this.copyButton.textContent = 'Copied';
    }
    window.setTimeout(() => { this.copyButton.textContent = 'Copy report'; }, 1_500);
  }
}
