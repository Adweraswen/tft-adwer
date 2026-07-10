"use client";

/**
 * Upload zone — drag & drop, paste, or file picker for a TFT screenshot.
 * Converts to base64 and POSTs to /api/snapshot.
 */

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, ClipboardPaste, Loader2, ImageIcon, X } from "lucide-react";

interface UploadZoneProps {
  onResult: (result: unknown) => void;
}

export function UploadZone({ onResult }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Sadece resim dosyası (PNG/JPG).");
        return;
      }
      setError(null);
      setLoading(true);

      // Read as data URL (base64)
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        try {
          const res = await fetch("/api/snapshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl, source: "manual" }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            setError((errBody as { error?: string }).error || `HTTP ${res.status}`);
            return;
          }
          const json = await res.json();
          if (!json.ok && json.error) {
            setError(json.error);
          }
          onResult(json);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Yükleme başarısız");
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError("Dosya okunamadı");
        setLoading(false);
      };
      reader.readAsDataURL(file);
    },
    [onResult]
  );

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            handleFile(new File([blob], "pasted.png", { type }));
            return;
          }
        }
      }
      setError("Pano'da resim yok. Önce ekran görüntüsü al (Win+Shift+S).");
    } catch {
      setError("Pano erişimi reddedildi. Dosya seçebilirsin.");
    }
  }, [handleFile]);

  return (
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Upload className="h-3.5 w-3.5" /> Manuel yükleme
        </CardDescription>
        <CardTitle className="text-base">Ekran görüntüsü yapıştır</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver
              ? "border-amber-500/60 bg-amber-500/5"
              : "border-zinc-700 bg-zinc-950/40"
          }`}
        >
          {preview ? (
            <div className="relative w-full">
              <img
                src={preview}
                alt="preview"
                className="mx-auto max-h-40 rounded-md border border-zinc-800"
              />
              <button
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
                className="absolute right-1 top-1 rounded-full bg-zinc-900/80 p-1 text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <ImageIcon className="mb-2 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">
                Sürükle bırak ya da{" "}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-amber-400 underline underline-offset-2"
                >
                  dosya seç
                </button>
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">PNG / JPG / WebP</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaste}
            disabled={loading}
            className="flex-1 border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:text-zinc-100"
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
            )}
            Panodan yapıştır
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <p className="text-[11px] text-zinc-600">
          İpucu: Oyundayken <kbd className="rounded bg-zinc-800 px-1">Win+Shift+S</kbd> ile ekran
          al, sonra buraya yapıştır. VLM ~3 saniyede analiz eder.
        </p>
      </CardContent>
    </Card>
  );
}
