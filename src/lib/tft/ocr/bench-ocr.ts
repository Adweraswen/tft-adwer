/**
 * Bench OCR engine — PLAN.md 15.5 step 4 (Bench, easy).
 *
 * REVISED APPROACH (2026-07-10): Green HP bar detection did NOT work on real
 * TFT screenshots. New approach: COLOR VARIANCE.
 *
 * A bench slot that is OCCUPIED shows a champion portrait (lots of colors,
 * high variance). An EMPTY slot is a flat dark panel (low variance, near-black).
 * So "bench read" = for each slot, compute color std-dev → occupied if high.
 *
 * This is coordinate-independent in spirit: even auto-detect scans for
 * high-variance clusters in the bench band.
 *
 * Two modes (both run):
 *   1. FIXED: 9 hard-coded slot bboxes. For each, compute std-dev of luminance.
 *   2. AUTO: scan bench band, find high-variance columns, cluster them.
 */

import sharp from "sharp";
import {
  isTesseractAvailable,
  scaleBbox,
  cropRegion,
} from "./engine";

// ─── Bench slot coordinates (1920x1080 reference) ──────────────────────────
// REVISED (2026-07-10 user feedback): original y=770-845 (75px) only caught the
// BOTTOM of the portrait — champions whose shadow didn't extend down were missed.
// New: y=720-845 (125px) — captures the full portrait including head.
// We keep the old short bbox as an alternative variant so the user can compare.
const BENCH_Y_TOP = 720;        // widened: was 770
const BENCH_Y_BOTTOM = 845;
const BENCH_Y_TOP_SHORT = 770;  // old short variant (fallback)
const BENCH_SLOT_WIDTH = 110;
const BENCH_FIRST_SLOT_CENTER = 535;

function benchSlotCenters(): number[] {
  return Array.from({ length: 9 }, (_, i) => BENCH_FIRST_SLOT_CENTER + i * BENCH_SLOT_WIDTH);
}

function benchSlotBbox(centerX: number, yTop: number = BENCH_Y_TOP): [number, number, number, number] {
  const half = Math.floor(BENCH_SLOT_WIDTH / 2);
  return [centerX - half, yTop, centerX + half, BENCH_Y_BOTTOM];
}

function benchSlotCentersAlt(): number[] {
  return benchSlotCenters().map((x) => x + 8);
}

// ─── Occupancy detection variants ─────────────────────────────────────────
export interface OccupancyVariant {
  name: string;
  /** Std-dev threshold (0-100, on luminance 0-255). Slot occupied if std > threshold. */
  stdThreshold: number;
  /** Minimum fraction of "bright" pixels (luminance > 60) for occupied. Filters near-black noise. */
  brightMinRatio: number;
}

export const OCCUPANCY_VARIANTS: OccupancyVariant[] = [
  { name: "strict/std30-bright10", stdThreshold: 30, brightMinRatio: 0.10 },
  { name: "mid/std20-bright05", stdThreshold: 20, brightMinRatio: 0.05 },
  { name: "loose/std12-bright03", stdThreshold: 12, brightMinRatio: 0.03 },
  { name: "very-loose/std8-bright02", stdThreshold: 8, brightMinRatio: 0.02 },
];

// ─── Result types ─────────────────────────────────────────────────────────
export interface BenchSlotResult {
  index: number;
  bbox: [number, number, number, number];
  occupied: boolean;
  /** Std-dev of luminance (0-255 scale, reported as 0-100). */
  stdDev: number;
  /** Fraction of pixels with luminance > 60 (0-1). */
  brightRatio: number;
  /** Mean luminance (0-255). */
  meanLum: number;
  cropB64: string;
}

export interface BenchFixedResult {
  variantName: string;
  coordSet: "wide-primary" | "wide-alt" | "short-primary";
  stdThreshold: number;
  brightMinRatio: number;
  slots: BenchSlotResult[];
  occupiedCount: number;
  occupiedIndices: number[];
}

export interface BenchAutoCluster {
  centerX: number;
  width: number;
  /** Average std-dev in the cluster. */
  avgStd: number;
  mappedSlotIndex: number | null;
}

export interface BenchAutoResult {
  variantName: string;
  clusters: BenchAutoCluster[];
  occupiedCount: number;
}

export interface BenchVariantResult {
  occupancyVariant: string;
  fixedWidePrimary: BenchFixedResult;
  fixedWideAlt: BenchFixedResult;
  fixedShortPrimary: BenchFixedResult;
  auto: BenchAutoResult;
  error: string | null;
}

