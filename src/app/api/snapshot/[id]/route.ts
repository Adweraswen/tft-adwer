/**
 * GET /api/snapshot/[id]
 *
 * Returns a single snapshot in full detail (state + recommendation).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { FullRecommendation, GameState } from "@/lib/tft/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const row = await db.snapshot.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
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

    return NextResponse.json({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      source: row.source,
      state,
      recommendation,
      ok: row.ok,
      errorMsg: row.errorMsg,
      vlmRaw: row.vlmRaw,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[snapshot/${id}] GET failed: ${msg}`);
    return NextResponse.json({ ok: false, error: "Database error", details: msg }, { status: 500 });
  }
}