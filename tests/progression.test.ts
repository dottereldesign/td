import { describe, expect, it } from 'vitest';
import { starGlyphs, starsForVictory } from '../src/progression';

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
