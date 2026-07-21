import { describe, expect, it } from 'vitest';
import {
  NumericRingBuffer,
  PerformanceMonitor,
  classifyPerformance,
  percentile,
  type DiagnosisInput,
  type LongTaskObserverLike,
} from '../src/performance/PerformanceMonitor';

function diagnosisInput(overrides: Partial<DiagnosisInput> = {}): DiagnosisInput {
  return {
    frameSamples: 120,
    frameP95Ms: 16.7,
    frameBudgetMs: 16.67,
    measuredMainMs: 4,
    simulationAverageMs: 1,
    renderAverageMs: 2,
    uiAverageMs: 1,
    uiRendersPerSecond: 10,
    longTasksPerSecond: 0,
    canvasMegapixels: 2,
    liveBackdropBlur: false,
    ...overrides,
  };
}

describe('performance monitor calculations', () => {
  it('keeps the newest values in chronological order after wrapping', () => {
    const ring = new NumericRingBuffer(3);
    ring.push(1);
    ring.push(2);
    ring.push(3);
    ring.push(4);

    expect(ring.size).toBe(3);
    expect(ring.latest).toBe(4);
    expect(ring.toArray()).toEqual([2, 3, 4]);
    expect(percentile(ring.toArray(), 0.5)).toBe(3);
    expect(percentile([10, 20, 30, 40], 0.95)).toBeCloseTo(38.5);
  });

  it('does not sample the clock or mutate counters while disabled', () => {
    let clockReads = 0;
    const monitor = new PerformanceMonitor({
      now: () => {
        clockReads += 1;
        return 10;
      },
      autoSampleDevice: false,
    });

    const mark = monitor.beginPhase('render');
    monitor.endPhase('render', mark);
    monitor.increment('canvasFrames');
    monitor.incrementEvent('enemy-hit');
    monitor.beginFrame(16);

    expect(clockReads).toBe(0);
    expect(Number.isNaN(mark)).toBe(true);
  });

  it('records frames, phases, event rates, scene maxima, and canvas output', () => {
    let now = 0;
    const monitor = new PerformanceMonitor({
      now: () => now,
      dateNow: () => 1_700_000_000_000,
      autoSampleDevice: false,
      ringSize: 8,
    });
    monitor.setEnabled(true);
    const initial = monitor.getSnapshot();

    for (const timestamp of [0, 16, 33, 50]) monitor.beginFrame(timestamp);
    monitor.recordPhase('simulation', 2);
    monitor.recordPhase('simulation', 4);
    monitor.recordPhase('render', 7);
    monitor.increment('uiRenders', 6);
    monitor.increment('simTicks', 30);
    monitor.increment('canvasFrames', 30);
    monitor.incrementEvent('enemy-hit', 40);
    monitor.sampleScene({ towers: 5, enemies: 12, projectiles: 8, impacts: 3, poisons: 4 });
    monitor.sampleScene({ towers: 4, enemies: 7, projectiles: 2, impacts: 1, poisons: 1 });
    monitor.sampleCanvas({
      cssWidth: 960,
      cssHeight: 540,
      backingWidth: 1_920,
      backingHeight: 1_080,
      liveBackdropBlur: true,
      quality: 'high',
    });

    now = 250;
    expect(monitor.getSnapshot()).toBe(initial);
    now = 500;
    const snapshot = monitor.getSnapshot();

    expect(snapshot).not.toBe(initial);
    expect(snapshot.frame.samples).toBe(3);
    expect(snapshot.frame.averageMs).toBeCloseTo(16.67, 2);
    expect(snapshot.phases.simulation.averageMs).toBe(3);
    expect(snapshot.counters.uiRenders).toEqual({ total: 6, perSecond: 12 });
    expect(snapshot.events['enemy-hit']).toEqual({ total: 40, perSecond: 80 });
    expect(snapshot.scene.current.enemies).toBe(7);
    expect(snapshot.scene.maximum.enemies).toBe(12);
    expect(snapshot.canvas?.effectiveDpr).toBe(2);
    expect(snapshot.canvas?.megapixels).toBe(2.07);
  });

  it('starts and disconnects the long-task observer with profiling', () => {
    let now = 0;
    let observed = false;
    let disconnected = false;
    let notify: ((durationMs: number) => void) | null = null;
    const observer: LongTaskObserverLike = {
      observe: () => { observed = true; },
      disconnect: () => { disconnected = true; },
    };
    const monitor = new PerformanceMonitor({
      now: () => now,
      autoSampleDevice: false,
      longTaskObserverFactory: (callback) => {
        notify = callback;
        return observer;
      },
    });

    monitor.setEnabled(true);
    expect(observed).toBe(true);
    monitor.getSnapshot();
    (notify as ((durationMs: number) => void) | null)?.(72);
    now = 500;
    const snapshot = monitor.getSnapshot();
    expect(snapshot.longTasks).toEqual({ total: 1, perSecond: 2, durationMs: 72, maximumMs: 72 });

    monitor.setEnabled(false);
    expect(disconnected).toBe(true);
  });

  it('creates a JSON-serializable report without forcing high-rate snapshots', () => {
    let now = 0;
    const monitor = new PerformanceMonitor({
      now: () => now,
      dateNow: () => Date.UTC(2025, 0, 2),
      autoSampleDevice: false,
    });
    monitor.setOpen(true);
    monitor.beginFrame(0);
    monitor.beginFrame(16);
    monitor.getSnapshot();
    now = 100;

    const report = monitor.createReport();
    expect(report.schemaVersion).toBe(1);
    expect(report.generatedAt).toBe('2025-01-02T00:00:00.000Z');
    expect(report.snapshot.open).toBe(true);
    expect(report.recentFrameTimesMs).toEqual([16]);
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it('tracks the active 30 or 60 FPS frame budget', () => {
    let now = 0;
    const monitor = new PerformanceMonitor({ now: () => now, autoSampleDevice: false });
    monitor.setEnabled(true);
    monitor.setTargetFps(30);
    monitor.beginFrame(0);
    monitor.beginFrame(33.3);
    now = 500;

    const snapshot = monitor.getSnapshot();
    expect(snapshot.frame.targetFps).toBe(30);
    expect(snapshot.frame.budgetMs).toBeCloseTo(33.33, 2);
  });
});

describe('performance diagnosis classifier', () => {
  it('prioritizes a UI event storm over secondary pressure', () => {
    expect(classifyPerformance(diagnosisInput({
      uiRendersPerSecond: 180,
      renderAverageMs: 12,
    })).code).toBe('ui-event-storm');
  });

  it('distinguishes simulation and canvas main-thread pressure', () => {
    expect(classifyPerformance(diagnosisInput({ simulationAverageMs: 6 })).code).toBe('simulation-cpu');
    expect(classifyPerformance(diagnosisInput({ renderAverageMs: 9 })).code).toBe('canvas-main-thread');
  });

  it('labels GPU/compositor pressure as an inference when JavaScript is light', () => {
    const diagnosis = classifyPerformance(diagnosisInput({
      frameP95Ms: 28,
      measuredMainMs: 5,
      canvasMegapixels: 8.3,
      liveBackdropBlur: true,
    }));
    expect(diagnosis.code).toBe('gpu-compositor-likely');
    expect(diagnosis.label).toContain('Likely');
  });

  it('reports healthy samples and waits for a meaningful baseline', () => {
    expect(classifyPerformance(diagnosisInput()).code).toBe('healthy');
    expect(classifyPerformance(diagnosisInput({ frameSamples: 8 })).code).toBe('collecting');
  });
});
