"use client";

/**
 * Capture setup — instructions + script download for the Python capture client.
 * The user runs this on their PC to enable "live" mode.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Download, Copy, CheckCircle2, Search } from "lucide-react";
import { useState } from "react";

export function CaptureSetup() {
  const [copied, setCopied] = useState(false);
  // The endpoint the capture client posts to. Relative URL — works because
  // the user opens this same site in their browser.
  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/snapshot` : "/api/snapshot";

  const copy = () => {
    navigator.clipboard.writeText(endpoint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard API unavailable (e.g. permissions denied) — silently skip
    });
  };

  return (
    <>
    <Card className="tft-glass border-zinc-800/80">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-zinc-500">
          <Terminal className="h-3.5 w-3.5" /> Canlı mod kurulumu
        </CardDescription>
        <CardTitle className="text-base">Capture client (PC'nde çalışır)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* ── BİLGİ: TFT maç içi pencere ─────────────────────── */}
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 text-xs text-emerald-100/90">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-200 mb-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            TFT maç içi penceresi
          </div>
          <div className="space-y-1 text-[11px] leading-relaxed">
            <div>
              <span className="font-mono text-emerald-300">&quot;League of Legends (TM) Client&quot;</span>
              <span className="text-emerald-100/70"> = </span>
              <span className="text-emerald-200">MAÇ İÇİ</span>
              <span className="text-emerald-100/60"> (League of Legends.exe, 1920x1080) — VLM BUNU okumalı</span>
            </div>
            <div className="text-emerald-100/60">
              Küçük &quot;League of Legends&quot; (160x28) penceresi splash&apos;dir, otomatik atlanır.
              <code className="text-emerald-300"> --background</code> modu varsayılan olarak maç içi pencereyi bulur.
            </div>
          </div>
        </div>

        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
          Canlı mod için PC'nde küçük bir Python script çalışır. TFT ekranını yakalayıp
          bu siteye yollar. Sen 2. ekrandan/telefondan bu sayfayı açık bırakırsın.
          <strong className="font-semibold text-amber-200"> Önemli: 10 saniyede bir</strong> çalıştır
          (VLM API'sinin dakikalık kotası var, daha sık çağrı 429 hatası verir).
        </div>

        {/* Mode toggle: foreground vs background */}
        <div className="rounded-md border border-zinc-700/60 bg-zinc-950/40 px-3 py-2.5">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-500">Yakalama modu</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-md border border-zinc-700/50 bg-zinc-900/40 p-2">
              <div className="text-xs font-medium text-zinc-300">Ön plan (mss)</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">TFT tam ekran olmalı. Alt-tab yapınca durur. Hafif, her PC'de çalışır.</div>
              <code className="mt-1.5 block text-[10px] text-emerald-300">pip install mss requests pillow</code>
            </div>
            <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-violet-300">Arka plan ⭐</span>
                <Badge variant="outline" className="border-violet-500/30 text-violet-300 text-[8px] px-1 py-0">önerilen</Badge>
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Alt-tab yapsan bile TFT'yi okur. 2. ekran/telefon için ideal.</div>
              <code className="mt-1.5 block text-[10px] text-emerald-300">pip install windows-capture numpy pillow requests</code>
            </div>
          </div>
        </div>

        <ol className="space-y-2 text-zinc-300">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-300">
              1
            </span>
            <span>Python 3.9+ yükle (yoksa).</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-300">
              2
            </span>
            <span>
              Bağımlılıkları kur — arka plan modu için:{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-amber-300">
                pip install windows-capture numpy pillow requests
              </code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-300">
              3
            </span>
            <span>Aşağıdaki script'i indir ve çalıştır.</span>
          </li>
        </ol>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              Hedef URL (script bunu kullanır)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              {copied ? (
                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
          <code className="block w-full break-all rounded-md bg-zinc-950 px-2.5 py-2 text-[11px] text-emerald-300">
            {endpoint}
          </code>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href="/capture-client/capture.py" download>
            <Button
              size="sm"
              className="bg-amber-500/90 text-zinc-950 hover:bg-amber-400"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              capture.py indir
            </Button>
          </a>
          <a href="/capture-client/README.md" download>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 bg-zinc-950/40 text-zinc-300"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              README
            </Button>
          </a>
        </div>

        <div className="rounded-md bg-zinc-950/50 px-3 py-2 text-[11px] text-zinc-500 space-y-1.5">
          <div className="mb-0.5 flex items-center gap-1.5 text-zinc-400">
            <Terminal className="h-3 w-3" /> Çalıştırma
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-violet-300 text-[10px] font-medium uppercase">Arka plan ⭐ (önerilen)</span>
          </div>
          <code className="block text-emerald-300 break-all">python capture.py --url {endpoint} --interval 10 --background -v</code>
          <div className="text-[10px] text-zinc-500 pl-1">— --window verilmezse varsayılan: &quot;League of Legends (TM) Client&quot;</div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-zinc-500 text-[10px] font-medium uppercase">Ön plan (yedek)</span>
          </div>
          <code className="block text-zinc-400 break-all">python capture.py --url {endpoint} --interval 10 --window &quot;League of Legends (TM) Client&quot; -v</code>
          <div className="text-[10px] text-zinc-500 pl-1">— maç içi pencere: &quot;League of Legends (TM) Client&quot; (1920x1080)</div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-sky-400/80 text-[10px] font-medium uppercase">Pencere adını doğrula</span>
          </div>
          <code className="block text-sky-300/80 break-all">python capture.py --list-windows</code>
          <div className="text-[10px] text-zinc-500 pl-1">— ★ MAÇ veya ⚠ BEKLE işaretli pencereyi kullan (büyük boyutlu olan)</div>
        </div>

        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.03] px-3 py-2 text-[11px] text-emerald-200/70">
          <strong className="text-emerald-200">Board/Bench okuma iyileştirildi:</strong>{" "}
          capture.py artık tam ekranın yanında board ve bench bölgelerini de kırpıp
          yakınlaştırılmış gönderiyor. VLM bu yakınlaştırılmış görüntülerden şampiyonları
          okuyor — trait paneliyle karıştırmıyor. Ayrıca şampiyon adları 61 kişilik
          kadroya göre kontrol ediliyor; saçma isimler otomatik eleniyor.
          <span className="mt-1 block text-zinc-500">
            Not: crop kapalıysa <code className="text-emerald-300">--no-crops</code> flag'i
            ile eski davranışa dönebilirsin.
          </span>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-zinc-500">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300/80 text-[10px]">
            güvenli
          </Badge>
          <span>
            Script sadece ekran yakalar ve bu URL'e yollar. Hiçbir oyun dosyasına dokunmaz, oyuna
            müdahale etmez, anti-cheat sorunu yok. Sadece okur.
          </span>
        </div>
      </CardContent>
    </Card>

    {/* ─── Debug: frame save ──────────────────────────────────────────── */}
    <Card className="border-amber-500/20 bg-amber-500/[0.03]">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-amber-400/70">
          <Search className="h-3.5 w-3.5" /> Tanılama — Frame kaydetme (VLM yanlış okursa)
        </CardDescription>
        <CardTitle className="text-base">VLM yanlış/boş değer mi döndürüyor?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
          Eğer VLM sürekli <code className="text-amber-300">hp=100 gold=0 lvl=1 stage=1-1</code>{" "}
          (boş default) döndürüyorsa, <code className="text-amber-300">--save-frames</code> ile
          her frame&apos;i diske kaydedip ne yakalandığını kontrol et:
        </div>
        <code className="block text-amber-300 break-all">
          python capture.py --url {endpoint} --interval 10 --background --save-frames ./debug-frames -v
        </code>
        <div className="text-xs text-zinc-400">
          Frame&apos;ler <code className="text-zinc-300">./debug-frames/</code> klasörüne JPEG olarak kaydedilir.
          Birkaç frame&apos;i kontrol et — TFT oyun ekranı mı (board, bench, shop, gold görünüyor mu?)
          yoksa loading/masaüstü mü? Maç içinde olduğundan emin ol.
        </div>
      </CardContent>
    </Card>
    </>
  );
}
