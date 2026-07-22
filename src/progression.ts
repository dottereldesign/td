export const PLAYER_PROGRESS_KEY = 'wizino-td-player-v1';

export interface PlayerSettings {
  soundEnabled: boolean;
  reducedMotion: boolean;
  gameplayTips: boolean;
}

export interface LeaderboardEntry {
  levelId: string;
  levelName: string;
  score: number;
  stars: number;
  lives: number;
  achievedAt: string;
}

export interface PlayerProgress {
  version: 1;
  name: string;
  level: number;
  xp: number;
  energy: number;
  coins: number;
  gems: number;
  squadPower: number;
  stars: Record<string, number>;
  bestLives: Record<string, number>;
  highScores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
  totalWaves: number;
  bestWave: number;
  totalTowers: number;
  victories: number;
  flawlessVictories: number;
  streak: number;
  longestStreak: number;
  lastVictoryDate: string | null;
  lastDailyClaim: string | null;
  claimedMissions: string[];
  settings: PlayerSettings;
}

export interface VictoryReward {
  score: number;
  newHighScore: boolean;
  coins: number;
  gems: number;
  xp: number;
}

export interface MissionDefinition {
  id: string;
  title: string;
  copy: string;
  target: number;
  rewardCoins: number;
  rewardGems: number;
  progress: (player: PlayerProgress) => number;
}

export const MISSIONS: MissionDefinition[] = [
  { id: 'first-wave', title: 'Hold the line', copy: 'Clear your first wave.', target: 1, rewardCoins: 50, rewardGems: 0, progress: (player) => player.totalWaves },
  { id: 'tower-team', title: 'Build a squad', copy: 'Deploy three towers across your runs.', target: 3, rewardCoins: 75, rewardGems: 1, progress: (player) => player.totalTowers },
  { id: 'first-victory', title: 'Sector secured', copy: 'Win your first level.', target: 1, rewardCoins: 150, rewardGems: 3, progress: (player) => player.victories },
];

export function createDefaultProgress(): PlayerProgress {
  return {
    version: 1,
    name: 'WizinoHero',
    level: 1,
    xp: 0,
    energy: 0,
    coins: 0,
    gems: 0,
    squadPower: 0,
    stars: {},
    bestLives: {},
    highScores: {},
    leaderboard: [],
    totalWaves: 0,
    bestWave: 0,
    totalTowers: 0,
    victories: 0,
    flawlessVictories: 0,
    streak: 0,
    longestStreak: 0,
    lastVictoryDate: null,
    lastDailyClaim: null,
    claimedMissions: [],
    settings: { soundEnabled: true, reducedMotion: false, gameplayTips: true },
  };
}

export function loadPlayerProgress(storage: Pick<Storage, 'getItem'> = localStorage): PlayerProgress {
  const defaults = createDefaultProgress();
  try {
    const raw = storage.getItem(PLAYER_PROGRESS_KEY);
    if (raw) return normalizeProgress(JSON.parse(raw) as Partial<PlayerProgress>, defaults);

    const legacyRaw = storage.getItem('snack-squad-player-v1') ?? storage.getItem('mono-ward-progress');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as { stars?: Record<string, number>; bestLives?: Record<string, number>; completed?: string[] };
      const stars = legacy.stars ?? Object.fromEntries((legacy.completed ?? []).map((id) => [id, 1]));
      return normalizeProgress({ stars, bestLives: legacy.bestLives ?? {} }, defaults);
    }
  } catch {
    // Invalid browser data falls back to a safe guest profile.
  }
  return defaults;
}

export function savePlayerProgress(player: PlayerProgress, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(player));
  } catch {
    // Private browsing or a full storage quota should not interrupt gameplay.
  }
}

