"use client";

/**
 * Comp browser — browse all 25 meta comps with full details.
 * Filterable by tier, playstyle, difficulty; searchable by champion name.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, Swords, Target, TrendingUp, Users, Star, Flame, Zap, Shield, Activity, Crown, X, Layers } from "lucide-react";
import { COMPS, getChampion, DIFFICULTY_INFO, PLAYSTYLE_INFO, computeCompTraits, type Comp } from "@/lib/tft-data";

const TIER_FILTERS = ["ALL", "S", "A", "B"] as const;
type TierFilter = (typeof TIER_FILTERS)[number];

const PLAYSTYLE_FILTERS = ["ALL", "reroll", "rush8", "rush9", "standard"] as const;
type PlaystyleFilter = (typeof PLAYSTYLE_FILTERS)[number];

const DIFFICULTY_FILTERS = ["ALL", "Easy", "Medium", "Hard"] as const;
type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

export function CompBrowser() {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");
  const [playstyleFilter, setPlaystyleFilter] = useState<PlaystyleFilter>("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("ALL");
  const [selected, setSelected] = useState<Comp | null>(null);

  const filtered = useMemo(() => {
    return COMPS.filter((c) => {
      if (tierFilter !== "ALL" && c.tier !== tierFilter) return false;
      if (playstyleFilter !== "ALL" && c.playstyle !== playstyleFilter) return false;
      if (difficultyFilter !== "ALL" && c.difficulty !== difficultyFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.core.some((n) => n.toLowerCase().includes(q)) ||
        c.keyTraits.some((t) => t.toLowerCase().includes(q)) ||
        c.carry.toLowerCase().includes(q)
      );
    });
  }, [query, tierFilter, playstyleFilter, difficultyFilter]);

  const reset = () => {
    setTierFilter("ALL");
    setPlaystyleFilter("ALL");
    setDifficultyFilter("ALL");
    setQuery("");
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <Card className="tft-glass border-zinc-800/80">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Comp, şampiyon veya trait ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 bg-zinc-950/50 border-zinc-800 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
            <div className="flex gap-1">
              {TIER_FILTERS.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tierFilter === t ? "default" : "outline"}
                  onClick={() => setTierFilter(t)}
                  className={
                    tierFilter === t
                      ? "bg-zinc-200 text-zinc-950 hover:bg-zinc-300"
                      : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200"
                  }
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Playstyle
              </div>
              <div className="flex flex-wrap gap-1">
                {PLAYSTYLE_FILTERS.map((p) => {
                  const info = p === "ALL" ? null : PLAYSTYLE_INFO[p];
                  return (
                    <Button
                      key={p}
                      size="sm"
                      variant={playstyleFilter === p ? "default" : "outline"}
                      onClick={() => setPlaystyleFilter(p)}
                      className={`h-7 px-2 text-[11px] ${
                        playstyleFilter === p
                          ? "text-zinc-950 hover:opacity-90"
                          : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200"
                      }`}
                      style={playstyleFilter === p && info ? { backgroundColor: info.color } : undefined}
                    >
                      {info ? info.label : "Hepsi"}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Flame className="h-3 w-3" /> Zorluk
              </div>
              <div className="flex flex-wrap gap-1">
                {DIFFICULTY_FILTERS.map((d) => {
                  const info = d === "ALL" ? null : DIFFICULTY_INFO[d];
                  return (
                    <Button
                      key={d}
                      size="sm"
                      variant={difficultyFilter === d ? "default" : "outline"}
                      onClick={() => setDifficultyFilter(d)}
                      className={`h-7 px-2 text-[11px] ${
                        difficultyFilter === d
                          ? "text-zinc-950 hover:opacity-90"
                          : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200"
                      }`}
                      style={difficultyFilter === d && info ? { backgroundColor: info.color } : undefined}
                    >
                      {info ? info.label : "Hepsi"}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-800/60">
            <span>{filtered.length} / {COMPS.length} comp</span>
            {(tierFilter !== "ALL" || playstyleFilter !== "ALL" || difficultyFilter !== "ALL" || query) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] text-zinc-500 hover:text-zinc-300"
                onClick={reset}
              >
                Filtreleri temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <CompCard key={c.name} comp={c} onClick={() => setSelected(c)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="border-dashed border-zinc-700 tft-glass">
          <CardContent className="py-12 text-center text-sm text-zinc-500">
            Aramanla eşleşen comp yok.
          </CardContent>
        </Card>
      )}

      {selected && <CompDetail comp={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/**
 * Format playstyle badge text.
 * - reroll   → "Reroll 6"   (reroll level shown — it's the slow-roll target)
 * - rush8    → "Rush 8"    (level already in label, no extra L8)
 * - rush9    → "Rush 9"    (level already in label, no extra L9)
 * - standard → "Standard"  (no level suffix)
 */
