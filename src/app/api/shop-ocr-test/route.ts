/**
 * POST /api/shop-ocr-test
 *
 * Shop OCR test tool (PLAN.md 15.5 step 4 + 15.7).
 * 5-card parallel OCR + fuzzy matching against champion roster.
 */

import { NextRequest, NextResponse } from "next/server";
import { runShopOcrSweep } from "@/lib/tft/ocr/shop-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST /api/shop-ocr-test ile TFT screenshot yükle." });
}

export async function POST(req: NextRequest) {
  try {
    let buf: Buffer;
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "'file' alanı gerekli." }, { status: 400 });
      }
      buf = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      const dataUrl: string | undefined = body?.image;
      if (!dataUrl) {
        return NextResponse.json({ ok: false, error: "'image' gerekli." }, { status: 400 });
      }
      const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      buf = Buffer.from(b64, "base64");
    } else {
      return NextResponse.json({ ok: false, error: "Desteklenmeyen content-type." }, { status: 400 });
    }

    if (buf.length === 0) return NextResponse.json({ ok: false, error: "Boş dosya." }, { status: 400 });
    if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Dosya çok büyük." }, { status: 413 });

    const result = await runShopOcrSweep(buf);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[shop-ocr-test] POST failed:", msg);
    return NextResponse.json({ ok: false, error: "Shop OCR testi başarısız.", details: msg }, { status: 500 });
  }
}
