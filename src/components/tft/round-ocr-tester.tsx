"use client";

/**
 * RoundOcrTester — Round OCR test aracı (PLAN.md 15.5 step 2 + 15.7).
 *
 * TFT'de stage-round göstergesi (örn. "3-2") ekranın üst-ortasında görünür.
 * TFT-OCR-BOT koordinatı: (753, 10, 870, 34). PSM7, "0123456789-" whitelist.
 *
 * Kullanıcı bir TFT screenshot yükler (veya örnek kullanır). Backend 8 farklı
 * koordinat/threshold/scale/psm varyantı dener. Her varyantın raw + processed
 * görüntüsü ve OCR sonucu gösterilir. Kullanıcı hangisinin doğru okuduğunu söyler.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Upload, Loader2, CheckCircle2, XCircle, ImageIcon, Zap, AlertTriangle, Sparkles } from "lucide-react";
import { StepBadge } from "@/components/tft/ocr-test-section";

interface RoundVariantResult {
  name: string;
  bbox: [number, number, number, number];
  threshold: number;
  scale: number;
  psm: number;
  rawOcr: string;
  round: string | null;
  stage: number | null;
  roundNum: number | null;
  rawCropB64: string;
  processedB64: string;
  error: string | null;
}

interface RoundOcrResult {
  ok: boolean;
  tesseractAvailable: boolean;
  imageWidth: number;
  imageHeight: number;
  variants: RoundVariantResult[];
  bestRound: string | null;
  bestStage: number | null;
  bestRoundNum: number | null;
  bestVariant: string | null;
  error: string | null;
}

export function RoundOcrTester() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoundOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
      const res = await fetch("/api/round-ocr-test", { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RoundOcrResult;
      if (!json.ok) throw new Error(json.error ?? "OCR testi başarısız");
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
    setLocked(null);
    setFileName("sample-tft-round.png");
    try {
      // Randomize stage/round so the user can verify it actually reads different values.
      const stage = 1 + Math.floor(Math.random() * 6); // 1-6
      const round = 1 + Math.floor(Math.random() * 3); // 1-3
      const sampleRes = await fetch(`/api/round-ocr-sample?stage=${stage}&round=${round}&seed=${Date.now() % 1000}`, { cache: "no-store" });
      if (!sampleRes.ok) throw new Error(`HTTP ${sampleRes.status}`);
      const blob = await sampleRes.blob();
      const file = new File([blob], "sample-tft-round.png", { type: "image/png" });
      await runTest(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "örnek oluşturulamadı");
      setLoading(false);
    }
  }, [runTest]);

  return (
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Clock className="h-3.5 w-3.5" /> Round OCR test aracı
          <StepBadge step={2} label="PLAN 15.5" />
          {result?.tesseractAvailable === false && (
            <Badge variant="outline" className="ml-auto border-red-500/40 text-red-300 bg-red-500/10 text-[9px]">
              tesseract yok
            </Badge>
          )}
          {result?.tesseractAvailable && (
            <Badge variant="outline" className="ml-auto border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[9px]">
              tesseract OK
            </Badge>
          )}
        </CardDescription>
        <CardTitle className="text-base">Round OCR — hangi ayar çalışır?</CardTitle>
        <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
          TFT screenshot yükle (1920×1080 önerilir). 8 farklı koordinat / threshold / scale / PSM
          varyantı aynı anda denenir. Hangi varyantın round göstergesini (&quot;3-2&quot; gibi) doğru
          okuduğunu görüp &quot;bu çalıştı&quot; dediğinde o ayar kalıcı olur. <span className="text-zinc-400">PLAN 15.5 + 15.7.</span>
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
              ? "border-sky-400/60 bg-sky-500/5"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : <Upload className="h-4 w-4 text-zinc-400" />}
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
            <Sparkles className="mr-1.5 h-3 w-3 text-sky-300" />
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

        {result?.tesseractAvailable === false && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200/90 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">Tesseract binary bulunamadı.</span> Görsel işleme
              çalışır ama rakam okuma olmaz.
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Result: best variant banner */}
        {result && (
          <div className="space-y-3">
            <div
              className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${
                result.bestRound !== null
                  ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                  : "border-zinc-700 bg-zinc-800/40"
              }`}
            >
              {result.bestRound !== null ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-zinc-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-zinc-100">
                  {result.bestRound !== null ? (
                    <>Round okundu: <span className="text-sky-300 tabular-nums font-mono">{result.bestRound}</span></>
                  ) : (
                    "Hiçbir varyant round okuyamadı"
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">
                  {result.bestVariant ? (
                    <>En iyi varyant: <code className="text-zinc-300">{result.bestVariant}</code> · {result.imageWidth}×{result.imageHeight}</>
                  ) : (
                    "Koordinatlar / threshold yanlış olabilir. Raw OCR çıktılarına bak."
                  )}
                </div>
              </div>
              {result.bestRound !== null && (
                <Badge variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-500/10 text-[10px] font-mono">
                  <Clock className="mr-1 h-3 w-3" />{result.bestRound}
                </Badge>
              )}
            </div>

            {/* Variants grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {result.variants.map((v) => {
                const isBest = v.name === result.bestVariant && v.round !== null;
                const isLocked = locked === v.name;
                return (
                  <div
                    key={v.name}
                    className={`rounded-lg border overflow-hidden flex flex-col ${
                      isLocked
                        ? "border-sky-400/60 ring-1 ring-sky-400/40 bg-sky-500/[0.06]"
                        : isBest
                        ? "border-emerald-500/40 bg-emerald-500/[0.05]"
                        : "border-zinc-800 bg-zinc-900/40"
                    }`}
                  >
                    <div className="px-2.5 py-1.5 border-b border-zinc-800/80 flex items-center justify-between gap-1">
                      <code className="text-[10px] text-zinc-400 truncate">{v.name}</code>
                      {v.round !== null ? (
                        <Badge variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-500/10 text-[9px] px-1 h-4 font-mono tabular-nums">
                          {v.round}
                        </Badge>
                      ) : (
                        <span className="text-[9px] text-zinc-600">—</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-zinc-800/80">
                      <div className="bg-zinc-950 p-1">
                        <div className="text-[8px] uppercase tracking-wide text-zinc-600 mb-0.5">raw</div>
                        {v.rawCropB64 ? (
                          <img src={v.rawCropB64} alt={`raw ${v.name}`} className="w-full h-12 object-contain bg-black/50 rounded-sm" />
                        ) : (
                          <div className="w-full h-12 flex items-center justify-center text-[9px] text-zinc-700">yok</div>
                        )}
                      </div>
                      <div className="bg-zinc-950 p-1">
                        <div className="text-[8px] uppercase tracking-wide text-zinc-600 mb-0.5">processed</div>
                        {v.processedB64 ? (
                          <img src={v.processedB64} alt={`processed ${v.name}`} className="w-full h-12 object-contain bg-white/90 rounded-sm" />
                        ) : (
                          <div className="w-full h-12 flex items-center justify-center text-[9px] text-zinc-700">yok</div>
                        )}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 border-t border-zinc-800/80 flex-1 flex flex-col gap-1">
                      <div className="text-[9px] text-zinc-500">
                        raw OCR: <span className="text-zinc-300 font-mono">{v.rawOcr ? `"${v.rawOcr}"` : "(boş)"}</span>
                      </div>
                      {v.error && (
                        <div className="text-[9px] text-red-400/80 truncate" title={v.error}>err: {v.error}</div>
                      )}
                      <div className="mt-auto pt-1">
                        <Button
                          variant={isLocked ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLocked(isLocked ? null : v.name)}
                          className="h-6 w-full text-[10px] py-0"
                          disabled={v.round === null && !isLocked}
                        >
                          {isLocked ? (
                            <><CheckCircle2 className="mr-1 h-3 w-3" /> Kilitli</>
                          ) : (
                            <><Zap className="mr-1 h-3 w-3" /> Bu çalıştı</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {locked && (
              <div className="rounded-md border border-sky-500/40 bg-sky-500/[0.08] px-3 py-2 text-[11px] text-sky-200/90 flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-sky-300" />
                <div>
                  <span className="font-semibold">{locked}</span> kilitlendi. Bir sonraki adımda bu
                  ayar <code className="text-sky-300 mx-1">local_reader.py</code> &apos;de varsayılan
                  olarak ayarlanacak ve <code className="text-sky-300 mx-1">capture.py --use-local</code>
                  bu koordinatla round okuyacak.
                </div>
              </div>
            )}

            {/* Coordinates reference */}
            <details className="rounded-md border border-zinc-800/80 bg-zinc-900/40">
              <summary className="cursor-pointer select-none px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-300 flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                Koordinat referansı (1920×1080)
              </summary>
              <div className="px-3 pb-3 text-[10px] text-zinc-500 space-y-1 font-mono">
                <div>tft-ocr-bot (PLAN 15.5): (753, 10, 870, 34) — PSM7, "0123456789-", 3x</div>
                <div>wide (fallback): (740, 6, 890, 40)</div>
                <div className="text-zinc-600">Beyaz text tespiti: R&gt;thr &amp; G&gt;thr &amp; B&gt;thr → siyah text, beyaz bg</div>
                <div className="text-zinc-600">Sanity: stage 1-11, round 1-7</div>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
