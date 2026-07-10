/**
 * GET /api/stats
 *
 * Aggregate statistics across all (or recent) snapshots — for the Stats tab.
 *
 * Returns:
 *   - totals: count, liveCount, manualCount, errorCount
 *   - hp: { min, max, avg, latest, series[] }
 *   - gold: { min, max, avg, latest, series[] }
 *   - level: { min, max, avg, latest, series[] }
 *   - streak: { best, worst, latest }
 *   - compPicks: [{ name, tier, count }] — most recommended comps
 *   - economyActions: [{ action, count }] — save/level/reroll/maintain distribution
 *   - firstAt, lastAt: ISO timestamps
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(
    500,
    Math.max(10, parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10) || 200)
  );

  try {
    const rows = await db.snapshot.findMany({
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        source: true,
        ok: true,
        level: true,
        gold: true,
        hp: true,
        stage: true,
        round: true,
        streak: true,
        recommendations: true,
      },
    });

    if (rows.length === 0) {
      return NextResponse.json({
        totals: { count: 0, liveCount: 0, manualCount: 0, errorCount: 0 },
        hp: { min: 0, max: 0, avg: 0, latest: 0, series: [] },
        gold: { min: 0, max: 0, avg: 0, latest: 0, series: [] },
        level: { min: 0, max: 0, avg: 0, latest: 0, series: [] },
        streak: { best: 0, worst: 0, latest: 0 },
        compPicks: [],
        economyActions: [],
        firstAt: null,
        lastAt: null,
      });
    }

    const hpArr: number[] = [];
    const goldArr: number[] = [];
    const levelArr: number[] = [];
    const compCounts = new Map<string, { tier: string; count: number }>();
    const econCounts = new Map<string, number>();

    for (const r of rows) {
      hpArr.push(r.hp);
      goldArr.push(r.gold);
      levelArr.push(r.level);

      try {
        const rec = JSON.parse(r.recommendations ?? "{}") as {
          comp?: { name?: string; tier?: string };
          economy?: { action?: string };
        };
        if (rec.comp?.name) {
          const key = rec.comp.name;
          const prev = compCounts.get(key) ?? { tier: rec.comp.tier ?? "?", count: 0 };
          prev.count++;
          if (!prev.tier || prev.tier === "?") prev.tier = rec.comp.tier ?? "?";
          compCounts.set(key, prev);
        }
        if (rec.economy?.action) {
          econCounts.set(rec.economy.action, (econCounts.get(rec.economy.action) ?? 0) + 1);
        }
      } catch {
        // ignore
      }
    }

    const series = rows.map((r) => ({
      t: r.createdAt.toISOString(),
      hp: r.hp,
      gold: r.gold,
      level: r.level,
      stage: r.stage,
      round: r.round,
      streak: r.streak,
      source: r.source,
    }));

    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

    const compPicks = [...compCounts.entries()]
      .map(([name, v]) => ({ name, tier: v.tier, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const economyActions = [...econCounts.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    const liveCount = rows.filter((r) => r.source === "live").length;
    const errorCount = rows.filter((r) => !r.ok).length;

    return NextResponse.json({
      totals: {
        count: rows.length,
        liveCount,
        manualCount: rows.length - liveCount,
        errorCount,
      },
      hp: {
        min: Math.min(...hpArr),
        max: Math.max(...hpArr),
        avg: Math.round(avg(hpArr) * 10) / 10,
        latest: hpArr[hpArr.length - 1],
        series,
      },
      gold: {
        min: Math.min(...goldArr),
        max: Math.max(...goldArr),
        avg: Math.round(avg(goldArr) * 10) / 10,
        latest: goldArr[goldArr.length - 1],
      },
      level: {
        min: Math.min(...levelArr),
        max: Math.max(...levelArr),
        avg: Math.round(avg(levelArr) * 10) / 10,
        latest: levelArr[levelArr.length - 1],
      },
      streak: {
        best: Math.max(...rows.map((r) => r.streak)),
        worst: Math.min(...rows.map((r) => r.streak)),
        latest: rows[rows.length - 1].streak,
      },
      compPicks,
      economyActions,
      firstAt: rows[0].createdAt.toISOString(),
      lastAt: rows[rows.length - 1].createdAt.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[stats] GET failed: ${msg}`);
    return NextResponse.json({ ok: false, error: "Database error", details: msg }, { status: 500 });
  }
}