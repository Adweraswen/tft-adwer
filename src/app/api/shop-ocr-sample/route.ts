/**
 * GET /api/shop-ocr-sample
 *
 * Generates a synthetic 1920x1080 TFT-style screenshot with a 5-card shop.
 * Each card shows a champion name (white text on dark). Used for self-test.
 *
 * Query params:
 *   ?seed=NN  — randomize which champions appear (default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { CHAMPIONS } from "@/lib/tft-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shop band — must match shop-ocr.ts constants.
const SHOP_BAND_LEFT = 481;
const SHOP_BAND_TOP = 1039;
const SHOP_BAND_RIGHT = 1476;
const SHOP_BAND_BOTTOM = 1070;
const SHOP_CARD_WIDTH = 199;

export async function GET(req: NextRequest) {
  const seedParam = req.nextUrl.searchParams.get("seed");
  const seed = seedParam ? parseInt(seedParam, 10) || 0 : 0;

  const W = 1920;
  const H = 1080;

  // Pick 5 random champions (seeded).
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

  // Shuffle champions and take 5.
  const pool = [...CHAMPIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const shop = pool.slice(0, 5);

  // Background.
  const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1428"/><stop offset="1" stop-color="#020812"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  // Shop panel background (darker strip behind the 5 cards).
  const shopPanel = `<rect x="${SHOP_BAND_LEFT - 8}" y="${SHOP_BAND_TOP - 4}" width="${SHOP_BAND_RIGHT - SHOP_BAND_LEFT + 16}" height="${SHOP_BAND_BOTTOM - SHOP_BAND_TOP + 8}" rx="4" fill="#050a14" stroke="#1a2438" stroke-width="1"/>`;

  // Each card: card background (cost-colored) + champion name text (white).
  const cardEls: string[] = [];
  const costColors: Record<number, string> = {
    1: "#9ca3af", // gray
    2: "#22c55e", // green
    3: "#3b82f6", // blue
    4: "#a855f7", // purple
    5: "#f59e0b", // gold
  };

  for (let i = 0; i < 5; i++) {
    const champ = shop[i];
    const x1 = SHOP_BAND_LEFT + i * SHOP_CARD_WIDTH + 4;
    const x2 = SHOP_BAND_LEFT + (i + 1) * SHOP_CARD_WIDTH - 4;
    const cardW = x2 - x1;
    const cardH = SHOP_BAND_BOTTOM - SHOP_BAND_TOP;

    // Card background (slightly tinted by cost).
    const color = costColors[champ.cost] ?? "#9ca3af";
    cardEls.push(`<rect x="${x1}" y="${SHOP_BAND_TOP}" width="${cardW}" height="${cardH}" rx="3" fill="${color}" opacity="0.15" stroke="${color}" stroke-width="0.5"/>`);

    // Champion name — white text, centered. Font size 13 (small, matches TFT shop).
    const fontSize = 13;
    const textX = x1 + cardW / 2;
    const textY = SHOP_BAND_TOP + cardH - 4; // baseline near bottom
    // Escape XML special chars in name.
    const safeName = champ.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
    cardEls.push(`<text x="${textX}" y="${textY}" font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#f0f0f0" text-anchor="middle">${safeName}</text>`);

    // Cost indicator (small number top-left of card).
    cardEls.push(`<text x="${x1 + 6}" y="${SHOP_BAND_TOP + 12}" font-family="DejaVu Sans, sans-serif" font-size="10" font-weight="bold" fill="${color}">${champ.cost}</text>`);
  }

  // Seeded noise.
  let noise = "";
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const a = (rand() * 0.08).toFixed(3);
    noise += `<rect x="${x}" y="${y}" width="2" height="2" fill="#ffffff" opacity="${a}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg}${shopPanel}${cardEls.join("")}${noise}</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  const shopNames = shop.map((c) => c.name).join("|");
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
      "X-Shop-Champions": shopNames,
    },
  });
}
