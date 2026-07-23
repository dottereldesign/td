import { expect, test } from '@playwright/test';

test('renders the illustrated home dashboard and opens a world', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1008 });
  await page.goto('/');

  const home = page.locator('#home-screen');
  await expect(page).toHaveTitle('Wizino TD');
  await expect(page.locator('link[rel="icon"][sizes="64x64"]')).toHaveAttribute('href', './favicon.webp');
  await expect(home).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wizino TD' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fonts.check('64px "Titan One"'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Start adventure' })).toBeVisible();
  await expect(page.locator('#home-hero')).toHaveAttribute('data-intro-state', 'complete', { timeout: 5_000 });
  await expect(page.locator('#home-player-level')).toHaveText('1');
  await expect(page.locator('#home-energy-value')).toHaveText('0/100');
  await expect(page.locator('#home-coins-value')).toHaveText('0');
  await expect(page.locator('#home-gems-value')).toHaveText('0');
  await expect(page.locator('#home-power-value')).toHaveText('0');
  await expect(page.locator('#home-streak-value')).toHaveText('Start today');
  await expect(page.locator('#home-best-wave-value')).toHaveText('No waves');
  await expect(home.locator('.home-quick-button')).toHaveCount(4);
  await expect(home.locator('[data-home-world]')).toHaveCount(6);
  const modalFrameStyles = await page.locator('.modal').evaluateAll((modals) => modals.map((modal) => {
    const style = getComputedStyle(modal);
    return { source: style.borderImageSource, slice: style.borderImageSlice };
  }));
  expect(modalFrameStyles).toHaveLength(3);
  expect(modalFrameStyles.every(({ source, slice }) => source.includes('modal-frame') && slice === '342 334')).toBe(true);

  const layout = await home.evaluate((element) => {
    const images = [...element.querySelectorAll<HTMLImageElement>('img')];
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
    const footer = element.querySelector<HTMLElement>('.home-footer')!;
    return {
      allImagesLoaded: images.every((image) => image.complete && image.naturalWidth >= 100),
      allButtonsUsePointerCursor: buttons.every((button) => getComputedStyle(button).cursor === 'pointer'),
      allButtonsAnimate: buttons.every((button) => getComputedStyle(button).transitionDuration !== '0s'),
      horizontalOverflow: element.scrollWidth - element.clientWidth,
      footerBottom: footer.getBoundingClientRect().bottom,
      heroCenterDelta: Math.abs(
        element.querySelector<HTMLElement>('.home-hero')!.getBoundingClientRect().left
          + element.querySelector<HTMLElement>('.home-hero')!.getBoundingClientRect().width / 2
          - (element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2),
      ),
      sloganGap: element.querySelector<HTMLElement>('.home-hero p')!.getBoundingClientRect().top
        - element.querySelector<HTMLElement>('.home-hero h1')!.getBoundingClientRect().bottom,
      wordmarkFont: getComputedStyle(element.querySelector<HTMLElement>('.home-hero h1')!).fontFamily,
    };
  });

  expect(layout.allImagesLoaded).toBe(true);
  expect(layout.allButtonsUsePointerCursor).toBe(true);
  expect(layout.allButtonsAnimate).toBe(true);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(layout.footerBottom).toBeLessThanOrEqual(1008);
  expect(layout.heroCenterDelta).toBeLessThanOrEqual(1);
  expect(layout.sloganGap).toBeGreaterThanOrEqual(12);
  expect(layout.wordmarkFont).toContain('Titan One');

  const quickActions = await home.locator('.home-quick-button').evaluateAll((buttons) => buttons.map((button) => {
    const buttonRect = button.getBoundingClientRect();
    const imageRect = button.querySelector('img')!.getBoundingClientRect();
    const labelRect = button.querySelector('strong')!.getBoundingClientRect();
    return {
      width: buttonRect.width,
      height: buttonRect.height,
      imageCenterDelta: Math.abs((imageRect.left + imageRect.width / 2) - (buttonRect.left + buttonRect.width / 2)),
      labelCenterDelta: Math.abs((labelRect.left + labelRect.width / 2) - (buttonRect.left + buttonRect.width / 2)),
    };
  }));
  expect(quickActions.every(({ width }) => width >= 104 && width <= 116)).toBe(true);
  expect(quickActions.every(({ height }) => Math.abs(height - 102) <= 1)).toBe(true);
  expect(quickActions.every(({ imageCenterDelta, labelCenterDelta }) => imageCenterDelta <= 1 && labelCenterDelta <= 1)).toBe(true);

  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/home-screen-qa.png', fullPage: true });
  }

  await page.getByRole('button', { name: /Forest World/i }).click();
  await expect(page.getByRole('heading', { name: 'Forest World' })).toBeVisible();
  await expect(page.locator('#world-grid')).toBeHidden();
  await expect(page.locator('#level-grid')).toBeVisible();
  await expect(page.locator('[data-level]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Deploy to sector/i })).toHaveCount(0);
  await expect(page.locator('#selection-hint')).toHaveText('Select a map to deploy immediately.');
  await expect(page).toHaveURL(/#\/worlds\/forest\/levels$/);

  const levelLayout = await page.locator('[data-level]').evaluateAll((cards) => {
    const rects = cards.map((card) => card.getBoundingClientRect());
    const xs = rects.map((rect) => rect.x);
    return {
      rows: new Set(rects.map((rect) => Math.round(rect.y))).size,
      horizontalStagger: Math.max(...xs) - Math.min(...xs),
    };
  });
  expect(levelLayout.rows).toBe(3);
  expect(levelLayout.horizontalStagger).toBeLessThanOrEqual(10);
  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/level-select-page-qa.png', fullPage: true });
  }
  await page.getByRole('button', { name: /Play Mossy Crossing/i }).click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page).toHaveURL(/#\/play\/forest-1$/);
});

