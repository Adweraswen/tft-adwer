/**
 * Item OCR engine — PLAN.md 15.5 step 6 (Item, medium).
 *
 * TFT items appear as small icons below/around champions on the board. Each
 * completed item has a unique icon. Recognizing the icon via pure OCR is hard
 * (icons aren't text), but the item NAME often appears in tooltips/hover.
 *
 * For the test tool, we take a simpler approach: the user uploads a crop of
 * an item icon (or a full screenshot), we analyze the icon's color histogram
 * + dominant hues and match against a pre-computed signature table.
 *
 * Since building a full template-matching system requires downloading all
 * item icons first (Data Dragon step), this engine focuses on:
 *   1. Color signature extraction (dominant hue, brightness, saturation).
 *   2. Matching against known item color profiles (hard-coded from visual
 *      inspection of TFT item icons — to be refined once DDragon icons are
 *      downloaded).
 *   3. OCR fallback: if the region contains text (item name on hover), read it.
 *
 * This is the entry point for item recognition — the color-signature approach
 * will be replaced/augmented with template matching once DDragon icons land.
 */

import sharp from "sharp";
import { isTesseractAvailable, scaleBbox, cropRegion, processCrop, ocrText as runOcrText } from "./engine";
import { ITEMS } from "@/lib/tft-data";

// ─── Item icon color signatures ───────────────────────────────────────────
// Dominant hue (0-360), saturation (0-1), brightness (0-255) for each item.
// These are APPROXIMATE — to be refined once DDragon icons are downloaded
// and we can compute exact signatures. For now, they distinguish items by
// their primary color family.
interface ItemSignature {
  name: string;
  category: string;
  component: boolean;
  /** Dominant hue in degrees (0-360), or -1 for grayscale. */
  hue: number;
  /** Saturation 0-1. */
  saturation: number;
  /** Brightness 0-255. */
  brightness: number;
  /** Human-readable color name for the UI. */
  colorName: string;
}

// Approximate signatures based on visual inspection of TFT item icons.
// Source: in-game icons, TFT wiki. Will be replaced by computed signatures.
const ITEM_SIGNATURES: ItemSignature[] = [
  // Components — distinct single colors
  { name: "B.F. Sword",        category: "AD",      component: true,  hue: 0,   saturation: 0.1, brightness: 180, colorName: "gümüş" },
  { name: "Recurve Bow",       category: "AS",      component: true,  hue: 30,  saturation: 0.4, brightness: 140, colorName: "kahve" },
  { name: "Needlessly Large Rod", category: "AP",   component: true,  hue: 270, saturation: 0.5, brightness: 160, colorName: "mor" },
  { name: "Tear of the Goddess", category: "Mana",  component: true,  hue: 200, saturation: 0.6, brightness: 180, colorName: "mavi" },
  { name: "Chain Vest",        category: "Tank",    component: true,  hue: 0,   saturation: 0.05,brightness: 120, colorName: "gri" },
  { name: "Negatron Cloak",    category: "Tank",    component: true,  hue: 280, saturation: 0.4, brightness: 100, colorName: "koyu mor" },
  { name: "Giant's Belt",      category: "Tank",    component: true,  hue: 20,  saturation: 0.5, brightness: 130, colorName: "turuncu" },
  { name: "Spatula",           category: "Utility", component: true,  hue: 50,  saturation: 0.7, brightness: 200, colorName: "sarı" },
  { name: "Glove",             category: "Crit",    component: true,  hue: 180, saturation: 0.3, brightness: 150, colorName: "camgöbeği" },
];

// ─── Result types ─────────────────────────────────────────────────────────
export interface ItemColorSig {
  hue: number;
  saturation: number;
  brightness: number;
  /** Percentage of pixels that are "colorful" (saturation > 0.2). */
  colorfulness: number;
}

export interface ItemMatch {
  name: string;
  category: string;
  component: boolean;
  colorName: string;
  /** Similarity 0-1 based on hue/sat/brightness distance. */
  score: number;
}

export interface ItemOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  /** Region that was analyzed (1080p reference coords). */
  region: [number, number, number, number];
  colorSignature: ItemColorSig | null;
  /** Top 3 item matches by color signature. */
  colorMatches: ItemMatch[];
  /** OCR text (if region has text — e.g. item name on hover tooltip). */
  ocrText: string | null;
  /** Fuzzy item name matches from OCR. */
  ocrMatches: { name: string; score: number }[];
  rawCropB64: string;
  error: string | null;
}

// ─── Color signature extraction ───────────────────────────────────────────

