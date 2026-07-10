/**
 * TFT Advisor Engine — the brain of the overlay.
 *
 * Ported from `advisor/engine.py` (Python, 761 lines) → TypeScript.
 *
 * Produces a `FullRecommendation` for a given `GameState` covering:
 *   - Early game: win-streak vs loss-streak vs flex strategy
 *   - Comp planning: which comp to play, when to commit, when to pivot
 *   - Economy: save / level / reroll / maintain streak
 *   - Shop: which units to buy, whether to reroll
 *   - Carry: which unit to 3-star, which are trait-bots
 *   - Items: best-in-slot for each carry
 *   - Pool: which units are contested / exhausted (SIMULATED — see `_pool`)
 *   - Stage: upcoming events, target level, priority action
 *   - Augments: ranked choices based on synergy / HP / stage
 *
 * Design principle (preserved from Python): the engine does NOT commit to a
 * comp early. Early game uses "greedy best board" logic; comp selection
 * happens at stage 3+ based on board direction and contested traits.
 *
 * Stateless per `recommend()` call — only `_lastComp`
 * persist across calls (for pivot tracking).
 */

import type {
  BoardUnit,
  BoardRec,
  CarryTarget,
  CompPlan,
  EarlyStrategy,
  EconomyRec,
  FullRecommendation,
  GameState,
  ItemRec,
  RankedAugment,
  RerollRec,
  ShopRec,
  StageEvent,
  StageRec,
  TraitStatus,
} from '@/lib/tft/state';

import {
  lookupAugment,
  CHAMPION_MAP,
  COMPS,
  ITEM_MAP,
  PLAYSTYLE_INFO,
  TRAITS,
  TRAIT_MAP,
} from '@/lib/tft-data';

import type { Comp } from '@/lib/tft-data';

// ─── The engine ────────────────────────────────────────────────────────────

export class AdvisorEngine {
  /** Tracks the last committed comp so we can detect pivots. */
  #lastComp: string | null = null;

  /**
   * Reset internal state — call when a new game starts so the old
   * comp name doesn't trigger a false "pivot" on the first recommendation.
   */
  reset(): void {
    this.#lastComp = null;
  }

  /**
   * Produce a full recommendation for the current game state.
   * The call is stateless except for `_lastComp` pivot tracking.
   */
  recommend(state: GameState): FullRecommendation {
    const activeTraits = this.#computeTraits(state.board);

    const economy = this.#economy(state);
    const comp = this.#planComp(state, activeTraits);
    const shop = this.#shop(state, activeTraits, comp);
    const reroll = this.#reroll(state, economy);
    const board = this.#board(state, activeTraits);
    const carries = this.#carries(state, comp);
    const items = this.#items(state, comp);
    const stage = this.#stage(state);
    const augments = this.#augments(state, activeTraits);
    const earlyStrat = this.#earlyStrategy(state);

    const oneLiner = this.#oneLiner(state, economy, comp, stage);

    return {
      augment: augments,
      shop,
      reroll,
      economy,
      board,
      carries,
      items,
      stage,
      comp,
      earlyStrategy: earlyStrat,
      oneLiner,
      computedAt: new Date().toISOString(),
    };
  }

  // ─── Early-game strategy ──────────────────────────────────────────────────

