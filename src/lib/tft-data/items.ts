/**
 * TFT Set 17: Space Gods — item data.
 *
 * 9 base components + 27 completed items = 36 total (Spatula emblems excluded,
 * they are trait-specific and shown in the trait UI).
 *
 * Sourced from in-game data (Patch 17.x). Recipe pairs verified against
 * TFT standard combining rules.
 *
 * Notes:
 *  - `category` is the item's role/affinity (AD | AS | AP | Mana | Tank |
 *    Utility | Crit | Healing) — NOT component-vs-completed.
 *  - `recipe` is only present on completed items.
 */
import type { Item, ItemCategory } from './types';

export const ITEMS: Item[] = [
  // ─── Components (9) ───────────────────────────────────────────────────────
  { name: 'B.F. Sword',          category: 'AD',       component: true,  tags: ['AD'],         desc: '+10 Attack Damage' },
  { name: 'Recurve Bow',         category: 'AS',       component: true,  tags: ['AS'],         desc: '+15% Attack Speed' },
  { name: 'Needlessly Large Rod',category: 'AP',       component: true,  tags: ['AP'],         desc: '+20 Ability Power' },
  { name: 'Tear of the Goddess', category: 'Mana',     component: true,  tags: ['mana'],       desc: '+15 Starting Mana, +15 Max Mana' },
  { name: 'Chain Vest',          category: 'Tank',     component: true,  tags: ['armor'],      desc: '+20 Armor' },
  { name: 'Negatron Cloak',      category: 'Tank',     component: true,  tags: ['MR'],         desc: '+20 Magic Resist' },
  { name: "Giant's Belt",        category: 'Tank',     component: true,  tags: ['HP'],         desc: '+150 Health' },
  { name: 'Spatula',             category: 'Utility',  component: true,  tags: ['trait'],      desc: "Craft Emblems (trait items). It's on the menu!" },
  { name: 'Glove',               category: 'Crit',     component: true,  tags: ['crit'],       desc: '+15% Crit Chance & +15% Dodge' },

  // ─── Completed — B.F. Sword tree (8) ─────────────────────────────────────
  { name: 'Deathblade', category: 'AD', component: false, tags: ['AD', 'stacking'], recipe: ['B.F. Sword', 'B.F. Sword'], desc: '+55% AD. Killing a champion grants +10 AD (stacks, max +60 AD)' },
  { name: 'Giant Slayer', category: 'AD', component: false, tags: ['AD', 'scaling'], recipe: ['B.F. Sword', 'Recurve Bow'], desc: '+30% AD, +20% AS. Attacks deal +25% damage to high-HP targets' },
  { name: 'Hextech Gunblade', category: 'Healing', component: false, tags: ['AD', 'AP', 'healing'], recipe: ['B.F. Sword', 'Needlessly Large Rod'], desc: '+20% AD, +20 AP. Heal for 25% of damage dealt' },
  { name: 'Spear of Shojin', category: 'Mana', component: false, tags: ['mana', 'AD'], recipe: ['B.F. Sword', 'Tear of the Goddess'], desc: '+20% AD, +15 Mana. After casting, gain 25 mana over 3s' },
  { name: 'Edge of Night', category: 'Utility', component: false, tags: ['AD', 'shield', 'CC'], recipe: ['B.F. Sword', 'Chain Vest'], desc: '+20% AD, +20 Armor. Below 50% HP: gain 300-700 shield + CC immune for 1.5s' },
  { name: 'Bloodthirster', category: 'Healing', component: false, tags: ['AD', 'healing', 'shield'], recipe: ['B.F. Sword', 'Negatron Cloak'], desc: '+30% AD, +20 MR. Heal 25% of damage. Overheal becomes shield' },
  { name: "Sterak's Gage", category: 'Tank', component: false, tags: ['HP', 'shield', 'AD'], recipe: ['B.F. Sword', "Giant's Belt"], desc: '+20% AD, +150 HP. Below 50% HP: gain 300-800 shield for 4s' },
  { name: 'Infinity Edge', category: 'Crit', component: false, tags: ['crit', 'AD', 'carry'], recipe: ['B.F. Sword', 'Glove'], desc: '+55% AD, +20% Crit. Crits deal 175% damage' },

  // ─── Completed — Recurve Bow tree (7) ────────────────────────────────────
  { name: 'Rapid Firecannon', category: 'AS', component: false, tags: ['AS', 'range'], recipe: ['Recurve Bow', 'Recurve Bow'], desc: '+40% AS. Attacks have +1 range, never miss' },
  { name: "Guinsoo's Rageblade", category: 'AS', component: false, tags: ['AS', 'stacking'], recipe: ['Recurve Bow', 'Needlessly Large Rod'], desc: '+20% AS, +20 AP. Attacks gain 5% AS (stacks infinitely)' },
  { name: 'Statikk Shiv', category: 'AS', component: false, tags: ['AS', 'magic', 'AoE'], recipe: ['Recurve Bow', 'Tear of the Goddess'], desc: '+20% AS, +15 Mana. Every 3rd attack chains lightning (magic dmg)' },
  { name: "Titan's Resolve", category: 'Tank', component: false, tags: ['armor', 'stacking', 'AD'], recipe: ['Recurve Bow', 'Chain Vest'], desc: '+20% AS, +20 Armor. Stack 1 AD/AP & 2 Armor/MR per hit (max 25)' },
  { name: "Runaan's Hurricane", category: 'AS', component: false, tags: ['AS', 'AoE'], recipe: ['Recurve Bow', 'Negatron Cloak'], desc: '+20% AS, +20 MR. Attacks fire 2 extra bolts at 75% damage' },
  { name: "Zeke's Herald", category: 'AS', component: false, tags: ['AS', 'aura'], recipe: ['Recurve Bow', "Giant's Belt"], desc: '+20% AS, +150 HP. Adjacent allies gain 30% AS at combat start' },
  { name: 'Last Whisper', category: 'AD', component: false, tags: ['AD', 'armorPen'], recipe: ['Recurve Bow', 'Glove'], desc: '+20% AS, +15% Crit. Attacks shred 30% armor for 3s' },

  // ─── Completed — Needlessly Large Rod tree (6) ───────────────────────────
  { name: "Rabadon's Deathcap", category: 'AP', component: false, tags: ['AP', 'carry'], recipe: ['Needlessly Large Rod', 'Needlessly Large Rod'], desc: '+70 AP. +40% total AP' },
  { name: "Archangel's Staff", category: 'AP', component: false, tags: ['AP', 'mana', 'stacking'], recipe: ['Needlessly Large Rod', 'Tear of the Goddess'], desc: '+20 AP, +15 Mana. +20 max mana each cast (max +100, then +AP)' },
  { name: 'Locket of the Iron Solari', category: 'Utility', component: false, tags: ['shield', 'aura'], recipe: ['Needlessly Large Rod', 'Chain Vest'], desc: '+20 AP, +20 Armor. Adjacent allies gain 200-700 shield at combat start' },
  { name: 'Morellonomicon', category: 'AP', component: false, tags: ['AP', 'burn', 'healingReduction'], recipe: ['Needlessly Large Rod', 'Negatron Cloak'], desc: '+20 AP, +20 MR. Magic damage applies burn & Grievous Wounds' },
  { name: "Nashor's Tooth", category: 'AS', component: false, tags: ['AS', 'AP'], recipe: ['Needlessly Large Rod', "Giant's Belt"], desc: '+20 AP, +20% AS, +150 HP. Attacks deal bonus magic damage' },
  { name: 'Jeweled Gauntlet', category: 'AP', component: false, tags: ['AP', 'crit'], recipe: ['Needlessly Large Rod', 'Glove'], desc: '+20 AP, +15% Crit. Abilities can crit (175%)' },

  // ─── Completed — Tear of the Goddess tree (5) ────────────────────────────
  { name: 'Blue Buff', category: 'Mana', component: false, tags: ['mana', 'AP'], recipe: ['Tear of the Goddess', 'Tear of the Goddess'], desc: '+30 Mana. After casting, set mana to 20' },
  { name: 'Frozen Heart', category: 'Tank', component: false, tags: ['armor', 'mana', 'aura'], recipe: ['Tear of the Goddess', 'Chain Vest'], desc: '+15 Mana, +20 Armor. Adjacent enemies lose 30% AS' },
  { name: 'Chalice of Power', category: 'Utility', component: false, tags: ['mana', 'MR', 'aura'], recipe: ['Tear of the Goddess', 'Negatron Cloak'], desc: '+15 Mana, +20 MR. Adjacent allies gain 25 AP & 25 AD at combat start' },
  { name: 'Redemption', category: 'Healing', component: false, tags: ['HP', 'mana', 'heal'], recipe: ['Tear of the Goddess', "Giant's Belt"], desc: '+15 Mana, +150 HP. At 60% HP: heal allies for 700-1500 over 3s' },
  { name: 'Hand of Justice', category: 'Utility', component: false, tags: ['AD', 'AP', 'healing'], recipe: ['Tear of the Goddess', 'Glove'], desc: '+15 AD & AP, +15% Crit. Each round: +15% damage OR heal 15%' },

  // ─── Completed — Chain Vest tree (4) ─────────────────────────────────────
  { name: 'Bramble Vest', category: 'Tank', component: false, tags: ['armor', 'reflect'], recipe: ['Chain Vest', 'Chain Vest'], desc: '+40 Armor. Negates bonus crit damage. Reflect 80% mitigated AD' },
  { name: 'Gargoyle Stoneplate', category: 'Tank', component: false, tags: ['armor', 'MR', 'stacking'], recipe: ['Chain Vest', 'Negatron Cloak'], desc: '+20 Armor, +20 MR. +18 Armor & MR per enemy targeting you' },
  { name: 'Sunfire Cape', category: 'Tank', component: false, tags: ['armor', 'HP', 'burn'], recipe: ['Chain Vest', "Giant's Belt"], desc: '+20 Armor, +150 HP. Burn nearby enemies (magic damage + GW)' },
  { name: 'Steadfast Heart', category: 'Tank', component: false, tags: ['armor', 'crit', 'shield'], recipe: ['Chain Vest', 'Glove'], desc: '+20 Armor, +15% Crit. Every 3s: gain 200-500 shield' },

  // ─── Completed — Negatron Cloak tree (3) ─────────────────────────────────
  { name: "Dragon's Claw", category: 'Tank', component: false, tags: ['MR', 'healing'], recipe: ['Negatron Cloak', 'Negatron Cloak'], desc: '+60 MR. -50% magic damage. Heal 6% max HP on cast' },
  { name: "Zz'Rot Portal", category: 'Utility', component: false, tags: ['HP', 'MR', 'taunt'], recipe: ['Negatron Cloak', "Giant's Belt"], desc: '+20 MR, +150 HP. Spawn a taunting voidling that decays' },
  { name: 'Ionic Spark', category: 'AP', component: false, tags: ['AP', 'MR', 'magic'], recipe: ['Negatron Cloak', 'Glove'], desc: '+20 MR, +15% Crit. Enemies casting take 200-1000 magic damage' },

  // ─── Completed — Giant's Belt tree (2) ───────────────────────────────────
  { name: "Warmog's Armor", category: 'Tank', component: false, tags: ['HP', 'regen'], recipe: ["Giant's Belt", "Giant's Belt"], desc: '+600 HP. Regen 4% max HP/s' },
  { name: 'Quicksilver', category: 'Utility', component: false, tags: ['HP', 'crit', 'CC'], recipe: ["Giant's Belt", 'Glove'], desc: '+150 HP, +15% Crit. Immune to CC for first 15s of combat' },

  // ─── Completed — Glove tree (1) ──────────────────────────────────────────
  { name: "Thief's Gloves", category: 'Utility', component: false, tags: ['AD', 'AP', 'AS', 'random'], recipe: ['Glove', 'Glove'], desc: '+15% Crit, +15% Dodge. Equipped champ gets 2 random items each round' },
];

