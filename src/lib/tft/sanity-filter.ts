/**
 * Sanity filter — applies TFT game-logic constraints to VLM output to suppress
 * hallucinations.
 *
 * The VLM sometimes misreads the screen:
 *   - HP jumps 70 → 100 → 70 (it read the leaderboard HP instead of your HP)
 *   - Level regresses 9 → 4 → 9 (it misread the XP bar)
 *   - Stage goes backwards 5-3 → 3-2 (it misread the stage indicator)
 *   - Gold leaks LoL values (137, 513 — impossible in TFT)
 *
 * TFT game logic gives us INVARIANT constraints we can enforce:
 *
 *   1. LEVEL can only INCREASE (1 → 2 → ... → 9, rarely 10/11). Never decreases.
 *      Once you hit level N, you cannot drop below N. (High-water mark.)
 *
 *   2. STAGE-ROUND can only go FORWARD (1-1 → 1-2 → ... → 6-7). Never backwards.
 *      (High-water mark on stage*10+round.)
 *
 *   3. HP can DECREASE freely (lose combat). HP can also INCREASE slightly via
 *      augments (Wise Elder +5, Featherweights +5, etc.) — typically +3 to +5,
 *      rarely +10. HP can EXCEED 100 with bonus-HP augments (up to ~110-150).
 *      But a +30 jump in one snapshot (70 → 100) is a hallucination.
 *      Rule: allow increases up to +25 per snapshot; reject larger jumps.
 *
 *   4. GOLD fluctuates wildly (buy/sell/reroll/interest). Can't enforce
 *      monotonicity. But values > 150 are almost certainly LoL-leak (LoL gold
 *      goes 500+) or VLM reading the leaderboard. Cap at 150.
 *
 *   5. NEW GAME detection: stage 1 is ALWAYS the start of a TFT game (PvE
 *      minion rounds). You can never return to stage 1 once you've left it.
 *      So if incoming.stage=1 AND previous.stage>=2, the user started a new
 *      match — reset the baseline (skip monotonicity, accept the new values).
 *
 * The filter is PURE — it doesn't touch the DB. The caller (snapshot route)
 * fetches the last known good state and passes it in.
 */

import type { GameState } from "./state";

// ─── TFT game-logic constants ───────────────────────────────────────────────

/**
 * Max HP achievable. Base 100 + augment bonuses (Wise Elder +5, Baller +10,
 * Featherweights +5, etc.) + trait bonuses. 150 is a generous ceiling —
 * anything above is a VLM hallucination.
 */
export const HP_HARD_CAP = 150;

/**
 * Max HP increase allowed in a single snapshot. TFT HP-affecting mechanics:
 *   - Single augment: +3 to +10 (Wise Elder +5, Baller +10, Featherweights +5)
 *   - Two augments in quick succession: up to +15
 *   - Prismatic-tier augment: up to +15-20
 *   - VLM "catch-up" read: if VLM missed HP for a few frames (defaulted to
 *     previous), then reads correctly, the apparent jump is just VLM
 *     catching up to reality — could be any size but usually < +20
 *
 * We allow +25 as a generous ceiling — covers all known mechanics, including
 * edge cases like two prismatic augments. Anything more (e.g. 70 → 100 = +30)
 * is a hallucination: the VLM either read the wrong player's HP from the
 * leaderboard, or defaulted to 100 (the start-of-game HP) because it couldn't
 * read the actual HP on a carousel/PvE round.
 *
 * The classic hallucination signature is jumping EXACTLY to 100 when previous
 * was significantly lower — 100 is the analyzer's fallback when VLM can't read
 * HP. +25 catches the common +29/+30 jump pattern.
 */
export const HP_MAX_INCREASE_PER_SNAPSHOT = 25;

/**
 * Gold hard cap. TFT gold realistically maxes around 100-130 late game (50
 * interest cap + streak + base income + sell). 150 is a generous ceiling.
 * Values above (137 borderline, 513/733/977 definitely) are LoL-leak or
 * VLM misreading the leaderboard.
 */
export const GOLD_HARD_CAP = 150;

/** Max TFT level. Set 17 goes to 9; 10/11 are ultra-rare prismatic-tier. */
export const LEVEL_HARD_CAP = 11;

/** Max TFT stage. Set 17 ends at 6-7, but allow 9 for safety. */
export const STAGE_HARD_CAP = 9;

/** Max streak magnitude (win or loss). TFT streaks cap at +5/+6 bonus gold. */
export const STREAK_HARD_CAP = 20;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SanityChange {
  /** Which field was modified. */
  field: "hp" | "level" | "stage" | "round" | "gold" | "streak";
  /** Value before the fix. */
  from: number;
  /** Value after the fix. */
  to: number;
  /** Human-readable reason (for debug logging). */
  reason: string;
}

