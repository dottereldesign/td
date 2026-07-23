import { expect, test } from '@playwright/test';

test('compact home defers menu media and idles the covered game loop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/?perf=1');
  await page.locator('#home-hero').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.fonts.status === 'loaded');

  const before = await page.evaluate(() => window.__WIZINO_TD__.profiler.createReport().snapshot.counters);
  await page.waitForTimeout(1_000);
  const after = await page.evaluate(() => window.__WIZINO_TD__.profiler.createReport().snapshot.counters);
  const idleDeltas = {
    canvasFrames: after.canvasFrames.total - before.canvasFrames.total,
    simulationTicks: after.simTicks.total - before.simTicks.total,
    uiRenders: after.uiRenders.total - before.uiRenders.total,
  };

  const resourcesBeforeMenu = await page.evaluate(() => (
    performance.getEntriesByType('resource').map((entry) => entry.name)
  ));
  const deferredBeforeMenu = resourcesBeforeMenu.filter((url) => (
    url.includes('/home/worlds/')
    || url.includes('/home/panels/')
    || url.includes('/store-badges/')
  ));
  const audioBeforeOptIn = resourcesBeforeMenu.filter((url) => (
    url.includes('/audio/') || /\.(?:ogg|mp3|wav)(?:$|\?)/i.test(url)
  ));

  await page.locator('#home-menu-button').click();
  await page.locator('#home-mobile-menu').waitFor({ state: 'visible' });
  await page.waitForFunction(() => (
    [...document.querySelectorAll<HTMLImageElement>('#home-mobile-menu img')]
      .some((image) => image.complete && image.naturalWidth > 0)
  ));
  const resourcesAfterMenu = await page.evaluate(() => (
    performance.getEntriesByType('resource').map((entry) => entry.name)
  ));
  const menuMediaLoaded = resourcesAfterMenu.filter((url) => (
    url.includes('/home/worlds/')
    || url.includes('/home/panels/')
    || url.includes('/store-badges/')
  ));
  const audioAfterMenu = resourcesAfterMenu.filter((url) => (
    url.includes('/audio/') || /\.(?:ogg|mp3|wav)(?:$|\?)/i.test(url)
  ));
  const backgroundMusicAfterMenu = audioAfterMenu.filter((url) => url.includes('wizino-magical-loop'));

  const report = {
    idleDeltas,
    initialResourceCount: resourcesBeforeMenu.length,
    deferredMenuMediaBeforeOpen: deferredBeforeMenu,
    menuMediaLoadedAfterOpen: menuMediaLoaded.length,
    audioRequestsBeforeOptIn: audioBeforeOptIn,
    audioRequestsAfterMenuOpen: audioAfterMenu,
    backgroundMusicRequestsAfterMenuOpen: backgroundMusicAfterMenu,
  };
  await testInfo.attach('compact-home-performance-report', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  console.info(`HOME_PERF_REPORT ${JSON.stringify(report)}`);

  expect(pageErrors).toEqual([]);
  expect(idleDeltas.canvasFrames).toBe(0);
  expect(idleDeltas.simulationTicks).toBe(0);
  expect(idleDeltas.uiRenders).toBe(0);
  expect(deferredBeforeMenu).toEqual([]);
  expect(menuMediaLoaded.length).toBeGreaterThan(0);
  expect(audioBeforeOptIn).toEqual([]);
  expect(audioAfterMenu.length).toBeLessThanOrEqual(7);
  expect(backgroundMusicAfterMenu).toEqual([]);
});
