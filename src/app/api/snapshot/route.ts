/**
 * POST /api/snapshot
 *
 * Receive a TFT screenshot (base64 data URL), analyze it with VLM, run the advisor,
 * persist to the DB, and return the full result.
 *
 * Body: { image?: string (base64 data URL), state?: Partial<GameState>, source?: "live"|"manual" }
 *   - If `image` is provided → run VLM analysis.
 *   - If `state` is provided (and no image) → use the state directly (for manual entry / testing).
 *   - `source` defaults to "manual".
 *
 * Returns: { id, state, recommendation, ok, error, createdAt }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeScreenshot } from "@/lib/tft/vlm-analyzer";
import { recommend, resetAdvisor } from "@/lib/tft/advisor";
import { emptyState, type GameState, type GameSource } from "@/lib/tft/state";
import { applySanityFilter, formatChanges } from "@/lib/tft/sanity-filter";
import { safeJsonParse } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60; // VLM can take a few seconds

interface SnapshotRequestBody {
  image?: string;
  /** Cropped board region (base64 data URL) — zoomed view of the hex grid. */
  boardCrop?: string;
  /** Cropped bench region (base64 data URL) — zoomed view of the bench strip. */
  benchCrop?: string;
  state?: Partial<GameState>;
  source?: GameSource;
  /** Skip VLM even if image is present (for testing). */
  skipVlm?: boolean;
  /**
   * Local data from capture.py --use-local:
   *   - level: Live API (port 2999) → %100 doğru, VLM'i bypass eder
   *   - gold: Tesseract OCR → VLM'e göre daha güvenilir (körü körüne 500 demez)
   *   - hp: Live API TFT-OCR-BOT yöntemi → activePlayer.championStats.currentHealth
   *     (1-1 round'undan SONRA populate edilir, loading screen'de yok)
   *   - connected: Live API "TFT" mode tespiti
   *
   * Eğer localData varsa, VLM sonucundaki level/gold/hp YERİNE localData kullanılır.
   * VLM yine de çağrılır (stage/shop/board için) ama level/gold/hp localData'dan alınır.
   */
  localData?: {
    connected: boolean;
    level: number | null;
    hp: number | null;
    gold: number | null;
    hp_source?: string | null; // debug: HP hangi path'ten geldi
    all_players?: unknown[];
    game_time?: number;
  };
}

// ─── In-flight guard (with watchdog) ────────────────────────────────────────
// On a 4 GB sandbox, the VLM (~3–5s per call, heavy memory) cannot run twice
// concurrently without OOM-killing the dev server. capture.py fires every ~10s
// so requests can overlap. Drop new VLM requests while one is in flight — the
// caller (capture.py) just logs ✗ and tries again next interval. The web UI
// keeps showing the last good snapshot from /api/state.
//
// WATCHDOG: previously this was a simple boolean flag. If the VLM SDK call hung
// (network hiccup, API slowness, SDK bug), the flag stayed `true` FOREVER —
// every subsequent request got "busy" and VLM never ran again. Now we track
// WHEN the in-flight call started. If it's been > 60s, we assume the call is
// stuck (zombie) and allow a new request through. The zombie will eventually
// finish/set its flag, but we don't block forever waiting for it.
const VLM_STALE_MS = 60_000; // 60s — a normal VLM call takes 3-8s, 60s = stuck
let _vlmInFlightSince: number | null = null;

