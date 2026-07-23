/** Static URLs let Vite fingerprint and include collection artwork in production. */
export const STARTER_CARD_ART = {
  'verdant-webkeeper': new URL('./assets/cards/starters/verdant-webkeeper.webp', import.meta.url).href,
  'fulcrum-forgeback': new URL('./assets/cards/starters/fulcrum-forgeback.webp', import.meta.url).href,
  'runequill-griffin': new URL('./assets/cards/starters/runequill-griffin.webp', import.meta.url).href,
  'sequence-sprite': new URL('./assets/cards/starters/sequence-sprite.webp', import.meta.url).href,
} as const;

export const COLLECTION_CARD_BACK = new URL(
  './assets/cards/starters/enchanted-card-back.webp',
  import.meta.url,
).href;
