"use client";

/**
 * BenchOcrTester — Bench OCR test aracı (PLAN.md 15.5 step 4 + 15.7).
 *
 * İLK SAF CV ADIMI — Tesseract yok, renk çeşitliliği (std-dev) tespiti.
 * Bench 9 slot, dolu slot şampiyon portresi (yüksek çeşitlilik), boş slot monoton koyu.
 *
 * İki mod:
 *   1. FIXED: 9 sabit koordinat, her slot için luminance std-dev.
 *   2. AUTO: koordinat bağımsız — yüksek-std sütunları kümele, her küme = 1 slot.
 *
 * Auto mod koordinat yanlışsa bile çalışır (kural 12 — yedek çözüm).
 */

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripHorizontal, Upload, Loader2, CheckCircle2, XCircle, ImageIcon, Zap, Sparkles, ScanLine } from "lucide-react";
import { StepBadge } from "@/components/tft/ocr-test-section";

interface BenchSlotResult {
  index: number;
  bbox: [number, number, number, number];
  occupied: boolean;
  greenPixelCount: number;
  contiguousGreen: number;
  cropB64: string;
}

interface BenchFixedResult {
  variantName: string;
  coordSet: string;
  convolveWindow: number;
  minGreenPixels: number;
  tolerance: number;
  slots: BenchSlotResult[];
  occupiedCount: number;
  occupiedIndices: number[];
}

interface BenchAutoCluster {
  centerX: number;
  width: number;
  greenCount: number;
  mappedSlotIndex: number | null;
}

interface BenchAutoResult {
  variantName: string;
  clusters: BenchAutoCluster[];
  occupiedCount: number;
}

interface BenchVariantResult {
  occupancyVariant: string;
  fixed: BenchFixedResult[];
  auto: BenchAutoResult;
  error: string | null;
}

interface BenchOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  variants: BenchVariantResult[];
  bestOccupiedCount: number | null;
  bestVariant: string | null;
  error: string | null;
}

