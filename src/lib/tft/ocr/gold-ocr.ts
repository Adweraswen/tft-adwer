/**
 * Gold OCR engine — Node.js port of public/capture-client/local_reader.py.
 *
 * PLAN.md 15.9 — Gold OCR:
 *   - TFT-OCR-BOT coordinates (1920x1080): (870, 883, 920, 909)
 *   - White text detection: R>thr & G>thr & B>thr → black text on white bg
 *   - Tesseract PSM 7, digits whitelist, 3x scale
 *   - Multi-variant sweep (PLAN 15.7): 8 threshold/coord/scale combos
 *
 * This module runs entirely in Node.js using `sharp` for image processing and
 * spawns the `tesseract` binary directly (no Python dependency on the server).
 */

import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const execFileAsync = promisify(execFile);

// ─── Coordinate variants (1920x1080 reference) ─────────────────────────────
// Mirrors GOLD_VARIANTS in local_reader.py. Keep in sync.
export interface GoldVariant {
  name: string;
  bbox: [number, number, number, number]; // x1, y1, x2, y2 @ 1920x1080
  threshold: number; // white-text R/G/B lower bound (0-255)
  scale: number; // upscale multiplier
  psm: number; // tesseract page-segmentation mode
}

const PRIMARY_BBOX: [number, number, number, number] = [870, 883, 920, 909]; // TFT-OCR-BOT
const PAINT_BBOX: [number, number, number, number] = [913, 879, 1033, 910]; // user Paint

export const GOLD_VARIANTS: GoldVariant[] = [
  { name: "tft-ocr-bot/180/3x/psm7", bbox: PRIMARY_BBOX, threshold: 180, scale: 3, psm: 7 },
  { name: "tft-ocr-bot/160/3x/psm7", bbox: PRIMARY_BBOX, threshold: 160, scale: 3, psm: 7 },
  { name: "tft-ocr-bot/200/3x/psm7", bbox: PRIMARY_BBOX, threshold: 200, scale: 3, psm: 7 },
  { name: "tft-ocr-bot/180/4x/psm7", bbox: PRIMARY_BBOX, threshold: 180, scale: 4, psm: 7 },
  { name: "tft-ocr-bot/180/3x/psm8", bbox: PRIMARY_BBOX, threshold: 180, scale: 3, psm: 8 },
  { name: "paint/180/3x/psm7", bbox: PAINT_BBOX, threshold: 180, scale: 3, psm: 7 },
  { name: "paint/160/3x/psm7", bbox: PAINT_BBOX, threshold: 160, scale: 3, psm: 7 },
  { name: "paint/200/3x/psm7", bbox: PAINT_BBOX, threshold: 200, scale: 3, psm: 7 },
];

// ─── Tesseract binary discovery ────────────────────────────────────────────
let _tesseractPath: string | null | undefined;
async function findTesseract(): Promise<string | null> {
  if (_tesseractPath !== undefined) return _tesseractPath;
  const candidates = [
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
    "/opt/homebrew/bin/tesseract",
    "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
  ];
  for (const c of candidates) {
    try {
      await execFileAsync(c, ["--version"]);
      _tesseractPath = c;
      return c;
    } catch {
      // try next
    }
  }
  // Try PATH lookup
  try {
    await execFileAsync("tesseract", ["--version"]);
    _tesseractPath = "tesseract";
    return "tesseract";
  } catch {
    _tesseractPath = null;
    return null;
  }
}

export async function isTesseractAvailable(): Promise<boolean> {
  return (await findTesseract()) !== null;
}

// ─── Image processing ──────────────────────────────────────────────────────

/**
 * Crop the gold region from a full screenshot and prepare it for OCR:
 *   1. Crop to bbox (scaled to actual image dimensions if not 1920x1080).
 *   2. White-text detection: pixels where R,G,B all > threshold → text (black),
 *      everything else → background (white). Tesseract wants black-on-white.
 *   3. Upscale by `scale` (LANCZOS) so small digits are legible.
 *
 * Returns PNG buffer of the processed image.
 */
