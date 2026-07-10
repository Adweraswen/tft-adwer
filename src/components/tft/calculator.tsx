"use client";

/**
 * Calculator — interactive math tools for TFT decision-making.
 *
 * Two tools:
 *   1. Reroll Probability Calculator
 *      - Pick champion cost + player level + number of rolls
 *      - Shows exact probability of finding at least one copy
 *      - Transparent formula so the user can see the math
 *
 *   2. Economy Planner
 *      - Enter current gold → see interest breakpoints + projection
 *      - "If I save for N rounds, when can I level up?"
 *      - Shows the interest math (gold // 10, cap 5)
 *
 * All math is shown explicitly — the user asked to understand the logic.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dice5,
  Coins,
  TrendingUp,
  Calculator as CalcIcon,
  Info,
  ArrowUpCircle,
  Target,
  Zap,
} from "lucide-react";
import {
  CHAMPION_COUNT_BY_COST,
  shopOddsForLevel,
  poolForCost,
  xpForLevel,
  goldToNextLevel,
} from "@/lib/tft-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Probability that a single shop SLOT shows the target champion.
 *
 *   P(slot = target) = (shop_odds_for_cost / 100) × (copies_in_pool / total_at_cost)
 *
 * For a fresh pool: copies_in_pool = pool_size, total_at_cost = pool_size × num_champs.
 * So P(slot) = odds% × (1 / num_champs).
 *
 * If some copies are already taken (contested), copies_in_pool shrinks.
 */
function pSlotIsTarget(level: number, cost: 1 | 2 | 3 | 4 | 5, taken: number): number {
  const oddsPct = shopOddsForLevel(level)[cost - 1] ?? 0;
  const poolSize = poolForCost(cost);
  const remaining = Math.max(0, poolSize - taken);
  const totalAtCost = poolSize * CHAMPION_COUNT_BY_COST[cost];
  if (totalAtCost === 0) return 0;
  return (oddsPct / 100) * (remaining / totalAtCost);
}

/** P(at least one copy in N shops, each shop = 5 slots) = 1 - (1 - p_slot)^(5N). */
function pAtLeastOne(pSlot: number, shops: number): number {
  if (pSlot <= 0) return 0;
  return 1 - Math.pow(1 - pSlot, 5 * shops);
}

/** Expected number of copies found in N shops = 5N × p_slot. */
function expectedCopies(pSlot: number, shops: number): number {
  return 5 * shops * pSlot;
}

