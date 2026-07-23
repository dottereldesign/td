import type { TowerId, WorldId } from '../types';

export type RenderAssetId =
  | 'terrain-ground-grass'
  | 'terrain-prop-rock-fern'
  | `terrain-path-${number}`
  | 'tower-forest-mycelium-network'
  | 'tower-forest-pollinator-post'
  | 'tower-forest-canopy-guardian'
  | 'tower-forest-root-snare'
  | 'tower-forest-seed-slinger'
  | 'tower-forest-weathered-oak'
  ;

export const PATH_TILE_ASSET_IDS = Array.from(
  { length: 16 },
  (_, mask) => `terrain-path-${mask}` as RenderAssetId,
);

export const ASSET_URLS: Record<RenderAssetId, string> = {
  'terrain-ground-grass': new URL('../assets/terrain/ground/grass.webp', import.meta.url).href,
  'terrain-prop-rock-fern': new URL('../assets/terrain/props/rock-fern.webp', import.meta.url).href,
  'terrain-path-0': new URL('../assets/terrain/paths/dirt/00-isolated.webp', import.meta.url).href,
  'terrain-path-1': new URL('../assets/terrain/paths/dirt/01-end-north.webp', import.meta.url).href,
  'terrain-path-2': new URL('../assets/terrain/paths/dirt/02-end-east.webp', import.meta.url).href,
  'terrain-path-3': new URL('../assets/terrain/paths/dirt/03-corner-north-east.webp', import.meta.url).href,
  'terrain-path-4': new URL('../assets/terrain/paths/dirt/04-end-south.webp', import.meta.url).href,
  'terrain-path-5': new URL('../assets/terrain/paths/dirt/05-straight-vertical.webp', import.meta.url).href,
  'terrain-path-6': new URL('../assets/terrain/paths/dirt/06-corner-east-south.webp', import.meta.url).href,
  'terrain-path-7': new URL('../assets/terrain/paths/dirt/07-junction-t-missing-west.webp', import.meta.url).href,
  'terrain-path-8': new URL('../assets/terrain/paths/dirt/08-end-west.webp', import.meta.url).href,
  'terrain-path-9': new URL('../assets/terrain/paths/dirt/09-corner-north-west.webp', import.meta.url).href,
  'terrain-path-10': new URL('../assets/terrain/paths/dirt/10-straight-horizontal.webp', import.meta.url).href,
  'terrain-path-11': new URL('../assets/terrain/paths/dirt/11-junction-t-missing-south.webp', import.meta.url).href,
  'terrain-path-12': new URL('../assets/terrain/paths/dirt/12-corner-south-west.webp', import.meta.url).href,
  'terrain-path-13': new URL('../assets/terrain/paths/dirt/13-junction-t-missing-east.webp', import.meta.url).href,
  'terrain-path-14': new URL('../assets/terrain/paths/dirt/14-junction-t-missing-north.webp', import.meta.url).href,
  'terrain-path-15': new URL('../assets/terrain/paths/dirt/15-junction-four-way.webp', import.meta.url).href,
  'tower-forest-mycelium-network': new URL('../assets/towers/worlds/forest/mycelium-network.webp', import.meta.url).href,
  'tower-forest-pollinator-post': new URL('../assets/towers/worlds/forest/pollinator-post.webp', import.meta.url).href,
  'tower-forest-canopy-guardian': new URL('../assets/towers/worlds/forest/canopy-guardian.webp', import.meta.url).href,
  'tower-forest-root-snare': new URL('../assets/towers/worlds/forest/root-snare.webp', import.meta.url).href,
  'tower-forest-seed-slinger': new URL('../assets/towers/worlds/forest/seed-slinger.webp', import.meta.url).href,
  'tower-forest-weathered-oak': new URL('../assets/towers/worlds/forest/weathered-oak.webp', import.meta.url).href,
};

const FOREST_TOWER_ASSETS: Partial<Record<TowerId, RenderAssetId>> = {
  sentry: 'tower-forest-mycelium-network',
  needle: 'tower-forest-pollinator-post',
  mortar: 'tower-forest-canopy-guardian',
  arcanum: 'tower-forest-root-snare',
  toxin: 'tower-forest-seed-slinger',
  null: 'tower-forest-weathered-oak',
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

  get(id: RenderAssetId): HTMLImageElement | null {
    let image = this.images.get(id);
    if (!image && !this.failed.has(id)) {
      image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        this.failed.delete(id);
        this.loadRevision += 1;
      };
      image.onerror = () => {
        this.failed.add(id);
        this.loadRevision += 1;
      };
      image.src = ASSET_URLS[id];
      this.images.set(id, image);
    }
    if (!image || this.failed.has(id) || !image.complete || image.naturalWidth === 0) return null;
    return image;
  }

  get revision(): number {
    return this.loadRevision;
  }
}
