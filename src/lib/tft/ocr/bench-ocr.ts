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
// YÖNTEM: tam RGB yeşil [0,255,18] health bar tespiti (TFT-OCR-BOT).
// Health bar konumu TAM BİLİNMİYOR — kullanıcı "kafalarının üstünde" dedi ama
// tam y ölçmedi. Bu yüzden 4 farklı y bandı taranır, en yüksek yeşil olanı kullanılır.
//
// TFT-OCR-BOT production kodu (arena_functions.py, bench_occupied_check):
//   is_health_color = np.all(screenshot == [0, 255, 18], axis=-1)
//   occupied = any(np.convolve(is_health_color, np.ones(5), mode='valid'))
const BENCH_Y_TOP = 700;          // slot başı (geniş aralık)
const BENCH_Y_BOTTOM = 880;       // slot sonu
const BENCH_Y_TOP_SHORT = 760;    // kısa variant

// 4 farklı health bar adayı y bandı — hangisinde yeşil varsa onu kullan.
// Kullanıcı gerçek TFT'de tam konumu ölçene kadar hepsi taranır.
const HEALTH_BAR_CANDIDATES: { name: string; yTop: number; yBottom: number }[] = [
  { name: "top", yTop: 700, yBottom: 725 },      // slotun en üstü
  { name: "upper", yTop: 735, yBottom: 760 },    // üst-orta
  { name: "middle", yTop: 760, yBottom: 785 },   // orta (kafa üstü tahmini)
  { name: "lower", yTop: 790, yBottom: 815 },    // orta-alt
];

// Koordinat seti varyantları: (isim, ilkSlotMerkez, slotGenişlik)
interface BenchCoordSet {
  name: string;
  firstCenter: number;
  slotWidth: number;
}

const BENCH_COORD_SETS: BenchCoordSet[] = [
  // Set E2: KULLANICI ÖLÇÜMÜ v2 (2026-07-10) — 6-9. slot kayması için width 115→118.
  { name: "E2-429-118", firstCenter: 429, slotWidth: 118 },
  // Set E1: orijinal kullanıcı ölçümü (115px)
  { name: "E1-429-115", firstCenter: 429, slotWidth: 115 },
  // Set A-F: eski tahminler (fallback)
  { name: "A-535-110", firstCenter: 535, slotWidth: 110 },
  { name: "B-515-110", firstCenter: 515, slotWidth: 110 },
  { name: "C-525-100", firstCenter: 525, slotWidth: 100 },
  { name: "D-490-110", firstCenter: 490, slotWidth: 110 },
];

function benchSlotCenters(coordSet: BenchCoordSet = BENCH_COORD_SETS[0]): number[] {
  return Array.from({ length: 9 }, (_, i) => coordSet.firstCenter + i * coordSet.slotWidth);
}

// Slot bbox (tüm slot, crop için)
function benchSlotBbox(centerX: number, yTop: number, slotWidth: number): [number, number, number, number] {
  const half = Math.floor(slotWidth / 2);
  return [centerX - half, yTop, centerX + half, BENCH_Y_BOTTOM];
}

// Health bar sub-region bbox (yeşil tespiti için, aday y bandı)
function healthBarBbox(centerX: number, slotWidth: number, candidate: { yTop: number; yBottom: number }): [number, number, number, number] {
  const half = Math.floor(slotWidth / 2);
  return [centerX - half, candidate.yTop, centerX + half, candidate.yBottom];
}

// ─── Occupancy detection variants (health bar yeşil) ──────────────────────
// TFT-OCR-BOT yöntemi: tam RGB match [0,255,18] + convolve(window).
// Variant'lar convolve window + min contiguous yeşil piksel sayısı.
export interface OccupancyVariant {
  name: string;
  /** Convolve window boyutu (contiguous yeşil piksel şeridi uzunluğu). */
  convolveWindow: number;
  /** Min yeşil piksel sayısı (occupied sayılması için). */
  minGreenPixels: number;
  /** RGB tolerance: 0 = tam match [0,255,18], >0 = ±tolerans. */
  tolerance: number;
}

