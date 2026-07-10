/**
 * Round OCR engine — PLAN.md 15.5 step 2.
 *
 * TFT round indicator (e.g. "3-2", "1-1", "6-3") appears at the top-center
 * of the screen. TFT-OCR-BOT coordinates (1920x1080): (753, 10, 870, 34).
 *
 * Pipeline (same as Gold OCR):
 *   1. Crop region (753, 10, 870, 34) — scaled to actual image dims.
 *   2. White-text detection: R>thr & G>thr & B>thr → black text, white bg.
 *   3. LANCZOS upscale (3x or 4x).
 *   4. Tesseract PSM7, whitelist "0123456789-".
 *
 * Multi-variant sweep (PLAN 15.7): tries 8 threshold/scale/PSM combos.
 */

import sharp from "sharp";
import {
  findTesseract,
  isTesseractAvailable,
  scaleBbox,
  cropRegion,
  processCrop,
  processCropMode,
  type CropMode,
  ocrText,
} from "./engine";

// ─── Round OCR coordinate variants (1920x1080 reference) ──────────────────
export interface RoundVariant {
  name: string;
  bbox: [number, number, number, number];
  threshold: number;
  scale: number;
  psm: number;
  mode: CropMode;
}

// Primary: TFT-OCR-BOT coords (PLAN 15.5)
const PRIMARY_BBOX: [number, number, number, number] = [753, 10, 870, 34];
// Fallback: slightly wider/taller in case the text is larger
const WIDE_BBOX: [number, number, number, number] = [740, 6, 890, 40];

export const ROUND_VARIANTS: RoundVariant[] = [
  // "white" mode (strict — all RGB > threshold) — works for pure-white text
  { name: "white/180/3x/psm7", bbox: PRIMARY_BBOX, threshold: 180, scale: 3, psm: 7, mode: "white" },
  { name: "white/150/3x/psm7", bbox: PRIMARY_BBOX, threshold: 150, scale: 3, psm: 7, mode: "white" },
  { name: "white/130/3x/psm7", bbox: PRIMARY_BBOX, threshold: 130, scale: 3, psm: 7, mode: "white" },
  // "bright" mode (max RGB > threshold) — catches grayish/off-white text
  { name: "bright/120/3x/psm7", bbox: PRIMARY_BBOX, threshold: 120, scale: 3, psm: 7, mode: "bright" },
  { name: "bright/100/3x/psm7", bbox: PRIMARY_BBOX, threshold: 100, scale: 3, psm: 7, mode: "bright" },
  { name: "bright/150/3x/psm7", bbox: PRIMARY_BBOX, threshold: 150, scale: 3, psm: 7, mode: "bright" },
  { name: "bright/120/4x/psm7", bbox: PRIMARY_BBOX, threshold: 120, scale: 4, psm: 7, mode: "bright" },
  { name: "bright/120/3x/psm8", bbox: PRIMARY_BBOX, threshold: 120, scale: 3, psm: 8, mode: "bright" },
  // wide fallback with bright mode
  { name: "wide-bright/120/3x/psm7", bbox: WIDE_BBOX, threshold: 120, scale: 3, psm: 7, mode: "bright" },
  { name: "wide-bright/100/3x/psm7", bbox: WIDE_BBOX, threshold: 100, scale: 3, psm: 7, mode: "bright" },
];

const ROUND_WHITELIST = "0123456789-";

// ─── Result types ─────────────────────────────────────────────────────────
export interface RoundVariantResult {
  name: string;
  bbox: [number, number, number, number];
  threshold: number;
  scale: number;
  psm: number;
  mode: CropMode;
  rawOcr: string;
  /** Parsed round string e.g. "3-2", or null if OCR failed / sanity check failed. */
  round: string | null;
  /** Parsed stage number (e.g. 3 for "3-2"), or null. */
  stage: number | null;
  /** Parsed round-within-stage number (e.g. 2 for "3-2"), or null. */
  roundNum: number | null;
  rawCropB64: string;
  processedB64: string;
  error: string | null;
}

export interface RoundOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  variants: RoundVariantResult[];
  /** Best round reading (first variant that produced a sane "X-Y" value). */
  bestRound: string | null;
  bestStage: number | null;
  bestRoundNum: number | null;
  bestVariant: string | null;
  error: string | null;
}

/**
 * Parse "3-2" → { stage: 3, round: 2 }. Sanity: stage 1-9, round 1-7.
 */
function parseRound(raw: string): { stage: number; round: number } | null {
  if (!raw) return null;
  // Accept "3-2", "3 - 2", "3–2" (en-dash), "10-1" etc.
  const m = raw.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
  if (!m) return null;
  const stage = parseInt(m[1], 10);
  const round = parseInt(m[2], 10);
  if (Number.isNaN(stage) || Number.isNaN(round)) return null;
  // TFT sanity: stage 1-9 (10/11 ultra-late), round 1-7
  if (stage < 1 || stage > 11) return null;
  if (round < 1 || round > 7) return null;
  return { stage, round };
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function runRoundOcrSweep(fullImage: Buffer): Promise<RoundOcrResult> {
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
      bestRound: null,
      bestStage: null,
      bestRoundNum: null,
      bestVariant: null,
      error: "Image has no dimensions (corrupt or unsupported format).",
    };
  }

  const pngBuf = await sharp(fullImage).png().toBuffer();

  const variants: RoundVariantResult[] = [];
  let bestRound: string | null = null;
  let bestStage: number | null = null;
  let bestRoundNum: number | null = null;
  let bestVariant: string | null = null;

  for (const v of ROUND_VARIANTS) {
    try {
      const region = scaleBbox(v.bbox, imgW, imgH);
      const rawCrop = await cropRegion(pngBuf, region);
      const processed = await processCropMode(pngBuf, region, v.threshold, v.scale, v.mode);

      const rawOcr = tesseractAvailable ? await ocrText(processed, v.psm, ROUND_WHITELIST) : "";
      const parsed = parseRound(rawOcr);
      const round = parsed ? `${parsed.stage}-${parsed.round}` : null;

      variants.push({
        name: v.name,
        bbox: v.bbox,
        threshold: v.threshold,
        scale: v.scale,
        psm: v.psm,
        mode: v.mode,
        rawOcr,
        round,
        stage: parsed?.stage ?? null,
        roundNum: parsed?.round ?? null,
        rawCropB64: `data:image/png;base64,${rawCrop.toString("base64")}`,
        processedB64: `data:image/png;base64,${processed.toString("base64")}`,
        error: null,
      });

      if (parsed && bestRound === null) {
        bestRound = round;
        bestStage = parsed.stage;
        bestRoundNum = parsed.round;
        bestVariant = v.name;
      }
    } catch (e) {
      variants.push({
        name: v.name,
        bbox: v.bbox,
        threshold: v.threshold,
        scale: v.scale,
        psm: v.psm,
        mode: v.mode,
        rawOcr: "",
        round: null,
        stage: null,
        roundNum: null,
        rawCropB64: "",
        processedB64: "",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    ok: true,
    tesseractAvailable,
    imageWidth: imgW,
    imageHeight: imgH,
    variants,
    bestRound,
    bestStage,
    bestRoundNum,
    bestVariant,
    error: null,
  };
}

export { findTesseract };
