"use client";

/**
 * All recommendation card components for the TFT advisor panel.
 * Pure presentational — take data as props, no fetching.
 *
 * Styling philosophy (v2 — premium redesign):
 *   - Glassmorphism surfaces with backdrop-blur and subtle gradients
 *   - Animated gradient borders on hero cards (OneLiner, ThreatLevel)
 *   - Glow effects that match each card's semantic color
 *   - Fade-in-up entrance animation on all cards
 *   - Progress bars with gradient fills and smooth transitions
 *   - Tooltips via `title` attr for truncated text
 *   - Consistent spacing (gap-3/gap-4, p-3/p-4)
 *   - Custom dark scrollbar for scroll areas
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Heart,
  Coins,
  Shield,
  Trophy,
  Flame,
  Snowflake,
  Swords,
  Target,
  Package,
  Clock,
  Layers,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowUpCircle,
  Zap,
  Skull,
  Gauge,
  ListChecks,
  Dice5,
  Crown,
  Copy,
  Check,
} from "lucide-react";
import type {
  FullRecommendation,
  GameState,
  EconomyRec,
  CompPlan,
  ShopRec,
  RerollRec,
  CarryTarget,
  BoardRec,
  ItemRec,
  StageRec,
  TraitStatus,
} from "@/lib/tft/state";
import { getChampion, shopOddsForLevel } from "@/lib/tft-data";
import { hpColor } from "@/lib/utils";

// ─── Stat bar (top, big numbers) ────────────────────────────────────────────

function hpBarColor(hp: number): string {
  if (hp <= 25) return "bg-gradient-to-r from-red-600 to-red-400";
  if (hp <= 50) return "bg-gradient-to-r from-orange-600 to-orange-400";
  if (hp <= 75) return "bg-gradient-to-r from-yellow-600 to-yellow-400";
  return "bg-gradient-to-r from-emerald-600 to-emerald-400";
}

/**
 * HP display sub-text. Shows "/ 100" normally, but if HP exceeds 100 (augment
 * bonus), shows "/ {hp}" to indicate the augmented max. If HP > 100 and
 * it's not the starting value, we know the player has bonus HP from augments.
 */
function hpSub(hp: number, connected: boolean): string {
  if (!connected) return "maçta değil";
  return hp > 100 ? `/ ${hp}` : "/ 100";
}

export function StatBar({ state }: { state: GameState }) {
  const stageStr = `${state.stage}-${state.round}`;
  const streakLabel =
    state.streak > 0
      ? `${state.streak}W`
      : state.streak < 0
      ? `${Math.abs(state.streak)}L`
      : "—";
  const interest = Math.min(5, Math.floor(state.gold / 10));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatTile
        icon={<Heart className="h-4 w-4" />}
        iconBg="bg-red-500/10"
        iconColor="text-red-400"
        label="HP"
        value={state.connected ? String(state.hp) : "--"}
        valueClass={state.connected ? hpColor(state.hp) : "text-zinc-500"}
        sub={hpSub(state.hp, state.connected)}
        progress={state.connected ? (state.hp / 150) * 100 : undefined}
        progressClass={state.connected ? hpBarColor(state.hp) : undefined}
        delay="0ms"
      />
      <StatTile
        icon={<Coins className="h-4 w-4" />}
        iconBg="bg-amber-500/10"
        iconColor="text-amber-400"
        label="Gold"
        value={state.connected ? String(state.gold) : "--"}
        valueClass={state.connected ? "text-amber-400" : "text-zinc-500"}
        sub={state.connected ? `faiz ${interest}g` : ""}
        progress={state.connected ? Math.min(100, (state.gold / 150) * 100) : undefined}
        progressClass="bg-gradient-to-r from-amber-600 to-amber-400"
        delay="60ms"
      />
      <StatTile
        icon={<Shield className="h-4 w-4" />}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-400"
        label="Level"
        value={state.connected ? String(state.level) : "--"}
        valueClass={state.connected ? "text-violet-400" : "text-zinc-500"}
        sub={state.connected ? (state.level >= 9 ? "MAX" : `/ ${state.level + 1}`) : ""}
        progress={state.connected ? Math.min(100, (state.level / 9) * 100) : undefined}
        progressClass="bg-gradient-to-r from-violet-600 to-violet-400"
        delay="120ms"
      />
      <StatTile
        icon={<Trophy className="h-4 w-4" />}
        iconBg="bg-sky-500/10"
        iconColor="text-sky-400"
        label="Stage"
        value={state.connected ? stageStr : "--"}
        valueClass={state.connected ? "text-sky-400" : "text-zinc-500"}
        sub={state.connected ? phaseLabel(state.stage) : ""}
        progress={state.connected ? Math.min(100, ((state.stage - 1) / 6) * 100) : undefined}
        progressClass="bg-gradient-to-r from-sky-600 to-sky-400"
        delay="180ms"
      />
      <StatTile
        icon={state.streak >= 0 ? <Flame className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
        iconBg={state.streak >= 0 ? "bg-orange-500/10" : "bg-cyan-500/10"}
        iconColor={state.streak >= 0 ? "text-orange-400" : "text-cyan-400"}
        label="Streak"
        value={state.connected ? streakLabel : "--"}
        valueClass={
          !state.connected
            ? "text-zinc-500"
            : state.streak > 0
            ? "text-orange-400"
            : state.streak < 0
            ? "text-cyan-400"
            : "text-zinc-400"
        }
        sub=""
        progress={state.connected ? Math.min(100, Math.abs(state.streak) * 20) : undefined}
        progressClass={state.streak >= 0 ? "bg-gradient-to-r from-orange-600 to-orange-400" : "bg-gradient-to-r from-cyan-600 to-cyan-400"}
        delay="240ms"
      />
    </div>
  );
}

