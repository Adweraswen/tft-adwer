#!/usr/bin/env python3
"""
TFT Adwer — Local Data Reader (Live API + OCR)
================================================

Bu modül capture.py'ye yardımcı olur. VLM yerine iki yerel veri kaynağı kullanır:

1. **Live Client Data API (port 2999)** — Riot'un resmi local API'si.
   - Level: %100 doğru, anlık, parasız.
   - HP: aktif oyuncu için doğru.
   - gameMode: "TFT" ise oyun içindeyiz (connected tespiti).
   - Hiç OCR yok, hiç VLM yok.

2. **Tesseract OCR** — gold için.
   - TFT'de gold shop'un hemen üstünde, büyük sarı sayı.
   - 1920x1080'de yaklaşık koordinat: x=870-1050, y=935-985.
   - Sadece rakam whitelist'i ile oku ("0123456789").
   - Kırp → grayscale → threshold → 3x resize → OCR.
   - Hız: <50ms.

Kullanım:
    from local_reader import LocalReader
    reader = LocalReader()
    state = reader.read()  # {connected, level, hp, gold}
    # state None ise oyun değil / API yok / OCR fail.

Kurulum:
    pip install requests pytesseract pillow
    # Tesseract binary: https://github.com/UB-Mannheim/tesseract/wiki
    # Windows: default path C:\\Program Files\\Tesseract-OCR\\tesseract.exe

Notlar:
- Live API HTTPS kullanır (https://127.0.0.1:2999), sertifika verify=False.
- TFT gold gerçek değerdir (Live API'nin currentGold=500 LoL leak'idir, biz OCR kullanırız).
- OCR 1920x1080 için tuned. Farklı çözünürlükte koordinatlar scale edilmeli.
"""

from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.request
from typing import Optional

# Tesseract opsiyonel — yoksa gold None döner, Live API yine çalışır.
try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


# ─── Live API ayarları ──────────────────────────────────────────────────────
LIVE_API_BASE = "https://127.0.0.1:2999/liveclientdata"
LIVE_API_TIMEOUT = 1.0  # saniye — oyun içindeyken hızlı dönmeli

# SSL sertifikası yok (self-signed), verify=False.
# urllib bunu ssl context ile yaparız.
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


# ─── Gold OCR koordinatları (1920x1080) ─────────────────────────────────────
# PLAN.md 15.9: TFT-OCR-BOT koordinatları (870, 883, 920, 909) — ana koordinat.
# Önceki "Paint'ten gelen" koordinat (913, 879, 1033, 910) fallback olarak korunur.
# read_gold_v2 çoklu varyant dener; hangisinin çalıştığını /api/gold-ocr-test söyler.
GOLD_CROP_1080P_PRIMARY = (870, 883, 920, 909)   # TFT-OCR-BOT (PLAN 15.9)
GOLD_CROP_1080P_PAINT = (913, 879, 1033, 910)   # kullanıcının Paint ölçümü
GOLD_CROP_1080P = GOLD_CROP_1080P_PRIMARY       # backward-compatible tek değişken

# Çoklu varyant — test aracı bunları dener. Her varyant: (isim, bbox, threshold, scale, psm)
# threshold: beyaz text için R/G/B alt sınırı (0-255). Yüksek = sadece çok beyaz.
# scale: upscale çarpanı (Tesseract küçük text'i daha iyi okur).
GOLD_VARIANTS = [
    ("tft-ocr-bot/180/3x/psm7",  GOLD_CROP_1080P_PRIMARY, 180, 3, 7),
    ("tft-ocr-bot/160/3x/psm7",  GOLD_CROP_1080P_PRIMARY, 160, 3, 7),
    ("tft-ocr-bot/200/3x/psm7",  GOLD_CROP_1080P_PRIMARY, 200, 3, 7),
    ("tft-ocr-bot/180/4x/psm7",  GOLD_CROP_1080P_PRIMARY, 180, 4, 7),
    ("tft-ocr-bot/180/3x/psm8",  GOLD_CROP_1080P_PRIMARY, 180, 3, 8),
    ("paint/180/3x/psm7",        GOLD_CROP_1080P_PAINT,   180, 3, 7),
    ("paint/160/3x/psm7",        GOLD_CROP_1080P_PAINT,   160, 3, 7),
    ("paint/200/3x/psm7",        GOLD_CROP_1080P_PAINT,   200, 3, 7),
]


# ─── LocalReader ────────────────────────────────────────────────────────────

