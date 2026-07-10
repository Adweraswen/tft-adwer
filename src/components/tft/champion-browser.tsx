"use client";

/**
 * Champion Browser — browse all 61 Set 17 champions.
 *
 * Features:
 *   - Live search by name
 *   - Filter by cost (1-5), role (carry/tank/support/flex), and trait
 *   - Click a champion card to expand full details (ability, BIS items, traits)
 *   - Cost-colored borders matching TFT's actual tier colors
 *
 * Styling: glassmorphism grid with staggered fade-in, hover lift, glow on select.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Swords,
  Shield,
  Sparkles,
  Layers,
  X,
  Star,
  Crown,
  Heart,
  Zap,
} from "lucide-react";
import { CHAMPIONS, TRAITS, COMPS, type Champion, type ChampionRole } from "@/lib/tft-data";

// ─── Cost → color mapping (matches TFT's actual tier colors) ────────────────

const COST_THEME: Record<
  number,
  { border: string; glow: string; text: string; bg: string; ring: string; label: string }
> = {
  1: {
    border: "border-zinc-600/60",
    glow: "shadow-zinc-900/40",
    text: "text-zinc-300",
    bg: "from-zinc-700/20 to-zinc-800/20",
    ring: "ring-zinc-500/30",
    label: "1g",
  },
  2: {
    border: "border-emerald-600/50",
    glow: "shadow-emerald-900/30",
    text: "text-emerald-300",
    bg: "from-emerald-700/15 to-emerald-800/10",
    ring: "ring-emerald-500/30",
    label: "2g",
  },
  3: {
    border: "border-sky-600/50",
    glow: "shadow-sky-900/30",
    text: "text-sky-300",
    bg: "from-sky-700/15 to-sky-800/10",
    ring: "ring-sky-500/30",
    label: "3g",
  },
  4: {
    border: "border-violet-600/50",
    glow: "shadow-violet-900/30",
    text: "text-violet-300",
    bg: "from-violet-700/15 to-violet-800/10",
    ring: "ring-violet-500/30",
    label: "4g",
  },
  5: {
    border: "border-amber-500/60",
    glow: "shadow-amber-900/40",
    text: "text-amber-300",
    bg: "from-amber-600/15 to-orange-700/10",
    ring: "ring-amber-400/40",
    label: "5g",
  },
};

const ROLE_THEME: Record<ChampionRole, { icon: typeof Swords; color: string; label: string }> = {
  carry: { icon: Swords, color: "text-red-400", label: "Carry" },
  tank: { icon: Shield, color: "text-sky-400", label: "Tank" },
  support: { icon: Sparkles, color: "text-violet-400", label: "Support" },
  flex: { icon: Layers, color: "text-amber-400", label: "Flex" },
};

// Build a sorted, unique list of all trait names for the filter dropdown
const ALL_TRAITS = Array.from(new Set(CHAMPIONS.flatMap((c) => c.traits))).sort();

export function ChampionBrowser() {
  const [query, setQuery] = useState("");
  const [costFilter, setCostFilter] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<ChampionRole | null>(null);
  const [traitFilter, setTraitFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Champion | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CHAMPIONS.filter((c) => {
      if (costFilter !== null && c.cost !== costFilter) return false;
      if (roleFilter !== null && c.role !== roleFilter) return false;
      if (traitFilter !== null && !c.traits.includes(traitFilter)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.ability.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [query, costFilter, roleFilter, traitFilter]);

  const clearFilters = () => {
    setCostFilter(null);
    setRoleFilter(null);
    setTraitFilter(null);
    setQuery("");
  };

  const hasFilters = costFilter !== null || roleFilter !== null || traitFilter !== null || query !== "";

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            Şampiyonlar
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Set 17 · {CHAMPIONS.length} şampiyon · {filtered.length} gösteriliyor
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İsim veya yetenek ara…"
            className="h-9 border-zinc-800 bg-zinc-900/60 pl-8 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Filter bar */}
      <div className="tft-glass flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 p-2.5">
        {/* Cost filters */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-zinc-600">Maliyet</span>
          {[1, 2, 3, 4, 5].map((cost) => (
            <button
              key={cost}
              onClick={() => setCostFilter(costFilter === cost ? null : cost)}
              className={`h-7 w-7 rounded-md border text-xs font-bold transition-all ${
                costFilter === cost
                  ? `${COST_THEME[cost].border} ${COST_THEME[cost].text} bg-gradient-to-br ${COST_THEME[cost].bg} ring-1 ${COST_THEME[cost].ring}`
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {cost}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-zinc-800" />

        {/* Role filters */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-zinc-600">Rol</span>
          {(Object.keys(ROLE_THEME) as ChampionRole[]).map((role) => {
            const cfg = ROLE_THEME[role];
            const Icon = cfg.icon;
            const active = roleFilter === role;
            return (
              <button
                key={role}
                onClick={() => setRoleFilter(active ? null : role)}
                title={cfg.label}
                className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-all ${
                  active
                    ? `border-zinc-600 bg-zinc-800 ${cfg.color}`
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-zinc-800" />

        {/* Trait filter */}
        <select
          value={traitFilter ?? ""}
          onChange={(e) => setTraitFilter(e.target.value || null)}
          className="h-7 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[11px] text-zinc-300 focus:border-amber-500/50 focus:outline-none"
        >
          <option value="">Tüm traitler</option>
          {ALL_TRAITS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto h-7 px-2 text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            <X className="mr-1 h-3 w-3" />
            Temizle
          </Button>
        )}
      </div>

      {/* Champion grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-600">
          Filtreye uyan şampiyon yok.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((champ, i) => (
            <ChampionCard
              key={champ.name}
              champ={champ}
              delay={`${Math.min(i * 20, 400)}ms`}
              onClick={() => setSelected(champ)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && <ChampionDetail champ={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Champion card (grid tile) ───────────────────────────────────────────────

function ChampionCard({ champ, delay, onClick }: { champ: Champion; delay: string; onClick: () => void }) {
  const theme = COST_THEME[champ.cost];
  const roleCfg = ROLE_THEME[champ.role];
  const RoleIcon = roleCfg.icon;

  return (
    <button
      onClick={onClick}
      style={{ animationDelay: delay }}
      className={`tft-fade-up group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border ${theme.border} bg-gradient-to-br ${theme.bg} p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${theme.glow} hover:border-opacity-100`}
    >
      {/* Top sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {/* Cost badge */}
      <span
        className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950/60 text-[10px] font-bold ${theme.text} ring-1 ${theme.ring}`}
      >
        {champ.cost}
      </span>

      {/* Role icon */}
      <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950/40 ring-1 ring-white/5 ${roleCfg.color}`}>
        <RoleIcon className="h-5 w-5" />
      </div>

      {/* Name */}
      <span className="text-sm font-semibold text-zinc-100 leading-tight">{champ.name}</span>

      {/* Traits */}
      <div className="flex flex-wrap justify-center gap-0.5">
        {champ.traits.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-zinc-950/40 px-1 py-0.5 text-[9px] text-zinc-400">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

// ─── Champion detail modal ───────────────────────────────────────────────────

function ChampionDetail({ champ, onClose }: { champ: Champion; onClose: () => void }) {
  const theme = COST_THEME[champ.cost];
  const roleCfg = ROLE_THEME[champ.role];
  const RoleIcon = roleCfg.icon;

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Find trait details
  const traitDetails = champ.traits.flatMap((t) => {
    const found = TRAITS.find((tr) => tr.name === t);
    return found ? [found] : [];
  });

  // Find which comps use this champion
  const compsUsing = useMemo(() => {
    return (COMPS as Array<{ name: string; tier: string; core: string[] }>)
      .filter((c) => c.core.includes(champ.name))
      .map((c) => ({ name: c.name, tier: c.tier }));
  }, [champ.name]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`tft-scale-in relative w-full max-w-lg overflow-hidden rounded-2xl border ${theme.border} bg-zinc-950/95 shadow-2xl ${theme.glow}`}
      >
        {/* Header gradient banner */}
        <div className={`relative bg-gradient-to-br ${theme.bg} px-5 pb-4 pt-5`}>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950/40 text-zinc-400 transition-colors hover:bg-zinc-950/60 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-950/50 ring-1 ${theme.ring} ${roleCfg.color}`}>
              <RoleIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-zinc-100">{champ.name}</h3>
                <Badge
                  variant="outline"
                  className={`${theme.border} ${theme.text} bg-zinc-950/40 text-[10px]`}
                >
                  {theme.label}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <RoleIcon className="h-3 w-3" />
                {roleCfg.label}
              </div>
            </div>
          </div>

          {/* Trait badges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {champ.traits.map((t) => {
              const detail = traitDetails.find((d) => d?.name === t);
              return (
                <Badge
                  key={t}
                  variant="outline"
                  className="border-zinc-700 bg-zinc-900/60 text-[11px] text-zinc-300"
                  title={detail?.desc ?? ""}
                >
                  {t}
                  {detail?.breakpoints ? (
                    <span className="ml-1 text-zinc-600">
                      {detail.breakpoints.join("/")}
                    </span>
                  ) : null}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Ability */}
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Zap className="h-3.5 w-3.5" /> Yetenek
            </h4>
            <p className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
              {champ.ability}
            </p>
          </div>

          {/* BIS Items */}
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Star className="h-3.5 w-3.5 text-amber-400" /> En İyi Itemler (BIS)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {champ.items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-center"
                >
                  <div className="text-[10px] text-zinc-600">Item {i + 1}</div>
                  <div className="mt-0.5 text-xs font-medium text-amber-200">{item}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Comps using this champion */}
          {compsUsing.length > 0 && (
            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <Layers className="h-3.5 w-3.5" /> Kullanıldığı Complar
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {compsUsing.map((c) => (
                  <Badge
                    key={c.name}
                    variant="outline"
                    className={
                      c.tier === "S"
                        ? "border-amber-500/40 text-amber-300 bg-amber-500/10 text-[11px]"
                        : c.tier === "A"
                        ? "border-sky-500/40 text-sky-300 bg-sky-500/10 text-[11px]"
                        : "border-zinc-700 text-zinc-400 text-[11px]"
                    }
                  >
                    {c.tier} · {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Trait details */}
          {traitDetails.length > 0 && (
            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <Heart className="h-3.5 w-3.5" /> Trait Detayları
              </h4>
              <div className="space-y-1.5">
                {traitDetails.map((d) => (
                  <div
                    key={d.name}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">{d.name}</span>
                      <span className="text-[10px] text-zinc-600">
                        {d.category} · {d.type}
                      </span>
                    </div>
                    {d.desc && (
                      <p className="mt-0.5 text-[11px] text-zinc-500">{d.desc}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
