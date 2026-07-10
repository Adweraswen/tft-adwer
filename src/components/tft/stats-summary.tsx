"use client";

/**
 * StatsSummary — aggregate statistics cards (HP range, gold efficiency, comp picks, economy distribution).
 *
 * Fetches /api/stats and renders 4 mini-cards in a grid + two bar charts
 * (comp picks + economy action distribution).
 */

import { useEffect, useState } from "react";

/* eslint-disable react-hooks/set-state-in-effect -- data-fetching effect needs setState */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Heart,
  Coins,
  TrendingUp,
  Trophy,
  Flame,
  Snowflake,
  Save,
  ArrowUpCircle,
  Dices,
  Activity,
} from "lucide-react";

interface StatsData {
  totals: { count: number; liveCount: number; manualCount: number; errorCount: number };
  hp: { min: number; max: number; avg: number; latest: number };
  gold: { min: number; max: number; avg: number; latest: number };
  level: { min: number; max: number; avg: number; latest: number };
  streak: { best: number; worst: number; latest: number };
  compPicks: { name: string; tier: string; count: number }[];
  economyActions: { action: string; count: number }[];
  firstAt: string | null;
  lastAt: string | null;
}

interface StatsSummaryProps {
  tick: number;
}

const ECONOMY_META: Record<string, { label: string; color: string; icon: typeof Save }> = {
  save: { label: "Biriktir", color: "#34d399", icon: Save },
  level: { label: "Level atla", color: "#a78bfa", icon: ArrowUpCircle },
  reroll: { label: "Reroll", color: "#fb7185", icon: Dices },
  maintain: { label: "Koru", color: "#fbbf24", icon: Activity },
};

const TIER_COLORS: Record<string, string> = {
  S: "#fbbf24",
  A: "#a78bfa",
  B: "#60a5fa",
  "?": "#71717a",
};

export function StatsSummary({ tick }: StatsSummaryProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/stats?limit=200", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: StatsData) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton 4-tile grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="h-3 w-16 rounded bg-zinc-800 animate-pulse" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-7 w-12 rounded bg-zinc-800 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-zinc-800/60 animate-pulse mt-2" />
                <div className="h-1 w-full rounded bg-zinc-800/60 animate-pulse mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Skeleton charts */}
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
                <div className="h-4 w-32 rounded bg-zinc-800/60 animate-pulse mt-1.5" />
              </CardHeader>
              <CardContent>
                <div className="h-[140px] w-full rounded bg-zinc-800/40 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.totals.count === 0) {
    return (
      <Card className="bg-zinc-900/60 border-zinc-800 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/60 ring-1 ring-zinc-700/50">
            <Activity className="h-7 w-7 text-zinc-600" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-400">Henüz istatistik verisi yok</p>
          <p className="mt-1 text-xs text-zinc-600 max-w-xs">
            Canlı mod veya manuel yükleme ile snapshot oluşturdukça HP, gold, level ve comp eğilimleri burada birikecek.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hpPct = Math.min(100, (data.hp.latest / 150) * 100);
  const goldEfficiency = Math.min(100, Math.round((data.gold.avg / 50) * 100)); // 50g = max interest
  const econChartData = data.economyActions.map((e) => ({
    name: ECONOMY_META[e.action]?.label ?? e.action,
    count: e.count,
    color: ECONOMY_META[e.action]?.color ?? "#71717a",
  }));
  const compChartData = data.compPicks.slice(0, 6).map((c) => ({
    name: c.name,
    count: c.count,
    tier: c.tier,
    fill: TIER_COLORS[c.tier] ?? "#71717a",
  }));

  return (
    <div className="space-y-4">
      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* HP tile */}
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-zinc-500">
              <Heart className="h-3.5 w-3.5" /> HP
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-rose-300 font-mono tabular-nums">{data.hp.latest}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {data.hp.min}–{data.hp.max} · ort {data.hp.avg}
            </div>
            <Progress value={hpPct} className="h-1 mt-2 bg-zinc-800" />
          </CardContent>
        </Card>

        {/* Gold tile */}
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-zinc-500">
              <Coins className="h-3.5 w-3.5" /> Gold
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-amber-300 font-mono tabular-nums">{data.gold.latest}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {data.gold.min}–{data.gold.max} · ort {data.gold.avg}
            </div>
            <Progress value={goldEfficiency} className="h-1 mt-2 bg-zinc-800" />
            <div className="text-[9px] text-zinc-600 mt-0.5">Ekonomi verimi {goldEfficiency}%</div>
          </CardContent>
        </Card>

        {/* Level tile */}
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-zinc-500">
              <TrendingUp className="h-3.5 w-3.5" /> Level
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-violet-300 font-mono tabular-nums">{data.level.latest}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {data.level.min}–{data.level.max} · ort {data.level.avg}
            </div>
            <Progress value={Math.min(100, (data.level.latest / 9) * 100)} className="h-1 mt-2 bg-zinc-800" />
          </CardContent>
        </Card>

        {/* Streak tile */}
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-zinc-500">
              {data.streak.latest >= 0 ? (
                <Flame className="h-3.5 w-3.5 text-orange-400" />
              ) : (
                <Snowflake className="h-3.5 w-3.5 text-sky-400" />
              )}
              Streak
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                data.streak.latest > 0
                  ? "text-orange-300"
                  : data.streak.latest < 0
                  ? "text-sky-300"
                  : "text-zinc-400"
              }`}
            >
              {data.streak.latest > 0
                ? `+${data.streak.latest}W`
                : data.streak.latest < 0
                ? `${data.streak.latest}L`
                : "—"}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              en iyi: {data.streak.best > 0 ? `+${data.streak.best}` : data.streak.best} · en kötü: {data.streak.worst}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two charts side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Comp picks */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-zinc-500">
              <Trophy className="h-3.5 w-3.5" /> En çok önerilen comp'lar
            </CardDescription>
            <CardTitle className="text-sm">Comp dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {compChartData.length === 0 ? (
              <p className="text-xs text-zinc-600 py-8 text-center">Henüz comp verisi yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={compChartData} layout="vertical" margin={{ left: 8, right: 8, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#e4e4e7",
                    }}
                    cursor={{ fill: "#27272a40" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {compChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Economy actions */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-zinc-500">
              <Activity className="h-3.5 w-3.5" /> Ekonomi kararları
            </CardDescription>
            <CardTitle className="text-sm">Aksiyon dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {econChartData.length === 0 ? (
              <p className="text-xs text-zinc-600 py-8 text-center">Henüz ekonomi verisi yok</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={econChartData} margin={{ left: -16, right: 8, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#e4e4e7",
                      }}
                      cursor={{ fill: "#27272a40" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                      {econChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  {data.economyActions.map((e) => {
                    const meta = ECONOMY_META[e.action];
                    const Icon = meta?.icon ?? Activity;
                    const pct = Math.round((e.count / data.totals.count) * 100);
                    return (
                      <Badge
                        key={e.action}
                        variant="outline"
                        className="text-[10px] gap-1"
                        style={{ borderColor: `${meta?.color ?? "#71717a"}40`, color: meta?.color ?? "#a1a1aa" }}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {meta?.label ?? e.action}: {e.count} ({pct}%)
                      </Badge>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
