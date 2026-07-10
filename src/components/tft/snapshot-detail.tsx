"use client";

/**
 * Snapshot detail — modal showing the full recommendation for a past snapshot.
 * Fetches /api/snapshot/[id] on open.
 *
 * Includes a one-shot retry because Turbopack dev server returns 404 on the
 * first hit to a dynamic route (lazy compilation). The retry waits 1.2s and
 * tries again, which is enough for the route to compile.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Loader2, AlertCircle, Download } from "lucide-react";
import {
  StatBar,
  OneLiner,
  EconomyCard,
  CompCard,
  ShopCard,
  CarriesCard,
  BoardCard,
  ItemsCard,
  StageCard,
} from "./cards";
import type { FullRecommendation, GameState } from "@/lib/tft/state";

interface SnapshotDetailProps {
  id: string | null;
  onClose: () => void;
}

interface DetailData {
  id: string;
  createdAt: string;
  source: string;
  state: GameState;
  recommendation: FullRecommendation | null;
  ok: boolean;
  errorMsg: string | null;
  vlmRaw: string | null;
}

export function SnapshotDetail({ id, onClose }: SnapshotDetailProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchDetail(attempt: number) {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/snapshot/${id}`, { cache: "no-store" });
        if (!r.ok) {
          // Turbopack returns 404 on first hit for dynamic routes (lazy compile).
          // Retry once after a short delay.
          if (attempt === 0 && r.status === 404) {
            retryTimer = setTimeout(() => fetchDetail(1), 1200);
            return;
          }
          throw new Error(`HTTP ${r.status}`);
        }
        const d = (await r.json()) as DetailData;
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "bilinmeyen hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDetail(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [id]);

  if (!id) return null;

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot-${data.id.slice(-8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <Card
        className="bg-zinc-900 border-zinc-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-3 border-b border-zinc-800 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Snapshot detayı
            {data && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {data.id.slice(-8)}
              </Badge>
            )}
            {data && (
              <Badge
                variant="outline"
                className={
                  data.source === "live"
                    ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]"
                    : "border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]"
                }
              >
                {data.source}
              </Badge>
            )}
            {data && (
              <span className="text-xs text-zinc-500 font-normal">
                {new Date(data.createdAt).toLocaleString("tr-TR")}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {data && (
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadJson}
                className="text-zinc-500 hover:text-zinc-300 h-7 w-7 p-0"
                title="JSON indir"
                aria-label="JSON indir"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-500 hover:text-zinc-100 h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              <p className="text-xs text-zinc-600">Yükleniyor…</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <p className="text-xs text-zinc-600">Snapshot bulunamadı veya silinmiş olabilir.</p>
            </div>
          )}
          {data && data.recommendation && (
            <ScrollArea className="h-full max-h-[calc(90vh-80px)]">
              <div className="p-4 space-y-4">
                <StatBar state={data.state} />
                <OneLiner rec={data.recommendation} />
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <EconomyCard econ={data.recommendation.economy} />
                  <CompCard comp={data.recommendation.comp} state={data.state} />
                  <ShopCard
                    shop={data.recommendation.shop}
                    reroll={data.recommendation.reroll}
                    state={data.state}
                  />
                  <CarriesCard carries={data.recommendation.carries} />
                  <BoardCard board={data.recommendation.board} />
                  <ItemsCard items={data.recommendation.items} />
                  <StageCard stage={data.recommendation.stage} />
                </div>
                {data.vlmRaw && (
                  <>
                    <Separator className="bg-zinc-800" />
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 select-none">
                        VLM ham çıktı (göster/gizle)
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 text-[10px] text-zinc-400 whitespace-pre-wrap break-words">
                        {data.vlmRaw}
                      </pre>
                    </details>
                  </>
                )}
                {data.errorMsg && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                    <span className="font-medium">VLM hatası:</span> {data.errorMsg}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
