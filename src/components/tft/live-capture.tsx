"use client";

/**
 * LiveCapture — Yol A: tarayıcı ekran paylaşımı ile canlı okuma prototipi.
 *
 * Akış:
 *   1. "Canlı Bağla" butonu → navigator.mediaDevices.getDisplayMedia çağrılır.
 *   2. Tarayıcı "hangi pencereyi paylaşacaksın" diye sorar, kullanıcı TFT'yi seçer.
 *   3. Stream bir <video> elementine bağlanır (gizli).
 *   4. 5 saniyede bir: video'dan tam kare al, canvas ile 640px'e küçült (tam ekran —
 *      stage üstte, gold/level altta, HP sağda sütun halinde, hepsi tek karede).
 *   5. Küçültülmüş tam ekran JPEG data URL'e çevrilir, /api/snapshot'a POST yollanır.
 *   6. /api/snapshot mevcut VLM analiz + sanity filter + advisor'ı çalıştırır.
 *   7. Sonuç (altın, level, hp, stage, round) burada gösterilir.
 *
 * Bu component Yol B'yi (capture.py) VEYA mevcut canlı tab panelini DEĞİŞTİRMEZ.
 * Sadece ek bir giriş yolu olarak "live" tab'ının üstünde durur.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  Square,
  Camera,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Monitor,
  Shield,
} from "lucide-react";

// ─── Ayarlar ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5000; // 5 saniyede bir kare yolla (PLAN.md kararı)
const MAX_WIDTH = 1280; // tam ekran bu genişliğe küçültülür (1920→1280, sayılar okunabilir)
const JPEG_QUALITY = 0.92; // yüksek kalite — text netliğini koru (0.85 bulanık yapıyordu)
// TAM EKRAN MODU: 3-şerit modu VLM'i karıştırıyordu (stretch edilmiş sağ şerit +
// birleştirilmiş 3 parça → stage halüsinasyonu, level=XP fiyatı, tutarsız okuma).
// Tam ekranda tüm sayılar doğru konumda: stage üst-orta, gold alt-orta, level
// alt-sol, HP sağ sütun. VLM tek bütünsel kareyi daha doğru okuyor.
//
// DERS: 640px'e indirmek sayıları 5-6 piksele düşürdü, VLM okuyamadı. 1280px
// (1920×1080 → 1280×720) yeterli çözünürlük sağlar ve hâlâ 960px'ten hızlı.

// ─── Tipler ─────────────────────────────────────────────────────────────────
type CaptureState = "idle" | "connecting" | "live" | "error";

interface LastRead {
  hp: number;
  gold: number;
  level: number;
  stage: number;
  round: number;
  at: string; // "12:34:56" gibi
}

interface CaptureStatus {
  state: CaptureState;
  message: string;
  frameCount: number;
  errorCount: number;
  busyCount: number; // VLM meşgul olduğu için atlanan kare sayısı
  lastRead: LastRead | null;
}

const INITIAL_STATUS: CaptureStatus = {
  state: "idle",
  message: "",
  frameCount: 0,
  errorCount: 0,
  busyCount: 0,
  lastRead: null,
};

interface LiveCaptureProps {
  /** Snapshot başarılı olunca çağrılır — parent /api/state'i yeniden fetch edebilir. */
  onSnapshot?: () => void;
}

