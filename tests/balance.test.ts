import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game';
import type { Cell, TowerId } from '../src/types';

function build(game: Game, id: TowerId, cell: Cell): void {
  game.selectBuild(id);
  expect(game.placeTower(cell), `${id} at ${cell.x},${cell.y}`).not.toBeNull();
}

function finishWave(game: Game): void {
  expect(game.startWave()).toBe(true);
  for (let step = 0; step < 24_000 && game.phase === 'wave'; step += 1) game.update(1 / 60);
  expect(game.phase).not.toBe('wave');
  expect(game.phase).not.toBe('defeat');
}

describe('prototype balance smoke test', () => {
  it('allows a mixed-counter strategy to finish Switchback', () => {
    const game = new Game('switchback');
    build(game, 'needle', { x: 4, y: 1 });
    build(game, 'sentry', { x: 6, y: 3 });
    build(game, 'sentry', { x: 7, y: 4 });
    build(game, 'sentry', { x: 9, y: 4 });

    finishWave(game);
    build(game, 'needle', { x: 2, y: 3 });

    finishWave(game);
    build(game, 'sentry', { x: 4, y: 4 });
    game.selectTowerAt({ x: 6, y: 3 });
    game.upgradeSelected();

    finishWave(game);
    build(game, 'arcanum', { x: 8, y: 6 });

    finishWave(game);
    build(game, 'arcanum', { x: 11, y: 6 });

    finishWave(game);
    build(game, 'mortar', { x: 11, y: 7 });

    finishWave(game);
    build(game, 'mortar', { x: 13, y: 7 });

    finishWave(game);
    build(game, 'null', { x: 14, y: 9 });

    finishWave(game);
    expect(game.phase).toBe('victory');
    expect(game.lives).toBeGreaterThan(0);
  });
});
