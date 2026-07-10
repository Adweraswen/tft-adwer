"use client";

/**
 * ItemOcrTester — Item tanıma test aracı (PLAN.md 15.5 step 6 + 15.7).
 *
 * Item ikonları renk imzası (hue/sat/brightness) ile tanınır. OCR fallback
 * var (item hover'da isim çıkabilir). Template matching DDragon iconları
 * indirildikten sonra eklenecek.
 *
 * Not: Item imza tablosu APPROXIMATE — gerçek TFT icon'larından compute
 * edilecek. Bu tester "renk yaklaşımı çalışıyor mu" sorusunu cevaplar.
 */

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Upload, Loader2, CheckCircle2, XCircle, ImageIcon, Zap, Sparkles, Palette } from "lucide-react";
import { StepBadge } from "@/components/tft/ocr-test-section";

interface ItemColorSig {
  hue: number;
  saturation: number;
  brightness: number;
  colorfulness: number;
}

interface ItemMatch {
  name: string;
  category: string;
  component: boolean;
  colorName: string;
  score: number;
}

interface ItemOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  region: [number, number, number, number];
  colorSignature: ItemColorSig | null;
  colorMatches: ItemMatch[];
  ocrText: string | null;
  ocrMatches: { name: string; score: number }[];
  rawCropB64: string;
  error: string | null;
}

const SAMPLE_ITEMS = [
  "B.F. Sword", "Needlessly Large Rod", "Tear of the Goddess",
  "Chain Vest", "Spatula", "Giant's Belt", "Glove", "Recurve Bow", "Negatron Cloak",
];

