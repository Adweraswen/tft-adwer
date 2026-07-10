# TFT Adwer

TFT oynarken ekranı okur, duruma göre comp tavsiyesi verir. İki yol:

1. **VLM yolu** (web preview) — tarayıcıdan ekran paylaşımı + yapay zeka görüntü tanıma. Yavaş (3-8 sn), para var, ama sandbox'ta çalışır.
2. **Memory yolu** (Tauri app) — League of Legends.exe process'inden direkt memory okur. Hızlı (<1 sn), parasız, %100 doğru. TFTSense/Blitz/MetaTFT seviyesi.

## Geliştirme

### Web preview (VLM yolu)

```bash
bun install
bun run dev
```

### Tauri app (Memory yolu) — Windows + Rust gerekir

```bash
# 1. Bağımlılıkları kur (ilk sefer)
bun install
cargo install tauri-cli

# 2. Tauri dev modu — Next.js dev server + Tauri pencere açar
bun run tauri:dev
# veya
cargo tauri dev
```

Tauri dev modu:
- Next.js dev server'ı `http://localhost:3000`'da çalıştırır.
- Tauri penceresi açılır, Next.js'i yükler.
- Frontend `invoke('read_game_state')` ile Rust backend'i çağırır.
- Rust, League of Legends.exe process'inden memory okur.

### Build (Tauri app)

```bash
bun run tauri:build
# veya
cargo tauri build
```

Build çıktısı: `src-tauri/target/release/` altında installer (.msi, .exe).

## Mimari

```
src/                          # Next.js frontend (VLM + UI)
  lib/tft/
    vlm-analyzer.ts           # VLM yolu (web preview)
    memory-reader.ts          # Memory yolu (Tauri) — invoke çağrısı
    reading-provider.ts       # Ortak interface
  lib/tft-data/
    offsets.ts                # Offset referansı (TS tarafı, dokümantasyon)
    champions.ts, items.ts... # Statik TFT verisi
src-tauri/                    # Rust backend (Tauri 2)
  src/
    main.rs                   # Entry point
    lib.rs                    # Tauri command'lar (read_game_state, connect_to_game)
    memory_reader.rs          # MemoryReader — OpenProcess + ReadProcessMemory
    offsets.rs                # Offset listesi (offsets.ts'in Rust kopyası)
    types.rs                  # GameState Rust karşılığı
  Cargo.toml                  # Rust dependencies (windows-sys, tauri, serde)
  tauri.conf.json             # Tauri ayarları
public/capture-client/
  capture.py                  # Python ekran yakalama (VLM yolu için)
```

## Test

- **VLM yolu:** `bun run dev` → preview link → "Canlı Bağla" → TFT ekranı paylaş.
- **Memory yolu:** `cargo tauri dev` → Tauri pencere → "Bağlan" → TFT açık olsun.

Daha fazla bilgi: `PLAN.md` (ana plan + hafıza), `worklog.md` (geliştirme günlüğü).
