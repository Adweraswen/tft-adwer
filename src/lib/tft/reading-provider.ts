/**
 * ReadingProvider — oyun verisi okuma yöntemi soyutlaması.
 *
 * Mevcut implementasyonlar:
 *   - VLM (vlm-analyzer.ts) — ekran görüntüsü + yapay zeka, yavaş.
 *   - Overwolf GEP (overwolf-app/) — Riot partneri, hızlı + doğru.
 *
 * Neden bu soyutlama:
 *   - VLM ve Overwolf aynı çıktıyı (GameState) üretmeli.
 *   - Üst katman (advisor, sanity filter, UI) hangi yöntemle okunduğunu
 *     bilmemeli — sadece GameState alıp tavsiye üretmeli.
 *
 * Overwolf mimarisi (PLAN.md bölüm 15):
 *   - Kullanıcı PC'de Overwolf client + Overwolf app (HTML/JS) çalışır.
 *   - Overwolf app GEP event'lerini dinler, localhost WebSocket'e yollar.
 *   - Next.js API route WebSocket'i dinler, GameState'e çevirir.
 *   - Frontend /api/snapshot'a POST atar (VLM ile aynı yol).
 */

import type { GameState } from "@/lib/tft/state";

/**
 * Okuma yöntemi türleri.
 * - "vlm": VLM ile ekran görüntüsü analizi (mevcut, yavaş ama esnek).
 * - "overwolf": Overwolf GEP event'leri (hızlı, doğru, Riot partneri).
 */
export type ReadingMethod = "vlm" | "overwolf";

/**
 * ReadingProvider ortak interface'i.
 *
 * Tüm okuma yöntemleri bu fonksiyonları implement eder. Üst katman
 * (sanity filter, advisor, UI) sadece bu interface'i çağırır.
 */
export interface ReadingProvider {
  /** Okuma yöntemi tanımlayıcısı. */
  readonly method: ReadingMethod;

  /**
   * Bir okuma döngüsü yap, GameState döndür.
   *
   * VLM: ekran görüntüsü al → VLM'e gönder → parse et → GameState.
   * Overwolf: GEP event'lerini topla → GameState üret.
   *
   * Hata durumunda boş/empty state döner, throw atmaz.
   */
  read(): Promise<GameState>;

  /**
   * Bağlantı durumu.
   *
   * VLM: API key var mı + son çağrı başarılı mı.
   * Overwolf: Overwolf client açık mı + GEP event'leri geliyor mu.
   */
  isConnected(): Promise<boolean>;

  /**
   * Kaynağı serbest bırak (varsa).
   */
  disconnect(): Promise<void>;
}

/**
 * Overwolf okuma için gerekli konfigürasyon.
 */
export interface OverwolfReaderConfig {
  /** Overwolf app'in WebSocket port'u (localhost). */
  websocketPort: number;
  /** TFT GameID (21570 normal, 215701 PBE). */
  gameId: number;
}

/**
 * VLM okuma için gerekli konfigürasyon.
 * Mevcut — z-ai-web-dev-sdk kullanır.
 */
export interface VlmReaderConfig {
  /** API key (z.ai sandbox'ta otomatik, prod'da env var). */
  apiKey?: string;
  /** VLM modeli (glm-4.5v vb.). */
  model?: string;
  /** Çağrı timeout (ms). */
  timeoutMs?: number;
}

/**
 * Okuma yöntemi seçimi için factory.
 *
 * Şimdilik sadece stub — gerçek implementasyon ileride.
 */
export function createReader(method: ReadingMethod): ReadingProvider {
  if (method === "vlm") {
    throw new Error(
      "VLM provider henüz refactor edilmedi. Mevcut vlm-analyzer.ts'i kullanın."
    );
  }
  if (method === "overwolf") {
    throw new Error(
      "Overwolf provider henüz yazılmadı. overwolf-app/ klasörünü kuracağız."
    );
  }
  throw new Error(`Bilinmeyen okuma yöntemi: ${method}`);
}