export interface BenchOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  variants: BenchVariantResult[];
  bestOccupiedCount: number | null;
  bestVariant: string | null;
  error: string | null;
}

// ─── Luminance stats ──────────────────────────────────────────────────────

interface LumStats {
  std: number; // 0-255
  brightRatio: number; // 0-1
  mean: number; // 0-255
}

async function computeLumStats(pngBuf: Buffer, region: { left: number; top: number; width: number; height: number }): Promise<LumStats> {
  const raw = await sharp(pngBuf)
    .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  const total = raw.length / channels;
  // Compute luminance per pixel (Rec. 601: 0.299R + 0.587G + 0.114B).
  const lums = new Float64Array(total);
  let sum = 0;
  let brightCount = 0;
  for (let i = 0, p = 0; i < raw.length; i += channels, p++) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lums[p] = lum;
    sum += lum;
    if (lum > 60) brightCount++;
  }
  const mean = sum / total;
  // Std-dev.
  let varSum = 0;
  for (let p = 0; p < total; p++) {
    const d = lums[p] - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / total);
  return {
    std,
    brightRatio: brightCount / total,
    mean,
  };
}

// ─── Fixed-slot mode ──────────────────────────────────────────────────────

async function runFixedMode(
  pngBuf: Buffer,
  imgW: number,
  imgH: number,
  centers: number[],
  coordSet: "wide-primary" | "wide-alt" | "short-primary",
  variant: OccupancyVariant
): Promise<BenchFixedResult> {
  const slots: BenchSlotResult[] = [];
  const occupiedIndices: number[] = [];
  const yTop = coordSet === "short-primary" ? BENCH_Y_TOP_SHORT : BENCH_Y_TOP;

  for (let i = 0; i < 9; i++) {
    const bbox1080 = benchSlotBbox(centers[i], yTop);
    const region = scaleBbox(bbox1080, imgW, imgH);
    const stats = await computeLumStats(pngBuf, region);
    // Occupied if std-dev high AND enough bright pixels (not just noise).
    const occupied = stats.std >= variant.stdThreshold && stats.brightRatio >= variant.brightMinRatio;
    const cropPng = await cropRegion(pngBuf, region);
    slots.push({
      index: i,
      bbox: bbox1080,
      occupied,
      stdDev: stats.std,
      brightRatio: stats.brightRatio,
      meanLum: stats.mean,
      cropB64: `data:image/png;base64,${cropPng.toString("base64")}`,
    });
    if (occupied) occupiedIndices.push(i);
  }

  return {
    variantName: variant.name,
    coordSet,
    stdThreshold: variant.stdThreshold,
    brightMinRatio: variant.brightMinRatio,
    slots,
    occupiedCount: occupiedIndices.length,
    occupiedIndices,
  };
}

// ─── Auto-detect mode ─────────────────────────────────────────────────────
// Scan bench band. For each column, compute std-dev of luminance vertically.
// High-std columns = part of an occupied slot. Cluster them.

