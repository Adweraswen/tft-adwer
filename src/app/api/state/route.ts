/**
 * GET /api/state
 *
 * Returns the latest snapshot (for live polling from the browser).
 * Lightweight: only the fields the live panel needs.
 *
 * Query: ?source=live (filter to live snapshots only)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { FullRecommendation, GameState, GameSource } from "@/lib/tft/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SOURCES: readonly GameSource[] = ["live", "manual"];

export async function GET(req: NextRequest) {
  const sourceFilter = req.nextUrl.searchParams.get("source");

  // Validate source parameter
  if (sourceFilter && !VALID_SOURCES.includes(sourceFilter as GameSource)) {
    return NextResponse.json(
      { ok: false, error: `Invalid source "${sourceFilter}". Must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const where = sourceFilter ? { source: sourceFilter } : {};
    const row = await db.snapshot.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (!row) {
      return NextResponse.json({
        connected: false,
        hasSnapshot: false,
        state: null,
        recommendation: null,
        id: null,
        createdAt: null,
        ageMs: null,
      });
    }

    let recommendation: FullRecommendation | null = null;
    try {
      recommendation = safeJsonParse(row.recommendations, null);
    } catch {
      recommendation = null;
    }

    const state: GameState = {
      source: row.source as GameState["source"],
      connected: row.ok,
      level: row.level,
      gold: row.gold,
      hp: row.hp,
      stage: row.stage,
      round: row.round,
      streak: row.streak,
      shop: safeJsonParse(row.shop, ["", "", "", "", ""]) as string[],
      board: safeJsonParse(row.board, []) as GameState["board"],
      bench: safeJsonParse(row.bench, []) as GameState["bench"],
      augments: safeJsonParse(row.augments, []) as string[],
    };

    const ageMs = Date.now() - row.createdAt.getTime();

    return NextResponse.json({
      connected: row.ok,
      hasSnapshot: true,
      state,
      recommendation,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      ageMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[state] GET failed: ${msg}`);
    return NextResponse.json({ ok: false, error: "Database error", details: msg }, { status: 500 });
  }
}