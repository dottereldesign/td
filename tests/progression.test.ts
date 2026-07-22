import { describe, expect, it } from 'vitest';
import {
  PLAYER_PROGRESS_KEY,
  claimDaily,
  createDefaultProgress,
  loadPlayerProgress,
  recordVictory,
  savePlayerProgress,
  starGlyphs,
  starsForVictory,
} from '../src/progression';

describe('map star awards', () => {
  it('awards one, two, or three stars from remaining integrity', () => {
    expect(starsForVictory(1, 20)).toBe(1);
    expect(starsForVictory(10, 20)).toBe(2);
    expect(starsForVictory(16, 20)).toBe(3);
    expect(starsForVictory(20, 20)).toBe(3);
  });

  it('renders a fixed three-star record', () => {
    expect(starGlyphs(0)).toBe('☆☆☆');
    expect(starGlyphs(2)).toBe('★★☆');
    expect(starGlyphs(9)).toBe('★★★');
  });
});

describe('local guest progression', () => {
  it('starts a guest at level one with zero resources and no fabricated records', () => {
    const player = createDefaultProgress();
    expect(player.level).toBe(1);
    expect(player.energy).toBe(0);
    expect(player.coins).toBe(0);
    expect(player.gems).toBe(0);
    expect(player.squadPower).toBe(0);
    expect(player.bestWave).toBe(0);
    expect(player.streak).toBe(0);
    expect(player.leaderboard).toEqual([]);
  });

  it('persists the versioned guest record in browser-like storage', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const player = createDefaultProgress();
    player.coins = 250;
    savePlayerProgress(player, storage);
    expect(values.has(PLAYER_PROGRESS_KEY)).toBe(true);
    expect(loadPlayerProgress(storage).coins).toBe(250);
  });

  it('awards one daily reward per local day', () => {
    const player = createDefaultProgress();
    expect(claimDaily(player, new Date(2026, 6, 23, 9))).toEqual({ coins: 100, gems: 5 });
    expect(claimDaily(player, new Date(2026, 6, 23, 22))).toBeNull();
    expect(claimDaily(player, new Date(2026, 6, 24, 9))).toEqual({ coins: 100, gems: 5 });
    expect(player.coins).toBe(200);
    expect(player.gems).toBe(10);
  });

  it('posts only new level highscores and advances a win streak', () => {
    const player = createDefaultProgress();
    const first = recordVictory(player, {
      levelId: 'forest-1', levelName: 'Mossy Crossing', lives: 20, startLives: 20, cash: 400,
      date: new Date(2026, 6, 23, 10),
    });
    const lower = recordVictory(player, {
      levelId: 'forest-1', levelName: 'Mossy Crossing', lives: 10, startLives: 20, cash: 100,
      date: new Date(2026, 6, 23, 12),
    });
    recordVictory(player, {
      levelId: 'forest-2', levelName: 'Sunpetal Grove', lives: 18, startLives: 20, cash: 300,
      date: new Date(2026, 6, 24, 10),
    });

    expect(first.newHighScore).toBe(true);
    expect(lower.newHighScore).toBe(false);
    expect(player.leaderboard).toHaveLength(2);
    expect(player.leaderboard[0].score).toBeGreaterThanOrEqual(player.leaderboard[1].score);
    expect(player.streak).toBe(2);
    expect(player.longestStreak).toBe(2);
  });
});
