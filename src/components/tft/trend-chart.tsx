"use client";

/**
 * TrendChart — HP / Gold / Level over time, using Recharts.
 *
 * Fetches /api/stats and renders a combined line chart with two Y-axes:
 *   - Left axis: HP (0-150) and Gold (0-150), both linear
 *   - Right axis: Level (1-11)
 *
 * Includes a source-segment bar showing live vs manual snapshots.
 */

import { useEffect, useState } from "react";

/* eslint-disable react-hooks/set-state-in-effect -- data-fetching effect needs setState */

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface SeriesPoint {
  t: string;
  hp: number;
  gold: number;
  level: number;
  stage: number;
  round: number;
  streak: number;
  source: string;
}

interface StatsData {
  totals: { count: number; liveCount: number; manualCount: number; errorCount: number };
  hp: { min: number; max: number; avg: number; latest: number; series: SeriesPoint[] };
  gold: { min: number; max: number; avg: number; latest: number };
  level: { min: number; max: number; avg: number; latest: number };
  streak: { best: number; worst: number; latest: number };
  compPicks: { name: string; tier: string; count: number }[];
  economyActions: { action: string; count: number }[];
  firstAt: string | null;
  lastAt: string | null;
}

interface TrendChartProps {
  /** External tick — when this changes, refetch. */
  tick: number;
}

export function TrendChart({ tick }: TrendChartProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<"all" | "hp" | "gold" | "level">("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/stats?limit=200", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: StatsData) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
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
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardHeader className="pb-2">
          <div className="h-3 w-28 rounded bg-zinc-800 animate-pulse" />
          <div className="flex items-center gap-3 mt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-800 animate-pulse" />
                <div className="h-3 w-12 rounded bg-zinc-800/60 animate-pulse" />
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full rounded bg-zinc-800/40 animate-pulse" />
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 w-12 rounded bg-zinc-800 animate-pulse" />
            <div className="h-2 flex-1 rounded bg-zinc-800/60 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-red-300">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totals.count === 0) {
    return (
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-zinc-500">Henüz istatistik verisi yok.</p>
          <p className="text-xs text-zinc-600 mt-1">Snapshot oluşturdukça grafik dolacak.</p>
        </CardContent>
      </Card>
    );
  }

  const series = data.hp.series;
  const chartData = series.map((s) => ({
    time: new Date(s.t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    hp: s.hp,
    gold: s.gold,
    level: s.level,
    source: s.source,
    stage: `${s.stage}-${s.round}`,
  }));

  const hpTrend = series.length >= 2 ? series[series.length - 1].hp - series[0].hp : 0;
  const goldTrend = series.length >= 2 ? series[series.length - 1].gold - series[0].gold : 0;

  const metrics = [
    { key: "all" as const, label: "Tümü" },
    { key: "hp" as const, label: "HP" },
    { key: "gold" as const, label: "Gold" },
    { key: "level" as const, label: "Level" },
  ];

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-zinc-500">
            <TrendingUp className="h-3.5 w-3.5" /> Zaman grafiği · {data.totals.count} kayıt
          </span>
          <div className="flex gap-1">
            {metrics.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  metric === m.key
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-zinc-800/50 text-zinc-500 border border-transparent hover:text-zinc-300"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardDescription>
        <CardTitle className="text-base flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> HP
            <span className="text-rose-300 font-mono tabular-nums">{data.hp.latest}</span>
            {hpTrend !== 0 && (
              <span className={`text-[10px] ${hpTrend < 0 ? "text-red-400" : "text-emerald-400"}`}>
                {hpTrend > 0 ? "+" : ""}{hpTrend}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Gold
            <span className="text-amber-300 font-mono tabular-nums">{data.gold.latest}</span>
            {goldTrend !== 0 && (
              <span className={`text-[10px] ${goldTrend < 0 ? "text-red-400" : "text-emerald-400"}`}>
                {goldTrend > 0 ? "+" : ""}{goldTrend}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> Level
            <span className="text-violet-300 font-mono tabular-nums">{data.level.latest}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="hpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 150]}
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 11]}
              ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e4e4e7",
              }}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              iconType="circle"
            />
            <ReferenceLine y={50} yAxisId="left" stroke="#52525b" strokeDasharray="2 4" />
            <ReferenceLine y={25} yAxisId="left" stroke="#7f1d1d" strokeDasharray="2 4" />

            {(metric === "all" || metric === "hp") && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="hp"
                stroke="#fb7185"
                strokeWidth={2}
                fill="url(#hpGrad)"
                name="HP"
                dot={{ r: 2, fill: "#fb7185" }}
                activeDot={{ r: 4 }}
              />
            )}
            {(metric === "all" || metric === "gold") && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="gold"
                stroke="#fbbf24"
                strokeWidth={2}
                fill="url(#goldGrad)"
                name="Gold"
                dot={{ r: 2, fill: "#fbbf24" }}
                activeDot={{ r: 4 }}
              />
            )}
            {(metric === "all" || metric === "level") && (
              <Line
                yAxisId="right"
                type="stepAfter"
                dataKey="level"
                stroke="#a78bfa"
                strokeWidth={2.5}
                name="Level"
                dot={{ r: 3, fill: "#a78bfa" }}
                activeDot={{ r: 5 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Source breakdown bar */}
        <div className="mt-3 flex items-center gap-2 text-[10px]">
          <span className="text-zinc-600">Kaynak:</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-zinc-800">
            {data.totals.liveCount > 0 && (
              <div
                className="bg-emerald-500/60"
                style={{ width: `${(data.totals.liveCount / data.totals.count) * 100}%` }}
                title={`Live: ${data.totals.liveCount}`}
              />
            )}
            {data.totals.manualCount > 0 && (
              <div
                className="bg-amber-500/60"
                style={{ width: `${(data.totals.manualCount / data.totals.count) * 100}%` }}
                title={`Manual: ${data.totals.manualCount}`}
              />
            )}
          </div>
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 text-[9px]">
            {data.totals.liveCount} live
          </Badge>
          <Badge variant="outline" className="border-amber-500/30 text-amber-300 text-[9px]">
            {data.totals.manualCount} manuel
          </Badge>
          {data.totals.errorCount > 0 && (
            <Badge variant="outline" className="border-red-500/30 text-red-300 text-[9px]">
              {data.totals.errorCount} hata
            </Badge>
          )}
        </div>

        {data.firstAt && data.lastAt && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
            <span>İlk: {new Date(data.firstAt).toLocaleString("tr-TR")}</span>
            <span>Son: {new Date(data.lastAt).toLocaleString("tr-TR")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


