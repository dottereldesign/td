export const PERFORMANCE_PHASES = [
  'simulation',
  'render',
  'ui',
  'backdrop',
  'terrain',
  'towers',
  'enemies',
  'projectiles',
  'effects',
  'overlay',
] as const;

export type PerformancePhase = (typeof PERFORMANCE_PHASES)[number];

export const PERFORMANCE_COUNTERS = [
  'events',
  'uiRenders',
  'simTicks',
  'canvasFrames',
  'staticRebuilds',
  'canvasOps',
  'targetChecks',
  'projectileLookups',
] as const;

export type PerformanceCounter = (typeof PERFORMANCE_COUNTERS)[number];

export interface SceneSample {
  towers: number;
  enemies: number;
  projectiles: number;
  impacts: number;
  poisons: number;
  effectPrimitives?: number;
}

export interface CanvasSample {
  cssWidth: number;
  cssHeight: number;
  backingWidth: number;
  backingHeight: number;
  dpr?: number;
  liveBackdropBlur?: boolean;
  reducedMotion?: boolean;
  quality?: string;
}

export interface DeviceSample {
  hardwareConcurrency: number | null;
  deviceMemoryGB: number | null;
  usedJsHeapBytes: number | null;
  jsHeapLimitBytes: number | null;
  userAgent: string | null;
  platform: string | null;
}

export interface PhaseSnapshot {
  latestMs: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
  samples: number;
}

export interface RateSnapshot {
  total: number;
  perSecond: number;
}

export interface FrameSnapshot {
  latestMs: number;
  averageMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  fps: number;
  overBudgetPercent: number;
  samples: number;
  targetFps: number;
  budgetMs: number;
}

export interface SceneSnapshot {
  current: Required<SceneSample>;
  maximum: Required<SceneSample>;
}

export interface CanvasSnapshot extends Required<Omit<CanvasSample, 'quality'>> {
  quality: string | null;
  effectiveDpr: number;
  megapixels: number;
}

export interface LongTaskSnapshot {
  total: number;
  perSecond: number;
  durationMs: number;
  maximumMs: number;
}

export type DiagnosisCode =
  | 'collecting'
  | 'healthy'
  | 'ui-event-storm'
  | 'long-task'
  | 'simulation-cpu'
  | 'canvas-main-thread'
  | 'gpu-compositor-likely'
  | 'frame-budget';

export type DiagnosisSeverity = 'good' | 'info' | 'warning' | 'critical';

export interface PerformanceDiagnosis {
  code: DiagnosisCode;
  severity: DiagnosisSeverity;
  label: string;
  detail: string;
}

export interface DiagnosisInput {
  frameSamples: number;
  frameP95Ms: number;
  frameBudgetMs: number;
  measuredMainMs: number;
  simulationAverageMs: number;
  renderAverageMs: number;
  uiAverageMs: number;
  uiRendersPerSecond: number;
  longTasksPerSecond: number;
  canvasMegapixels: number;
  liveBackdropBlur: boolean;
}

export interface PerformanceSnapshot {
  timestampMs: number;
  enabled: boolean;
  open: boolean;
  sessionDurationMs: number;
  frame: FrameSnapshot;
  phases: Record<PerformancePhase, PhaseSnapshot>;
  counters: Record<PerformanceCounter, RateSnapshot>;
  events: Record<string, RateSnapshot>;
  scene: SceneSnapshot;
  canvas: CanvasSnapshot | null;
  device: DeviceSample;
  longTasks: LongTaskSnapshot;
  diagnosis: PerformanceDiagnosis;
}

export interface PerformanceReport {
  schemaVersion: 1;
  generatedAt: string;
  sessionStartedAtMs: number;
  snapshot: PerformanceSnapshot;
  recentFrameTimesMs: number[];
}

export interface LongTaskObserverLike {
  observe(options: { type?: string; entryTypes?: string[]; buffered?: boolean }): void;
  disconnect(): void;
}

export type LongTaskObserverFactory = (
  onLongTask: (durationMs: number) => void,
) => LongTaskObserverLike | null;

export interface PerformanceMonitorOptions {
  enabled?: boolean;
  open?: boolean;
  ringSize?: number;
  snapshotIntervalMs?: number;
  targetFps?: number;
  maximumFrameGapMs?: number;
  warmupMs?: number;
  now?: () => number;
  dateNow?: () => number;
  longTaskObserverFactory?: LongTaskObserverFactory;
  autoSampleDevice?: boolean;
}

