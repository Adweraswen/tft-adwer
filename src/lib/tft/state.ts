/**
 * TFT game state + recommendation types.
 *
 * This is the CONTRACT between:
 *   - VLM analyzer (produces GameState from a screenshot)
 *   - Advisor engine (consumes GameState, produces FullRecommendation)
 *   - API routes (serialize/deserialize both to JSON)
 *   - UI (renders FullRecommendation)
 *
 * Keep this file dependency-free (only type exports) so it can be imported anywhere.
 */

// ─── Game state (what VLM extracts from the screen) ─────────────────────────

export type GameSource = "live" | "manual" | "mock";

export interface BoardUnit {
  /** Champion display name, e.g. "Jhin". Empty string if slot is empty / unknown. */
  name: string;
  /** 1, 2, or 3 stars. Defaults to 1 if VLM couldn't tell. */
  stars: number;
  /** Item names equipped on this unit, e.g. ["Infinity Edge", "Last Whisper"]. */
  items: string[];
}

export interface GameState {
  source: GameSource;
  connected: boolean;

  // Core numerics
  level: number; // 1–9 (10/11 ultra-late)
  gold: number; // 0+
  hp: number; // 0–150 (base 100, augments can add up to ~50)
  stage: number; // 1–9
  round: number; // 1–7
  streak: number; // +N win streak, -N loss streak, 0 = none

  // Lists
  shop: string[]; // always length 5; "" for empty/unknown slot
  board: BoardUnit[]; // champions on the board
  bench: BoardUnit[]; // champions on the bench
  augments: string[]; // augment names
}

// ─── Recommendations (what the advisor produces) ────────────────────────────

export type EconomyAction = "save" | "level" | "reroll" | "maintain";

export interface EconomyRec {
  action: EconomyAction;
  reason: string;
  nextThreshold: number; // next interest breakpoint (10/20/30/40/50)
  goldToNext: number; // gold needed to reach nextThreshold
  targetLevel: number; // recommended level for current stage
  interest: number; // current interest income (gold // 10, cap 5)
}

export interface TraitStatus {
  name: string;
  type: string; // origin / class / unique
  count: number; // active units
  breakpoints: number[];
  nextBreakpoint: number | null;
  active: boolean;
  oneAway: boolean;
}

export interface BoardRec {
  coherence: number; // 0–100
  activeTraits: TraitStatus[];
  suggestions: string[];
  frontline: number;
  backline: number;
  carries: number;
}

export type ShopAction = "buy" | "skip";

export interface ShopRec {
  slot: number; // 0–4
  champion: string;
  action: ShopAction;
  reason: string;
}

export interface RerollRec {
  should: boolean;
  reason: string;
}

export type CarryRole = "carry" | "trait_bot" | "core" | "flex";

export interface CarryTarget {
  name: string;
  score: number; // 0–100
  copiesHeld: number;
  copiesNeeded3star: number;
  starGoal: number; // 2 or 3
  role: CarryRole;
  reason: string;
}

export interface ItemRec {
  item: string;
  champion: string;
  score: number;
  reason: string;
}

export type StagePhase = "early" | "mid" | "late";
export type LevelStatus = "ahead" | "on-track" | "behind";

export interface StageEvent {
  type: "augment" | "pve" | "carousel" | "pvp";
  label: string;
  roundsAway: number;
  description: string;
}

export interface StageRec {
  current: string; // e.g. "3-2"
  phase: StagePhase;
  targetLevel: number;
  levelStatus: LevelStatus;
  nextEvent: StageEvent | null;
  upcoming: StageEvent[];
  priorityAction: string;
}

export interface CompPlan {
  name: string;
  tier: string; // S / A / B
  carry: string;
  playstyle: 'reroll' | 'rush8' | 'rush9' | 'standard';
  confidence: number; // 0–100
  core: string[];
  keyTraits: string[];
  strategy: string;
  threeStarTargets: string[];
  traitBots: string[];
  missingCore: string[];
  pivotFrom: string | null;
  reason: string;
}

export interface RankedAugment {
  name: string;
  score: number;
  tier: string;
  reasoning: string;
}

export type EarlyStrategy = "win-streak" | "loss-streak" | "flex";

export interface FullRecommendation {
  augment: RankedAugment[] | null;
  shop: ShopRec[];
  reroll: RerollRec;
  economy: EconomyRec;
  board: BoardRec;
  carries: CarryTarget[];
  items: ItemRec[];
  stage: StageRec;
  comp: CompPlan | null;
  earlyStrategy: EarlyStrategy;
  oneLiner: string;
  /** ISO timestamp when the recommendation was computed. */
  computedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function emptyState(source: GameSource = "manual"): GameState {
  return {
    source,
    connected: false,
    level: 1,
    gold: 0,
    hp: 100,
    stage: 1,
    round: 1,
    streak: 0,
    shop: ["", "", "", "", ""],
    board: [],
    bench: [],
    augments: [],
  };
}

/** A snapshot persisted in the DB, with the recommendation already computed. */
export interface SnapshotRecord {
  id: string;
  createdAt: string;
  source: GameSource;
  state: GameState;
  recommendation: FullRecommendation;
  ok: boolean;
  errorMsg: string | null;
  /** The screenshot is NOT stored in the DB (too big). Only a flag whether it was processed. */
  hadImage: boolean;
}