export function ItemOcrTester() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ItemOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sampleTruth, setSampleTruth] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runTest = useCallback(async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    setSampleTruth(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/item-ocr-test", { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ItemOcrResult;
      if (!json.ok) throw new Error(json.error ?? "OCR başarısız");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) runTest(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) runTest(f);
  };

  const useSample = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName("sample-item.png");
    const truth = SAMPLE_ITEMS[Math.floor(Math.random() * SAMPLE_ITEMS.length)];
    setSampleTruth(truth);
    try {
      const sampleRes = await fetch(`/api/item-ocr-sample?item=${encodeURIComponent(truth)}&size=40`, { cache: "no-store" });
      if (!sampleRes.ok) throw new Error(`HTTP ${sampleRes.status}`);
      const blob = await sampleRes.blob();
      const file = new File([blob], "sample-item.png", { type: "image/png" });
      await runTest(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "örnek oluşturulamadı");
      setLoading(false);
    }
  }, [runTest]);

  const topMatch = result?.colorMatches[0];
  const correct = sampleTruth && topMatch && topMatch.name === sampleTruth;

  return (
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Package className="h-3.5 w-3.5" /> Item tanıma test aracı
          <StepBadge step={6} label="PLAN 15.5" />
          <Badge variant="outline" className="ml-auto border-rose-500/40 text-rose-300 bg-rose-500/10 text-[9px]">
            renk imzası + OCR fallback
          </Badge>
        </CardDescription>
        <CardTitle className="text-base">Item tanıma — renk imzası</CardTitle>
        <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
          Item icon bölgesi yükle. Hue/saturation/brightness imzası çıkarılıp item tablosuna
          fuzzy match yapılır. OCR fallback (hover ismi) var. <span className="text-zinc-400">Template matching DDragon&apos;dan sonra.</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative rounded-xl border-2 border-dashed transition-colors px-4 py-6 text-center cursor-pointer ${dragOver ? "border-rose-400/60 bg-rose-500/5" : "border-zinc-700/80 hover:border-zinc-600 hover:bg-zinc-800/30"}`}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        >
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileInput} />
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 ring-1 ring-zinc-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-rose-300" /> : <Upload className="h-4 w-4 text-zinc-400" />}
            </div>
            <div className="text-sm text-zinc-300">{loading ? "İşleniyor…" : fileName ? `Yüklendi: ${fileName}` : "Item icon sürükle veya tıkla"}</div>
            <div className="text-[10px] text-zinc-600">PNG / JPEG / WEBP · max 15MB</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={useSample} disabled={loading} className="h-8 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 text-xs">
            <Sparkles className="mr-1.5 h-3 w-3 text-rose-300" />
            Örnek item dene
          </Button>
          {result && (
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setFileName(null); setSampleTruth(null); }} className="h-8 text-xs text-zinc-500 hover:text-zinc-300">
              Temizle
            </Button>
          )}
        </div>

        {error && <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</div>}

        {result && (
          <div className="space-y-3">
            {/* Truth reveal (sample mode) */}
            {sampleTruth && (
              <div className={`rounded-lg border px-3 py-2 flex items-center gap-3 ${correct ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "border-amber-500/40 bg-amber-500/[0.08]"}`}>
                {correct ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-amber-400" />}
                <div className="flex-1">
                  <div className="text-sm font-semibold text-zinc-100">
                    {correct ? "Doğru tanındı!" : "Yanlış — renk imzası yetersiz"}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Gerçek: <span className="text-zinc-300 font-medium">{sampleTruth}</span> · Tahmin: <span className="text-zinc-300 font-medium">{topMatch?.name ?? "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Color signature */}
            {result.colorSignature && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <Palette className="h-3 w-3" /> Renk imzası
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  <div>
                    <div className="text-zinc-600 uppercase">hue</div>
                    <div className="text-zinc-200 tabular-nums font-mono">{result.colorSignature.hue.toFixed(0)}°</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase">sat</div>
                    <div className="text-zinc-200 tabular-nums font-mono">{(result.colorSignature.saturation * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase">bright</div>
                    <div className="text-zinc-200 tabular-nums font-mono">{result.colorSignature.brightness.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase">colorful</div>
                    <div className="text-zinc-200 tabular-nums font-mono">{(result.colorSignature.colorfulness * 100).toFixed(0)}%</div>
                  </div>
                </div>
                {/* Hue swatch */}
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-zinc-600">renk:</div>
                  <div
                    className="h-4 w-12 rounded border border-zinc-700"
                    style={{
                      backgroundColor: result.colorSignature.colorfulness > 0.15
                        ? `hsl(${result.colorSignature.hue}, ${Math.min(100, result.colorSignature.saturation * 150)}%, 50%)`
                        : `rgb(${result.colorSignature.brightness}, ${result.colorSignature.brightness}, ${result.colorSignature.brightness})`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Icon preview */}
            {result.rawCropB64 && (
              <div className="flex items-center gap-3">
                <div className="text-[11px] text-zinc-500">icon:</div>
                <img src={result.rawCropB64} alt="item icon" className="h-12 w-12 object-contain rounded border border-zinc-700 bg-zinc-950" style={{ imageRendering: "pixelated" }} />
              </div>
            )}

            {/* Color matches */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-zinc-400">Renk eşleşmeleri (top 3):</div>
              {result.colorMatches.length === 0 ? (
                <div className="text-[10px] text-zinc-600">Eşleşme yok.</div>
              ) : (
                result.colorMatches.map((m, i) => (
                  <div key={i} className={`rounded-md border px-2.5 py-1.5 flex items-center gap-2 text-[11px] ${i === 0 ? "border-rose-500/40 bg-rose-500/[0.05]" : "border-zinc-800 bg-zinc-900/40"}`}>
                    <Badge variant="outline" className={`text-[9px] h-4 px-1 ${m.component ? "border-zinc-600 text-zinc-400" : "border-amber-500/40 text-amber-300"}`}>
                      {m.component ? "comp" : "done"}
                    </Badge>
                    <span className="text-zinc-200 font-medium">{m.name}</span>
                    <span className="text-zinc-600">{m.colorName}</span>
                    <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1 tabular-nums">
                      {(m.score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))
              )}
            </div>

            {/* OCR fallback */}
            {result.ocrText && (
              <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-2.5 space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase">OCR fallback</div>
                <div className="text-[11px] text-zinc-300 font-mono">&quot;{result.ocrText}&quot;</div>
                {result.ocrMatches.length > 0 && (
                  <div className="text-[10px] text-zinc-500">
                    fuzzy: {result.ocrMatches.map((m) => `${m.name} (${(m.score * 100).toFixed(0)}%)`).join(", ")}
                  </div>
                )}
              </div>
            )}

            <details className="rounded-md border border-zinc-800/80 bg-zinc-900/40">
              <summary className="cursor-pointer select-none px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-300 flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                Item imza tablosu notu
              </summary>
              <div className="px-3 pb-3 text-[10px] text-zinc-500 space-y-1">
                <div>İmza tablosu APPROXIMATE — TFT icon&apos;larından görsel inceleme ile.</div>
                <div>DDragon iconları indirildikten sonra compute edilecek (template matching için de lazım).</div>
                <div className="text-zinc-600">Hue distance circular (0-180°), sat/bright linear.</div>
                <div className="text-zinc-600">Colorfulness &gt; 0.15 → hue ağırlıklı, değilse brightness ağırlıklı skor.</div>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
