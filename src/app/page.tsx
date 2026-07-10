"use client";

/**
 * TFT Adwer — main page.
 *
 * Tabs: Canlı (live) | Yükle (upload) | Geçmiş (history) | İstatistik (stats) | Items | Comps | Kurulum | Ayarlar
 *
 * v2: premium glassmorphism, threat-level meter, shop-odds display,
 * win-condition checklist, ambient gradient background, animated header.
 */

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  Upload as UploadIcon,
  History,
  Settings,
  RefreshCw,
  Radio,
  CircleDot,
  Zap,
  Github,
  Layers,
  TrendingUp,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Trash2,
  Download,
  Clock,
  Database,
  Brain,
  Camera,
  Lightbulb,
  Swords,
  SlidersHorizontal,
  Crown,
  Calculator as CalcIcon,
  Coins,
  Target,
} from "lucide-react";
import {
  StatBar,
  RoundActionsCard,
  EconomyCard,
  CompCard,
  ShopCard,
  CarriesCard,
  BoardCard,
  ItemsCard,
  StageCard,
  ThreatLevelCard,
  ShopOddsCard,
  WinConditionCard,
} from "@/components/tft/cards";
import { UploadZone } from "@/components/tft/upload-zone";
import { CaptureSetup } from "@/components/tft/capture-setup";
import { GoldOcrTester } from "@/components/tft/gold-ocr-tester";
import { CompBrowser } from "@/components/tft/comp-browser";
import { ChampionBrowser } from "@/components/tft/champion-browser";
import { Calculator } from "@/components/tft/calculator";
import { SnapshotDetail } from "@/components/tft/snapshot-detail";
import { StatsSummary } from "@/components/tft/stats-summary";
import { TrendChart } from "@/components/tft/trend-chart";
import { ItemRecipeSheet } from "@/components/tft/item-recipe-sheet";
import { BoardHexGrid } from "@/components/tft/board-hex-grid";
import { LiveCapture } from "@/components/tft/live-capture";
import { SettingsPanel, loadSettings, type TFTSettings } from "@/components/tft/settings-panel";
import type { FullRecommendation, GameState } from "@/lib/tft/state";
import { hpColor } from "@/lib/utils";

type Tab = "live" | "upload" | "history" | "stats" | "items" | "comps" | "champions" | "calc" | "setup" | "settings";

interface LiveState {
  state: GameState | null;
  recommendation: FullRecommendation | null;
  id: string | null;
  createdAt: string | null;
  ageMs: number | null;
  connected: boolean;
  hasSnapshot: boolean;
}

interface HistoryItem {
  id: string;
  createdAt: string;
  source: string;
  ok: boolean;
  level: number;
  gold: number;
  hp: number;
  stage: number;
  round: number;
  streak: number;
  errorMsg: string | null;
  oneLiner: string;
  economyAction: string;
  compName: string;
}

const EMPTY_LIVE: LiveState = {
  state: null,
  recommendation: null,
  id: null,
  createdAt: null,
  ageMs: null,
  connected: false,
  hasSnapshot: false,
};

// Polling interval — read from user settings (2–15 s), default 4 s.

