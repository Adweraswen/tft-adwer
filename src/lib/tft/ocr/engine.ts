/**
 * Shared OCR engine helpers — used by gold-ocr.ts, round-ocr.ts, and future
 * shop/bench/item OCR modules.
 *
 * All helpers are pure (no TFT-specific knowledge). TFT-specific coordinate
 * sets + whitelists live in their own modules.
 */

import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const execFileAsync = promisify(execFile);

// ─── Tesseract binary discovery (cached) ──────────────────────────────────
let _tesseractPath: string | null | undefined;

export async function findTesseract(): Promise<string | null> {
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

// ─── Image processing ─────────────────────────────────────────────────────

export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Scale a 1920x1080-reference bbox to the actual image dimensions.
 */
export function scaleBbox(
  bbox: [number, number, number, number],
  imgW: number,
  imgH: number
): CropRegion {
  const scaleX = imgW / 1920;
  const scaleY = imgH / 1080;
  const left = Math.round(bbox[0] * scaleX);
  const top = Math.round(bbox[1] * scaleY);
  const right = Math.round(bbox[2] * scaleX);
  const bottom = Math.round(bbox[3] * scaleY);
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

/**
 * Crop a region from a full PNG buffer.
 */
export async function cropRegion(pngBuf: Buffer, region: CropRegion): Promise<Buffer> {
  return sharp(pngBuf)
    .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
    .png()
    .toBuffer();
}

/**
 * Prepare a crop for OCR: white-text detection (R,G,B all > threshold → text=black,
 * everything else → white background), then LANCZOS upscale.
 *
 * TFT UI text is white on dark backgrounds. Tesseract wants black-on-white.
 */
export async function processCrop(
  fullPng: Buffer,
  region: CropRegion,
  threshold: number,
  scale: number
): Promise<Buffer> {
  const { width: w, height: h } = region;
  const regionBuf = await sharp(fullPng)
    .extract({ left: region.left, top: region.top, width: w, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  const out = Buffer.alloc(regionBuf.length);
  for (let i = 0; i < regionBuf.length; i += channels) {
    const r = regionBuf[i];
    const g = regionBuf[i + 1];
    const b = regionBuf[i + 2];
    const isText = r > threshold && g > threshold && b > threshold;
    const v = isText ? 0 : 255;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }

  const processedPng = await sharp(out, {
    raw: { width: w, height: h, channels },
  })
    .extractChannel(0)
    .toColorspace("b-w")
    .png()
    .toBuffer();

  return sharp(processedPng)
    .resize({
      width: w * scale,
      height: h * scale,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

/**
 * Run tesseract on a PNG buffer with a custom whitelist + PSM.
 */
export async function ocrText(
  pngBuf: Buffer,
  psm: number,
  whitelist: string
): Promise<string> {
  const tesseract = await findTesseract();
  if (!tesseract) return "";
  const tmpFile = join(tmpdir(), `tft-ocr-${randomBytes(6).toString("hex")}.png`);
  const tmpOut = tmpFile.replace(/\.png$/, "");
  try {
    await writeFile(tmpFile, pngBuf);
    const args = [tmpFile, tmpOut, "--psm", String(psm)];
    if (whitelist) {
      args.push("-c", `tessedit_char_whitelist=${whitelist}`);
    }
    await execFileAsync(tesseract, args, { timeout: 8000 });
    const { readFile } = await import("fs/promises");
    const txt = await readFile(`${tmpOut}.txt`, "utf8");
    return txt.trim();
  } catch {
    return "";
  } finally {
    try {
      const { unlink } = await import("fs/promises");
      await unlink(tmpFile).catch(() => {});
      await unlink(`${tmpOut}.txt`).catch(() => {});
    } catch {
      // ignore
    }
  }
}

/**
 * Extract digits (and optional dash) from a raw OCR string.
 */
export function parseDigits(raw: string, allowDash: boolean = false): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(allowDash ? /[^\d-]/g : /\D/g, "");
  return cleaned || null;
}
