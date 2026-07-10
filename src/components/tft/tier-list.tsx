"use client";

/**
 * Tier List — comprehensive META tier list for TFT Set 17: Space Gods.
 * Two sections (toggled via Tabs): Comps (S/A/B) and Augments (S→C, top-30).
 * All data comes from the static `@/lib/tft-data` barrel — no fetching.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Crown, Trophy, TrendingUp, Users, Star, Zap, Search, Target, Flame,
  Shield, Layers, Filter,
} from "lucide-react";
import { COMPS, AUGMENTS, type Comp, type Augment } from "@/lib/tft-data";

// ─── Tier ordering & color maps ───────────────────────────────────────────────

const COMP_TIER_ORDER: Comp["tier"][] = ["S", "A", "B"];
const AUG_TIER_ORDER: readonly string[] = ["S", "S-", "A+", "A", "A-", "B+", "B", "B-", "C"];
const AUG_DISPLAY_LIMIT = 30;

const COMP_TIER_GRADIENT: Record<Comp["tier"], string> = {
  S: "from-amber-500 to-yellow-600",
  A: "from-violet-500 to-purple-600",
  B: "from-slate-500 to-slate-600",
};

/** Augment tier gradient — bucketed to mirror the comp tier scheme. */
const AUG_TIER_GRADIENT: Record<string, string> = {
  S: "from-amber-500 to-yellow-600", "S-": "from-amber-500 to-yellow-600",
  "A+": "from-violet-500 to-purple-600", A: "from-violet-500 to-purple-600", "A-": "from-violet-500 to-purple-600",
  "B+": "from-slate-500 to-slate-600", B: "from-slate-500 to-slate-600", "B-": "from-slate-500 to-slate-600",
  C: "from-zinc-600 to-zinc-700",
};

const PLAYSTYLE_BADGE: Record<Comp["playstyle"], string> = {
  reroll: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rush8: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  rush9: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  standard: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const PLAYSTYLE_LABEL: Record<Comp["playstyle"], string> = {
  reroll: "Reroll", rush8: "Rush 8", rush9: "Rush 9", standard: "Standard",
};

const DIFFICULTY_BADGE: Record<Comp["difficulty"], string> = {
  Easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Hard: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const STAGE_BADGE: Record<string, string> = {
  early: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  mid: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  late: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  flex: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

// ─── Metric color helpers ─────────────────────────────────────────────────────

const winRateText = (wr: number): string =>
  wr > 55 ? "text-emerald-400" : wr >= 45 ? "text-amber-400" : "text-rose-400";

const winRateBar = (wr: number): string =>
  wr > 55
    ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
    : wr >= 45
      ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
      : "[&_[data-slot=progress-indicator]]:bg-rose-500";

const avgPlaceText = (ap: number): string =>
  ap < 4 ? "text-emerald-400" : ap <= 4.5 ? "text-amber-400" : "text-rose-400";

const augmentScoreBar = (score: number): string =>
  score >= 85
    ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
    : score >= 75
      ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
      : "[&_[data-slot=progress-indicator]]:bg-slate-500";

// ─── Main component ───────────────────────────────────────────────────────────

export function TierList() {
  const [tab, setTab] = useState<"comps" | "augments">("comps");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "comps" | "augments")} className="w-full">
      <TabsList className="bg-zinc-900/60 border border-zinc-800 h-auto">
        <TabsTrigger value="comps" className="data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950 gap-1.5">
          <Trophy className="h-3.5 w-3.5" />
          Comp Tier List
        </TabsTrigger>
        <TabsTrigger value="augments" className="data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950 gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          Augment Tier List
        </TabsTrigger>
      </TabsList>
      <TabsContent value="comps" className="mt-4"><CompTierList /></TabsContent>
      <TabsContent value="augments" className="mt-4"><AugmentTierList /></TabsContent>
    </Tabs>
  );
}

// ─── Section 1: Comp Tier List ────────────────────────────────────────────────

