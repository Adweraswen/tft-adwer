#!/usr/bin/env python3
"""
TFT Adwer — Capture Client
==========================

Bu script PC'nizde çalışır, her N saniyede ekranın bir bölgesini (veya tamamını)
yakalar ve TFT Adwer web uygulamasına yollar. Web uygulaması VLM ile görüntüyü
analiz eder ve canlı önerileri tarayıcıda gösterir.

KURULUM
-------
    pip install mss requests pillow

    # Arka plan yakalama için (opsiyonel — alt-tab yapsan bile TFT'yi okur):
    pip install windows-capture

ÖNEMLİ — MAÇ İÇİ pencere
------------------------
League of Legends'da TFT maç içi penceresi:

  - Başlık  : "League of Legends (TM) Client"
  - Process : League of Legends.exe
  - Boyut   : tam ekran (örn. 1920x1080)
  - İçerik  : TFT tahtası, şampiyonlar, HP/gold/level göstergeleri

VLM BUNU okumalı. (Dikkat: "League of Legends" başlıklı küçük 160x28 pencere
varsa o splash/tray penceresidir, atlanır.)

--background modunda --window vermezseniz varsayılan olarak
"League of Legends (TM) Client" kullanılır.

ÇALIŞTIRMA
---------
    # Tam ekran yakala, 4 saniyede bir yolla
    python capture.py --url https://your-sandbox-url/api/snapshot --interval 4

    # Sadece TFT maç içi pencereyi yakala (önerilen — daha az bant genişliği)
    python capture.py --url https://... --interval 4 --window "League of Legends (TM) Client"

    # Arka plan yakalama (alt-tab yapsan bile TFT'yi okur — windows-capture gerekli)
    # --window verilmezse varsayılan: "League of Legends (TM) Client"
    python capture.py --url https://... --interval 10 --background -v

    # DEBUG: her frame'i diske kaydet (VLM yanlış ekran okuyorsa ne yakalandığını gör)
    python capture.py --url https://... --interval 10 --background --save-frames ./debug-frames -v

    # Belirli bir bölgeyi yakala (x y w h, 1080p TFT için yaklaşık)
    python capture.py --url https://... --region 0 0 1920 1080

GÜVENLİK
--------
- Sadece ekran yakalar ve HTTP POST yapar. Hiçbir oyun dosyasını okumaz/değiştirmez.
- Oyuna müdahale etmez (tıklama/kadı-klavye yok). Sadece okur.
- Anti-cheat tetiklemez — League of Legends Anti-Cheat ekran yakalamaya karışmaz.
- URL'i kendi web uygulamanızla değiştirin.

NOTLAR
------
- mss çok hızlıdır (~5ms yakalama). Band genişliği: ~200KB/screenshot (JPEG kalite 80).
- VLM analizi web tarafında ~3 saniye sürer. interval=4 önerilir.
- --background (windows-capture) TFT'yi arka planda yakalar. Alt-tab yapıp
  tarayıcıya baksan bile TFT okumaya devam eder. DirectX oyunlarını destekler.
- Çıkmak için Ctrl+C.
"""

from __future__ import annotations

import argparse
import base64
import io
import signal
import sys
import time
from typing import Optional

# `requests` is always needed for POSTing screenshots to the server.
try:
    import requests
except ImportError:
    print("Eksik bağımlılık: requests")
    print("Çalıştır: pip install requests")
    sys.exit(1)

# `mss` and `PIL` are only needed for screen capture. We defer these imports
# to capture-mode startup so the script can show --help without them.
mss = None
Image = None

# Optional: when --save-frames is set, every captured frame is saved to this
# directory as a JPEG. Set in main() from the CLI flag. Useful for debugging
# "VLM reads wrong screen" issues — you can inspect exactly what was captured.
SAVE_FRAMES_DIR: Optional[str] = None

# Local reader (Live API + gold OCR) — main() içinde --use-local flag ile
# oluşturulur. None ise local data kullanılmaz, sadece VLM çalışır.
_LOCAL_READER = None
# Gold debug mode — --gold-debug flag. True ise gold OCR görüntüleri diske kaydedilir.
_GOLD_DEBUG = False


# ─── Window finding (Windows only) ──────────────────────────────────────────

def find_window_region(title: str) -> Optional[tuple[int, int, int, int]]:
    """Find a window by title and return (left, top, width, height). Windows only."""
    try:
        import win32gui
    except ImportError:
        print("Uyarı: win32gui yok — pip install pywin32 (Windows'ta pencere bulma için)")
        return None

    result = {}

    def callback(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            window_text = win32gui.GetWindowText(hwnd)
            if title.lower() in window_text.lower():
                rect = win32gui.GetWindowRect(hwnd)  # (left, top, right, bottom)
                result["rect"] = (rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1])

    win32gui.EnumWindows(callback, None)
    return result.get("rect")


# ─── Background capture via Windows Graphics Capture API ─────────────────────
#
# windows-capture wraps the modern WGC API (Windows 10 1903+). Unlike mss (which
# grabs whatever is visible on screen), WGC captures a specific WINDOW — even
# when that window is behind other windows (alt-tabbed). This is exactly what we
# need: the user alt-tabs to Chrome to read advisor suggestions, but capture.py
# keeps reading the TFT window in the background.
#
# WGC is event-driven: it continuously produces frames. We run it on a daemon
# thread and keep only the LATEST frame in a buffer. The main capture loop calls
# grab_latest() on its own interval (no need to match WGC's frame rate).
#
# Requires: pip install windows-capture numpy
# Requires: Windows 10 1903+ (WGC API)

