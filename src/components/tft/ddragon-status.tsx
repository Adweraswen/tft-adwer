"use client";

/**
 * DDragonStatus — Data Dragon champion listesini gösteren status kartı.
 *
 * /api/ddragon-champions çağırır, Set 17 şampiyonlarını listeler. Item tanıma
 * için template matching'in ön koşulu (PLAN 15.5 step 5: Data Dragon indirici).
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { StepBadge } from "@/components/tft/ocr-test-section";

interface Champion {
  id: string;
  name: string;
  cost: number;
  iconUrl: string;
}

interface DDragonResponse {
  ok: boolean;
  version?: string;
  set?: number;
  count?: number;
  champions?: Champion[];
  error?: string;
}

const COST_COLORS: Record<number, string> = {
  1: "border-zinc-500 text-zinc-300 bg-zinc-500/10",
  2: "border-emerald-500 text-emerald-300 bg-emerald-500/10",
  3: "border-sky-500 text-sky-300 bg-sky-500/10",
  4: "border-purple-500 text-purple-300 bg-purple-500/10",
  5: "border-amber-500 text-amber-300 bg-amber-500/10",
};

export function DDragonStatus() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DDragonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchChampions = async (force: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ddragon-champions?set=17${force ? "&force=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DDragonResponse;
      if (!json.ok) throw new Error(json.error ?? "fetch başarısız");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChampions();
  }, []);

  return (
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Database className="h-3.5 w-3.5" /> Data Dragon — şampiyon listesi
          <StepBadge step={5} label="PLAN 15.5" />
          {data?.ok && (
            <Badge variant="outline" className="ml-auto border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[9px]">
              v{data.version?.split(".").slice(0, 2).join(".")}
            </Badge>
          )}
        </CardDescription>
        <CardTitle className="text-base">Data Dragon indirici</CardTitle>
        <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
          Riot CDN&apos;den Set 17 şampiyon listesi + ikon URL&apos;leri. Item/Board tanıma için
          template matching&apos;in ön koşulu. <span className="text-zinc-400">1 saat cache&apos;lenir.</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchChampions(true)}
            disabled={loading}
            className="h-8 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 text-xs"
          >
            {loading ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
            {loading ? "Yükleniyor…" : "Yenile (cache bypass)"}
          </Button>
          {data?.ok && (
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">
              {data.count} şampiyon · Set {data.set}
            </Badge>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {data?.ok && data.champions && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Data Dragon bağlantısı OK — v{data.version}
            </div>
            <div className="max-h-64 overflow-y-auto tft-scroll rounded-md border border-zinc-800 bg-zinc-900/40 p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {data.champions.slice(0, 60).map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 px-1.5 py-1">
                    <Badge variant="outline" className={`text-[8px] h-3.5 px-1 min-w-[14px] justify-center ${COST_COLORS[c.cost] ?? "border-zinc-700 text-zinc-500"}`}>
                      {c.cost}
                    </Badge>
                    <span className="text-[10px] text-zinc-300 truncate">{c.name}</span>
                  </div>
                ))}
              </div>
              {data.count > 60 && (
                <div className="text-center text-[10px] text-zinc-600 mt-2">
                  +{data.count - 60} daha…
                </div>
              )}
            </div>
            <div className="text-[10px] text-zinc-600">
              İkon URL&apos;leri: <code className="text-zinc-500">ddragon.../img/tft-champion/{"{id}.png"}</code> · template matching için <code className="text-zinc-500">/api/ddragon-icons?url=...</code> ile cache&apos;lenebilir.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