function isVlmBusy(): boolean {
  if (_vlmInFlightSince === null) return false;
  const age = Date.now() - _vlmInFlightSince;
  if (age > VLM_STALE_MS) {
    // Stale — the previous call is stuck. Reset and allow new request.
    console.warn(
      `[snapshot] in-flight guard stale (${age}ms > ${VLM_STALE_MS}ms). Resetting. ` +
        `VLM SDK likely hung. Allowing new request.`
    );
    _vlmInFlightSince = null;
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: SnapshotRequestBody;
  try {
    body = (await req.json()) as SnapshotRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const source: GameSource = body.source === "live" || body.source === "mock" ? body.source : "manual";

  // If a VLM call is already running, refuse this one. Manual `state` entries
  // bypass the guard (they're cheap — no VLM).
  if (body.image && !body.skipVlm && isVlmBusy()) {
    return NextResponse.json(
      {
        ok: false,
        error: "busy",
        message: "A previous VLM analysis is still running. Skipped this capture.",
        retryAfterMs: 3000,
      },
      { status: 429 }
    );
  }

  let state: GameState;
  let vlmRaw: string | null = null;
  let errorMsg: string | null = null;
  let ok = true;

  if (body.image && !body.skipVlm) {
    // VLM path — guarded against concurrent calls to prevent OOM
    _vlmInFlightSince = Date.now();
    try {
      const result = await analyzeScreenshot(body.image, source, {
        boardCrop: body.boardCrop,
        benchCrop: body.benchCrop,
      });
      state = result.state;
      vlmRaw = result.raw;
      if (!result.ok) {
        ok = false;
        errorMsg = result.error;
      }
      // Local data varsa (Live API connected=true), VLM "TFT değil" dese bile
      // connected=true yap. Live API Riot'un resmi API'si — VLM'den daha güvenilir.
      // Bu, stage 1-1 gibi boş board'larda VLM'in "TFT değil" sanmasını engeller.
      if (body.localData?.connected === true) {
        if (!state.connected) {
          state.connected = true;
        }
      }
      // If VLM succeeded technically (returned valid JSON) but didn't
      // recognize the screen as TFT (connected=false) AND local data yoksa,
      // mark the snapshot as not-ok. Local data varsa yukarıda connected=true
      // yapıldı, bu blok atlanır.
      if (ok && !state.connected) {
        ok = false;
        errorMsg = "VLM did not recognize the screen as TFT";
      }

      // ─── Sanity filter ───────────────────────────────────────────────
      // Apply TFT game-logic constraints to suppress VLM hallucinations:
      //   - Level only increases (high-water mark)
      //   - Stage-round only goes forward (high-water mark)
      //   - HP can decrease freely, increase by ≤ +25 (augment/prismatic), big jumps rejected
      //   - Gold capped at 150 (LoL-leak suppression)
      //   - New-game detection resets the baseline
      // Only filter when VLM actually produced a state (ok or connected).
      // If VLM failed entirely, keep the emptyStateWith defaults — no point
      // filtering garbage.
      let sanityLog = "";
      if (result.ok && state.connected) {
        // Only use LIVE snapshots as the baseline. Manual uploads (Yükle tab)
        // are one-off tests — they shouldn't pollute the monotonicity baseline
        // for real captures. If a user uploads a manual test with level=9 then
        // starts capture.py in a fresh match (level=1), the sanity filter would
        // wrongly reject the real level=1 because "level can't decrease".
        const previousState = await getLastGoodState(source);
        const before = { ...state };
        const filtered = applySanityFilter(state, previousState);
        state = filtered.state;
        if (filtered.changes.length > 0) {
          sanityLog = ` | sanity: ${formatChanges(filtered.changes)}`;
          if (filtered.newGame) {
            sanityLog += " | NEW GAME";
            resetAdvisor(); // clear pivot tracking for the fresh match
          }
        }
        // If the filter changed HP/level/stage/gold, log the before→after
        // so we can see what the VLM actually said vs what we stored.
        if (
          before.hp !== state.hp ||
          before.level !== state.level ||
          before.gold !== state.gold ||
          before.stage !== state.stage
        ) {
          sanityLog =
            ` | sanity IN hp=${before.hp} lvl=${before.level} gold=${before.gold} ` +
            `stage=${before.stage}-${before.round} → OUT hp=${state.hp} lvl=${state.level} ` +
            `gold=${state.gold} stage=${state.stage}-${state.round}` + sanityLog;
        }
      }

      // ─── Local data override (Live API + gold OCR) ──────────────────
      // capture.py --use-local ile localData geliyorsa:
      //   - level: Live API'den, %100 doğru — VLM sonucunu ezer
      //   - gold: Tesseract OCR'den — VLM "500" gibi halüsinasyonları engeller
      //   - hp: TFT'de Live API vermiyor, VLM sonucu kalır
      //   - connected: Live API "TFT" mode → connected=true (VLM tereddüt etse bile)
      if (body.localData) {
        const ld = body.localData;
        const overrides: string[] = [];
        if (ld.connected) {
          if (!state.connected) {
            state.connected = true;
            overrides.push("connected=true");
          }
        }
        if (typeof ld.level === "number" && ld.level >= 1 && ld.level <= 10) {
          if (state.level !== ld.level) {
            overrides.push(`level ${state.level}→${ld.level}`);
            state.level = ld.level;
          }
        }
        if (typeof ld.gold === "number" && ld.gold >= 0 && ld.gold <= 999) {
          if (state.gold !== ld.gold) {
            overrides.push(`gold ${state.gold}→${ld.gold}`);
            state.gold = ld.gold;
          }
        }
        // HP — TFT-OCR-BOT yöntemi: activePlayer.championStats.currentHealth
        // (1-1 round'undan sonra populate edilir). VLM halüsinasyonları yerine
        // Live API HP'si kullanılır. 0-200 arası geçerli (augment bonus +50'ye kadar).
        if (typeof ld.hp === "number" && ld.hp >= 0 && ld.hp <= 200) {
          if (state.hp !== ld.hp) {
            overrides.push(`hp ${state.hp}→${ld.hp}${ld.hp_source ? ` (${ld.hp_source})` : ""}`);
            state.hp = ld.hp;
          }
        }
        if (overrides.length > 0) {
          sanityLog += ` | local: ${overrides.join(", ")}`;
        }
      }
      // ─── /Local data override ────────────────────────────────────────

      // Debug logging — appears in dev.log. Critical for diagnosing "VLM reads
      // wrong screen" issues. Tells us whether the VLM call succeeded, whether
      // it recognized the screen as TFT (connected), and what it returned.
      const imgSize = body.image.length;
      const hasBoard = Boolean(body.boardCrop);
      const hasBench = Boolean(body.benchCrop);
      const rawPreview = vlmRaw ? vlmRaw.slice(0, 300).replace(/\n/g, " ") : "(empty)";
      console.log(
        `[snapshot] VLM ${result.ok ? "ok" : "FAIL"} | ` +
          `img=${imgSize}B board=${hasBoard} bench=${hasBench} | ` +
          `connected=${state.connected} hp=${state.hp} gold=${state.gold} ` +
          `lvl=${state.level} stage=${state.stage}-${state.round} board=${state.board.length} | ` +
          `raw="${rawPreview}"` +
          (result.error ? ` | err=${result.error}` : "") +
          sanityLog
      );
    } finally {
      _vlmInFlightSince = null;
    }
  } else if (body.state) {
    // Direct state path (manual entry / testing)
    state = mergeState(body.state, source);
  } else if (body.skipVlm && body.localData) {
    // ─── Skip-VLM path: Live API only (no image, no VLM) ────────────────
    // capture.py --skip-vlm --use-local modu için. VLM tamamen atlanır,
    // sadece Live API + gold OCR'dan state üretilir. Hız: ~50ms (VLM 3-8s).
    //
    // Kullanım: HP/gold/level Live API testi için. VLM halüsinasyonları
    // tamamen devre dışı — gördüğün her değer ya Live API'den ya OCR'den.
    //
    // shop/board/bench/augments BOŞ kalır (VLM okumadı). advisor yine de
    // level/gold/HP'ye göre temel tavsiyeler üretir.
    state = emptyState(source);
    const ld = body.localData;
    state.connected = ld.connected === true;
    if (typeof ld.level === "number" && ld.level >= 1 && ld.level <= 10) {
      state.level = ld.level;
    }
    if (typeof ld.gold === "number" && ld.gold >= 0 && ld.gold <= 999) {
      state.gold = ld.gold;
    }
    if (typeof ld.hp === "number" && ld.hp >= 0 && ld.hp <= 200) {
      state.hp = ld.hp;
    }
    console.log(
      `[snapshot] SKIP-VLM | connected=${state.connected} hp=${state.hp} ` +
        `gold=${state.gold} lvl=${state.level}` +
        (ld.hp_source ? ` | hp_source=${ld.hp_source}` : "") +
        (ld.game_time !== undefined ? ` | gameTime=${ld.game_time}s` : "")
    );
  } else {
    return NextResponse.json(
      { ok: false, error: "Provide either `image` (base64 data URL) or `state`, or use `skipVlm` + `localData`." },
      { status: 400 }
    );
  }

  // Run the advisor engine.
  let recommendation;
  try {
    recommendation = recommend(state);
  } catch (err) {
    ok = false;
    errorMsg = `Advisor failed: ${err instanceof Error ? err.message : String(err)}`;
    recommendation = null;
  }

  const elapsedMs = Date.now() - startedAt;

  // Persist to DB.
  let id = "";
  let dbError: string | null = null;
  try {
    const row = await db.snapshot.create({
      data: {
        source,
        level: state.level,
        gold: state.gold,
        hp: state.hp,
        stage: state.stage,
        round: state.round,
        streak: state.streak,
        shop: JSON.stringify(state.shop),
        board: JSON.stringify(state.board),
        bench: JSON.stringify(state.bench),
        augments: JSON.stringify(state.augments),
        // Derive a flat items list from board units for quick querying.
        traits: JSON.stringify([]),
        items: JSON.stringify(
          state.board.flatMap((u) => u.items ?? []).filter((i) => i)
        ),
        vlmRaw,
        recommendations: JSON.stringify(recommendation ?? {}),
        ok,
        errorMsg,
      },
    });
    id = row.id;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error("[snapshot] DB insert failed:", dbError);
    // Don't fail the whole request — still return the recommendation.
    // But surface the DB issue via dbError so the client knows the
    // snapshot was NOT persisted (id will be empty).
  }

  return NextResponse.json({
    id,
    createdAt: new Date().toISOString(),
    elapsedMs,
    source,
    state,
    recommendation,
    ok: ok && id !== "",
    error: errorMsg,
    dbError,
  });
}

function mergeState(partial: Partial<GameState>, source: GameSource): GameState {
  const base = emptyState(source);
  base.connected = partial.connected ?? true;
  if (typeof partial.level === "number") base.level = partial.level;
  if (typeof partial.gold === "number") base.gold = partial.gold;
  if (typeof partial.hp === "number") base.hp = partial.hp;
  if (typeof partial.stage === "number") base.stage = partial.stage;
  if (typeof partial.round === "number") base.round = partial.round;
  if (typeof partial.streak === "number") base.streak = partial.streak;
  if (Array.isArray(partial.shop)) base.shop = partial.shop;
  if (Array.isArray(partial.board)) base.board = partial.board;
  if (Array.isArray(partial.bench)) base.bench = partial.bench;
  if (Array.isArray(partial.augments)) base.augments = partial.augments;
  return base;
}

/**
 * Fetch the last known good GameState from the DB for sanity filtering.
 * "Good" = ok=true (VLM succeeded) AND connected=true (VLM recognized TFT)
 * AND source matches (live baseline for live captures, manual for manual).
 *
 * Source filtering is CRITICAL: manual uploads (Yükle tab) are one-off tests.
 * If a user manually uploads level=9 stage=6-7, then starts capture.py in a
 * real match at level=1 stage=1-1, the sanity filter would wrongly reject the
 * real values ("level can't decrease") without source filtering. By scoping
 * to the same source, manual tests never pollute the live baseline.
 *
 * Returns null if there's no prior good snapshot of the same source.
 */
async function getLastGoodState(source: GameSource): Promise<GameState | null> {
  try {
    const row = await db.snapshot.findFirst({
      where: { ok: true, source },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    if (!row) return null;
    // Reconstruct the GameState. We can't read `connected` directly from the
    // row (it's not stored), so we infer it from `ok` — ok=true means the VLM
    // call succeeded, which we treat as "connected" for filtering purposes.
    // (The snapshot route stores the actual connected flag in the state JSON
    // via the recommendations, but the row doesn't have a dedicated column.)
    return {
      source: row.source as GameSource,
      connected: true, // inferred from ok=true
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
  } catch (err) {
    // Don't let a DB read failure break the snapshot — just skip filtering.
    console.warn(
      "[snapshot] getLastGoodState failed, skipping sanity filter:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