export function LiveCapture({ onSnapshot }: LiveCaptureProps) {
  const [status, setStatus] = useState<CaptureStatus>(INITIAL_STATUS);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const inFlightStartRef = useRef(0); // VLM istek başlangıç zamanı (watchdog için)
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cleanup bayrağı — unmount sırasında setState yapmayı önler.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
      stopStream();
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ─── VLM watchdog: 60 sn'de cevap gelmezse inFlight'i sıfırla ──────────────
  // VLM bazen takılıp kalıyor; bu sayede polling devam eder.
  const startWatchdog = useCallback(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(() => {
      if (inFlightRef.current && Date.now() - inFlightStartRef.current > 60000) {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setStatus((s) => ({
            ...s,
            message: "VLM 60 sn'de cevap vermedi, sıfırlandı — sıradaki kare deneniyor…",
          }));
        }
      }
    }, 5000);
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Sekme gizlenince uyar (tarayıcı arka plan setInterval'i throttle eder)
  useEffect(() => {
    const handler = () => {
      if (!mountedRef.current) return;
      if (document.hidden && inFlightRef.current) {
        setStatus((s) => ({
          ...s,
          message: "Bu sekme arka planda — okuma yavaşladı/durdu. Sekmeyi ön plana al.",
        }));
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // ─── Tek kare yakala + kırp + gönder ──────────────────────────────────────
  const captureAndSend = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    if (inFlightRef.current) return; // önceki istek hâlâ sürüyor

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    // TAM EKRAN yakala: video'nun tüm karesini MAX_WIDTH'e küçült.
    // Tüm sayılar (stage üst-orta, gold alt-orta, level alt-sol, HP sağ sütun)
    // tek bütünsel karede — VLM konumları doğru tanır, şerit karmaşası yok.
    // 1920×1080 → 640×360 = 230K px (hızlı, VLM net okur).
    const scale = w > MAX_WIDTH ? MAX_WIDTH / w : 1;
    const outW = Math.round(w * scale);
    const outH = Math.round(h * scale);

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Tam video karesini canvas'a küçült.
    try {
      ctx.drawImage(video, 0, 0, w, h, 0, 0, outW, outH);
    } catch {
      return;
    }

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    } catch {
      return;
    }

    inFlightRef.current = true;
    inFlightStartRef.current = Date.now();
    if (mountedRef.current) {
      setStatus((s) => ({ ...s, message: "Okunuyor…" }));
    }

    try {
      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, source: "live" }),
      });

      // Önce text al, sonra JSON parse et — bazen HTML (rate limit sayfası) dönüyor.
      const text = await res.text();
      let json: {
        ok?: boolean;
        error?: string;
        errorMsg?: string;
        state?: {
          connected?: boolean;
          hp?: number;
          gold?: number;
          level?: number;
          stage?: number;
          round?: number;
        };
      };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 429
            ? "VLM yoğun (429) — biraz bekle, sıradaki kare denenecek."
            : "Sunucu HTML döndürdü (muhtemelen yoğunluk). Sıradaki kare denenecek."
        );
      }

      if (!mountedRef.current) return;

      if (json.ok && json.state?.connected) {
        const st = json.state;
        setStatus((s) => ({
          ...s,
          state: "live",
          message: "Okundu ✓",
          frameCount: s.frameCount + 1,
          errorCount: 0,
          busyCount: 0,
          lastRead: {
            hp: st.hp,
            gold: st.gold,
            level: st.level,
            stage: st.stage,
            round: st.round,
            at: new Date().toLocaleTimeString("tr-TR"),
          },
        }));
        onSnapshot?.();
      } else if (res.status === 429 || json.error === "busy") {
        // VLM meşgul — bu kare atlandı, sıradaki 5 sn'de tekrar denenecek
        setStatus((s) => ({
          ...s,
          state: "live",
          message: "VLM meşgul, kare atlandı",
          busyCount: s.busyCount + 1,
        }));
      } else {
        setStatus((s) => ({
          ...s,
          state: "live",
          message: json.error || json.errorMsg || "Okunamadı (ekran TFT değil mi?)",
          errorCount: s.errorCount + 1,
          frameCount: s.frameCount + 1,
        }));
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus((s) => ({
        ...s,
        state: "live",
        message: `Ağ hatası: ${err instanceof Error ? err.message : "bilinmeyen"}`,
        errorCount: s.errorCount + 1,
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, [onSnapshot, startWatchdog]);

  // ─── Ekran paylaşımını başlat ─────────────────────────────────────────────
  const startCapture = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus({
        ...INITIAL_STATUS,
        state: "error",
        message: "Tarayıcın ekran paylaşımını desteklemiyor. Chrome/Edge/Firefox dene.",
      });
      return;
    }

    setStatus({
      ...INITIAL_STATUS,
      state: "connecting",
      message: "Tarayıcı pencere seçimini bekliyor…",
    });

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 2, max: 5 } }, // düşük FPS yeterli
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          // autoplay policy yüzünden başlamayabilir, sorun değil — readyState yeter
        });
      }

      // Kullanıcı tarayıcı kendi "Paylaşımı durdur" butonuna basarsa
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!mountedRef.current) return;
        stopPolling();
        stopStream();
        setStatus({
          ...INITIAL_STATUS,
          state: "idle",
          message: "Ekran paylaşımı durduruldu.",
        });
      });

      setStatus({
        ...INITIAL_STATUS,
        state: "live",
        message: "Canlı bağlandı — ilk kare alınıyor…",
      });

      // İlk kareyi hemen gönder
      // küçük gecikme: video ready olsun diye
      setTimeout(() => {
        void captureAndSend();
      }, 500);

      // Watchdog'u başlat (VLM takılırsa sıfırlasın)
      startWatchdog();

      // 5 sn'de bir tekrarla
      pollTimerRef.current = setInterval(() => {
        void captureAndSend();
      }, POLL_INTERVAL_MS);
    } catch (err) {
      if (!mountedRef.current) return;
      const e = err as DOMException;
      setStatus({
        ...INITIAL_STATUS,
        state: "error",
        message:
          e?.name === "NotAllowedError"
            ? "İzin reddedildi. TFT penceresini seçip 'Paylaş'a bas."
            : `Bağlantı hatası: ${e?.message ?? "bilinmeyen"}`,
      });
    }
  }, [captureAndSend, stopPolling, stopStream]);

  const stopCapture = useCallback(() => {
    stopPolling();
    stopStream();
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (mountedRef.current) {
      setStatus({
        ...INITIAL_STATUS,
        state: "idle",
        message: "Durduruldu.",
      });
    }
  }, [stopPolling, stopStream]);

  const isLive = status.state === "live" || status.state === "connecting";

  return (
    <Card className="tft-glass border-emerald-500/30">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5 text-emerald-400/80">
          <Monitor className="h-3.5 w-3.5" /> Yol A — Tarayıcıdan canlı (kurulum yok)
        </CardDescription>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>Canlı Bağla</span>
          {status.state === "live" && (
            <Badge
              variant="outline"
              className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] tft-pulse-ring"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
              CANLI
            </Badge>
          )}
          {status.state === "connecting" && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">
              <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
              BAĞLANIYOR
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Nasıl çalışır */}
        <div className="rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200/80 leading-relaxed">
          <strong className="text-sky-200">Nasıl çalışır:</strong> Butona bas → tarayıcı
          &quot;hangi pencereyi paylaşacaksın&quot; diye sorar → TFT penceresini seç →
          sistem her <strong className="text-sky-200">5 saniyede bir</strong> ekranın
          tamamını okur (stage, altın, level, can) ve aşağıya yazar. Hiçbir kurulum yok.
        </div>

        {/* Buton */}
        <div className="flex flex-wrap gap-2">
          {!isLive ? (
            <Button
              onClick={startCapture}
              className="bg-emerald-500/90 text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
              size="sm"
            >
              <Radio className="mr-1.5 h-3.5 w-3.5" />
              Canlı Bağla
            </Button>
          ) : (
            <Button
              onClick={stopCapture}
              variant="outline"
              size="sm"
              className="border-red-500/40 text-red-300 hover:bg-red-500/10"
              disabled={status.state === "connecting"}
            >
              <Square className="mr-1.5 h-3.5 w-3.5" />
              Durdur
            </Button>
          )}
          <Badge
            variant="outline"
            className="border-emerald-500/20 text-emerald-300/70 text-[9px] gap-1 self-center"
          >
            <Shield className="h-2.5 w-2.5" /> sadece okur
          </Badge>
        </div>

        {/* Status mesajı */}
        {status.message && (
          <div
            className={`rounded-md px-3 py-2 text-xs flex items-center gap-1.5 ${
              status.state === "error"
                ? "border border-red-500/30 bg-red-500/5 text-red-300"
                : status.state === "live" && status.message.startsWith("Okundu")
                ? "border border-emerald-500/20 bg-emerald-500/5 text-emerald-200/90"
                : status.state === "live" &&
                  (status.message.includes("meşgul") ||
                    status.message.includes("Okunamadı") ||
                    status.message.includes("Ağ hatası"))
                ? "border border-amber-500/20 bg-amber-500/5 text-amber-200/90"
                : "border border-zinc-700/60 bg-zinc-900/40 text-zinc-400"
            }`}
          >
            {status.state === "connecting" && (
              <Loader2 className="h-3 w-3 flex-none animate-spin" />
            )}
            {status.state === "error" && (
              <AlertCircle className="h-3 w-3 flex-none" />
            )}
            {status.state === "live" && status.message.startsWith("Okundu") && (
              <CheckCircle2 className="h-3 w-3 flex-none" />
            )}
            {status.state === "live" &&
              (status.message.includes("meşgul") ||
                status.message.includes("Okunamadı") ||
                status.message.includes("Ağ hatası")) && (
                <AlertCircle className="h-3 w-3 flex-none" />
              )}
            <span className="leading-snug">{status.message}</span>
          </div>
        )}

        {/* Son okunan değerler */}
        {status.lastRead && (
          <div className="rounded-md border border-zinc-700/60 bg-zinc-950/40 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Son okuma
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {status.lastRead.at}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              <Stat label="Altın" value={status.lastRead.gold} color="amber" />
              <Stat label="Level" value={status.lastRead.level} color="sky" />
              <Stat label="HP" value={status.lastRead.hp} color="emerald" />
              <Stat
                label="Stage"
                value={`${status.lastRead.stage}-${status.lastRead.round}`}
                color="violet"
              />
              <Stat label="Round" value={status.lastRead.round} color="zinc" />
            </div>
          </div>
        )}

        {/* İstatistikler */}
        {(status.frameCount > 0 ||
          status.errorCount > 0 ||
          status.busyCount > 0) && (
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" /> {status.frameCount} kare
            </span>
            {status.busyCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400/70">
                <Loader2 className="h-3 w-3" /> {status.busyCount} meşgul atlandı
              </span>
            )}
            {status.errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-400/70">
                <AlertCircle className="h-3 w-3" /> {status.errorCount} hata
              </span>
            )}
          </div>
        )}

        {/* Gizli: video stream + canvas (görünmez ama render edilir — hidden bozuyor) */}
        <video
          ref={videoRef}
          className="absolute opacity-0 pointer-events-none"
          style={{ width: 1, height: 1 }}
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
      </CardContent>
    </Card>
  );
}

// ─── Mini stat kutucuğu ─────────────────────────────────────────────────────
function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "amber" | "sky" | "emerald" | "violet" | "zinc";
}) {
  const colorMap: Record<string, string> = {
    amber: "text-amber-300",
    sky: "text-sky-300",
    emerald: "text-emerald-300",
    violet: "text-violet-300",
    zinc: "text-zinc-300",
  };
  return (
    <div className="rounded bg-zinc-900/60 py-1.5 px-1">
      <div className="text-[9px] uppercase tracking-wide text-zinc-500 leading-tight">
        {label}
      </div>
      <div className={`text-sm font-bold ${colorMap[color]}`}>{value}</div>
    </div>
  );
}