class BackgroundCapturer:
    """Capture a specific window in the background using Windows Graphics Capture.

    Starts a daemon thread that continuously captures frames. grab_latest()
    returns the most recent frame as a PIL Image (or None if no frame yet).

    Only works on Windows 10 1903+ with `windows-capture` installed.
    """

    def __init__(self, window_title: str, verbose: bool = False):
        self.window_title = window_title
        self.verbose = verbose
        self._latest_img = None  # PIL.Image (RGB)
        self._lock = __import__("threading").Lock()
        self._closed = False
        self._frame_count = 0
        self._capture = None
        self._thread = None
        # Error throttling — the WGC daemon thread fires 60+ fps. Without
        # throttling, a persistent error (API mismatch, lost surface) would
        # spam the console hundreds of times per second. We log the first
        # error immediately, then at most once per 10s, and reset on success.
        self._err_count = 0              # errors since last successful frame
        self._err_logged_at = 0.0        # monotonic time of last error log
        self._first_err_logged = False   # has the first error been logged?
        self._start()

    def _start(self):
        try:
            from windows_capture import WindowsCapture, Frame, InternalCaptureControl
            import numpy as np
        except ImportError as e:
            raise RuntimeError(
                "windows-capture kütüphanesi yok. Arka plan yakalama için gerekli.\n"
                "Kur: pip install windows-capture numpy"
            ) from e

        # WGC needs either a window_name or monitor_index. We use window_name.
        # The title match is EXACT in windows-capture (not substring), so we
        # first resolve the full window title via win32gui.
        full_title = self._resolve_full_title(self.window_title)
        if not full_title:
            raise RuntimeError(
                f"'{self.window_title}' penceresi bulunamadı (veya sadece terminal/tarayıcı "
                f"penceresi match oldu — bu güvenlik filtresi tarafından reddedildi).\n"
                f"  TFT açık ve oyun içi client'ta olduğundan emin ol.\n"
                f"  Doğru pencere adını bulmak için şunu çalıştır:\n"
                f"    python capture.py --list-windows\n"
                f"  Çıktıda ★ işaretli satır TFT'nin penceresidir. Başlığı kopyala ve "
                f"--window parametresine yapıştır."
            )
        if self.verbose:
            print(f"  [bg] pencere bulundu: '{full_title}'")

        try:
            self._capture = WindowsCapture(
                cursor_capture=None,
                draw_border=None,
                monitor_index=None,
                window_name=full_title,
            )
        except Exception as e:
            raise RuntimeError(f"WindowsCapture başlatılamadı: {e}") from e

        @self._capture.event
        def on_frame_arrived(frame: Frame, capture_control: InternalCaptureControl):
            try:
                # Extract an OWNED RGB uint8 (H,W,3) numpy array from the Frame.
                # windows-capture's Frame.frame_buffer is a zero-copy VIEW into
                # Rust-owned memory that is freed when this callback returns, so
                # _extract_rgb_array MUST return an owned copy (np.ascontiguousarray).
                rgb = self._extract_rgb_array(frame)
                img = Image.fromarray(rgb, "RGB")
                with self._lock:
                    self._latest_img = img
                    self._frame_count += 1
                    # Reset error throttle on success
                    self._err_count = 0
                    self._first_err_logged = False
            except Exception as e:
                with self._lock:
                    self._err_count += 1
                    err_total = self._err_count
                # Throttle logging: first error immediately, then once per 10s.
                # This prevents 60+/sec spam when the API mismatches.
                now = time.monotonic()
                should_log = False
                with self._lock:
                    if not self._first_err_logged:
                        should_log = True
                        self._first_err_logged = True
                        self._err_logged_at = now
                    elif now - self._err_logged_at >= 10.0:
                        should_log = True
                        self._err_logged_at = now
                if should_log and self.verbose:
                    if err_total == 1:
                        print(f"  [bg] frame dönüştürme hatası: {e}")
                    else:
                        print(f"  [bg] frame dönüştürme hatası: {e} ({err_total} frame etkilendi, sessize alındı)")
                    # Surface available Frame attrs so the user can report the
                    # exact API if our extraction guess missed.
                    if "not subscriptable" in str(e) or "attribute" in str(e).lower():
                        attrs = self._frame_attrs(frame)
                        print(f"  [bg] → windows-capture Frame özellikleri: {attrs}")
                        print(f"  [bg] → capture.py çalışmaya devam ediyor; TFT oyuna girince frame'ler düzelecek mi göreceğiz.")

        @self._capture.event
        def on_closed():
            self._closed = True
            if self.verbose:
                print("  [bg] capture oturumu kapandı (pencere kapatılmış olabilir)")

        import threading
        self._thread = threading.Thread(target=self._capture.start, daemon=True)
        self._thread.start()

    @staticmethod
    def _get_process_name(hwnd: int) -> str:
        """Return the executable name (lowercased, e.g. 'python.exe') for the
        process that owns `hwnd`, or '' if it can't be determined.

        Strategy (try multiple methods — some fail on certain Windows configs):
          1. ctypes + psapi GetModuleBaseNameW with PROCESS_QUERY_LIMITED_INFORMATION
          2. pywin32 win32process + win32api.GetModuleFileNameEx (fallback)
          3. QueryFullProcessImageName (most permissive, Win Vista+)

        Returns "" only if all methods fail. Note: on some systems (e.g. user
        running without admin), the process name can't be read for elevated
        processes — in that case we return "" and the caller falls back to
        title+size based matching.
        """
        # First, get the PID
        pid = 0
        try:
            import win32process
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
        except Exception:
            try:
                import ctypes
                from ctypes import wintypes
                user32 = ctypes.WinDLL("user32", use_last_error=True)
                pid_val = wintypes.DWORD()
                user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid_val))
                pid = pid_val.value
            except Exception:
                pid = 0
        if not pid:
            return ""

        # Method 1: ctypes + psapi
        try:
            import ctypes
            from ctypes import wintypes
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            psapi = ctypes.WinDLL("psapi", use_last_error=True)
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if handle:
                try:
                    buf = ctypes.create_unicode_buffer(1024)
                    if psapi.GetModuleBaseNameW(handle, None, buf, 1024):
                        return buf.value.lower()
                finally:
                    kernel32.CloseHandle(handle)
        except Exception:
            pass

        # Method 2: pywin32
        try:
            import win32api
            import win32process
            import win32con
            handle = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if handle:
                try:
                    try:
                        # GetModuleFileNameEx sometimes works where GetModuleBaseName fails
                        name = win32process.GetModuleFileNameEx(handle, 0)
                        if name:
                            import os
                            return os.path.basename(name).lower()
                    except Exception:
                        pass
                finally:
                    win32api.CloseHandle(handle)
        except Exception:
            pass

        # Method 3: QueryFullProcessImageNameW (Vista+) — most permissive
        try:
            import ctypes
            from ctypes import wintypes
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if handle:
                try:
                    buf = ctypes.create_unicode_buffer(1024)
                    size = wintypes.DWORD(1024)
                    # QueryFullProcessImageNameW(handle, flags=0, buffer, &size)
                    if kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
                        import os
                        return os.path.basename(buf.value).lower()
                finally:
                    kernel32.CloseHandle(handle)
        except Exception:
            pass

        return ""

    # Process names that should NEVER be matched as the TFT game window — even
    # if their window title happens to contain the search string. The classic
    # trap: when the user runs `python capture.py --window "League of Legends
    # (TM) Client"`, the terminal window title contains that exact string as a
    # command-line argument, so a naive substring match would match the
    # TERMINAL instead of the game. This exclude list prevents that.
    _EXCLUDE_PROCESSES = {
        "python.exe", "pythonw.exe", "py.exe",
        "windowsterminal.exe", "powershell.exe", "cmd.exe",
        "conhost.exe", "alacritty.exe", "wezterm.exe",
        "code.exe", "cursor.exe", "sublime_text.exe",
        "chrome.exe", "firefox.exe", "msedge.exe", "brave.exe",
        "explorer.exe", "discord.exe", "steam.exe",
    }

    # MAÇ İÇİ oyun penceresi — VLM BUNU okumalı. TFT tahtası, HP/gold/level
    # göstergeleri burada görünür. Pencere başlığı "League of Legends (TM) Client"
    # (1920x1080 gibi tam ekran boyutunda).
    _GAME_PROCESSES = {
        "league of legends.exe",       # in-game TFT window — MAÇ İÇİ
    }

    # LOBBY/launcher pencereleri. Bunlar genelde küçük pencere boyutludur
    # (splash, tray, arkadaş listesi). Maç içi pencere bulunamazsa fallback
    # olarak kullanılabilirler.
    _LOBBY_PROCESSES = {
        "leagueclient.exe",            # League lobby/launcher
        "leagueclientux.exe",          # League UI process
    }

    # Minimum pencere boyutu. 160x28 gibi küçük pencereler splash/tray'dir,
    # gerçek oyun penceresi en az 800x600 olmalı. Bu eşik altındaki pencereler
    # game/lobby process olsa bile atlanır.
    _MIN_GAME_WIDTH = 800
    _MIN_GAME_HEIGHT = 500

    @staticmethod
    def _get_window_size(hwnd: int) -> tuple[int, int]:
        """Return (width, height) of a window, or (0, 0) on failure."""
        try:
            import win32gui
            rect = win32gui.GetWindowRect(hwnd)  # (left, top, right, bottom)
            return (rect[2] - rect[0], rect[3] - rect[1])
        except Exception:
            return (0, 0)

    @staticmethod
    def _resolve_full_title(substring: str) -> Optional[str]:
        """Find the TFT MAÇ İÇİ window by title, process name, and size.

        TFT'de maç içi pencere:
          - Başlık  : "League of Legends (TM) Client"
          - Process : League of Legends.exe
          - Boyut   : tam ekran (örn. 1920x1080)

        Küçük "League of Legends" (160x28) penceresi splash/tray'dir, atlanır.

        Strategy (tiered — en güvenilirten en az güvenilire):
          1. Tier 1: game process (League of Legends.exe) + boyut yeterli
          2. Tier 2: lobby process (LeagueClient.exe) + boyut yeterli (fallback)
          3. Tier 3: process alınamadıysa ("") → sadece boyuta güven
                     (büyük pencere = oyun penceresi)
          4. Tier 4: process alınamadıysa ve boyut da yetersizse, yine de
                     ilk match'i döndür (son çare)
          5. Hiçbiri yoksa None döner (caller hata basar).

        NOT: Bazı Windows konfigürasyonlarında (özellikle kullanıcının kendi
        hesabından çalıştırılan elevated olmayan process'ler için) process adı
        alınamayabiliyor. Bu durumda boyut filtresi devreye girer.
        """
        try:
            import win32gui
        except ImportError:
            # No pywin32 — return the substring as-is (WGC will try exact match)
            return substring

        # (title, process_name, hwnd, width, height)
        matches: list[tuple[str, str, int, int, int]] = []

        def callback(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return
            t = win32gui.GetWindowText(hwnd)
            if not t or substring.lower() not in t.lower():
                return
            exe = BackgroundCapturer._get_process_name(hwnd)
            w, h = BackgroundCapturer._get_window_size(hwnd)
            matches.append((t, exe, hwnd, w, h))

        win32gui.EnumWindows(callback, None)

        if not matches:
            return None

        min_w = BackgroundCapturer._MIN_GAME_WIDTH
        min_h = BackgroundCapturer._MIN_GAME_HEIGHT

        # Tier 1: MAÇ İÇİ process + boyut yeterli
        for title, exe, hwnd, w, h in matches:
            if exe in BackgroundCapturer._GAME_PROCESSES and w >= min_w and h >= min_h:
                return title

        # Tier 2: LOBBY process + boyut yeterli (maç içi yoksa, fallback)
        for title, exe, hwnd, w, h in matches:
            if exe in BackgroundCapturer._LOBBY_PROCESSES and w >= min_w and h >= min_h:
                return title

        # Tier 3: process alınamadı ("") → boyuta güven.
        # Kullanıcının PC'sinde process adı boş geliyorsa (permission sorunu),
        # en büyük pencereyi al. Terminal/editor/browser pencereleri zaten
        # title substring ile elenmediyse bile burada büyük olanı seçeriz.
        no_proc_big = [(t, w, h) for t, exe, hwnd, w, h in matches
                       if not exe and w >= min_w and h >= min_h]
        if no_proc_big:
            # En büyük alanlı olanı seç
            no_proc_big.sort(key=lambda x: x[1] * x[2], reverse=True)
            return no_proc_big[0][0]

        # Tier 4: process var ama excluded değilse + boyut yeterli
        for title, exe, hwnd, w, h in matches:
            if exe and exe not in BackgroundCapturer._EXCLUDE_PROCESSES and w >= min_w and h >= min_h:
                return title

        # Tier 5: son çare — boyut yeterli olan ilk match (process bilinmese bile)
        for title, exe, hwnd, w, h in matches:
            if w >= min_w and h >= min_h:
                return title

        # Tier 6: hiçbiri yeterli değil — None döner, caller net hata basar
        return None

    @staticmethod
    def _extract_rgb_array(frame):
        """Extract an OWNED RGB uint8 numpy array (H, W, 3) from a windows-capture Frame.

        Verified API (windows-capture 1.1.9 through 2.0.0):
          - Graphics-Capture `Frame.frame_buffer` is a numpy ndarray, dtype uint8,
            shape (H, W, 4), channel order BGRA. It is a ZERO-COPY view into
            Rust-owned memory that is freed when `on_frame_arrived` returns.
          - `Frame.convert_to_bgr()` returns a *Frame* (NOT an ndarray) whose
            `frame_buffer` is a (H, W, 3) BGR view. Using it was our bug.

        We read `frame.frame_buffer` directly, slice BGRA->RGB ([2,1,0], drop
        alpha), and return `np.ascontiguousarray(...)` so the caller gets an
        OWNED copy that survives the callback. Fallbacks cover the v2.0.0
        DxgiDuplicationFrame (`.to_numpy()`) and any custom Frame variant.
        """
        import numpy as np

        # Primary path: Graphics-Capture Frame.frame_buffer (BGRA uint8 HxWx4)
        buf = getattr(frame, "frame_buffer", None)
        if isinstance(buf, np.ndarray) and buf.ndim == 3:
            if buf.shape[2] == 4:  # BGRA -> RGB
                return np.ascontiguousarray(buf[:, :, 2::-1])
            if buf.shape[2] == 3:  # BGR -> RGB
                return np.ascontiguousarray(buf[:, :, ::-1])

        # Fallback 1: DxgiDuplicationFrame (v2.0.0) exposes to_numpy()
        to_numpy = getattr(frame, "to_numpy", None)
        if callable(to_numpy):
            try:
                arr = to_numpy()
                if isinstance(arr, np.ndarray) and arr.ndim == 3:
                    if arr.shape[2] == 4:
                        return np.ascontiguousarray(arr[:, :, 2::-1])
                    if arr.shape[2] == 3:
                        return np.ascontiguousarray(arr[:, :, ::-1])
            except Exception:
                pass

        # Fallback 2: probe common attribute names (defensive — covers unknown forks)
        for attr in (
            "numpy", "raw_data", "data", "ndarray", "pixels",
            "buffer", "array", "raw", "image",
        ):
            val = getattr(frame, attr, None)
            if isinstance(val, np.ndarray) and val.ndim == 3:
                if val.shape[2] == 4:
                    return np.ascontiguousarray(val[:, :, 2::-1])
                if val.shape[2] == 3:
                    return np.ascontiguousarray(val[:, :, ::-1])

        # Last resort — surface the available attrs so the user can report back
        attrs = [a for a in dir(frame) if not a.startswith("_")]
        raise RuntimeError(
            f"Frame'den numpy array çıkarılamadı. Frame özellikleri: {attrs}"
        )

    @staticmethod
    def _frame_attrs(frame) -> list:
        """Return the public attribute names of a Frame (for diagnostics)."""
        try:
            return [a for a in dir(frame) if not a.startswith("_")]
        except Exception:
            return []

    def grab_latest(self):
        """Return the latest captured frame as a PIL Image (RGB), or None."""
        with self._lock:
            if self._latest_img is None:
                return None
            # Return a copy so the caller can crop/encode without racing the writer
            return self._latest_img.copy()

    @property
    def frame_count(self) -> int:
        with self._lock:
            return self._frame_count

    @property
    def is_closed(self) -> bool:
        return self._closed


def is_tft_foreground(tft_title: str = "League of Legends (TM) Client") -> tuple[bool, str]:
    """
    Check if TFT MAÇ İÇİ is currently the foreground window.

    Returns (is_foreground, foreground_window_title).
    On non-Windows or if pywin32 is missing, returns (True, "unknown") so capture
    proceeds (the user can still use the script without this guard).

    NOT: TFT'de maç içi pencere başlığı "League of Legends (TM) Client"
    (League of Legends.exe, 1920x1080 gibi tam ekran). Bu varsayılan.
    """
    try:
        import win32gui
    except ImportError:
        return True, "unknown (no pywin32)"

    try:
        hwnd = win32gui.GetForegroundWindow()
        title = win32gui.GetWindowText(hwnd) if hwnd else ""
        # TFT maç içi pencere başlığı: "League of Legends (TM) Client"
        # (League of Legends.exe process). "League of Legends" substring'i
        # yeterli — splash küçük pencere foreground olmaz zaten.
        is_tft = bool(hwnd) and "league of legends" in title.lower()
        return is_tft, title
    except Exception as e:
        return True, f"error: {e}"


# ─── Capture + send loop ────────────────────────────────────────────────────

# ─── Board/bench crop regions (percentage of captured image) ────────────────
# These are RELATIVE to the captured image dimensions so they work at any
# resolution (1920x1080, 2560x1440, 1600x900 windowed, etc.). TFT's UI layout
# is always 16:9 and the board/bench positions are proportionally fixed.
#
# Layout (1920x1080 reference):
#   - Top-center (~2-5% H)         : stage-round "3-2"
#   - Top-right                    : leaderboard (OTHER players' HP — NOT yours)
#   - Center (~12-67% H, 25-75% W) : YOUR hex board (4 rows x 7 cols of hexagons)
#   - Below board (~67-78% H)      : YOUR bench (1 row of 9 slots)
#   - Bottom bar (~80-95% H)       : shop (5 cards), gold, level, XP, your HP
#   - Right edge (~80-100% W)      : trait/synergy panel (NOT champions!)
#
# The crop gives the VLM a ZOOMED-IN view of just the board / bench so it
# can't confuse them with the trait panel on the right edge. The full
# screenshot is still sent too (for stats: stage/gold/hp/level).
BOARD_CROP = (0.25, 0.12, 0.75, 0.67)   # (left, top, right, bottom) as fractions
BENCH_CROP = (0.25, 0.67, 0.75, 0.78)


def crop_to_data_url(img, box_frac: tuple[float, float, float, float], quality: int) -> str:
    """Crop `img` using fractional box (left, top, right, bottom) and return JPEG base64 data URL."""
    W, H = img.size
    box = (
        max(0, int(W * box_frac[0])),
        max(0, int(H * box_frac[1])),
        min(W, int(W * box_frac[2])),
        min(H, int(H * box_frac[3])),
    )
    # Guard against degenerate boxes
    if box[2] <= box[0] or box[3] <= box[1]:
        return ""
    cropped = img.crop(box)
    # Upscale 2x so small champion portraits / star indicators are easier for the VLM to read.
    # NEAREST keeps pixel edges sharp (no smoothing artifacts on text/icons).
    cropped = cropped.resize((cropped.width * 2, cropped.height * 2), Image.NEAREST)
    buf = io.BytesIO()
    cropped.save(buf, format="JPEG", quality=quality)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def capture_and_send(
    sct: mss.mss,
    requests_session: requests.Session,
    url: str,
    region: dict,
    monitor_index: int,
    quality: int,
    verbose: bool,
    no_crops: bool = False,
    skip_vlm: bool = False,
) -> tuple[bool, str]:
    """Capture one frame (mss foreground) and POST it. Returns (ok, message).

    Sends the full screenshot PLUS cropped board and bench regions so the VLM
    can read champions from a zoomed-in view (avoiding confusion with the
    trait panel). Pass no_crops=True to disable (legacy/fallback behavior).
    """
    t0 = time.monotonic()

    # Grab via mss (foreground only — captures whatever is visible on screen)
    try:
        shot = sct.grab(region)
    except Exception as e:
        return False, f"yakalama hatası: {e}"

    # Convert BGRA -> RGB PIL Image
    try:
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
    except Exception as e:
        return False, f"görüntü dönüşüm hatası: {e}"

    return send_image(img, requests_session, url, quality, verbose, no_crops, t0, skip_vlm=skip_vlm)


def send_image(
    img,
    requests_session: requests.Session,
    url: str,
    quality: int,
    verbose: bool,
    no_crops: bool = False,
    t0: Optional[float] = None,
    skip_vlm: bool = False,
) -> tuple[bool, str]:
    """Encode a PIL Image (RGB) to JPEG + crops, POST to server. Returns (ok, message).

    This is the shared send path used by both:
      - capture_and_send()  → foreground mss capture
      - main loop           → background WGC capture (BackgroundCapturer.grab_latest())

    Sends the full screenshot PLUS cropped board and bench regions so the VLM
    can read champions from a zoomed-in view. Pass no_crops=True to disable.

    skip_vlm=True: image encode + crops TAMAMEN atlanır. Sadece Live API +
    gold OCR verisi gönderilir (payload.skipVlm=true). Sunucu VLM çağırmaz,
    direkt localData'dan state üretir. HP/gold/level testi için — VLM
    halüsinasyonları sıfır, hız ~50ms (normal VLM 3-8s).
    """
    if t0 is None:
        t0 = time.monotonic()

    # Debug: save the raw captured frame to disk before encoding/sending.
    # Lets the user inspect exactly what WGC/mss captured — critical for
    # diagnosing "VLM reads wrong screen" issues.
    if SAVE_FRAMES_DIR:
        try:
            import os
            os.makedirs(SAVE_FRAMES_DIR, exist_ok=True)
            ts = int(time.time() * 1000) % 1_000_000_000
            path = os.path.join(SAVE_FRAMES_DIR, f"frame_{ts}.jpg")
            img.save(path, format="JPEG", quality=quality)
            if verbose:
                print(f"  [debug] frame kaydedildi: {path}")
        except Exception as e:
            if verbose:
                print(f"  [debug] frame kaydetme hatası: {e}")

    # ─── Skip-VLM mode: image encode'u atla, sadece localData gönder ──────
    # VLM çağrılmayacağı için JPEG encode, base64, crop'lar HİÇBİRİ gerekmez.
    # Bu mod Live API + gold OCR testi için — HP/gold/level doğruluğunu
    # VLM gürültüsü olmadan görmek.
    if skip_vlm:
        payload = {"source": "live", "skipVlm": True}
        if _LOCAL_READER is not None:
            try:
                local = _LOCAL_READER.read(img, debug=_GOLD_DEBUG)
                payload["localData"] = local
                if verbose:
                    print(f"  [skip-vlm] connected={local['connected']} "
                          f"level={local['level']} gold={local['gold']} "
                          f"hp={local['hp']}"
                          + (f" src={local.get('hp_source')}" if local.get('hp_source') else ""))
            except Exception as e:
                if verbose:
                    print(f"  [skip-vlm] local hata: {e}")
                return False, f"local reader hatası: {e}"
        else:
            if verbose:
                print(f"  [skip-vlm] ⚠ --use-local yok, localData boş. skipVlm anlamsız.")
            return False, "skip-vlm requires --use-local"

        resp = requests_session.post(
            url,
            json=payload,
            timeout=30,
        )
        elapsed = time.monotonic() - t0
        if resp.status_code != 200:
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        ok = data.get("ok", False)
        oneliner = (data.get("recommendation") or {}).get("oneLiner", "")
        state = data.get("state") or {}
        summary = (
            f"hp={state.get('hp')} gold={state.get('gold')} "
            f"lvl={state.get('level')} connected={state.get('connected')}"
        )
        if verbose:
            print(f"  [{elapsed*1000:.0f}ms] {summary}")
            if oneliner:
                print(f"  → {oneliner}")
        if not ok and data.get("error"):
            return False, f"sunucu hatası: {data['error']}"
        return True, summary

    # Encode full screenshot to JPEG
    try:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        jpeg_bytes = buf.getvalue()
    except Exception as e:
        return False, f"JPEG dönüşüm hatası: {e}"

    # Base64 data URL — full screenshot (for stats: stage/gold/hp/level)
    b64 = base64.b64encode(jpeg_bytes).decode("ascii")
    data_url = f"data:image/jpeg;base64,{b64}"

    # Crop board + bench regions (zoomed-in views for champion reading)
    board_url = ""
    bench_url = ""
    if not no_crops:
        try:
            board_url = crop_to_data_url(img, BOARD_CROP, quality)
            bench_url = crop_to_data_url(img, BENCH_CROP, quality)
        except Exception as e:
            # Crop failure is non-fatal — server can still analyze the full screenshot
            if verbose:
                print(f"  ⚠ crop hatası (devam ediliyor): {e}")

    # POST
    try:
        payload = {"image": data_url, "source": "live"}
        if board_url:
            payload["boardCrop"] = board_url
        if bench_url:
            payload["benchCrop"] = bench_url

        # Local data (Live API + gold OCR) — capture.py başında _LOCAL_READER
        # oluşturulduysa ekle. Bu veri VLM'i bypass eder: level Live API'den
        # (%100 doğru), gold OCR'den (Tesseract). HP TFT'de Live API'de yok,
        # VLM'den gelecek.
        if _LOCAL_READER is not None:
            try:
                local = _LOCAL_READER.read(img, debug=_GOLD_DEBUG)
                payload["localData"] = local
                if verbose:
                    print(f"  [local] connected={local['connected']} "
                          f"level={local['level']} gold={local['gold']} "
                          f"hp={local['hp']}")
            except Exception as e:
                if verbose:
                    print(f"  [local] hata: {e}")

        resp = requests_session.post(
            url,
            json=payload,
            timeout=30,
        )
        elapsed = time.monotonic() - t0
        if resp.status_code != 200:
            # Detect rate-limit responses (server 429 from VLM upstream, or
            # server "busy" 429 from the in-flight guard). For rate-limit we
            # pause longer; for "busy" we just continue normally.
            try:
                body = resp.json()
            except Exception:
                body = {}
            err_text = str(body.get("error", "")) + " " + str(body.get("message", ""))
            is_rate_limit = (
                "429" in err_text
                or "too many" in err_text.lower()
                or "rate" in err_text.lower()
                or "try again later" in err_text.lower()
            )
            is_busy = body.get("error") == "busy"
            if is_rate_limit:
                # Pause for 60s to let the VLM quota reset
                return False, f"rate-limited (HTTP {resp.status_code}). Pausing 60s. body={resp.text[:120]}"
            if is_busy:
                # Server already has a VLM call in flight — just skip, next interval will retry
                return False, "busy (VLM in flight). Skipped."
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        ok = data.get("ok", False)
        oneliner = ""
        rec = data.get("recommendation") or {}
        oneliner = rec.get("oneLiner", "")
        state = data.get("state") or {}
        summary = (
            f"hp={state.get('hp')} gold={state.get('gold')} "
            f"lvl={state.get('level')} stage={state.get('stage')}-{state.get('round')}"
        )
        if verbose:
            print(f"  [{elapsed:.1f}s] {summary}")
            if oneliner:
                print(f"  → {oneliner}")
        if not ok and data.get("error"):
            return False, f"sunucu hatası: {data['error']}"
        return True, summary
    except requests.RequestException as e:
        return False, f"ağ hatası: {e}"


def list_windows() -> int:
    """Print all visible windows (title + process name + size) and return 0.

    Helps the user discover the exact window title to pass to --window.
    Especially useful for TFT, whose in-game window title is
    "League of Legends (TM) Client" (League of Legends.exe process,
    full-screen size like 1920x1080).

    The marker column shows:
      ★ MAÇ     = game process (League of Legends.exe) + size >= 800x500
      ⚠ BEKLE  = process alınamadı ama boyut büyük (muhtemelen oyun penceresi)
      (boş)    = küçük pencere (splash/tray) veya excluded process
    """
    print("=" * 70)
    print("Görünür pencereler (başlık + process adı + boyut)")
    print("=" * 70)
    try:
        import win32gui
    except ImportError:
        print("win32gui yok — pip install pywin32")
        return 1

    windows: list[tuple[str, str, tuple[int, int, int, int]]] = []

    def callback(hwnd, _):
        if not win32gui.IsWindowVisible(hwnd):
            return
        t = win32gui.GetWindowText(hwnd)
        if not t:
            return
        exe = BackgroundCapturer._get_process_name(hwnd)
        try:
            rect = win32gui.GetWindowRect(hwnd)  # (l, t, r, b)
            w, h = rect[2] - rect[0], rect[3] - rect[1]
            size = (rect[0], rect[1], w, h)
        except Exception:
            size = (0, 0, 0, 0)
        windows.append((t, exe, size))

    win32gui.EnumWindows(callback, None)

    if not windows:
        print("  (hiç görünür pencere yok)")
        return 0

    game_procs = BackgroundCapturer._GAME_PROCESSES    # MAÇ İÇİ
    exclude_procs = BackgroundCapturer._EXCLUDE_PROCESSES
    min_w = BackgroundCapturer._MIN_GAME_WIDTH
    min_h = BackgroundCapturer._MIN_GAME_HEIGHT

    def marker_for(exe: str, w: int, h: int) -> str:
        if exe in game_procs and w >= min_w and h >= min_h:
            return "★ MAÇ"
        # Process alınamadıysa ama başlık "League of Legends" içeriyor ve
        # boyut büyükse muhtemelen oyun penceresidir.
        if not exe and w >= min_w and h >= min_h:
            return "⚠ BEKLE"
        return ""

    def sort_key(item):
        title, exe, size = item
        w, h = size[2], size[3]
        m = marker_for(exe, w, h)
        # ★ MAÇ ilk, ⚠ BEKLE ikinci, diğerleri son
        if m == "★ MAÇ":
            return (0, -w * h, title)
        if m == "⚠ BEKLE":
            return (1, -w * h, title)
        if exe and exe not in exclude_procs:
            return (2, -w * h, title)
        return (3, -w * h, title)

    windows.sort(key=sort_key)

    print(f"\n{'PROCESS':<26} {'BOYUT':<14} {'İŞARET':<10} BAŞLIK")
    print("-" * 70)
    for title, exe, size in windows:
        size_str = f"{size[2]}x{size[3]}" if size[2] > 0 else "?"
        # Truncate title to keep columns aligned
        t_display = title[:55] + ("…" if len(title) > 55 else "")
        exe_display = exe if exe else "(bilinmiyor)"
        marker = marker_for(exe, size[2], size[3])
        print(f"  {exe_display:<24} {size_str:<14} {marker:<10} {t_display}")

    print("-" * 70)
    print("★ MAÇ    = MAÇ İÇİ oyun penceresi (League of Legends.exe + büyük boyut)")
    print("⚠ BEKLE  = process okunamadı ama boyut büyük (büyük ihtimalle oyun penceresi)")
    print("(boş)    = küçük pencere (splash/tray) veya excluded process")
    print()
    print("→ --window için ★ MAÇ veya ⚠ BEKLE işaretli pencerenin başlığını kopyala.")
    print("  TFT maç içi penceresi genelde: 'League of Legends (TM) Client' (1920x1080)")
    print()
    print("Örn: python capture.py --url ... --background --window \"League of Legends (TM) Client\"")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="TFT Adwer capture client — ekran yakalayıp web uygulamasına yollar."
    )
    parser.add_argument("--url", help="Web uygulamasının /api/snapshot URL'i")
    parser.add_argument("--interval", type=float, default=4.0, help="Yakalama aralığı (saniye)")
    parser.add_argument(
        "--monitor",
        type=int,
        default=0,
        help="Monitör indeksi (0=ana ekran). --window yoksa kullanılır.",
    )
    parser.add_argument(
        "--window",
        type=str,
        default="",
        help="Yakalanacak pencere adı (örn. 'League of Legends'). --region yerine kullanılır.",
    )
    parser.add_argument(
        "--region",
        type=int,
        nargs=4,
        metavar=("X", "Y", "W", "H"),
        default=None,
        help="Belirli bölge (x y w h piksel). --window ve --monitor override eder.",
    )
    parser.add_argument("--quality", type=int, default=90, help="JPEG kalitesi (1-95, default 90 — TFT text'in okunması için yüksek tutulur)")
    parser.add_argument(
        "--no-foreground-check",
        action="store_true",
        help="TFT ön planda değilse capture'ı atlama (varsayılan: atlar). "
             "Alt-tab yaptığında capture.py masaüstünü/Chrome'u yakalayıp VLM'in "
             "sapan değerler üretmesini engeller.",
    )
    parser.add_argument(
        "--no-crops",
        action="store_true",
        help="Board/bench crop gönderme (sadece tam ekran). VLM trait "
             "panelini board sanıyorsa ve crop bölgesi yanlışsa denenebilir. "
             "Normalde açık — crop VLM'in doğru champion okumasına yardımcı olur.",
    )
    parser.add_argument(
        "--background",
        action="store_true",
        help="Arka plan yakalama (windows-capture). TFT MAÇ İÇİ penceresini ön planda "
             "olmasa bile yakalar — alt-tab yapıp tarayıcıya baksan bile TFT "
             "okumaya devam eder. --window opsiyonel (verilmezse varsayılan: "
             "'League of Legends (TM) Client'). "
             "Kur: pip install windows-capture numpy. Sadece Windows 10 1903+.",
    )
    parser.add_argument(
        "--save-frames",
        type=str,
        default="",
        metavar="DIR",
        help="Her yakalanan frame'i bu klasöre JPEG olarak kaydet (debug için). "
             "Örn: --save-frames ./debug-frames. VLM yanlış ekran okuyorsa "
             "WGC/mss'nin ne yakaladığını görmek için kullan.",
    )
    parser.add_argument(
        "--list-windows",
        action="store_true",
        help="Tüm görünür pencereleri listele (başlık + process adı) ve çık. "
             "--window için doğru pencere adını bulmak için kullan. "
             "Örn: python capture.py --list-windows",
    )
    parser.add_argument(
        "--use-local",
        action="store_true",
        help="Local data kullan: Live API (port 2999) level + HP, Tesseract gold OCR. "
             "VLM'i bypass eder — level tamamen dogru, gold OCR. "
             "Kurulum: pip install pytesseract pillow + Tesseract binary.",
    )
    parser.add_argument(
        "--tesseract-path",
        default=None,
        help="Tesseract binary yolu. Windows default: "
             "C:\\\\Program Files\\\\Tesseract-OCR\\\\tesseract.exe",
    )
    parser.add_argument(
        "--gold-debug",
        action="store_true",
        help="Gold OCR debug: kırpılan görüntüyü + Tesseract çıktısını diske kaydet. "
             "Gold None dönüyorsa koordinatları/preprocessing'i kontrol et.",
    )
    parser.add_argument(
        "--skip-vlm",
        action="store_true",
        help="VLM'i tamamen atla. Sadece Live API (level+HP) + Tesseract gold OCR "
             "gönderilir, sunucu VLM çağırmaz. HP/gold/level doğruluğunu VLM "
             "gürültüsü olmadan test etmek için. --use-local ile birlikte kullan. "
             "Hız: ~50ms (normal VLM 3-8s). "
             "shop/board/bench/augments BOŞ kalır (VLM okumadı).",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Detaylı çıktı")
    args = parser.parse_args()

    # ─── List-windows mode: print all visible windows and exit ──────
    # Runs before --url validation so the user can run it without a URL.
    if args.list_windows:
        sys.exit(list_windows())

    if not args.url:
        parser.error("--url gerekli")

    # Background mode: --window opsiyonel. Verilmezse varsayılan olarak
    # "League of Legends (TM) Client" (TFT MAÇ İÇİ pencere) kullanılır.
    # _resolve_full_title process adı + boyut filtresiyle doğru pencereyi bulur.
    if args.background and not args.window:
        args.window = "League of Legends (TM) Client"
        print(f"  ℹ --window verilmedi, varsayılan: '{args.window}' (TFT maç içi pencere)")

    # Set the global frame-save directory (used by send_image)
    global SAVE_FRAMES_DIR
    SAVE_FRAMES_DIR = args.save_frames or None

    # ─── Capture mode: now we need PIL (always) + mss (foreground only) ────
    try:
        from PIL import Image as _Image
        global Image
        Image = _Image
    except ImportError as e:
        print(f"Eksik bağımlılık: {e.name}")
        print("Çalıştır: pip install pillow requests")
        sys.exit(1)

    # Foreground mode also needs mss. Background mode uses windows-capture instead.
    if not args.background:
        try:
            import mss as _mss
            global mss
            mss = _mss
        except ImportError as e:
            print(f"Eksik bağımlılık: {e.name}")
            print("Çalıştır: pip install mss requests pillow")
            sys.exit(1)

    print("=" * 60)
    print("TFT Adwer — Capture Client")
    print("=" * 60)
    print(f"  URL      : {args.url}")
    print(f"  Interval : {args.interval}s")
    print(f"  Quality  : {args.quality}")
    capture_mode_label = "arka plan (windows-capture)" if args.background else "ön plan (mss)"
    print(f"  Mod      : {capture_mode_label}")
    if args.background:
        print(f"  Pencere  : '{args.window}'")
    crop_mode = "kapalı (--no-crops)" if args.no_crops else "açık (board+%25-75W, bench%67-78H)"
    print(f"  Crops    : {crop_mode}")
    if args.background:
        # Foreground check is meaningless in background mode — we capture the
        # TFT window directly, not whatever is on screen.
        print(f"  FG Check : devre dışı (arka plan modunda anlamsız)")
    else:
        fg_mode = "kapalı (--no-foreground-check)" if args.no_foreground_check else "açık (TFT ön planda değilse atla)"
        print(f"  FG Check : {fg_mode}")

    # Local data (Live API + gold OCR) — --use-local flag ile.
    global _LOCAL_READER
    global _GOLD_DEBUG
    _GOLD_DEBUG = args.gold_debug
    if args.use_local:
        try:
            from local_reader import LocalReader
            _LOCAL_READER = LocalReader(tesseract_path=args.tesseract_path)
            print(f"  Local    : AÇIK (Live API level + Tesseract gold OCR)")
            # Live API'yi hemen test et
            live = _LOCAL_READER.read_live_api()
            if live is None:
                print(f"           ⚠ Live API şu an yok (TFT kapalı). TFT açılınca çalışır.")
            else:
                print(f"           ✅ Live API çalışıyor! Level={live['level']}")
        except ImportError:
            print(f"  Local    : KAPALI (local_reader.py bulunamadı)")
            print(f"           Kur: pip install pytesseract pillow requests")
            _LOCAL_READER = None
        except Exception as e:
            print(f"  Local    : hata — {e}")
            _LOCAL_READER = None
    else:
        print(f"  Local    : kapalı (--use-local ile aç)")

    # Skip-VLM mode (Live API only, image encode atlanır)
    if args.skip_vlm:
        if not args.use_local:
            print(f"  Skip-VLM : ⚠ --use-local gerekli! skip-vlm tek başına anlamsız.")
            sys.exit(1)
        print(f"  Skip-VLM : AÇIK (VLM çağrılmaz, sadece Live API + gold OCR)")
        print(f"           Hız: ~50ms/snapshot (normal VLM 3-8s)")
        print(f"           shop/board/bench/augments BOŞ kalır")

    print(f"  Çıkmak için: Ctrl+C")
    print("=" * 60)

    # Set up requests session
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    # ─── Background mode: start the WGC capturer once, then loop ──────────
    # In background mode we don't need mss at all. The BackgroundCapturer runs
    # a daemon thread that continuously captures the TFT window; the main loop
    # just grabs the latest frame every `interval` seconds.
    bg_capturer = None
    if args.background:
        print("\n  Arka plan yakalama başlatılıyor (windows-capture)...")
        try:
            bg_capturer = BackgroundCapturer(args.window, verbose=args.verbose)
        except RuntimeError as e:
            print(f"\n  ✗ {e}")
            sys.exit(1)
        # Give WGC a moment to produce the first frame
        time.sleep(1.5)
        if bg_capturer.is_closed:
            print("  ✗ Capture oturumu hemen kapandı. TFT açık mı?")
            sys.exit(1)
        fc = bg_capturer.frame_count
        print(f"  ✓ Arka plan capture aktif (ilk {fc} frame alındı)")
        if fc == 0:
            print("  ⏳ Henüz frame yok — TFT'yi oyuna girince frame'ler gelmeye başlar.")
            print("     (Lobby'de TFT penceresi var ama WGC bazen ilk frame'i geciktirir.)")
            print("     capture.py sessizce bekliyor, oyuna girdiğinde otomatik okumaya başlayacak.")

    # ─── Foreground mode: set up mss + region ─────────────────────────────
    sct = None
    region: dict = {}
    if not args.background:
        sct = mss.mss()
        if args.region:
            x, y, w, h = args.region
            region = {"left": x, "top": y, "width": w, "height": h, "mon": 0}
            print(f"  Bölge    : {x},{y} {w}x{h}")
        elif args.window:
            found = find_window_region(args.window)
            if found:
                x, y, w, h = found
                region = {"left": x, "top": y, "width": w, "height": h, "mon": 0}
                print(f"  Pencere  : '{args.window}' → {x},{y} {w}x{h}")
            else:
                print(f"  Pencere '{args.window}' bulunamadı. Ana ekran kullanılacak.")
                mon = sct.monitors[max(1, args.monitor + 1)] if args.monitor < len(sct.monitors) - 1 else sct.monitors[1]
                region = mon
                print(f"  Monitör  : {mon['width']}x{mon['height']}")
        else:
            # Default: primary monitor
            mon_index = max(1, args.monitor + 1) if args.monitor + 1 < len(sct.monitors) else 1
            mon = sct.monitors[mon_index]
            region = mon
            print(f"  Monitör  : {mon['width']}x{mon['height']} (index {args.monitor})")

    print("=" * 60)

    # Graceful shutdown
    running = [True]

    def on_sigint(sig, frame):
        running[0] = False
        print("\n  Durduruluyor...")

    signal.signal(signal.SIGINT, on_sigint)

    cycle = 0
    ok_count = 0
    err_count = 0
    skip_count = 0  # Count of foreground-guard skips
    consecutive_rate_limit = 0  # Track consecutive rate-limit responses
    if SAVE_FRAMES_DIR:
        print(f"  Save     : {SAVE_FRAMES_DIR} (her frame JPEG olarak kaydedilecek)")
    print("=" * 60)
    print("  Başladı. Oyuna gir ve beklemeye başla...\n")

    try:
        while running[0]:
            cycle += 1
            t_start = time.monotonic()

            # Foreground guard (foreground mode only). In background mode we
            # capture the TFT window directly, so this check is irrelevant.
            if not args.background and not args.no_foreground_check:
                is_fg, fg_title = is_tft_foreground()
                if not is_fg:
                    skip_count += 1
                    # Truncate title so the line doesn't blow up
                    short_title = (fg_title or "(empty)")[:40]
                    print(f"  [{cycle}] ⊘ skip — TFT ön planda değil (aktif: '{short_title}')")
                    # Sleep the full interval before retrying (no capture)
                    time.sleep(args.interval)
                    continue

            # ─── Capture + send ─────────────────────────────────────────────
            if args.background:
                # Background mode: pull the latest frame from the WGC daemon thread
                if bg_capturer.is_closed:
                    print(f"  [{cycle}] ✗ arka plan capture kapandı (pencere kapatılmış?). Yeniden başlatmayı dene.")
                    err_count += 1
                    time.sleep(args.interval)
                    continue
                img = bg_capturer.grab_latest()
                if img is None:
                    print(f"  [{cycle}] ⏳ TFT penceresi bekleniyor... (henüz geçerli frame yok, oyuna girince başlar)")
                    skip_count += 1
                    time.sleep(args.interval)
                    continue
                ok, msg = send_image(
                    img, session, args.url, args.quality, args.verbose,
                    no_crops=args.no_crops,
                    skip_vlm=args.skip_vlm,
                )
            else:
                # Foreground mode: mss grab + send
                ok, msg = capture_and_send(
                    sct, session, args.url, region, args.monitor, args.quality, args.verbose,
                    no_crops=args.no_crops,
                    skip_vlm=args.skip_vlm,
                )

            if ok:
                ok_count += 1
                consecutive_rate_limit = 0
                if not args.verbose:
                    print(f"  [{cycle}] ✓ {msg}")
            else:
                err_count += 1
                print(f"  [{cycle}] ✗ {msg}")
                # If rate-limited, pause 60s instead of the normal interval
                # to let the VLM API quota reset. Don't pause on "busy" (that's
                # just the in-flight guard — next interval will retry).
                if "rate-limited" in msg or "Pausing" in msg:
                    consecutive_rate_limit += 1
                    pause_s = 60
                    # Escalate: 60s, then 90s, then 120s
                    if consecutive_rate_limit > 1:
                        pause_s = 60 + (consecutive_rate_limit - 1) * 30
                    print(f"  ⏸  Rate limit detected — pausing {pause_s}s (streak: {consecutive_rate_limit})...")
                    # Sleep in 1s increments so Ctrl+C stays responsive
                    for _ in range(pause_s):
                        if not running[0]:
                            break
                        time.sleep(1)
                    continue

            # Sleep the remainder of the interval
            elapsed = time.monotonic() - t_start
            sleep_for = max(0.5, args.interval - elapsed)
            time.sleep(sleep_for)
    finally:
        if sct is not None:
            try:
                sct.close()
            except Exception:
                pass

    print(f"\nBitti. {ok_count} başarılı, {err_count} hata, {skip_count} atlandı.")


if __name__ == "__main__":
    main()
