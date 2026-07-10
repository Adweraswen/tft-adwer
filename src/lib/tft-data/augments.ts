/**
 * TFT Set 17: Space Gods — augment data.
 *
 * Ported 1:1 from `data/game_data.py` AUGMENTS list, plus additional Set 17
 * augments added for VLM recognition coverage.
 *
 * Each augment has: name, tier (S/S-/A+/A/A-/B+/B/B-/C), score (0-100 power
 * rating), tags, desc, and a `stage` field indicating the game phase the
 * augment is best taken in ('early' | 'mid' | 'late' | 'flex').
 *
 * Augment order in the source file is the priority ranking — index 0 is the
 * strongest overall augment. That order is preserved here.
 */
import type { Augment } from './types';

export const AUGMENTS: Augment[] = [
  {
    name: 'Stand United',
    tier: 'S',
    score: 91,
    tags: ['AP', 'AD', 'late'],
    desc: 'Team gains bonus AP & AD per unique active trait.',
    stage: 'late',
  },
  {
    name: 'Last Stand',
    tier: 'S',
    score: 90,
    tags: ['comeback', 'late'],
    desc: 'Below 30% HP, team gains massive bonus damage.',
    stage: 'late',
  },
  {
    name: 'Blue Battery',
    tier: 'S',
    score: 88,
    tags: ['AP', 'mana'],
    desc: 'After casting, gain 10 bonus mana.',
    stage: 'flex',
  },
  {
    name: 'Titanic Force',
    tier: 'S-',
    score: 87,
    tags: ['Tank', 'AD'],
    desc: 'Frontline gains stacking HP & AD based on max HP.',
    stage: 'flex',
  },
  {
    name: 'Jeweled Lotus',
    tier: 'S-',
    score: 86,
    tags: ['AP', 'crit'],
    desc: 'Abilities can crit. +20% crit damage.',
    stage: 'flex',
  },
  {
    name: 'Portable Forge',
    tier: 'A+',
    score: 85,
    tags: ['items'],
    desc: 'Gain an Anvil to craft any completed item.',
    stage: 'early',
  },
  {
    name: 'Rich Get Richer',
    tier: 'A',
    score: 84,
    tags: ['econ', 'early'],
    desc: 'Gain 10 gold. Interest cap raised to 6.',
    stage: 'early',
  },
  {
    name: 'Spellblade',
    tier: 'A+',
    score: 83,
    tags: ['AP', 'AD', 'hybrid'],
    desc: 'Casting grants bonus AD and AP.',
    stage: 'flex',
  },
  {
    name: 'Sunfire Board',
    tier: 'A-',
    score: 82,
    tags: ['HP', 'burn', 'early'],
    desc: 'Board deals burn damage to nearby enemies.',
    stage: 'early',
  },
  {
    name: "Knife's Edge",
    tier: 'A',
    score: 81,
    tags: ['AD', 'frontline'],
    desc: 'Units adjacent to frontline gain bonus AD & AP.',
    stage: 'flex',
  },
  {
    name: 'Component Grab Bag',
    tier: 'A',
    score: 80,
    tags: ['items', 'early'],
    desc: 'Gain 3 random item components.',
    stage: 'early',
  },
  {
    name: 'Cybernetic Leech',
    tier: 'A-',
    score: 79,
    tags: ['Tank', 'sustain'],
    desc: 'Units with full items heal 12% of damage dealt.',
    stage: 'flex',
  },
  {
    name: 'Winnings',
    tier: 'A-',
    score: 77,
    tags: ['econ', 'streak'],
    desc: 'Gain gold equal to win streak each round.',
    stage: 'flex',
  },
  {
    name: 'First Aid Kit',
    tier: 'B+',
    score: 78,
    tags: ['healing', 'sustain'],
    desc: 'Team heals 5% max HP each round.',
    stage: 'flex',
  },
  {
    name: 'Meditation',
    tier: 'B+',
    score: 75,
    tags: ['AP', 'mana'],
    desc: 'Units without items gain 40% mana regen.',
    stage: 'early',
  },
  {
    name: 'Cybernetic Bulk',
    tier: 'B+',
    score: 72,
    tags: ['Tank', 'HP'],
    desc: 'Units with full items gain 250 HP.',
    stage: 'flex',
  },
  {
    name: "Urf's Grab Bag",
    tier: 'A',
    score: 80,
    tags: ['items'],
    desc: 'Gain 3 random completed Emblems.',
    stage: 'mid',
  },
  {
    name: 'Scoped Weapons',
    tier: 'B',
    score: 70,
    tags: ['AD', 'backline'],
    desc: 'Snipers gain bonus range and damage.',
    stage: 'flex',
  },
  {
    name: 'Tiny Power',
    tier: 'B',
    score: 68,
    tags: ['AD', 'early'],
    desc: '1-2 cost units gain 25% bonus AD & AP.',
    stage: 'early',
  },
  {
    name: 'Nourish',
    tier: 'B',
    score: 69,
    tags: ['healing', 'econ'],
    desc: 'Gain 5 gold. Team gains stacking HP each round.',
    stage: 'early',
  },
  {
    name: "Realm's Blessing",
    tier: 'S-',
    score: 86,
    tags: ['Utility', 'celestial'],
    desc: 'Gain God Blessed empowered hex. Celestial boons.',
    stage: 'mid',
  },
  {
    name: 'Galactic Vault',
    tier: 'A+',
    score: 84,
    tags: ['econ', 'items'],
    desc: 'Galactic Vault with gold, items, and a 4-cost unit.',
    stage: 'mid',
  },
  {
    name: 'Starforged',
    tier: 'A',
    score: 82,
    tags: ['AP', 'celestial'],
    desc: 'Stargazer calls an additional star each round.',
    stage: 'flex',
  },
  {
    name: 'Void Conduit',
    tier: 'B+',
    score: 76,
    tags: ['mana', 'AP'],
    desc: 'Conduit grants double mana to nearby allies.',
    stage: 'flex',
  },
  {
    name: 'Mecha Overdrive',
    tier: 'A-',
    score: 81,
    tags: ['Tank', 'AD'],
    desc: 'Mecha gains bonus stats, transforms faster.',
    stage: 'flex',
  },
  {
    name: 'Celestial Fortune',
    tier: 'S',
    score: 89,
    tags: ['econ', 'celestial'],
    desc: 'Gain 1 gold each time a unit casts ability.',
    stage: 'flex',
  },
  {
    name: 'Godhand',
    tier: 'S-',
    score: 87,
    tags: ['AP', 'celestial'],
    desc: 'Lowest-HP unit invulnerable 2s, once per combat.',
    stage: 'flex',
  },
  {
    name: 'Anima Pact',
    tier: 'A+',
    score: 84,
    tags: ['Utility', 'econ'],
    desc: 'Anima grants double Tech. On win, gain 8 gold.',
    stage: 'flex',
  },
  {
    name: "Sniper's Mark",
    tier: 'A+',
    score: 83,
    tags: ['AD', 'carry'],
    desc: 'Snipers +30% damage to targets below 50% HP.',
    stage: 'flex',
  },
  {
    name: "Rogue's Edge",
    tier: 'A',
    score: 80,
    tags: ['AD', 'rogue'],
    desc: 'Rogues start with 30% max HP shield.',
    stage: 'flex',
  },
  {
    name: "Brawler's Heart",
    tier: 'A',
    score: 79,
    tags: ['Tank', 'HP'],
    desc: 'Brawlers +250 HP. Team +100 max HP.',
    stage: 'flex',
  },
  {
    name: 'Arcane Resonance',
    tier: 'A-',
    score: 78,
    tags: ['AP', 'mana'],
    desc: 'Conduit grants 50% more mana to allies.',
    stage: 'flex',
  },
  {
    name: 'Vanguard Phalanx',
    tier: 'A-',
    score: 77,
    tags: ['Tank', 'shield'],
    desc: 'Vanguards +40% shields, persist 2s longer.',
    stage: 'flex',
  },
  {
    name: "Stargazer's Vision",
    tier: 'A',
    score: 80,
    tags: ['AP', 'celestial'],
    desc: 'Stargazer stars +50% damage, slow targets.',
    stage: 'flex',
  },
  {
    name: 'Dark Star Ascendant',
    tier: 'A',
    score: 81,
    tags: ['AP', 'scaling'],
    desc: 'Dark Star bonus AP on death doubled.',
    stage: 'flex',
  },
  {
    name: "Challenger's Fury",
    tier: 'A',
    score: 80,
    tags: ['AD', 'AS'],
    desc: 'Challenger AS ramp doubles on takedown.',
    stage: 'flex',
  },
  {
    name: 'Psionic Mind',
    tier: 'A-',
    score: 79,
    tags: ['AP', 'true'],
    desc: 'Psionic true damage 15% (from 10%).',
    stage: 'flex',
  },
  {
    name: 'Replicator Hive',
    tier: 'A',
    score: 80,
    tags: ['AP', 'summon'],
    desc: 'Swarmlings +30% HP & AS. Spawn 2 extra.',
    stage: 'flex',
  },
  {
    name: 'Galactic Forge',
    tier: 'A+',
    score: 84,
    tags: ['items', 'celestial'],
    desc: 'Completed item + God Blessed empowered hex.',
    stage: 'mid',
  },
  {
    name: 'Cosmic Alignment',
    tier: 'S-',
    score: 86,
    tags: ['AP', 'AD', 'celestial'],
    desc: 'Team +15 AP & +15% AD. Doubles at stage 4+.',
    stage: 'flex',
  },
  {
    name: 'Stardust',
    tier: 'A-',
    score: 78,
    tags: ['AP', 'celestial'],
    desc: 'Strongest unit +5 AP permanently each round.',
    stage: 'flex',
  },
  {
    name: "Eradicator's Wrath",
    tier: 'S-',
    score: 87,
    tags: ['AD', 'celestial'],
    desc: 'Eradicator executes +50% damage. 4th shot crits.',
    stage: 'flex',
  },
  // ─── Additional Set 17 augments (VLM recognition coverage) ──────────────
  {
    name: 'Cybernetic Uplink',
    tier: 'A',
    score: 80,
    tags: ['AP', 'AD', 'items'],
    desc: 'Units with full items gain bonus AD & AP.',
    stage: 'flex',
  },
  {
    name: 'Gadget Expert',
    tier: 'A',
    score: 79,
    tags: ['AP', 'AD'],
    desc: 'Team gains bonus AD & AP scaling with stage.',
    stage: 'flex',
  },
  {
    name: 'Metamorphosis',
    tier: 'A-',
    score: 78,
    tags: ['Tank', 'HP'],
    desc: 'Units gain stacking HP every 5 seconds in combat.',
    stage: 'flex',
  },
  {
    name: 'Electrocharge',
    tier: 'B+',
    score: 74,
    tags: ['AP', 'chain'],
    desc: 'Being hit chains lightning to nearby enemies.',
    stage: 'flex',
  },
  {
    name: 'Shadow Mantle',
    tier: 'B+',
    score: 73,
    tags: ['Tank', 'stealth'],
    desc: 'Rogues gain stealth for 3s at combat start.',
    stage: 'flex',
  },
  {
    name: 'Overcharger',
    tier: 'B',
    score: 71,
    tags: ['mana', 'AP'],
    desc: 'Casting refunds 5 mana on takedown.',
    stage: 'flex',
  },
  {
    name: 'Lucky Gloves',
    tier: 'A-',
    score: 77,
    tags: ['items', 'econ'],
    desc: 'Gain a random completed item each round.',
    stage: 'mid',
  },
  {
    name: 'Golden Vault',
    tier: 'S-',
    score: 86,
    tags: ['econ', 'celestial'],
    desc: 'Interest cap raised to 7. Gain 15 gold.',
    stage: 'early',
  },
  {
    name: 'Phoenix Flame',
    tier: 'A',
    score: 80,
    tags: ['AP', 'burn'],
    desc: 'On death, unit explodes dealing magic damage.',
    stage: 'flex',
  },
  {
    name: 'Temporal Flux',
    tier: 'A-',
    score: 78,
    tags: ['AP', 'mana', 'celestial'],
    desc: 'Timebreaker slows enemy ability casts by 20%.',
    stage: 'flex',
  },
  {
    name: 'Voyager Compass',
    tier: 'A',
    score: 81,
    tags: ['econ', 'celestial'],
    desc: 'Voyager grants bonus gold on voyage return.',
    stage: 'flex',
  },
  {
    name: 'Meeple March',
    tier: 'B+',
    score: 75,
    tags: ['AD', 'summon'],
    desc: 'Meeple units gain 20% AS. Spawn 1 extra Meeple.',
    stage: 'flex',
  },
  {
    name: 'Nova Surge',
    tier: 'A+',
    score: 83,
    tags: ['AP', 'celestial'],
    desc: 'Nova units +30% ability damage on first cast.',
    stage: 'flex',
  },
  {
    name: 'Primordian Tide',
    tier: 'A-',
    score: 78,
    tags: ['Tank', 'shield'],
    desc: 'Primordian shields 40% stronger, persist 3s.',
    stage: 'flex',
  },
];

