/**
 * Shop OCR engine — PLAN.md 15.5 step 4 (Shop, medium).
 *
 * TFT shop = 5 cards at the bottom of the screen. Each card shows a champion
 * name. TFT-OCR-BOT coordinates (1920x1080): shop text band (481, 1039, 1476, 1070).
 * Each card text region ~199px wide (996px / 5).
 *
 * Pipeline:
 *   1. Crop 5 card text regions (parallel).
 *   2. White-text detection (R>thr & G>thr & B>thr → black text, white bg).
 *   3. LANCZOS upscale (3x).
 *   4. Tesseract PSM7, ALPHABET whitelist (letters + space + apostrophe + hyphen).
 *   5. Fuzzy match OCR text against the CHAMPIONS roster (rapidfuzz-style,
 *      implemented with simple Levenshtein since rapidfuzz isn't a dep).
 *
 * Multi-variant sweep (PLAN 15.7): tries several threshold/scale combos.
 *
 * Türkçe client note: TFT TR client uses English champion names (verified
 * against ddragon data). So the whitelist is English-friendly. If the user's
 * client is actually TR-translated, we'll need a TR name map — the tester will
 * reveal this.
 */

import sharp from "sharp";
import {
  isTesseractAvailable,
  scaleBbox,
  cropRegion,
  processCrop,
  ocrText,
} from "./engine";
import { CHAMPIONS } from "@/lib/tft-data";

// ─── Shop card coordinates (1920x1080 reference) ───────────────────────────
// TFT-OCR-BOT shop text band: (481, 1039, 1476, 1070). 5 cards, each ~199px wide.
// Card text is centered in each card. We add slight padding.
export const SHOP_BAND: [number, number, number, number] = [481, 1039, 1476, 1070];
const SHOP_CARD_WIDTH_1080 = 199; // (1476-481)/5 ≈ 199

function shopCardBboxes(): [number, number, number, number][] {
  const bboxes: [number, number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x1 = SHOP_BAND[0] + i * SHOP_CARD_WIDTH_1080 + 4;
    const x2 = SHOP_BAND[0] + (i + 1) * SHOP_CARD_WIDTH_1080 - 4;
    bboxes.push([x1, SHOP_BAND[1], x2, SHOP_BAND[3]]);
  }
  return bboxes;
}

// Alternative: slightly taller band (some clients render text taller).
const SHOP_BAND_TALL: [number, number, number, number] = [481, 1035, 1476, 1075];

function shopCardBboxesTall(): [number, number, number, number][] {
  const bboxes: [number, number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x1 = SHOP_BAND_TALL[0] + i * SHOP_CARD_WIDTH_1080 + 4;
    const x2 = SHOP_BAND_TALL[0] + (i + 1) * SHOP_CARD_WIDTH_1080 - 4;
    bboxes.push([x1, SHOP_BAND_TALL[1], x2, SHOP_BAND_TALL[3]]);
  }
  return bboxes;
}

// ─── OCR variants ──────────────────────────────────────────────────────────
export interface ShopVariant {
  name: string;
  coordSet: "normal" | "tall";
  threshold: number;
  scale: number;
  psm: number;
}

export const SHOP_VARIANTS: ShopVariant[] = [
  { name: "normal/180/3x/psm7", coordSet: "normal", threshold: 180, scale: 3, psm: 7 },
  { name: "normal/160/3x/psm7", coordSet: "normal", threshold: 160, scale: 3, psm: 7 },
  { name: "normal/200/3x/psm7", coordSet: "normal", threshold: 200, scale: 3, psm: 7 },
  { name: "normal/180/4x/psm7", coordSet: "normal", threshold: 180, scale: 4, psm: 7 },
  { name: "normal/180/3x/psm8", coordSet: "normal", threshold: 180, scale: 3, psm: 8 },
  { name: "tall/180/3x/psm7", coordSet: "tall", threshold: 180, scale: 3, psm: 7 },
  { name: "tall/160/3x/psm7", coordSet: "tall", threshold: 160, scale: 3, psm: 7 },
  { name: "tall/200/3x/psm7", coordSet: "tall", threshold: 200, scale: 3, psm: 7 },
];

// Whitelist: letters (upper+lower), space, apostrophe, hyphen, period.
// Champion names like "Cho'Gath", "Kai'Sa", "Miss Fortune", "Aurelion Sol".
const SHOP_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'-. ";

// ─── Fuzzy matching (Levenshtein-based, no rapidfuzz dep) ──────────────────

/** Levenshtein distance, capped at maxDist for early exit. */
function levenshtein(a: string, b: string, maxDist: number = Infinity): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  // Rolling array.
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let bestInRow = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
      if (curr[j] < bestInRow) bestInRow = curr[j];
    }
    if (bestInRow > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

/** Normalized similarity 0-1 (1 = exact). */
function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase(), maxLen);
  return 1 - dist / maxLen;
}

export interface FuzzyMatch {
  name: string;
  cost: number;
  /** Normalized similarity 0-1. */
  score: number;
}