export const OCCUPANCY_VARIANTS: OccupancyVariant[] = [
  // Tam RGB match (en spesifik)
  { name: "exact/w5-min20", convolveWindow: 5, minGreenPixels: 20, tolerance: 0 },
  { name: "exact/w5-min10", convolveWindow: 5, minGreenPixels: 10, tolerance: 0 },
  { name: "exact/w3-min15", convolveWindow: 3, minGreenPixels: 15, tolerance: 0 },
  // Hafif toleranslı (anti-aliasing için)
  { name: "tol10/w5-min15", convolveWindow: 5, minGreenPixels: 15, tolerance: 10 },
];

// ─── Result types ─────────────────────────────────────────────────────────
export interface BenchSlotResult {
  index: number;
  bbox: [number, number, number, number];
  occupied: boolean;
  /** Yeşil piksel sayısı (health bar bölgesi). */
  greenPixelCount: number;
  /** Contiguous yeşil piksel şeridi sayısı (convolve sonrası). */
  contiguousGreen: number;
  cropB64: string;
}

export interface BenchFixedResult {
  variantName: string;
  /** Koordinat seti adı (E2-429-118, vb.) + y-range. */
  coordSet: string;
  convolveWindow: number;
  minGreenPixels: number;
  tolerance: number;
  slots: BenchSlotResult[];
  occupiedCount: number;
  occupiedIndices: number[];
}

export interface BenchAutoCluster {
  centerX: number;
  width: number;
  /** Yeşil piksel sayısı cluster'da. */
  greenCount: number;
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

// ─── Health bar yeşil tespiti (TFT-OCR-BOT yöntemi) ───────────────────────
// Tam RGB match [0,255,18] (tolerance ile) + convolve(window) contiguous kontrolü.

interface GreenStats {
  greenPixelCount: number;
  contiguousGreen: number; // en uzun contiguous yeşil şeridi
}

async function countHealthBarGreen(
  pngBuf: Buffer,
  region: { left: number; top: number; width: number; height: number },
  tolerance: number,
  convolveWindow: number
): Promise<GreenStats> {
  const raw = await sharp(pngBuf)
    .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  // Health bar yeşil: [0, 255, 18] (TFT-OCR-BOT). Tolerance ile ±.
  const TARGET_R = 0;
  const TARGET_G = 255;
  const TARGET_B = 18;

  let greenCount = 0;
  // Convolve: her piksel için, kendisi + (window-1) sağ komşusu yeşil mi kontrol et.
  // Contiguous yeşil şeridi = en uzun run.
  let maxContiguous = 0;
  let currentRun = 0;
  for (let i = 0; i < raw.length; i += channels) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    const isGreen =
      Math.abs(r - TARGET_R) <= tolerance &&
      Math.abs(g - TARGET_G) <= tolerance &&
      Math.abs(b - TARGET_B) <= tolerance;
    if (isGreen) {
      greenCount++;
      currentRun++;
      if (currentRun > maxContiguous) maxContiguous = currentRun;
    } else {
      currentRun = 0;
    }
  }
  // contiguousGreen = maxContiguous'in convolve window ile kontrolü.
  // TFT-OCR-BOT: any(convolve(is_green, ones(window)) == window) → window boyunca tam yeşil.
  // Bizim basitleştirme: maxContiguous >= window ise occupied.
  return {
    greenPixelCount: greenCount,
    contiguousGreen: maxContiguous,
  };
}

// ─── Fixed-slot mode (optimized) ──────────────────────────────────────────
// PERFORMANCE: slot green stats bir kere hesaplanır, 4 variant paylaşır.
// Her slot için: health bar sub-region extract + green count + crop (görsel için).

