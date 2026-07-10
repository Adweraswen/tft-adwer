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
// REVISED (2026-07-10 user feedback v2): koordinatlar yanlıştı — ilk slot atlanıyor,
// 2. slot 1. sanılıyordu, son slot 2 parçaya bölünüyordu. Birden fazla koordinat
// seti ekledik (farklı ilk-merkez + genişlik). Kullanıcı hangisinin çalıştığını söyler.
//
// NOT: auto-detect modu koordinat bağımsız — sabit koordinatlar yanlış olsa bile
// yeşil/std kümelerini sayar. Gerçek TFT'de auto'yu kullan.
// Y aralığı: kullanıcı ~105px dikey uzunluk ölçtü. Bench y≈770-875 (105px).
// Eski: y=720-845 (125px, çok geniş). Yeni: y=770-875 (105px, kullanıcı ölçümü).
// Wide variant: y=750-875 (125px, biraz daha geniş — gölge yakala).
const BENCH_Y_TOP = 770;          // kullanıcı ölçümü (105px)
const BENCH_Y_BOTTOM = 875;
const BENCH_Y_TOP_SHORT = 780;    // kısa variant (95px, sadece portre)

// Koordinat seti varyantları: (isim, ilkSlotMerkez, slotGenişlik)
interface BenchCoordSet {
  name: string;
  firstCenter: number;
  slotWidth: number;
}

const BENCH_COORD_SETS: BenchCoordSet[] = [
  // Set E: KULLANICI ÖLÇÜMÜ (2026-07-10) — ilk slot x=371-486, 115px genişlik, y~105px.
  // firstCenter = 371 + 115/2 = 428.5 → 429. En güvenilir set.
  { name: "E-429-115", firstCenter: 429, slotWidth: 115 },
  // Set A: eski tahmin (535, 110)
  { name: "A-535-110", firstCenter: 535, slotWidth: 110 },
  // Set B: biraz sola kaydır (515, 110)
  { name: "B-515-110", firstCenter: 515, slotWidth: 110 },
  // Set C: daha dar slotlar (100px)
  { name: "C-525-100", firstCenter: 525, slotWidth: 100 },
  // Set D: TFT-OCR-BOT'a göre (490, 110)
  { name: "D-490-110", firstCenter: 490, slotWidth: 110 },
];

function benchSlotCenters(coordSet: BenchCoordSet = BENCH_COORD_SETS[0]): number[] {
  return Array.from({ length: 9 }, (_, i) => coordSet.firstCenter + i * coordSet.slotWidth);
}

