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
  await expect(page.locator('#home-hero')).toHaveAttribute('data-intro-state', 'complete', { timeout: 8_000 });
  await expect(page.locator('#home-player-level')).toHaveText('1');
  await expect(page.locator('#home-energy-value')).toHaveText('0/100');
  await expect(page.locator('#home-coins-value')).toHaveText('0');
  await expect(page.locator('#home-gems-value')).toHaveText('0');
  await expect(page.locator('#home-power-value')).toHaveText('0');
  await expect(page.locator('#home-streak-value')).toHaveText('Start today');
  await expect(page.locator('#home-best-wave-value')).toHaveText('No waves');
  await expect(home.locator('.home-quick-button')).toHaveCount(4);
  await expect(home.locator('[data-home-world]')).toHaveCount(6);
  await expect(home.locator('.home-world-heading')).toHaveCount(0);
  const premium = home.locator('.home-premium');
  await expect(premium).toContainText('Get premium!');
  await expect(premium).toContainText('Unlock the full game on mobile');
  await expect(premium).toContainText('no ads');
  const storeBadges = premium.locator('.home-premium-stores img');
  await expect(storeBadges).toHaveCount(2);
  await expect(storeBadges.nth(0)).toHaveAttribute('src', '/assets/store-badges/download-on-app-store.webp');
  await expect(storeBadges.nth(1)).toHaveAttribute('src', '/assets/store-badges/get-it-on-google-play.webp');
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
      allEnabledButtonsUsePointerCursor: buttons
        .filter((button) => !button.disabled)
        .every((button) => getComputedStyle(button).cursor === 'pointer'),
      allDisabledButtonsAvoidPointerCursor: buttons
        .filter((button) => button.disabled)
        .every((button) => getComputedStyle(button).cursor !== 'pointer'),
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
      premiumAudioGap: document.querySelector<HTMLElement>('.global-audio-toggle')!.getBoundingClientRect().left
        - element.querySelector<HTMLElement>('.home-premium-stores')!.getBoundingClientRect().right,
      premiumCopyBadgeGap: element.querySelector<HTMLImageElement>('.store-badge--apple')!.getBoundingClientRect().left
        - element.querySelector<HTMLElement>('.home-premium-copy')!.getBoundingClientRect().right,
    };
  });

  expect(layout.allImagesLoaded).toBe(true);
  expect(layout.allEnabledButtonsUsePointerCursor).toBe(true);
  expect(layout.allDisabledButtonsAvoidPointerCursor).toBe(true);
  expect(layout.allButtonsAnimate).toBe(true);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(layout.footerBottom).toBeLessThanOrEqual(1008);
  expect(layout.heroCenterDelta).toBeLessThanOrEqual(1);
  expect(layout.sloganGap).toBeGreaterThanOrEqual(12);
  expect(layout.wordmarkFont).toContain('Titan One');
  expect(layout.premiumAudioGap).toBeGreaterThanOrEqual(6);
  expect(layout.premiumCopyBadgeGap).toBeGreaterThanOrEqual(6);

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

  await page.locator('#home-profile-button').click();
  await expect(page.locator('#home-panel-modal')).toBeVisible();
  await expect(page.locator('#home-panel-title')).toHaveText('WizinoHero');
  await page.locator('#home-panel-close').click();

  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/home-screen-qa.png', fullPage: true });
  }

  await page.locator('[data-home-world="forest"]').click();
  await expect(page.getByRole('heading', { name: 'Forest World' })).toBeVisible();
  await expect(page.locator('#world-grid')).toBeHidden();
  await expect(page.locator('#level-grid')).toBeVisible();
  await expect(page.locator('[data-level]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Deploy to sector/i })).toHaveCount(0);
  await expect(page.locator('#selection-hint')).toHaveText('Choose any map card to deploy immediately.');
  await expect(page.locator('#selected-map-name')).toHaveText('Mossy Crossing');
  await expect(page.locator('.map-select-view .level-preview')).toHaveCount(4);
  await expect(page).toHaveURL(/#\/worlds\/forest\/levels$/);

  const levelLayout = await page.locator('[data-level]').evaluateAll((cards) => {
    const rects = cards.map((card) => card.getBoundingClientRect());
    return {
      rows: new Set(rects.map((rect) => Math.round(rect.y))).size,
      columns: new Set(rects.map((rect) => Math.round(rect.x))).size,
      thirdCardStartsSecondRow: Math.abs(rects[2].x - rects[0].x) <= 1,
    };
  });
  expect(levelLayout.rows).toBe(2);
  expect(levelLayout.columns).toBe(2);
  expect(levelLayout.thirdCardStartsSecondRow).toBe(true);
  await page.locator('[data-level="forest-2"]').focus();
  await expect(page.locator('#selected-map-name')).toHaveText('Sunpetal Grove');
  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/level-select-page-qa.png', fullPage: true });
  }
  await page.locator('[data-level="forest-1"]').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page).toHaveURL(/#\/play\/forest-1$/);
});

