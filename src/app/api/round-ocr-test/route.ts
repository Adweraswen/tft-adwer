/**
 * POST /api/round-ocr-test
 *
 * Round OCR test tool (PLAN.md 15.5 step 2 + 15.7).
 * Same pattern as /api/gold-ocr-test but for the round indicator "3-2".
 *
 * Accepts a TFT screenshot (multipart or base64 JSON), runs the full
 * multi-variant Round OCR sweep, returns every variant's raw + processed
 * image (base64) plus the OCR result.
 */

import { NextRequest, NextResponse } from "next/server";
import { runRoundOcrSweep } from "@/lib/tft/ocr/round-ocr";
import { isTesseractAvailable } from "@/lib/tft/ocr/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const available = await isTesseractAvailable();
  return NextResponse.json({
    ok: true,
    tesseractAvailable: available,
    message: available
      ? "Tesseract bulundu. POST /api/round-ocr-test ile TFT screenshot yükle."
      : "Tesseract bulunamadı. OCR çalışmaz ama image processing çalışır.",
  });
}

export async function POST(req: NextRequest) {
  try {
    let buf: Buffer;
    let label = "upload";

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
      label = (file.name || "upload").replace(/\.[^.]+$/, "");
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
      if (body?.label) label = String(body.label).slice(0, 32);
    } else {
      return NextResponse.json(
        { ok: false, error: "Desteklenmeyen content-type. multipart/form-data veya application/json kullan." },
        { status: 400 }
      );
    }

    if (buf.length === 0) {
      return NextResponse.json({ ok: false, error: "Boş dosya." }, { status: 400 });
    }
    if (buf.length > 15 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "Dosya çok büyük (>15MB)." },
        { status: 413 }
      );
    }

    const result = await runRoundOcrSweep(buf);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[round-ocr-test] POST failed:", msg);
    return NextResponse.json(
      { ok: false, error: "Round OCR testi başarısız.", details: msg },
      { status: 500 }
    );
  }
}
