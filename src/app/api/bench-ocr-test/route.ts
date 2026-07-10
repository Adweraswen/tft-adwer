/**
 * POST /api/bench-ocr-test
 *
 * Bench OCR test tool (PLAN.md 15.5 step 4 + 15.7).
 * Pure CV — no Tesseract. Detects green HP bars in bench slots.
 *
 * Returns: 9 slot crops + occupancy for each green-threshold variant,
 * plus auto-detect cluster results (coordinate-independent).
 */

import { NextRequest, NextResponse } from "next/server";
import { runBenchOcrSweep } from "@/lib/tft/ocr/bench-ocr";
import { isTesseractAvailable } from "@/lib/tft/ocr/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const available = await isTesseractAvailable();
  return NextResponse.json({
    ok: true,
    tesseractAvailable: available,
    note: "Bench OCR tesseract KULLANMAZ (saf CV / renk tespiti). Bu bilgi sadece UI tutarlılığı için.",
  });
}

export async function POST(req: NextRequest) {
  try {
    let buf: Buffer;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "'file' alanı gerekli (PNG/JPEG)." },
          { status: 400 }
        );
      }
      buf = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      const dataUrl: string | undefined = body?.image;
      if (!dataUrl) {
        return NextResponse.json(
          { ok: false, error: "'image' (base64 data URL) gerekli." },
          { status: 400 }
        );
      }
      const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      buf = Buffer.from(b64, "base64");
    } else {
      return NextResponse.json(
        { ok: false, error: "Desteklenmeyen content-type." },
        { status: 400 }
      );
    }

    if (buf.length === 0) {
      return NextResponse.json({ ok: false, error: "Boş dosya." }, { status: 400 });
    }
    if (buf.length > 15 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Dosya çok büyük (>15MB)." }, { status: 413 });
    }

    const result = await runBenchOcrSweep(buf);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[bench-ocr-test] POST failed:", msg);
    return NextResponse.json(
      { ok: false, error: "Bench OCR testi başarısız.", details: msg },
      { status: 500 }
    );
  }
}
