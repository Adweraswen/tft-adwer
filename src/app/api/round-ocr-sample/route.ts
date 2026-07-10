/**
 * GET /api/round-ocr-sample
 *
 * Generates a synthetic 1920x1080 TFT-style screenshot with a round indicator
 * (e.g. "3-2") rendered at the TFT-OCR-BOT coordinate (753, 10, 870, 34).
 * Used by the Round OCR tester as a self-test.
 *
 * Query params:
 *   ?stage=N   — stage number (default 3)
 *   ?round=N   — round within stage (default 2)
 *   ?seed=NN   — randomize background noise (default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Round indicator position (1920x1080 reference) — PLAN 15.5 / TFT-OCR-BOT.
const ROUND_BBOX = { left: 753, top: 10, width: 117, height: 24 };

export async function GET(req: NextRequest) {
  const stageParam = req.nextUrl.searchParams.get("stage");
  const roundParam = req.nextUrl.searchParams.get("round");
  const seedParam = req.nextUrl.searchParams.get("seed");
  let stage = stageParam ? parseInt(stageParam, 10) : 3;
  let round = roundParam ? parseInt(roundParam, 10) : 2;
  if (Number.isNaN(stage) || stage < 1 || stage > 11) stage = 3;
  if (Number.isNaN(round) || round < 1 || round > 7) round = 2;
  const seed = seedParam ? parseInt(seedParam, 10) || 0 : 0;

  const W = 1920;
  const H = 1080;
  const roundStr = `${stage}-${round}`;

  // Center the text inside the round bbox. TFT round font is ~18-20px bold white.
  const fontSize = 20;
  const textX = ROUND_BBOX.left + ROUND_BBOX.width / 2;
  const textY = ROUND_BBOX.top + ROUND_BBOX.height - 4; // baseline near bottom

  // Background: dark navy gradient (TFT in-game vibe).
  const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1428"/><stop offset="1" stop-color="#020812"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  // A subtle dark pill behind the round text (TFT has a semi-transparent panel).
  const pillPadX = 14;
  const pillPadY = 5;
  const pill = `<rect x="${ROUND_BBOX.left - pillPadX}" y="${ROUND_BBOX.top - pillPadY}" width="${ROUND_BBOX.width + pillPadX * 2}" height="${ROUND_BBOX.height + pillPadY * 2}" rx="4" fill="#000000" opacity="0.55" stroke="#1a2a40" stroke-width="1"/>`;

  // The round text — pure white, bold, centered.
  const roundText = `<text x="${textX}" y="${textY}" font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#f0f0f0" text-anchor="middle" letter-spacing="1">${roundStr}</text>`;

  // Top bar decoration — a thin line under the round area (TFT UI style).
  const topBar = `<rect x="0" y="40" width="${W}" height="1" fill="#1a2438" opacity="0.5"/>`;

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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg}${pill}${roundText}${topBar}${noise}</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
      "X-Round-Value": roundStr,
    },
  });
}
