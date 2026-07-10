"use client";

/**
 * BoardHexGrid — visual hex-grid representation of the TFT board.
 *
 * TFT uses a hex grid with 4 rows (7-6-7-6 hexes pattern) for the board
 * and a 9-slot bench row below. This component renders that grid visually,
 * placing champions from the GameState.board array onto hexes.
 *
 * Since the VLM doesn't give us exact hex positions, we distribute champions
 * heuristically:
 *   - Frontline (tanks): front rows (row 0, 1)
 *   - Backline (carries/ranged): back rows (row 2, 3)
 * Classification is based on champion role from the data tables.
 *
 * Empty hexes show a subtle dotted outline. Filled hexes show the champion
 * name, star count, and item count with a cost-colored border.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, Star, Shield, Sword, Sparkles, Plus } from "lucide-react";
import { getChampion } from "@/lib/tft-data";
import type { BoardUnit } from "@/lib/tft/state";

// TFT board hex layout: row 0 = front (closest to enemy), row 3 = back
// Pattern: 7, 6, 7, 6 (alternating) — but we simplify to 4 rows of 7 for display
const BOARD_ROWS = 4;
const HEXES_PER_ROW = [7, 6, 7, 6]; // actual TFT pattern
const BENCH_SLOTS = 9;

const COST_COLORS: Record<number, { border: string; bg: string; text: string }> = {
  1: { border: "border-zinc-600/50", bg: "bg-zinc-800/40", text: "text-zinc-300" },
  2: { border: "border-emerald-600/50", bg: "bg-emerald-900/20", text: "text-emerald-300" },
  3: { border: "border-sky-600/50", bg: "bg-sky-900/20", text: "text-sky-300" },
  4: { border: "border-violet-600/50", bg: "bg-violet-900/20", text: "text-violet-300" },
  5: { border: "border-amber-600/50", bg: "bg-amber-900/20", text: "text-amber-300" },
};

function getCostColor(cost: number | undefined) {
  return COST_COLORS[cost ?? 1] ?? COST_COLORS[1];
}

function isFrontline(name: string): boolean {
  const champ = getChampion(name);
  if (!champ) return false;
  return champ.role === "tank" || champ.role === "support";
}

interface BoardHexGridProps {
  board: BoardUnit[];
  bench?: BoardUnit[];
  /** Current player level. TFT's base unit cap = level. Augments can push the
   * actual cap higher, which we detect when board.length > level. */
  level?: number;
}

