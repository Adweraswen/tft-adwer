/**
 * VLM analyzer — takes a TFT screenshot (base64 or URL) and extracts a GameState.
 *
 * This REPLACES the old Tesseract OCR pipeline entirely. The VLM understands
 * the whole screen contextually, so we don't need hardcoded coordinate crops
 * or fragile digit recognition. It reads HP, gold, level, stage, shop, board,
 * bench, items, augments — everything the Riot Live API doesn't expose for TFT.
 */

import ZAI from "z-ai-web-dev-sdk";
import type { GameState, BoardUnit, GameSource } from "./state";
import { CHAMPION_NAMES } from "@/lib/tft-data/champions";

// ─── Champion name normalization ────────────────────────────────────────────
// The VLM sometimes hallucinates names — it might read the trait panel and
// report "Sniper" or "Eradicator" as a champion, or misspell "Miss Fortune"
// as "MissFortune" / "Miss Fortune" / "MF". We normalize every VLM-reported
// champion name against the 61-champion Set 17 roster:
//   1. Exact (case-insensitive) match → keep
//   2. Strip spaces/punctuation/ Riot "TFT17_" prefix → retry exact match
//   3. Fuzzy match (Levenshtein distance ≤ 2) → keep closest
//   4. No match AND the name looks like a trait → DROP (it read the synergy panel)
//   5. No match at all → DROP (hallucination; wrong data is worse than missing)

/** Lowercased champion name → canonical name. */
const CHAMPION_LOOKUP: Map<string, string> = new Map(
  CHAMPION_NAMES.map((n) => [n.toLowerCase(), n])
);

/**
 * Trait names that the VLM might mistake for champions. If a reported name
 * matches one of these (case-insensitive), it's definitely the trait panel
 * being read, not a real champion — drop it.
 */
const TRAIT_NAMES_LOWER = new Set([
  "anima", "arbiter", "dark star", "darkstar", "mecha", "meeple",
  "nova", "n.o.v.a", "primordian", "psionic", "space groove", "spacegroove",
  "stargazer", "timebreaker", "bastion", "brawler", "challenger", "conduit",
  "fateweaver", "marauder", "replicator", "rogue", "shepherd", "sniper",
  "vanguard", "voyager", "bulwark", "commander", "dark lady", "darklady",
  "divine duelist", "divineduelist", "doomer", "eradicator", "factory new",
  "factorynew", "galaxy hunter", "galaxyhunter", "gun goddess", "gungoddess",
  "oracle", "party animal", "partyanimal", "redeemer",
]);

/** Levenshtein distance (insert/delete/substitute = 1 each). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Normalize a VLM-reported champion name to a canonical Set 17 champion name.
 * Returns the canonical name, or null if the name can't be matched (hallucination
 * or a trait name mistakenly reported as a champion).
 */
function normalizeChampionName(raw: string): string | null {
  if (!raw) return null;
  let name = raw.trim();
  if (!name) return null;
  // Strip Riot internal prefixes like "TFT17_"
  name = name.replace(/^TFT\d+_/i, "").replace(/_/g, " ").trim();
  if (!name) return null;

  const lower = name.toLowerCase();

  // 1. Exact match
  const exact = CHAMPION_LOOKUP.get(lower);
  if (exact) return exact;

  // 2. Strip spaces & punctuation, retry
  const compact = lower.replace(/[^a-z0-9]/g, "");
  for (const [champLower, champCanon] of CHAMPION_LOOKUP) {
    if (champLower.replace(/[^a-z0-9]/g, "") === compact) return champCanon;
  }

  // 3. Trait name filter — if it matches a trait, it's the synergy panel
  if (TRAIT_NAMES_LOWER.has(lower) || TRAIT_NAMES_LOWER.has(compact)) {
    return null;
  }

  // 4. Fuzzy match (Levenshtein ≤ 2) — catches typos like "Jihn" → "Jhin"
  let bestMatch: string | null = null;
  let bestDist = 3; // only accept distance ≤ 2
  for (const [champLower, champCanon] of CHAMPION_LOOKUP) {
    // Quick length pre-filter: don't fuzzy-match very different lengths
    if (Math.abs(champLower.length - lower.length) > 2) continue;
    const dist = levenshtein(lower, champLower);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = champCanon;
    }
  }
  if (bestMatch) return bestMatch;

  // 5. No match — likely hallucination. Drop it.
  return null;
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Raw structured output we ask the VLM to produce. */
interface VlmGameState {
  connected: boolean;
  level: number | null;
  gold: number | null;
  hp: number | null;
  stage: number | null;
  round: number | null;
  streak: number | null;
  shop: (string | null)[];
  board: { name: string | null; stars: number | null; items: (string | null)[] | null }[];
  bench: { name: string | null; stars: number | null; items: (string | null)[] | null }[];
  augments: (string | null)[];
  notes?: string;
}

