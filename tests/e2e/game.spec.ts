import { expect, test } from '@playwright/test';

test('deploys a tower and starts a wave', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose a sector to defend.' })).toBeVisible();
  await page.getByRole('button', { name: /Switchback/i }).click();
  await page.getByRole('button', { name: /Deploy to sector/i }).click();

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: /Vacuum Sentry/i }).click();

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
    await page.screenshot({ path: 'test-results/mono-ward-desktop.png', fullPage: true });
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
  await page.getByRole('button', { name: /Deploy to sector/i }).click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Brush Array/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send wave 01/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.CAPTURE_VISUAL) {
    await page.screenshot({ path: 'test-results/mono-ward-mobile.png', fullPage: true });
  }
  expect(pageErrors).toEqual([]);
});
