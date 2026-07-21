import { expect, test } from '@playwright/test';

interface CdpMetric {
  name: string;
  value: number;
}

interface FrameSample {
  averageFps: number;
  averageFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  droppedFrameRatio: number;
  longTaskCount: number;
  longTaskTime: number;
  canvasMegapixels: number;
  entities: {
    towers: number;
    enemies: number;
    projectiles: number;
    impacts: number;
  };
}

function metricMap(metrics: CdpMetric[]): Record<string, number> {
  return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

test('busy combat remains inside the interactive frame budget', async ({ page, context }, testInfo) => {
  const stress = process.env.PERF_STRESS === '1';
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  await session.send('Emulation.setCPUThrottlingRate', {
    rate: Number(process.env.PERF_CPU_THROTTLE ?? (stress ? 2 : 1)),
  });

  await page.goto('/?perf=1');
  await page.getByRole('button', { name: /Deploy to sector/i }).click();
  await page.waitForFunction(() => document.fonts.status === 'loaded');

  const scene = stress
    ? { towers: 40, enemies: 80, poisonEvery: 4 }
    : { towers: 28, enemies: 48, poisonEvery: 8 };
  await page.evaluate(({ towers, enemies, poisonEvery }) => {
    const game = window.__MONO_WARD__.game;
    const productionEventHandler = game.onEvent;
    game.onEvent = () => undefined;
    game.cash = 100_000;
    const towerIds = ['sentry', 'needle', 'mortar', 'arcanum', 'toxin', 'null'] as const;
    let placed = 0;
    for (let y = 0; y < game.level.rows && placed < towers; y += 1) {
      for (let x = 0; x < game.level.cols && placed < towers; x += 1) {
        const towerId = towerIds[placed % towerIds.length];
        if (!game.getPlacement({ x, y }, towerId).valid) continue;
        if (game.selectedBuild !== towerId) game.selectBuild(towerId);
        if (game.placeTower({ x, y }, true)) placed += 1;
      }
    }
    game.deselect();

    const path = game.level.path;
    game.enemies = Array.from({ length: enemies }, (_, index) => {
      const segment = 1 + (index % (path.length - 3));
      const point = path[segment];
      return {
        id: 10_000 + index,
        armorType: index % 2 === 0 ? 'heavy' : 'fortified',
        armor: 4,
        hp: 1_000_000,
        maxHp: 1_000_000,
        baseSpeed: 0.02,
        bounty: 0,
        scale: 1,
        x: point.x + 0.5,
        y: point.y + 0.5,
        segment,
        segmentProgress: 0,
        distanceTravelled: segment,
        alive: true,
        poisons: index % poisonEvery === 0
          ? [{ sourceTowerId: game.towers[0].id, dps: 0.01, remaining: 60 }]
          : [],
      } as const;
    });
    game.currentWave = 6;
    game.phase = 'wave';
    game.paused = false;
    game.speed = 3;
    game.onEvent = productionEventHandler;
  }, scene);

  await page.waitForTimeout(1_200);
  const before = metricMap((await session.send('Performance.getMetrics')).metrics as CdpMetric[]);

  const sample = await page.evaluate(async ({ sampleDuration }): Promise<FrameSample> => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    const observer = typeof PerformanceObserver !== 'undefined'
      ? new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(entry.duration);
        })
      : null;
    try {
      observer?.observe({ entryTypes: ['longtask'] });
    } catch {
      // Long Task timing is not exposed by every browser build.
    }

    await new Promise<void>((resolve) => {
      let started = 0;
      let previous = 0;
      const tick = (now: number) => {
        if (started === 0) {
          started = now;
          previous = now;
        } else {
          intervals.push(now - previous);
          previous = now;
        }
        if (now - started >= sampleDuration) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    observer?.disconnect();

    const ordered = [...intervals].sort((a, b) => a - b);
    const averageFrameMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const p95FrameMs = ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))];
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const game = window.__MONO_WARD__.game;
    return {
      averageFps: 1_000 / averageFrameMs,
      averageFrameMs,
      p95FrameMs,
      worstFrameMs: ordered.at(-1) ?? 0,
      droppedFrameRatio: intervals.filter((value) => value > 25).length / intervals.length,
      longTaskCount: longTasks.length,
      longTaskTime: longTasks.reduce((sum, value) => sum + value, 0),
      canvasMegapixels: (canvas.width * canvas.height) / 1_000_000,
      entities: {
        towers: game.towers.length,
        enemies: game.enemies.length,
        projectiles: game.projectiles.length,
        impacts: game.impacts.length,
      },
    };
  }, { sampleDuration: stress ? 3_000 : 4_000 });

  const after = metricMap((await session.send('Performance.getMetrics')).metrics as CdpMetric[]);
  const appReport = await page.evaluate(() => window.__MONO_WARD__.profiler.createReport());
  const report = {
    ...sample,
    app: appReport.snapshot,
    mainThreadTaskMs: ((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1_000,
    scriptMs: ((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1_000,
    layoutCount: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0),
    styleRecalcCount: (after.RecalcStyleCount ?? 0) - (before.RecalcStyleCount ?? 0),
    jsHeapMb: (after.JSHeapUsedSize ?? 0) / 1_048_576,
  };
  await testInfo.attach('performance-report', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  console.info(`PERF_REPORT ${JSON.stringify(report)}`);

  expect(pageErrors).toEqual([]);
  expect(sample.entities.towers).toBeGreaterThanOrEqual(scene.towers - 2);
  expect(sample.entities.enemies).toBeGreaterThanOrEqual(scene.enemies - 5);
  expect(appReport.snapshot.counters.uiRenders.perSecond).toBeLessThanOrEqual(8);
  expect(appReport.snapshot.counters.canvasFrames.perSecond).toBeLessThanOrEqual(62);
  expect(appReport.snapshot.counters.staticRebuilds.perSecond).toBeLessThanOrEqual(1);
  expect(sample.canvasMegapixels).toBeLessThanOrEqual(2.21);
  if (!stress) {
    expect(sample.averageFps).toBeGreaterThan(40);
    expect(sample.p95FrameMs).toBeLessThanOrEqual(50);
    expect(sample.droppedFrameRatio).toBeLessThan(0.45);
  }
});