test('stages the home hero and lets the arrow play the alternate intro', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1008 });
  await page.goto('/');

  const hero = page.locator('#home-hero');
  const arrow = page.getByRole('button', { name: 'Play the alternate magical intro' });
  await expect(hero).toHaveClass(/home-hero--intro-smash/);
  await expect(hero).toHaveAttribute('data-intro-state', 'complete', { timeout: 5_000 });
  await arrow.click();

  await expect(hero).toHaveClass(/home-hero--intro-magic/);
  await expect(hero).toHaveAttribute('data-intro-state', 'running');
  await expect(page.getByRole('button', { name: 'Replay the smash intro' })).toBeVisible();
  const animationNames = await hero.evaluate((element) => ({
    title: getComputedStyle(element.querySelector('h1 span')!).animationName,
    play: getComputedStyle(element.querySelector<HTMLElement>('.home-play')!).animationName,
    modes: [...element.querySelectorAll<HTMLElement>('.home-modes button')]
      .map((button) => getComputedStyle(button).animationName),
  }));
  expect(animationNames.title).toBe('home-title-magic-focus');
  expect(animationNames.play).toBe('home-play-magic-land');
  expect(animationNames.modes).toEqual(['home-mode-sweep-left', 'home-mode-sweep-right']);
  await expect(hero).toHaveAttribute('data-intro-state', 'complete', { timeout: 5_000 });
});

test('skips the staged motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const hero = page.locator('#home-hero');
  await expect(hero).toHaveAttribute('data-intro-state', 'complete');
  const activeAnimations = await hero.evaluate((element) => (
    [element, ...element.querySelectorAll('*')]
      .flatMap((target) => target.getAnimations())
      .filter((animation) => animation.playState === 'running').length
  ));
  expect(activeAnimations).toBe(0);
});

