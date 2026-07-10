/**
 * GET /api/ddragon-icons?champion={name}
 *
 * Proxies a champion icon from Data Dragon, caching it locally in
 * public/tft-icons/ so subsequent requests don't hit the CDN.
 *
 * Used by the Item/Board recognition path (PLAN 15.5 step 5: Data Dragon
 * indirici). The icons become reference templates for matching.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const ICON_DIR = join(process.cwd(), "public", "tft-icons");

export async function GET(req: NextRequest) {
  const champion = req.nextUrl.searchParams.get("champion");
  const iconUrl = req.nextUrl.searchParams.get("url");

  if (!champion && !iconUrl) {
    return NextResponse.json({ ok: false, error: "?champion={name} veya ?url={ddragon url} gerekli." }, { status: 400 });
  }

  // Build the target URL.
  let url: string;
  let cacheFile: string;
  if (iconUrl) {
    url = iconUrl;
    const basename = iconUrl.split("/").pop() ?? "icon.png";
    cacheFile = join(ICON_DIR, basename);
  } else {
    // Need to resolve champion → icon URL via ddragon. Redirect to ddragon-champions.
    return NextResponse.json({
      ok: false,
      error: "champion name lookup not implemented — pass ?url= directly, or GET /api/ddragon-champions first.",
    }, { status: 400 });
  }

  try {
    // Check cache first.
    if (existsSync(cacheFile)) {
      const buf = await readFile(cacheFile);
      return new NextResponse(buf, {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    // Fetch from CDN.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    // Cache locally.
    if (!existsSync(ICON_DIR)) await mkdir(ICON_DIR, { recursive: true });
    await writeFile(cacheFile, buf);

    return new NextResponse(buf, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ ok: false, error: "Icon fetch başarısız.", details: msg }, { status: 500 });
  }
}
