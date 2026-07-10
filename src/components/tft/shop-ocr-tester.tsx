"use client";

/**
 * ShopOcrTester — Shop OCR test aracı (PLAN.md 15.5 step 4 + 15.7).
 *
 * TFT shop = 5 kart. Her kart şampiyon adı gösterir. OCR + fuzzy matching
 * ile şampiyonları tanır. Türkçe client'te isimler farklı olabilir — tester
 * bunu ortaya çıkarır.
 */

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Upload, Loader2, CheckCircle2, XCircle, ImageIcon, Zap, Sparkles, AlertTriangle } from "lucide-react";
import { StepBadge } from "@/components/tft/ocr-test-section";

interface FuzzyMatch {
  name: string;
  cost: number;
  score: number;
}

interface ShopCardResult {
  slot: number;
  bbox: [number, number, number, number];
  rawOcr: string;
  cleanedOcr: string;
  bestMatch: FuzzyMatch | null;
  candidates: FuzzyMatch[];
  rawCropB64: string;
  processedB64: string;
  error: string | null;
}

interface ShopVariantResult {
  variantName: string;
  cards: ShopCardResult[];
  matchedCount: number;
  error: string | null;
}

interface ShopOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  variants: ShopVariantResult[];
  bestVariant: string | null;
  bestCards: ShopCardResult[] | null;
  error: string | null;
}

const COST_COLORS: Record<number, string> = {
  1: "border-zinc-500 text-zinc-300",
  2: "border-emerald-500 text-emerald-300",
  3: "border-sky-500 text-sky-300",
  4: "border-purple-500 text-purple-300",
  5: "border-amber-500 text-amber-300",
};