test('persists guest settings and daily rewards in local browser storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();

  const panel = page.locator('#home-panel-modal');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(panel.locator('[data-setting]')).toHaveCount(5);
  await expect(panel.locator('[data-setting="musicEnabled"]')).toBeChecked();
  await expect(panel.locator('[data-setting="effectsEnabled"]')).toBeChecked();
  await expect(panel.locator('[data-setting="soundPack"]')).toHaveValue('magic-chimes');
  await panel.locator('[data-setting="soundPack"]').selectOption('cozy-clicks');
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().soundPack)).toBe('cozy-clicks');
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().loadedEffects)).toBeGreaterThanOrEqual(14);
  await panel.locator('[data-setting="soundPack"]').selectOption('gentle-quest');
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().loadedEffects)).toBeGreaterThanOrEqual(21);
  await panel.locator('[data-setting="soundPack"]').selectOption('cozy-clicks');
  if (process.env.CAPTURE_HOME) await page.screenshot({ path: 'tmp/settings-panel-qa.png', fullPage: true });
  await panel.getByText('Game sounds').click();
  await expect(panel.locator('[data-setting="effectsEnabled"]')).not.toBeChecked();
  await expect(panel.locator('[data-setting="soundPack"]')).toHaveValue('cozy-clicks');
  await panel.getByText('Gameplay tips').click();
  await expect(panel.locator('[data-setting="gameplayTips"]')).not.toBeChecked();
  await panel.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(panel.locator('[data-setting="effectsEnabled"]')).not.toBeChecked();
  expect(await page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().effectsEnabled)).toBe(false);
  await expect(panel.locator('[data-setting="gameplayTips"]')).not.toBeChecked();
  await panel.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /Daily rewards/i }).click();
  await panel.getByRole('button', { name: 'Claim daily reward' }).click();
  await expect(panel.getByText('Reward collected')).toBeVisible();
  await expect(page.locator('#home-coins-value')).toHaveText('100');
  await expect(page.locator('#home-gems-value')).toHaveText('5');
  await page.reload();
  await expect(page.locator('#home-coins-value')).toHaveText('100');
  await expect(page.locator('#home-gems-value')).toHaveText('5');
});

test('keeps music muted while home-screen effects remain audible', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1008 });
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Enable music' });
  const music = page.locator('#background-music');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(music).toHaveAttribute('preload', 'none');
  await expect(music).toHaveAttribute('loop', '');
  expect(await music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().lastEffect)).toBe('open');
  await page.locator('#home-panel-modal').getByRole('button', { name: 'Close' }).click();
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().lastEffect)).toBe('back');
  expect(await music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);

  const bounds = await toggle.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(1512 - (bounds!.x + bounds!.width) - 16)).toBeLessThanOrEqual(1);
  expect(Math.abs(1008 - (bounds!.y + bounds!.height) - 16)).toBeLessThanOrEqual(1);

  await toggle.click();
  await expect(page.getByRole('button', { name: 'Mute music' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().loadedEffects)).toBe(7);
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => Number.isFinite(audio.duration))).toBe(true);
  const loopDuration = await music.evaluate((audio: HTMLAudioElement) => audio.duration);
  expect(loopDuration).toBeGreaterThan(15.1);
  expect(loopDuration).toBeLessThan(15.2);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Mute music' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start adventure' }).click();
  await expect(page.getByRole('button', { name: 'Mute music' })).toBeVisible();
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().lastEffect)).toBe('confirm');
  await page.getByRole('button', { name: /Forest World/i }).click();
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().lastEffect)).toBe('card');

  await page.getByRole('button', { name: 'Mute music' }).click();
  await expect(page.getByRole('button', { name: 'Enable music' })).toHaveAttribute('aria-pressed', 'false');
  expect(await music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  const playsWhileMusicMuted = await page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().effectPlays);
  await page.locator('[data-level]').first().click();
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().effectPlays)).toBeGreaterThan(playsWhileMusicMuted);
});

test('opens functional mission, achievement, collection, and leaderboard panels', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('#home-panel-modal');

  await page.getByRole('button', { name: /Missions/i }).click();
  await expect(panel.locator('.progress-card')).toHaveCount(3);
  await panel.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /Achievements/i }).click();
  await expect(panel.locator('.progress-card')).toHaveCount(6);
  await panel.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /Collection/i }).click();
  await expect(panel.getByText('4 guardians included')).toBeVisible();
  await expect(panel.locator('[data-learning-card]')).toHaveCount(4);
  await expect(panel.locator('.learning-card--holographic')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Leaderboards' }).click();
  await expect(panel.getByText('No local records yet')).toBeVisible();
});

