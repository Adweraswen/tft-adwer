/**
 * ReadingProvider — oyun verisi okuma yöntemi soyutlaması.
 *
 * Mevcut implementasyonlar:
 *   - VLM (vlm-analyzer.ts) — ekran görüntüsü + yapay zeka, yavaş.
 *   - CV (ocr/ altında: gold-ocr, round-ocr, bench-ocr, shop-ocr, item-ocr)
 *     — Tesseract + sharp, hızlı, yerel.
 *
 * Neden bu soyutlama:
 *   - VLM ve CV aynı çıktıyı (GameState) üretmeli.
 *   - Üst katman (advisor, sanity filter, UI) hangi yöntemle okunduğunu
 *     bilmemeli — sadece GameState alıp tavsiye üretmeli.
 *
 * CV mimarisi (PLAN.md bölüm 15):
 *   - Kullanıcı PC'de capture.py ekran yakalar (mss), /api/snapshot'a POST.
 *   - capture.py --use-local: Live API (level) + Tesseract OCR (gold/round/shop).
 *   - Next.js API route GameState'e çevirir, advisor'a verir.
 */

import type { GameState } from "@/lib/tft/state";

/**
 * Okuma yöntemi türleri.
 * - "vlm": VLM ile ekran görüntüsü analizi (yavaş ama esnek, yedek).
 * - "cv": Tesseract OCR + sharp (hızlı, yerel, ana yol).
 */
export type ReadingMethod = "vlm" | "cv";

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
   * CV: ekran görüntüsü al → OCR/CV → GameState.
   *
   * Hata durumunda boş/empty state döner, throw atmaz.
   */
  read(): Promise<GameState>;

  /**
   * Bağlantı durumu.
   *
   * VLM: API key var mı + son çağrı başarılı mı.
   * CV: Tesseract kurulu mu + son okuma başarılı mı.
   */
  isConnected(): Promise<boolean>;

  /**
   * Kaynağı serbest bırak (varsa).
   */
  disconnect(): Promise<void>;
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
  if (method === "cv") {
    throw new Error(
      "CV provider henüz bu factory'ye bağlı değil. /api/snapshot + capture.py kullanın."
    );
  }
  throw new Error(`Bilinmeyen okuma yöntemi: ${method}`);
}
