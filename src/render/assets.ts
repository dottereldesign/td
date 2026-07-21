import type { TowerId, WorldId } from '../types';

export type RenderAssetId =
  | 'terrain-ground-grass'
  | 'terrain-prop-rock-fern'
  | `terrain-path-${number}`
  | 'tower-forest-mycelium-network'
  ;

export const PATH_TILE_ASSET_IDS = Array.from(
  { length: 16 },
  (_, mask) => `terrain-path-${mask}` as RenderAssetId,
);

export const ASSET_URLS: Record<RenderAssetId, string> = {
  'terrain-ground-grass': new URL('../assets/terrain/ground/grass.webp', import.meta.url).href,
  'terrain-prop-rock-fern': new URL('../assets/terrain/props/rock-fern.png', import.meta.url).href,
  'terrain-path-0': new URL('../assets/terrain/paths/dirt/00-isolated.png', import.meta.url).href,
  'terrain-path-1': new URL('../assets/terrain/paths/dirt/01-end-north.png', import.meta.url).href,
  'terrain-path-2': new URL('../assets/terrain/paths/dirt/02-end-east.png', import.meta.url).href,
  'terrain-path-3': new URL('../assets/terrain/paths/dirt/03-corner-north-east.png', import.meta.url).href,
  'terrain-path-4': new URL('../assets/terrain/paths/dirt/04-end-south.png', import.meta.url).href,
  'terrain-path-5': new URL('../assets/terrain/paths/dirt/05-straight-vertical.png', import.meta.url).href,
  'terrain-path-6': new URL('../assets/terrain/paths/dirt/06-corner-east-south.png', import.meta.url).href,
  'terrain-path-7': new URL('../assets/terrain/paths/dirt/07-junction-t-missing-west.png', import.meta.url).href,
  'terrain-path-8': new URL('../assets/terrain/paths/dirt/08-end-west.png', import.meta.url).href,
  'terrain-path-9': new URL('../assets/terrain/paths/dirt/09-corner-north-west.png', import.meta.url).href,
  'terrain-path-10': new URL('../assets/terrain/paths/dirt/10-straight-horizontal.png', import.meta.url).href,
  'terrain-path-11': new URL('../assets/terrain/paths/dirt/11-junction-t-missing-south.png', import.meta.url).href,
  'terrain-path-12': new URL('../assets/terrain/paths/dirt/12-corner-south-west.png', import.meta.url).href,
  'terrain-path-13': new URL('../assets/terrain/paths/dirt/13-junction-t-missing-east.png', import.meta.url).href,
  'terrain-path-14': new URL('../assets/terrain/paths/dirt/14-junction-t-missing-north.png', import.meta.url).href,
  'terrain-path-15': new URL('../assets/terrain/paths/dirt/15-junction-four-way.png', import.meta.url).href,
  'tower-forest-mycelium-network': new URL('../assets/towers/worlds/forest/mycelium-network.png', import.meta.url).href,
};

const FOREST_TOWER_ASSETS: Partial<Record<TowerId, RenderAssetId>> = {
  sentry: 'tower-forest-mycelium-network',
};

export function getTowerAssetId(worldId: WorldId, towerId: TowerId): RenderAssetId | null {
  return worldId === 'forest' ? FOREST_TOWER_ASSETS[towerId] ?? null : null;
}

export function getTowerAssetUrl(worldId: WorldId, towerId: TowerId): string | null {
  const id = getTowerAssetId(worldId, towerId);
  return id ? ASSET_URLS[id] : null;
}

/** Lightweight image cache: rendering remains procedural while an asset is loading or unavailable. */
export class AssetStore {
  private readonly images = new Map<RenderAssetId, HTMLImageElement>();
  private readonly failed = new Set<RenderAssetId>();
  private loadRevision = 0;

  constructor() {
    for (const [id, url] of Object.entries(ASSET_URLS) as [RenderAssetId, string][]) {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        this.failed.delete(id);
        this.loadRevision += 1;
      };
      image.onerror = () => {
        this.failed.add(id);
        this.loadRevision += 1;
      };
      image.src = url;
      this.images.set(id, image);
    }
  }

  get(id: RenderAssetId): HTMLImageElement | null {
    const image = this.images.get(id);
    if (!image || this.failed.has(id) || !image.complete || image.naturalWidth === 0) return null;
    return image;
  }

  get revision(): number {
    return this.loadRevision;
  }
}