test('shows unlocked learning cards and local leaderboard records', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wizino-td-player-v1', JSON.stringify({
      version: 1,
      stars: { 'forest-1': 3 },
      bestLives: { 'forest-1': 20 },
      highScores: { 'forest-1': 5400 },
      leaderboard: [{
        levelId: 'forest-1', levelName: 'Mossy Crossing', score: 5400, stars: 3, lives: 20,
        achievedAt: '2026-07-23T00:00:00.000Z',
      }],
    }));
  });
  await page.goto('/');

  await page.getByRole('button', { name: /Collection/i }).click();
  const panel = page.locator('#home-panel-modal');
  const cards = panel.locator('[data-learning-card]');
  const card = panel.locator('[data-card-id="forest-1"]');
  await expect(cards).toHaveCount(5);
  await expect(card).toContainText('What connects every organism in a food web?');
  if (process.env.CAPTURE_HOME) await page.screenshot({ path: 'tmp/collection-panel-qa.png', fullPage: true });
  await card.click();
  await expect(card).toHaveClass(/is-flipped/);
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Leaderboards' }).click();
  await expect(panel.getByText('Mossy Crossing')).toBeVisible();
  await expect(panel.getByText('5,400')).toBeVisible();
});

test('uses TCG proportions and a swipeable collection rail on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Collection/i }).click();

  const panel = page.locator('#home-panel-modal');
  const cards = panel.locator('[data-learning-card]');
  await expect(cards).toHaveCount(4);
  await expect.poll(async () => cards.locator('img').evaluateAll((images) => (
    images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)
  ))).toBe(true);

  const layout = await panel.evaluate((backdrop) => {
    const grid = backdrop.querySelector<HTMLElement>('.collection-grid')!;
    const card = backdrop.querySelector<HTMLElement>('.learning-card')!;
    const rect = card.getBoundingClientRect();
    return {
      ratio: rect.width / rect.height,
      scrollsHorizontally: grid.scrollWidth > grid.clientWidth,
      snap: getComputedStyle(grid).scrollSnapType,
    };
  });

  expect(layout.ratio).toBeCloseTo(5 / 7, 1);
  expect(layout.scrollsHorizontally).toBe(true);
  expect(layout.snap).toContain('x');
});

test('play opens a dedicated three-by-two world page', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1008 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start adventure' }).click();

  const selection = page.locator('#level-modal');
  await expect(selection).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where will you explore?' })).toBeVisible();
  await expect(selection).not.toHaveAttribute('role', 'dialog');
  await expect(selection.locator('[data-world]')).toHaveCount(6);
  await expect(selection.locator('.selection-world-art')).toHaveCount(6);
  expect(await selection.locator('.selection-world-art').evaluateAll((images) => images.every((image) => {
    const artwork = image as HTMLImageElement;
    return artwork.complete && artwork.naturalWidth >= 100 && artwork.naturalHeight >= 100;
  }))).toBe(true);
  await expect(page).toHaveURL(/#\/worlds$/);

  const layout = await selection.locator('#world-grid').evaluate((grid) => {
    const style = getComputedStyle(grid);
    return {
      columns: style.gridTemplateColumns.split(' ').length,
      rows: style.gridTemplateRows.split(' ').length,
    };
  });
  expect(layout).toEqual({ columns: 3, rows: 2 });

  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/world-select-page-qa.png', fullPage: true });
  }

  await page.getByRole('button', { name: /Workshop World/i }).click();
  await expect(page.getByRole('heading', { name: 'Workshop World' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Where will you explore?' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Wizino TD' })).toBeVisible();
});

test('keeps the home dashboard usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const home = page.locator('#home-screen');
  await expect(page.getByRole('button', { name: 'Start adventure' })).toBeVisible();
  await expect(home.locator('[data-home-world]')).toHaveCount(6);
  expect(await home.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('#home-panel-modal .home-panel-modal');
  await expect(settings).toBeVisible();
  const settingsBounds = await settings.boundingBox();
  expect(settingsBounds).not.toBeNull();
  expect(settingsBounds!.x).toBeGreaterThanOrEqual(0);
  expect(settingsBounds!.x + settingsBounds!.width).toBeLessThanOrEqual(390);
  expect(await settings.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const closeBounds = await settings.getByRole('button', { name: 'Close' }).boundingBox();
  expect(closeBounds).not.toBeNull();
  expect(closeBounds!.x).toBeGreaterThanOrEqual(settingsBounds!.x);
  expect(closeBounds!.x + closeBounds!.width).toBeLessThanOrEqual(settingsBounds!.x + settingsBounds!.width);
  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/home-screen-mobile-qa.png', fullPage: true });
  }
});
