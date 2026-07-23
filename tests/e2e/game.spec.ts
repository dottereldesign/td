import { expect, test, type Page } from '@playwright/test';

async function enterForest(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Start adventure/i }).click();
  await page.getByRole('button', { name: /Forest World/i }).click();
  await page.getByRole('button', { name: /Play Mossy Crossing/i }).click();
}

test('navigates six worlds and loads a world-specific roster', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start adventure/i }).click();
  await expect(page.locator('[data-world]')).toHaveCount(6);
  await page.getByRole('button', { name: /Workshop World/i }).click();
  await expect(page.locator('[data-level]')).toHaveCount(3);
  await page.getByRole('button', { name: /Play Cogworks Entry/i }).click();
  await expect(page.getByRole('button', { name: /Gearbox Turret/i })).toBeVisible();
});

test('deploys a tower and starts a wave', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Wizino TD/i })).toBeVisible();
  await page.getByRole('button', { name: 'Enable music' }).click();
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().loadedEffects)).toBe(7);
  if (process.env.CAPTURE_VISUAL) {
    await page.screenshot({ path: 'test-results/wizino-td-home.png', fullPage: true });
  }
  await enterForest(page);

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: /Mycelium Network/i }).click();
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().lastEffect)).toBe('tower');

  const bounds = await canvas.boundingBox();
  const fitBounds = await page.locator('#playfield-fit').boundingBox();
  expect(bounds).not.toBeNull();
  expect(fitBounds).not.toBeNull();
  const cell = Math.min(fitBounds!.width / 18, fitBounds!.height / 11);
  const boardWidth = cell * 18;
  const boardHeight = cell * 11;
  const originX = fitBounds!.x - bounds!.x + (fitBounds!.width - boardWidth) / 2;
  const originY = fitBounds!.y - bounds!.y + (fitBounds!.height - boardHeight) / 2;
  await canvas.click({
    position: {
      x: originX + cell * 3.5,
      y: originY + cell * 4.5,
    },
  });

  await expect(page.locator('#cash-value')).toHaveText('$330');
  await page.getByRole('button', { name: /Send wave 01/i }).click();
  await expect(page.locator('#phase-label')).toContainText('WAVE 01 ACTIVE');
  await expect(page.getByRole('button', { name: /Pause/i })).toBeEnabled();
  if (process.env.CAPTURE_VISUAL) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/wizino-td-desktop.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Open field manual' }).click();
  await expect(page.getByRole('heading', { name: 'Win through composition.' })).toBeVisible();
  await page.getByRole('button', { name: 'Close field manual' }).click();
  await expect(page.getByRole('button', { name: /Resume/i })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('keeps core controls usable on a phone viewport', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await enterForest(page);
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Pollinator Post/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send wave 01/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect.poll(async () => page.locator('#terrain-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context || canvas.width === 0 || canvas.height === 0) return 0;
    const sample = context.getImageData(
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2),
      1,
      1,
    ).data;
    return sample[0] + sample[1] + sample[2];
  })).toBeGreaterThan(30);

  const terrainFallback = await page.locator('#terrain-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const style = getComputedStyle(canvas);
    return {
      alpha: canvas.getContext('2d')?.getContextAttributes()?.alpha,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    };
  });
  expect(terrainFallback.alpha).toBe(true);
  expect(terrainFallback.backgroundColor).not.toBe('rgb(0, 0, 0)');
  expect(terrainFallback.backgroundImage).toContain('grass.webp');

  const rasterRequests = await page.evaluate(() => performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((url) => /\/src\/assets\/.*\.(?:png|jpe?g|webp)(?:\?|$)/i.test(url)));
  expect(rasterRequests.length).toBeGreaterThan(0);
  expect(rasterRequests.every((url) => /\.webp(?:\?|$)/i.test(url))).toBe(true);
  if (process.env.CAPTURE_VISUAL) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/wizino-td-mobile.png', fullPage: true });
  }
  expect(pageErrors).toEqual([]);
});

test('exposes a low-overhead performance monitor and F3 toggle', async ({ page }) => {
  await page.goto('/?perf=1');
  await enterForest(page);

  const panel = page.getByRole('complementary', { name: 'Game performance monitor' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Performance monitor')).toBeVisible();
  await page.waitForTimeout(2_000);

  const snapshot = await page.evaluate(() => window.__WIZINO_TD__.profiler.createReport().snapshot);
  expect(snapshot.enabled).toBe(true);
  expect(snapshot.frame.samples).toBeGreaterThan(10);
  expect(snapshot.canvas?.megapixels).toBeLessThanOrEqual(2.21);
  expect(Number.isFinite(snapshot.phases.render.averageMs)).toBe(true);
  if (process.env.CAPTURE_VISUAL) {
    await page.screenshot({ path: 'test-results/wizino-td-performance.png', fullPage: true });
  }

  await page.keyboard.press('F3');
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => window.__WIZINO_TD__.profiler.enabled)).toBe(false);
  await page.keyboard.press('F3');
  await expect(panel).toBeVisible();
});

test('caps the canvas backing store on a 4K viewport', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto('/');
  await enterForest(page);
  await page.waitForTimeout(300);

  const diagnostics = await page.evaluate(() => window.__WIZINO_TD__.renderer.getDiagnostics());
  expect(diagnostics.megapixels).toBeLessThanOrEqual(2.21);
  expect(diagnostics.effectiveDpr).toBeLessThan(0.55);
});
