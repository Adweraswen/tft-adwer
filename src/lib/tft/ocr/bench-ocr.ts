/**
 * Bench OCR engine — PLAN.md 15.5 step 4 (Bench, easy).
 *
 * TFT bench = 9 slots directly above the shop. Each occupied slot shows a
 * green HP bar (~ [0, 255, 18]). Empty slots show no green. So "bench read"
 * = count green slots = how many units are on the bench.
 *
 * This is the FIRST pure-CV step (no OCR, no Tesseract). It's the gateway
 * to the CV path: color detection → cluster counting → slot mapping.
 *
 * Two modes (both run, both reported):
 *   1. FIXED: 9 hard-coded slot bboxes (1920x1080 reference). For each slot,
 *      count green pixels; if count > threshold → slot is occupied.
 *   2. AUTO: scan the entire bench band, find green pixel clusters, group
 *      them by x-coordinate. Each cluster = one occupied slot. This is
 *      coordinate-independent — robust against resolution / layout shifts.
 *
 * Multi-variant sweep (PLAN 15.7): tries several green-threshold combos.
 */

import sharp from "sharp";
import {
  isTesseractAvailable,
  scaleBbox,
  cropRegion,
} from "./engine";

// ─── Bench slot coordinates (1920x1080 reference) ──────────────────────────
// TFT-OCR-BOT says bench is at y=777, 9 slots. Shop is at y=1039-1070.
// Bench slot HP bar is ~10px tall, centered horizontally in each slot.
// Slot width ≈ 110px (996px total / 9 slots). First slot center x ≈ 535.
//
// These are educated estimates — the user will verify via the tester which
// coordinate set works on their real TFT screenshot. Auto-detect mode is
// the fallback if fixed coords are wrong.

const BENCH_Y_TOP = 770;
const BENCH_Y_BOTTOM = 845;
const BENCH_SLOT_WIDTH = 110;
const BENCH_FIRST_SLOT_CENTER = 535;

function benchSlotCenters(): number[] {
  return Array.from({ length: 9 }, (_, i) => BENCH_FIRST_SLOT_CENTER + i * BENCH_SLOT_WIDTH);
}

function benchSlotBbox(centerX: number): [number, number, number, number] {
  const half = Math.floor(BENCH_SLOT_WIDTH / 2);
  return [centerX - half, BENCH_Y_TOP, centerX + half, BENCH_Y_BOTTOM];
}

// Alternative coordinate set (shifted +8px right, in case the bench is offset).
function benchSlotCentersAlt(): number[] {
  return benchSlotCenters().map((x) => x + 8);
}

// ─── Green detection variants ─────────────────────────────────────────────
export interface GreenVariant {
  name: string;
  /** Green pixel test: G >= gMin AND R <= rMax AND B <= bMax */
  gMin: number;
  rMax: number;
  bMax: number;
}

export const GREEN_VARIANTS: GreenVariant[] = [
  { name: "strict/255-0-18", gMin: 200, rMax: 80, bMax: 80 },   // near-pure green
  { name: "mid/180-100-100", gMin: 180, rMax: 100, bMax: 100 }, // typical TFT green
  { name: "loose/150-130-130", gMin: 150, rMax: 130, bMax: 130 }, // faded green
  { name: "very-loose/120-150-150", gMin: 120, rMax: 150, bMax: 150 }, // very faded
];

// ─── Result types ─────────────────────────────────────────────────────────
export interface BenchSlotResult {
  index: number; // 0-8
  bbox: [number, number, number, number];
  occupied: boolean;
  greenPixelCount: number;
  greenRatio: number; // greenPixelCount / totalPixels
  cropB64: string;
}

export interface BenchFixedResult {
  variantName: string;
  coordSet: "primary" | "alt";
  threshold: number; // green pixel count to consider "occupied"
  slots: BenchSlotResult[];
  occupiedCount: number;
  occupiedIndices: number[];
}

export interface BenchAutoCluster {
  /** Center x of the cluster (in actual image coordinates). */
  centerX: number;
  /** Width of the cluster in pixels. */
  width: number;
  /** Total green pixels in the cluster. */
  greenCount: number;
  /** Nearest fixed slot index (0-8) this cluster maps to, or null. */
  mappedSlotIndex: number | null;
}

export interface BenchAutoResult {
  variantName: string;
  clusters: BenchAutoCluster[];
  occupiedCount: number;
}

export interface BenchVariantResult {
  greenVariant: string;
  fixedPrimary: BenchFixedResult;
  fixedAlt: BenchFixedResult;
  auto: BenchAutoResult;
  error: string | null;
}

export interface BenchOcrResult {
  ok: boolean;
  tesseractAvailable: boolean; // always true-ish (bench doesn't use tesseract, but reported for UI parity)
  imageWidth: number;
  imageHeight: number;
  variants: BenchVariantResult[];
  /** Best occupied count (majority vote across all variants + modes). */
  bestOccupiedCount: number | null;
  bestVariant: string | null;
  error: string | null;
}

// ─── Green pixel counting ─────────────────────────────────────────────────

async function countGreenInRegion(
  pngBuf: Buffer,
  region: { left: number; top: number; width: number; height: number },
  variant: GreenVariant
): Promise<{ count: number; ratio: number; total: number }> {
  const raw = await sharp(pngBuf)
    .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  let count = 0;
  const total = raw.length / channels;
  for (let i = 0; i < raw.length; i += channels) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    if (g >= variant.gMin && r <= variant.rMax && b <= variant.bMax) {
      count++;
    }
  }
  return { count, ratio: total > 0 ? count / total : 0, total };
}

