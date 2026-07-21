import type { TowerId } from '../types';

export type RenderAssetId =
  | 'grass-lush'
  | 'grass-trimmed'
  | 'concrete-light'
  | 'concrete-panel'
  | 'tower-vacuum'
  | 'tower-brush'
  | 'tower-toaster'
  | 'tower-sprayer'
  | 'terrain-rock-fern';

export const ASSET_URLS: Record<RenderAssetId, string> = {
  'grass-lush': new URL('../assets/generated/grass-lush.webp', import.meta.url).href,
  'grass-trimmed': new URL('../assets/generated/grass-trimmed.webp', import.meta.url).href,
  'concrete-light': new URL('../assets/generated/concrete-light.webp', import.meta.url).href,
  'concrete-panel': new URL('../assets/generated/concrete-panel.webp', import.meta.url).href,
  'tower-vacuum': new URL('../assets/generated/tower-vacuum.png', import.meta.url).href,
  'tower-brush': new URL('../assets/generated/tower-brush.png', import.meta.url).href,
  'tower-toaster': new URL('../assets/generated/tower-toaster.png', import.meta.url).href,
  'tower-sprayer': new URL('../assets/generated/tower-sprayer.png', import.meta.url).href,
  'terrain-rock-fern': new URL('../assets/generated/terrain-rock-fern.png', import.meta.url).href,
};

export const TOWER_SPRITE_ASSETS: Partial<Record<TowerId, RenderAssetId>> = {
  sentry: 'tower-vacuum',
  needle: 'tower-brush',
  mortar: 'tower-toaster',
  toxin: 'tower-sprayer',
};

/** Lightweight image cache: rendering remains procedural while an asset is loading or unavailable. */
export class AssetStore {
  private readonly images = new Map<RenderAssetId, HTMLImageElement>();
  private readonly failed = new Set<RenderAssetId>();

  constructor() {
    for (const [id, url] of Object.entries(ASSET_URLS) as [RenderAssetId, string][]) {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => this.failed.delete(id);
      image.onerror = () => this.failed.add(id);
      image.src = url;
      this.images.set(id, image);
    }
  }

  get(id: RenderAssetId): HTMLImageElement | null {
    const image = this.images.get(id);
    if (!image || this.failed.has(id) || !image.complete || image.naturalWidth === 0) return null;
    return image;
  }
}
