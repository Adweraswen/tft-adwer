/**
 * GET /api/snapshots/export
 *
 * Exports all (or recent) snapshots as a JSON file download.
 * Includes full state + recommendations for each snapshot.
 *
 * Query: ?limit=500&source=live
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { GameSource } from "@/lib/tft/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SOURCES: readonly GameSource[] = ["live", "manual"];

export async function GET(req: NextRequest) {
  const limit = Math.min(
    1000,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "500", 10) || 500)
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
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      app: "TFT Adwer",
      version: "1.0",
      count: rows.length,
      snapshots: rows.map((r) => {
        const recommendation = safeJsonParse(r.recommendations ?? "{}", null);
        const shop = safeJsonParse<string[]>(r.shop ?? "[]", []);
        const board = safeJsonParse(r.board ?? "[]", []);
        const bench = safeJsonParse(r.bench ?? "[]", []);
        const augments = safeJsonParse<string[]>(r.augments ?? "[]", []);
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          source: r.source,
          ok: r.ok,
          errorMsg: r.errorMsg,
          state: {
            level: r.level,
            gold: r.gold,
            hp: r.hp,
            stage: r.stage,
            round: r.round,
            streak: r.streak,
            shop,
            board,
            bench,
            augments,
          },
          recommendation,
          vlmRaw: r.vlmRaw,
        };
      }),
    };

    const json = JSON.stringify(exportData, null, 2);
    const filename = `tft-adwer-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[snapshots/export] GET failed: ${msg}`);
    return NextResponse.json({ ok: false, error: "Database error", details: msg }, { status: 500 });
  }
}