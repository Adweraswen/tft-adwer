/**
 * TFT Set 17: Space Gods — comp trait activation calculator.
 *
 * Given a comp's `core` roster, computes how many of each trait are present,
 * which breakpoints are active, and what the next target breakpoint is.
 * Used by the comp detail modal to show "Galaxy Hunter 1/1 · Marauder 4/6"
 * style activation summaries so players can see exactly how many of each
 * trait a comp fields at a glance.
 *
 * Set 17 mechanic notes:
 *   - **Mecha transform**: a transformed Mecha ("The Mighty Mech") counts
 *     TWICE for the Mecha trait. The comp data already assumes a transform
 *     where needed (so keyTraits includes Mecha when the roster + transform
 *     hits a breakpoint). To stay truthful to the on-board roster we still
 *     report the raw champion count, but we expose `mechaTransformAssumed`
 *     so the UI can annotate "2 +1 transform = 3".
 *   - **Miss Fortune "Choose Trait"**: her second trait is player-chosen
 *     (Conduit / Challenger / Replicator). The `Choose Trait` placeholder
 *     is skipped; the chosen class trait is reported only if the comp data
 *     lists another champion that supplies it.
 *   - **Galaxy Hunter Zed**: only via the "Invader Zed" augment — Zed's
 *     roster presence is real, no special handling needed.
 */
import type { Comp, TraitCategory } from './types';
import { getChampion } from './champions';
import { getTrait } from './traits';

export interface CompTraitInfo {
  name: string;
  /** Raw number of core champions with this trait. */
  count: number;
  /** All breakpoints defined for the trait, ascending. */
  breakpoints: number[];
  /** Highest breakpoint reached (count >= breakpoint). 0 if none active. */
  activeBreakpoint: number;
  /** Next breakpoint not yet reached. Undefined if count is at/above the max. */
  nextBreakpoint?: number;
  /** True if this trait is in the comp's `keyTraits` list. */
  isKeyTrait: boolean;
  /** True for unique 5-cost / special traits (breakpoints [1], category 'unique'). */
  isUnique: boolean;
  /** Trait category: origin | class | unique. */
  category: TraitCategory;
  /** True when a Mecha transform is assumed to bump the count (see header). */
  mechaTransformAssumed?: boolean;
  /** Augment/game-start choice required to field this trait (e.g. Galaxy Hunter needs Invader Zed augment). */
  requirement?: TraitRequirement;
}

export interface TraitRequirement {
  /** 'augment' = obtained via an augment; 'choice' = player picks at game start. */
  type: 'augment' | 'choice';
  /** Short human-readable note, e.g. "Invader Zed augment". */
  note: string;
}

/**
 * Traits that are NOT fielded by simply buying a champion — they require an
 * augment or a game-start choice. Surfaced in the comp detail UI so players
 * know which keyTraits have an extra gating requirement.
 */
const TRAIT_REQUIREMENTS: Record<string, TraitRequirement> = {
  'Galaxy Hunter': {
    type: 'augment',
    note: 'Invader Zed augment',
  },
  'Gun Goddess': {
    type: 'choice',
    note: 'MF mode seçimi (oyun başı)',
  },
};

/**
 * Compute all trait activations for a comp's core roster.
 *
 * Returns a sorted array: active traits first (active breakpoint desc),
 * then key traits, then by count desc. Traits with 0 active breakpoint
 * (sub-breakpoint) are still included so the UI can show "1/2" progress.
 */
export function computeCompTraits(comp: Comp): CompTraitInfo[] {
  // 1. Aggregate raw trait counts from core champions.
  const traitCounts = new Map<string, number>();
  for (const championName of comp.core) {
    const ch = getChampion(championName);
    if (!ch) continue;
    for (const trait of ch.traits) {
      // Skip Miss Fortune's placeholder second trait.
      if (trait === 'Choose Trait') continue;
      traitCounts.set(trait, (traitCounts.get(trait) ?? 0) + 1);
    }
  }

  // 2. Detect assumed Mecha transform: comp keyTraits includes Mecha AND
  //    the raw champion count is below the smallest keyTrait-relevant
  //    breakpoint but would hit it with a +1 transform. We flag this so
  //    the UI can annotate. We only flag when Mecha is a keyTrait AND
  //    raw count >= 2 (you need at least 2 Mecha units to transform one).
  const mechaIsKey = comp.keyTraits.includes('Mecha');
  const rawMechaCount = traitCounts.get('Mecha') ?? 0;
  const mechaTransformAssumed =
    mechaIsKey && rawMechaCount >= 2 && rawMechaCount < 3;

  // 3. Build info objects.
  const results: CompTraitInfo[] = [];
  for (const [traitName, rawCount] of traitCounts) {
    const trait = getTrait(traitName);
    if (!trait) continue;

    const breakpoints = trait.breakpoints;
    let count = rawCount;

    // Apply Mecha transform adjustment for the displayed count.
    if (traitName === 'Mecha' && mechaTransformAssumed) {
      count = rawCount + 1;
    }

    // Highest active breakpoint.
    let activeBreakpoint = 0;
    for (const bp of breakpoints) {
      if (count >= bp) activeBreakpoint = bp;
    }
    // Next target breakpoint.
    let nextBreakpoint: number | undefined;
    for (const bp of breakpoints) {
      if (count < bp) {
        nextBreakpoint = bp;
        break;
      }
    }

    results.push({
      name: traitName,
      count,
      breakpoints,
      activeBreakpoint,
      nextBreakpoint,
      isKeyTrait: comp.keyTraits.includes(traitName),
      isUnique: trait.unique === true || trait.category === 'unique',
      category: trait.category,
      mechaTransformAssumed:
        traitName === 'Mecha' ? mechaTransformAssumed : undefined,
      requirement: TRAIT_REQUIREMENTS[traitName],
    });
  }

  // 4. Sort: active first (activeBreakpoint desc), then keyTrait, then count desc.
  results.sort((a, b) => {
    if (a.activeBreakpoint > 0 && b.activeBreakpoint === 0) return -1;
    if (a.activeBreakpoint === 0 && b.activeBreakpoint > 0) return 1;
    if (a.isKeyTrait && !b.isKeyTrait) return -1;
    if (!a.isKeyTrait && b.isKeyTrait) return 1;
    return b.count - a.count;
  });

  return results;
}

/**
 * Format a comp trait info as a compact "count/target" string.
 *
 * Examples:
 *   - Unique active:        "1/1"
 *   - Active at breakpoint: "4/6"  (4 active, 6 next target — or top if at max)
 *   - At max breakpoint:    "6/6"
 *   - Sub-breakpoint:       "1/2"
 */
export function formatTraitCount(info: CompTraitInfo): string {
  const { count, breakpoints, activeBreakpoint } = info;
  if (breakpoints.length === 0) return `${count}`;
  const maxBp = breakpoints[breakpoints.length - 1];
  // If at or above max breakpoint, show count/max.
  if (count >= maxBp) return `${count}/${maxBp}`;
  // Otherwise show count/nextTarget (the next breakpoint to reach).
  const target = info.nextBreakpoint ?? maxBp;
  // If active but not maxed, show count/target so the player sees the next goal.
  if (activeBreakpoint > 0) return `${count}/${target}`;
  return `${count}/${target}`;
}