test('stages the home hero and lets the arrow play the alternate intro', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1008 });
  await page.goto('/');

  const hero = page.locator('#home-hero');
  const home = page.locator('#home-screen');
  const arrow = page.getByRole('button', { name: 'Play the alternate magical intro' });
  await expect(hero).toHaveClass(/home-hero--intro-smash/);
  await expect(hero).toHaveAttribute('data-intro-state', 'complete', { timeout: 8_000 });
  await expect(home).toHaveAttribute('data-intro-state', 'complete');
  await arrow.click();

  await expect(hero).toHaveClass(/home-hero--intro-magic/);
  await expect(home).toHaveClass(/home-screen--intro-magic/);
  await expect(hero).toHaveAttribute('data-intro-state', 'running');
  await expect(home).toHaveAttribute('data-intro-state', 'running');
  await expect(page.getByRole('button', { name: 'Replay the smash intro' })).toBeVisible();
  const animationNames = await home.evaluate((element) => {
    const animation = (selector: string) => getComputedStyle(element.querySelector<HTMLElement>(selector)!).animationName;
    const delay = (selector: string) => Number.parseFloat(getComputedStyle(element.querySelector<HTMLElement>(selector)!).animationDelay);
    return {
      title: animation('h1 span'),
      play: animation('.home-play'),
      modes: [...element.querySelectorAll<HTMLElement>('.home-modes button')]
        .map((button) => getComputedStyle(button).animationName),
      dashboard: [
        '.home-profile',
        '.home-resources > button',
        '.home-quick-button',
        '.home-feature-cards > button',
        '.home-world',
        '.home-footer > button',
      ].map(animation),
      delays: {
        activity: delay('.home-quick-button'),
        worlds: delay('.home-world'),
        footer: delay('.home-footer > button'),
      },
    };
  });
  expect(animationNames.title).toBe('home-title-magic-focus');
  expect(animationNames.play).toBe('home-play-magic-land');
  expect(animationNames.modes).toEqual(['home-mode-sweep-left', 'home-mode-sweep-right']);
  expect(animationNames.dashboard.every((name) => name === 'home-dashboard-enter')).toBe(true);
  expect(animationNames.delays.activity).toBeLessThan(animationNames.delays.worlds);
  expect(animationNames.delays.worlds).toBeLessThan(animationNames.delays.footer);
  await expect(hero).toHaveAttribute('data-intro-state', 'complete', { timeout: 8_000 });
  await expect(home).toHaveAttribute('data-intro-state', 'complete');
});

