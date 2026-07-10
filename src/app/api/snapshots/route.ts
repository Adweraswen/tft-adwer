/**
 * GET /api/snapshots
 *   Returns a list of recent snapshots (history) WITH one-liner + economy action.
 *
 * DELETE /api/snapshots
 *   Clears all snapshots (optionally ?before=<iso> to only delete older ones).
 *
 * Query (GET): ?limit=50&source=live
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { GameSource } from "@/lib/tft/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SOURCES: readonly GameSource[] = ["live", "manual"];

export async function GET(req: NextRequest) {
  const limit = Math.min(
    200,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50)
  );
  const source = req.nextUrl.searchParams.get("source");

  // Validate source parameter
  if (source && !VALID_SOURCES.includes(source as GameSource)) {
    return NextResponse.json(
      { ok: false, error: `Invalid source "${source}". Must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const rows = await db.snapshot.findMany({
      where: source ? { source } : undefined,
      orderBy: { createdAt: "desc" },
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
        errorMsg: true,
        recommendations: true,
      },
    });

    // Parse oneLiner + economyAction + compName from the recommendations JSON.
    const enriched = rows.map((r) => {
      let oneLiner = "";
      let economyAction = "";
      let compName = "";
      try {
        const rec = JSON.parse(r.recommendations ?? "{}") as {
          oneLiner?: string;
          economy?: { action?: string };
          comp?: { name?: string };
        };
        oneLiner = rec.oneLiner ?? "";
        economyAction = rec.economy?.action ?? "";
        compName = rec.comp?.name ?? "";
      } catch {
        // ignore parse errors
      }
      const { recommendations: _omit, ...rest } = r;
      void _omit;
      return { ...rest, oneLiner, economyAction, compName };
    });

    return NextResponse.json({ snapshots: enriched, count: enriched.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[snapshots] GET failed: ${msg}`);
    return NextResponse.json({ ok: false, error: "Database error", details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const before = req.nextUrl.searchParams.get("before"); // ISO date

  // Validate before is a valid date if provided
  if (before) {
    const ts = new Date(before).getTime();
    if (isNaN(ts)) {
      return NextResponse.json(
        { ok: false, error: `Invalid date "${before}". Use ISO 8601 format (e.g. 2026-07-08T12:00:00Z).` },
        { status: 400 }
      );
    }
  }

  try {
    const where = before ? { createdAt: { lt: new Date(before) } } : {};
    const result = await db.snapshot.deleteMany({ where });

    return NextResponse.json({
      ok: true,
      deleted: result.count,
      scope: before ? `before ${before}` : "all",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[snapshots] DELETE failed: ${msg}`);
    return NextResponse.json({ ok: false, error: "Database error", details: msg }, { status: 500 });
  }
}