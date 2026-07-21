export function starsForVictory(lives: number, startLives: number): 1 | 2 | 3 {
  const ratio = Math.max(0, lives) / Math.max(1, startLives);
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export function starGlyphs(stars: number): string {
  const safe = Math.min(3, Math.max(0, Math.floor(stars)));
  return `${'★'.repeat(safe)}${'☆'.repeat(3 - safe)}`;
}