test('skips the staged motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const hero = page.locator('#home-hero');
  const home = page.locator('#home-screen');
  await expect(hero).toHaveAttribute('data-intro-state', 'complete');
  await expect(home).toHaveAttribute('data-intro-state', 'complete');
  const activeAnimations = await home.evaluate((element) => (
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
  await page.locator('[data-world="forest"]').click();
  await expect.poll(() => page.evaluate(() => window.__WIZINO_TD__.audio.getDiagnostics().lastEffect)).toBe('card');
  await page.getByRole('button', { name: /View maps/i }).click();

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

test('play opens the locked hex world-selection page', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1008 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start adventure' }).click();

  const selection = page.locator('#level-modal');
  await expect(selection).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Select a world' })).toBeVisible();
  await expect(selection).not.toHaveAttribute('role', 'dialog');
  await expect(selection.locator('[data-world]')).toHaveCount(6);
  await expect(selection.locator('.selection-world-art')).toHaveCount(6);
  await expect(selection.locator('[data-world]:enabled')).toHaveCount(1);
  await expect(selection.locator('[data-world]:disabled')).toHaveCount(5);
  await expect(selection.locator('[data-world="forest"]')).toHaveClass(/is-selected/);
  await expect(selection.locator('#world-detail-name')).toHaveText('Forest World');
  await expect(selection.locator('#world-complete-value')).toHaveText('0 / 6');
  await expect(selection.locator('#world-map-progress')).toHaveText('0 / 3 maps cleared');
  expect(await selection.locator('.selection-world-art').evaluateAll((images) => images.every((image) => {
    const artwork = image as HTMLImageElement;
    return artwork.complete && artwork.naturalWidth >= 100 && artwork.naturalHeight >= 100;
  }))).toBe(true);
  await expect(page).toHaveURL(/#\/worlds$/);

  const layout = await selection.locator('#world-grid').evaluate((grid) => {
    const cards = [...grid.querySelectorAll<HTMLElement>('[data-world]')];
    const forest = cards[0];
    const forestStyle = getComputedStyle(forest);
    const forestCopyStyle = getComputedStyle(forest.querySelector<HTMLElement>('.selection-world-copy')!);
    return {
      columns: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().x))).size,
      rows: new Set(cards.map((card) => getComputedStyle(card).gridRowStart)).size,
      usesHexShape: forestStyle.clipPath.includes('polygon'),
      overlayReachesBottomPoint: forestCopyStyle.bottom === '0px',
    };
  });
  expect(layout.columns).toBe(6);
  expect(layout.rows).toBe(2);
  expect(layout.usesHexShape).toBe(true);
  expect(layout.overlayReachesBottomPoint).toBe(true);

  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/world-select-page-qa.png', fullPage: true });
  }

  await selection.locator('[data-world="forest"]').click();
  await page.getByRole('button', { name: /View maps/i }).click();
  await expect(page.getByRole('heading', { name: 'Forest World' })).toBeVisible();
  await expect(selection.locator('[data-level]')).toHaveCount(3);
  await expect(page).toHaveURL(/#\/worlds\/forest\/levels$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Select a world' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Wizino TD' })).toBeVisible();
});

test('unlocks worlds in sequence after the previous world is complete', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wizino-td-player-v1', JSON.stringify({
      version: 1,
      stars: { 'forest-1': 1, 'forest-2': 2, 'forest-3': 3 },
    }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start adventure' }).click();

  const selection = page.locator('#level-modal');
  await expect(selection.locator('[data-world]:enabled')).toHaveCount(2);
  await expect(selection.locator('[data-world="word"]')).toBeDisabled();
  await selection.locator('[data-world="workshop"]').click();
  await expect(selection.locator('#world-detail-name')).toHaveText('Workshop World');
  await expect(selection.locator('#world-complete-value')).toHaveText('1 / 6');
  await page.getByRole('button', { name: /View maps/i }).click();
  await expect(page.getByRole('heading', { name: 'Workshop World' })).toBeVisible();
});