/** Interest earned at a given gold amount: floor(gold/10), cap 5. */
function interestFor(gold: number): number {
  return Math.min(5, Math.floor(gold / 10));
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Calculator() {
  const [tool, setTool] = useState<"reroll" | "economy">("reroll");

  return (
    <div className="space-y-4">
      {/* Tool switcher */}
      <div className="flex items-center gap-2">
        <div className="tft-glass flex rounded-xl border border-zinc-800/80 p-1">
          <button
            onClick={() => setTool("reroll")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              tool === "reroll"
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Dice5 className="h-4 w-4" />
            Reroll Olasılık
          </button>
          <button
            onClick={() => setTool("economy")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              tool === "economy"
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Coins className="h-4 w-4" />
            Ekonomi Planlayıcı
          </button>
        </div>
      </div>

      {tool === "reroll" ? <RerollCalculator /> : <EconomyPlanner />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// REROLL CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

function RerollCalculator() {
  const [cost, setCost] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [level, setLevel] = useState(7);
  const [rolls, setRolls] = useState(10);
  const [taken, setTaken] = useState(0);

  const odds = shopOddsForLevel(level);
  const pSlot = pSlotIsTarget(level, cost, taken);
  const pAtLeast = pAtLeastOne(pSlot, rolls);
  const expected = expectedCopies(pSlot, rolls);
  const poolSize = poolForCost(cost);
  const nChamps = CHAMPION_COUNT_BY_COST[cost];

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Inputs */}
      <Card className="tft-glass border-zinc-800/80">
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-1.5 text-zinc-500">
            <Dice5 className="h-3.5 w-3.5" /> Ayarlar
          </CardDescription>
          <CardTitle className="text-base">Hangi şampiyonu arıyorsun?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cost selector */}
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
              Şampiyon maliyeti
            </label>
            <div className="flex gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCost(c)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-all ${
                    cost === c
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  {c}g
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              {nChamps} farklı şampiyon · havuzda {poolSize} kopya/şampiyon
            </p>
          </div>

          {/* Level slider */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                Oyuncu seviyesi
              </label>
              <Badge variant="outline" className="border-violet-500/40 text-violet-300 bg-violet-500/10 text-xs">
                Level {level}
              </Badge>
            </div>
            <input
              type="range"
              min={1}
              max={11}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="mt-1.5 flex justify-between gap-1 text-[9px] text-zinc-600">
              {(odds as number[]).map((o, i) => (
                <span key={i} className={o > 0 ? "text-zinc-400" : ""}>
                  {i + 1}g: {o}%
                </span>
              ))}
            </div>
          </div>

          {/* Rolls slider */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                Kaç kez reroll?
              </label>
              <Badge variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-500/10 text-xs">
                {rolls} roll = {rolls * 2}g
              </Badge>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={rolls}
              onChange={(e) => setRolls(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>

          {/* Taken (contested) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                Kaç kopya alındı? (contested)
              </label>
              <Badge variant="outline" className="border-red-500/40 text-red-300 bg-red-500/10 text-xs">
                {taken} / {poolSize}
              </Badge>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, poolSize - 1)}
              value={taken}
              onChange={(e) => setTaken(Number(e.target.value))}
              className="w-full accent-red-500"
            />
            <p className="mt-1 text-[10px] text-zinc-600">
              Rakipler bu şampiyondan kaç tane almış? (havuzda {poolSize - taken} kopya kaldı)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="tft-glass border-zinc-800/80">
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-1.5 text-zinc-500">
            <Target className="h-3.5 w-3.5" /> Sonuç
          </CardDescription>
          <CardTitle className="text-base">Bulma olasılığı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Big probability */}
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 text-center">
            <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
              {rolls} reroll sonunda en az 1 tane bulma
            </div>
            <div className="mt-1 text-4xl font-black tabular-nums text-amber-300">
              {pct(pAtLeast)}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              beklenen kopya: <span className="font-semibold text-amber-200">{expected.toFixed(2)}</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <Info className="h-3 w-3" /> Matematik
            </div>
            <div className="space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
              <div>
                <span className="text-zinc-600"># 1 slot olasılığı:</span>
              </div>
              <div className="pl-3 text-zinc-300">
                p = (odds% / 100) × (kalan / toplam)
              </div>
              <div className="pl-3 text-zinc-300">
                p = ({odds[cost - 1]}% / 100) × ({poolSize - taken} / {poolSize * nChamps})
              </div>
              <div className="pl-3 text-amber-300">
                p = {pSlot.toFixed(5)} = {pct(pSlot)}
              </div>
              <div className="mt-2 text-zinc-600"># {rolls} reroll (her biri 5 slot):</div>
              <div className="pl-3 text-zinc-300">
                P = 1 - (1 - p)<sup>{5 * rolls}</sup>
              </div>
              <div className="pl-3 text-amber-300">
                P = {pct(pAtLeast)}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="1 shop" value={pct(pAtLeastOne(pSlot, 1))} color="text-zinc-300" />
            <StatBox label="5 reroll" value={pct(pAtLeastOne(pSlot, 5))} color="text-sky-300" />
            <StatBox label="20 reroll" value={pct(pAtLeastOne(pSlot, 20))} color="text-amber-300" />
          </div>

          {/* Advice */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs text-zinc-400">
            <div className="mb-1 flex items-center gap-1.5 text-zinc-300">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              {pAtLeast >= 0.8
                ? "Çok yüksek olasılık — güvenle reroll yapabilirsin."
                : pAtLeast >= 0.5
                ? "Farklı — birkaç reroll daha denenebilir."
                : pAtLeast >= 0.25
                ? "Düşük — daha fazla reroll veya seviye yükseltme gerekebilir."
                : "Çok düşük — seviye yükselt ya da başka comp ara."}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2 text-center">
      <div className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ECONOMY PLANNER
// ════════════════════════════════════════════════════════════════════════════

function EconomyPlanner() {
  const [gold, setGold] = useState(34);
  const [level, setLevel] = useState(7);
  const [streak, setStreak] = useState<"" | "win" | "loss">("");
  const [rounds, setRounds] = useState(5);

  const interest = interestFor(gold);
  const nextBp = gold >= 50 ? 50 : Math.min(50, (Math.floor(gold / 10) + 1) * 10);
  const goldToNext = Math.max(0, nextBp - gold);

  // Income per round: base 5 + interest + streak bonus
  // Streak bonus: win streak 2+ = 1g, 4+ = 3g, 7+ = 5g (simplified)
  // Loss streak: 3+ = 1g, 5+ = 3g, 7+ = 5g (simplified)
  const streakBonus =
    streak === "win"
      ? 2
      : streak === "loss"
      ? 2
      : 0;

  const incomePerRound = 5 + interest + streakBonus;

  // Projection: simulate N rounds, capping interest at 5
  const projection = useMemo(() => {
    const rows: { round: number; gold: number; interest: number; income: number }[] = [];
    let g = gold;
    for (let r = 1; r <= rounds; r++) {
      const intr = interestFor(g);
      const inc = 5 + intr + streakBonus;
      rows.push({ round: r, gold: g, interest: intr, income: inc });
      g += inc;
    }
    return rows;
  }, [gold, rounds, streakBonus]);

  const finalGold = projection.length > 0 ? projection[projection.length - 1].gold : gold;

  // Level-up cost
  const xpNeeded = xpForLevel(level);
  const goldToLvl = goldToNextLevel(level);
  const canLevelNow = gold >= goldToLvl && level < 10;
  const roundsToLevel = goldToLvl > gold ? Math.ceil((goldToLvl - gold) / incomePerRound) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Inputs */}
      <Card className="tft-glass border-zinc-800/80">
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-1.5 text-zinc-500">
            <Coins className="h-3.5 w-3.5" /> Durumun
          </CardDescription>
          <CardTitle className="text-base">Ekonomi planlayıcı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gold slider */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">Mevcut gold</label>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-xs">
                {gold}g
              </Badge>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={gold}
              onChange={(e) => setGold(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="mt-1 flex justify-between text-[9px] text-zinc-600">
              <span>0g</span>
              <span>50g (max interest)</span>
              <span>100g</span>
            </div>
          </div>

          {/* Level slider */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">Seviye</label>
              <Badge variant="outline" className="border-violet-500/40 text-violet-300 bg-violet-500/10 text-xs">
                Level {level}
              </Badge>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
          </div>

          {/* Streak */}
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
              Streak durumu
            </label>
            <div className="flex gap-1.5">
              {([
                { v: "", label: "Yok", color: "zinc" },
                { v: "win", label: "Win streak", color: "orange" },
                { v: "loss", label: "Loss streak", color: "cyan" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setStreak(opt.v)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
                    streak === opt.v
                      ? opt.color === "orange"
                        ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                        : opt.color === "cyan"
                        ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                        : "border-zinc-500/50 bg-zinc-700/30 text-zinc-200"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              Streak bonusu (basitleştirilmiş): +{streakBonus}g/tur
            </p>
          </div>

          {/* Rounds to project */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                Kaç tur ileri project et?
              </label>
              <Badge variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-500/10 text-xs">
                {rounds} tur
              </Badge>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="tft-glass border-zinc-800/80">
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-1.5 text-zinc-500">
            <TrendingUp className="h-3.5 w-3.5" /> Analiz
          </CardDescription>
          <CardTitle className="text-base">Ekonomi durumu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Current econ snapshot */}
          <div className="grid grid-cols-3 gap-2">
            <EconBox label="Faiz" value={`${interest}g`} sub="gold÷10, cap 5" color="text-amber-300" />
            <EconBox label="Tur geliri" value={`${incomePerRound}g`} sub="5 + faiz + streak" color="text-emerald-300" />
            <EconBox label="Sonraka BP" value={`${nextBp}g`} sub={`${goldToNext}g kaldı`} color="text-sky-300" />
          </div>

          {/* Interest breakpoints visualization */}
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              Faiz kırılma noktaları
            </div>
            <div className="flex gap-1">
              {[0, 10, 20, 30, 40, 50].map((bp) => {
                const reached = gold >= bp;
                const isNext = bp === nextBp && gold < 50;
                return (
                  <div
                    key={bp}
                    className={`flex-1 rounded-md border py-1.5 text-center text-[10px] font-medium transition-all ${
                      reached
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : isNext
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-zinc-800 bg-zinc-900/40 text-zinc-600"
                    }`}
                  >
                    {bp}g
                    <div className="text-[8px] opacity-70">
                      {reached ? `${bp / 10}g faiz` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Level up info */}
          <div className={`rounded-lg border p-3 transition-all ${
            canLevelNow
              ? "border-violet-500/40 bg-violet-500/10"
              : "border-zinc-800/80 bg-zinc-900/40"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowUpCircle className={`h-4 w-4 ${canLevelNow ? "text-violet-400" : "text-zinc-500"}`} />
                <span className="text-sm font-medium text-zinc-200">
                  Level {level} → {level + 1}
                </span>
              </div>
              <Badge
                variant="outline"
                className={
                  canLevelNow
                    ? "border-violet-500/40 text-violet-300 bg-violet-500/10 text-[10px]"
                    : "border-zinc-700 text-zinc-500 text-[10px]"
                }
              >
                {goldToLvl}g
              </Badge>
            </div>
            <div className="mt-1.5 text-[11px] text-zinc-500">
              {level >= 10 ? (
                "Maksimum seviyede."
              ) : canLevelNow ? (
                <span className="text-violet-300">
                  Hemen level atlayabilirsin! ({xpNeeded} XP gerekli, {Math.ceil(xpNeeded / 4)} XP alımı)
                </span>
              ) : (
                <>
                  {goldToLvl - gold}g daha gerekli · ~{roundsToLevel} tur sonra (gelir {incomePerRound}g/tur)
                </>
              )}
            </div>
          </div>

          {/* Projection table */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Tur projeksiyonu
              </span>
              <span className="text-[10px] text-zinc-600">
                {rounds} tur sonra: <span className="font-semibold text-amber-300">{finalGold}g</span>
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800/80 tft-scroll">
              <table className="w-full text-[11px] tabular-nums">
                <thead className="sticky top-0 bg-zinc-900 text-[9px] uppercase text-zinc-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Tur</th>
                    <th className="px-2 py-1.5 text-right">Gold</th>
                    <th className="px-2 py-1.5 text-right">Faiz</th>
                    <th className="px-2 py-1.5 text-right">Gelir</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.map((r) => (
                    <tr key={r.round} className="border-t border-zinc-800/60 text-zinc-400">
                      <td className="px-2 py-1.5 text-zinc-300">+{r.round}</td>
                      <td className="px-2 py-1.5 text-right text-amber-300">{r.gold}</td>
                      <td className="px-2 py-1.5 text-right">{r.interest}g</td>
                      <td className="px-2 py-1.5 text-right text-emerald-400">+{r.income}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Math explanation */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-[11px] text-zinc-500">
            <div className="mb-1 flex items-center gap-1.5 text-zinc-400">
              <CalcIcon className="h-3 w-3" /> Faiz formülü
            </div>
            <div className="font-mono text-zinc-400">
              faiz = min(5, gold ÷ 10) · her tur: 5g + faiz + streak
            </div>
            <div className="mt-1 font-mono text-zinc-500">
              50g'de dur → her tur 5+5=10g gelir → "roll above 50" stratejisi
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EconBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[9px] text-zinc-600">{sub}</div>
    </div>
  );
}