export interface VlmAnalysisResult {
  state: GameState;
  raw: string; // raw VLM text response (for debugging)
  parsed: VlmGameState | null; // parsed JSON, or null if VLM didn't return valid JSON
  ok: boolean;
  error: string | null;
}

// ─── The prompt ─────────────────────────────────────────────────────────────

/**
 * SIMPLE prompt — eski çalışan versiyona dönüş (2026-07-09).
 *
 * Önceki yapay zeka prompt'u şişirdi: crop referansları ("image 2 board crop"),
 * reasoning zorunluluğu, carousel detection, anti-hallucination, golden rule...
 * Bunlar VLM'i şaşırttı, "board boş = TFT değil" sonucuna varmasına sebep oldu.
 *
 * Bu basit prompt ilk commit'te (8ebd40e) çalışıyordu. Geri döndük.
 * Crop parametreleri geriye dönük uyumluluk için kabul edilir ama görmezden gelinir.
 */
function buildPrompt(_hasBoardCrop: boolean = false, _hasBenchCrop: boolean = false): string {
  void _hasBoardCrop;
  void _hasBenchCrop;
  return `You are a TFT (Teamfight Tactics) game-state reader. You are given a screenshot of the TFT in-game client and must extract the current game state as JSON.

TFT UI layout (1920x1080 reference, but the screenshot may be any resolution):
- TOP-CENTER: current stage-round, e.g. "3-2" (stage 3, round 2)
- RIGHT-SIDE VERTICAL COLUMN (leaderboard): all 8 players' portraits + HP numbers, top-to-bottom.
- BOTTOM-CENTER (your player bar): YOUR gold (big yellow number), YOUR level (small number), the "Buy XP" button (shows cost), and the 5-slot shop (5 champion cards in a row)
- CENTER: the board (hex grid with placed champions) and bench (row of champions below the board)
- Augments appear as icons/text usually top-left or in a dedicated panel after stage 2-1

EXTRACTION RULES:
1. If the screenshot is NOT a TFT game screen (e.g. desktop, lobby, loading screen, menu), return {"connected": false, ...all nulls...}.

2. HP — read from the RIGHT-SIDE VERTICAL COLUMN (8 players top-to-bottom, each portrait + HP number).
   - YOUR portrait has a YELLOW/GOLD RING around it. The OTHER 7 players have RED rings.
   - Report the HP number next to YOUR (yellow-ringed) portrait.
   - If you cannot tell which portrait has the yellow ring, return hp: null. Do NOT guess.
   - Range: 0-100 (sometimes up to 150 with augment bonuses).

3. GOLD — the BIG standalone YELLOW number at the BOTTOM-CENTER of your player bar.
   - It is usually 2-3 digits (e.g. "34", "112", "8").
   - Do NOT confuse gold with the "Buy XP" button. The "Buy XP" button shows a small number (usually "4" or "8") — that is the COST to buy XP, NOT your gold.
   - Your gold is the BIG number, not on any button. If you see "4" on a button labeled "Buy XP", that 4 is NOT your gold.
   - If not visible, null. Range: 0-999.

4. LEVEL — the SMALL number to the LEFT of the purple XP bar (bottom-left of player bar).
   - Range: 1-10. ALWAYS in this range.
   - CRITICAL: There is a "Buy XP" button NEAR the XP bar. It shows a small number (usually "4" in early game, "8" later). That number is the GOLD COST to buy XP — it is NOT your level.
   - Your LEVEL is the number to the LEFT of the XP bar. The Buy XP button is to the RIGHT of the XP bar, with a "Satın Al" or "Buy XP" label above it.
   - DO NOT report the Buy XP button cost as your level. If you see "4" on a button labeled "Buy XP" or "Satın Al", that 4 is NOT your level.
   - Level in TFT Set 17 by stage:
     * Stage 1: usually level 2-3
     * Stage 2: usually level 4-5
     * Stage 3: usually level 6-7
     * Stage 4+: usually level 7-8
   - If the stage is 3+ but you see level "4", you are almost certainly reading the Buy XP button. Re-check the LEFT side of the XP bar.
   - If not visible or outside 1-10, return null.

5. Stage and round: parse the "X-Y" pattern top-center. stage = X (1-9), round = Y (1-7).

6. Streak: if there's a win/loss streak indicator (flame for win, blue for loss), report +N for wins or -N for losses. If unclear, 0.

7. Shop: an array of exactly 5 entries. For each of the 5 shop slots, report the champion name. Use the COMMON ENGLISH name (e.g. "Jhin", "Sett", "Fiora"). If the shop is in Turkish or another language, translate to the English champion name. If a slot is empty or you can't read it, use null.

8. Board: array of champions currently placed on the hex grid. For each: name (COMMON ENGLISH, translate if needed), stars (1, 2, or 3), items (array of item names). If stars unclear, assume 1. If items unclear, empty array.

9. Bench: array of champions on the bench (row below the board). Same format as board.

10. Augments: array of augment names if visible (after stage 2-1, 2-3, 3-2, 3-4, 4-2). Use COMMON ENGLISH names. If not visible or not yet chosen, empty array.

11. Champion/item/augment names: ALWAYS use the COMMON ENGLISH names. If you see "TFT17_Jhin" or similar internal IDs, strip the prefix. If the game UI is in Turkish (e.g. "Yıldız Gözlemcisi", "Micingil", "Atılgan"), translate to the English champion name (e.g. "Stargazer", "Meeple", "Vanguard"). Wrong language names break champion matching.

12. Be precise. Do NOT guess numbers you can't read — use null instead. Wrong data is worse than missing data.

RESPONSE FORMAT: Return ONLY a single JSON object, no markdown fences, no explanation. The object must have EXACTLY these keys:
{"connected": boolean, "level": number|null, "gold": number|null, "hp": number|null, "stage": number|null, "round": number|null, "streak": number|null, "shop": [string|null x5], "board": [{name, stars, items}], "bench": [{name, stars, items}], "augments": [string], "notes": string (optional, short observation)}`;
}