export function BoardHexGrid({ board, bench = [], level }: BoardHexGridProps) {
  // Unit capacity: TFT base cap = level. Augments (Team Building Tactics,
  // Grab Bag, etc.) can add +1/+2 to the cap. We can't read the augment bonus
  // directly from the UI, so we infer it: if the board has more units than
  // the level, the excess is from augment bonuses, and the real cap is at
  // least board.length. When the board isn't full, cap = level (we don't
  // know about unused augment bonuses).
  const baseCap = level ?? board.length;
  const augmentBonus = Math.max(0, board.length - baseCap);
  const unitCap = Math.max(baseCap, board.length);
  const isOverLevel = augmentBonus > 0;
  // Split champions into frontline and backline
  const frontline = board.filter((u) => isFrontline(u.name));
  const backline = board.filter((u) => !isFrontline(u.name));

  // Distribute across hex positions
  // Row 0 (front): first ~3-4 frontline, Row 1: remaining frontline + overflow
  // Row 2: first backline, Row 3 (back): remaining backline
  const hexGrid: (BoardUnit | null)[][] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    hexGrid.push(new Array(HEXES_PER_ROW[r]).fill(null));
  }

  // Place frontline in rows 0-1 (front)
  let frontIdx = 0;
  for (const unit of frontline) {
    const row = frontIdx < HEXES_PER_ROW[0] ? 0 : 1;
    const col = row === 0 ? frontIdx : frontIdx - HEXES_PER_ROW[0];
    if (col < HEXES_PER_ROW[row]) {
      hexGrid[row][col] = unit;
    }
    frontIdx++;
  }

  // Place backline in rows 3-2 (back to front)
  let backIdx = 0;
  for (const unit of backline) {
    const row = backIdx < HEXES_PER_ROW[3] ? 3 : 2;
    const col = row === 3 ? backIdx : backIdx - HEXES_PER_ROW[3];
    if (col < HEXES_PER_ROW[row]) {
      hexGrid[row][col] = unit;
    }
    backIdx++;
  }

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-zinc-500">
            <Grid3x3 className="h-3.5 w-3.5" /> Tahta görünümü
          </span>
          <span className="flex items-center gap-1.5 text-[10px]">
            <span className={isOverLevel ? "text-amber-300 font-medium" : "text-zinc-500"}>
              {board.length}/{unitCap} birim
            </span>
            {isOverLevel && (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[9px] gap-0.5 px-1 py-0 h-4"
                title={`Augment bonus: tahta kapasitesi ${baseCap} (level) → ${unitCap} (+${augmentBonus} augment)`}
              >
                <Plus className="h-2 w-2" />{augmentBonus}
              </Badge>
            )}
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-600">{bench.length} yedek</span>
          </span>
        </CardDescription>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Hex tahta</span>
          {isOverLevel && (
            <span className="text-[10px] font-normal text-amber-400/70 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              augment bonus aktif
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Board hex grid */}
        <div className="space-y-1.5">
          {hexGrid.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="flex justify-center gap-1.5"
              style={{ marginLeft: rowIdx % 2 === 1 ? "14px" : "0" }}
            >
              {row.map((unit, colIdx) => (
                <HexCell key={`${rowIdx}-${colIdx}`} unit={unit} rowIdx={rowIdx} />
              ))}
            </div>
          ))}
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div className="pt-2 border-t border-zinc-800/60">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
              <Shield className="h-3 w-3" /> Yedekler
            </div>
            <div className="flex gap-1 justify-center flex-wrap">
              {Array.from({ length: BENCH_SLOTS }).map((_, i) => (
                <BenchCell key={i} unit={bench[i]} />
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[9px] text-zinc-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-zinc-500" /> 1g
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> 2g
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> 3g
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> 4g
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> 5g
          </span>
          <span className="ml-auto flex items-center gap-1 text-zinc-700">
            <Sword className="h-2.5 w-2.5" /> arka sıra
            <Shield className="h-2.5 w-2.5 ml-1" /> ön sıra
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function HexCell({ unit, rowIdx }: { unit: BoardUnit | null; rowIdx: number }) {
  if (!unit) {
    return (
      <div className="h-12 w-12 rounded-lg border border-dashed border-zinc-800/60 bg-zinc-950/20" />
    );
  }

  const champ = getChampion(unit.name);
  const cost = champ?.cost ?? 1;
  const colors = getCostColor(cost);
  const isFront = rowIdx <= 1;

  return (
    <div
      className={`group relative h-12 w-12 rounded-lg border ${colors.border} ${colors.bg} flex flex-col items-center justify-center transition-all hover:scale-110 hover:z-10 cursor-default`}
      title={`${unit.name}${champ ? ` (${cost}g, ${champ.role})` : ""}\nYıldız: ${unit.stars}\nItemler: ${unit.items.length > 0 ? unit.items.join(", ") : "yok"}`}
    >
      {/* Star indicator */}
      {unit.stars > 1 && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: unit.stars }).map((_, i) => (
            <Star key={i} className="h-2 w-2 fill-amber-400 text-amber-400" />
          ))}
        </div>
      )}
      {/* Role icon */}
      <div className="absolute top-0.5 right-0.5">
        {isFront ? (
          <Shield className="h-2.5 w-2.5 text-zinc-500" />
        ) : (
          <Sword className="h-2.5 w-2.5 text-zinc-500" />
        )}
      </div>
      {/* Item count */}
      {unit.items.length > 0 && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full bg-zinc-800 px-1 py-0.5">
          <Sparkles className="h-2 w-2 text-amber-400" />
          <span className="text-[8px] text-amber-300 font-bold">{unit.items.length}</span>
        </div>
      )}
      {/* Champion name (truncated) */}
      <span className={`text-[8px] font-medium ${colors.text} leading-none text-center px-0.5 truncate max-w-full`}>
        {unit.name}
      </span>
      {/* Cost badge */}
      <span className="text-[7px] text-zinc-600 mt-0.5">{cost}g</span>
    </div>
  );
}

function BenchCell({ unit }: { unit: BoardUnit | undefined }) {
  if (!unit) {
    return <div className="h-8 w-8 rounded border border-dashed border-zinc-800/40 bg-zinc-950/10" />;
  }
  const champ = getChampion(unit.name);
  const cost = champ?.cost ?? 1;
  const colors = getCostColor(cost);
  return (
    <div
      className={`h-8 w-8 rounded border ${colors.border} ${colors.bg} flex items-center justify-center transition-all hover:scale-110`}
      title={`${unit.name}${champ ? ` (${cost}g)` : ""}`}
    >
      <span className={`text-[7px] font-medium ${colors.text} truncate max-w-full px-0.5`}>
        {unit.name.slice(0, 4)}
      </span>
    </div>
  );
}
