/**
 * Bench OCR engine — std-dev yöntemi (gerçek TFT verisi ile doğrulandı).
 *
 * GERÇEK TFT ANALİZİ (kullanıcı screenshot'ı, 2026-07-10):
 *   - [0,255,18] yeşil YOK (TFT-OCR-BOT'un rengi eski patch, artık geçerli değil)
 *   - std-dev ÇALIŞIYOR: dolu slot std=57-66, boş slot std=34-41, eşik 48
 *   - TFT-OCR-BOT koordinatları: y=650-757, firstCenter=420, width=103
 *
 * Yöntem: her slot için luminance std-dev hesapla, threshold'dan büyükse dolu.
 * Dolu slot = şampiyon portresi (yüksek renk çeşitliliği).
 * Boş slot = monoton arka plan (düşük std-dev).
 */

import sharp from "sharp";
import {
  isTesseractAvailable,
  scaleBbox,
  cropRegion,
} from "./engine";

// ─── Bench slot coordinates (TFT-OCR-BOT production) ──────────────────────
const BENCH_Y_TOP = 650;
const BENCH_Y_BOTTOM = 757;

interface BenchCoordSet {
  name: string;
  firstCenter: number;
  slotWidth: number;
}

const BENCH_COORD_SETS: BenchCoordSet[] = [
  // KULLANICI ÖLÇÜMÜ — gerçek TFT'de en doğru sonuç (5/9 screenshot 33)
  { name: "user-429-115", firstCenter: 429, slotWidth: 115 },
];

function benchSlotCenters(coordSet: BenchCoordSet = BENCH_COORD_SETS[0]): number[] {
  return Array.from({ length: 9 }, (_, i) => coordSet.firstCenter + i * coordSet.slotWidth);
}

function benchSlotBbox(centerX: number, yTop: number, slotWidth: number): [number, number, number, number] {
  const half = Math.floor(slotWidth / 2);
  return [centerX - half, yTop, centerX + half, BENCH_Y_BOTTOM];
}

// ─── Occupancy variants (std-dev + edge density) ──────────────────────────
// GERÇEK TFT VERİSİ: edge≥0.03 AND std≥25 = sc32(7), sc33(5) doğru
export interface OccupancyVariant {
  name: string;
  stdThreshold: number;
  edgeThreshold: number;
}

export const OCCUPANCY_VARIANTS: OccupancyVariant[] = [
  { name: "edge03-std25", stdThreshold: 25, edgeThreshold: 0.03 },  // sc33=5, sc34=4 doğru
  { name: "edge02-std20", stdThreshold: 20, edgeThreshold: 0.02 },  // daha gevşek
  { name: "edge04-std28", stdThreshold: 28, edgeThreshold: 0.04 },  // daha sıkı
  { name: "edge025-std22", stdThreshold: 22, edgeThreshold: 0.025 },  // orta
];

// ─── Result types ─────────────────────────────────────────────────────────
export interface BenchSlotResult {
  index: number;
  bbox: [number, number, number, number];
  occupied: boolean;
  stdDev: number;
  cropB64: string;
}

export interface BenchFixedResult {
  variantName: string;
  coordSet: string;
  stdThreshold: number;
  slots: BenchSlotResult[];
  occupiedCount: number;
  occupiedIndices: number[];
}

