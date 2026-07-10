"use client";

/**
 * SettingsPanel — user preferences with localStorage persistence.
 *
 * Settings:
 *   - captureInterval (seconds): how often the Python capture client captures (info only, stored for display)
 *   - pollInterval (seconds): how often the web UI polls /api/state
 *   - theme: dark | light (visual hint; actual theme toggle is via next-themes if added later)
 *   - language: tr | en (UI display language hint — currently Turkish is default)
 *   - showVlmRaw: whether to show VLM raw output in detail modal by default
 *   - compactMode: denser card layout
 *
 * Settings are stored in localStorage under key "tft-adwer-settings".
 * A custom event "tft-settings-change" is dispatched on save so other components
 * can react (e.g. the live poller reads pollInterval).
 */

import { useEffect, useState } from "react";

/* eslint-disable react-hooks/set-state-in-effect -- data-fetching/settings-load effects need setState */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Clock,
  Palette,
  Languages,
  Eye,
  LayoutGrid,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";

export interface TFTSettings {
  pollInterval: number; // seconds (2–15)
  theme: "dark" | "light";
  language: "tr" | "en";
  showVlmRaw: boolean;
  compactMode: boolean;
  /** Auto page-reload interval in minutes. 0 = disabled. Helps recover from
   * stuck polling / zombie cron states by forcing a full page refresh. */
  autoReloadMin: number; // 0 (off) | 5 | 10 | 15 | 30
}

export const DEFAULT_SETTINGS: TFTSettings = {
  pollInterval: 4,
  theme: "dark",
  language: "tr",
  showVlmRaw: false,
  compactMode: false,
  autoReloadMin: 0,
};

const STORAGE_KEY = "tft-adwer-settings";

/** Validate and sanitize a raw settings object from localStorage. */
function sanitizeSettings(raw: unknown): TFTSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_SETTINGS;
  const s = raw as Record<string, unknown>;
  return {
    pollInterval: typeof s.pollInterval === "number" && s.pollInterval >= 2 && s.pollInterval <= 15
      ? s.pollInterval
      : DEFAULT_SETTINGS.pollInterval,
    theme: s.theme === "dark" || s.theme === "light" ? s.theme : DEFAULT_SETTINGS.theme,
    language: s.language === "tr" || s.language === "en" ? s.language : DEFAULT_SETTINGS.language,
    showVlmRaw: typeof s.showVlmRaw === "boolean" ? s.showVlmRaw : DEFAULT_SETTINGS.showVlmRaw,
    compactMode: typeof s.compactMode === "boolean" ? s.compactMode : DEFAULT_SETTINGS.compactMode,
    autoReloadMin: typeof s.autoReloadMin === "number" && [0, 5, 10, 15, 30].includes(s.autoReloadMin)
      ? s.autoReloadMin
      : DEFAULT_SETTINGS.autoReloadMin,
  };
}

export function loadSettings(): TFTSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return sanitizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: TFTSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("tft-settings-change", { detail: s }));
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<TFTSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Listen for external changes (e.g. other tabs)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TFTSettings>).detail;
      if (detail && typeof detail === "object" && "pollInterval" in detail) {
        setSettings(sanitizeSettings(detail));
      }
      setDirty(false);
    };
    window.addEventListener("tft-settings-change", handler);
    return () => window.removeEventListener("tft-settings-change", handler);
  }, []);

  const update = <K extends keyof TFTSettings>(key: K, value: TFTSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setDirty(true);
    setSaved(false);
  };

  return (
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-zinc-500">
            <SettingsIcon className="h-3.5 w-3.5" /> Tercihler
          </span>
          {saved && (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> kaydedildi
            </Badge>
          )}
        </CardDescription>
        <CardTitle className="text-base">Ayarlar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Poll interval */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm text-zinc-300">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              Canlı yenileme aralığı
            </Label>
            <Badge variant="outline" className="tabular-nums text-amber-300 border-amber-500/30 text-[10px]">
              {settings.pollInterval}s
            </Badge>
          </div>
          <Slider
            value={[settings.pollInterval]}
            onValueChange={(v) => update("pollInterval", v[0])}
            min={2}
            max={15}
            step={1}
            className="py-1"
          />
          <p className="text-[10px] text-zinc-600">
            Canlı modda {settings.pollInterval} saniyede bir güncellenir. Daha sık = daha güncel ama daha çok istek.
          </p>
        </div>

        {/* Auto-reload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm text-zinc-300">
              <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
              Otomatik sayfa yenileme
            </Label>
            <Badge variant="outline" className="tabular-nums text-sky-300 border-sky-500/30 text-[10px]">
              {settings.autoReloadMin === 0 ? "kapalı" : `${settings.autoReloadMin} dk`}
            </Badge>
          </div>
          <Select
            value={String(settings.autoReloadMin)}
            onValueChange={(v) => update("autoReloadMin", Number(v))}
          >
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="0" className="text-zinc-200 focus:bg-zinc-800">Kapalı</SelectItem>
              <SelectItem value="5" className="text-zinc-200 focus:bg-zinc-800">5 dakika</SelectItem>
              <SelectItem value="10" className="text-zinc-200 focus:bg-zinc-800">10 dakika</SelectItem>
              <SelectItem value="15" className="text-zinc-200 focus:bg-zinc-800">15 dakika</SelectItem>
              <SelectItem value="30" className="text-zinc-200 focus:bg-zinc-800">30 dakika</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-zinc-600">
            Belirli aralıklarla sayfayı tamamen yeniler. Cron/polling takılmasına karşı güvenlik ağı — "ctrl+R" gibi.
          </p>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Palette className="h-3.5 w-3.5 text-zinc-500" />
            Tema
          </Label>
          <Select value={settings.theme} onValueChange={(v) => update("theme", v as "dark" | "light")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="dark" className="text-zinc-200 focus:bg-zinc-800">🌙 Koyu (varsayılan)</SelectItem>
              <SelectItem value="light" className="text-zinc-200 focus:bg-zinc-800">☀️ Açık (yakında)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm text-zinc-300">
            <Languages className="h-3.5 w-3.5 text-zinc-500" />
            Dil
          </Label>
          <Select value={settings.language} onValueChange={(v) => update("language", v as "tr" | "en")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="tr" className="text-zinc-200 focus:bg-zinc-800">🇹🇷 Türkçe</SelectItem>
              <SelectItem value="en" className="text-zinc-200 focus:bg-zinc-800">🇬🇧 English (yakında)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-zinc-500" />
              <div>
                <div className="text-sm text-zinc-300">VLM ham çıktı</div>
                <div className="text-[10px] text-zinc-600">Detay modalında VLM yanıtını göster</div>
              </div>
            </div>
            <Switch checked={settings.showVlmRaw} onCheckedChange={(v) => update("showVlmRaw", v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5 text-zinc-500" />
              <div>
                <div className="text-sm text-zinc-300">Sıkı mod</div>
                <div className="text-[10px] text-zinc-600">Daha yoğun kart düzeni</div>
              </div>
            </div>
            <Switch checked={settings.compactMode} onCheckedChange={(v) => update("compactMode", v)} />
          </div>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2">
          <Info className="h-3.5 w-3.5 text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-sky-300/80 leading-relaxed">
            Ayarlar tarayıcında saklanır (localStorage). Capture client'ın yenileme aralığı script çalıştırırken
            <code className="mx-1 px-1 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono text-[10px]">--interval</code>
            parametresiyle ayrıca ayarlanır.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={!dirty}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-950 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
            size="sm"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Kaydet
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Sıfırla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