// ─── Fixed-slot mode ──────────────────────────────────────────────────────

async function runFixedMode(
  pngBuf: Buffer,
  imgW: number,
  imgH: number,
  centers: number[],
  coordSet: "primary" | "alt",
  variant: GreenVariant,
  occupiedThreshold: number
): Promise<BenchFixedResult> {
  const slots: BenchSlotResult[] = [];
  const occupiedIndices: number[] = [];

  for (let i = 0; i < 9; i++) {
    const bbox1080 = benchSlotBbox(centers[i]);
    const region = scaleBbox(bbox1080, imgW, imgH);
    const { count, ratio } = await countGreenInRegion(pngBuf, region, variant);
    const occupied = count >= occupiedThreshold;

    // Save a small crop for the UI (showing the slot).
    const cropPng = await cropRegion(pngBuf, region);
    slots.push({
      index: i,
      bbox: bbox1080,
      occupied,
      greenPixelCount: count,
      greenRatio: ratio,
      cropB64: `data:image/png;base64,${cropPng.toString("base64")}`,
    });
    if (occupied) occupiedIndices.push(i);
  }

  return {
    variantName: variant.name,
    coordSet,
    threshold: occupiedThreshold,
    slots,
    occupiedCount: occupiedIndices.length,
    occupiedIndices,
  };
}

// ─── Auto-detect mode (coordinate-independent) ────────────────────────────
// Scan the entire bench band. For each column x, count green pixels in that
// column (vertical strip). Group adjacent columns with green count > 0 into
// clusters. Each cluster = one occupied slot.

async function runAutoMode(
  pngBuf: Buffer,
  imgW: number,
  imgH: number,
  variant: GreenVariant
): Promise<BenchAutoResult> {
  // Bench band: scale y=770..845 to actual image height.
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
  // Column histogram: green pixel count per column.
  const colGreen = new Array(bandWidth).fill(0) as number[];
  for (let x = 0; x < bandWidth; x++) {
    for (let y = 0; y < bandHeight; y++) {
      const i = (y * bandWidth + x) * channels;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      if (g >= variant.gMin && r <= variant.rMax && b <= variant.bMax) {
        colGreen[x]++;
      }
    }
  }

  // Group adjacent columns with green count > 0 into clusters.
  // Minimum cluster width = 4px (filters out single-pixel noise).
  const MIN_WIDTH = 4;
  const clusters: BenchAutoCluster[] = [];
  let clusterStart = -1;
  let clusterGreenSum = 0;
  for (let x = 0; x <= bandWidth; x++) {
    const hasGreen = x < bandWidth && colGreen[x] > 0;
    if (hasGreen && clusterStart === -1) {
      clusterStart = x;
      clusterGreenSum = colGreen[x];
    } else if (hasGreen) {
      clusterGreenSum += colGreen[x];
    } else if (clusterStart !== -1) {
      const width = x - clusterStart;
      if (width >= MIN_WIDTH) {
        const centerXImg = bandLeft + clusterStart + Math.floor(width / 2);
        // Map to nearest fixed slot (1080p reference).
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
          greenCount: clusterGreenSum,
          mappedSlotIndex: nearest,
        });
      }
      clusterStart = -1;
      clusterGreenSum = 0;
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
      error: "Image has no dimensions (corrupt or unsupported format).",
    };
  }

  const pngBuf = await sharp(fullImage).png().toBuffer();

  // Occupied threshold: a slot needs at least this many green pixels to count
  // as occupied. Scales with image resolution (slot area shrinks at lower res).
  const slotArea1080 = BENCH_SLOT_WIDTH * (BENCH_Y_BOTTOM - BENCH_Y_TOP); // ~8250 px²
  const slotAreaImg = slotArea1080 * (imgW / 1920) * (imgH / 1080);
  const occupiedThreshold = Math.max(20, Math.floor(slotAreaImg * 0.02)); // 2% of slot area

  const variants: BenchVariantResult[] = [];
  const counts: number[] = [];

  for (const gv of GREEN_VARIANTS) {
    try {
      const fixedPrimary = await runFixedMode(
        pngBuf, imgW, imgH, benchSlotCenters(), "primary", gv, occupiedThreshold
      );
      const fixedAlt = await runFixedMode(
        pngBuf, imgW, imgH, benchSlotCentersAlt(), "alt", gv, occupiedThreshold
      );
      const auto = await runAutoMode(pngBuf, imgW, imgH, gv);

      variants.push({
        greenVariant: gv.name,
        fixedPrimary,
        fixedAlt,
        auto,
        error: null,
      });

      // Collect counts for majority vote (prefer auto if it agrees with a fixed).
      counts.push(fixedPrimary.occupiedCount);
      counts.push(fixedAlt.occupiedCount);
      counts.push(auto.occupiedCount);
    } catch (e) {
      variants.push({
        greenVariant: gv.name,
        fixedPrimary: { variantName: gv.name, coordSet: "primary", threshold: 0, slots: [], occupiedCount: 0, occupiedIndices: [] },
        fixedAlt: { variantName: gv.name, coordSet: "alt", threshold: 0, slots: [], occupiedCount: 0, occupiedIndices: [] },
        auto: { variantName: gv.name, clusters: [], occupiedCount: 0 },
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Majority vote: the count that appears most often across all modes/variants.
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
  // Best variant = first variant whose auto count matches the majority.
  const bestVariant = variants.find(
    (v) => v.auto.occupiedCount === bestOccupiedCount && v.error === null
  )?.greenVariant ?? variants[0]?.greenVariant ?? null;

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