// ─── Module-level singleton SDK instance ────────────────────────────────────

let _zaiPromise: Promise<ZAI> | null = null;
async function getZai(): Promise<ZAI> {
  if (!_zaiPromise) {
    _zaiPromise = ZAI.create();
  }
  return _zaiPromise;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function toInt(v: unknown, lo: number, hi: number, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.floor(n), lo, hi);
}

function toBoardUnit(raw: unknown): BoardUnit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { name?: string | null; stars?: number | null; items?: unknown };
  const rawName = (r.name ?? "").toString().trim();
  if (!rawName) return null;
  // Normalize against the 61-champion Set 17 roster. This drops:
  //   - trait names mistakenly reported as champions (e.g. "Sniper", "Eradicator")
  //   - hallucinations that don't match any real champion
  //   - typos are fuzzy-corrected (e.g. "Jihn" → "Jhin")
  const cleanName = normalizeChampionName(rawName);
  if (!cleanName) return null;
  const stars = toInt(r.stars, 1, 3, 1);
  const items = Array.isArray(r.items)
    ? r.items.map((x) => (x ? String(x).trim() : "")).filter((x) => x.length > 0)
    : [];
  return { name: cleanName, stars, items };
}

function toBoardList(raw: unknown): BoardUnit[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toBoardUnit).filter((x): x is BoardUnit => x !== null);
}

function toStringArray(raw: unknown, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (x === null || x === undefined) return "";
      const s = String(x).trim().replace(/^TFT\d+_/i, "").replace(/_/g, " ");
      return s;
    })
    .filter((x) => x.length > 0)
    .slice(0, maxLen);
}

/**
 * Normalize a shop slot: returns the canonical champion name, or "" if the
 * VLM-reported name doesn't match any real champion. This prevents fabricated
 * shop entries from polluting the advisor's shop recommendations.
 */