function benchSlotBbox(centerX: number, yTop: number, slotWidth: number): [number, number, number, number] {
  const half = Math.floor(slotWidth / 2);
  return [centerX - half, yTop, centerX + half, BENCH_Y_BOTTOM];
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
  /** Koordinat seti adı (A-535-110, B-515-110, vb.) + y-range (wide/short). */
  coordSet: string;
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
  /** Her koordinat seti için ayrı fixed result (4 set × 2 y-range = 8). */
  fixed: BenchFixedResult[];
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

// ─── Fixed-slot mode (optimized) ──────────────────────────────────────────
// PERFORMANCE: slot stats (lumStats + cropB64) bir kere hesaplanır,
// 4 occupancy variant aynı stats'ı paylaşır. Önceki: 576 sharp extract,
// şimdi: 72 extract (8 combo × 9 slot).

interface SlotCache {
  index: number;
  bbox: [number, number, number, number];
  stdDev: number;
  brightRatio: number;
  meanLum: number;
  cropB64: string;
}

async function computeSlotCache(
  pngBuf: Buffer,
  imgW: number,
  imgH: number,
  coordSet: BenchCoordSet,
  yTop: number
): Promise<SlotCache[]> {
  const centers = benchSlotCenters(coordSet);
  const caches: SlotCache[] = [];
  for (let i = 0; i < 9; i++) {
    const bbox1080 = benchSlotBbox(centers[i], yTop, coordSet.slotWidth);
    const region = scaleBbox(bbox1080, imgW, imgH);
    const stats = await computeLumStats(pngBuf, region);
    const cropPng = await cropRegion(pngBuf, region);
    caches.push({
      index: i,
      bbox: bbox1080,
      stdDev: stats.std,
      brightRatio: stats.brightRatio,
      meanLum: stats.mean,
      cropB64: `data:image/png;base64,${cropPng.toString("base64")}`,
    });
  }
  return caches;
}

function buildFixedResult(
  cache: SlotCache[],
  coordSet: BenchCoordSet,
  yLabel: string,
  variant: OccupancyVariant
): BenchFixedResult {
  const slots: BenchSlotResult[] = [];
  const occupiedIndices: number[] = [];
  for (const c of cache) {
    const occupied = c.stdDev >= variant.stdThreshold && c.brightRatio >= variant.brightMinRatio;
    slots.push({
      index: c.index,
      bbox: c.bbox,
      occupied,
      stdDev: c.stdDev,
      brightRatio: c.brightRatio,
      meanLum: c.meanLum,
      cropB64: c.cropB64,
    });
    if (occupied) occupiedIndices.push(c.index);
  }
  return {
    variantName: variant.name,
    coordSet: `${coordSet.name}/${yLabel}`,
    stdThreshold: variant.stdThreshold,
    brightMinRatio: variant.brightMinRatio,
    slots,
    occupiedCount: occupiedIndices.length,
    occupiedIndices,
  };
}

// ─── Auto-detect mode (optimized) ─────────────────────────────────────────
// PERFORMANCE: band bir kere extract edilir, colStd bir kere hesaplanır,
// 4 variant aynı colStd'yi paylaşır. Önceki: 4× band extract, şimdi: 1×.

interface AutoBandCache {
  bandLeft: number;
  bandWidth: number;
  colStd: Float64Array;
}

async function computeAutoBandCache(
  pngBuf: Buffer,
  imgW: number,
  imgH: number
): Promise<AutoBandCache> {
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
  return { bandLeft, bandWidth, colStd };
}

function buildAutoResult(
  cache: AutoBandCache,
  imgW: number,
  variant: OccupancyVariant
): BenchAutoResult {
  const { bandLeft, bandWidth, colStd } = cache;
  const MIN_WIDTH = 8;
  const scaleX = imgW / 1920;
  const slotWidthImg = BENCH_COORD_SETS[0].slotWidth * scaleX;
  // Cluster birleştirme: iki cluster arası boşluk slot genişliğinin yarısından azsa birleştir.
  const MERGE_GAP = Math.floor(slotWidthImg * 0.4); // ~46px @ 1920
  // Çok küçük kümeleri filtrele (noise).
  const NOISE_WIDTH = 15;

  // 1. Ham kümeleri topla
  const rawClusters: { start: number; end: number; stdSum: number }[] = [];
  let clusterStart = -1;
  let clusterStdSum = 0;
  for (let x = 0; x <= bandWidth; x++) {
    const hasContent = x < bandWidth && colStd[x] > variant.stdThreshold * 0.7;
    if (hasContent && clusterStart === -1) {
      clusterStart = x;
      clusterStdSum = colStd[x];
    } else if (hasContent) {
      clusterStdSum += colStd[x];
    } else if (clusterStart !== -1) {
      rawClusters.push({ start: clusterStart, end: x, stdSum: clusterStdSum });
      clusterStart = -1;
      clusterStdSum = 0;
    }
  }

  // 2. Yakın kümeleri birleştir (gap < MERGE_GAP)
  const merged: { start: number; end: number; stdSum: number }[] = [];
  for (const rc of rawClusters) {
    const last = merged[merged.length - 1];
    if (last && rc.start - last.end < MERGE_GAP) {
      // Birleştir
      last.end = rc.end;
      last.stdSum += rc.stdSum;
    } else {
      merged.push({ ...rc });
    }
  }

  // 3. Çok küçük kümeleri filtrele + slot map
  const centers1080 = benchSlotCenters(BENCH_COORD_SETS[0]);
  const clusters: BenchAutoCluster[] = [];
  for (const mc of merged) {
    const width = mc.end - mc.start;
    if (width < NOISE_WIDTH) continue;
    const centerXImg = bandLeft + mc.start + Math.floor(width / 2);
    let nearest: number | null = null;
    let nearestDist = Infinity;
    for (let s = 0; s < 9; s++) {
      const slotCenterImg = centers1080[s] * scaleX;
      const dist = Math.abs(centerXImg - slotCenterImg);
      if (dist < nearestDist && dist < slotWidthImg / 2) {
        nearestDist = dist;
        nearest = s;
      }
    }
    clusters.push({
      centerX: centerXImg,
      width,
      avgStd: mc.stdSum / width,
      mappedSlotIndex: nearest,
    });
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

  // ── CACHE: slot stats bir kere hesapla, 4 variant paylaş ──
  // 8 combo (4 coordSet × 2 y-range) × 9 slot = 72 sharp extract (önceki: 576).
  const slotCaches: { yLabel: string; coordSet: BenchCoordSet; cache: SlotCache[] }[] = [];
  for (const cs of BENCH_COORD_SETS) {
    slotCaches.push({ yLabel: "wide", coordSet: cs, cache: await computeSlotCache(pngBuf, imgW, imgH, cs, BENCH_Y_TOP) });
    slotCaches.push({ yLabel: "short", coordSet: cs, cache: await computeSlotCache(pngBuf, imgW, imgH, cs, BENCH_Y_TOP_SHORT) });
  }
  // Auto band cache: bir kere extract et, 4 variant paylaş.
  const autoBandCache = await computeAutoBandCache(pngBuf, imgW, imgH);

  const variants: BenchVariantResult[] = [];
  const counts: number[] = [];

  for (const ov of OCCUPANCY_VARIANTS) {
    try {
      // 8 fixed result — cache'den build et (sadece threshold karşılaştırması).
      const fixed: BenchFixedResult[] = slotCaches.map((sc) =>
        buildFixedResult(sc.cache, sc.coordSet, sc.yLabel, ov)
      );
      const auto = buildAutoResult(autoBandCache, imgW, ov);

      variants.push({
        occupancyVariant: ov.name,
        fixed,
        auto,
        error: null,
      });

      for (const f of fixed) counts.push(f.occupiedCount);
      counts.push(auto.occupiedCount);
    } catch (e) {
      variants.push({
        occupancyVariant: ov.name,
        fixed: [],
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