function CompTierList() {
  const counts = useMemo(() => {
    const c: Record<Comp["tier"], number> = { S: 0, A: 0, B: 0 };
    for (const comp of COMPS) c[comp.tier]++;
    return c;
  }, []);

  const grouped = useMemo(() => {
    const m: Record<Comp["tier"], Comp[]> = { S: [], A: [], B: [] };
    for (const comp of COMPS) m[comp.tier].push(comp);
    (Object.keys(m) as Comp["tier"][]).forEach((t) =>
      m[t].sort((a, b) => b.winRate - a.winRate),
    );
    return m;
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <Card className="tft-glass border-zinc-800 py-0">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Layers className="h-4 w-4 text-zinc-400" />
            <span className="font-medium">{COMPS.length} Meta Comps</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {COMP_TIER_ORDER.map((t, i) => (
              <div key={t} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-600">|</span>}
                <span className="text-xs text-zinc-500">{t}:</span>
                <span className="text-sm font-bold text-zinc-100 tabular-nums">{counts[t]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier groups */}
      {COMP_TIER_ORDER.map((tier, ti) => (
        <section key={tier} className="space-y-3 tft-fade-up" style={{ animationDelay: `${ti * 60}ms` }}>
          <CompTierHeader tier={tier} count={counts[tier]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[tier].map((comp, ci) => (
              <CompCard key={comp.name} comp={comp} index={ti * 10 + ci} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CompTierHeader({ tier, count }: { tier: Comp["tier"]; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`bg-gradient-to-r ${COMP_TIER_GRADIENT[tier]} px-4 py-1.5 rounded-md text-white font-bold text-base shadow-lg tracking-wide`}>
        {tier} TIER
      </div>
      <span className="text-xs text-zinc-500 tabular-nums">
        {count} comp{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function CompCard({ comp, index }: { comp: Comp; index: number }) {
  return (
    <Card
      className="tft-glass border-zinc-800 hover:border-zinc-600 hover:shadow-xl hover:-translate-y-0.5 transition-all tft-fade-up py-0 gap-0"
      style={{ animationDelay: `${index * 35}ms` }}
    >
      <CardHeader className="p-4 pb-3 gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-bold leading-tight">{comp.name}</CardTitle>
          <Badge variant="outline" className={`bg-gradient-to-r ${COMP_TIER_GRADIENT[comp.tier]} border-transparent text-white font-bold shrink-0`}>
            {comp.tier}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-zinc-300">
          <Crown className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-medium">{comp.carry}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`text-[10px] gap-1 ${PLAYSTYLE_BADGE[comp.playstyle]}`}>
            <Flame className="h-3 w-3" />
            {PLAYSTYLE_LABEL[comp.playstyle]}
            {comp.playstyle === "reroll" && <span className="text-zinc-400">·L{comp.rerollLevel}</span>}
          </Badge>
          <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_BADGE[comp.difficulty]}`}>
            {comp.difficulty}
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 bg-zinc-800/60 text-zinc-300 border-zinc-700">
            <Users className="h-3 w-3" />
            {comp.pickRate.toFixed(1)}%
          </Badge>
        </div>

        {/* Win rate */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-zinc-400">
              <TrendingUp className="h-3 w-3" />
              Win Rate
            </span>
            <span className={`font-bold tabular-nums ${winRateText(comp.winRate)}`}>
              {comp.winRate.toFixed(1)}%
            </span>
          </div>
          <Progress value={comp.winRate} className={`h-1.5 bg-zinc-800 ${winRateBar(comp.winRate)}`} />
        </div>

        {/* Avg place */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-zinc-400">
            <Target className="h-3 w-3" />
            Avg Place
          </span>
          <span className={`font-bold tabular-nums ${avgPlaceText(comp.avgPlace)}`}>
            {comp.avgPlace.toFixed(1)}
          </span>
        </div>

        {/* Core champions */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Core</div>
          <div className="flex flex-wrap gap-1">
            {comp.core.map((c) => (
              <Badge key={c} variant="secondary" className="bg-zinc-800/80 text-zinc-300 text-[10px] px-1.5 py-0">
                {c}
              </Badge>
            ))}
          </div>
        </div>

        {/* Key traits */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Key Traits</div>
          <div className="flex flex-wrap gap-1">
            {comp.keyTraits.map((t) => (
              <Badge key={t} variant="outline" className="bg-violet-500/15 text-violet-300 border-violet-500/30 text-[10px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
          </div>
        </div>

        {/* Strategy */}
        <div className="rounded-md bg-zinc-950/40 border border-zinc-800 px-2.5 py-2 text-[11px] text-zinc-400 leading-relaxed">
          {comp.strategy}
        </div>

        {/* 3-star targets */}
        {comp.threeStarTargets.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">3★ Targets</div>
            <div className="flex flex-wrap gap-1">
              {comp.threeStarTargets.map((c) => (
                <Badge key={c} variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] gap-0 px-1.5 py-0">
                  <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
                  <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300 -ml-1.5" />
                  <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300 -ml-1.5" />
                  <span className="ml-0.5">{c}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Trait bots */}
        {comp.traitBots.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">Trait Bots</div>
            <div className="flex flex-wrap gap-1">
              {comp.traitBots.map((c) => (
                <Badge key={c} variant="outline" className="bg-zinc-800/40 text-zinc-400 border-zinc-700/50 text-[10px] gap-0.5 px-1.5 py-0">
                  <Shield className="h-2.5 w-2.5" />
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 2: Augment Tier List ─────────────────────────────────────────────

function AugmentTierList() {
  const [query, setQuery] = useState("");

  const { groups, total, shown } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = AUGMENTS.filter((a) => {
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.desc.toLowerCase().includes(q)
      );
    });

    // Sort by tier order, then by score descending within each tier.
    filtered.sort((a, b) => {
      const ai = AUG_TIER_ORDER.indexOf(a.tier);
      const bi = AUG_TIER_ORDER.indexOf(b.tier);
      const aRank = ai === -1 ? 99 : ai;
      const bRank = bi === -1 ? 99 : bi;
      if (aRank !== bRank) return aRank - bRank;
      return b.score - a.score;
    });

    const truncated = filtered.slice(0, AUG_DISPLAY_LIMIT);
    const groupMap: Record<string, Augment[]> = {};
    for (const aug of truncated) {
      if (!groupMap[aug.tier]) groupMap[aug.tier] = [];
      groupMap[aug.tier].push(aug);
    }
    return { groups: groupMap, total: filtered.length, shown: truncated.length };
  }, [query]);

  const visibleTiers = AUG_TIER_ORDER.filter((t) => groups[t]?.length);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <Card className="tft-glass border-zinc-800 py-0">
        <CardContent className="p-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search augments by name, tag, or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-zinc-950/50 border-zinc-800 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Filter className="h-3 w-3" />
              Showing <span className="text-zinc-300 tabular-nums">{shown}</span> of{" "}
              <span className="text-zinc-300 tabular-nums">{total}</span> augments
            </span>
            {total > AUG_DISPLAY_LIMIT && (
              <span className="text-amber-400/80">
                Top {AUG_DISPLAY_LIMIT} by tier shown — refine search to see more.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="max-h-[70vh] tft-scroll pr-2">
        <div className="space-y-4">
          {visibleTiers.map((tier, ti) => (
            <section key={tier} className="space-y-2 tft-fade-up" style={{ animationDelay: `${ti * 50}ms` }}>
              <AugmentTierHeader tier={tier} count={groups[tier].length} />
              <div className="space-y-1.5">
                {groups[tier].map((aug, ai) => (
                  <AugmentRow key={aug.name} aug={aug} index={ti * 20 + ai} />
                ))}
              </div>
            </section>
          ))}

          {visibleTiers.length === 0 && (
            <Card className="border-dashed border-zinc-700 bg-zinc-900/40 py-0">
              <CardContent className="py-12 text-center text-sm text-zinc-500">
                No augments match your search.
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function AugmentTierHeader({ tier, count }: { tier: string; count: number }) {
  const gradient = AUG_TIER_GRADIENT[tier] ?? "from-zinc-700 to-zinc-800";
  return (
    <div className="flex items-center gap-2 sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-sm py-1">
      <div className={`bg-gradient-to-r ${gradient} px-3 py-1 rounded text-white font-bold text-sm shadow-md`}>
        {tier}
      </div>
      <span className="text-xs text-zinc-500 tabular-nums">
        {count} augment{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function AugmentRow({ aug, index }: { aug: Augment; index: number }) {
  const stageClass = aug.stage ? STAGE_BADGE[aug.stage] ?? STAGE_BADGE.flex : STAGE_BADGE.flex;
  return (
    <Card
      className="tft-glass border-zinc-800 hover:border-zinc-600 hover:shadow-md transition-all tft-fade-up py-0 gap-0"
      style={{ animationDelay: `${index * 25}ms` }}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <Badge
          variant="outline"
          className={`bg-gradient-to-r ${AUG_TIER_GRADIENT[aug.tier] ?? "from-zinc-700 to-zinc-800"} border-transparent text-white font-bold shrink-0 w-12 justify-center`}
        >
          {aug.tier}
        </Badge>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100 truncate">{aug.name}</span>
            {aug.stage && (
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 capitalize ${stageClass}`}>
                {aug.stage}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Progress value={aug.score} className={`h-1 bg-zinc-800 flex-1 ${augmentScoreBar(aug.score)}`} />
            <span className="text-[10px] text-zinc-400 tabular-nums shrink-0 w-6 text-right">{aug.score}</span>
          </div>

          <p className="text-[11px] text-zinc-500 leading-snug">{aug.desc}</p>

          <div className="flex flex-wrap gap-1">
            {aug.tags.map((t) => (
              <Badge key={t} variant="secondary" className="bg-zinc-800/60 text-zinc-400 text-[9px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