async function extractColorSignature(pngBuf: Buffer, region: { left: number; top: number; width: number; height: number }): Promise<ItemColorSig> {
  const raw = await sharp(pngBuf)
    .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  const total = raw.length / channels;
  let hueSum = 0;
  let satSum = 0;
  let brightSum = 0;
  let colorfulCount = 0;
  let hueWeightSum = 0;

  for (let i = 0; i < raw.length; i += channels) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    // HSV conversion
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const brightness = max;
    const saturation = max === 0 ? 0 : delta / max;
    let hue = 0;
    if (delta !== 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
    }
    // Weight by saturation — colorful pixels dominate the signature.
    const weight = saturation;
    hueSum += hue * weight;
    hueWeightSum += weight;
    satSum += saturation;
    brightSum += brightness;
    if (saturation > 0.2) colorfulCount++;
  }

  const avgHue = hueWeightSum > 0 ? hueSum / hueWeightSum : 0;
  const avgSat = satSum / total;
  const avgBright = brightSum / total;
  return {
    hue: avgHue,
    saturation: avgSat,
    brightness: avgBright,
    colorfulness: colorfulCount / total,
  };
}

function matchByColor(sig: ItemColorSig): ItemMatch[] {
  const matches: ItemMatch[] = [];
  for (const item of ITEM_SIGNATURES) {
    // Hue distance (circular, 0-180).
    let hueDist = Math.abs(sig.hue - item.hue);
    if (hueDist > 180) hueDist = 360 - hueDist;
    const hueScore = 1 - hueDist / 180;
    const satScore = 1 - Math.abs(sig.saturation - item.saturation);
    const brightScore = 1 - Math.abs(sig.brightness - item.brightness) / 255;
    // Weighted: hue matters most for colored items, brightness for grayscale.
    const score = sig.colorfulness > 0.15
      ? hueScore * 0.6 + satScore * 0.25 + brightScore * 0.15
      : brightScore * 0.7 + satScore * 0.3;
    matches.push({
      name: item.name,
      category: item.category,
      component: item.component,
      colorName: item.colorName,
      score: Math.max(0, Math.min(1, score)),
    });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 3);
}

// ─── OCR fuzzy matching for item names ────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  const prev = new Array(lb + 1);
  const curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return prev[lb];
}

function fuzzyMatchItem(rawOcr: string): { name: string; score: number }[] {
  if (!rawOcr || rawOcr.trim().length < 2) return [];
  const cleaned = rawOcr.replace(/\s+/g, " ").trim().toLowerCase();
  const candidates = ITEMS.map((item) => {
    const maxLen = Math.max(cleaned.length, item.name.length);
    const dist = levenshtein(cleaned, item.name.toLowerCase());
    return { name: item.name, score: 1 - dist / maxLen };
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates.filter((c) => c.score >= 0.4).slice(0, 3);
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Analyze a single item icon region. The user specifies the region (1080p
 * reference coords) via query params, OR we default to a test region.
 */
export async function runItemOcr(
  fullImage: Buffer,
  region1080: [number, number, number, number]
): Promise<ItemOcrResult> {
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
      region: region1080,
      colorSignature: null,
      colorMatches: [],
      ocrText: null,
      ocrMatches: [],
      rawCropB64: "",
      error: "Image has no dimensions.",
    };
  }

  const pngBuf = await sharp(fullImage).png().toBuffer();
  const region = scaleBbox(region1080, imgW, imgH);

  try {
    const rawCrop = await cropRegion(pngBuf, region);
    const colorSig = await extractColorSignature(pngBuf, region);
    const colorMatches = matchByColor(colorSig);

    // OCR fallback — try to read text if present (low priority, item icons usually don't have text).
    let ocrText: string | null = null;
    let ocrMatches: { name: string; score: number }[] = [];
    if (tesseractAvailable) {
      const processed = await processCrop(pngBuf, region, 180, 3);
      ocrText = await runOcrText(processed, 7, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'-. ");
      if (ocrText) ocrMatches = fuzzyMatchItem(ocrText);
    }

    return {
      ok: true,
      tesseractAvailable,
      imageWidth: imgW,
      imageHeight: imgH,
      region: region1080,
      colorSignature: colorSig,
      colorMatches,
      ocrText: ocrText || null,
      ocrMatches,
      rawCropB64: `data:image/png;base64,${rawCrop.toString("base64")}`,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      tesseractAvailable,
      imageWidth: imgW,
      imageHeight: imgH,
      region: region1080,
      colorSignature: null,
      colorMatches: [],
      ocrText: null,
      ocrMatches: [],
      rawCropB64: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export { ITEMS, ITEM_SIGNATURES };
