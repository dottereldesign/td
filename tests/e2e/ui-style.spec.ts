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
  await expect(portraits).toHaveCount(6);
  await expect(shop.locator('.tower-icon:not(.tower-icon--art)')).toHaveCount(0);

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
      portraitBottomInsets: imageElements.map((image) => {
        const icon = image.closest<HTMLElement>('.tower-icon');
        if (!icon) return 0;
        const iconRect = icon.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        return iconRect.bottom - imageRect.bottom;
      }),
      sidePanelFitsViewport: document.querySelector<HTMLElement>('.side-panel')!.getBoundingClientRect().right <= window.innerWidth,
      usesLiveBackdropBlur: getComputedStyle(topbar).backdropFilter !== 'none',
    };
  });

  expect(layout.columns).toBe(2);
  expect(layout.rows).toBe(3);
  expect(layout.minCardWidth).toBeGreaterThan(180);
  expect(layout.minCardHeight).toBeGreaterThanOrEqual(140);
  expect(layout.allPortraitsLoaded).toBe(true);
  expect(Math.min(...layout.portraitBottomInsets)).toBeGreaterThanOrEqual(8);
  expect(layout.sidePanelFitsViewport).toBe(true);
  expect(layout.usesLiveBackdropBlur).toBe(false);
});

test('keeps the textured modal close control clear of the ornate frame', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Missions/i }).click();

  const panel = page.locator('#home-panel-modal .modal');
  const close = panel.getByRole('button', { name: 'Close' });
  await expect(panel).toBeVisible();

  const geometry = await panel.evaluate((modal) => {
    const button = modal.querySelector<HTMLElement>('.modal-close')!;
    const modalRect = modal.getBoundingClientRect();
    const closeRect = button.getBoundingClientRect();
    const modalStyle = getComputedStyle(modal);
    const closeStyle = getComputedStyle(button);
    return {
      topInset: closeRect.top - modalRect.top,
      rightInset: modalRect.right - closeRect.right,
      texture: modalStyle.backgroundImage,
      closeArtwork: closeStyle.backgroundImage,
      closeWidth: closeRect.width,
    };
  });

  expect(geometry.topInset).toBeGreaterThan(60);
  expect(geometry.rightInset).toBeGreaterThan(60);
  expect(geometry.texture).toContain('enchanted-vellum');
  expect(geometry.closeArtwork).toContain('modal-close');
  expect(geometry.closeWidth).toBeGreaterThanOrEqual(40);
});
