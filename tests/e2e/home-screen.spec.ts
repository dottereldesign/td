import { expect, test } from '@playwright/test';

test('renders the illustrated home dashboard and opens a world', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1008 });
  await page.goto('/');

  const home = page.locator('#home-screen');
  await expect(home).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Snack Squad' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start adventure' })).toBeVisible();
  await expect(home.locator('.home-quick-button')).toHaveCount(4);
  await expect(home.locator('[data-home-world]')).toHaveCount(6);

  const layout = await home.evaluate((element) => {
    const images = [...element.querySelectorAll<HTMLImageElement>('img')];
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
    const footer = element.querySelector<HTMLElement>('.home-footer')!;
    return {
      allImagesLoaded: images.every((image) => image.complete && image.naturalWidth >= 100),
      allButtonsUsePointerCursor: buttons.every((button) => getComputedStyle(button).cursor === 'pointer'),
      horizontalOverflow: element.scrollWidth - element.clientWidth,
      footerBottom: footer.getBoundingClientRect().bottom,
    };
  });

  expect(layout.allImagesLoaded).toBe(true);
  expect(layout.allButtonsUsePointerCursor).toBe(true);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(layout.footerBottom).toBeLessThanOrEqual(1008);

  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/home-screen-qa.png', fullPage: true });
  }

  await page.getByRole('button', { name: /Forest World/i }).click();
  await expect(page.getByRole('heading', { name: 'Forest World' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Deploy to sector/i })).toBeVisible();
});

test('keeps the home dashboard usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const home = page.locator('#home-screen');
  await expect(page.getByRole('button', { name: 'Start adventure' })).toBeVisible();
  await expect(home.locator('[data-home-world]')).toHaveCount(6);
  expect(await home.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/home-screen-mobile-qa.png', fullPage: true });
  }
});
