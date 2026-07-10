/**
 * TFT Set 17: Space Gods — shared TypeScript types.
 *
 * These types are ported from the Python `data/` package and are tuned to
 * match the actual data shape (not the idealized shape from the task spec).
 * Where the Python source exposes a field the spec omitted, the field is
 * added. Where the spec assumed a field the Python source lacks, the field
 * is made optional.
 */

// ─── Champions ──────────────────────────────────────────────────────────────

export type ChampionRole = 'carry' | 'tank' | 'support' | 'flex';

export interface Champion {
  name: string;
  cost: 1 | 2 | 3 | 4 | 5;
  traits: string[];
  role: ChampionRole;
  ability: string;
  /** Best-in-slot recommended items (3 slots). */
  items: string[];
}

// ─── Traits ─────────────────────────────────────────────────────────────────

/**
 * The Python source tracks two orthogonal concepts for traits:
 *  - `category`: whether the trait is an Origin, Class, or Unique (5-cost).
 *  - `type`: the combat role of the trait ('AD' | 'AP' | 'Tank' | 'Utility' | 'Unique').
 * The spec merged these into one `type` field — we keep both to preserve data.
 */
export type TraitCategory = 'origin' | 'class' | 'unique';

export type TraitType = 'AD' | 'AP' | 'Tank' | 'Utility' | 'Unique';

export interface Trait {
  name: string;
  category: TraitCategory;
  type: TraitType;
  breakpoints: number[];
  desc?: string;
  /** Set to `true` for the unique 5-cost traits. */
  unique?: boolean;
}

// ─── Items ──────────────────────────────────────────────────────────────────

/**
 * Python `category` is the item's role/affinity (AD, AP, Tank, ...), NOT
 * whether it is a component vs. completed item. That distinction is held by
 * the `component` boolean. We match the Python shape exactly.
 */
export type ItemCategory =
  | 'AD'
  | 'AS'
  | 'AP'
  | 'Mana'
  | 'Tank'
  | 'Utility'
  | 'Crit'
  | 'Healing';

export interface Item {
  name: string;
  category: ItemCategory;
  /** `true` for base components, `false` for completed items. */
  component: boolean;
  tags: string[];
  /** Only present on completed items. */
  recipe?: string[];
  desc: string;
}

// ─── Augments ───────────────────────────────────────────────────────────────

export interface Augment {
  name: string;
  tier: string;
  score: number;
  tags: string[];
  desc: string;
  /** Game stage the augment is best taken in: 'early' | 'mid' | 'late' | 'flex'. */
  stage?: string;
}

// ─── Comps ──────────────────────────────────────────────────────────────────

export type CompTier = 'S' | 'A' | 'B';

export type CompPlaystyle = 'reroll' | 'rush8' | 'rush9' | 'standard';

export type CompDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface Comp {
  name: string;
  tier: CompTier;
  carry: string;
  playstyle: CompPlaystyle;
  /** Level to slow-roll / pivot at. */
  rerollLevel: number;
  core: string[];
  keyTraits: string[];
  strategy: string;
  difficulty: CompDifficulty;
  threeStarTargets: string[];
  traitBots: string[];
  winRate: number;
  avgPlace: number;
  pickRate: number;
}

// ─── Mechanics ──────────────────────────────────────────────────────────────

/** Player level → [odds for 1-cost, 2-cost, 3-cost, 4-cost, 5-cost] (percent). */
export type ShopOdds = [number, number, number, number, number];

export interface Mechanics {
  /** Copies of each champion in the shared pool, by cost tier. */
  poolSizes: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Player level → shop odds per cost tier. */
  shopOdds: Record<number, ShopOdds>;
  /** Player level → XP needed to advance to the next level. */
  xpTable: Record<number, number>;
  /** XP granted per buy (4 gold = 4 XP). */
  xpPerBuy: number;
}
