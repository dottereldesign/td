import type { WorldId } from './types';

export const HOME_PANEL_ART = {
  summerEvent: new URL('./assets/home/panels/summer-event.webp', import.meta.url).href,
  squad: new URL('./assets/home/panels/squad.webp', import.meta.url).href,
} as const;

/** Static URLs let Vite fingerprint and include world artwork in production. */
export const HOME_WORLD_ART: Record<WorldId, string> = {
  forest: new URL('./assets/home/worlds/forest.webp', import.meta.url).href,
  workshop: new URL('./assets/home/worlds/workshop.webp', import.meta.url).href,
  word: new URL('./assets/home/worlds/word.webp', import.meta.url).href,
  number: new URL('./assets/home/worlds/number.webp', import.meta.url).href,
  space: new URL('./assets/home/worlds/space.webp', import.meta.url).href,
  music: new URL('./assets/home/worlds/music.webp', import.meta.url).href,
};