function toShopSlot(v: unknown): string {
  if (v === null || v === undefined) return "";
  const raw = String(v).trim();
  if (!raw) return "";
  // Shop slots are lower-stakes than board/bench (the advisor treats unknown
  // shop champs as "skip"), but we still normalize so names match the roster.
  const normalized = normalizeChampionName(raw);
  return normalized ?? "";
}

/** Extract the first {...} JSON object from a possibly-noisy string. */
function extractJson(text: string): unknown | null {
  if (!text) return null;
  // Strip markdown code fences if present
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  // Direct parse first
  try {
    return JSON.parse(t);
  } catch {
    // Fall through to brace-matching
  }
  // Find the first balanced { ... }
  const start = t.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const slice = t.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ─── Main entry point ───────────────────────────────────────────────────────

/** True if the error looks like a rate-limit / overload response from the VLM API. */
function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|too many requests|rate.?limit|overload|try again later/i.test(msg);
}

/** Sleep helper that doesn't block the event loop. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call the VLM with retry-on-429. The z-ai VLM has a per-minute request cap;
 * under sustained capture (every ~10s) we occasionally hit it. On 429 we
 * back off (30s, then 60s) and retry. Non-429 errors propagate immediately.
 *
 * TIMEOUT: the z-ai SDK doesn't expose a timeout option, and without one the
 * call can hang indefinitely (network hiccup, API slowness). A hung call would
 * leave the server's in-flight guard stuck forever, blocking all subsequent
 * captures. We wrap the call in Promise.race with a 45s hard timeout — if the
 * VLM hasn't responded by then, we throw and the in-flight watchdog resets.
 */
const VLM_CALL_TIMEOUT_MS = 15_000; // 15s — flash + thinking disabled hedef 0.5-1.5 sn, 15s = sorun var

/**
 * Build the VLM message content from a prompt + one or more images.
 * The first image is always the full screenshot; subsequent images are
 * optional crops (board, bench) that give the VLM zoomed-in views.
 */
function buildVlmContent(prompt: string, images: string[]): Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
> {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];
  for (const img of images) {
    if (img) {
      content.push({ type: "image_url", image_url: { url: img } });
    }
  }
  return content;
}

async function callVlmWithTimeout(
  zai: ZAI,
  prompt: string,
  images: string[]
): Promise<{ raw: string }> {
  // GLM-4.6V-Flash: ücretsiz, hızlı (0.5-1.5 sn), thinking yok.
  // Önceki: default glm-4.6v (3-8 sn, thinking ON). Şimdi flash + thinking disabled.
  const callPromise = zai.chat.completions.createVision({
    model: "glm-4.6v-flash",
    messages: [
      {
        role: "user",
        content: buildVlmContent(prompt, images),
      },
    ],
    thinking: { type: "disabled" },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`VLM call timed out after ${VLM_CALL_TIMEOUT_MS}ms`));
    }, VLM_CALL_TIMEOUT_MS);
  });

  const response = await Promise.race([callPromise, timeoutPromise]);
  if (timer !== undefined) clearTimeout(timer);
  return { raw: response.choices[0]?.message?.content ?? "" };
}

