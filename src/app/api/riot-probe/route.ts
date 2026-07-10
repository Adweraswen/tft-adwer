/**
 * POST /api/riot-probe
 *
 * Receive raw JSON from Riot Live Client Data API
 * (https://127.0.0.1:2999/liveclientdata/allgamedata) and produce a structured
 * summary of which TFT-relevant fields are actually populated.
 *
 * The Riot Live Client API for TFT is notoriously sparse — `level` works but
 * `currentGold` is broken, and `units`/`shop` may or may not be present
 * depending on spectate vs. live mode. This endpoint exists so we can SEE
 * exactly what comes back from a real game and decide which fields to trust.
 *
 * Body: { data?: any, endpoint?: string }
 *   - `data` is the raw allgamedata JSON (already fetched by capture.py)
 *   - `endpoint` is which /liveclientdata/ sub-path was hit (for logging)
 *
 * Returns: a summary of populated fields + the raw payload (truncated for safety).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 10;

interface ProbeBody {
  data?: unknown;
  endpoint?: string;
}

interface FieldSummary {
  path: string;
  present: boolean;
  type: string;
  sample: string;
}

function summarizeField(obj: unknown, path: string): FieldSummary {
  const present = obj !== null && obj !== undefined;
  let type = "missing";
  let sample = "";
  if (present) {
    type = Array.isArray(obj) ? `array[${obj.length}]` : typeof obj;
    if (Array.isArray(obj)) {
      sample = JSON.stringify(obj.slice(0, 2));
    } else if (typeof obj === "object") {
      sample = JSON.stringify(obj).slice(0, 200);
    } else {
      sample = String(obj).slice(0, 100);
    }
  }
  return { path, present, type, sample };
}

export async function POST(req: NextRequest) {
  let body: ProbeBody;
  try {
    body = (await req.json()) as ProbeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json(
      { ok: false, error: "Missing `data` (raw allgamedata JSON)" },
      { status: 400 }
    );
  }

  const data = body.data as Record<string, unknown>;
  const endpoint = body.endpoint || "allgamedata";

  // ─── Top-level keys ─────────────────────────────────────────────────────
  const topKeys = Object.keys(data).sort();

  // ─── gameData ───────────────────────────────────────────────────────────
  const gameData = (data.gameData ?? {}) as Record<string, unknown>;
  const gameDataKeys = Object.keys(gameData).sort();

  // ─── activePlayer ───────────────────────────────────────────────────────
  const activePlayer = (data.activePlayer ?? {}) as Record<string, unknown>;
  const activePlayerKeys = Object.keys(activePlayer).sort();

  // ─── allPlayers ─────────────────────────────────────────────────────────
  const allPlayers = Array.isArray(data.allPlayers) ? data.allPlayers : [];
  const playerSummaries = allPlayers.map((p, i) => {
    const player = (p ?? {}) as Record<string, unknown>;
    const units = Array.isArray(player.units) ? player.units : [];
    const shop = Array.isArray(player.shop) ? player.shop : [];
    const traits = Array.isArray(player.traits) ? player.traits : [];
    return {
      index: i,
      name: player.name ?? "(unnamed)",
      champion: player.champion ?? null,
      isBot: player.isBot ?? false,
      level: player.level ?? null,
      gold: player.gold ?? null,
      health: player.health ?? null,
      xpToNext: player.xpToNext ?? null,
      rawStreak: player.rawStreak ?? null,
      roundWon: player.roundWon ?? null,
      rerollCost: player.rerollCost ?? null,
      hasUnits: units.length > 0,
      unitCount: units.length,
      hasShop: shop.length > 0,
      shopCount: shop.length,
      hasTraits: traits.length > 0,
      traitCount: traits.length,
      allKeys: Object.keys(player).sort(),
      // Sample first unit (if any) so we can see the shape
      firstUnit: units[0] ?? null,
      firstShopItem: shop[0] ?? null,
      firstTrait: traits[0] ?? null,
    };
  });

  // ─── events ─────────────────────────────────────────────────────────────
  const events = (data.events ?? {}) as Record<string, unknown>;
  const eventsKeys = Object.keys(events).sort();

  // ─── Build "TFT-useful field" checklist ─────────────────────────────────
  // Which fields could we actually use for the advisor?
  const usefulFields: FieldSummary[] = [
    summarizeField(data.gameData, "gameData"),
    summarizeField(gameData.gameTime, "gameData.gameTime"),
    summarizeField(gameData.gameState, "gameData.gameState"),
    summarizeField(gameData.setID, "gameData.setID"),
    summarizeField(gameData.gameMode, "gameData.gameMode"),
    summarizeField(data.activePlayer, "activePlayer"),
    summarizeField(activePlayer.currentGold, "activePlayer.currentGold"),
    summarizeField(activePlayer.shop, "activePlayer.shop"),
    summarizeField(activePlayer.allShops, "activePlayer.allShops"),
    summarizeField(activePlayer.rerollCost, "activePlayer.rerollCost"),
    summarizeField(data.allPlayers, "allPlayers"),
  ];

  // Per-player useful fields (use first non-bot player, or first player)
  const firstRealPlayer = playerSummaries.find((p) => !p.isBot) ?? playerSummaries[0];
  if (firstRealPlayer) {
    const p = allPlayers[firstRealPlayer.index] as Record<string, unknown>;
    usefulFields.push(
      summarizeField(p.level, `allPlayers[${firstRealPlayer.index}].level`),
      summarizeField(p.gold, `allPlayers[${firstRealPlayer.index}].gold`),
      summarizeField(p.health, `allPlayers[${firstRealPlayer.index}].health`),
      summarizeField(p.units, `allPlayers[${firstRealPlayer.index}].units`),
      summarizeField(p.shop, `allPlayers[${firstRealPlayer.index}].shop`),
      summarizeField(p.traits, `allPlayers[${firstRealPlayer.index}].traits`),
      summarizeField(p.xpToNext, `allPlayers[${firstRealPlayer.index}].xpToNext`),
      summarizeField(p.rawStreak, `allPlayers[${firstRealPlayer.index}].rawStreak`),
    );
  }

  // ─── Persist to DB as a Setting (so we can inspect later) ───────────────
  // Keep the last probe result under a known key. Truncate to 100KB so SQLite
  // doesn't choke. This lets us review what the API returned even after the
  // capture client disconnects.
  try {
    const rawString = JSON.stringify(data);
    const truncated =
      rawString.length > 100_000 ? rawString.slice(0, 100_000) + "…[truncated]" : rawString;
    await db.setting.upsert({
      where: { key: "riot-probe-last" },
      create: { key: "riot-probe-last", value: truncated },
      update: { key: "riot-probe-last", value: truncated },
    });
  } catch (err) {
    console.warn("[riot-probe] could not persist:", err);
  }

  return NextResponse.json({
    ok: true,
    endpoint,
    receivedAt: new Date().toISOString(),
    topLevelKeys: topKeys,
    gameData: {
      keys: gameDataKeys,
      gameTime: gameData.gameTime ?? null,
      gameState: gameData.gameState ?? null,
      setID: gameData.setID ?? null,
      gameMode: gameData.gameMode ?? null,
      isRanked: gameData.isRanked ?? null,
    },
    activePlayer: {
      keys: activePlayerKeys,
      currentGold: activePlayer.currentGold ?? null,
      shopCount: Array.isArray(activePlayer.shop) ? activePlayer.shop.length : 0,
      allShopsCount: Array.isArray(activePlayer.allShops) ? activePlayer.allShops.length : 0,
      rerollCost: activePlayer.rerollCost ?? null,
    },
    allPlayers: {
      count: playerSummaries.length,
      bots: playerSummaries.filter((p) => p.isBot).length,
      humans: playerSummaries.filter((p) => !p.isBot).length,
      players: playerSummaries,
    },
    events: {
      keys: eventsKeys,
    },
    usefulFields,
    rawSizeBytes: JSON.stringify(data).length,
    // Truncated raw for quick inspection (full raw persisted in DB)
    rawPreview: JSON.stringify(data, null, 2).slice(0, 4000),
  });
}

/**
 * GET /api/riot-probe
 *
 * Returns the last persisted probe result (from the `riot-probe-last` Setting),
 * so the web UI can show what the Riot API returned without needing capture.py
 * to be running.
 */
export async function GET() {
  let last: string | null = null;
  try {
    const row = await db.setting.findUnique({ where: { key: "riot-probe-last" } });
    last = row?.value ?? null;
  } catch {
    last = null;
  }

  return NextResponse.json({
    ok: last !== null,
    hasProbe: last !== null,
    raw: last,
    note: last
      ? "Last probe result persisted in DB. POST a new allgamedata payload to update."
      : "No probe yet. Run capture.py with --probe to send allgamedata here.",
  });
}