export default function Home() {
  const [tab, setTab] = useState<Tab>("live");
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);
  const [tick, setTick] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  // Track document visibility — pause polling when the tab is hidden to avoid
  // wasting requests (and battery) while the user isn't looking at the page.
  const [docHidden, setDocHidden] = useState(false);
  // Auto-reload settings (loaded from localStorage). When autoReloadMin > 0,
  // the page does a full refresh every N minutes. This is a safety net against
  // stuck polling / zombie cron states — the user asked for "arada bi f5
  // attıracak bi komut" because crons sometimes get stuck.
  const [settings, setSettings] = useState<TFTSettings | null>(null);

  const fetchLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLive(json as LiveState);
      setLiveError(null);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "bağlantı hatası");
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
  }, [fetchLive, tick]);

  // Page Visibility — pause polling when the browser tab is hidden. The live
  // capture client posts snapshots to the server regardless; we just don't need
  // to fetch them every 4s while the user isn't watching.
  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Auto-poll ONLY when:
  //   - on the live tab,
  //   - autoPoll is enabled,
  //   - the document is visible (no point refreshing a hidden tab),
  //   - the current snapshot is a LIVE capture (manual uploads don't change —
  //     polling them every 4s is pure waste).
  const isLiveSource = live.state?.source === "live";
  useEffect(() => {
    if (!autoPoll || tab !== "live" || docHidden || !isLiveSource) return;
    const ms = (settings?.pollInterval ?? 4) * 1000;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [autoPoll, tab, docHidden, isLiveSource, settings?.pollInterval]);

  // Load settings once on mount + listen for changes (SettingsPanel dispatches
  // a "tft-settings-change" CustomEvent on save). We mainly need autoReloadMin
  // here; the SettingsPanel component manages its own internal editing state.
  useEffect(() => {
    setSettings(loadSettings());
    const handler = () => {
      // Re-read from localStorage (already sanitized by loadSettings)
      setSettings(loadSettings());
    };
    window.addEventListener("tft-settings-change", handler);
    return () => window.removeEventListener("tft-settings-change", handler);
  }, []);

  // Auto page-reload safety net. If autoReloadMin > 0, force a full page
  // refresh every N minutes. This recovers from stuck polling loops, zombie
  // VLM in-flight guards, or any other client-side state that wedged itself.
  // Only fires when the document is visible — no point reloading a hidden tab
  // (the browser already throttles timers, and we'd just burn a reload the
  // moment the user comes back).
  //
  // NOTE: Do NOT include `tick` in the dependency array. `tick` increments
  // every polling cycle (~4s), which would clear+reset the timer before it
  // ever fires (5 min minimum >> 4s). The timer should only reset when the
  // user actually changes the autoReloadMin setting.
  useEffect(() => {
    const min = settings?.autoReloadMin ?? 0;
    if (!min || min <= 0) return;
    const ms = min * 60 * 1000;
    let timerId: number | undefined;
    const schedule = () => {
      timerId = window.setTimeout(() => {
        if (!document.hidden) {
          window.location.reload();
        } else {
          // Tab still hidden — reschedule for another cycle.
          timerId = undefined;
          schedule();
        }
      }, ms);
    };
    schedule();
    return () => { if (timerId !== undefined) window.clearTimeout(timerId); };
  }, [settings?.autoReloadMin]);

  // Keyboard shortcuts: 1-9 + 0 to switch tabs (ignored when typing in inputs)
  const TAB_ORDER: Tab[] = ["live", "upload", "history", "stats", "items", "comps", "champions", "calc", "setup", "settings"];
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (key >= "1" && key <= "9") {
        const idx = parseInt(key, 10) - 1;
        if (idx < TAB_ORDER.length) setTab(TAB_ORDER[idx]);
      } else if (key === "0") {
        setTab(TAB_ORDER[9]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/snapshots?limit=100", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setHistory(json.snapshots ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory, tick]);

  const onUploadResult = useCallback(
    (result: unknown) => {
      const r = result as {
        state?: GameState;
        recommendation?: FullRecommendation;
        ok?: boolean;
        error?: string;
      };
      if (r && r.state && r.recommendation) {
        setLive({
          state: r.state,
          recommendation: r.recommendation,
          id: null,
          createdAt: new Date().toISOString(),
          ageMs: 0,
          connected: r.state.connected,
          hasSnapshot: true,
        });
        setTab("live");
      }
    },
    []
  );

  const clearHistory = useCallback(async () => {
    setClearing(true);
    try {
      await fetch("/api/snapshots", { method: "DELETE" });
      await fetchHistory();
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  }, [fetchHistory]);

  const exportData = useCallback(() => {
    window.open("/api/snapshots/export?limit=500", "_blank");
  }, []);

  const hasData = live.hasSnapshot && live.state && live.recommendation;

  return (
    <div className="tft-bg min-h-screen flex flex-col text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 text-zinc-950 font-black text-lg shadow-lg shadow-orange-500/30 ring-1 ring-white/10 tft-gradient-drift">
              T
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none tracking-tight">TFT Adwer</h1>
              <p className="text-[10px] text-zinc-500 leading-none mt-1">Canlı Danışman · Set 17</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <LiveBadge live={live} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTick((t) => t + 1)}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
              title="Yenile"
              aria-label="Yenile"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? "animate-spin" : ""}`} />
            </Button>
            <a
              href="https://github.com/Adweraswen/tft-adwer/tree/web-vlm"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block"
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
                aria-label="GitHub'da aç"
              >
                <Github className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="bg-zinc-900/60 border border-zinc-800/80 h-10 w-full justify-start overflow-x-auto tft-scroll backdrop-blur-sm">
            <TabsTrigger value="live" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Canlı</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <UploadIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Yükle</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Geçmiş</span>
              {history.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px] bg-zinc-700 text-zinc-300">
                  {history.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">İstatistik</span>
            </TabsTrigger>
            <TabsTrigger value="items" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <Swords className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Itemler</span>
            </TabsTrigger>
            <TabsTrigger value="comps" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Comps</span>
            </TabsTrigger>
            <TabsTrigger value="champions" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <Crown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Şampiyonlar</span>
            </TabsTrigger>
            <TabsTrigger value="calc" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <CalcIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hesapla</span>
            </TabsTrigger>
            <TabsTrigger value="setup" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kurulum</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ayarlar</span>
            </TabsTrigger>
          </TabsList>

          {/* LIVE TAB */}
          <TabsContent value="live" className="mt-4 space-y-4">
            {/* Yol A — tarayıcıdan canlı okuma (kurulum yok) */}
            <LiveCapture onSnapshot={fetchLive} />
            {!hasData ? (
              <EmptyState onGoSetup={() => setTab("setup")} onGoUpload={() => setTab("upload")} pollInterval={settings?.pollInterval ?? 4} />
            ) : (
              <>
                <LiveBanner
                  live={live}
                  autoPoll={autoPoll}
                  setAutoPoll={setAutoPoll}
                  paused={docHidden ? "hidden" : isLiveSource ? null : "manual"}
                  pollInterval={settings?.pollInterval ?? 4}
                />
                <StatBar state={live.state!} />
                <RoundActionsCard rec={live.recommendation!} state={live.state!} />
                {(live.state!.board.length > 0 || live.state!.bench.length > 0) && (
                  <BoardHexGrid
                    board={live.state!.board}
                    bench={live.state!.bench}
                    level={live.state!.level}
                  />
                )}

                {/* Advanced options — detailed cards, collapsed by default */}
                <details className="tft-glass group rounded-2xl border border-zinc-800/80 overflow-hidden">
                  <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between hover:bg-zinc-800/40 transition-colors">
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm font-medium text-zinc-300">Gelişmiş seçenekler</span>
                      <span className="text-[10px] text-zinc-600">ekonomi, comp, shop, board, item, stage</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 space-y-4 border-t border-zinc-800/60">
                {/* Section: Economy & Decision */}
                <SectionHeader
                  icon={<Coins className="h-4 w-4" />}
                  title="Ekonomi & Karar"
                  subtitle="Altın yönetimi, tehdit seviyesi ve kazanma koşulu"
                  accent="amber"
                />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <EconomyCard econ={live.recommendation!.economy} />
                  <ThreatLevelCard state={live.state!} board={live.recommendation!.board} />
                  <WinConditionCard comp={live.recommendation!.comp} state={live.state!} board={live.recommendation!.board} />
                </div>

                {/* Section: Comp & Shop */}
                <SectionHeader
                  icon={<Target className="h-4 w-4" />}
                  title="Comp & Shop"
                  subtitle="Hedef kompozisyon ve shop satın alma önerileri"
                  accent="violet"
                />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <CompCard comp={live.recommendation!.comp} state={live.state!} />
                  <ShopCard
                    shop={live.recommendation!.shop}
                    reroll={live.recommendation!.reroll}
                    state={live.state!}
                  />
                  <ShopOddsCard level={live.state!.level} />
                  <CarriesCard carries={live.recommendation!.carries} />
                  {live.recommendation!.augment &&
                    live.recommendation!.augment.length > 0 && (
                      <AugmentCardInline augments={live.recommendation!.augment} />
                    )}
                </div>

                {/* Section: Board & Items */}
                <SectionHeader
                  icon={<Swords className="h-4 w-4" />}
                  title="Board & Itemler"
                  subtitle="Aktif traitler, taşır hedefleri ve item önerileri"
                  accent="emerald"
                />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <BoardCard board={live.recommendation!.board} />
                  <ItemsCard items={live.recommendation!.items} />
                </div>

                {/* Section: Game Flow */}
                <SectionHeader
                  icon={<Clock className="h-4 w-4" />}
                  title="Oyun Akışı"
                  subtitle="Stage bilgisi, yaklaşan eventler ve öncelikli aksiyon"
                  accent="sky"
                />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <StageCard stage={live.recommendation!.stage} />
                </div>
                  </div>
                </details>
                {liveError && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                    {liveError}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* UPLOAD TAB */}
          <TabsContent value="upload" className="mt-4">
            <div className="max-w-xl">
              <UploadZone onResult={onUploadResult} />
            </div>
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="mt-4">
            <Card className="tft-glass border-zinc-800/80 overflow-hidden">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <History className="h-3.5 w-3.5" /> Snapshot geçmişi
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exportData}
                      disabled={history.length === 0}
                      className="h-6 px-2 text-[11px] text-zinc-500 hover:text-zinc-300"
                      title="JSON olarak indir"
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Dışa aktar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={history.length === 0 || clearing}
                          className="h-6 px-2 text-[11px] text-zinc-500 hover:text-red-300"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {clearing ? "Siliniyor…" : "Temizle"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-900 border-zinc-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Geçmişi temizle?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            Tüm {history.length} snapshot kalıcı olarak silinecek. Bu işlem geri alınamaz.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">
                            Vazgeç
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={clearHistory}
                            className="bg-red-600 hover:bg-red-500 text-white"
                          >
                            Sil
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchHistory}
                      className="h-6 px-2 text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      <RefreshCw className={`mr-1 h-3 w-3 ${historyLoading ? "animate-spin" : ""}`} />
                      Yenile
                    </Button>
                  </div>
                </CardDescription>
                <CardTitle className="text-base flex items-center gap-2">
                  {history.length > 0 ? `${history.length} kayıt` : "Henüz kayıt yok"}
                  {history.length > 0 && (
                    <span className="text-[10px] font-normal text-zinc-600">
                      · {history.filter((h) => h.source === "live").length} live · {history.filter((h) => h.source === "manual").length} manuel
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[calc(100vh-360px)] min-h-[120px] overflow-y-auto tft-scroll">
                {historyLoading ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-zinc-900 text-[11px] uppercase tracking-wide text-zinc-500 z-10">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Zaman</th>
                          <th className="px-3 py-2.5 text-left">Kaynak</th>
                          <th className="px-3 py-2.5 text-right">HP</th>
                          <th className="px-3 py-2.5 text-right">Gold</th>
                          <th className="px-3 py-2.5 text-right">Lvl</th>
                          <th className="px-3 py-2.5 text-left">Stage</th>
                          <th className="px-3 py-2.5 text-center">Streak</th>
                          <th className="px-3 py-2.5 text-left">Comp</th>
                          <th className="px-3 py-2.5 text-left">Durum</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <tr key={i} className="border-t border-zinc-800/80">
                            <td className="px-3 py-2.5"><div className="h-3 w-16 rounded bg-zinc-800 animate-pulse" /></td>
                            <td className="px-3 py-2.5"><div className="h-4 w-12 rounded bg-zinc-800 animate-pulse" /></td>
                            <td className="px-3 py-2.5"><div className="h-3 w-6 rounded bg-zinc-800/60 animate-pulse ml-auto" /></td>
                            <td className="px-3 py-2.5"><div className="h-3 w-6 rounded bg-zinc-800/60 animate-pulse ml-auto" /></td>
                            <td className="px-3 py-2.5"><div className="h-3 w-4 rounded bg-zinc-800/60 animate-pulse ml-auto" /></td>
                            <td className="px-3 py-2.5"><div className="h-3 w-8 rounded bg-zinc-800/60 animate-pulse" /></td>
                            <td className="px-3 py-2.5"><div className="h-3 w-6 rounded bg-zinc-800/60 animate-pulse mx-auto" /></td>
                            <td className="px-3 py-2.5"><div className="h-3 w-20 rounded bg-zinc-800/60 animate-pulse" /></td>
                            <td className="px-3 py-2.5"><div className="h-3 w-8 rounded bg-zinc-800/60 animate-pulse" /></td>
                            <td className="px-3 py-2.5"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    Henüz kayıt yok. Canlı mod veya manuel yükleme ile snapshot oluştur.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-zinc-900 text-[11px] uppercase tracking-wide text-zinc-500 z-10">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Zaman</th>
                          <th className="px-3 py-2.5 text-left">Kaynak</th>
                          <th className="px-3 py-2.5 text-right">HP</th>
                          <th className="px-3 py-2.5 text-right">Gold</th>
                          <th className="px-3 py-2.5 text-right">Lvl</th>
                          <th className="px-3 py-2.5 text-left">Stage</th>
                          <th className="px-3 py-2.5 text-center">Streak</th>
                          <th className="px-3 py-2.5 text-left">Comp</th>
                          <th className="px-3 py-2.5 text-left">Durum</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr
                            key={h.id}
                            className="border-t border-zinc-800/80 hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                            onClick={() => setDetailId(h.id)}
                          >
                            <td className="px-3 py-2 text-zinc-400 tabular-nums whitespace-nowrap">
                              <div>{new Date(h.createdAt).toLocaleTimeString("tr-TR")}</div>
                              <div className="text-[9px] text-zinc-600">
                                {new Date(h.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="outline"
                                className={
                                  h.source === "live"
                                    ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]"
                                    : "border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]"
                                }
                              >
                                {h.source}
                              </Badge>
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums font-medium ${hpColor(h.hp)}`}>
                              {h.hp}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-amber-300 font-medium">
                              {h.gold}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-violet-300 font-medium">
                              {h.level}
                            </td>
                            <td className="px-3 py-2 text-zinc-300 font-mono text-xs">
                              {h.stage}-{h.round}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {h.streak > 0 ? (
                                <span className="text-orange-400 text-xs font-medium">+{h.streak}W</span>
                              ) : h.streak < 0 ? (
                                <span className="text-sky-400 text-xs font-medium">{h.streak}L</span>
                              ) : (
                                <span className="text-zinc-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-400 text-xs max-w-[120px] truncate" title={h.compName}>
                              {h.compName || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {h.ok ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ok
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-red-400 text-xs"
                                  title={h.errorMsg ?? ""}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> hata
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-600 group-hover:text-zinc-300 transition-colors">
                              <ChevronRight className="h-3.5 w-3.5" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
            {history.length > 0 && (
              <p className="text-center text-[11px] text-zinc-600">
                Detayları görmek için bir satıra tıkla · {history.length} kayıt gösteriliyor
              </p>
            )}
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-200">İstatistikler</h2>
                <p className="text-xs text-zinc-500">Oturum özeti — HP, gold, level ve comp eğilimleri</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTick((t) => t + 1)}
                className="h-8 px-2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <RefreshCw className="mr-1.5 h-3 w-3" /> Yenile
              </Button>
            </div>
            <StatsSummary tick={tick} />
            <TrendChart tick={tick} />
          </TabsContent>

          {/* ITEMS TAB */}
          <TabsContent value="items" className="mt-4">
            <ItemRecipeSheet />
          </TabsContent>

          {/* COMPS TAB */}
          <TabsContent value="comps" className="mt-4">
            <CompBrowser />
          </TabsContent>

          {/* CHAMPIONS TAB */}
          <TabsContent value="champions" className="mt-4">
            <ChampionBrowser />
          </TabsContent>

          {/* CALCULATOR TAB */}
          <TabsContent value="calc" className="mt-4">
            <Calculator />
          </TabsContent>

          {/* SETUP TAB */}
          <TabsContent value="setup" className="mt-4 space-y-4">
            <div className="max-w-xl">
              <CaptureSetup />
            </div>
            <GoldOcrTester />
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="mt-4">
            <div className="max-w-xl">
              <SettingsPanel />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-[11px] text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            TFT Adwer · VLM tabanlı · Set 17
          </span>
          <span className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1" title="1-9 ve 0 tuşlarıyla sekmeler arası geç">
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-400">1-0</kbd>
              <span className="text-zinc-600">sekme</span>
            </span>
            <span className="text-zinc-700">·</span>
            <a
              href="https://github.com/Adweraswen/tft-adwer/tree/web-vlm"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 underline underline-offset-2"
            >
              web-vlm branch
            </a>
            <span className="text-zinc-700">·</span>
            <span>Sadece okur, oyuna müdahale etmez</span>
          </span>
        </div>
      </footer>

      {/* Snapshot detail modal */}
      <SnapshotDetail id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const SECTION_ACCENTS: Record<string, { text: string; icon: string; line: string }> = {
  amber: { text: "text-amber-400", icon: "bg-amber-500/15 text-amber-400", line: "bg-amber-500/20" },
  violet: { text: "text-violet-400", icon: "bg-violet-500/15 text-violet-400", line: "bg-violet-500/20" },
  emerald: { text: "text-emerald-400", icon: "bg-emerald-500/15 text-emerald-400", line: "bg-emerald-500/20" },
  sky: { text: "text-sky-400", icon: "bg-sky-500/15 text-sky-400", line: "bg-sky-500/20" },
};

function SectionHeader({
  icon,
  title,
  subtitle,
  accent = "amber",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: "amber" | "violet" | "emerald" | "sky";
}) {
  const a = SECTION_ACCENTS[accent] ?? SECTION_ACCENTS.amber;
  return (
    <div className="tft-fade-up mt-6 mb-1 flex items-center gap-3 first:mt-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-white/5 ${a.icon}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className={`text-sm font-semibold ${a.text}`}>{title}</h3>
        <p className="text-[11px] text-zinc-500 leading-tight">{subtitle}</p>
      </div>
      <div className={`hidden sm:block h-px flex-1 max-w-[200px] ${a.line}`} />
    </div>
  );
}

function LiveBadge({
  live,
}: {
  live: LiveState;
}) {
  if (!live.hasSnapshot) {
    return (
      <Badge variant="outline" className="border-zinc-700 text-zinc-500">
        <CircleDot className="mr-1 h-3 w-3" /> bekleniyor
      </Badge>
    );
  }
  if (live.state?.source === "live") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 tft-pulse-ring">
        <Radio className="mr-1 h-3 w-3 animate-pulse" /> LIVE
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10">
      <Zap className="mr-1 h-3 w-3" /> MANUEL
    </Badge>
  );
}

function LiveBanner({
  live,
  autoPoll,
  setAutoPoll,
  paused,
  pollInterval,
}: {
  live: LiveState;
  autoPoll: boolean;
  setAutoPoll: (v: boolean) => void;
  /** Why polling is currently paused (null = polling actively). */
  paused: "hidden" | "manual" | null;
  pollInterval: number;
}) {
  const ageSec = live.ageMs ? Math.floor(live.ageMs / 1000) : null;
  const ageLabel =
    ageSec === null
      ? ""
      : ageSec < 60
      ? `${ageSec}s önce`
      : `${Math.floor(ageSec / 60)}d ${ageSec % 60}s önce`;
  return (
    <div className="tft-glass flex items-center justify-between rounded-xl border border-zinc-800/80 px-3 py-2 text-xs flex-wrap gap-2">
      <div className="flex items-center gap-3 text-zinc-400">
        <span className="font-mono tabular-nums flex items-center gap-1">
          <Clock className="h-3 w-3 text-zinc-600" />
          {live.createdAt
            ? new Date(live.createdAt).toLocaleTimeString("tr-TR")
            : "—"}
        </span>
        {ageLabel && <span className="text-zinc-600">· {ageLabel}</span>}
        {live.state?.source === "live" && paused === null && (
          <span className="flex items-center gap-1 text-emerald-400/80">
            <TrendingUp className="h-3 w-3" /> canlı akış aktif
          </span>
        )}
        {live.state?.source === "live" && paused === "hidden" && (
          <span className="flex items-center gap-1 text-zinc-500" title="Sekme gizliyken polling duraklatıldı">
            <CircleDot className="h-3 w-3" /> duraklatıldı (sekme gizli)
          </span>
        )}
        {live.state?.source === "manual" && (
          <span className="flex items-center gap-1 text-amber-400/80">
            <Zap className="h-3 w-3" /> manuel yükleme
          </span>
        )}
      </div>
      {live.state?.source === "live" && (
        <label className="flex items-center gap-2 cursor-pointer text-zinc-400 select-none">
          <Switch
            checked={autoPoll}
            onCheckedChange={setAutoPoll}
            className="scale-90 origin-right data-[state=checked]:bg-emerald-500"
            aria-label="Otomatik yenilemeyi aç/kapat"
          />
          <span className="text-[11px]">otomatik yenile ({pollInterval}s)</span>
        </label>
      )}
    </div>
  );
}

function EmptyState({
  onGoSetup,
  onGoUpload,
  pollInterval,
}: {
  onGoSetup: () => void;
  onGoUpload: () => void;
  pollInterval: number;
}) {
  return (
    <Card className="tft-glass border-dashed border-zinc-700/80">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-red-500/20 ring-1 ring-zinc-700/50">
            <Brain className="h-12 w-12 text-amber-400/80" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </span>
        </div>
        <h2 className="text-xl font-semibold text-zinc-200">Henüz veri yok</h2>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-500 leading-relaxed">
          Canlı mod için PC'nde capture client'ı çalıştır. Ya da manuel olarak ekran görüntüsü yükle.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Button
            onClick={onGoSetup}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-950 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-orange-500/20"
          >
            <Settings className="mr-1.5 h-4 w-4" />
            Canlı kurulum
          </Button>
          <Button
            variant="outline"
            onClick={onGoUpload}
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          >
            <UploadIcon className="mr-1.5 h-4 w-4" />
            Manuel yükle
          </Button>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-8 text-center">
          <FeatureHint icon={<Camera className="h-6 w-6 text-zinc-500" />} title="Ekran yakala" desc="Win+Shift+S ile" />
          <FeatureHint icon={<Brain className="h-6 w-6 text-amber-500/70" />} title="VLM analiz" desc="~3 saniyede" />
          <FeatureHint icon={<Lightbulb className="h-6 w-6 text-amber-500/70" />} title="Öneri al" desc="Ekonomi · Comp · Shop" />
        </div>

        {/* Info cards */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
          <InfoCard
            icon={<Database className="h-4 w-4 text-violet-400" />}
            title="61 şampiyon"
            desc="Set 17 verileri"
          />
          <InfoCard
            icon={<Layers className="h-4 w-4 text-amber-400" />}
            title="12 meta comp"
            desc="S/A/B tier"
          />
          <InfoCard
            icon={<Zap className="h-4 w-4 text-emerald-400" />}
            title="Gerçek zamanlı"
            desc={`${pollInterval}sn yenileme`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureHint({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {icon}
      <span className="text-xs font-medium text-zinc-400">{title}</span>
      <span className="text-[10px] text-zinc-600">{desc}</span>
    </div>
  );
}

function InfoCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800/60">
        {icon}
      </div>
      <div className="text-left">
        <div className="text-xs font-medium text-zinc-300">{title}</div>
        <div className="text-[10px] text-zinc-600">{desc}</div>
      </div>
    </div>
  );
}

function AugmentCardInline({
  augments,
}: {
  augments: NonNullable<FullRecommendation["augment"]>;
}) {
  return (
    <Card className="tft-glass tft-fade-up border-zinc-800/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/30" style={{ animationDelay: "720ms" }}>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Zap className="h-3.5 w-3.5" /> Augmentlar
        </CardDescription>
        <CardTitle className="text-base">Seçili augmentlar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {augments.map((a, i) => {
          const isUnknown = a.tier === "?";
          return (
            <div
              key={i}
              className={`rounded-lg border px-2.5 py-1.5 transition-all hover:scale-[1.01] ${
                isUnknown
                  ? "border-zinc-800/80 bg-zinc-950/40"
                  : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-200">{a.name}</span>
                <Badge
                  variant="outline"
                  className={
                    isUnknown
                      ? "border-zinc-700 text-zinc-500 text-[10px]"
                      : a.tier === "S" || a.tier === "S-"
                      ? "border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]"
                      : "border-zinc-700 text-zinc-400 text-[10px]"
                  }
                >
                  {a.tier}
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-500">
                {isUnknown ? "Veritabanında yok — genel değerlendirme." : a.reasoning}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
