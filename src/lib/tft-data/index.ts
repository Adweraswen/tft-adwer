/**
 * TFT Set 17: Space Gods — data barrel.
 *
 * Re-exports everything from the tft-data package so callers can write:
 *
 *   import { CHAMPIONS, COMPS, getItem, MECHANICS } from '@/lib/tft-data';
 *
 * Counts (sourced from op.gg / metatft / tftactics for Set 17 Patch 17.x):
 *   - 63 champions  (champions.ts)
 *   - 35 traits     (traits.ts)
 *   - 45 items      (items.ts)  [9 components + 36 completed]
 *   - 42 augments   (augments.ts)
 *   - 25 meta comps (comps.ts)
 *   - Mechanics: pool sizes, shop odds (11 levels), XP table, xpPerBuy
 */
export * from './types';
export * from './champions';
export * from './traits';
export * from './items';
export * from './augments';
export * from './comps';
export * from './mechanics';
export * from './comp-traits';
