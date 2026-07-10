/**
 * TFT Set 17: Space Gods — core game mechanics.
 *
 * Ported from `data/champions.py` (POOL_SIZES, SHOP_ODDS, XP_TO_LEVEL constants
 * and the inline comment "XP cost per buy = 4 gold = 4 XP").
 *
 * The Python SHOP_ODDS is a nested dict {level: {cost: percent}}. We flatten
 * it to {level: [percent_1cost, percent_2cost, percent_3cost, percent_4cost,
 * percent_5cost]} for ergonomic array indexing.
 */
import type { Mechanics, ShopOdds } from './types';

export const MECHANICS: Mechanics = {
  // Copies of each champion in the shared pool, by cost tier (standard TFT).
  poolSizes: {
    1: 29,
    2: 22,
    3: 18,
    4: 12,
    5: 10,
  },

  // Shop odds by player level: level → [%1cost, %2cost, %3cost, %4cost, %5cost].
  shopOdds: {
    1: [100, 0, 0, 0, 0],
    2: [100, 0, 0, 0, 0],
    3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0],
    6: [30, 40, 25, 5, 0],
    7: [19, 30, 35, 15, 1],
    8: [18, 25, 36, 18, 3],
    9: [10, 20, 25, 35, 10],
    10: [5, 10, 20, 40, 25],
    11: [1, 2, 9, 30, 58],
  } as Record<number, ShopOdds>,

  // XP needed to advance from the given level to the next.
  // Source: XP_TO_LEVEL = {1:0, 2:2, 3:2, 4:6, 5:10, 6:20, 7:36, 8:56, 9:80, 10:84}
  xpTable: {
    1: 0,
    2: 2,
    3: 2,
    4: 6,
    5: 10,
    6: 20,
    7: 36,
    8: 56,
    9: 80,
    10: 84,
  },

  // XP cost per buy = 4 gold = 4 XP (per the Python source comment).
  xpPerBuy: 4,
};

// ─── Convenience re-exports ─────────────────────────────────────────────────

export const POOL_SIZES = MECHANICS.poolSizes;
export const SHOP_ODDS = MECHANICS.shopOdds;
export const XP_TABLE = MECHANICS.xpTable;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * XP required to advance from the given level to the next.
 * Falls back to 84 (the largest known value) for out-of-range inputs.
 */
export function xpForLevel(level: number): number {
  return XP_TABLE[level] ?? 84;
}

/**
 * Shop odds for the given player level, as a 5-tuple.
 * Falls back to all-zeros for out-of-range inputs.
 */
export function shopOddsForLevel(level: number): ShopOdds {
  return SHOP_ODDS[level] ?? ([0, 0, 0, 0, 0] as ShopOdds);
}

/**
 * The chance (0..1) of rolling a champion of the given cost at the given level.
 * `cost` must be 1..5.
 */
export function rollChance(level: number, cost: 1 | 2 | 3 | 4 | 5): number {
  const odds = shopOddsForLevel(level);
  return (odds[cost - 1] ?? 0) / 100;
}

/**
 * Total copies of a champion of the given cost that exist in the shared pool.
 * Useful for "how many are left" calculations.
 */
export function poolForCost(cost: 1 | 2 | 3 | 4 | 5): number {
  return POOL_SIZES[cost] ?? 0;
}

/**
 * Gold cost of buying enough XP to advance from `level` to `level + 1`.
 * Returns 0 if the level is at or past the cap (10), and -1 for invalid input.
 */
export function goldToNextLevel(level: number): number {
  if (level < 1 || level >= 10) return 0;
  const xpNeeded = xpForLevel(level);
  if (xpNeeded <= 0) return 0;
  const buys = Math.ceil(xpNeeded / MECHANICS.xpPerBuy);
  return buys * 4; // 4 gold per buy
}