export function starsForVictory(lives: number, startLives: number): 1 | 2 | 3 {
  const ratio = Math.max(0, lives) / Math.max(1, startLives);
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export function starGlyphs(stars: number): string {
  const safe = Math.min(3, Math.max(0, Math.floor(stars)));
  return `${'\u2605'.repeat(safe)}${'\u2606'.repeat(3 - safe)}`;
}

export function recordWaveCleared(player: PlayerProgress, waveNumber: number): void {
  player.totalWaves += 1;
  player.bestWave = Math.max(player.bestWave, waveNumber);
}

export function recordTowerBuilt(player: PlayerProgress): void {
  player.totalTowers += 1;
}

export function recordVictory(
  player: PlayerProgress,
  input: { levelId: string; levelName: string; lives: number; startLives: number; cash: number; date?: Date },
): VictoryReward {
  const stars = starsForVictory(input.lives, input.startLives);
  const score = stars * 1_000 + Math.max(0, input.lives) * 100 + Math.max(0, Math.floor(input.cash));
  const previous = player.highScores[input.levelId] ?? 0;
  const newHighScore = score > previous;
  const coins = 100 + stars * 50;
  const gems = stars;
  const xp = 120 + stars * 40;

  player.stars[input.levelId] = Math.max(player.stars[input.levelId] ?? 0, stars);
  player.bestLives[input.levelId] = Math.max(player.bestLives[input.levelId] ?? 0, input.lives);
  player.highScores[input.levelId] = Math.max(previous, score);
  player.victories += 1;
  if (input.lives >= input.startLives) player.flawlessVictories += 1;
  player.coins += coins;
  player.gems += gems;
  player.xp += xp;
  player.level = 1 + Math.floor(player.xp / 1_000);
  player.squadPower = Object.values(player.stars).reduce((total, value) => total + value, 0) * 125;
  updateStreak(player, input.date ?? new Date());

  if (newHighScore) {
    player.leaderboard = [
      ...player.leaderboard.filter((entry) => entry.levelId !== input.levelId),
      {
        levelId: input.levelId,
        levelName: input.levelName,
        score,
        stars,
        lives: input.lives,
        achievedAt: (input.date ?? new Date()).toISOString(),
      },
    ].sort((a, b) => b.score - a.score).slice(0, 10);
  }

  return { score, newHighScore, coins, gems, xp };
}

export function canClaimDaily(player: PlayerProgress, date = new Date()): boolean {
  return player.lastDailyClaim !== localDateKey(date);
}

export function claimDaily(player: PlayerProgress, date = new Date()): { coins: number; gems: number } | null {
  if (!canClaimDaily(player, date)) return null;
  const reward = { coins: 100, gems: 5 };
  player.coins += reward.coins;
  player.gems += reward.gems;
  player.lastDailyClaim = localDateKey(date);
  return reward;
}

export function claimMission(player: PlayerProgress, missionId: string): boolean {
  const mission = MISSIONS.find((entry) => entry.id === missionId);
  if (!mission || player.claimedMissions.includes(missionId) || mission.progress(player) < mission.target) return false;
  player.claimedMissions.push(missionId);
  player.coins += mission.rewardCoins;
  player.gems += mission.rewardGems;
  return true;
}

function updateStreak(player: PlayerProgress, date: Date): void {
  const today = localDateKey(date);
  if (player.lastVictoryDate === today) return;
  const previousDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  player.streak = player.lastVictoryDate === localDateKey(previousDay) ? player.streak + 1 : 1;
  player.longestStreak = Math.max(player.longestStreak, player.streak);
  player.lastVictoryDate = today;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeProgress(value: Partial<PlayerProgress>, defaults: PlayerProgress): PlayerProgress {
  return {
    ...defaults,
    ...value,
    version: 1,
    level: Math.max(1, finite(value.level, defaults.level)),
    xp: finite(value.xp, defaults.xp),
    energy: finite(value.energy, defaults.energy),
    coins: finite(value.coins, defaults.coins),
    gems: finite(value.gems, defaults.gems),
    squadPower: finite(value.squadPower, defaults.squadPower),
    stars: objectRecord(value.stars),
    bestLives: objectRecord(value.bestLives),
    highScores: objectRecord(value.highScores),
    leaderboard: Array.isArray(value.leaderboard) ? value.leaderboard.slice(0, 10) : [],
    claimedMissions: Array.isArray(value.claimedMissions) ? value.claimedMissions : [],
    settings: { ...defaults.settings, ...(value.settings ?? {}) },
  };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function objectRecord(value: unknown): Record<string, number> {
  return value && typeof value === 'object' ? value as Record<string, number> : {};
}
