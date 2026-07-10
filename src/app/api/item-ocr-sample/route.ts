/**
 * GET /api/item-ocr-sample
 *
 * Generates a synthetic item icon (40x40) for self-test. Renders a colored
 * shape that mimics a TFT item icon — distinct hue per item category.
 *
 * Query params:
 *   ?item={name}  — which item to render (default "B.F. Sword")
 *   ?size=N       — icon size in pixels (default 40)
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { ITEM_SIGNATURES } from "@/lib/tft/ocr/item-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Map color name → hex for SVG rendering.
const COLOR_HEX: Record<string, string> = {
  "gümüş": "#c0c0c0",
  "kahve": "#8b5a2b",
  "mor": "#9933cc",
  "mavi": "#3399cc",
  "gri": "#606060",
  "koyu mor": "#4b0082",
  "turuncu": "#cc6633",
  "sarı": "#ffcc00",
  "camgöbeği": "#33cccc",
};

export async function GET(req: NextRequest) {
  const itemParam = req.nextUrl.searchParams.get("item");
  const sizeParam = req.nextUrl.searchParams.get("size");
  const size = sizeParam ? parseInt(sizeParam, 10) : 40;
  const itemName = itemParam || "B.F. Sword";

  const sig = ITEM_SIGNATURES.find((s) => s.name === itemName) ?? ITEM_SIGNATURES[0];
  const hex = COLOR_HEX[sig.colorName] ?? "#888888";

  // Render a 40x40 icon: dark bg + colored shape (circle/sword/rod silhouette).
  // For realism, we draw a simple geometric shape per category.
  let shape = "";
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;

  if (sig.category === "AD") {
    // Sword: vertical rectangle + crossguard.
    shape = `<rect x="${cx - 2}" y="${size * 0.15}" width="4" height="${size * 0.7}" fill="${hex}"/><rect x="${cx - 8}" y="${cy - 2}" width="16" height="4" fill="${hex}"/>`;
  } else if (sig.category === "AP") {
    // Rod: circle (orb) on top of a stick.
    shape = `<rect x="${cx - 1}" y="${cy}" width="2" height="${size * 0.4}" fill="#8b5a2b"/><circle cx="${cx}" cy="${cy - 2}" r="${r}" fill="${hex}"/>`;
  } else if (sig.category === "AS") {
    // Bow: curved arc.
    shape = `<path d="M ${size * 0.3} ${size * 0.2} Q ${size * 0.8} ${cy} ${size * 0.3} ${size * 0.8}" stroke="${hex}" stroke-width="2" fill="none"/><line x1="${size * 0.3}" y1="${size * 0.2}" x2="${size * 0.3}" y2="${size * 0.8}" stroke="${hex}" stroke-width="1"/>`;
  } else if (sig.category === "Mana") {
    // Tear drop.
    shape = `<path d="M ${cx} ${size * 0.2} Q ${size * 0.75} ${cy} ${cx} ${size * 0.8} Q ${size * 0.25} ${cy} ${cx} ${size * 0.2} Z" fill="${hex}"/>`;
  } else if (sig.category === "Tank") {
    // Shield.
    shape = `<path d="M ${size * 0.25} ${size * 0.2} L ${size * 0.75} ${size * 0.2} L ${size * 0.75} ${cy} Q ${cx} ${size * 0.8} ${size * 0.25} ${cy} Z" fill="${hex}"/>`;
  } else if (sig.category === "Utility") {
    // Spatula.
    shape = `<rect x="${cx - 4}" y="${size * 0.2}" width="8" height="${size * 0.35}" fill="${hex}"/><rect x="${cx - 1}" y="${size * 0.55}" width="2" height="${size * 0.3}" fill="#8b5a2b"/>`;
  } else if (sig.category === "Crit") {
    // Glove: 5 small circles (fingers) + palm.
    shape = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hex}"/>`;
  } else {
    shape = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hex}"/>`;
  }

  // Dark background (TFT item slot bg).
  const bg = `<rect width="${size}" height="${size}" fill="#0a1428" rx="4"/>`;
  const border = `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" fill="none" stroke="#2a3548" stroke-width="1" rx="4"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg}${shape}${border}</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