test('keeps the home dashboard usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const home = page.locator('#home-screen');
  await expect(page.getByRole('button', { name: 'Start adventure' })).toBeVisible();
  await expect(page.locator('#home-hero')).toHaveAttribute('data-intro-state', 'complete', { timeout: 8_000 });
  await expect(home.locator('[data-home-world]')).toHaveCount(6);
  expect(await home.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await home.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  const quickActionLayout = await home.locator('.home-quick-actions').evaluate((nav) => {
    const navRect = nav.getBoundingClientRect();
    const buttons = [...nav.querySelectorAll<HTMLElement>('.home-quick-button')];
    const buttonRects = buttons.map((button) => button.getBoundingClientRect());
    const badges = buttons.map((button) => {
      const badge = button.querySelector<HTMLElement>('b');
      return badge && !badge.hidden ? badge.getBoundingClientRect() : null;
    });
    return {
      buttonCount: buttons.length,
      rowSpread: Math.max(...buttonRects.map((rect) => rect.top)) - Math.min(...buttonRects.map((rect) => rect.top)),
      columnGaps: buttonRects.slice(0, -1).map((rect, index) => buttonRects[index + 1].left - rect.right),
      badgesInsideRail: badges.every((badge) => !badge || (
        badge.top >= navRect.top
        && badge.right <= navRect.right
      )),
      badgesClearNextCard: badges.every((badge, index) => (
        !badge || !buttonRects[index + 1] || buttonRects[index + 1].left - badge.right >= 2
      )),
    };
  });
  expect(quickActionLayout.buttonCount).toBe(4);
  expect(quickActionLayout.rowSpread).toBeLessThanOrEqual(1);
  expect(quickActionLayout.columnGaps.every((gap) => gap >= 7)).toBe(true);
  expect(quickActionLayout.badgesInsideRail).toBe(true);
  expect(quickActionLayout.badgesClearNextCard).toBe(true);
  if (process.env.CAPTURE_HOME) {
    await home.locator('.home-quick-actions').screenshot({ path: 'tmp/home-mobile-quick-actions-qa.png' });
  }
  const profileDock = page.locator('#home-profile-button');
  const resourceTray = page.locator('#home-resources');
  const globalSoundButton = page.locator('#sound-button');
  const menuButton = page.locator('#home-menu-button');
  await expect(resourceTray).toBeHidden();
  await expect(globalSoundButton).toBeHidden();
  await expect(menuButton).toBeVisible();
  await expect(profileDock).toHaveAttribute('aria-expanded', 'false');
  const closedDockLayout = await page.evaluate(() => {
    const profile = document.querySelector<HTMLElement>('#home-profile-button')!.getBoundingClientRect();
    const xp = document.querySelector<HTMLElement>('.home-xp')!.getBoundingClientRect();
    const menu = document.querySelector<HTMLElement>('#home-menu-button')!.getBoundingClientRect();
    return {
      profileBottomGap: window.innerHeight - profile.bottom,
      profileMenuGap: menu.left - profile.right,
      xpRightInset: profile.right - xp.right,
    };
  });
  expect(closedDockLayout.profileBottomGap).toBeGreaterThanOrEqual(7);
  expect(closedDockLayout.profileBottomGap).toBeLessThanOrEqual(12);
  expect(closedDockLayout.profileMenuGap).toBeGreaterThanOrEqual(8);
  expect(closedDockLayout.xpRightInset).toBeGreaterThanOrEqual(10);
  await profileDock.click();
  await expect(profileDock).toHaveAttribute('aria-expanded', 'true');
  await expect(resourceTray).toBeVisible();
  const traySoundButton = resourceTray.locator('#home-sound-button');
  await expect(traySoundButton).toBeVisible();
  await expect(page.locator('#home-panel-modal')).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const profile = document.querySelector<HTMLElement>('#home-profile-button')!.getBoundingClientRect();
    const resources = document.querySelector<HTMLElement>('#home-resources')!.getBoundingClientRect();
    return profile.top - resources.bottom;
  })).toBeGreaterThanOrEqual(6);
  const openDockLayout = await page.evaluate(() => {
    return {
      horizontalOverflow: document.querySelector<HTMLElement>('#home-screen')!.scrollWidth
        - document.querySelector<HTMLElement>('#home-screen')!.clientWidth,
    };
  });
  expect(openDockLayout.horizontalOverflow).toBeLessThanOrEqual(1);
  const trayControlsLayout = await page.evaluate(() => {
    const settings = document.querySelector<HTMLElement>('#home-settings-button')!.getBoundingClientRect();
    const sound = document.querySelector<HTMLElement>('#home-sound-button')!.getBoundingClientRect();
    return {
      gap: sound.left - settings.right,
      topDelta: Math.abs(sound.top - settings.top),
    };
  });
  expect(trayControlsLayout.gap).toBeGreaterThanOrEqual(4);
  expect(trayControlsLayout.topDelta).toBeLessThanOrEqual(1);
  await traySoundButton.click();
  await expect(traySoundButton).toHaveAttribute('aria-pressed', 'true');
  await expect(globalSoundButton).toHaveAttribute('aria-pressed', 'true');
  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/home-mobile-profile-tray-qa.png', fullPage: true });
  }
  await resourceTray.getByRole('button', { name: 'Settings' }).click();
  await expect(resourceTray).toBeHidden();
  await expect(profileDock).toHaveAttribute('aria-expanded', 'false');
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
  await expect(globalSoundButton).toBeHidden();
});

