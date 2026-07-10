"use client";

/**
 * OcrTestSection — styled wrapper that groups all OCR test tools (Gold, Round,
 * future Shop/Bench/Item) under a consistent header with step badges.
 *
 * Shows a roadmap progress strip so the user can see which OCR steps are done
 * vs. pending. Each tester gets a numbered step badge (Step 1, Step 2, ...).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanLine, CheckCircle2, Circle, Coins, Clock, GripHorizontal, ShoppingBag, Package, Database } from "lucide-react";
import type { ReactNode } from "react";

export interface OcrStep {
  id: number;
  name: string;
  icon: ReactNode;
  status: "done" | "active" | "pending";
  shortLabel: string;
}

const STEPS: OcrStep[] = [
  { id: 1, name: "Gold OCR", icon: <Coins className="h-3.5 w-3.5" />, status: "active", shortLabel: "Gold" },
  { id: 2, name: "Round OCR", icon: <Clock className="h-3.5 w-3.5" />, status: "active", shortLabel: "Round" },
  { id: 3, name: "Bench (CV)", icon: <GripHorizontal className="h-3.5 w-3.5" />, status: "active", shortLabel: "Bench" },
  { id: 4, name: "Shop OCR", icon: <ShoppingBag className="h-3.5 w-3.5" />, status: "active", shortLabel: "Shop" },
  { id: 5, name: "Data Dragon", icon: <Database className="h-3.5 w-3.5" />, status: "active", shortLabel: "DDragon" },
  { id: 6, name: "Item", icon: <Package className="h-3.5 w-3.5" />, status: "active", shortLabel: "Item" },
  { id: 7, name: "Board (ZOR)", icon: <ScanLine className="h-3.5 w-3.5" />, status: "pending", shortLabel: "Board" },
  { id: 8, name: "HP 8 oyuncu (ZOR)", icon: <ScanLine className="h-3.5 w-3.5" />, status: "pending", shortLabel: "HP" },
];

export function OcrTestSection({ children }: { children: ReactNode }) {
  return (
    <Card className="tft-glass border-zinc-800/80 overflow-hidden">
      <CardHeader className="pb-3 border-b border-zinc-800/60 bg-gradient-to-r from-amber-500/[0.04] via-transparent to-sky-500/[0.04]">
        <CardDescription className="flex items-center gap-1.5 text-zinc-400">
          <ScanLine className="h-3.5 w-3.5 text-amber-400" /> OCR Test Araçları
          <Badge variant="outline" className="ml-auto border-zinc-700 text-zinc-500 text-[9px]">
            PLAN 15.5
          </Badge>
        </CardDescription>
        <CardTitle className="text-base flex items-center gap-2">
          Ekran okuma pipeline'ı
          <span className="text-[11px] font-normal text-zinc-500">
            — her veri için ayrı test aracı
          </span>
        </CardTitle>

        {/* Roadmap progress strip */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto tft-scroll pb-1">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] border transition-colors ${
                  step.status === "done"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : step.status === "active"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-600"
                }`}
                title={step.name}
              >
                {step.status === "done" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <span className="font-medium">{step.id}.</span>
                <span>{step.shortLabel}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px w-3 bg-zinc-800 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-zinc-500 leading-relaxed mt-2">
          Kural 4 (<span className="text-zinc-400">Test Bende</span>): her veri için 8 farklı
          threshold/koordinat/scale ayarı aynı anda denenir. Sen &quot;bu çalıştı&quot; dediğin
          ayar kalıcı olur — TFT'yi 8 kez açmana gerek yok.
        </p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

/** Step badge — small numbered badge for individual tester cards. */
export function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[9px] gap-1"
    >
      <span className="font-bold">Adım {step}</span>
      <span className="text-zinc-500">·</span>
      <span className="text-zinc-400">{label}</span>
    </Badge>
  );
}