const EMPTY_SCENE: Required<SceneSample> = {
  towers: 0,
  enemies: 0,
  projectiles: 0,
  impacts: 0,
  poisons: 0,
  effectPrimitives: 0,
};

const DISABLED_MARK = Number.NaN;
const MINIMUM_SNAPSHOT_INTERVAL_MS = 500;

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : 0;
}

function rounded(value: number, precision = 2): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const clamped = Math.min(1, Math.max(0, fraction));
  const position = (sorted.length - 1) * clamped;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export class NumericRingBuffer {
  private readonly values: Float64Array;
  private cursor = 0;
  private length = 0;

  constructor(capacity = 240) {
    this.values = new Float64Array(Math.max(1, Math.floor(capacity)));
  }

  get size(): number {
    return this.length;
  }

  get capacity(): number {
    return this.values.length;
  }

  get latest(): number {
    if (this.length === 0) return 0;
    const index = (this.cursor - 1 + this.values.length) % this.values.length;
    return this.values[index];
  }

  push(value: number): void {
    if (!Number.isFinite(value)) return;
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.length = Math.min(this.length + 1, this.values.length);
  }

  clear(): void {
    this.cursor = 0;
    this.length = 0;
  }

  toArray(): number[] {
    const output = new Array<number>(this.length);
    const start = (this.cursor - this.length + this.values.length) % this.values.length;
    for (let index = 0; index < this.length; index += 1) {
      output[index] = this.values[(start + index) % this.values.length];
    }
    return output;
  }
}

function emptyPhaseSnapshot(): PhaseSnapshot {
  return { latestMs: 0, averageMs: 0, p95Ms: 0, maxMs: 0, samples: 0 };
}

function createCounterRecord<T>(initial: T): Record<PerformanceCounter, T> {
  return Object.fromEntries(PERFORMANCE_COUNTERS.map((counter) => [counter, initial])) as Record<PerformanceCounter, T>;
}

function copyScene(sample: Required<SceneSample>): Required<SceneSample> {
  return { ...sample };
}

function normalizeScene(sample: SceneSample): Required<SceneSample> {
  return {
    towers: finiteNonNegative(sample.towers),
    enemies: finiteNonNegative(sample.enemies),
    projectiles: finiteNonNegative(sample.projectiles),
    impacts: finiteNonNegative(sample.impacts),
    poisons: finiteNonNegative(sample.poisons),
    effectPrimitives: finiteNonNegative(sample.effectPrimitives),
  };
}

export function readDeviceSample(): DeviceSample {
  const browserNavigator = typeof navigator === 'undefined' ? null : navigator;
  const navigatorWithMemory = browserNavigator as (Navigator & { deviceMemory?: number }) | null;
  const performanceWithMemory = typeof performance === 'undefined'
    ? null
    : performance as Performance & {
      memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number };
    };

  return {
    hardwareConcurrency: browserNavigator?.hardwareConcurrency ?? null,
    deviceMemoryGB: navigatorWithMemory?.deviceMemory ?? null,
    usedJsHeapBytes: performanceWithMemory?.memory?.usedJSHeapSize ?? null,
    jsHeapLimitBytes: performanceWithMemory?.memory?.jsHeapSizeLimit ?? null,
    userAgent: browserNavigator?.userAgent ?? null,
    platform: browserNavigator?.platform ?? null,
  };
}

function defaultNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function createDefaultLongTaskObserver(onLongTask: (durationMs: number) => void): LongTaskObserverLike | null {
  if (typeof PerformanceObserver === 'undefined') return null;
  const supported = PerformanceObserver.supportedEntryTypes;
  if (supported.length > 0 && !supported.includes('longtask')) return null;
  return new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) onLongTask(entry.duration);
  });
}