test('uses the full-page adventure menu on phone and tablet layouts', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');

  const home = page.locator('#home-screen');
  const menu = page.locator('#home-mobile-menu');
  const menuButton = page.locator('#home-menu-button');
  await expect(page.locator('#home-hero')).toHaveAttribute('data-intro-state', 'complete', { timeout: 8_000 });
  await expect(menu).toBeHidden();
  await expect(home.locator('.home-feature-cards')).toBeHidden();
  await expect(home.locator('.home-footer')).toBeHidden();
  await expect(home.locator('.home-world-grid')).toBeHidden();
  expect(await home.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);

  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('heading', { name: 'Adventure menu' })).toBeVisible();
  await expect(menu.locator('.home-feature-cards')).toBeVisible();
  await expect(menu.locator('.home-feature-cards > button')).toHaveCount(2);
  await expect(menu.locator('.home-footer > button')).toHaveCount(5);
  await expect(menu.locator('.home-premium')).toContainText('Get premium!');
  await expect(menu.locator('.home-world')).toHaveCount(6);

  const menuLayout = await menu.evaluate((element) => {
    const worldGrid = element.querySelector<HTMLElement>('.home-world-grid')!;
    const firstWorld = worldGrid.querySelector<HTMLElement>('.home-world')!;
    const footer = element.querySelector<HTMLElement>('.home-footer')!;
    const gridRect = worldGrid.getBoundingClientRect();
    const firstWorldRect = firstWorld.getBoundingClientRect();
    return {
      horizontalOverflow: element.scrollWidth - element.clientWidth,
      worldFlow: getComputedStyle(worldGrid).gridAutoFlow,
      worldsScrollable: worldGrid.scrollWidth > worldGrid.clientWidth,
      footerColumns: getComputedStyle(footer).gridTemplateColumns.split(' ').length,
      firstWorldInsideRail: firstWorldRect.left >= gridRect.left && firstWorldRect.right <= gridRect.right,
    };
  });
  expect(menuLayout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(menuLayout.worldFlow).toBe('column');
  expect(menuLayout.worldsScrollable).toBe(true);
  expect(menuLayout.footerColumns).toBe(2);
  expect(menuLayout.firstWorldInsideRail).toBe(true);
  if (process.env.CAPTURE_HOME) {
    await page.screenshot({ path: 'tmp/home-tablet-adventure-menu-qa.png', fullPage: true });
  }

  await menu.getByRole('button', { name: 'Close adventure menu' }).click();
  await expect(menu).toBeHidden();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
});