  /**
   * Decide win-streak vs loss-streak vs flex based on early state.
   *
   * Python returns 5 raw values ("committed", "win_streak", "loss_streak",
   * "flex_up", "flex"). The TS `EarlyStrategy` union only has 3 values, so we
   * map: "committed" → "flex" (past early game, no longer choosing),
   * "flex_up" → "flex" (high HP, playing flex). The downstream `_shop` only
   * compares against "win-streak", which is preserved 1:1.
   */
  #earlyStrategy(state: GameState): EarlyStrategy {
    if (state.stage > 2) return 'flex'; // past early game (was "committed")
    if (state.streak >= 2) return 'win-streak';
    if (state.streak <= -2) return 'loss-streak';
    if (state.hp >= 80) return 'flex'; // was "flex_up"
    if (state.hp <= 50) return 'loss-streak';
    return 'flex';
  }

  // ─── Comp planning ─────────────────────────────────────────────────────────

  /**
   * Decide which comp to play. Early game = no commit; mid+ = commit.
   */
  #planComp(state: GameState, activeTraits: TraitStatus[]): CompPlan | null {
    // Early game: don't commit, just track direction
    if (state.stage <= 2) {
      return this.#earlyDirection(state, activeTraits);
    }

    // Mid/late: score all comps against current board, pick best
    const boardNames = new Set(state.board.map((u) => u.name));
    const boardTraitCounts: Record<string, number> = {};
    for (const u of state.board) {
      const champ = CHAMPION_MAP[u.name];
      if (!champ) continue;
      for (const t of champ.traits) {
        boardTraitCounts[t] = (boardTraitCounts[t] ?? 0) + 1;
      }
    }

    let best: Comp | null = null;
    let bestScore = -1;
    for (const comp of COMPS) {
      let score = 0;
      // Overlap with board champions
      for (const name of comp.core) {
        if (boardNames.has(name)) score += 12;
      }
      // Overlap with board traits
      for (const t of comp.keyTraits) {
        score += (boardTraitCounts[t] ?? 0) * 10;
      }
      // Tier bonus
      const tierBonus: Record<string, number> = { S: 5, A: 2, B: 0 };
      score += tierBonus[comp.tier] ?? 0;
      // Win rate bonus
      score += (comp.winRate - 50) * 0.3;

      if (score > bestScore) {
        bestScore = score;
        best = comp;
      }
    }

    if (best === null || bestScore < 10) return null;

    // Build the plan
    const benchNames = new Set(state.bench.map((u) => u.name));
    const missing = best.core.filter(
      (c) => !boardNames.has(c) && !benchNames.has(c),
    );

    let pivotFrom: string | null = null;
    let reason = this.#compReason(best, state, boardTraitCounts);

    // Check pivot
    if (this.#lastComp && this.#lastComp !== best.name) {
      pivotFrom = this.#lastComp;
      reason = `Pivot from ${this.#lastComp} → ${best.name}. ${reason}`;
    }

    this.#lastComp = best.name;

    const plan: CompPlan = {
      name: best.name,
      tier: best.tier,
      carry: best.carry,
      playstyle: best.playstyle,
      confidence: Math.min(100, bestScore * 2),
      core: best.core,
      keyTraits: best.keyTraits,
      strategy: best.strategy,
      threeStarTargets: best.threeStarTargets,
      traitBots: best.traitBots,
      missingCore: missing,
      pivotFrom,
      reason,
    };
    return plan;
  }

  /**
   * Early game: don't commit to a comp, but suggest a direction based on
   * strongest current traits. Use "greedy best board" logic.
   */
  #earlyDirection(
    state: GameState,
    activeTraits: TraitStatus[],
  ): CompPlan | null {
    void state; // state not used beyond active traits here (matches Python)
    if (activeTraits.length === 0) return null;

    // Pick top 2 active traits (Python sorts by (active, count) desc)
    const top = [...activeTraits]
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.count - a.count;
      })
      .slice(0, 2);

    if (top.length === 0) return null;

    // Find a comp that matches these traits as a "direction"
    const traitNames = new Set(top.map((t) => t.name));
    for (const comp of COMPS) {
      const overlap = comp.keyTraits.filter((t) => traitNames.has(t)).length;
      if (overlap >= 1) {
        return {
          name: `${comp.name} (direction)`,
          tier: '?',
          carry: comp.carry,
          playstyle: 'standard',
          confidence: 30,
          core: comp.core,
          keyTraits: comp.keyTraits,
          strategy: 'Early game — keep your best board. Don\'t commit yet.',
          threeStarTargets: [],
          traitBots: [],
          missingCore: [],
          pivotFrom: null,
          reason: `Early direction: leaning ${comp.name} based on ${[...traitNames].join(', ')}`,
        };
      }
    }
    return null;
  }

  #compReason(
    comp: Comp,
    state: GameState,
    traitCounts: Record<string, number>,
  ): string {
    void state; // matches Python (state param is unused inside _comp_reason)
    const parts: string[] = [];
    const overlap = comp.keyTraits.filter((t) => (traitCounts[t] ?? 0) > 0);
    if (overlap.length > 0) {
      parts.push(`matches your ${overlap.join(', ')}`);
    }
    if (comp.winRate >= 60) {
      parts.push(`strong meta comp (${comp.winRate}% top-4)`);
    }
    const ps = PLAYSTYLE_INFO[comp.playstyle];
    if (ps) {
      parts.push(`${ps.label} → level ${ps.targetLevel}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'viable comp';
  }

  // ─── Economy ────────────────────────────────────────────────────────────────

  #economy(state: GameState): EconomyRec {
    // Interest income: 1g per 10 gold saved, capped at 5.
    // e.g. gold=42 → floor(42/10)=4 → min(5,4)=4g interest.
    const interestIncome = Math.min(5, Math.floor(state.gold / 10));
    // Interest threshold: the next 10-gold breakpoint (10, 20, 30, 40, 50).
    // Used for "gold needed to reach next interest level" display.
    const currentThreshold = Math.floor(state.gold / 10) * 10;
    const nextThreshold =
      state.gold < 50 ? Math.min(50, currentThreshold + 10) : 50;
    const goldToNext =
      state.gold < 50 ? Math.max(0, nextThreshold - state.gold) : 0;

    // Target level by stage
    let targetLevel: number;
    if (state.stage <= 2) targetLevel = 6;
    else if (state.stage === 3) targetLevel = 7;
    else if (state.stage === 4) targetLevel = 8;
    else targetLevel = 9;

    // Decision priority (preserved EXACTLY from Python)
    if (state.hp <= 25) {
      return {
        action: 'reroll',
        reason: `CRITICAL HP (${state.hp}) — roll down to stabilize NOW.`,
        nextThreshold,
        goldToNext,
        targetLevel,
        interest: interestIncome,
      };
    }
    if (state.hp <= 40 && state.gold >= 30) {
      return {
        action: 'reroll',
        reason: `Low HP (${state.hp}) — roll to find upgrades.`,
        nextThreshold,
        goldToNext,
        targetLevel,
        interest: interestIncome,
      };
    }
    if (state.streak >= 3) {
      return {
        action: 'maintain',
        reason: `Win streak (${state.streak}) — maintain for bonus gold. Avoid breaking it.`,
        nextThreshold,
        goldToNext,
        targetLevel,
        interest: interestIncome,
      };
    }
    if (state.streak <= -3 && state.stage <= 3) {
      return {
        action: 'maintain',
        reason: `Loss streak (${Math.abs(state.streak)}) — keep losing for econ. Pivot at stage 3-2.`,
        nextThreshold,
        goldToNext,
        targetLevel,
        interest: interestIncome,
      };
    }
    if (state.level < targetLevel && state.gold >= 50) {
      return {
        action: 'level',
        reason: `Push to level ${targetLevel} — gold at interest cap (${state.gold}).`,
        nextThreshold,
        goldToNext,
        targetLevel,
        interest: interestIncome,
      };
    }
    if (state.gold < 50) {
      return {
        action: 'save',
        reason: `Save toward 50g for max interest (${goldToNext}g to ${nextThreshold}g).`,
        nextThreshold,
        goldToNext,
        targetLevel,
        interest: interestIncome,
      };
    }
    return {
      action: 'maintain',
      reason: 'Strong economy at 50g. Roll above 50 while keeping interest.',
      nextThreshold,
      goldToNext,
      targetLevel,
      interest: interestIncome,
    };
  }

  // ─── Shop ───────────────────────────────────────────────────────────────────

  #shop(
    state: GameState,
    activeTraits: TraitStatus[],
    comp: CompPlan | null,
  ): ShopRec[] {
    if (!state.shop || state.shop.length === 0) return [];

    const activeTraitNames = new Set(
      activeTraits.filter((t) => t.active).map((t) => t.name),
    );
    const compCore = new Set(comp?.core ?? []);
    const compTargets = new Set(comp?.threeStarTargets ?? []);
    const boardList = state.board.map((u) => u.name);
    const benchList = state.bench.map((u) => u.name);

    const recs: ShopRec[] = [];
    for (let i = 0; i < state.shop.length; i++) {
      const name = state.shop[i];
      const champ = CHAMPION_MAP[name];
      if (!champ) {
        recs.push({ slot: i, champion: name, action: 'skip', reason: 'Unknown unit.' });
        continue;
      }

      const copies =
        boardList.filter((n) => n === name).length +
        benchList.filter((n) => n === name).length;
      const traitMatch = champ.traits.filter((t) => activeTraitNames.has(t));
      const inComp = compCore.has(name);

      let shouldBuy = false;
      let reason = '';

      if (compTargets.has(name) && copies >= 1) {
        shouldBuy = true;
        reason = `BUY — ${name} is your 3-star target (${copies} held). Push for 3-star.`;
      } else if (inComp && copies >= 1) {
        shouldBuy = true;
        reason = `BUY — ${name} is core to ${comp?.name ?? ''} (${copies} held).`;
      } else if (inComp && copies === 0 && state.gold >= champ.cost + 20) {
        shouldBuy = true;
        reason = `BUY — ${name} fits your comp direction.`;
      } else if (copies >= 2) {
        shouldBuy = true;
        reason = `BUY — ${copies} copies held, pushing for 2-star.`;
      } else if (traitMatch.length > 0 && champ.cost <= 3) {
        shouldBuy = true;
        reason = `BUY — matches ${traitMatch.join(', ')}.`;
      } else if (champ.cost >= 4 && state.gold >= champ.cost + 20) {
        shouldBuy = true;
        reason = `BUY — premium ${champ.cost}-cost, strong standalone.`;
      } else if (
        this.#earlyStrategy(state) === 'win-streak' &&
        champ.cost <= 2 &&
        traitMatch.length > 0
      ) {
        shouldBuy = true;
        reason = `BUY — win streak: cheap unit with trait match.`;
      } else {
        reason = `Skip — doesn't fit. (${champ.traits.join(', ')})`;
      }

      recs.push({
        slot: i,
        champion: name,
        action: shouldBuy ? 'buy' : 'skip',
        reason,
      });
    }

    return recs;
  }

  // ─── Reroll ─────────────────────────────────────────────────────────────────

  #reroll(state: GameState, econ: EconomyRec): RerollRec {
    if (state.gold < 4) {
      return { should: false, reason: 'Not enough gold to reroll.' };
    }
    if (econ.action === 'reroll') {
      return { should: true, reason: econ.reason };
    }
    if (state.gold >= 52) {
      return { should: true, reason: 'Above 50g — safe to reroll while keeping interest.' };
    }
    return { should: false, reason: 'Stay above 50g for max interest.' };
  }

  // ─── Board analysis ─────────────────────────────────────────────────────────

  #computeTraits(board: BoardUnit[]): TraitStatus[] {
    const counts: Record<string, number> = {};
    for (const u of board) {
      const champ = CHAMPION_MAP[u.name];
      if (!champ) continue;
      for (const t of champ.traits) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }

    const result: TraitStatus[] = [];
    for (const trait of TRAITS) {
      const c = counts[trait.name] ?? 0;
      if (c === 0) continue;
      const bps = trait.breakpoints;
      const nextBp = bps.find((b) => b > c) ?? null;
      const active = bps.some((b) => c >= b);
      const oneAway = nextBp !== null && nextBp - c === 1;
      result.push({
        name: trait.name,
        type: trait.type,
        count: c,
        breakpoints: bps,
        nextBreakpoint: nextBp,
        active,
        oneAway,
      });
    }
    // Sort by (active, count) desc — matches Python's sort key.
    result.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.count - a.count;
    });
    return result;
  }

  #board(state: GameState, activeTraits: TraitStatus[]): BoardRec {
    const activeCount = activeTraits.filter((t) => t.active).length;
    const oneAwayCount = activeTraits.filter((t) => t.oneAway).length;
    const boardSize = state.board.length;

    let coherence = 30 + activeCount * 12 + oneAwayCount * 5;
    if (boardSize >= 7) coherence += 10;
    if (boardSize < 4) coherence -= 15;
    coherence = Math.max(0, Math.min(100, coherence));

    let frontline = 0;
    let backline = 0;
    let carries = 0;
    const frontTraits = ['Brawler', 'Vanguard', 'Bastion', 'Mecha'];
    const carryTraits = ['Sniper', 'Rogue', 'Challenger'];
    for (const u of state.board) {
      const champ = CHAMPION_MAP[u.name];
      if (!champ) continue;
      if (
        champ.role === 'tank' ||
        champ.traits.some((t) => frontTraits.includes(t))
      ) {
        frontline += 1;
      }
      if (
        champ.role === 'carry' ||
        champ.traits.some((t) => carryTraits.includes(t))
      ) {
        backline += 1;
        carries += 1;
      }
    }

    const suggestions: string[] = [];
    if (frontline === 0) {
      suggestions.push('⚠️ No frontline — add a Vanguard/Brawler/Bastion unit.');
    }
    if (carries === 0) {
      suggestions.push('⚠️ No carry — add a Sniper/Rogue/Challenger for damage.');
    }
    const oneAway = activeTraits.filter((t) => t.oneAway);
    if (oneAway.length > 0) {
      suggestions.push(`🎯 1 away from: ${oneAway.map((t) => t.name).join(', ')}`);
    }
    if (activeCount >= 4) {
      suggestions.push('✅ Strong trait synergy.');
    }
    if (coherence >= 80) {
      suggestions.push('🌟 Excellent board coherence.');
    } else if (coherence < 50) {
      suggestions.push('🔧 Low coherence — consider pivoting.');
    }
    if (suggestions.length === 0) {
      suggestions.push('📋 Board looks balanced.');
    }

    return {
      coherence,
      activeTraits,
      suggestions,
      frontline,
      backline,
      carries,
    };
  }

  // ─── Carry targeting ────────────────────────────────────────────────────────

  #carries(state: GameState, comp: CompPlan | null): CarryTarget[] {
    /** Identify carries and whether to 3-star them or leave as trait-bots. */
    const allUnits: BoardUnit[] = [...state.board, ...state.bench];
    const counts: Record<string, BoardUnit[]> = {};
    for (const u of allUnits) {
      if (!counts[u.name]) counts[u.name] = [];
      counts[u.name].push(u);
    }

    const targets: CarryTarget[] = [];
    for (const [name, units] of Object.entries(counts)) {
      const champ = CHAMPION_MAP[name];
      if (!champ) continue;
      const copies = units.length;

      // Calculate actual pool copies consumed: 1★=1, 2★=3, 3★=9
      const poolCopies = units.reduce((sum, u) => sum + (3 ** (u.stars - 1)), 0);

      // Determine role
      let role: CarryTarget['role'] = 'flex';
      let starGoal = 2;
      if (comp) {
        if (comp.threeStarTargets.includes(name)) {
          role = 'carry';
          starGoal = 3;
        } else if (comp.traitBots.includes(name)) {
          role = 'trait_bot';
          starGoal = 1;
        } else if (name === comp.carry) {
          role = 'carry';
          starGoal = champ.cost >= 4 ? 2 : 3;
        } else if (comp.core.includes(name)) {
          role = 'core';
          starGoal = 2;
        }
      }

      // Score
      let score = copies * 12;
      score += champ.cost * 4;
      if (role === 'carry') score += 25;
      if (starGoal === 3 && poolCopies >= 5) score += 20;
      if (champ.cost >= 4 && copies >= 2) score += 15;
      score = Math.max(0, Math.min(100, score));

      const needed3star = Math.max(0, 9 - poolCopies);
      const reasonParts: string[] = [`${copies} copies`];
      if (role === 'carry') {
        reasonParts.push(`carry → ${starGoal}★`);
      } else if (role === 'trait_bot') {
        reasonParts.push('trait bot (leave at 1-2★)');
      }
      if (poolCopies >= 6 && role === 'carry' && starGoal === 3) {
        reasonParts.push('close to 3★!');
      }

      targets.push({
        name,
        score,
        copiesHeld: copies,
        copiesNeeded3star: needed3star,
        starGoal,
        role,
        reason: reasonParts.join(', '),
      });
    }

    targets.sort((a, b) => b.score - a.score);
    return targets.slice(0, 6);
  }

  // ─── Items ──────────────────────────────────────────────────────────────────

  #items(state: GameState, comp: CompPlan | null): ItemRec[] {
    void comp; // Python accepts comp but doesn't actually use it inside _items
    const recs: ItemRec[] = [];
    for (const u of state.board) {
      const champ = CHAMPION_MAP[u.name];
      if (!champ) continue;
      for (const itemName of champ.items) {
        if (u.items.includes(itemName)) continue; // already equipped
        const item = ITEM_MAP[itemName];
        if (!item) continue;

        let score = 60;
        const traits = champ.traits;
        if (traits.includes('Sniper') && item.tags.includes('AD')) score += 22;
        if (traits.includes('Rogue') && item.tags.includes('AD')) score += 18;
        if (traits.includes('Challenger') && item.tags.includes('AS')) score += 22;
        if (traits.includes('N.O.V.A.') && item.tags.includes('AP')) score += 20;
        if (traits.includes('Psionic') && item.tags.includes('AP')) score += 18;
        if (
          traits.some((t) =>
            ['Brawler', 'Vanguard', 'Bastion', 'Mecha'].includes(t),
          ) &&
          item.tags.includes('Tank')
        ) {
          score += 22;
        }
        if (
          champ.role === 'carry' &&
          item.tags.some((t) => ['AD', 'AP', 'AS'].includes(t))
        ) {
          score += 12;
        }
        score = Math.max(0, Math.min(100, score));

        recs.push({
          item: itemName,
          champion: u.name,
          score,
          reason: `BIS for ${u.name} (${champ.role}). ${item.desc}`,
        });
      }
    }
    recs.sort((a, b) => b.score - a.score);
    return recs.slice(0, 8);
  }

  // ─── Stage awareness ─────────────────────────────────────────────────────────

  #stage(state: GameState): StageRec {
    const targetLevel =
      state.stage <= 2 ? 6 : state.stage === 3 ? 7 : state.stage === 4 ? 8 : 9;

    let levelStatus: StageRec['levelStatus'];
    if (state.level > targetLevel) levelStatus = 'ahead';
    else if (state.level < targetLevel - 1) levelStatus = 'behind';
    else levelStatus = 'on-track';

    const events: StageEvent[] = [];
    const total = state.stage * 10 + state.round;

    const augmentSchedule: Array<[number, string, string]> = [
      [21, 'Augment #1', '2-1'],
      [23, 'Augment #2', '2-3'],
      [32, 'Augment #3 (Gold/Prismatic)', '3-2'],
      [34, 'Augment #4 (Prismatic)', '3-4'],
      [42, 'Augment #5 (Hero)', '4-2'],
    ];
    for (const [t, label, sr] of augmentSchedule) {
      if (t > total) {
        events.push({
          type: 'augment',
          label,
          roundsAway: t - total,
          description: `At ${sr}. Prepare board direction.`,
        });
      }
    }
    const pveSchedule: Array<[number, string, string]> = [
      [27, 'PvE (Krugs/Wolves)', '2-7'],
      [37, 'PvE (Raptors)', '3-7'],
      [47, 'Stage Boss', '4-7'],
    ];
    for (const [t, label, sr] of pveSchedule) {
      if (t > total) {
        events.push({
          type: 'pve',
          label,
          roundsAway: t - total,
          description: `At ${sr}. Free items & gold.`,
        });
      }
    }
    events.sort((a, b) => a.roundsAway - b.roundsAway);

    const phase: StageRec['phase'] =
      state.stage <= 2 ? 'early' : state.stage <= 3 ? 'mid' : 'late';

    let priority: string;
    if (phase === 'early') {
      priority = 'Build economy. Identify comp direction — DON\'T commit yet.';
    } else if (phase === 'mid') {
      priority =
        state.hp < 40
          ? 'Stabilize! Roll for upgrades.'
          : 'Commit to comp. Slow roll at 8.';
    } else {
      priority =
        state.hp > 30 ? 'Fast 9 for legendaries.' : 'Roll down — survive every round!';
    }

    return {
      current: `${state.stage}-${state.round}`,
      phase,
      targetLevel,
      levelStatus,
      nextEvent: events.length > 0 ? events[0] : null,
      upcoming: events.slice(0, 3),
      priorityAction: priority,
    };
  }

  // ─── Augments ───────────────────────────────────────────────────────────────

  #augments(
    state: GameState,
    activeTraits: TraitStatus[],
  ): RankedAugment[] | null {
    if (!state.augments || state.augments.length === 0) return null;

    const ranked: RankedAugment[] = [];
    for (const name of state.augments) {
      const aug = lookupAugment(name);
      if (!aug) {
        ranked.push({ name, score: 50, tier: '?', reasoning: 'Unknown augment.' });
        continue;
      }
      let score = aug.score;
      // Trait synergy
      for (const tag of aug.tags) {
        for (const t of activeTraits) {
          if (t.active && TRAIT_MAP[t.name]?.type === tag) {
            score += 4;
          }
        }
      }
      // HP adjustments
      if (state.hp < 30 && aug.tags.includes('comeback')) score += 8;
      if (state.stage >= 4 && aug.tags.includes('late')) score += 5;
      if (state.stage <= 2 && aug.tags.includes('early')) score += 5;
      score = Math.max(0, Math.min(100, score));

      const reasoning = this.#augmentReason(aug, score, state, activeTraits);
      ranked.push({
        name,
        score: Math.round(score * 10) / 10,
        tier: aug.tier,
        reasoning,
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }

  #augmentReason(
    aug: { tags: string[] },
    score: number,
    state: GameState,
    activeTraits: TraitStatus[],
  ): string {
    const parts: string[] = [];
    if (score >= 85) parts.push('Excellent');
    else if (score >= 75) parts.push('Strong');
    else if (score >= 65) parts.push('Solid');
    else parts.push('Situational');

    if (state.hp < 30 && aug.tags.includes('comeback')) {
      parts.push('comeback at low HP');
    }
    if (state.stage <= 2 && aug.tags.includes('early')) {
      parts.push('early value');
    }
    const syn = activeTraits
      .filter(
        (t) => t.active && aug.tags.includes(TRAIT_MAP[t.name]?.type ?? ''),
      )
      .map((t) => t.name);
    if (syn.length > 0) {
      parts.push(`synergy: ${syn.slice(0, 2).join(', ')}`);
    }
    parts.push(`(${Math.floor(score)}%)`);
    return parts.join(' — ');
  }

  // ─── One-liner ───────────────────────────────────────────────────────────────
  //
  // Priority order (preserved EXACTLY from Python):
  //   1. CRITICAL HP (<=25)
  //   2. roll for upgrades (econ.action === 'reroll')
  //   3. level up (econ.action === 'level')
  //   4. save gold (econ.action === 'save')
  //   5. find missing core
  //   6. playing X comp
  //   7. stage priority action (fallback)

  #oneLiner(
    state: GameState,
    econ: EconomyRec,
    comp: CompPlan | null,
    stage: StageRec,
  ): string {
    if (state.hp <= 25) {
      return `⚠️ CRITICAL: Roll down NOW to survive (HP ${state.hp})`;
    }
    if (econ.action === 'reroll') {
      return `🎲 Roll for upgrades — ${econ.reason}`;
    }
    if (econ.action === 'level') {
      return `📈 Level up to ${econ.targetLevel} — gold at cap`;
    }
    if (econ.action === 'save') {
      return `💰 Save gold → ${econ.nextThreshold}g (${econ.goldToNext}g to go)`;
    }
    if (comp && state.stage >= 3 && comp.missingCore.length > 0) {
      return `🎯 Find: ${comp.missingCore.slice(0, 3).join(', ')}`;
    }
    if (comp && state.stage >= 3) {
      return `🎯 Playing: ${comp.name} (${comp.carry} carry)`;
    }
    return stage.priorityAction;
  }
}

// ─── Module-level singleton + convenience export ────────────────────────────
//
// The singleton preserves `_lastComp` across `recommend()` calls so the engine
// can detect pivots. The API route imports this `recommend` function; the
// `AdvisorEngine` class is exported separately for callers that want a fresh
// instance (e.g. tests).

const _singleton = new AdvisorEngine();

/** Convenience function: produce a full recommendation using a shared engine. */
export function recommend(state: GameState): FullRecommendation {
  return _singleton.recommend(state);
}

/** Reset the shared engine's internal state (e.g. on new game detection). */
export function resetAdvisor(): void {
  _singleton.reset();
}