async function runAutoMode(
  pngBuf: Buffer,
  imgW: number,
  imgH: number,
  variant: OccupancyVariant
): Promise<BenchAutoResult> {
  const bandTop = Math.round(770 * (imgH / 1080));
  const bandHeight = Math.max(1, Math.round(75 * (imgH / 1080)));
  const bandLeft = Math.round(480 * (imgW / 1920));
  const bandWidth = Math.max(1, Math.round(996 * (imgW / 1920)));

  const raw = await sharp(pngBuf)
    .extract({ left: bandLeft, top: bandTop, width: bandWidth, height: bandHeight })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  // For each column, compute std-dev of luminance.
  const colStd = new Float64Array(bandWidth);
  for (let x = 0; x < bandWidth; x++) {
    let sum = 0;
    for (let y = 0; y < bandHeight; y++) {
      const i = (y * bandWidth + x) * channels;
      sum += 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];
    }
    const mean = sum / bandHeight;
    let varSum = 0;
    for (let y = 0; y < bandHeight; y++) {
      const i = (y * bandWidth + x) * channels;
      const lum = 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];
      const d = lum - mean;
      varSum += d * d;
    }
    colStd[x] = Math.sqrt(varSum / bandHeight);
  }

  // Cluster adjacent columns with std > threshold.
  const MIN_WIDTH = 8; // wider than green mode — portraits are bigger than HP bars.
  const clusters: BenchAutoCluster[] = [];
  let clusterStart = -1;
  let clusterStdSum = 0;
  for (let x = 0; x <= bandWidth; x++) {
    const hasContent = x < bandWidth && colStd[x] > variant.stdThreshold * 0.7; // slightly relaxed
    if (hasContent && clusterStart === -1) {
      clusterStart = x;
      clusterStdSum = colStd[x];
    } else if (hasContent) {
      clusterStdSum += colStd[x];
    } else if (clusterStart !== -1) {
      const width = x - clusterStart;
      if (width >= MIN_WIDTH) {
        const centerXImg = bandLeft + clusterStart + Math.floor(width / 2);
        const centers1080 = benchSlotCenters();
        const scaleX = imgW / 1920;
        let nearest: number | null = null;
        let nearestDist = Infinity;
        for (let s = 0; s < 9; s++) {
          const slotCenterImg = centers1080[s] * scaleX;
          const dist = Math.abs(centerXImg - slotCenterImg);
          if (dist < nearestDist && dist < (BENCH_SLOT_WIDTH * scaleX) / 2) {
            nearestDist = dist;
            nearest = s;
          }
        }
        clusters.push({
          centerX: centerXImg,
          width,
          avgStd: clusterStdSum / width,
          mappedSlotIndex: nearest,
        });
      }
      clusterStart = -1;
      clusterStdSum = 0;
    }
  }

  return {
    variantName: variant.name,
    clusters,
    occupiedCount: clusters.length,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function runBenchOcrSweep(fullImage: Buffer): Promise<BenchOcrResult> {
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
      bestOccupiedCount: null,
      bestVariant: null,
      error: "Image has no dimensions.",
    };
  }

  const pngBuf = await sharp(fullImage).png().toBuffer();

  const variants: BenchVariantResult[] = [];
  const counts: number[] = [];

  for (const ov of OCCUPANCY_VARIANTS) {
    try {
      const fixedWidePrimary = await runFixedMode(pngBuf, imgW, imgH, benchSlotCenters(), "wide-primary", ov);
      const fixedWideAlt = await runFixedMode(pngBuf, imgW, imgH, benchSlotCentersAlt(), "wide-alt", ov);
      const fixedShortPrimary = await runFixedMode(pngBuf, imgW, imgH, benchSlotCenters(), "short-primary", ov);
      const auto = await runAutoMode(pngBuf, imgW, imgH, ov);

      variants.push({
        occupancyVariant: ov.name,
        fixedWidePrimary,
        fixedWideAlt,
        fixedShortPrimary,
        auto,
        error: null,
      });

      counts.push(fixedWidePrimary.occupiedCount);
      counts.push(fixedWideAlt.occupiedCount);
      counts.push(fixedShortPrimary.occupiedCount);
      counts.push(auto.occupiedCount);
    } catch (e) {
      variants.push({
        occupancyVariant: ov.name,
        fixedWidePrimary: { variantName: ov.name, coordSet: "wide-primary", stdThreshold: 0, brightMinRatio: 0, slots: [], occupiedCount: 0, occupiedIndices: [] },
        fixedWideAlt: { variantName: ov.name, coordSet: "wide-alt", stdThreshold: 0, brightMinRatio: 0, slots: [], occupiedCount: 0, occupiedIndices: [] },
        fixedShortPrimary: { variantName: ov.name, coordSet: "short-primary", stdThreshold: 0, brightMinRatio: 0, slots: [], occupiedCount: 0, occupiedIndices: [] },
        auto: { variantName: ov.name, clusters: [], occupiedCount: 0 },
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Majority vote.
  const countFreq = new Map<number, number>();
  for (const c of counts) countFreq.set(c, (countFreq.get(c) ?? 0) + 1);
  let bestOccupiedCount: number | null = null;
  let bestFreq = 0;
  for (const [c, f] of countFreq) {
    if (f > bestFreq || (f === bestFreq && (bestOccupiedCount === null || c > bestOccupiedCount))) {
      bestFreq = f;
      bestOccupiedCount = c;
    }
  }
  const bestVariant = variants.find((v) => v.auto.occupiedCount === bestOccupiedCount && v.error === null)?.occupancyVariant ?? variants[0]?.occupancyVariant ?? null;

  return {
    ok: true,
    tesseractAvailable,
    imageWidth: imgW,
    imageHeight: imgH,
    variants,
    bestOccupiedCount,
    bestVariant,
    error: null,
  };
}