/** Name → Item lookup. */
export const ITEM_MAP: Record<string, Item> = Object.fromEntries(
  ITEMS.map((i) => [i.name, i]),
);

// ─── Derived lists / helpers ────────────────────────────────────────────────

/** All 9 base components (B.F. Sword, Recurve Bow, ...). */
export const COMPONENT_ITEMS: Item[] = ITEMS.filter((i) => i.component);

/** All completed items (everything that is not a base component). */
export const COMPLETED_ITEMS: Item[] = ITEMS.filter((i) => !i.component);

/** Items grouped by category for UI filtering. */
export const ITEMS_BY_CATEGORY: Record<ItemCategory, Item[]> = ITEMS.reduce(
  (acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  },
  {} as Record<ItemCategory, Item[]>,
);

/** Look up an item by name (case-insensitive). */
export function getItem(name: string): Item | undefined {
  return ITEMS.find((i) => i.name.toLowerCase() === name.toLowerCase());
}

/** Returns the two-component recipe of a completed item, or `undefined` for components. */
export function getRecipe(name: string): string[] | undefined {
  return getItem(name)?.recipe;
}

/** Returns all completed items that use the given component in their recipe. */
export function getItemsUsingComponent(component: string): Item[] {
  const c = component.toLowerCase();
  return COMPLETED_ITEMS.filter((i) =>
    i.recipe?.some((r) => r.toLowerCase() === c),
  );
}

/** Returns the completed item made from two components, if it exists. */
export function combineItems(a: string, b: string): Item | undefined {
  return COMPLETED_ITEMS.find((i) => {
    if (!i.recipe || i.recipe.length !== 2) return false;
    const [r1, r2] = i.recipe;
    return (
      (r1.toLowerCase() === a.toLowerCase() && r2.toLowerCase() === b.toLowerCase()) ||
      (r2.toLowerCase() === a.toLowerCase() && r1.toLowerCase() === b.toLowerCase())
    );
  });
}
