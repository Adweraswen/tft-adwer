/**
 * GET /api/ddragon-champions
 *
 * Fetches the TFT champion roster from Data Dragon (Riot's CDN). Returns the
 * list of champion names + image URLs for the current Set.
 *
 * Data Dragon URL structure (PLAN 15.4):
 *   - Versions: https://ddragon.leagueoflegends.com/api/versions.json
 *   - TFT champions: https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/tft-champion.json
 *   - Champ icon: https://ddragon.leagueoflegends.com/cdn/{ver}/img/tft-champion/{image.full}
 *
 * Caches the version + champion list in memory for 1 hour.
 *
 * Query params:
 *   ?set=N   — filter to TFTSet{N} (default 17)
 *   ?force=1 — bypass cache
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface DDragonChampion {
  id: string;
  name: string;
  cost: number;
  traits: string[];
  iconUrl: string;
  set: number;
}

let _cache: { version: string; champions: DDragonChampion[]; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function loadChampions(setFilter: number, force: boolean): Promise<{ version: string; champions: DDragonChampion[] }> {
  if (!force && _cache && Date.now() - _cache.fetchedAt < CACHE_TTL) {
    const filtered = setFilter > 0 ? _cache.champions.filter((c) => c.set === setFilter) : _cache.champions;
    return { version: _cache.version, champions: filtered };
  }

  // 1. Get latest version.
  const versions: string[] = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!Array.isArray(versions) || versions.length === 0) throw new Error("No versions returned");
  // Pick a stable live version (first is latest). Fall back to a known-good one.
  const version = versions[0];

  // 2. Get TFT champion data.
  const champData = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/tft-champion.json`);
  const data = champData?.data ?? {};
  const all: DDragonChampion[] = [];
  for (const [id, champ] of Object.entries(data)) {
    const c = champ as any;
    // Set is encoded in the champion ID: "TFTSet17_Aatrox" → 17.
    // Some entries (tutorial) have no set — skip them unless setFilter is 0.
    const setMatch = id.match(/TFTSet(\d+)/i);
    const champSet = setMatch ? parseInt(setMatch[1], 10) : 0;
    // Skip non-set entries (tutorial, maps) when filtering.
    if (setFilter > 0 && champSet !== setFilter) continue;
    const traits = Array.isArray(c?.traits) ? c.traits.map((t: any) => t?.name ?? "").filter(Boolean) : [];
    const cost = c?.tier ?? 0;
    const imageFull = c?.image?.full ?? `${id}.png`;
    all.push({
      id,
      name: c?.name ?? id,
      cost,
      traits,
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/tft-champion/${imageFull}`,
      set: champSet,
    });
  }

  _cache = { version, champions: all, fetchedAt: Date.now() };
  const filtered = setFilter > 0 ? all.filter((c) => c.set === setFilter) : all;
  return { version, champions: filtered };
}

export async function GET(req: NextRequest) {
  const setParam = req.nextUrl.searchParams.get("set");
  const forceParam = req.nextUrl.searchParams.get("force");
  const setFilter = setParam ? parseInt(setParam, 10) : 17;
  const force = forceParam === "1";

  try {
    const { version, champions } = await loadChampions(setFilter, force);
    return NextResponse.json({
      ok: true,
      version,
      set: setFilter,
      count: champions.length,
      champions: champions.slice(0, 100), // cap response size
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[ddragon-champions] failed:", msg);
    return NextResponse.json({ ok: false, error: "Data Dragon fetch başarısız.", details: msg }, { status: 500 });
  }
}