export interface BenchAutoCluster {
  centerX: number;
  width: number;
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

// ─── Slot stats: std-dev + edge density ───────────────────────────────────
// GERÇEK TFT VERİSİ (sc32=7, sc33=5 doğru):
//   edge≥0.03 AND std_lum≥25 = en iyi kombinasyon
//   Dolu slot: edge yüksek (portre detayı), std_lum yüksek (renk çeşitliliği)
//   Boş slot: edge düşük (monoton mor), std_lum düşük
interface SlotStats {
  stdDev: number;
  edgeDensity: number;
}

async function computeSlotStats(pngBuf: Buffer, region: { left: number; top: number; width: number; height: number }): Promise<SlotStats> {
  // Kuyruk bölgesini (alt %20) atla — board karakterinin kuyruğu bench'e değmesin
  const adjustedRegion = {
    left: region.left,
    top: region.top,
    width: region.width,
    height: Math.floor(region.height * 0.8),  // alt %20'yi atla
  };
  const raw = await sharp(pngBuf)
    .extract({ left: adjustedRegion.left, top: adjustedRegion.top, width: adjustedRegion.width, height: adjustedRegion.height })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  const W = adjustedRegion.width;
  const H = adjustedRegion.height;
  const total = raw.length / channels;
  const lums = new Float64Array(total);
  let sum = 0;
  for (let i = 0, p = 0; i < raw.length; i += channels, p++) {
    const lum = 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];
    lums[p] = lum;
    sum += lum;
  }
  const mean = sum / total;
  let varSum = 0;
  for (let p = 0; p < total; p++) {
    const d = lums[p] - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / total);

  // Edge density: yatay + dikey gradient, threshold > 30
  let edgeCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const lum1 = lums[y * W + x];
      const lum2 = lums[y * W + x + 1];
      if (Math.abs(lum1 - lum2) > 30) edgeCount++;
    }
  }
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      const lum1 = lums[y * W + x];
      const lum2 = lums[(y + 1) * W + x];
      if (Math.abs(lum1 - lum2) > 30) edgeCount++;
    }
  }
  const edgeDensity = edgeCount / total;
  return { stdDev: std, edgeDensity };
}

// ─── Slot cache (optimized) ──────────────────────────────────────────────
interface SlotCache {
  index: number;
  bbox: [number, number, number, number];
  stdDev: number;
  edgeDensity: number;
  cropB64: string;
}

async function computeSlotCache(
  pngBuf: Buffer,
  imgW: number,
  imgH: number,
  coordSet: BenchCoordSet
): Promise<SlotCache[]> {
  const centers = benchSlotCenters(coordSet);
  const caches: SlotCache[] = [];
  for (let i = 0; i < 9; i++) {
    const bbox1080 = benchSlotBbox(centers[i], BENCH_Y_TOP, coordSet.slotWidth);
    const region = scaleBbox(bbox1080, imgW, imgH);
    const stats = await computeSlotStats(pngBuf, region);
    const cropPng = await cropRegion(pngBuf, region);
    caches.push({
      index: i,
      bbox: bbox1080,
      stdDev: stats.stdDev,
      edgeDensity: stats.edgeDensity,
      cropB64: `data:image/png;base64,${cropPng.toString("base64")}`,
    });
  }
  return caches;
}

function buildFixedResult(
  cache: SlotCache[],
  coordSet: BenchCoordSet,
  variant: OccupancyVariant
): BenchFixedResult {
  const slots: BenchSlotResult[] = [];
  const occupiedIndices: number[] = [];
  for (const c of cache) {
    // Occupied: edge density yüksek AND std-dev yeterli
    const occupied = c.edgeDensity >= variant.edgeThreshold && c.stdDev >= variant.stdThreshold;
    slots.push({
      index: c.index,
      bbox: c.bbox,
      occupied,
      stdDev: c.stdDev,
      cropB64: c.cropB64,
    });
    if (occupied) occupiedIndices.push(c.index);
  }
  return {
    variantName: variant.name,
    coordSet: coordSet.name,
    stdThreshold: variant.stdThreshold,
    slots,
    occupiedCount: occupiedIndices.length,
    occupiedIndices,
  };
}

// ─── Auto-detect mode ────────────────────────────────────────────────────
// Bench band'ı tara, yüksek std-dev sütunlarını kümele.
interface AutoBandCache {
  bandLeft: number;
  bandWidth: number;
  colStd: Float64Array;
}