export function classifyPerformance(input: DiagnosisInput): PerformanceDiagnosis {
  if (input.frameSamples < 20) {
    return {
      code: 'collecting',
      severity: 'info',
      label: 'Collecting a baseline',
      detail: 'Keep the panel open during active play for a few seconds.',
    };
  }

  if (input.uiRendersPerSecond > 20 || input.uiAverageMs > 4) {
    return {
      code: 'ui-event-storm',
      severity: input.uiRendersPerSecond > 60 ? 'critical' : 'warning',
      label: 'UI event storm',
      detail: `${rounded(input.uiRendersPerSecond, 1)} UI renders/s are competing with the game loop.`,
    };
  }

  if (input.longTasksPerSecond > 0.5) {
    return {
      code: 'long-task',
      severity: 'critical',
      label: 'Main-thread blocking',
      detail: `${rounded(input.longTasksPerSecond, 1)} tasks/s exceeded the browser's 50 ms long-task threshold.`,
    };
  }

  if (input.simulationAverageMs > 5) {
    return {
      code: 'simulation-cpu',
      severity: 'warning',
      label: 'Simulation CPU pressure',
      detail: `Simulation work averages ${rounded(input.simulationAverageMs)} ms per sample.`,
    };
  }

  if (input.renderAverageMs > 8) {
    return {
      code: 'canvas-main-thread',
      severity: 'warning',
      label: 'Canvas rendering pressure',
      detail: `Canvas command generation averages ${rounded(input.renderAverageMs)} ms.`,
    };
  }

  const missesFrameBudget = input.frameP95Ms > Math.max(20, input.frameBudgetMs * 1.25);
  const likelyGpuPressure = missesFrameBudget
    && input.measuredMainMs < 8
    && (input.canvasMegapixels > 1.8 || input.liveBackdropBlur);
  if (likelyGpuPressure) {
    const cause = input.liveBackdropBlur
      ? 'a live backdrop blur'
      : `${rounded(input.canvasMegapixels, 1)} backing megapixels`;
    return {
      code: 'gpu-compositor-likely',
      severity: 'warning',
      label: 'Likely GPU/compositor pressure',
      detail: `Frame time is high while measured JavaScript is low; ${cause} increases fill and compositing work.`,
    };
  }

  if (missesFrameBudget) {
    return {
      code: 'frame-budget',
      severity: 'warning',
      label: 'Frame budget misses',
      detail: `P95 frame time is ${rounded(input.frameP95Ms)} ms; inspect a browser Performance trace for the unmeasured work.`,
    };
  }

  return {
    code: 'healthy',
    severity: 'good',
    label: 'Frame budget healthy',
    detail: 'No sampled subsystem currently exceeds its warning threshold.',
  };
}

export class PerformanceMonitor {
  private readonly clock: () => number;
  private readonly wallClock: () => number;
  private readonly snapshotIntervalMs: number;
  private targetFps: number;
  private frameBudgetMs: number;
  private readonly maximumFrameGapMs: number;
  private readonly warmupMs: number;
  private readonly observerFactory: LongTaskObserverFactory;
  private readonly autoSampleDevice: boolean;
  private readonly frames: NumericRingBuffer;
  private readonly phaseBuffers = new Map<PerformancePhase, NumericRingBuffer>();
  private readonly counterTotals = createCounterRecord(0);
  private readonly counterBaselines = createCounterRecord(0);
  private readonly eventTotals: Record<string, number> = {};
  private readonly eventBaselines: Record<string, number> = {};

  private _enabled = false;
  private _open = false;
  private sessionStartedAtMs = 0;
  private warmupUntilMs = 0;
  private lastFrameTimestampMs: number | null = null;
  private lastSnapshotAtMs = Number.NEGATIVE_INFINITY;
  private cachedSnapshot: PerformanceSnapshot | null = null;
  private sceneCurrent = copyScene(EMPTY_SCENE);
  private sceneMaximum = copyScene(EMPTY_SCENE);
  private canvasSample: CanvasSample | null = null;
  private deviceSample: DeviceSample;
  private longTaskObserver: LongTaskObserverLike | null = null;
  private longTaskTotal = 0;
  private longTaskBaseline = 0;
  private longTaskDurationMs = 0;
  private longTaskMaximumMs = 0;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.clock = options.now ?? defaultNow;
    this.wallClock = options.dateNow ?? Date.now;
    this.snapshotIntervalMs = Math.max(
      MINIMUM_SNAPSHOT_INTERVAL_MS,
      finiteNonNegative(options.snapshotIntervalMs) || MINIMUM_SNAPSHOT_INTERVAL_MS,
    );
    this.targetFps = finiteNonNegative(options.targetFps) || 60;
    this.frameBudgetMs = 1_000 / this.targetFps;
    this.maximumFrameGapMs = finiteNonNegative(options.maximumFrameGapMs) || 1_000;
    this.warmupMs = finiteNonNegative(options.warmupMs);
    this.observerFactory = options.longTaskObserverFactory ?? createDefaultLongTaskObserver;
    this.autoSampleDevice = options.autoSampleDevice ?? true;
    this.frames = new NumericRingBuffer(options.ringSize ?? 240);
    this.deviceSample = readDeviceSample();
    for (const phase of PERFORMANCE_PHASES) {
      this.phaseBuffers.set(phase, new NumericRingBuffer(options.ringSize ?? 240));
    }