function formatPlaystyleLabel(playstyle: Comp['playstyle'], rerollLevel: number): string {
  if (playstyle === 'reroll') return `Reroll ${rerollLevel}`;
  // rush8 / rush9 / standard — PLAYSTYLE_INFO.label already has the level where relevant.
  return PLAYSTYLE_INFO[playstyle].label;
}

function CompCard({ comp, onClick }: { comp: Comp; onClick: () => void }) {
  const tierColor =
    comp.tier === "S"
      ? "from-amber-500/20 to-orange-500/10 border-amber-500/30"
      : comp.tier === "A"
      ? "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30"
      : "from-zinc-800/40 to-zinc-900/20 border-zinc-700";

  const tierBadge =
    comp.tier === "S"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : comp.tier === "A"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : "bg-zinc-700/50 text-zinc-300 border-zinc-600";

  const playstyleInfo = PLAYSTYLE_INFO[comp.playstyle];
  const difficultyInfo = DIFFICULTY_INFO[comp.difficulty];

  const diffIcon =
    comp.difficulty === "Easy" ? <Shield className="h-3 w-3" /> :
    comp.difficulty === "Medium" ? <Activity className="h-3 w-3" /> :
    <Flame className="h-3 w-3" />;

  return (
    <Card
      className={`bg-gradient-to-br ${tierColor} hover:scale-[1.02] transition-transform cursor-pointer`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base leading-tight">{comp.name}</CardTitle>
          <Badge variant="outline" className={tierBadge}>
            {comp.tier}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <Crown className="h-3 w-3" /> {comp.carry}
          </span>
          <span
            className="px-2 py-1 rounded text-[11px] font-semibold"
            style={{ backgroundColor: `${playstyleInfo.color}22`, color: playstyleInfo.color }}
            title={playstyleInfo.desc}
          >
            {formatPlaystyleLabel(comp.playstyle, comp.rerollLevel)}
          </span>
          <span
            className="px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-0.5"
            style={{ backgroundColor: `${difficultyInfo.color}22`, color: difficultyInfo.color }}
            title={difficultyInfo.desc}
          >
            {diffIcon} {difficultyInfo.label}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {comp.keyTraits.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="bg-zinc-800/80 text-zinc-300 text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {comp.core.slice(0, 5).map((n) => {
            const ch = getChampion(n);
            return (
              <span key={n} className={`text-[10px] font-medium ${costColor(ch?.cost)}`}>
                {n}
                {ch && <span className="text-zinc-600 ml-0.5">{ch.cost}g</span>}
              </span>
            );
          })}
          {comp.core.length > 5 && (
            <span className="text-[10px] text-zinc-600">+{comp.core.length - 5}</span>
          )}
        </div>
        <Separator className="bg-zinc-800" />
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            %{comp.winRate} WR
          </span>
          <span>avg {comp.avgPlace}</span>
          <span>%{comp.pickRate} pick</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CompDetail({ comp, onClose }: { comp: Comp; onClose: () => void }) {
  const playstyleInfo = PLAYSTYLE_INFO[comp.playstyle];
  const difficultyInfo = DIFFICULTY_INFO[comp.difficulty];
  const traitInfos = useMemo(() => computeCompTraits(comp), [comp]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        className="bg-zinc-900 border-zinc-700 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                {comp.name}
                <Badge variant="outline" className="text-xs">
                  {comp.tier}
                </Badge>
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Swords className="h-3 w-3" /> {comp.carry}
                </span>
                <span
                  className="px-2 py-1 rounded text-[11px] font-semibold"
                  style={{ backgroundColor: `${playstyleInfo.color}22`, color: playstyleInfo.color }}
                  title={playstyleInfo.desc}
                >
                  {formatPlaystyleLabel(comp.playstyle, comp.rerollLevel)}
                </span>
                <span
                  className="px-2 py-1 rounded text-[11px] font-semibold"
                  style={{ backgroundColor: `${difficultyInfo.color}22`, color: difficultyInfo.color }}
                  title={difficultyInfo.desc}
                >
                  {difficultyInfo.label}
                </span>
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-500" aria-label="Kapat">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto tft-scroll">
            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5">Strateji</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{comp.strategy}</p>
              </div>

              <div>
                <h4 className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Core birimler
                  {comp.threeStarTargets.length > 0 && (
                    <span className="ml-auto normal-case text-[10px] text-amber-500/80 flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      <span className="ml-1">= 3-yıldız hedefi</span>
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {comp.core.map((n) => {
                    const ch = getChampion(n);
                    const isThreeStarTarget = comp.threeStarTargets.includes(n);
                    return (
                      <div
                        key={n}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                          isThreeStarTarget
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-zinc-800 bg-zinc-950/40"
                        }`}
                      >
                        <span className={`text-xs font-bold ${costColor(ch?.cost)}`}>
                          {ch?.cost ?? "?"}g
                        </span>
                        <span className="text-sm text-zinc-200 truncate">{n}</span>
                        {isThreeStarTarget && (
                          <span className="ml-auto flex items-center gap-px flex-shrink-0" title="3-yıldız hedefi">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          </span>
                        )}
                        {!isThreeStarTarget && ch && (
                          <span className="ml-auto text-[10px] text-zinc-600 flex-shrink-0">{ch.role}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5 flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Trait aktivasyonları
                  <span className="ml-1 text-[10px] normal-case text-zinc-600">
                    ({traitInfos.filter((t) => t.activeBreakpoint > 0).length}/{traitInfos.length} aktif)
                  </span>
                </h4>
                <div className="flex flex-wrap gap-1">
                  {traitInfos.map((info) => {
                    const isActive = info.activeBreakpoint > 0;
                    const maxBp = info.breakpoints[info.breakpoints.length - 1] ?? info.count;
                    const isMaxed = info.count >= maxBp;
                    // Breakpoint dots: one per breakpoint, filled if reached.
                    const dots = info.breakpoints.map((bp) => info.count >= bp);

                    const chipClass = isActive && info.isKeyTrait
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                      : isActive
                      ? "border-emerald-700/50 bg-emerald-900/15 text-emerald-100"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-500";

                    return (
                      <div
                        key={info.name}
                        className={`inline-flex items-center gap-2 rounded-md border px-2 py-1.5 ${chipClass}`}
                        title={[
                          info.isKeyTrait ? "Comp'ın ana traiti" : null,
                          info.isUnique ? "Unique trait" : info.category,
                          info.mechaTransformAssumed
                            ? "2 Mecha + 1 transformed Mighty Mech (transform 2x sayılır)"
                            : null,
                          info.requirement
                            ? `${info.requirement.type === 'augment' ? 'Augment' : 'Seçim'} gerekli: ${info.requirement.note}`
                            : null,
                          `Breakpoint'ler: ${info.breakpoints.join(', ')}`,
                        ].filter(Boolean).join(' · ')}
                      >
                        {info.isKeyTrait && (
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium leading-none">
                          {info.name}
                        </span>
                        {info.isUnique && (
                          <span className="text-[9px] font-semibold tracking-wide text-violet-400 leading-none px-0.5">
                            U
                          </span>
                        )}
                        {/* Breakpoint dots — one per breakpoint, filled if reached */}
                        <span className="flex items-center gap-0.5 leading-none">
                          {dots.map((reached, i) => (
                            <span
                              key={i}
                              className={`h-1.5 w-1.5 rounded-full ${
                                reached
                                  ? isActive && info.isKeyTrait
                                    ? "bg-amber-400"
                                    : "bg-emerald-500"
                                  : "bg-zinc-700"
                              }`}
                            />
                          ))}
                        </span>
                        <span className="text-[11px] tabular-nums font-mono leading-none opacity-90">
                          {info.count}{isMaxed ? '' : `/${info.nextBreakpoint ?? maxBp}`}
                          {info.mechaTransformAssumed && <span className="text-amber-400">★</span>}
                        </span>
                        {info.requirement && (
                          <Zap
                            className={`h-2.5 w-2.5 flex-shrink-0 ${
                              info.requirement.type === 'augment'
                                ? "text-orange-400"
                                : "text-sky-400"
                            }`}
                            fill="currentColor"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600 leading-relaxed">
                  <Star className="inline h-2.5 w-2.5 fill-amber-400 text-amber-400" /> ana trait ·
                  <Zap className="inline h-2.5 w-2.5 text-orange-400 ml-1" /> augment/seçim gerekir ·
                  noktalar breakpoint'leri gösterir
                </p>
              </div>

              {comp.traitBots.length > 0 && (
                <div>
                  <h4 className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Trait botları
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {comp.traitBots.map((n) => (
                      <Badge key={n} variant="outline" className="border-zinc-600 text-zinc-400">
                        {n}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Stats footer — always visible, outside scroll */}
          <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950/60 p-3">
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Win Rate" value={`%${comp.winRate}`} />
              <StatBox label="Avg Place" value={String(comp.avgPlace)} />
              <StatBox label="Pick Rate" value={`%${comp.pickRate}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-bold text-zinc-200 tabular-nums">{value}</div>
    </div>
  );
}

function costColor(cost?: number): string {
  switch (cost) {
    case 1:
      return "text-zinc-300";
    case 2:
      return "text-emerald-400";
    case 3:
      return "text-sky-400";
    case 4:
      return "text-violet-400";
    case 5:
      return "text-amber-400";
    default:
      return "text-zinc-400";
  }
}
