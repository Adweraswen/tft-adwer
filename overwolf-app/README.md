# TFT Adwer Overwolf Bridge

Bu Overwolf app'i, TFT oyun verilerini Overwolf GEP (Game Events Provider) üzerinden dinler ve `ws://127.0.0.1:7780/overwolf` WebSocket'ine yollar. Next.js API route WebSocket'i dinler, event'leri GameState'e çevirir, advisor'a yollar.

## Mimari

```
[TFT oyunu]
    ↓ (Overwolf GEP, Riot partneri)
[Bu Overwolf app — bridge.js]
    ↓ (localhost WebSocket, port 7780)
[Next.js API route /api/overwolf-ws]
    ↓ (event'leri GameState'e çevir)
[Next.js /api/snapshot → advisor → UI]
```

## Kurulum

### 1. Overwolf kur

https://www.overwolf.com/ — ücretsiz, ~10 MB.

### 2. Bu app'i Overwolf'a yükle

Overwolf'u aç → Settings → Support → "Developer tools" etkinleştir.

Sonra:
- Overwolf tray icon → sağ tık → "Pack app"
- `manifest.json`'u seç
- `.opk` dosyası üretilir
- `.opk`'yi çift tıkla → Overwolf'a yüklenir

Veya geliştirme modunda:
- Overwolf tray → "Load unpacked"
- `overwolf-app/` klasörünü seç

### 3. Next.js'i başlat

```bash
cd ..
bun install
bun run dev
```

Next.js `localhost:3000`'da çalışır. WebSocket server `ws://127.0.0.1:7780/overwolf`'da dinler (henüz yazılacak).

### 4. TFT aç

Overwolf app otomatik açılır (TFT tespit edince). Arka planda çalışır, veriyi Next.js'e yollar.

## Event'ler (GEP)

Overwolf GEP TFT için şu event'leri verir:

| Feature | Verdiği | GameState alanı |
|---|---|---|
| `game_info` | Oyun modu (TFT), PBE mi | connected |
| `live_client_data` | active_player (gold, level), all_players (HP) | gold, level, hp |
| `me` | augment'lar (augment_1, augment_2, augment_3) | augments |
| `match_info` | local_player_damage (her şampiyonun hasarı) | (carry tespiti) |
| `roster` | Oyuncu listesi | (scouting) |
| `store` | shop_pieces (5 slot şampiyon) | shop |
| `board` | board_pieces (28 cell), opponent_board_pieces | board |
| `bench` | bench_pieces (9 slot), item_bench | bench |
| `carousel` | carousel_pieces | (carousel tespiti) |
| `augments` | Seçili augment'lar | augments |
| `match_stats` | Maç sonrası istatistikler | (bonus) |

## WebSocket Mesaj Formatı

Her event ayrı JSON mesaj olarak yollanır:

```json
{ "type": "board", "data": { "info": { "board": { "board_pieces": "..." } } }, "ts": 1234567890 }
```

`type` = feature adı (`board`, `bench`, `store`, `live_client_data`, vb.)
`data` = Overwolf'un verdiği raw JSON
`ts` = timestamp (ms)

## Dosyalar

- `manifest.json` — Overwolf app manifest (TFT GameID 21570/215701, features list)
- `src/index.html` — durum gösteren küçük pencere
- `src/hidden.html` — gizli arka plan penceresi (ileride)
- `src/css/style.css` — index.html stilleri
- `src/js/bridge.js` — ana script: GEP event'leri → WebSocket

## Test

1. Next.js'i başlat (`bun run dev`)
2. Overwolf app'i yükle
3. TFT aç
4. Overwolf app penceresi "Bağlandı — TFT bekleniyor" demeli
5. Maça gir, `bridge.js` event'leri yollar
6. Next.js dev.log'da event'ler görünmeli (WebSocket server henüz yazılmadı, hata verecek — normal)

## Sorun Giderme

- **"WebSocket: kapalı"**: Next.js `/api/overwolf-ws` henüz yok. Yazılacak.
- **"Oyun: bekleniyor"**: TFT açık değil, veya Overwolf TFT'yi tanımıyor.
- **"GEP features hatası"**: Overwolf TFT'yi desteklemiyor olabilir (eski sürüm).

## Riot Politikası

Overwolf, Riot Games'in resmi partneridir. Overwolf GEP TFT için resmi olarak desteklenen bir veri kaynağıdır. Ban riski YOK. (PLAN.md bölüm 14.3)