async function processGoldCrop(
  fullPng: Buffer,
  variant: GoldVariant,
  imgW: number,
  imgH: number
): Promise<Buffer> {
  const scaleX = imgW / 1920;
  const scaleY = imgH / 1080;
  const left = Math.round(variant.bbox[0] * scaleX);
  const top = Math.round(variant.bbox[1] * scaleY);
  const right = Math.round(variant.bbox[2] * scaleX);
  const bottom = Math.round(variant.bbox[3] * scaleY);
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);

  const region = await sharp(fullPng)
    .extract({ left, top, width: w, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer();

  // White-text detection. region is RGBA raw bytes (channels=4 after ensureAlpha).
  const channels = 4;
  const out = Buffer.alloc(region.length); // same size, RGBA
  for (let i = 0; i < region.length; i += channels) {
    const r = region[i];
    const g = region[i + 1];
    const b = region[i + 2];
    const isText = r > variant.threshold && g > variant.threshold && b > variant.threshold;
    const v = isText ? 0 : 255; // text=black, bg=white
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }

  // Build grayscale PNG from raw, then upscale.
  const processedPng = await sharp(out, {
    raw: { width: w, height: h, channels },
  })
    .extractChannel(0)
    .toColorspace("b-w")
    .png()
    .toBuffer();

  return sharp(processedPng)
    .resize({
      width: w * variant.scale,
      height: h * variant.scale,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

/**
 * Run tesseract on a PNG buffer, digits-only whitelist.
 */
async function ocrDigits(pngBuf: Buffer, psm: number): Promise<string> {
  const tesseract = await findTesseract();
  if (!tesseract) return "";
  const tmpFile = join(tmpdir(), `tft-gold-${randomBytes(6).toString("hex")}.png`);
  const tmpOut = tmpFile.replace(/\.png$/, ""); // tesseract appends .txt
  try {
    await writeFile(tmpFile, pngBuf);
    await execFileAsync(tesseract, [
      tmpFile,
      tmpOut,
      "--psm",
      String(psm),
      "-c",
      "tessedit_char_whitelist=0123456789",
    ], { timeout: 8000 });
    const txt = await readFile(`${tmpOut}.txt`, "utf8");
    return txt.trim();
  } catch {
    return "";
  } finally {
    try { await import("fs/promises").then(fs => fs.unlink(tmpFile).catch(() => {})); } catch {}
    try { await import("fs/promises").then(fs => fs.unlink(`${tmpOut}.txt`).catch(() => {})); } catch {}
  }
}

function parseGold(raw: string): number | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const gold = parseInt(digits, 10);
  if (Number.isNaN(gold)) return null;
  // TFT gold sanity: 0-999 (practical max ~200, augments/galio can push higher)
  if (gold < 0 || gold > 999) return null;
  return gold;
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface GoldVariantResult {
  name: string;
  bbox: [number, number, number, number];
  threshold: number;
  scale: number;
  psm: number;
  /** Raw OCR text from tesseract (digits whitelist). */
  rawOcr: string;
  /** Parsed gold value, or null if OCR failed / out of sanity range. */
  gold: number | null;
  /** Raw cropped region as base64 PNG (for the UI). */
  rawCropB64: string;
  /** Processed (white-text → black-on-white, upscaled) as base64 PNG. */
  processedB64: string;
  /** Error message if this variant crashed, else null. */
  error: string | null;
}

export interface GoldOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  variants: GoldVariantResult[];
  /** Best gold reading (first variant that produced a sane value). */
  bestGold: number | null;
  /** Name of the variant that produced bestGold. */
  bestVariant: string | null;
  error: string | null;
}

/**
 * Run the full Gold OCR sweep on a PNG/JPEG buffer.
 * Returns every variant's raw + processed image (base64) and OCR result.
 */
export async function runGoldOcrSweep(fullImage: Buffer): Promise<GoldOcrResult> {
  const tesseractAvailable = await isTesseractAvailable();

  // Read image metadata to scale bbox to actual dimensions.
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
      bestGold: null,
      bestVariant: null,
      error: "Image has no dimensions (corrupt or unsupported format).",
    };
  }

  // Normalize input to PNG for sharp extract + raw pipeline.
  const pngBuf = await sharp(fullImage).png().toBuffer();

  const variants: GoldVariantResult[] = [];
  let bestGold: number | null = null;
  let bestVariant: string | null = null;

  for (const v of GOLD_VARIANTS) {
    try {
      // Raw crop (for UI display) — keep as small PNG, no processing.
      const scaleX = imgW / 1920;
      const scaleY = imgH / 1080;
      const left = Math.round(v.bbox[0] * scaleX);
      const top = Math.round(v.bbox[1] * scaleY);
      const right = Math.round(v.bbox[2] * scaleX);
      const bottom = Math.round(v.bbox[3] * scaleY);
      const w = Math.max(1, right - left);
      const h = Math.max(1, bottom - top);
      const rawCrop = await sharp(pngBuf)
        .extract({ left, top, width: w, height: h })
        .png()
        .toBuffer();

      const processed = await processGoldCrop(pngBuf, v, imgW, imgH);
      const rawOcr = tesseractAvailable ? await ocrDigits(processed, v.psm) : "";
      const gold = tesseractAvailable ? parseGold(rawOcr) : null;

      variants.push({
        name: v.name,
        bbox: v.bbox,
        threshold: v.threshold,
        scale: v.scale,
        psm: v.psm,
        rawOcr,
        gold,
        rawCropB64: `data:image/png;base64,${rawCrop.toString("base64")}`,
        processedB64: `data:image/png;base64,${processed.toString("base64")}`,
        error: null,
      });

      if (gold !== null && bestGold === null) {
        bestGold = gold;
        bestVariant = v.name;
      }
    } catch (e) {
      variants.push({
        name: v.name,
        bbox: v.bbox,
        threshold: v.threshold,
        scale: v.scale,
        psm: v.psm,
        rawOcr: "",
        gold: null,
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
    bestGold,
    bestVariant,
    error: null,
  };
}

/**
 * Persist a debug bundle to /home/z/my-project/debug-gold/ for the user to
 * inspect offline. Mirrors the Python --gold-debug flag.
 */
export async function saveDebugBundle(
  fullImage: Buffer,
  result: GoldOcrResult,
  label: string = ""
): Promise<string> {
  const debugDir = join(process.cwd(), "debug-gold");
  if (!existsSync(debugDir)) await mkdir(debugDir, { recursive: true });
  const ts = Date.now();
  const safe = label.replace(/[^a-z0-9_-]/gi, "_").slice(0, 32) || "run";
  const full = await sharp(fullImage).png().toBuffer();
  await writeFile(join(debugDir, `fullscreen_${safe}_${ts}.png`), full);
  for (const v of result.variants) {
    if (!v.processedB64) continue;
    const buf = Buffer.from(v.processedB64.split(",")[1] ?? "", "base64");
    await writeFile(join(debugDir, `gold_processed_${v.name.replace(/\//g, "_")}_${safe}_${ts}.png`), buf);
    if (v.rawCropB64) {
      const rb = Buffer.from(v.rawCropB64.split(",")[1] ?? "", "base64");
      await writeFile(join(debugDir, `gold_raw_${v.name.replace(/\//g, "_")}_${safe}_${ts}.png`), rb);
    }
  }
  await writeFile(
    join(debugDir, `result_${safe}_${ts}.json`),
    JSON.stringify(
      {
        ts,
        bestGold: result.bestGold,
        bestVariant: result.bestVariant,
        imageWidth: result.imageWidth,
        imageHeight: result.imageHeight,
        tesseractAvailable: result.tesseractAvailable,
        variants: result.variants.map((v) => ({
          name: v.name,
          bbox: v.bbox,
          threshold: v.threshold,
          scale: v.scale,
          psm: v.psm,
          rawOcr: v.rawOcr,
          gold: v.gold,
          error: v.error,
        })),
      },
      null,
      2
    )
  );
  return debugDir;
}
