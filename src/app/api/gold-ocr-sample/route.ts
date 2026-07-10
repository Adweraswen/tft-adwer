/**
 * GET /api/gold-ocr-sample
 *
 * Generates a synthetic 1920x1080 TFT-style screenshot with a gold number
 * rendered at the TFT-OCR-BOT coordinate (870, 883, 920, 909). Used by the
 * Gold OCR tester as a self-test: proves the full pipeline (crop → white-text
 * detect → upscale → tesseract) works end-to-end without needing a real TFT
 * screenshot.
 *
 * The synthetic image mimics the real TFT gold UI:
 *   - dark navy background (~ #0a1428)
 *   - large white digits at the gold position (rendered with DejaVu Sans Bold)
 *   - a faint gold coin icon to the left (so the crop region is realistic)
 *
 * Query params:
 *   ?gold=N    — the gold value to render (default 44)
 *   ?seed=NN   — randomize background noise (default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gold digit position (1920x1080 reference) — matches PLAN 15.9 / TFT-OCR-BOT.
const GOLD_BBOX = { left: 870, top: 883, width: 50, height: 26 };

export async function GET(req: NextRequest) {
  const goldParam = req.nextUrl.searchParams.get("gold");
  const seedParam = req.nextUrl.searchParams.get("seed");
  let gold = goldParam ? parseInt(goldParam, 10) : 44;
  if (Number.isNaN(gold) || gold < 0 || gold > 999) gold = 44;
  const seed = seedParam ? parseInt(seedParam, 10) || 0 : 0;

  const W = 1920;
  const H = 1080;
  const digitsStr = String(gold);

  // Center the digits inside the gold bbox. TFT gold font is ~24px bold.
  // Use DejaVu Sans Bold (installed in sandbox + most Linux systems).
  const fontSize = 24;
  const textWidth = digitsStr.length * fontSize * 0.6; // approx char width
  const textX = GOLD_BBOX.left + GOLD_BBOX.width / 2;
  const textY = GOLD_BBOX.top + GOLD_BBOX.height - 4; // baseline near bottom

  // Background: dark navy gradient (TFT bottom bar vibe).
  const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1428"/><stop offset="1" stop-color="#020812"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  // Gold coin icon to the LEFT of the digits (so the crop is realistic).
  const coinCx = 845;
  const coinCy = 896;
  const coin = `<circle cx="${coinCx}" cy="${coinCy}" r="14" fill="#d4af37" stroke="#8b6914" stroke-width="1.5"/><circle cx="${coinCx}" cy="${coinCy}" r="9" fill="none" stroke="#8b6914" stroke-width="1"/><text x="${coinCx}" y="${coinCy + 4}" font-family="DejaVu Sans, sans-serif" font-size="12" font-weight="bold" fill="#5a4410" text-anchor="middle">G</text>`;

  // The gold digits — pure white, bold, centered in the bbox.
  const goldText = `<text x="${textX}" y="${textY}" font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#f4e7c4" text-anchor="middle" letter-spacing="1">${digitsStr}</text>`;

  // XP bar to the right of gold (typical TFT layout) — realistic noise.
  const xp = `<rect x="940" y="884" width="120" height="10" fill="#1a2438" stroke="#2a3548" stroke-width="1"/><rect x="941" y="885" width="${Math.min(118, gold * 2)}" height="8" fill="#3b82f6" opacity="0.7"/>`;

  // Thin amber divider line below the gold bar.
  const divider = `<rect x="800" y="920" width="200" height="2" fill="#3a2f1a" opacity="0.6"/>`;

  // Seeded noise — dim dots so background isn't perfectly flat.
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let noise = "";
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const a = (rand() * 0.08).toFixed(3);
    noise += `<rect x="${x}" y="${y}" width="2" height="2" fill="#ffffff" opacity="${a}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg}${coin}${goldText}${xp}${divider}${noise}</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
      "X-Gold-Value": String(gold),
    },
  });
}