async function computeAutoBandCache(pngBuf: Buffer, imgW: number, imgH: number): Promise<AutoBandCache> {
  const bandTop = Math.round(BENCH_Y_TOP * (imgH / 1080));
  const bandHeight = Math.max(1, Math.round((BENCH_Y_BOTTOM - BENCH_Y_TOP) * (imgH / 1080)));
  const bandLeft = Math.round(360 * (imgW / 1920));
  const bandWidth = Math.max(1, Math.round(1100 * (imgW / 1920)));

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

function buildAutoResult(cache: AutoBandCache, imgW: number, variant: OccupancyVariant): BenchAutoResult {
  const { bandLeft, bandWidth, colStd } = cache;
  const scaleX = imgW / 1920;
  const slotWidthImg = BENCH_COORD_SETS[0].slotWidth * scaleX;
  const MERGE_GAP = 20;
  const NOISE_WIDTH = 15;
  const MAX_CLUSTER_WIDTH = Math.floor(slotWidthImg * 1.5);
  const COL_THRESHOLD = variant.stdThreshold * 0.5;  // sütun threshold'u slot threshold'un yarısı

  const rawClusters: { start: number; end: number; stdSum: number }[] = [];
  let clusterStart = -1;
  let clusterStdSum = 0;
  for (let x = 0; x <= bandWidth; x++) {
    const hasContent = x < bandWidth && colStd[x] >= COL_THRESHOLD;
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

  const merged: { start: number; end: number; stdSum: number }[] = [];
  for (const rc of rawClusters) {
    const last = merged[merged.length - 1];
    if (last && rc.start - last.end < MERGE_GAP) {
      last.end = rc.end;
      last.stdSum += rc.stdSum;
    } else {
      merged.push({ ...rc });
    }
  }

  const split: { start: number; end: number; stdSum: number }[] = [];
  for (const mc of merged) {
    const width = mc.end - mc.start;
    if (width > MAX_CLUSTER_WIDTH) {
      const mid = Math.floor((mc.start + mc.end) / 2);
      split.push({ start: mc.start, end: mid, stdSum: mc.stdSum / 2 });
      split.push({ start: mid, end: mc.end, stdSum: mc.stdSum / 2 });
    } else {
      split.push(mc);
    }
  }

  const centers1080 = benchSlotCenters(BENCH_COORD_SETS[0]);
  const clusters: BenchAutoCluster[] = [];
  for (const mc of split) {
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
  return { variantName: variant.name, clusters, occupiedCount: clusters.length };
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function runBenchOcrSweep(fullImage: Buffer): Promise<BenchOcrResult> {
  const tesseractAvailable = await isTesseractAvailable();
  const meta = await sharp(fullImage).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (!imgW || !imgH) {
    return { ok: false, tesseractAvailable, imageWidth: 0, imageHeight: 0, variants: [], bestOccupiedCount: null, bestVariant: null, error: "Image has no dimensions." };
  }

  const pngBuf = await sharp(fullImage).png().toBuffer();

  // Cache: her coordSet için 9 slot stats bir kere hesapla
  const slotCaches: { coordSet: BenchCoordSet; cache: SlotCache[] }[] = [];
  for (const cs of BENCH_COORD_SETS) {
    slotCaches.push({ coordSet: cs, cache: await computeSlotCache(pngBuf, imgW, imgH, cs) });
  }
  const autoBandCache = await computeAutoBandCache(pngBuf, imgW, imgH);

  const variants: BenchVariantResult[] = [];
  const counts: number[] = [];

  for (const ov of OCCUPANCY_VARIANTS) {
    try {
      const fixed: BenchFixedResult[] = slotCaches.map((sc) => buildFixedResult(sc.cache, sc.coordSet, ov));
      const auto = buildAutoResult(autoBandCache, imgW, ov);
      variants.push({ occupancyVariant: ov.name, fixed, auto, error: null });
      for (const f of fixed) counts.push(f.occupiedCount);
      counts.push(auto.occupiedCount);
    } catch (e) {
      variants.push({ occupancyVariant: ov.name, fixed: [], auto: { variantName: ov.name, clusters: [], occupiedCount: 0 }, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Majority vote
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
  const bestVariant = variants.find((v) => v.fixed[0]?.occupiedCount === bestOccupiedCount)?.occupancyVariant ?? variants[0]?.occupancyVariant ?? null;

  return { ok: true, tesseractAvailable, imageWidth: imgW, imageHeight: imgH, variants, bestOccupiedCount, bestVariant, error: null };
}
