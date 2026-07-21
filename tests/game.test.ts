import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game';

describe('Game economy and placement', () => {
  it('blocks the route and permits an open tile', () => {
    const game = new Game('switchback');
    game.selectBuild('sentry');
    expect(game.getPlacement({ x: 2, y: 2 })).toEqual({ valid: false, reason: 'path' });
    expect(game.getPlacement({ x: 2, y: 4 })).toEqual({ valid: true, reason: 'valid' });
  });

  it('charges, upgrades, and refunds predictably', () => {
    const game = new Game('switchback');
    game.selectBuild('sentry');
    const tower = game.placeTower({ x: 2, y: 4 });
    expect(tower).not.toBeNull();
    expect(game.cash).toBe(330);
    expect(game.getSelectedTower()).toBe(tower);

    const upgradeCost = game.getUpgradeCost(tower!);
    expect(upgradeCost).toBe(65);
    expect(game.upgradeSelected()).toBe(true);
    expect(tower!.level).toBe(2);
    expect(game.cash).toBe(265);

    const refund = game.getSellValue(tower!);
    expect(refund).toBe(110);
    expect(game.sellSelected()).toBe(true);
    expect(game.cash).toBe(375);
    expect(game.towers).toHaveLength(0);
  });

  it('runs a deterministic wave to defeat when nothing is built', () => {
    const game = new Game('switchback');
    expect(game.startWave()).toBe(true);
    for (let step = 0; step < 12_000 && game.phase === 'wave'; step += 1) game.update(1 / 60);
    expect(game.phase).toBe('build');
    expect(game.currentWave).toBe(0);
    expect(game.lives).toBe(10);
  });

  it('lets a sensible opening clear the first wave', () => {
    const game = new Game('switchback');
    game.selectBuild('needle');
    game.placeTower({ x: 3, y: 3 });
    game.selectBuild('sentry');
    game.placeTower({ x: 6, y: 3 });
    game.selectBuild('sentry');
    game.placeTower({ x: 7, y: 4 });
    expect(game.startWave()).toBe(true);
    for (let step = 0; step < 12_000 && game.phase === 'wave'; step += 1) game.update(1 / 60);
    expect(game.phase).toBe('build');
    expect(game.lives).toBeGreaterThanOrEqual(18);
    expect(game.towers.reduce((kills, tower) => kills + tower.kills, 0)).toBeGreaterThan(0);
  });
});
