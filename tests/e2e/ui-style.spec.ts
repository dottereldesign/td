import { expect, test } from '@playwright/test';

test('renders the Forest tower shop without broken art or overlap', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start adventure/i }).click();
  await page.getByRole('button', { name: /Forest World/i }).click();
  await page.getByRole('button', { name: /Deploy to sector/i }).click();

  const shop = page.locator('#tower-shop');
  const cards = shop.locator('.tower-card');
  const portraits = shop.locator('.tower-art');

  await expect(cards).toHaveCount(6);
  await expect(portraits).toHaveCount(1);
  await expect(shop.locator('.tower-icon:not(.tower-icon--art)')).toHaveCount(5);

  const layout = await page.evaluate(() => {
    const shopElement = document.querySelector<HTMLElement>('#tower-shop')!;
    const cardElements = [...shopElement.querySelectorAll<HTMLElement>('.tower-card')];
    const imageElements = [...shopElement.querySelectorAll<HTMLImageElement>('.tower-art')];
    const cardRects = cardElements.map((card) => card.getBoundingClientRect());
    const topbar = document.querySelector<HTMLElement>('.topbar')!;

    return {
      columns: new Set(cardRects.map((rect) => Math.round(rect.x))).size,
      rows: new Set(cardRects.map((rect) => Math.round(rect.y))).size,
      minCardWidth: Math.min(...cardRects.map((rect) => rect.width)),
      minCardHeight: Math.min(...cardRects.map((rect) => rect.height)),
      allPortraitsLoaded: imageElements.every((image) => image.complete && image.naturalWidth >= 100),
      sidePanelFitsViewport: document.querySelector<HTMLElement>('.side-panel')!.getBoundingClientRect().right <= window.innerWidth,
      usesLiveBackdropBlur: getComputedStyle(topbar).backdropFilter !== 'none',
    };
  });

  expect(layout.columns).toBe(2);
  expect(layout.rows).toBe(3);
  expect(layout.minCardWidth).toBeGreaterThan(180);
  expect(layout.minCardHeight).toBeGreaterThanOrEqual(140);
  expect(layout.allPortraitsLoaded).toBe(true);
  expect(layout.sidePanelFitsViewport).toBe(true);
  expect(layout.usesLiveBackdropBlur).toBe(false);
});
