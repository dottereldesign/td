import { describe, expect, it } from 'vitest';
import { resolveUiSoundUrl } from '../src/audio';

describe('UI sound asset URLs', () => {
  it('stay inside a nested production deployment', () => {
    expect(resolveUiSoundUrl('confirm', 'magic-chimes', 'https://example.com/games/wizino/', './')).toBe(
      'https://example.com/games/wizino/audio/ui/packs/magic-chimes/confirm.ogg',
    );
  });

  it('respect an explicit application base', () => {
    expect(resolveUiSoundUrl('card', 'gentle-quest', 'https://example.com/', '/td/')).toBe(
      'https://example.com/td/audio/ui/packs/gentle-quest/card.mp3',
    );
  });
});