class LocalReader:
    """Live API + Tesseract OCR birleşik okuyucu.

    Her çağrıda:
    1. Live API'den level + HP + connected al.
    2. Tesseract ile gold'u oku (PIL Image verildiyse).
    3. GameState benzeri dict döndür.

    Hata durumunda ilgili alan None olur, başka alanlar yine gelebilir.
    """

    def __init__(self, tesseract_path: Optional[str] = None):
        """Tesseract path'i opsiyonel. Windows'ta default:
            C:\\Program Files\\Tesseract-OCR\\tesseract.exe
        Farklıysa parametre geç.
        """
        if tesseract_path and TESSERACT_AVAILABLE:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path

    def read_live_api(self) -> Optional[dict]:
        """Live Client Data API'den veri çek.

        Dönüş:
            {
                "connected": bool,  # gameMode == "TFT"
                "level": int,       # activePlayer.level
                "hp": int,          # activePlayer.currentHealth (TFT'de yok olabilir)
                "all_players": [...],  # 8 oyuncu
                "game_time": float,
            }
            veya None (API yok / oyun değil).
        """
        try:
            req = urllib.request.Request(f"{LIVE_API_BASE}/allgamedata")
            with urllib.request.urlopen(req, timeout=LIVE_API_TIMEOUT, context=_SSL_CTX) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            # gameMode kontrol
            game_data = data.get("gameData", {})
            game_mode = game_data.get("gameMode", "")
            if game_mode != "TFT":
                # LoL maçı (TFT değil) — bu API LoL için de çalışıyor.
                return None

            # active player — level + HP
            active = data.get("activePlayer", {})
            level = active.get("level")
            # TFT'de currentHealth LoL leak'i (500 gibi), HP için kullanma.
            # HP için all_players'tan active player'ı bul.
            hp = None
            all_players = data.get("allPlayers", [])
            active_riot_id = active.get("riotId") or active.get("summonerName")
            for p in all_players:
                p_id = p.get("riotId") or p.get("summonerName")
                if p_id == active_riot_id:
                    # TFT'de all_players[].hp yok — LoL struct'ı recycled.
                    # HP için OCR veya başka yol lazım.
                    break

            return {
                "connected": True,
                "level": int(level) if level is not None else None,
                "hp": None,  # Live API TFT'de HP vermiyor (bölüm 14.8)
                "all_players": all_players,
                "game_time": game_data.get("gameTime", 0),
            }
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, ConnectionError, OSError, ssl.SSLError):
            # Oyun kapalı / port 2999 kapalı / TFT değil
            return None
        except Exception:
            return None

    def _process_gold_crop(self, gold_crop: "Image.Image", threshold: int, scale: int) -> "Image.Image":
        """Bir gold crop'ı Tesseract için hazırla: beyaz text → siyah, arka plan → beyaz, upscale.

        Args:
            gold_crop: kırpılmış PIL Image (RGB).
            threshold: beyaz saymak için R/G/B alt sınırı (0-255).
            scale: upscale çarpanı (Tesseract küçük text için 3-4x önerilir).

        Returns:
            İşlenmiş grayscale PIL Image (Tesseract'a verilecek).
        """
        import numpy as _np
        try:
            arr = _np.array(gold_crop)
            r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
            # Beyaz tespiti: R, G, B hepsi threshold'dan büyük
            is_white = (r > threshold) & (g > threshold) & (b > threshold)
            # Tesseract "siyah text, beyaz arka plan" ister → beyaz text'i siyah yap.
            bw = _np.where(is_white, 0, 255).astype(_np.uint8)
            from PIL import Image as _PIL
            processed = _PIL.fromarray(bw, mode="L")
        except ImportError:
            # numpy yoksa fallback: grayscale + invert (yaklaşık)
            processed = gold_crop.convert("L")
            from PIL import ImageOps as _ImageOps
            processed = _ImageOps.invert(processed)

        # Upscale (LANCZOS — keskin kenar)
        processed = processed.resize(
            (processed.width * scale, processed.height * scale), Image.LANCZOS
        )
        return processed

    def _ocr_digits(self, processed: "Image.Image", psm: int = 7) -> Optional[int]:
        """Tesseract ile sadece rakam oku. PSM 7 (tek satır) önerilir.

        Returns:
            int gold değeri, veya None (OCR fail / sanity dışı).
        """
        text = pytesseract.image_to_string(
            processed,
            config=f"--psm {psm} -c tessedit_char_whitelist=0123456789",
        ).strip()
        if not text:
            return None
        digits = "".join(c for c in text if c.isdigit())
        if not digits:
            return None
        gold = int(digits)
        # TFT gold 0-999 arası (pratikte 0-200, ama augment/galio vs ile teorik 999)
        if 0 <= gold <= 999:
            return gold
        return None

    def read_gold_v2(self, img: "Image.Image", debug: bool = False) -> dict:
        """Gold OCR — çoklu varyant dener, en iyi sonucu seçer.

        PLAN.md 15.7'ye göre: kullanıcı bir ekran görüntüsü verir, 8 farklı
        threshold/koordinat/scale ayarı deneriz, hangisinin çalıştığını söyler.

        Args:
            img: PIL Image, tam ekran görüntü (1920x1080 beklenir).
            debug: True ise her varyantın raw + processed görüntüsünü diske kaydet.

        Returns:
            {
                "gold": Optional[int],          # en iyi okuma (ilk başarılı varyant)
                "best_variant": Optional[str],  # hangi varyant çalıştı
                "variants": [                   # tüm varyantların sonucu
                    {"name": str, "gold": Optional[int], "raw_ocr": str}
                ],
            }
        """
        if not TESSERACT_AVAILABLE:
            return {"gold": None, "best_variant": None, "variants": [], "error": "tesseract yok"}

        W, H = img.size
        scale_x = W / 1920.0
        scale_y = H / 1080.0

        results = []
        best_gold = None
        best_name = None

        for name, bbox, threshold, scale, psm in GOLD_VARIANTS:
            box = (
                int(bbox[0] * scale_x),
                int(bbox[1] * scale_y),
                int(bbox[2] * scale_x),
                int(bbox[3] * scale_y),
            )
            try:
                crop = img.crop(box)
                processed = self._process_gold_crop(crop, threshold, scale)

                if debug:
                    import os
                    debug_dir = "./debug-gold"
                    os.makedirs(debug_dir, exist_ok=True)
                    ts = int(time.time() * 1000) % 1_000_000_000
                    safe = name.replace("/", "_")
                    crop.save(f"{debug_dir}/gold_raw_{safe}_{ts}.png")
                    processed.save(f"{debug_dir}/gold_processed_{safe}_{ts}.png")

                raw = pytesseract.image_to_string(
                    processed,
                    config=f"--psm {psm} -c tessedit_char_whitelist=0123456789",
                ).strip()
                gold = self._ocr_digits(processed, psm)

                results.append({"name": name, "gold": gold, "raw_ocr": raw})

                if gold is not None and best_gold is None:
                    best_gold = gold
                    best_name = name
            except Exception as e:
                if debug:
                    print(f"  [gold-debug] {name} hata: {e}")
                results.append({"name": name, "gold": None, "raw_ocr": f"ERR: {e}"})

        if debug:
            # Tam ekranı da kaydet — koordinatların doğru yerde mi kontrol et
            import os
            debug_dir = "./debug-gold"
            os.makedirs(debug_dir, exist_ok=True)
            ts = int(time.time() * 1000) % 1_000_000_000
            img.save(f"{debug_dir}/fullscreen_{ts}.png")
            print(f"  [gold-debug] best: {best_name} → {best_gold}")
            for r in results:
                print(f"  [gold-debug] {r['name']}: raw='{r['raw_ocr']}' gold={r['gold']}")

        return {"gold": best_gold, "best_variant": best_name, "variants": results}

    def read_gold(self, img: "Image.Image", debug: bool = False) -> Optional[int]:
        """Tesseract ile gold oku.

        Args:
            img: PIL Image, tam ekran görüntü (1920x1080 beklenir).
            debug: True ise kırpılan görüntüyü + Tesseract raw çıktısını diske kaydet.

        Returns:
            int gold değeri, veya None (OCR fail / Tesseract yok).
        """
        if not TESSERACT_AVAILABLE:
            return None

        W, H = img.size
        # 1920x1080 koordinatlarını mevcut çözünürlüğe scale et.
        scale_x = W / 1920.0
        scale_y = H / 1080.0
        box = (
            int(GOLD_CROP_1080P[0] * scale_x),
            int(GOLD_CROP_1080P[1] * scale_y),
            int(GOLD_CROP_1080P[2] * scale_x),
            int(GOLD_CROP_1080P[3] * scale_y),
        )

        try:
            # Kırp
            gold_crop = img.crop(box)

            # TFT gold sayısı BEYAZ renkte (sarı olan solundaki ikon, sayı beyaz).
            # Arka plan koyu (lacivert/siyah).
            # Tesseract "siyah text, beyaz arka plan" bekler.
            # Beyaz pikselleri siyah yap, koyu pikselleri beyaz yap (invert).
            import numpy as _np
            try:
                arr = _np.array(gold_crop)
                # Beyaz tespiti: R, G, B hepsi yüksek (>180)
                r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
                is_white = (r > 180) & (g > 180) & (b > 180)
                # Siyah-beyaz görüntü: beyaz text=0 (siyah), arka plan=255 (beyaz)
                bw = _np.where(is_white, 0, 255).astype(_np.uint8)
                from PIL import Image as _PIL
                processed = _PIL.fromarray(bw, mode="L")
            except ImportError:
                # numpy yoksa fallback: grayscale + invert
                processed = gold_crop.convert("L")
                from PIL import ImageOps as _ImageOps
                processed = _ImageOps.invert(processed)

            # 3x upscale (Tesseract küçük text'i daha iyi okur)
            processed = processed.resize((processed.width * 3, processed.height * 3), Image.LANCZOS)

            # Debug: kırpılan görüntüyü + processed görüntüyü + TAM EKRAN kaydet
            if debug:
                import os
                debug_dir = "./debug-gold"
                os.makedirs(debug_dir, exist_ok=True)
                ts = int(time.time() * 1000) % 1_000_000_000
                gold_crop.save(f"{debug_dir}/gold_raw_{ts}.png")
                processed.save(f"{debug_dir}/gold_processed_{ts}.png")
                # Tam ekran görüntüsünü de kaydet — koordinatların doğru yerde mi kontrol et
                img.save(f"{debug_dir}/fullscreen_{ts}.png")

            # Tesseract — sadece rakam whitelist, PSM 7 (single line)
            text = pytesseract.image_to_string(
                processed,
                config="--psm 7 -c tessedit_char_whitelist=0123456789",
            ).strip()

            if debug:
                print(f"  [gold-debug] raw OCR: '{text}'")

            if not text:
                return None

            # İlk rakam grubunu al
            digits = "".join(c for c in text if c.isdigit())
            if not digits:
                return None

            gold = int(digits)
            # Sanity: TFT gold 0-999 arası
            if 0 <= gold <= 999:
                return gold
            return None
        except Exception as e:
            if debug:
                print(f"  [gold-debug] hata: {e}")
            return None

    def read(self, img: Optional["Image.Image"] = None, debug: bool = False) -> dict:
        """Hem Live API hem OCR (varsa) çalıştır, birleşik sonuç döndür.

        Args:
            img: PIL Image (gold OCR için). None ise sadece Live API.
            debug: True ise gold OCR debug modu (diske kaydet + log).

        Returns:
            {
                "connected": bool,
                "level": Optional[int],     # Live API'den
                "hp": Optional[int],        # Live API'den (TFT'de None)
                "gold": Optional[int],      # OCR'den
                "all_players": list,        # Live API'den
                "game_time": float,         # Live API'den
            }
            Live API yoksa connected=False, hepsi None.
        """
        live = self.read_live_api()

        if live is None:
            return {
                "connected": False,
                "level": None,
                "hp": None,
                "gold": None,
                "all_players": [],
                "game_time": 0,
            }

        # Gold OCR (img verildiyse)
        gold = None
        if img is not None:
            gold = self.read_gold(img, debug=debug)

        return {
            "connected": live["connected"],
            "level": live["level"],
            "hp": live["hp"],  # TFT'de None
            "gold": gold,
            "all_players": live["all_players"],
            "game_time": live["game_time"],
        }


# ─── Test (komut satırı) ────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Local Reader Test")
    print("=" * 50)

    reader = LocalReader()

    # Live API test
    print("\n[1] Live API test (TFT açık olmalı)...")
    live = reader.read_live_api()
    if live is None:
        print("  ❌ Live API yok. TFT açık mı? Port 2999 çalışıyor mu?")
    else:
        print(f"  ✅ Connected: {live['connected']}")
        print(f"  Level: {live['level']}")
        print(f"  HP: {live['hp']}")
        print(f"  Players: {len(live['all_players'])}")
        print(f"  Game time: {live['game_time']:.1f}s")

    # Tesseract test
    print("\n[2] Tesseract test...")
    if TESSERACT_AVAILABLE:
        print("  ✅ Tesseract yüklü")
    else:
        print("  ❌ Tesseract yok. Kur: pip install pytesseract pillow")
        print("     + Tesseract binary: https://github.com/UB-Mannheim/tesseract/wiki")

    print("\n" + "=" * 50)
    print("Test bitti.")