/**
 * Name → Augment lookup (case-insensitive, keys stored lowercase).
 * Use `lookupAugment(name)` for the recommended fuzzy-aware lookup.
 */
export const AUGMENT_MAP: Record<string, Augment> = Object.fromEntries(
  AUGMENTS.map((a) => [a.name.toLowerCase(), a]),
);

/** Augment tier → hex color for UI display. */
export const AUGMENT_TIER_COLORS: Record<string, string> = {
  S: '#f59e0b',
  'S-': '#fbbf24',
  'A+': '#a855f7',
  A: '#a855f7',
  'A-': '#c084fc',
  'B+': '#3b82f6',
  B: '#3b82f6',
  'B-': '#60a5fa',
  C: '#9ca3af',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Lookup an augment by name with fuzzy fallback.
 * Tries exact (case-insensitive) first, then partial substring match.
 * Returns undefined if nothing matches.
 */
export function lookupAugment(name: string): Augment | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  // 1. Exact (case-insensitive) via map
  if (AUGMENT_MAP[lower]) return AUGMENT_MAP[lower];
  // 2. Substring match (either direction) — handles "Cyber Uplink" → "Cybernetic Uplink"
  for (const a of AUGMENTS) {
    const al = a.name.toLowerCase();
    if (al.includes(lower) || lower.includes(al)) return a;
  }
  // 3. Word-token overlap (e.g. "Uplink Cybernetic" → "Cybernetic Uplink")
  const tokens = lower.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length > 0) {
    let best: { aug: Augment; score: number } | undefined;
    for (const a of AUGMENTS) {
      const al = a.name.toLowerCase();
      const overlap = tokens.filter((t) => al.includes(t)).length;
      if (overlap > 0 && (!best || overlap > best.score)) {
        best = { aug: a, score: overlap };
      }
    }
    if (best) return best.aug;
  }
  return undefined;
}

/** Get an augment by name (case-insensitive). Kept for backward compat. */
export function getAugment(name: string): Augment | undefined {
  return lookupAugment(name);
}

/** Return all augments of the given tier (e.g. 'S', 'A+'). */
export function getAugmentsByTier(tier: string): Augment[] {
  return AUGMENTS.filter((a) => a.tier === tier);
}

/** Return augments sorted by score, descending. */
export function getTopAugments(limit = 10): Augment[] {
  return [...AUGMENTS].sort((a, b) => b.score - a.score).slice(0, limit);
}
