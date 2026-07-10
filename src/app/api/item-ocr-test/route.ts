/**
 * POST /api/item-ocr-test
 *
 * Item recognition test tool. Analyzes a single item icon region.
 *
 * Body:
 *   - multipart: file + optional region=x1,y1,x2,y2 (1080p reference)
 *   - JSON: { image: base64, region: [x1,y1,x2,y2] }
 *
 * Default region: (900, 700, 940, 740) — a small 40x40 box (typical item icon size).
 */

import { NextRequest, NextResponse } from "next/server";
import { runItemOcr } from "@/lib/tft/ocr/item-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST /api/item-ocr-test ile item icon bölgesi yükle." });
}

function parseRegion(s: string | null): [number, number, number, number] {
  if (!s) return [900, 700, 940, 740]; // default 40x40 box
  const parts = s.split(",").map((x) => parseInt(x.trim(), 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return [900, 700, 940, 740];
  return parts as [number, number, number, number];
}

export async function POST(req: NextRequest) {
  try {
    let buf: Buffer;
    let region1080: [number, number, number, number];

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "'file' gerekli." }, { status: 400 });
      buf = Buffer.from(await file.arrayBuffer());
      region1080 = parseRegion(form.get("region") as string | null);
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      const dataUrl: string | undefined = body?.image;
      if (!dataUrl) return NextResponse.json({ ok: false, error: "'image' gerekli." }, { status: 400 });
      const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      buf = Buffer.from(b64, "base64");
      region1080 = Array.isArray(body?.region) && body.region.length === 4 ? body.region : [900, 700, 940, 740];
    } else {
      return NextResponse.json({ ok: false, error: "Desteklenmeyen content-type." }, { status: 400 });
    }

    if (buf.length === 0) return NextResponse.json({ ok: false, error: "Boş dosya." }, { status: 400 });
    if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Dosya çok büyük." }, { status: 413 });

    const result = await runItemOcr(buf, region1080);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[item-ocr-test] failed:", msg);
    return NextResponse.json({ ok: false, error: "Item OCR başarısız.", details: msg }, { status: 500 });
  }
}