export function BenchOcrTester() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BenchOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeVariant, setActiveVariant] = useState(0);
  const [mode, setMode] = useState<"auto" | "fixed">("auto");
  const [fixedIdx, setFixedIdx] = useState(0);
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
      const res = await fetch("/api/bench-ocr-test", { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BenchOcrResult;
      if (!json.ok) throw new Error(json.error ?? "OCR testi başarısız");
      setResult(json);
      setActiveVariant(0);
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
    setFileName("sample-tft-bench.png");
    try {
      const occupied = Math.floor(Math.random() * 7) + 1; // 1-7
      const seed = Math.floor(Math.random() * 1000);
      const sampleRes = await fetch(`/api/bench-ocr-sample?occupied=${occupied}&seed=${seed}`, { cache: "no-store" });
      if (!sampleRes.ok) throw new Error(`HTTP ${sampleRes.status}`);
      const blob = await sampleRes.blob();
      const file = new File([blob], "sample-tft-bench.png", { type: "image/png" });
      await runTest(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "örnek oluşturulamadı");
      setLoading(false);
    }
  }, [runTest]);

  const activeV = result?.variants[activeVariant];

  return (
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <GripHorizontal className="h-3.5 w-3.5" /> Bench OCR test aracı
          <StepBadge step={4} label="PLAN 15.5" />
          <Badge variant="outline" className="ml-auto border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[9px]">
            saf CV · tesseract yok
          </Badge>
        </CardDescription>
        <CardTitle className="text-base">Bench — renk çeşitliliği (std-dev)</CardTitle>
        <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
          TFT screenshot yükle. Bench 9 slot — dolu slot şampiyon portresi (yüksek renk çeşitliliği),
          boş slot monoton koyu (düşük std-dev).
          4 std-dev varyantı denenir. <span className="text-zinc-400">İlk saf CV adımı.</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload / drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative rounded-xl border-2 border-dashed transition-colors px-4 py-6 text-center cursor-pointer ${
            dragOver
              ? "border-emerald-400/60 bg-emerald-500/5"
              : "border-zinc-700/80 hover:border-zinc-600 hover:bg-zinc-800/30"
          }`}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onFileInput}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 ring-1 ring-zinc-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-emerald-300" /> : <Upload className="h-4 w-4 text-zinc-400" />}
            </div>
            <div className="text-sm text-zinc-300">
              {loading ? "İşleniyor…" : fileName ? `Yüklendi: ${fileName}` : "TFT screenshot sürükle veya tıkla"}
            </div>
            <div className="text-[10px] text-zinc-600">PNG / JPEG / WEBP · max 15MB</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={useSample}
            disabled={loading}
            className="h-8 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 text-xs"
          >
            <Sparkles className="mr-1.5 h-3 w-3 text-emerald-300" />
            Örnek görsel dene
          </Button>
          {result && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setResult(null); setFileName(null); setLocked(null); }}
              className="h-8 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Temizle
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            {/* Best count banner */}
            <div
              className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${
                result.bestOccupiedCount !== null
                  ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                  : "border-zinc-700 bg-zinc-800/40"
              }`}
            >
              {result.bestOccupiedCount !== null ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-zinc-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-zinc-100">
                  {result.bestOccupiedCount !== null ? (
                    <>Bench&apos;te <span className="text-emerald-300 tabular-nums">{result.bestOccupiedCount}</span> dolu slot</>
                  ) : (
                    "Hiç dolu slot bulunamadı"
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">
                  En iyi varyant: <code className="text-zinc-300">{result.bestVariant}</code> · {result.imageWidth}×{result.imageHeight}
                </div>
              </div>
              {result.bestOccupiedCount !== null && (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] tabular-nums">
                  {result.bestOccupiedCount}/9
                </Badge>
              )}
            </div>

            {/* Variant + mode selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-zinc-600">çeşitlilik:</span>
              {result.variants.map((v, i) => (
                <button
                  key={v.occupancyVariant}
                  onClick={() => setActiveVariant(i)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    i === activeVariant
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                      : "border-zinc-700 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {v.occupancyVariant}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-zinc-600">mod:</span>
              {([
                { id: "auto", label: "auto-detect (önerilen)" },
                { id: "fixed", label: "sabit koordinat" },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    mode === m.id
                      ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                      : "border-zinc-700 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Active variant detail */}
            {activeV && activeV.error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                Bu varyant hata verdi: {activeV.error}
              </div>
            )}

            {/* Fixed mode: 9-slot grid */}
            {activeV && !activeV.error && mode === "fixed" && activeV.fixed.length > 0 && (
              <div className="space-y-2">
                {/* Koordinat seti seçici */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-600">koordinat seti:</span>
                  {activeV.fixed.map((f, i) => (
                    <button
                      key={f.coordSet}
                      onClick={() => setFixedIdx(i)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                        i === fixedIdx
                          ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                          : "border-zinc-700 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {f.coordSet} <span className="text-zinc-600">({f.occupiedCount})</span>
                    </button>
                  ))}
                </div>
                {(() => {
                  const fixed = activeV.fixed[fixedIdx] ?? activeV.fixed[0];
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] text-zinc-400">
                          Set: <span className="text-zinc-200">{fixed.coordSet}</span>
                          <span className="text-zinc-600 ml-2">· yeşil≥<span className="text-zinc-300 tabular-nums">{fixed.minGreenPixels}</span>px & cont≥<span className="text-zinc-300 tabular-nums">{fixed.convolveWindow}</span>{fixed.tolerance > 0 && <span className="text-amber-400"> (tol±{fixed.tolerance})</span>}</span>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] tabular-nums">
                          {fixed.occupiedCount}/9 dolu
                        </Badge>
                      </div>
                      <div className="grid grid-cols-9 gap-1.5">
                        {fixed.slots.map((slot) => (
                          <div
                            key={slot.index}
                            className={`rounded-md border overflow-hidden flex flex-col ${
                              slot.occupied
                                ? "border-emerald-500/50 bg-emerald-500/[0.08]"
                                : "border-zinc-800 bg-zinc-900/40"
                            }`}
                          >
                            <div className="px-1 py-0.5 border-b border-zinc-800/80 flex items-center justify-between">
                              <span className="text-[8px] text-zinc-600">#{slot.index + 1}</span>
                              {slot.occupied ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                              )}
                            </div>
                            <div className="bg-zinc-950 p-0.5">
                              <div className="text-[7px] uppercase text-zinc-600">raw</div>
                              {slot.cropB64 ? <img src={slot.cropB64} alt={`slot ${slot.index + 1}`} className="w-full h-10 object-cover" /> : <div className="w-full h-10 bg-zinc-950" />}
                            </div>
                            <div className="px-1 py-0.5 text-[8px] text-zinc-600 tabular-nums">
                              yeşil:{slot.greenPixelCount} · cont:{slot.contiguousGreen}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Yeşil piksel: {fixed.slots.map((s) => s.occupied ? `${s.index + 1}→${s.greenPixelCount}px` : null).filter(Boolean).join(" · ") || "yok"}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Auto mode: cluster list */}
            {activeV && !activeV.error && mode === "auto" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-zinc-400">
                    Mod: <span className="text-zinc-200">auto-detect</span>
                    <span className="text-zinc-600 ml-2">· koordinat bağımsız</span>
                  </div>
                  <Badge variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-500/10 text-[10px] tabular-nums">
                    {activeV.auto.occupiedCount} küme
                  </Badge>
                </div>
                {activeV.auto.clusters.length === 0 ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-center text-[11px] text-zinc-500">
                    Yüksek çeşitlilik kümesi bulunamadı. Varyant değişmeyi dene.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeV.auto.clusters.map((c, i) => (
                      <div key={i} className="rounded-md border border-sky-500/30 bg-sky-500/[0.05] px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
                        <ScanLine className="h-3 w-3 text-sky-400 flex-shrink-0" />
                        <span className="text-zinc-400">küme {i + 1}:</span>
                        <span className="text-zinc-200 tabular-nums">x={c.centerX}</span>
                        <span className="text-zinc-500 tabular-nums">w={c.width}px</span>
                        <span className="text-zinc-500 tabular-nums">yeşil:{c.greenCount}px</span>
                        {c.mappedSlotIndex !== null ? (
                          <Badge variant="outline" className="ml-auto border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[9px]">
                            slot #{c.mappedSlotIndex + 1}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="ml-auto border-zinc-700 text-zinc-500 text-[9px]">
                            eşleşme yok
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-zinc-500">
                  Auto mod koordinat bilmeden çalışır — yüksek-std sütunları x ekseninde kümeler. Her küme = 1 dolu slot.
                </div>
              </div>
            )}

            {/* Lock button */}
            {result.bestOccupiedCount !== null && activeV && !activeV.error && (
              <div className="flex items-center gap-2">
                <Button
                  variant={locked ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocked(locked ? null : `${activeV.occupancyVariant}/${mode}`)}
                  className="h-7 text-xs"
                >
                  {locked ? (
                    <><CheckCircle2 className="mr-1 h-3 w-3" /> Kilitli: {locked}</>
                  ) : (
                    <><Zap className="mr-1 h-3 w-3" /> Bu ayar çalıştı</>
                  )}
                </Button>
              </div>
            )}

            {/* Coordinates reference */}
            <details className="rounded-md border border-zinc-800/80 bg-zinc-900/40">
              <summary className="cursor-pointer select-none px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-300 flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                Koordinat referansı (1920×1080)
              </summary>
              <div className="px-3 pb-3 text-[10px] text-zinc-500 space-y-1 font-mono">
                <div>bench band: y=770..845, x=480..1476 (9 slot, 110px/each)</div>
                <div>ilk slot merkez x=535, her 110px&apos;de bir</div>
                <div className="text-zinc-600">yeşil HP bar: ~[0, 255, 18]</div>
                <div className="text-zinc-600">occupied threshold: slot alanının ~2%&apos;si yeşil</div>
                <div className="text-zinc-600">auto mod: koordinat bağımsız, yeşil kümeleri sayar</div>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