    this._open = options.open ?? false;
    if (options.enabled || this._open) this.setEnabled(true);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get open(): boolean {
    return this._open;
  }

  toggle(): boolean {
    this.setOpen(!this._open);
    return this._open;
  }

  setOpen(open: boolean): void {
    this._open = open;
    this.setEnabled(open);
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this._enabled) return;
    this._enabled = enabled;
    this.cachedSnapshot = null;
    this.lastSnapshotAtMs = Number.NEGATIVE_INFINITY;
    if (enabled) {
      this.reset();
      this.startLongTaskObserver();
    } else {
      this.stopLongTaskObserver();
      this.lastFrameTimestampMs = null;
    }
  }

  setTargetFps(targetFps: number): void {
    const nextTarget = finiteNonNegative(targetFps) || 60;
    if (nextTarget === this.targetFps) return;
    this.targetFps = nextTarget;
    this.frameBudgetMs = 1_000 / nextTarget;
    this.frames.clear();
    this.lastFrameTimestampMs = null;
    this.cachedSnapshot = null;
    this.lastSnapshotAtMs = Number.NEGATIVE_INFINITY;
  }

  reset(): void {
    this.frames.clear();
    for (const buffer of this.phaseBuffers.values()) buffer.clear();
    for (const counter of PERFORMANCE_COUNTERS) {
      this.counterTotals[counter] = 0;
      this.counterBaselines[counter] = 0;
    }
    for (const key of Object.keys(this.eventTotals)) delete this.eventTotals[key];
    for (const key of Object.keys(this.eventBaselines)) delete this.eventBaselines[key];
    this.sceneCurrent = copyScene(EMPTY_SCENE);
    this.sceneMaximum = copyScene(EMPTY_SCENE);
    this.longTaskTotal = 0;
    this.longTaskBaseline = 0;
    this.longTaskDurationMs = 0;
    this.longTaskMaximumMs = 0;
    this.lastFrameTimestampMs = null;
    this.cachedSnapshot = null;
    this.lastSnapshotAtMs = Number.NEGATIVE_INFINITY;
    this.sessionStartedAtMs = this.clock();
    this.warmupUntilMs = this.sessionStartedAtMs + this.warmupMs;
  }

  dispose(): void {
    this.stopLongTaskObserver();
    this._enabled = false;
    this._open = false;
  }

  beginFrame(timestampMs = this.clock()): void {
    if (!this._enabled) return;
    if (timestampMs < this.warmupUntilMs) {
      this.lastFrameTimestampMs = timestampMs;
      return;
    }
    if (this.lastFrameTimestampMs !== null) {
      const elapsed = timestampMs - this.lastFrameTimestampMs;
      if (elapsed > 0 && elapsed <= this.maximumFrameGapMs) this.frames.push(elapsed);
    }
    this.lastFrameTimestampMs = timestampMs;
  }

  beginPhase(_phase: PerformancePhase): number {
    if (!this._enabled) return DISABLED_MARK;
    const now = this.clock();
    return now < this.warmupUntilMs ? DISABLED_MARK : now;
  }

  endPhase(phase: PerformancePhase, startedAtMs: number, endedAtMs?: number): number {
    if (!this._enabled || !Number.isFinite(startedAtMs)) return 0;
    const duration = Math.max(0, (endedAtMs ?? this.clock()) - startedAtMs);
    this.recordPhase(phase, duration);
    return duration;
  }

  recordPhase(phase: PerformancePhase, durationMs: number): void {
    if (!this._enabled || !Number.isFinite(durationMs) || durationMs < 0) return;
    this.phaseBuffers.get(phase)?.push(durationMs);
  }

  increment(counter: PerformanceCounter, count = 1): void {
    if (!this._enabled || !Number.isFinite(count) || count <= 0) return;
    this.counterTotals[counter] += count;
  }

  incrementEvent(type: string, count = 1): void {
    if (!this._enabled || !type || !Number.isFinite(count) || count <= 0) return;
    this.counterTotals.events += count;
    this.eventTotals[type] = (this.eventTotals[type] ?? 0) + count;
  }

  sampleScene(sample: SceneSample): void {
    if (!this._enabled) return;
    this.sceneCurrent = normalizeScene(sample);
    for (const key of Object.keys(this.sceneCurrent) as (keyof Required<SceneSample>)[]) {
      this.sceneMaximum[key] = Math.max(this.sceneMaximum[key], this.sceneCurrent[key]);
    }
  }

  sampleCanvas(sample: CanvasSample): void {
    this.canvasSample = {
      cssWidth: finiteNonNegative(sample.cssWidth),
      cssHeight: finiteNonNegative(sample.cssHeight),
      backingWidth: finiteNonNegative(sample.backingWidth),
      backingHeight: finiteNonNegative(sample.backingHeight),
      dpr: finiteNonNegative(sample.dpr),
      liveBackdropBlur: sample.liveBackdropBlur ?? false,
      reducedMotion: sample.reducedMotion ?? false,
      quality: sample.quality,
    };
  }

  sampleDevice(sample: Partial<DeviceSample> = readDeviceSample()): void {
    this.deviceSample = { ...this.deviceSample, ...sample };
  }

  recordLongTask(durationMs: number): void {
    if (!this._enabled || !Number.isFinite(durationMs) || durationMs < 0) return;
    if (this.clock() < this.warmupUntilMs) return;
    this.longTaskTotal += 1;
    this.longTaskDurationMs += durationMs;
    this.longTaskMaximumMs = Math.max(this.longTaskMaximumMs, durationMs);
  }

  pollSnapshot(timestampMs = this.clock()): PerformanceSnapshot | null {
    if (
      this.cachedSnapshot
      && timestampMs - this.lastSnapshotAtMs < this.snapshotIntervalMs
    ) return null;
    return this.buildSnapshot(timestampMs);
  }

  getSnapshot(timestampMs = this.clock()): PerformanceSnapshot {
    return this.pollSnapshot(timestampMs) ?? this.cachedSnapshot ?? this.buildSnapshot(timestampMs);
  }

  createReport(timestampMs = this.clock()): PerformanceReport {
    const snapshot = this.getSnapshot(timestampMs);
    return {
      schemaVersion: 1,
      generatedAt: new Date(this.wallClock()).toISOString(),
      sessionStartedAtMs: this.sessionStartedAtMs,
      snapshot,
      recentFrameTimesMs: this.frames.toArray().map((value) => rounded(value)),
    };
  }

  private buildSnapshot(timestampMs: number): PerformanceSnapshot {
    if (this.autoSampleDevice) this.sampleDevice();
    const elapsedSinceSnapshotMs = Number.isFinite(this.lastSnapshotAtMs)
      ? Math.max(1, timestampMs - this.lastSnapshotAtMs)
      : Math.max(1, timestampMs - this.sessionStartedAtMs);
    const elapsedSeconds = elapsedSinceSnapshotMs / 1_000;
    const frameValues = this.frames.toArray();
    const frameAverage = average(frameValues);
    const phases = {} as Record<PerformancePhase, PhaseSnapshot>;

    for (const phase of PERFORMANCE_PHASES) {
      const values = this.phaseBuffers.get(phase)?.toArray() ?? [];
      phases[phase] = values.length === 0
        ? emptyPhaseSnapshot()
        : {
          latestMs: rounded(values[values.length - 1]),
          averageMs: rounded(average(values)),
          p95Ms: rounded(percentile(values, 0.95)),
          maxMs: rounded(Math.max(...values)),
          samples: values.length,
        };
    }

    const counters = {} as Record<PerformanceCounter, RateSnapshot>;
    for (const counter of PERFORMANCE_COUNTERS) {
      counters[counter] = {
        total: this.counterTotals[counter],
        perSecond: rounded((this.counterTotals[counter] - this.counterBaselines[counter]) / elapsedSeconds),
      };
      this.counterBaselines[counter] = this.counterTotals[counter];
    }

    const events: Record<string, RateSnapshot> = {};
    for (const type of Object.keys(this.eventTotals).sort()) {
      events[type] = {
        total: this.eventTotals[type],
        perSecond: rounded((this.eventTotals[type] - (this.eventBaselines[type] ?? 0)) / elapsedSeconds),
      };
      this.eventBaselines[type] = this.eventTotals[type];
    }

    const longTaskRate = (this.longTaskTotal - this.longTaskBaseline) / elapsedSeconds;
    this.longTaskBaseline = this.longTaskTotal;
    const canvas = this.canvasSnapshot();
    const measuredMainMs = phases.simulation.averageMs + phases.render.averageMs + phases.ui.averageMs;
    const diagnosis = classifyPerformance({
      frameSamples: frameValues.length,
      frameP95Ms: percentile(frameValues, 0.95),
      frameBudgetMs: this.frameBudgetMs,
      measuredMainMs,
      simulationAverageMs: phases.simulation.averageMs,
      renderAverageMs: phases.render.averageMs,
      uiAverageMs: phases.ui.averageMs,
      uiRendersPerSecond: counters.uiRenders.perSecond,
      longTasksPerSecond: longTaskRate,
      canvasMegapixels: canvas?.megapixels ?? 0,
      liveBackdropBlur: canvas?.liveBackdropBlur ?? false,
    });

    const overBudget = frameValues.filter((duration) => duration > this.frameBudgetMs * 1.2).length;
    const snapshot: PerformanceSnapshot = {
      timestampMs: rounded(timestampMs),
      enabled: this._enabled,
      open: this._open,
      sessionDurationMs: rounded(Math.max(0, timestampMs - this.sessionStartedAtMs)),
      frame: {
        latestMs: rounded(this.frames.latest),
        averageMs: rounded(frameAverage),
        p95Ms: rounded(percentile(frameValues, 0.95)),
        p99Ms: rounded(percentile(frameValues, 0.99)),
        maxMs: rounded(frameValues.length > 0 ? Math.max(...frameValues) : 0),
        fps: rounded(frameAverage > 0 ? 1_000 / frameAverage : 0, 1),
        overBudgetPercent: rounded(frameValues.length > 0 ? (overBudget / frameValues.length) * 100 : 0, 1),
        samples: frameValues.length,
        targetFps: this.targetFps,
        budgetMs: rounded(this.frameBudgetMs),
      },
      phases,
      counters,
      events,
      scene: {
        current: copyScene(this.sceneCurrent),
        maximum: copyScene(this.sceneMaximum),
      },
      canvas,
      device: { ...this.deviceSample },
      longTasks: {
        total: this.longTaskTotal,
        perSecond: rounded(longTaskRate),
        durationMs: rounded(this.longTaskDurationMs),
        maximumMs: rounded(this.longTaskMaximumMs),
      },
      diagnosis,
    };

    this.cachedSnapshot = snapshot;
    this.lastSnapshotAtMs = timestampMs;
    return snapshot;
  }

  private canvasSnapshot(): CanvasSnapshot | null {
    if (!this.canvasSample) return null;
    const sample = this.canvasSample;
    const ratioX = sample.cssWidth > 0 ? sample.backingWidth / sample.cssWidth : 0;
    const ratioY = sample.cssHeight > 0 ? sample.backingHeight / sample.cssHeight : 0;
    const effectiveDpr = sample.dpr || (ratioX > 0 && ratioY > 0 ? Math.sqrt(ratioX * ratioY) : ratioX || ratioY);
    return {
      cssWidth: sample.cssWidth,
      cssHeight: sample.cssHeight,
      backingWidth: sample.backingWidth,
      backingHeight: sample.backingHeight,
      dpr: sample.dpr ?? 0,
      liveBackdropBlur: sample.liveBackdropBlur ?? false,
      reducedMotion: sample.reducedMotion ?? false,
      quality: sample.quality ?? null,
      effectiveDpr: rounded(effectiveDpr),
      megapixels: rounded((sample.backingWidth * sample.backingHeight) / 1_000_000),
    };
  }

  private startLongTaskObserver(): void {
    if (this.longTaskObserver) return;
    try {
      const observer = this.observerFactory((durationMs) => this.recordLongTask(durationMs));
      if (!observer) return;
      observer.observe({ type: 'longtask', buffered: false });
      this.longTaskObserver = observer;
    } catch {
      this.longTaskObserver = null;
    }
  }

  private stopLongTaskObserver(): void {
    this.longTaskObserver?.disconnect();
    this.longTaskObserver = null;
  }
}