/**
 * Match OCR text against the champion roster. Returns top 3 candidates.
 * Handles common OCR errors: I↔l↔1, O↔0, apostrophe insertion/deletion.
 */
function fuzzyMatchChampion(rawOcr: string): FuzzyMatch[] {
  if (!rawOcr || rawOcr.trim().length < 2) return [];

  // Normalize OCR text: collapse spaces, trim, strip non-alpha (keep apostrophe/hyphen/space).
  const cleaned = rawOcr
    .replace(/\s+/g, " ")
    .trim()
    // Common OCR confusions for champion names.
    .replace(/[|]/g, "I")
    .replace(/[0]/g, "O");

  const candidates: FuzzyMatch[] = [];
  for (const champ of CHAMPIONS) {
    // Try exact + a few common normalization variants.
    const variants = [champ.name, champ.name.replace(/['']/g, ""), champ.name.replace(/['']/g, " ")];
    let best = 0;
    for (const v of variants) {
      const s = similarity(cleaned, v);
      if (s > best) best = s;
    }
    candidates.push({ name: champ.name, cost: Math.round((1 - best) * 100), score: best });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3);
}

// ─── Result types ──────────────────────────────────────────────────────────
export interface ShopCardResult {
  slot: number; // 0-4
  bbox: [number, number, number, number];
  rawOcr: string;
  /** Cleaned OCR text (whitespace normalized). */
  cleanedOcr: string;
  /** Top fuzzy match, or null if score < 0.5. */
  bestMatch: FuzzyMatch | null;
  /** Top 3 fuzzy candidates. */
  candidates: FuzzyMatch[];
  rawCropB64: string;
  processedB64: string;
  error: string | null;
}

export interface ShopVariantResult {
  variantName: string;
  cards: ShopCardResult[];
  /** How many of the 5 cards matched a champion with score >= 0.7. */
  matchedCount: number;
  error: string | null;
}

export interface ShopOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  variants: ShopVariantResult[];
  /** Best variant = most cards matched. */
  bestVariant: string | null;
  /** Best per-slot matches (from the best variant). */
  bestCards: ShopCardResult[] | null;
  error: string | null;
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function runShopOcrSweep(fullImage: Buffer): Promise<ShopOcrResult> {
  const tesseractAvailable = await isTesseractAvailable();

  const meta = await sharp(fullImage).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (!imgW || !imgH) {
    return {
      ok: false,
      tesseractAvailable,
      imageWidth: 0,
      imageHeight: 0,
      variants: [],
      bestVariant: null,
      bestCards: null,
      error: "Image has no dimensions.",
    };
  }

  const pngBuf = await sharp(fullImage).png().toBuffer();
  const normalBboxes = shopCardBboxes();
  const tallBboxes = shopCardBboxesTall();

  const variants: ShopVariantResult[] = [];

  for (const v of SHOP_VARIANTS) {
    try {
      const bboxes = v.coordSet === "tall" ? tallBboxes : normalBboxes;
      const cards: ShopCardResult[] = [];
      let matchedCount = 0;

      // Process 5 cards in parallel for speed (PLAN 15.5: "5 kart paralel OCR").
      const cardPromises = bboxes.map(async (bbox, i) => {
        const region = scaleBbox(bbox, imgW, imgH);
        const rawCrop = await cropRegion(pngBuf, region);
        const processed = await processCrop(pngBuf, region, v.threshold, v.scale);
        const rawOcr = tesseractAvailable ? await ocrText(processed, v.psm, SHOP_WHITELIST) : "";
        const cleanedOcr = rawOcr.replace(/\s+/g, " ").trim();
        const candidates = fuzzyMatchChampion(rawOcr);
        const bestMatch = candidates[0] && candidates[0].score >= 0.5 ? candidates[0] : null;
        if (bestMatch && bestMatch.score >= 0.7) matchedCount++;
        return {
          slot: i,
          bbox,
          rawOcr,
          cleanedOcr,
          bestMatch,
          candidates,
          rawCropB64: `data:image/png;base64,${rawCrop.toString("base64")}`,
          processedB64: `data:image/png;base64,${processed.toString("base64")}`,
          error: null as string | null,
        } as ShopCardResult;
      });

      const results = await Promise.all(cardPromises);
      cards.push(...results);

      variants.push({
        variantName: v.name,
        cards,
        matchedCount,
        error: null,
      });
    } catch (e) {
      variants.push({
        variantName: v.name,
        cards: [],
        matchedCount: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Best variant = most matched cards.
  let bestVariant: string | null = null;
  let bestMatched = -1;
  let bestCards: ShopCardResult[] | null = null;
  for (const v of variants) {
    if (v.error) continue;
    if (v.matchedCount > bestMatched) {
      bestMatched = v.matchedCount;
      bestVariant = v.variantName;
      bestCards = v.cards;
    }
  }

  return {
    ok: true,
    tesseractAvailable,
    imageWidth: imgW,
    imageHeight: imgH,
    variants,
    bestVariant,
    bestCards,
    error: null,
  };
}

export { CHAMPIONS };