async function callVlmWithRetry(
  prompt: string,
  images: string[],
  maxRetries = 2
): Promise<{ raw: string }> {
  const zai = await getZai();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callVlmWithTimeout(zai, prompt, images);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const rateLimited = isRateLimitError(err);
      const timedOut = msg.includes("timed out");
      if (rateLimited && attempt < maxRetries) {
        // Backoff: 30s on first 429, 60s on second
        const backoffMs = 30_000 * (attempt + 1);
        console.warn(
          `[vlm] 429 rate limited (attempt ${attempt + 1}/${maxRetries + 1}). Backing off ${backoffMs}ms.`
        );
        await sleep(backoffMs);
        continue;
      }
      if (timedOut) {
        // Don't retry timeouts — it's likely the API is overloaded, retrying
        // will just stack up more hung calls. Fail fast so the in-flight
        // watchdog resets quickly.
        console.warn(`[vlm] call timed out after ${VLM_CALL_TIMEOUT_MS}ms — failing fast.`);
        throw err;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Analyze a TFT screenshot and return a GameState.
 *
 * @param imageSrc - the FULL screenshot (base64 data URL or public URL). Used for stats.
 * @param source - the GameSource label to stamp on the resulting state.
 * @param opts.boardCrop - optional cropped board region (base64 data URL). When
 *   provided, the VLM reads board champions from this zoomed crop instead of
 *   the full screenshot, preventing confusion with the trait panel.
 * @param opts.benchCrop - optional cropped bench region (base64 data URL). Same idea.
 */
export interface AnalyzeOptions {
  boardCrop?: string;
  benchCrop?: string;
}

export async function analyzeScreenshot(
  imageSrc: string,
  source: GameSource = "manual",
  opts: AnalyzeOptions = {}
): Promise<VlmAnalysisResult> {
  const hasBoardCrop = Boolean(opts.boardCrop);
  const hasBenchCrop = Boolean(opts.benchCrop);
  const prompt = buildPrompt(hasBoardCrop, hasBenchCrop);
  // Image order: [full screenshot, board crop?, bench crop?]
  const images = [imageSrc, opts.boardCrop ?? "", opts.benchCrop ?? ""].filter(
    (s) => s.length > 0
  );

  let raw = "";
  try {
    const result = await callVlmWithRetry(prompt, images);
    raw = result.raw;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const rateLimited = isRateLimitError(err);
    return {
      state: emptyStateWith(source, false),
      raw: "",
      parsed: null,
      ok: false,
      error: rateLimited
        ? `VLM rate limited (429). Backoff exhausted. Try again in 60s.`
        : `VLM call failed: ${msg}`,
    };
  }

  const parsed = extractJson(raw) as VlmGameState | null;
  if (!parsed || typeof parsed !== "object") {
    return {
      state: emptyStateWith(source, false),
      raw,
      parsed: null,
      ok: false,
      error: "VLM did not return valid JSON",
    };
  }

  // Build a safe GameState from the parsed values.
  // Eski çalışan kod (8ebd40e): parsed.connected !== false.
  // Yani VLM açıkça "false" demezse true kabul et (varsayılan true).
  // Önceki yapay zeka bunu === true yaptı, varsayılan false oldu, VLM tereddüt edince her şey bozuldu.
  const connected = parsed.connected !== false;
  const shop5: string[] = Array.isArray(parsed.shop)
    ? [0, 1, 2, 3, 4].map((i) => toShopSlot(parsed.shop![i]))
    : ["", "", "", "", ""];

  const state: GameState = {
    source,
    connected,
    level: toInt(parsed.level, 1, 11, 1),
    gold: toInt(parsed.gold, 0, 999, 0),
    // HP: allow up to 150 (augment bonuses like Baller +10, Wise Elder +5,
    // Featherweights +5 can push HP above 100, up to ~110-150). The sanity
    // filter will further clamp hallucinations. Fallback 100 = start-of-game HP.
    hp: connected ? toInt(parsed.hp, 0, 150, 100) : 100,
    stage: toInt(parsed.stage, 1, 9, 1),
    round: toInt(parsed.round, 1, 7, 1),
    streak: toInt(parsed.streak, -50, 50, 0),
    shop: shop5,
    board: toBoardList(parsed.board),
    bench: toBoardList(parsed.bench),
    augments: toStringArray(parsed.augments, 6),
  };

  return {
    state,
    raw,
    parsed,
    ok: true,
    error: null,
  };
}

function emptyStateWith(source: GameSource, connected: boolean): GameState {
  return {
    source,
    connected,
    level: 1,
    gold: 0,
    hp: 100,
    stage: 1,
    round: 1,
    streak: 0,
    shop: ["", "", "", "", ""],
    board: [],
    bench: [],
    augments: [],
  };
}

/**
 * Quick health-check: analyze a 1x1 transparent PNG to verify the SDK is wired up.
 * Returns true if the SDK call succeeds (regardless of what the model says).
 */
export async function pingVlm(): Promise<boolean> {
  try {
    const zai = await getZai();
    await zai.chat.completions.createVision({
      model: "glm-4.6v-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Reply with the single word OK." },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              },
            },
          ],
        },
      ],
      thinking: { type: "disabled" },
    });
    return true;
  } catch {
    return false;
  }
}