export function ShopOcrTester() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShopOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeVariant, setActiveVariant] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runTest = useCallback(async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLocked(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/shop-ocr-test", { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ShopOcrResult;
      if (!json.ok) throw new Error(json.error ?? "OCR testi başarısız");
      setResult(json);
      // Set active variant to the best one.
      const bestIdx = json.variants.findIndex((v) => v.variantName === json.bestVariant);
      setActiveVariant(bestIdx >= 0 ? bestIdx : 0);
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
    setLocked(null);
    setFileName("sample-tft-shop.png");
    try {
      const seed = Math.floor(Math.random() * 1000);
      const sampleRes = await fetch(`/api/shop-ocr-sample?seed=${seed}`, { cache: "no-store" });
      if (!sampleRes.ok) throw new Error(`HTTP ${sampleRes.status}`);
      const blob = await sampleRes.blob();
      const file = new File([blob], "sample-tft-shop.png", { type: "image/png" });
      await runTest(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "örnek oluşturulamadı");
      setLoading(false);
    }
  }, [runTest]);

  const activeV = result?.variants[activeVariant];
  const cards = activeV?.cards ?? result?.bestCards ?? [];

  return (
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <ShoppingBag className="h-3.5 w-3.5" /> Shop OCR test aracı
          <StepBadge step={4} label="PLAN 15.5" />
          <Badge variant="outline" className="ml-auto border-amber-500/40 text-amber-300 bg-amber-500/10 text-[9px]">
            5 kart paralel + fuzzy
          </Badge>
        </CardDescription>
        <CardTitle className="text-base">Shop OCR — 5 kart fuzzy matching</CardTitle>
        <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
          TFT screenshot yükle. 5 shop kartı paralel OCR, şampiyon adlarını fuzzy matching ile
          tanır (Levenshtein). Türkçe client&apos;te isimler farklıysa tester ortaya çıkarır.
          <span className="text-zinc-400"> PLAN 15.5 + 15.7.</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative rounded-xl border-2 border-dashed transition-colors px-4 py-6 text-center cursor-pointer ${
            dragOver ? "border-purple-400/60 bg-purple-500/5" : "border-zinc-700/80 hover:border-zinc-600 hover:bg-zinc-800/30"
          }`}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        >
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileInput} />
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 ring-1 ring-zinc-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-purple-300" /> : <Upload className="h-4 w-4 text-zinc-400" />}
            </div>
            <div className="text-sm text-zinc-300">
              {loading ? "İşleniyor…" : fileName ? `Yüklendi: ${fileName}` : "TFT screenshot sürükle veya tıkla"}
            </div>
            <div className="text-[10px] text-zinc-600">PNG / JPEG / WEBP · max 15MB</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={useSample} disabled={loading} className="h-8 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 text-xs">
            <Sparkles className="mr-1.5 h-3 w-3 text-purple-300" />
            Örnek görsel dene
          </Button>
          {result && (
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setFileName(null); setLocked(null); }} className="h-8 text-xs text-zinc-500 hover:text-zinc-300">
              Temizle
            </Button>
          )}
        </div>

        {result?.tesseractAvailable === false && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200/90 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div><span className="font-semibold">Tesseract yok.</span> OCR çalışmaz, görsel işleme çalışır.</div>
          </div>
        )}

        {error && <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</div>}

        {result && (
          <div className="space-y-3">
            {/* Best variant banner */}
            <div className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${result.bestVariant ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "border-zinc-700 bg-zinc-800/40"}`}>
              {result.bestVariant ? <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" /> : <XCircle className="h-5 w-5 text-zinc-500 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-zinc-100">
                  {result.bestVariant ? <>En iyi varyant: <code className="text-purple-300">{result.bestVariant}</code></> : "Hiç kart eşleşmedi"}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {result.variants.find((v) => v.variantName === result.bestVariant)?.matchedCount ?? 0}/5 kart şampiyon ile eşleşti (score ≥ 0.7) · {result.imageWidth}×{result.imageHeight}
                </div>
              </div>
              {result.bestVariant && (
                <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px] tabular-nums">
                  {result.variants.find((v) => v.variantName === result.bestVariant)?.matchedCount ?? 0}/5
                </Badge>
              )}
            </div>

            {/* Variant selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-zinc-600">varyant:</span>
              {result.variants.map((v, i) => (
                <button key={v.variantName} onClick={() => setActiveVariant(i)} className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${i === activeVariant ? "border-purple-500/50 bg-purple-500/15 text-purple-200" : "border-zinc-700 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"}`}>
                  {v.variantName} <span className="text-zinc-600">({v.matchedCount})</span>
                </button>
              ))}
            </div>

            {/* 5-card grid */}
            <div className="grid grid-cols-5 gap-2">
              {cards.map((card) => {
                const matched = card.bestMatch && card.bestMatch.score >= 0.7;
                const partial = card.bestMatch && card.bestMatch.score >= 0.5 && card.bestMatch.score < 0.7;
                return (
                  <div key={card.slot} className={`rounded-lg border overflow-hidden flex flex-col ${matched ? "border-emerald-500/40 bg-emerald-500/[0.05]" : partial ? "border-amber-500/40 bg-amber-500/[0.05]" : "border-zinc-800 bg-zinc-900/40"}`}>
                    <div className="px-2 py-1 border-b border-zinc-800/80 flex items-center justify-between">
                      <span className="text-[9px] text-zinc-600">slot {card.slot + 1}</span>
                      {matched ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : partial ? <AlertTriangle className="h-3 w-3 text-amber-400" /> : <XCircle className="h-3 w-3 text-zinc-600" />}
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-zinc-800/80">
                      <div className="bg-zinc-950 p-0.5">
                        <div className="text-[7px] uppercase text-zinc-600">raw</div>
                        {card.rawCropB64 ? <img src={card.rawCropB64} alt={`raw ${card.slot}`} className="w-full h-8 object-contain bg-black/50" /> : <div className="w-full h-8" />}
                      </div>
                      <div className="bg-zinc-950 p-0.5">
                        <div className="text-[7px] uppercase text-zinc-600">proc</div>
                        {card.processedB64 ? <img src={card.processedB64} alt={`proc ${card.slot}`} className="w-full h-8 object-contain bg-white/90" /> : <div className="w-full h-8" />}
                      </div>
                    </div>
                    <div className="px-2 py-1.5 flex-1 flex flex-col gap-1">
                      <div className="text-[9px] text-zinc-500 truncate" title={card.rawOcr}>
                        OCR: <span className="text-zinc-300 font-mono">{card.cleanedOcr || "(boş)"}</span>
                      </div>
                      {card.bestMatch ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-[9px] h-4 px-1 ${COST_COLORS[card.bestMatch.cost] ?? "border-zinc-700 text-zinc-400"}`}>
                              {card.bestMatch.name}
                            </Badge>
                            <span className="text-[8px] text-zinc-600 tabular-nums">{(card.bestMatch.score * 100).toFixed(0)}%</span>
                          </div>
                          {card.candidates.length > 1 && (
                            <div className="text-[7px] text-zinc-600 truncate">
                              alt: {card.candidates.slice(1).map((c) => c.name).join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[8px] text-zinc-600">eşleşme yok</div>
                      )}
                      {card.error && <div className="text-[8px] text-red-400/80 truncate">err: {card.error}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lock + reference */}
            <div className="flex items-center gap-2">
              <Button variant={locked ? "default" : "outline"} size="sm" onClick={() => setLocked(locked ? null : activeV?.variantName ?? null)} className="h-7 text-xs" disabled={!activeV || activeV.matchedCount === 0}>
                {locked ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Kilitli: {locked}</> : <><Zap className="mr-1 h-3 w-3" /> Bu ayar çalıştı</>}
              </Button>
            </div>

            <details className="rounded-md border border-zinc-800/80 bg-zinc-900/40">
              <summary className="cursor-pointer select-none px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-300 flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                Koordinat + fuzzy referansı
              </summary>
              <div className="px-3 pb-3 text-[10px] text-zinc-500 space-y-1 font-mono">
                <div>shop band: (481, 1039, 1476, 1070) — 5 kart × 199px</div>
                <div>whitelist: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz&apos;-. &nbsp;</div>
                <div className="text-zinc-600">fuzzy: Levenshtein, score ≥ 0.7 = match, ≥ 0.5 = partial</div>
                <div className="text-zinc-600">OCR confusions: | → I, 0 → O (champion name için)</div>
                <div className="text-zinc-600">paralel: 5 kart Promise.all ile aynı anda OCR</div>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