function StatTile({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valueClass,
  sub,
  progress,
  progressClass,
  delay,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueClass: string;
  sub: string;
  progress?: number;
  progressClass?: string;
  delay?: string;
}) {
  return (
    <div
      className="tft-fade-up tft-glass group relative overflow-hidden rounded-xl border border-zinc-800/80 p-3 transition-all duration-300 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
      style={{ animationDelay: delay }}
    >
      {/* Subtle top sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg} ring-1 ring-white/5 ${iconColor}`}>
          {icon}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">{label}</div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums leading-none ${valueClass} tft-tabular`}>{value}</span>
        {sub && <span className="text-[10px] text-zinc-600">{sub}</span>}
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/60">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${progressClass ?? "bg-zinc-500"}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function phaseLabel(stage: number): string {
  if (stage <= 2) return "early";
  if (stage <= 4) return "mid";
  return "late";
}

// ─── One-liner (the single most important action) ───────────────────────────

export function OneLiner({ rec }: { rec: FullRecommendation }) {
  const text = rec.oneLiner || "—";
  const tone = oneLinerTone(text);
  const [copied, setCopied] = useState(false);

  const copyAdvice = () => {
    const ts = new Date(rec.computedAt || Date.now()).toLocaleTimeString("tr-TR");
    const advice = `TFT Adwer — ${ts}\n→ ${text}`;
    navigator.clipboard?.writeText(advice).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className={`tft-glow-border tft-fade-up relative overflow-hidden rounded-2xl border p-4 ${tone.border} ${tone.bg} flex items-start gap-3 transition-all duration-300 hover:shadow-2xl hover:shadow-black/40`}
      style={{ animationDelay: "300ms" }}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${tone.gradient} opacity-30 pointer-events-none`} />
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${tone.accent}`} />
      <div className={`relative mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${tone.iconBg} ${tone.icon}`}>
        {tone.iconNode}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">Şu an yap</div>
          <button
            onClick={copyAdvice}
            title="Öneriyi kopyala"
            className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <div className={`text-lg font-bold leading-snug ${tone.text} mt-0.5`}>{text}</div>
      </div>
      <div className="relative text-[10px] text-zinc-600 tabular-nums whitespace-nowrap mt-1">
        {new Date(rec.computedAt || Date.now()).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
    </div>
  );
}

function oneLinerTone(text: string): {
  border: string;
  bg: string;
  text: string;
  icon: string;
  iconBg: string;
  iconNode: React.ReactNode;
  gradient: string;
  accent: string;
} {
  const t = text.toLowerCase();
  if (t.includes("kritik") || t.includes("critical") || t.includes("roll down") || t.includes("survive")) {
    return {
      border: "border-red-500/40",
      bg: "bg-red-500/10",
      text: "text-red-300",
      icon: "text-red-400",
      iconBg: "bg-red-500/20",
      iconNode: <AlertTriangle className="h-5 w-5" />,
      gradient: "from-red-500/25 to-transparent",
      accent: "bg-red-500",
    };
  }
  if (t.includes("reroll") || t.includes("roll for") || t.includes("roll")) {
    return {
      border: "border-amber-500/40",
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      icon: "text-amber-400",
      iconBg: "bg-amber-500/20",
      iconNode: <Sparkles className="h-5 w-5" />,
      gradient: "from-amber-500/25 to-transparent",
      accent: "bg-amber-500",
    };
  }
  if (t.includes("level") || t.includes("push")) {
    return {
      border: "border-sky-500/40",
      bg: "bg-sky-500/10",
      text: "text-sky-300",
      icon: "text-sky-400",
      iconBg: "bg-sky-500/20",
      iconNode: <ArrowUpCircle className="h-5 w-5" />,
      gradient: "from-sky-500/25 to-transparent",
      accent: "bg-sky-500",
    };
  }
  if (t.includes("save") || t.includes("biriktir")) {
    return {
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      icon: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
      iconNode: <Coins className="h-5 w-5" />,
      gradient: "from-emerald-500/25 to-transparent",
      accent: "bg-emerald-500",
    };
  }
  return {
    border: "border-zinc-700",
    bg: "bg-zinc-800/40",
    text: "text-zinc-200",
    icon: "text-zinc-400",
    iconBg: "bg-zinc-700/40",
    iconNode: <Target className="h-5 w-5" />,
    gradient: "from-zinc-500/20 to-transparent",
    accent: "bg-zinc-500",
  };
}

// ─── Round actions (compact, round-based checklist for the live tab) ─────────
//
// Distills the full recommendation into a short numbered action list a player
// can scan in <5 seconds between rounds (rounds last ~30s). Each action is
// imperative and round-scoped, e.g. "50g kalana kadar roll at, Jhin ara".
// Derived client-side from the existing recommendation object — no advisor
// changes needed.

interface RoundAction {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  text: string;
}

function deriveRoundActions(rec: FullRecommendation, state: GameState): RoundAction[] {
  const actions: RoundAction[] = [];
  const econ = rec.economy;
  const carries = rec.carries;
  const topCarry =
    carries.find((c) => c.role === "carry" || c.role === "core") ?? carries[0];

  // 1. ECONOMY — the core decision this round (always first)
  if (econ.action === "reroll") {
    const critical = state.hp <= 25;
    const target = topCarry
      ? `, ${topCarry.name} ara (${topCarry.copiesHeld}/${topCarry.copiesNeeded3star})`
      : "";
    actions.push({
      id: "econ",
      icon: <Dice5 className="h-4 w-4" />,
      iconBg: "bg-red-500/15",
      iconColor: "text-red-300",
      label: critical ? "ACİL ROLL" : "ROLL",
      text: critical
        ? `Tüm altınla roll at — stabilize ol!${target}`
        : `${econ.nextThreshold}g kalana kadar roll at${target}`,
    });
  } else if (econ.action === "level") {
    actions.push({
      id: "econ",
      icon: <TrendingUp className="h-4 w-4" />,
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-300",
      label: "LEVEL",
      text: `Level ${econ.targetLevel}'e XP bas — 50g'de kal`,
    });
  } else if (econ.action === "save") {
    actions.push({
      id: "econ",
      icon: <Coins className="h-4 w-4" />,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-300",
      label: "BİRİKTİR",
      text: `${econ.nextThreshold}g'ye çıkart (${econ.goldToNext}g kaldı) — alım yapma`,
    });
  } else {
    // maintain
    actions.push({
      id: "econ",
      icon: <Gauge className="h-4 w-4" />,
      iconBg: "bg-zinc-500/15",
      iconColor: "text-zinc-300",
      label: "KORU",
      text: `${econ.nextThreshold}g'de kal, faizi koru — üstünü XP/roll`,
    });
  }

  // 2. SHOP BUYS — which champions to buy this round
  const buys = rec.shop.filter((s) => s.action === "buy" && s.champion);
  if (buys.length > 0) {
    actions.push({
      id: "shop",
      icon: <Package className="h-4 w-4" />,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-300",
      label: "SHOP",
      text: `Al: ${buys.map((b) => b.champion).join(", ")}`,
    });
  }

  // 3. ITEMS — top item(s) to build and who to put them on
  const topItems = rec.items.slice(0, 2);
  if (topItems.length > 0) {
    const text = topItems.map((i) => `${i.item} → ${i.champion}`).join(" · ");
    actions.push({
      id: "item",
      icon: <Swords className="h-4 w-4" />,
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-300",
      label: "ITEM",
      text,
    });
  }

  // 4. COMP — target comp + what's still missing
  if (rec.comp) {
    const c = rec.comp;
    if (c.missingCore.length > 0 && state.stage >= 3) {
      actions.push({
        id: "comp",
        icon: <Target className="h-4 w-4" />,
        iconBg: "bg-rose-500/15",
        iconColor: "text-rose-300",
        label: "COMP",
        text: `${c.name}: ${c.missingCore.slice(0, 2).join(", ")} bul`,
      });
    } else {
      actions.push({
        id: "comp",
        icon: <Target className="h-4 w-4" />,
        iconBg: "bg-rose-500/15",
        iconColor: "text-rose-300",
        label: "COMP",
        text: `${c.name} (${c.carry} carry)`,
      });
    }
  }

  return actions;
}

export function RoundActionsCard({
  rec,
  state,
}: {
  rec: FullRecommendation;
  state: GameState;
}) {
  const actions = deriveRoundActions(rec, state);
  const stageStr = `${state.stage}-${state.round}`;
  const phase = phaseLabel(state.stage);
  const phaseTr = phase === "early" ? "Erken" : phase === "mid" ? "Orta" : "Geç";
  const ts = new Date(rec.computedAt || Date.now()).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="tft-glow-border tft-fade-up relative overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900/70 p-4 transition-all duration-300 hover:shadow-2xl hover:shadow-black/40"
      style={{ animationDelay: "120ms" }}
    >
      {/* top sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
      {/* left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-amber-400/40" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90 font-bold leading-none">
              BU TUR NE YAP
            </div>
            <div className="text-xs text-zinc-400 leading-tight mt-1">
              <span className="font-mono font-semibold text-zinc-200">{stageStr}</span>
              <span className="text-zinc-600 mx-1">·</span>
              {phaseTr} oyun
            </div>
          </div>
        </div>
        <div className="text-[10px] text-zinc-600 tabular-nums">{ts}</div>
      </div>

      {/* Action list */}
      <ol className="relative space-y-1.5">
        {actions.map((a, i) => (
          <li
            key={a.id}
            className="flex items-start gap-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60 px-2.5 py-2 transition-colors hover:border-zinc-700"
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-400 tabular-nums mt-0.5">
              {i + 1}
            </span>
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${a.iconBg} ${a.iconColor}`}
            >
              {a.icon}
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-[9px] uppercase tracking-wide text-zinc-500 font-semibold leading-none mb-1">
                {a.label}
              </div>
              <div className="text-[13px] text-zinc-100 leading-snug">{a.text}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Threat Level card (NEW — danger meter) ─────────────────────────────────

/**
 * Computes a 0-100 "threat" score from HP, stage, and board coherence.
 * High threat = you are in danger of dying soon.
 *
 * Math (simple, transparent):
 *   - HP component: (100 - hp) weighted 0-50. Below 25 HP = max danger.
 *   - Stage component: stage >= 4 adds up to 20 (late game = scarier fights).
 *   - Board component: low coherence (unstable board) adds up to 30.
 */
export function ThreatLevelCard({ state, board }: { state: GameState; board: BoardRec }) {
  // HP > 100 (augment bonus) means player is healthier than base — threat from
  // HP is 0, not negative. Math.max(0, ...) clamps the negative result.
  const hpComponent = Math.max(0, Math.min(50, ((100 - state.hp) / 100) * 50));
  const stageComponent = state.stage >= 4 ? Math.min(20, (state.stage - 3) * 8) : 0;
  const boardComponent = board.coherence < 50 ? Math.min(30, (50 - board.coherence) * 0.6) : 0;
  // Clamp to 0-100. Without the lower bound, a very healthy player (HP=150,
  // stage=1, coherent board) could produce a negative threat score, which
  // would render a negative-width progress bar.
  const threat = Math.round(Math.max(0, Math.min(100, hpComponent + stageComponent + boardComponent)));

  const level = threat >= 70 ? "critical" : threat >= 45 ? "high" : threat >= 20 ? "moderate" : "safe";
  const config = {
    critical: { label: "KRİTİK", color: "text-red-300", bar: "bg-gradient-to-r from-red-600 to-red-400", border: "border-red-500/40", bg: "bg-red-500/10", icon: <Skull className="h-5 w-5" />, pulse: true },
    high: { label: "YÜKSEK", color: "text-orange-300", bar: "bg-gradient-to-r from-orange-600 to-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10", icon: <AlertTriangle className="h-5 w-5" />, pulse: false },
    moderate: { label: "ORTA", color: "text-amber-300", bar: "bg-gradient-to-r from-amber-600 to-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/10", icon: <Gauge className="h-5 w-5" />, pulse: false },
    safe: { label: "GÜVENLİ", color: "text-emerald-300", bar: "bg-gradient-to-r from-emerald-600 to-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10", icon: <Shield className="h-5 w-5" />, pulse: false },
  }[level];

  return (
    <Card className={`tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30 ${config.border}`} style={{ animationDelay: "60ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Gauge className="h-3.5 w-3.5" /> Tehlike seviyesi
        </CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span className={`text-lg ${config.color} ${config.pulse ? "tft-danger-pulse" : ""}`}>{config.label}</span>
          <span className={`text-2xl font-black tabular-nums ${config.color} tft-tabular`}>{threat}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/60">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${config.bar}`}
            style={{ width: `${threat}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="rounded-md border border-zinc-800/60 bg-zinc-950/40 px-1.5 py-1">
            <div className="text-zinc-600 uppercase tracking-wide">HP</div>
            <div className="text-zinc-300 font-semibold tabular-nums">{Math.round(hpComponent)}/50</div>
          </div>
          <div className="rounded-md border border-zinc-800/60 bg-zinc-950/40 px-1.5 py-1">
            <div className="text-zinc-600 uppercase tracking-wide">Sahne</div>
            <div className="text-zinc-300 font-semibold tabular-nums">{Math.round(stageComponent)}/20</div>
          </div>
          <div className="rounded-md border border-zinc-800/60 bg-zinc-950/40 px-1.5 py-1">
            <div className="text-zinc-600 uppercase tracking-wide">Tahta</div>
            <div className="text-zinc-300 font-semibold tabular-nums">{Math.round(boardComponent)}/30</div>
          </div>
        </div>
        {level === "critical" && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[11px] text-red-300/90">
            Stabiliteye odaklan — reroll ile güçlen ya da level atla.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Shop Odds card (NEW — roll probabilities at current level) ─────────────

/**
 * Shows the shop roll odds (% per cost tier) at the player's current level.
 * Helps the player understand what they're likely to see when rerolling.
 */
export function ShopOddsCard({ level }: { level: number }) {
  const odds = shopOddsForLevel(level);
  const costs = [
    { cost: 1, color: "from-zinc-500 to-zinc-400", text: "text-zinc-300" },
    { cost: 2, color: "from-emerald-600 to-emerald-400", text: "text-emerald-300" },
    { cost: 3, color: "from-sky-600 to-sky-400", text: "text-sky-300" },
    { cost: 4, color: "from-violet-600 to-violet-400", text: "text-violet-300" },
    { cost: 5, color: "from-amber-600 to-amber-400", text: "text-amber-300" },
  ];

  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "120ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Dice5 className="h-3.5 w-3.5" /> Shop oranları
        </CardDescription>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Level {level} şansları</span>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">
            her rulo 2g
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {costs.map((c) => {
          const pct = odds[c.cost - 1] ?? 0;
          return (
            <div key={c.cost} className="flex items-center gap-2">
              <Badge variant="outline" className="w-8 justify-center text-[10px] tabular-nums border-zinc-700 text-zinc-400">
                {c.cost}g
              </Badge>
              <div className="flex-1 h-5 overflow-hidden rounded-md bg-zinc-800/50 relative">
                <div
                  className={`h-full rounded-md bg-gradient-to-r ${c.color} transition-all duration-500`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
                <span className={`absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold tabular-nums ${pct > 15 ? "text-zinc-100" : "text-zinc-500"}`}>
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
        <div className="mt-1 flex items-start gap-1 text-[10px] text-zinc-600">
          <AlertTriangle className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
          <span>Level yükseldikçe pahalı şampiyon görme şansı artar.</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Win Condition card (NEW — comp completion checklist) ──────────────────

/**
 * Shows what you still need to complete your chosen comp:
 * missing core champions, inactive key traits, missing items.
 */
export function WinConditionCard({ comp, state, board }: { comp: CompPlan | null; state: GameState; board: BoardRec }) {
  if (!comp) {
    return (
      <Card className="tft-glass tft-fade-up border-zinc-800/80" style={{ animationDelay: "180ms" }}>
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-1.5 text-zinc-500">
            <ListChecks className="h-3.5 w-3.5" /> Kazanım koşulu
          </CardDescription>
          <CardTitle className="text-zinc-400 text-base">Comp yok</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Comp belirlenince kazanım koşulları burada görünür.
        </CardContent>
      </Card>
    );
  }

  const boardNames = new Set(state.board.map((b) => b.name));
  const benchNames = new Set(state.bench.map((b) => b.name));
  const have = (n: string) => boardNames.has(n) || benchNames.has(n);

  const coreMissing = comp.core.filter((n) => !have(n));
  const coreHave = comp.core.length - coreMissing.length;
  const inactiveKeyTraits = board.activeTraits.filter(
    (t) => comp.keyTraits.includes(t.name) && !t.active,
  );
  const oneAwayTraits = board.activeTraits.filter(
    (t) => comp.keyTraits.includes(t.name) && t.oneAway,
  );

  const completionPct = comp.core.length > 0 ? Math.round((coreHave / comp.core.length) * 100) : 0;

  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "180ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <ListChecks className="h-3.5 w-3.5" /> Kazanım koşulu
        </CardDescription>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="truncate">{comp.name}</span>
          <span className={`text-sm font-bold tabular-nums ${completionPct === 100 ? "text-emerald-400" : completionPct >= 60 ? "text-amber-400" : "text-zinc-400"}`}>
            {coreHave}/{comp.core.length}
          </span>
        </CardTitle>
        <Progress value={completionPct} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Core champions checklist */}
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
            <Crown className="h-3 w-3 text-amber-400/70" /> Core birimler
          </div>
          <div className="space-y-1">
            {comp.core.map((name) => {
              const owned = have(name);
              const champ = getChampion(name);
              return (
                <div key={name} className="flex items-center gap-2 text-xs">
                  {owned ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-zinc-700 flex-shrink-0" />
                  )}
                  <span className={owned ? "text-zinc-400 line-through/0" : "text-zinc-200 font-medium"}>{name}</span>
                  {champ && <span className="text-[9px] text-zinc-600 ml-auto">{champ.cost}g</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inactive key traits */}
        {inactiveKeyTraits.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-amber-400/80 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Aktif olmayan traitler
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inactiveKeyTraits.map((t) => (
                <Badge key={t.name} variant="outline" className="border-amber-500/30 text-amber-300/80 text-[10px]">
                  {t.name} {t.count}/{t.nextBreakpoint ?? "?"}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* One-away traits */}
        {oneAwayTraits.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-emerald-400/80 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> 1 birim kaldı
            </div>
            <div className="flex flex-wrap gap-1.5">
              {oneAwayTraits.map((t) => (
                <Badge key={t.name} variant="outline" className="border-emerald-500/30 text-emerald-300 text-[10px]">
                  {t.name} {t.count}/{t.nextBreakpoint}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {completionPct === 100 && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[11px] text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Comp tamam! Şimdi yıldız yükselt ve item topla.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Economy card ───────────────────────────────────────────────────────────

export function EconomyCard({ econ }: { econ: EconomyRec }) {
  const actionTone = econActionTone(econ.action);
  return (
    <Card className={`tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30 ${actionTone.glow}`} style={{ animationDelay: "240ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Coins className="h-3.5 w-3.5" /> Ekonomi
        </CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span className={`text-lg ${actionTone.text}`}>{econActionLabel(econ.action)}</span>
          <Badge variant="outline" className={actionTone.badge}>
            {econ.action.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-zinc-300 leading-snug">{econ.reason}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Faiz" value={`${econ.interest}g`} icon={<Coins className="h-3 w-3" />} />
          <Info label="Hedef level" value={String(econ.targetLevel)} icon={<ArrowUpCircle className="h-3 w-3" />} />
          <Info label="Sonraki eşik" value={`${econ.nextThreshold}g`} icon={<TrendingUp className="h-3 w-3" />} />
          <Info
            label="Eşiğe kalan"
            value={econ.goldToNext > 0 ? `${econ.goldToNext}g` : "—"}
            highlight={econ.goldToNext > 0 && econ.goldToNext <= 10}
            icon={<Target className="h-3 w-3" />}
          />
        </div>
        {/* Interest progress bar (max 5 = 50g) */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
            <span>Faiz seviyesi</span>
            <span className="tabular-nums">{econ.interest}/5</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  i <= econ.interest
                    ? "bg-gradient-to-r from-amber-600 to-amber-400"
                    : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function econActionLabel(a: string): string {
  switch (a) {
    case "save":
      return "Biriktir";
    case "level":
      return "Level at";
    case "reroll":
      return "Reroll yap";
    case "maintain":
      return "Koru";
    default:
      return a;
  }
}

function econActionTone(a: string): { text: string; badge: string; glow: string } {
  switch (a) {
    case "reroll":
      return { text: "text-amber-300", badge: "border-amber-500/40 text-amber-300", glow: "hover:shadow-amber-500/10" };
    case "level":
      return { text: "text-sky-300", badge: "border-sky-500/40 text-sky-300", glow: "hover:shadow-sky-500/10" };
    case "save":
      return { text: "text-emerald-300", badge: "border-emerald-500/40 text-emerald-300", glow: "hover:shadow-emerald-500/10" };
    default:
      return { text: "text-zinc-200", badge: "border-zinc-600 text-zinc-300", glow: "" };
  }
}

function Info({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 transition-colors ${
      highlight ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-800/80 bg-zinc-950/50"
    }`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
        {icon}
        {label}
      </div>
      <div
        className={`text-sm font-semibold tabular-nums ${
          highlight ? "text-amber-300" : "text-zinc-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Comp card ──────────────────────────────────────────────────────────────

export function CompCard({ comp, state }: { comp: CompPlan | null; state: GameState }) {
  if (!comp) {
    return (
      <Card className="tft-glass tft-fade-up border-zinc-800/80" style={{ animationDelay: "300ms" }}>
        <CardHeader className="pb-3">
          <CardDescription className="flex items-center gap-1.5 text-zinc-500">
            <Layers className="h-3.5 w-3.5" /> Comp
          </CardDescription>
          <CardTitle className="text-zinc-400 text-base">Henüz comp yok</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          {state.stage <= 2
            ? "Early game — en iyi tahtanı oyna, henüz bağlanma."
            : "Tahta yön belirleyene kadar comp önerilmiyor."}
        </CardContent>
      </Card>
    );
  }

  const tierTone =
    comp.tier === "S"
      ? "border-amber-500/50 text-amber-300 bg-amber-500/10"
      : comp.tier === "A"
      ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10"
      : "border-zinc-600 text-zinc-300";

  const tierGlow =
    comp.tier === "S"
      ? "hover:shadow-amber-500/10"
      : comp.tier === "A"
      ? "hover:shadow-emerald-500/10"
      : "";

  const boardNames = new Set(state.board.map((b) => b.name));
  const benchNames = new Set(state.bench.map((b) => b.name));

  return (
    <Card className={`tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30 ${tierGlow}`} style={{ animationDelay: "300ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Layers className="h-3.5 w-3.5" /> Comp
          {comp.pivotFrom && (
            <Badge variant="outline" className="ml-auto border-amber-500/40 text-amber-300">
              pivot: {comp.pivotFrom}
            </Badge>
          )}
        </CardDescription>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>{comp.name}</span>
          <Badge variant="outline" className={tierTone}>
            {comp.tier}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <Swords className="h-3 w-3" /> Carry: <b className="text-zinc-200">{comp.carry}</b>
          </span>
          <span>{comp.playstyle}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
            <span>Güven</span>
            <span className="tabular-nums">{Math.round(comp.confidence)}%</span>
          </div>
          <Progress value={comp.confidence} className="h-1.5" />
        </div>

        <p className="text-zinc-300 leading-snug">{comp.strategy}</p>

        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
            Core birimler
          </div>
          <div className="flex flex-wrap gap-1.5">
            {comp.core.map((name) => {
              const have = boardNames.has(name) || benchNames.has(name);
              const champ = getChampion(name);
              return (
                <TooltipProvider key={name} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={`cursor-help transition-all hover:scale-105 ${
                          have
                            ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                            : "border-zinc-700 text-zinc-400"
                        }`}
                      >
                        {have && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {name}
                        {champ && <span className="ml-1 text-[9px] opacity-60">{champ.cost}g</span>}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="bg-zinc-900 border-zinc-700 text-xs">
                      <p className="font-medium">{name}</p>
                      {champ && (
                        <p className="text-zinc-400 text-[10px]">{champ.cost}g · {champ.role} · {champ.traits.join(", ")}</p>
                      )}
                      <p className="text-zinc-500 text-[10px] mt-0.5">{have ? "✓ Sahip" : "✗ Eksik"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {comp.missingCore.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-400">
              <AlertTriangle className="h-3 w-3" /> Eksik core
            </div>
            <div className="flex flex-wrap gap-1.5">
              {comp.missingCore.map((name) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="border-amber-500/30 text-amber-300/80"
                >
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {comp.keyTraits.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
              Ana traitler
            </div>
            <div className="flex flex-wrap gap-1.5">
              {comp.keyTraits.map((t) => (
                <Badge key={t} variant="secondary" className="bg-zinc-800 text-zinc-300">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Shop card ──────────────────────────────────────────────────────────────

export function ShopCard({
  shop,
  reroll,
  state,
}: {
  shop: ShopRec[];
  reroll: RerollRec;
  state: GameState;
}) {
  const buyCount = shop.filter((s) => s.action === "buy").length;
  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "360ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Package className="h-3.5 w-3.5" /> Shop
        </CardDescription>
        <CardTitle className="flex items-center justify-between text-base">
          <span>5 şerit</span>
          <span className="text-xs font-normal text-zinc-500 flex items-center gap-1.5">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 text-[10px]">{buyCount} al</Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px]">{5 - buyCount} geç</Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {state.shop.every((s) => !s) ? (
          <div className="text-sm text-zinc-500 py-2">Shop okunamadı.</div>
        ) : (
          shop.map((s) => <ShopSlot key={s.slot} rec={s} />)
        )}
        <Separator className="my-2 bg-zinc-800" />
        <div
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-all ${
            reroll.should
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-zinc-800 bg-zinc-950/50 text-zinc-400"
          }`}
        >
          <Sparkles className={`h-3.5 w-3.5 ${reroll.should ? "text-amber-400 animate-pulse" : "text-zinc-500"}`} />
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Reroll:</span>
          <span className="flex-1">{reroll.reason}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ShopSlot({ rec }: { rec: ShopRec }) {
  const buy = rec.action === "buy";
  const champ = getChampion(rec.champion);
  const costColor = champ ? COST_TEXT[champ.cost] : "text-zinc-300";
  const costBorder = champ ? COST_BORDER[champ.cost] : "border-zinc-800";
  return (
    <div
      className={`group/slot flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all hover:scale-[1.02] ${
        buy
          ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
          : `${costBorder} bg-zinc-950/40`
      }`}
    >
      <div className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold tabular-nums ${
        buy ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"
      }`}>
        {rec.slot + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold truncate ${costColor}`}>
          {rec.champion || "—"}
          {champ && <span className="ml-1 text-[10px] text-zinc-500">{champ.cost}g</span>}
        </div>
        <div className="text-[11px] text-zinc-500 truncate" title={rec.reason}>{rec.reason}</div>
      </div>
      {buy ? (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 group-hover/slot:scale-110 transition-transform">AL</Badge>
      ) : (
        <Badge variant="outline" className="text-zinc-500 border-zinc-700">GEÇ</Badge>
      )}
    </div>
  );
}

const COST_TEXT: Record<number, string> = {
  1: "text-zinc-200",
  2: "text-emerald-300",
  3: "text-sky-300",
  4: "text-violet-300",
  5: "text-amber-300",
};

const COST_BORDER: Record<number, string> = {
  1: "border-zinc-800",
  2: "border-emerald-900/40",
  3: "border-sky-900/40",
  4: "border-violet-900/40",
  5: "border-amber-900/40",
};

// ─── Carries card ───────────────────────────────────────────────────────────

export function CarriesCard({ carries }: { carries: CarryTarget[] }) {
  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "420ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Target className="h-3.5 w-3.5" /> Carry hedefleri
        </CardDescription>
        <CardTitle className="text-base">Yıldız öncelikleri</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-y-auto tft-scroll">
          <div className="space-y-2">
            {carries.length === 0 && (
              <div className="text-sm text-zinc-500 py-2">Henüz carry hedefi yok.</div>
            )}
            {carries.map((c) => (
              <CarryRow key={c.name} c={c} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CarryRow({ c }: { c: CarryTarget }) {
  const roleBadge =
    c.role === "carry"
      ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
      : c.role === "core"
      ? "border-violet-500/40 text-violet-300 bg-violet-500/10"
      : c.role === "trait_bot"
      ? "border-zinc-600 text-zinc-400"
      : "border-zinc-700 text-zinc-400";
  const champ = getChampion(c.name);
  const costColor = champ ? COST_TEXT[champ.cost] : "text-zinc-200";
  const starIcons = c.starGoal === 3 ? "★★★" : "★★";
  return (
    <div className="group/carry rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5 transition-all hover:border-zinc-700 hover:bg-zinc-950/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${costColor}`}>{c.name}</span>
          <span className="text-amber-400 text-xs">{starIcons}</span>
        </div>
        <Badge variant="outline" className={roleBadge}>
          {c.role === "trait_bot" ? "trait-bot" : c.role}
        </Badge>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
        <span className="flex items-center gap-0.5">
          <Package className="h-2.5 w-2.5" /> {c.copiesHeld}
        </span>
        <span className="text-zinc-700">•</span>
        <span>
          hedef: <b className="text-zinc-300">{c.starGoal}★</b>
        </span>
        {c.starGoal === 3 && c.copiesNeeded3star > 0 && (
          <>
            <span className="text-zinc-700">•</span>
            <span className="text-amber-400/80">{c.copiesNeeded3star} kopya daha</span>
          </>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Progress value={c.score} className="h-1 flex-1" />
        <span className="text-[10px] tabular-nums text-zinc-500">{Math.round(c.score)}</span>
      </div>
      {c.reason && <div className="mt-1 text-[11px] text-zinc-500 leading-snug">{c.reason}</div>}
    </div>
  );
}

// ─── Board card ─────────────────────────────────────────────────────────────

export function BoardCard({ board }: { board: BoardRec }) {
  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "480ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Layers className="h-3.5 w-3.5" /> Tahta analizi
        </CardDescription>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Uyum</span>
          <span
            className={`text-lg font-bold tabular-nums ${
              board.coherence >= 70
                ? "text-emerald-400"
                : board.coherence >= 40
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {board.coherence}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Progress value={board.coherence} className="h-1.5" />

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 py-1.5">
            <div className="text-[10px] uppercase text-zinc-500 flex items-center justify-center gap-1">
              <Shield className="h-2.5 w-2.5" /> Front
            </div>
            <div className="text-base font-bold text-zinc-200">{board.frontline}</div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 py-1.5">
            <div className="text-[10px] uppercase text-zinc-500 flex items-center justify-center gap-1">
              <Swords className="h-2.5 w-2.5" /> Back
            </div>
            <div className="text-base font-bold text-zinc-200">{board.backline}</div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 py-1.5">
            <div className="text-[10px] uppercase text-zinc-500 flex items-center justify-center gap-1">
              <Target className="h-2.5 w-2.5" /> Carry
            </div>
            <div className="text-base font-bold text-zinc-200">{board.carries}</div>
          </div>
        </div>

        {board.activeTraits.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
              Aktif traitler
            </div>
            <div className="flex flex-wrap gap-1.5">
              {board.activeTraits.map((t) => (
                <TraitBadge key={t.name} t={t} />
              ))}
            </div>
          </div>
        )}

        {board.suggestions.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Öneriler</div>
            <ul className="space-y-1 text-xs text-zinc-400">
              {board.suggestions.map((s, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-amber-500/60">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TraitBadge({ t }: { t: TraitStatus }) {
  const tone = t.active
    ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
    : t.oneAway
    ? "border-amber-500/40 text-amber-300 bg-amber-500/5"
    : "border-zinc-700 text-zinc-500";
  return (
    <Badge variant="outline" className={`${tone} transition-all hover:scale-105`}>
      {t.name} {t.count}
      {t.nextBreakpoint ? `/${t.nextBreakpoint}` : ""}
      {t.active && <CheckCircle2 className="ml-1 h-2.5 w-2.5" />}
    </Badge>
  );
}

// ─── Items card ─────────────────────────────────────────────────────────────

export function ItemsCard({ items }: { items: ItemRec[] }) {
  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "540ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Swords className="h-3.5 w-3.5" /> Item önerileri
        </CardDescription>
        <CardTitle className="text-base">BIS hedefleri</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-y-auto tft-scroll">
          <div className="space-y-1.5">
            {items.length === 0 && (
              <div className="text-sm text-zinc-500 py-2">Item önerisi yok.</div>
            )}
            {items.map((it, i) => (
              <div
                key={i}
                className="group/item flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-1.5 transition-all hover:border-zinc-700 hover:bg-zinc-950/60"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Swords className="h-3.5 w-3.5 text-amber-400/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-200 truncate">{it.item}</div>
                  <div className="text-[11px] text-zinc-500 truncate" title={it.reason}>
                    → {it.champion}
                    {it.reason && ` · ${it.reason}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1 w-8 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                      style={{ width: `${Math.round(it.score)}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-amber-400 w-6 text-right">
                    {Math.round(it.score)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stage card ─────────────────────────────────────────────────────────────

export function StageCard({ stage }: { stage: StageRec }) {
  const phaseTone =
    stage.phase === "early"
      ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
      : stage.phase === "mid"
      ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
      : "border-red-500/40 text-red-300 bg-red-500/10";
  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "600ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Clock className="h-3.5 w-3.5" /> Sahne
        </CardDescription>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="font-mono text-lg">{stage.current}</span>
          <Badge variant="outline" className={phaseTone}>
            {stage.phase}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Hedef level" value={String(stage.targetLevel)} icon={<ArrowUpCircle className="h-3 w-3" />} />
          <Info
            label="Level durumu"
            value={
              stage.levelStatus === "ahead"
                ? "ileri"
                : stage.levelStatus === "behind"
                ? "geride"
                : "yolunda"
            }
            icon={<TrendingUp className="h-3 w-3" />}
          />
        </div>

        {stage.nextEvent && (
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-2.5 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-sky-400 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Sıradaki olay
              </span>
              <span className="text-[11px] text-zinc-500">
                {stage.nextEvent.roundsAway === 0
                  ? "şimdi"
                  : `${stage.nextEvent.roundsAway} tur sonra`}
              </span>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-zinc-200">
              {stage.nextEvent.label}
            </div>
            <div className="text-[11px] text-zinc-500">{stage.nextEvent.description}</div>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-amber-400">
            <TrendingUp className="h-3 w-3" /> Öncelik
          </div>
          <div className="mt-0.5 text-sm text-zinc-200">{stage.priorityAction}</div>
        </div>
      </CardContent>
    </Card>
  );
}
