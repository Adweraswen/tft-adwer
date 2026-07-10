"use client";

/**
 * ItemRecipeSheet — interactive TFT item recipe cheat sheet.
 *
 * Layout follows the same flat, naturally-expanding pattern as ChampionBrowser:
 * header + search, filter bar, components block, contextual panels, and a
 * grid of completed items that grows with the page (no internal card scroll).
 *
 * Data comes from src/lib/tft-data/items.ts (ITEMS array).
 */

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Swords, Search, X, Sparkles } from "lucide-react";
import { ITEMS, getItem } from "@/lib/tft-data";
import type { ItemCategory } from "@/lib/tft-data";

const COMPONENTS = ITEMS.filter((i) => i.component);
const COMPLETED = ITEMS.filter((i) => !i.component);

const CATEGORY_COLORS: Record<ItemCategory, { bg: string; text: string; border: string; dot: string }> = {
  AD: { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-500/30", dot: "bg-red-400" },
  AS: { bg: "bg-yellow-500/10", text: "text-yellow-300", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  AP: { bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-500/30", dot: "bg-violet-400" },
  Mana: { bg: "bg-sky-500/10", text: "text-sky-300", border: "border-sky-500/30", dot: "bg-sky-400" },
  Tank: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  Utility: { bg: "bg-zinc-500/10", text: "text-zinc-300", border: "border-zinc-500/30", dot: "bg-zinc-400" },
  Crit: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30", dot: "bg-amber-400" },
  Healing: { bg: "bg-pink-500/10", text: "text-pink-300", border: "border-pink-500/30", dot: "bg-pink-400" },
};

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  AD: "AD",
  AS: "AS",
  AP: "AP",
  Mana: "Mana",
  Tank: "Tank",
  Utility: "Util",
  Crit: "Crit",
  Healing: "Heal",
};

export function ItemRecipeSheet() {
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ItemCategory | "all">("all");

  // Items that match the selected component
  const itemsFromComponent = useMemo(() => {
    if (!selectedComp) return null;
    return COMPLETED.filter((i) => i.recipe?.includes(selectedComp));
  }, [selectedComp]);

  // Filtered completed items for the grid
  const visibleCompleted = useMemo(() => {
    let list = COMPLETED;
    if (filter !== "all") list = list.filter((i) => i.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, filter]);

  const categories = useMemo(() => {
    const set = new Set<ItemCategory>();
    COMPLETED.forEach((i) => set.add(i.category));
    return ["all", ...Array.from(set)] as const;
  }, []);

  const selectedItemData = selectedItem ? getItem(selectedItem) : null;

  const handleClickComponent = (name: string) => {
    setSelectedComp((prev) => (prev === name ? null : name));
    setSelectedItem(null);
  };

  const handleClickItem = (name: string) => {
    setSelectedItem((prev) => (prev === name ? null : name));
    setSelectedComp(null);
  };

  const clearAll = () => {
    setSearch("");
    setFilter("all");
    setSelectedComp(null);
    setSelectedItem(null);
  };

  const hasFilters = !!search || filter !== "all" || !!selectedComp || !!selectedItem;

  return (
    <div className="space-y-4">
      {/* Header + search — same pattern as ChampionBrowser */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
            <Swords className="h-5 w-5 text-amber-400" />
            Item reçeteleri
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            9 bileşeni 2&apos;şer kombinasyonla birleştir → {COMPLETED.length} tamamlanmış item ·{" "}
            <span className="text-zinc-400">{visibleCompleted.length} gösteriliyor</span>
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Item ara…"
            className="h-9 border-zinc-800 bg-zinc-900/60 pl-8 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter bar — category filters */}
      <div className="tft-glass flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800/80 p-2.5">
        <span className="mr-1 text-[10px] uppercase tracking-wider text-zinc-600">Kategori</span>
        {categories.map((c) => {
          const active = filter === c;
          return (
            <button
              key={c}
              onClick={() => setFilter(c as ItemCategory | "all")}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-all ${
                active
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {c !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[c as ItemCategory].dot}`} />}
              {c === "all" ? "Tümü" : CATEGORY_LABELS[c as ItemCategory]}
            </button>
          );
        })}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-auto h-7 px-2 text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            <X className="mr-1 h-3 w-3" />
            Temizle
          </Button>
        )}
      </div>

      {/* Components block — 9 base components */}
      <div className="tft-glass rounded-xl border border-zinc-800/80 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Bileşenler
          {selectedComp && (
            <span className="ml-1 text-amber-300 normal-case tracking-normal font-normal">
              · seçili: {selectedComp}
            </span>
          )}
          {selectedItemData?.recipe && (
            <span className="ml-1 text-emerald-300 normal-case tracking-normal font-normal">
              · reçete: {selectedItemData.recipe.join(" + ")}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {COMPONENTS.map((c) => {
            const isActive = selectedComp === c.name;
            const isRecipePart = selectedItemData?.recipe?.includes(c.name);
            return (
              <button
                key={c.name}
                onClick={() => handleClickComponent(c.name)}
                className={`group relative rounded-lg border px-2 py-2.5 text-center transition-all duration-200 hover:-translate-y-0.5 ${
                  isActive
                    ? "border-amber-500/60 bg-amber-500/15 scale-105"
                    : isRecipePart
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600 hover:bg-zinc-800/40"
                }`}
                title={c.desc}
              >
                <div
                  className={`text-xs font-medium leading-tight ${
                    isActive ? "text-amber-200" : isRecipePart ? "text-emerald-200" : "text-zinc-300"
                  }`}
                >
                  {c.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contextual panel: items containing the selected component */}
      {itemsFromComponent && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-semibold">{selectedComp}</span> içeren itemler
            <span className="text-amber-500/60">· {itemsFromComponent.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {itemsFromComponent.map((i) => {
              const cat = CATEGORY_COLORS[i.category];
              const isSelected = selectedItem === i.name;
              return (
                <button
                  key={i.name}
                  onClick={() => handleClickItem(i.name)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:scale-105 ${
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                      : `${cat.border} ${cat.bg} ${cat.text}`
                  }`}
                >
                  {i.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Contextual panel: selected item detail */}
      {selectedItemData && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              <Swords className="h-3.5 w-3.5" />
              {selectedItemData.name}
            </div>
            <Badge
              variant="outline"
              className={`${CATEGORY_COLORS[selectedItemData.category].border} ${CATEGORY_COLORS[selectedItemData.category].text} text-[10px]`}
            >
              {CATEGORY_LABELS[selectedItemData.category]}
            </Badge>
          </div>
          <p className="text-sm text-zinc-300 mb-2">{selectedItemData.desc}</p>
          {selectedItemData.recipe && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="text-zinc-600 uppercase tracking-wider text-[10px]">Reçete</span>
              {selectedItemData.recipe.map((r, idx) => (
                <span key={`${r}-${idx}`} className="flex items-center gap-2">
                  <button
                    onClick={() => handleClickComponent(r)}
                    className="rounded-md border border-emerald-500/30 bg-zinc-900/60 px-2 py-1 text-emerald-300 hover:bg-zinc-800 hover:border-emerald-500/50"
                  >
                    {r}
                  </button>
                  {idx < selectedItemData.recipe!.length - 1 && <span className="text-zinc-600">+</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Items grid — natural expanding, no internal scroll */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <Swords className="h-3.5 w-3.5 text-amber-400" /> Tamamlanmış itemler
          </div>
          <span className="text-[11px] text-zinc-600">{visibleCompleted.length} sonuç</span>
        </div>

        {visibleCompleted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-600">
            Sonuç yok.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visibleCompleted.map((item) => {
              const cat = CATEGORY_COLORS[item.category];
              const isSelected = selectedItem === item.name;
              const matchesComp = selectedComp && item.recipe?.includes(selectedComp);
              return (
                <button
                  key={item.name}
                  onClick={() => handleClickItem(item.name)}
                  className={`group relative flex flex-col gap-1 overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/10 shadow-emerald-900/30"
                      : matchesComp
                      ? `${cat.border} ${cat.bg}`
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600 hover:bg-zinc-800/30"
                  }`}
                >
                  {/* Top sheen — matches champion card polish */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <div className="flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200 truncate">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cat.dot}`} />
                      {item.name}
                    </span>
                    <span className={`text-[10px] font-medium ${cat.text} flex-shrink-0`}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-snug">{item.desc}</p>
                  {item.recipe && (
                    <div className="mt-auto pt-1 text-[10px] text-zinc-600 truncate">
                      {item.recipe.join(" + ")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