interface SlotCache {
  index: number;
  bbox: [number, number, number, number];
  greenPixelCount: number;  // en iyi candidate'nin tam match
  greenPixelCountTol10: number; // en iyi candidate'nin tol=10 match
  contiguousGreen: number;
  contiguousGreenTol10: number;
  /** Hangi y bandında yeşil bulundu (debug için). */
  bestCandidate: string;
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
  // PERFORMANCE: tek extract ile tüm slot raw buffer'ı al, 4 candidate y-band'ını
  // raw buffer'dan hesapla. Önceki: 4 candidate × 2 tol = 8 extract/slot.
  // Şimdi: 1 extract/slot (slot full height), candidate'leri raw'dan kes.
  for (let i = 0; i < 9; i++) {
    // Slot full bbox (tüm y aralığı, candidate'ler bunun içinde)
    const slotBbox1080 = benchSlotBbox(centers[i], yTop, coordSet.slotWidth);
    const slotRegion = scaleBbox(slotBbox1080, imgW, imgH);
    // Tek extract: tüm slot raw buffer
    const slotRaw = await sharp(pngBuf)
      .extract({ left: slotRegion.left, top: slotRegion.top, width: slotRegion.width, height: slotRegion.height })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const channels = 4;
    const slotW = slotRegion.width;
    const slotH = slotRegion.height;

    // Crop PNG (UI için)
    const cropPng = await sharp(pngBuf)
      .extract({ left: slotRegion.left, top: slotRegion.top, width: slotRegion.width, height: slotRegion.height })
      .png()
      .toBuffer();

    // 4 candidate y-band'ını raw buffer'dan hesapla
    let best = {
      greenPixelCount: 0,
      greenPixelCountTol10: 0,
      contiguousGreen: 0,
      contiguousGreenTol10: 0,
      bestCandidate: "none",
    };
    for (const cand of HEALTH_BAR_CANDIDATES) {
      // Candidate y-band'ı slot içindeki relative y'ye çevir
      const scaleY = imgH / 1080;
      const candTopRel = Math.max(0, Math.floor((cand.yTop - yTop) * scaleY));
      const candBottomRel = Math.min(slotH, Math.ceil((cand.yBottom - yTop) * scaleY));
      if (candBottomRel <= candTopRel) continue;
      // Raw buffer'dan bu y-band'ı tara
      let g0 = 0, g10 = 0, currentRun0 = 0, maxRun0 = 0, currentRun10 = 0, maxRun10 = 0;
      for (let y = candTopRel; y < candBottomRel; y++) {
        for (let x = 0; x < slotW; x++) {
          const idx = (y * slotW + x) * channels;
          const r = slotRaw[idx], g = slotRaw[idx + 1], b = slotRaw[idx + 2];
          const isExact = (r === 0 && g === 255 && b === 18);
          const isTol10 = (Math.abs(r - 0) <= 10 && Math.abs(g - 255) <= 10 && Math.abs(b - 18) <= 10);
          if (isExact) { g0++; currentRun0++; if (currentRun0 > maxRun0) maxRun0 = currentRun0; } else currentRun0 = 0;
          if (isTol10) { g10++; currentRun10++; if (currentRun10 > maxRun10) maxRun10 = currentRun10; } else currentRun10 = 0;
        }
      }
      if (g0 > best.greenPixelCount) {
        best = {
          greenPixelCount: g0,
          greenPixelCountTol10: g10,
          contiguousGreen: maxRun0,
          contiguousGreenTol10: maxRun10,
          bestCandidate: cand.name,
        };
      }
    }
    caches.push({
      index: i,
      bbox: slotBbox1080,
      ...best,
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
    // Variant'a göre doğru stats seç
    const greenCount = variant.tolerance === 0 ? c.greenPixelCount : c.greenPixelCountTol10;
    const contiguous = variant.tolerance === 0 ? c.contiguousGreen : c.contiguousGreenTol10;
    // Occupied: yeşil piksel sayısı >= minGreenPixels VE contiguous >= window
    const occupied = greenCount >= variant.minGreenPixels && contiguous >= variant.convolveWindow;
    slots.push({
      index: c.index,
      bbox: c.bbox,
      occupied,
      greenPixelCount: greenCount,
      contiguousGreen: contiguous,
      cropB64: c.cropB64,
    });
    if (occupied) occupiedIndices.push(c.index);
  }
  return {
    variantName: variant.name,
    coordSet: `${coordSet.name}/${yLabel}`,
    convolveWindow: variant.convolveWindow,
    minGreenPixels: variant.minGreenPixels,
    tolerance: variant.tolerance,
    slots,
    occupiedCount: occupiedIndices.length,
    occupiedIndices,
  };
}

// ─── Auto-detect mode (yeşil health bar, tüm slot yüksekliği) ─────────────
// TÜM slot yüksekliğini tara (y=700-880), yeşil pikselleri x ekseninde kümele.
// Health bar tam konumu bilinmediği için geniş aralık taranır.
// Her küme = 1 dolu slot. std-dev değil, tam RGB yeşil tespiti.

interface AutoBandCache {
  bandLeft: number;
  bandWidth: number;
  /** Her sütun için yeşil piksel sayısı (tolerance=0). */
  colGreen: Float64Array;
  /** Her sütun için yeşil piksel sayısı (tolerance=10). */
  colGreenTol10: Float64Array;
}

async function computeAutoBandCache(
  pngBuf: Buffer,
  imgW: number,
  imgH: number
): Promise<AutoBandCache> {
  // Tüm slot yüksekliği (y=700-880, 180px) — health bar nerede olursa olsun yakala
  const bandTop = Math.round(BENCH_Y_TOP * (imgH / 1080));
  const bandHeight = Math.max(1, Math.round((BENCH_Y_BOTTOM - BENCH_Y_TOP) * (imgH / 1080)));
  const bandLeft = Math.round(480 * (imgW / 1920));
  const bandWidth = Math.max(1, Math.round(996 * (imgW / 1920)));

  const raw = await sharp(pngBuf)
    .extract({ left: bandLeft, top: bandTop, width: bandWidth, height: bandHeight })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const channels = 4;
  const colGreen = new Float64Array(bandWidth);
  const colGreenTol10 = new Float64Array(bandWidth);
  const TARGET_R = 0, TARGET_G = 255, TARGET_B = 18;
  for (let x = 0; x < bandWidth; x++) {
    let g0 = 0, g10 = 0;
    for (let y = 0; y < bandHeight; y++) {
      const i = (y * bandWidth + x) * channels;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (r === TARGET_R && g === TARGET_G && b === TARGET_B) g0++;
      if (Math.abs(r - TARGET_R) <= 10 && Math.abs(g - TARGET_G) <= 10 && Math.abs(b - TARGET_B) <= 10) g10++;
    }
    colGreen[x] = g0;
    colGreenTol10[x] = g10;
  }
  return { bandLeft, bandWidth, colGreen, colGreenTol10 };
}

function buildAutoResult(
  cache: AutoBandCache,
  imgW: number,
  variant: OccupancyVariant
): BenchAutoResult {
  const { bandLeft, bandWidth, colGreen, colGreenTol10 } = cache;
  const colData = variant.tolerance === 0 ? colGreen : colGreenTol10;
  const scaleX = imgW / 1920;
  const slotWidthImg = BENCH_COORD_SETS[0].slotWidth * scaleX;
  const MERGE_GAP = 20;
  const NOISE_WIDTH = 15;
  const MAX_CLUSTER_WIDTH = Math.floor(slotWidthImg * 1.5);
  // Min yeşil piksel/sütun threshold (occupied sayılması için)
  const COL_THRESHOLD = 2; // sütunda en az 2 yeşil piksel

  // 1. Ham kümeleri topla
  const rawClusters: { start: number; end: number; greenSum: number }[] = [];
  let clusterStart = -1;
  let clusterGreenSum = 0;
  for (let x = 0; x <= bandWidth; x++) {
    const hasContent = x < bandWidth && colData[x] >= COL_THRESHOLD;
    if (hasContent && clusterStart === -1) {
      clusterStart = x;
      clusterGreenSum = colData[x];
    } else if (hasContent) {
      clusterGreenSum += colData[x];
    } else if (clusterStart !== -1) {
      rawClusters.push({ start: clusterStart, end: x, greenSum: clusterGreenSum });
      clusterStart = -1;
      clusterGreenSum = 0;
    }
  }

  // 2. Yakın kümeleri birleştir (gap < MERGE_GAP)
  const merged: { start: number; end: number; greenSum: number }[] = [];
  for (const rc of rawClusters) {
    const last = merged[merged.length - 1];
    if (last && rc.start - last.end < MERGE_GAP) {
      last.end = rc.end;
      last.greenSum += rc.greenSum;
    } else {
      merged.push({ ...rc });
    }
  }

  // 3. Çok büyük kümeleri böl
  const split: { start: number; end: number; greenSum: number }[] = [];
  for (const mc of merged) {
    const width = mc.end - mc.start;
    if (width > MAX_CLUSTER_WIDTH) {
      const mid = Math.floor((mc.start + mc.end) / 2);
      split.push({ start: mc.start, end: mid, greenSum: mc.greenSum / 2 });
      split.push({ start: mid, end: mc.end, greenSum: mc.greenSum / 2 });
    } else {
      split.push(mc);
    }
  }

  // 4. Küçük kümeleri filtrele + slot map
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
      greenCount: Math.round(mc.greenSum),
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
    slotCaches.push({ yLabel: "full", coordSet: cs, cache: await computeSlotCache(pngBuf, imgW, imgH, cs, BENCH_Y_TOP) });
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