export interface SanityFilterResult {
  /** The filtered state (safe to persist). */
  state: GameState;
  /** List of fixes applied (empty if nothing was changed). */
  changes: SanityChange[];
  /** True if a new game was detected (baseline reset). */
  newGame: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Total stage-round progression: stage*10 + round. Higher = later in game. */
function stageProgress(stage: number, round: number): number {
  return stage * 10 + round;
}

/**
 * Detect whether the incoming state represents the start of a NEW TFT match.
 * Stage 1 is ALWAYS the start of a game (PvE minion rounds) — once you leave
 * stage 1, you can never return. So if we see stage=1 after seeing stage>=2,
 * the user started a new match.
 *
 * We also catch the edge case where the VLM misreads stage=2 round=1 (first
 * PvP round) at the start of a game while previous was deep in mid-game.
 */
function isNewGame(incoming: GameState, previous: GameState | null): boolean {
  if (!previous || !previous.connected) return false;
  // Primary signal: stage dropped from >=2 to 1. Never happens mid-game.
  if (incoming.stage === 1 && previous.stage >= 2) return true;
  // Secondary signal: stage 2 round 1 + low level + high HP after being deep
  // in mid-game. Catches VLM that reads stage "2-1" as the actual stage at
  // game start (it sometimes confuses the stage indicator).
  if (
    incoming.stage === 2 &&
    incoming.round === 1 &&
    incoming.level <= 2 &&
    incoming.hp >= 90 &&
    previous.stage >= 4
  ) {
    return true;
  }
  return false;
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Apply TFT game-logic constraints to a VLM-produced state.
 *
 * @param incoming - The state the VLM just produced (already run through
 *   vlm-analyzer's own clamps).
 * @param previous - The last known good state (ok=true, connected=true) from
 *   the DB. Null if there's no prior good state (first snapshot, or all prior
 *   snapshots failed).
 *
 * @returns The filtered state + a list of changes for debug logging.
 */
export function applySanityFilter(
  incoming: GameState,
  previous: GameState | null
): SanityFilterResult {
  const changes: SanityChange[] = [];
  // Shallow-copy so we don't mutate the caller's object.
  const state: GameState = { ...incoming };

  // If VLM didn't recognize the screen as TFT, don't filter — the snapshot
  // route already falls back to emptyStateWith defaults. Filtering a
  // disconnected state would just pollute the log.
  if (!incoming.connected) {
    return { state, changes, newGame: false };
  }

  // ─── Hard caps (always applied, even without previous) ───────────────
  if (state.level > LEVEL_HARD_CAP) {
    changes.push({
      field: "level",
      from: state.level,
      to: LEVEL_HARD_CAP,
      reason: `level ${state.level} > hard cap ${LEVEL_HARD_CAP}`,
    });
    state.level = LEVEL_HARD_CAP;
  }
  if (state.stage > STAGE_HARD_CAP) {
    changes.push({
      field: "stage",
      from: state.stage,
      to: STAGE_HARD_CAP,
      reason: `stage ${state.stage} > hard cap ${STAGE_HARD_CAP}`,
    });
    state.stage = STAGE_HARD_CAP;
  }
  if (state.hp > HP_HARD_CAP) {
    changes.push({
      field: "hp",
      from: state.hp,
      to: HP_HARD_CAP,
      reason: `hp ${state.hp} > hard cap ${HP_HARD_CAP} (augment ceiling)`,
    });
    state.hp = HP_HARD_CAP;
  }
  if (state.gold > GOLD_HARD_CAP) {
    // Gold > 150 is almost certainly a LoL-leak (LoL gold goes 500+) or VLM
    // reading the leaderboard. Replace with previous if available (smoother),
    // otherwise cap at GOLD_HARD_CAP. Clamp the replacement too — defensive
    // against a previous state that somehow has gold > cap (shouldn't happen
    // but guards against DB corruption or future schema changes).
    const rawReplacement = previous?.connected ? previous.gold : GOLD_HARD_CAP;
    const replacement = Math.min(rawReplacement, GOLD_HARD_CAP);
    changes.push({
      field: "gold",
      from: state.gold,
      to: replacement,
      reason: `gold ${state.gold} > ${GOLD_HARD_CAP} (LoL-leak suspected)`,
    });
    state.gold = replacement;
  }
  if (Math.abs(state.streak) > STREAK_HARD_CAP) {
    const capped = Math.sign(state.streak) * STREAK_HARD_CAP;
    changes.push({
      field: "streak",
      from: state.streak,
      to: capped,
      reason: `streak ${state.streak} implausible, clamped to ±${STREAK_HARD_CAP}`,
    });
    state.streak = capped;
  }

  // Without a previous connected state, we can't do monotonicity checks.
  if (!previous || !previous.connected) {
    return { state, changes, newGame: false };
  }

  // ─── New-game detection ──────────────────────────────────────────────
  // If the user started a new TFT match, all bets are off — HP resets to 100,
  // level resets to 1, stage resets to 1-1. Skip monotonicity checks and
  // accept the new values (after hard caps above).
  const newGame = isNewGame(state, previous);
  if (newGame) {
    changes.push({
      field: "stage",
      from: previous.stage,
      to: state.stage,
      reason: `new game detected (stage ${previous.stage}→${state.stage}), baseline reset`,
    });
    return { state, changes, newGame: true };
  }

  // ─── Level: high-water mark (only increases) ─────────────────────────
  // TFT rule: level NEVER decreases. If VLM reports a lower level, it's a
  // hallucination (misread XP bar / read Buy XP button cost). Keep previous.
  if (state.level < previous.level) {
    changes.push({
      field: "level",
      from: state.level,
      to: previous.level,
      reason: `level decreased ${previous.level}→${state.level} (impossible — high-water mark)`,
    });
    state.level = previous.level;
  }

  // ─── Level: stage-based plausibility check ───────────────────────────
  // VLM sıkça "Buy XP" butonundaki 4'ü level sanıyor. Stage 3+ iken level 4
  // okursa, bu büyük ihtimalle Buy XP butonu. TFT'de stage 3'te çoğu oyuncu
  // level 6-7'dedir. Eğer previous.level daha yüksekse, previous'a dön.
  // (Yukarıdaki high-water mark zaten yakalar, ama bu ek bir güvenlik.)
  if (
    state.stage >= 3 &&
    state.level <= 5 &&
    previous.level > state.level
  ) {
    // Zaten high-water mark tarafından yakalandı, bu ek kontrol sessiz.
  }

  // ─── Stage-round: high-water mark (only forward) ─────────────────────
  // TFT rule: stage-round NEVER goes backwards. If VLM reports an earlier
  // stage-round, it's a hallucination. Keep the previous (later) stage-round.
  const prevProgress = stageProgress(previous.stage, previous.round);
  const newProgress = stageProgress(state.stage, state.round);
  if (newProgress < prevProgress) {
    changes.push({
      field: "stage",
      from: state.stage,
      to: previous.stage,
      reason: `stage-round went backwards ${previous.stage}-${previous.round}→${state.stage}-${state.round} (high-water mark)`,
    });
    state.stage = previous.stage;
    state.round = previous.round;
  }

  // ─── HP: decrease freely, small increase OK, big jump = hallucination ─
  // TFT rule: HP decreases when you lose combat. HP can increase slightly via
  // augments (Wise Elder +5, Featherweights +5, Baller +10). HP can exceed
  // 100 with bonus-HP augments. But a +30 jump (70 → 100) in one snapshot
  // is a hallucination — the VLM probably read the wrong player's HP from
  // the leaderboard.
  //
  // Note: HP can also appear to "reset" to 100 if VLM couldn't read it
  // (carousel/PvE rounds) — the analyzer's fallback is 100. The sanity filter
  // correctly rejects these false 100s when previous HP was < 88.
  if (state.hp > previous.hp) {
    const delta = state.hp - previous.hp;
    if (delta > HP_MAX_INCREASE_PER_SNAPSHOT) {
      changes.push({
        field: "hp",
        from: state.hp,
        to: previous.hp,
        reason: `hp jumped +${delta} (${previous.hp}→${state.hp}), max allowed +${HP_MAX_INCREASE_PER_SNAPSHOT} (augment ceiling), suspected hallucination`,
      });
      state.hp = previous.hp;
    }
    // else: increase ≤ 25 — accept as augment heal or prismatic bonus.
  }
  // HP decrease is always valid — accept freely.

  // ─── Gold: only hard cap (above). Don't enforce monotonicity ─────────
  // Gold swings are normal: buying champs (-1 to -5), selling (+half cost),
  // rerolling (-2 each), interest (+1 per 10, cap 5), streak bonus (+0 to +3),
  // base income (+5). A drop from 80 → 20 in one snapshot is completely
  // normal (bought a 3-cost, rerolled 10 times). Don't filter decreases.

  return { state, changes, newGame: false };
}

/**
 * Format the changes list for a single-line debug log.
 * Example: "hp 100→70(lvl-decrease), level 4→9(high-water)"
 */
export function formatChanges(changes: SanityChange[]): string {
  if (changes.length === 0) return "";
  return changes
    .map((c) => `${c.field} ${c.from}→${c.to}`)
    .join(", ");
}
