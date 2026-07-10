/**
 * GET /api/bench-ocr-sample
 *
 * Generates a synthetic 1920x1080 TFT-style screenshot with a 9-slot bench.
 * Some slots are "occupied" (show a green HP bar), others empty. Used by
 * the Bench OCR tester as a self-test — proves the green-detection pipeline
 * works without needing a real TFT screenshot.
 *
 * Query params:
 *   ?occupied=N  — how many slots are occupied (0-9, default 4)
 *   ?seed=NN     — randomize which slots are occupied + noise (default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bench geometry — must match bench-ocr.ts constants.
const BENCH_Y_TOP = 745;
const BENCH_Y_BOTTOM = 830;
const BENCH_SLOT_WIDTH = 118;
const BENCH_FIRST_SLOT_CENTER = 429;

// Green HP bar color (kept for backwards compat but no longer the primary signal).
const GREEN = "#00ff12";

export async function GET(req: NextRequest) {
  const occupiedParam = req.nextUrl.searchParams.get("occupied");
  const seedParam = req.nextUrl.searchParams.get("seed");
  let occupied = occupiedParam ? parseInt(occupiedParam, 10) : 4;
  if (Number.isNaN(occupied) || occupied < 0 || occupied > 9) occupied = 4;
  const seed = seedParam ? parseInt(seedParam, 10) || 0 : 0;

  const W = 1920;
  const H = 1080;

  // Background: dark navy gradient (TFT in-game vibe).
  const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1428"/><stop offset="1" stop-color="#020812"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  // Bench panel background (darker strip behind the 9 slots).
  const benchPanel = `<rect x="${BENCH_FIRST_SLOT_CENTER - BENCH_SLOT_WIDTH / 2 - 10}" y="${BENCH_Y_TOP - 8}" width="${9 * BENCH_SLOT_WIDTH + 20}" height="${BENCH_Y_BOTTOM - BENCH_Y_TOP + 16}" rx="6" fill="#050a14" stroke="#1a2438" stroke-width="1"/>`;

  // Pick which slots are occupied (seeded random).
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const allIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  // Shuffle (Fisher-Yates) and take first `occupied`.
  for (let i = allIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
  }
  const occupiedSet = new Set(allIndices.slice(0, occupied));

  // Draw each slot: slot border + (if occupied) champion silhouette + green HP bar.
  const slotEls: string[] = [];
  for (let i = 0; i < 9; i++) {
    const cx = BENCH_FIRST_SLOT_CENTER + i * BENCH_SLOT_WIDTH;
    const left = cx - BENCH_SLOT_WIDTH / 2 + 5;
    const top = BENCH_Y_TOP;
    const width = BENCH_SLOT_WIDTH - 10;
    const height = BENCH_Y_BOTTOM - BENCH_Y_TOP;

    // Slot border (subtle).
    slotEls.push(`<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="3" fill="#0d1525" stroke="#1f2d44" stroke-width="1"/>`);

    if (occupiedSet.has(i)) {
      // GREEN HEALTH BAR — şampiyon kafasının ÜSTÜNDE (TFT-OCR-BOT [0,255,18]).
      // Dolu slot = yeşil health bar üstte. Boş slot = yeşil yok.
      // Health bar: y=745-770 (25px bant), slot genişliğinde %70.
      const hpBarY = top + 2;
      const hpBarH = 8;
      const hpBarW = Math.floor(width * 0.7);
      const hpBarX = left + Math.floor((width - hpBarW) / 2);
      // Bar background (dark).
      slotEls.push(`<rect x="${hpBarX}" y="${hpBarY}" width="${hpBarW}" height="${hpBarH}" rx="1" fill="#0a1018"/>`);
      // Green fill (TFT-OCR-BOT [0,255,18]). Random 40-100% HP.
      const hpPct = 0.4 + rand() * 0.6;
      slotEls.push(`<rect x="${hpBarX}" y="${hpBarY}" width="${Math.floor(hpBarW * hpPct)}" height="${hpBarH}" fill="#00ff12"/>`);

      // Champion "portrait" — body + head (slotun alt kısmı).
      const hue1 = Math.floor(rand() * 360);
      const hue2 = (hue1 + 120 + Math.floor(rand() * 60)) % 360;
      const hue3 = (hue1 + 240 + Math.floor(rand() * 60)) % 360;
      // Body (large rect, main color).
      slotEls.push(`<rect x="${left + 8}" y="${top + 20}" width="${width - 16}" height="${height - 28}" rx="4" fill="hsl(${hue1}, 55%, 40%)" stroke="hsl(${hue1}, 60%, 55%)" stroke-width="1"/>`);
      // Head (circle, contrasting color).
      slotEls.push(`<circle cx="${left + width / 2}" cy="${top + height / 2 + 6}" r="${Math.floor(width * 0.18)}" fill="hsl(${hue2}, 60%, 55%)"/>`);
      // Accent (small shape, third color).
      slotEls.push(`<rect x="${left + width / 2 - 6}" y="${top + height - 12}" width="12" height="4" rx="2" fill="hsl(${hue3}, 70%, 60%)"/>`);
      // Star indicator (1-3 stars, small yellow dots).
      const stars = 1 + Math.floor(rand() * 3);
      for (let st = 0; st < stars; st++) {
        slotEls.push(`<circle cx="${left + 12 + st * 8}" cy="${top + height - 6}" r="2" fill="#ffd700"/>`);
      }
    }
  }

  // Seeded noise — dim dots.
  let noise = "";
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const a = (rand() * 0.08).toFixed(3);
    noise += `<rect x="${x}" y="${y}" width="2" height="2" fill="#ffffff" opacity="${a}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg}${benchPanel}${slotEls.join("")}${noise}</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
      "X-Bench-Occupied": String(occupied),
    },
  });
}
