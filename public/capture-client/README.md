# TFT Adwer — Capture Client

PC'nizde çalıştıracağınız küçük Python script. TFT ekranını yakalayıp web uygulamasına yollar.

## Kurulum

```bash
# Python 3.9+ gerekli

# Arka plan yakalama için (önerilen — alt-tab yapsanız bile TFT'yi okur):
pip install windows-capture numpy pillow requests

# Sadece ön plan yakalama için (hafif yedek):
pip install mss requests pillow
```

Windows'ta pencere bulma için (opsiyonel ama önerilir):
```bash
pip install pywin32
```

## Çalıştırma

Önce web uygulamasından URL'i kopyalayın (Kurulum sekmesindeki "Hedef URL").

```bash
# ⭐ Arka plan yakalama (ÖNERİLEN) — alt-tab yapsanız bile TFT'yi okumaya devam eder
# --window verilmezse varsayılan: "League of Legends (TM) Client" (TFT maç içi)
python capture.py --url https://YOUR-SANDBOX-URL/api/snapshot --interval 10 --background -v

# Ön plan yakalama (yedek) — TFT tam ekran olmalı, alt-tab yapınca durur
python capture.py --url https://... --interval 10 --window "League of Legends (TM) Client" -v

# Belirli bölge (sadece ön plan modunda)
python capture.py --url https://... --interval 10 --region 0 0 1920 1080
```

## 🎮 TFT maç içi penceresi

TFT'de maç içi oyun penceresi:

| Özellik | Değer |
|---|---|
| Başlık | `League of Legends (TM) Client` |
| Process | `League of Legends.exe` |
| Boyut | tam ekran (örn. 1920x1080) |
| İçerik | TFT tahtası, şampiyonlar, HP/gold/level göstergeleri |

**VLM BUNU okumalı.** Küçük `League of Legends` (160x28) penceresi splash/tray'dir,
otomatik atlanır.

### Doğru pencereyi nasıl bulursun?

`--background` modu `--window` verilmezse varsayılan olarak `League of Legends (TM) Client`
kullanır. Manuel kontrol için:

```bash
# Tüm pencereleri listele — ★ MAÇ veya ⚠ BEKLE işaretli olanı kullan
python capture.py --list-windows
```

Çıktıdaki işaretler:
- `★ MAÇ` = MAÇ İÇİ oyun penceresi (League of Legends.exe + büyük boyut) ✅
- `⚠ BEKLE` = process okunamadı ama boyut büyük (büyük ihtimalle oyun penceresi) ✅
- `(boş)` = küçük pencere (splash/tray) veya excluded process ❌

### ⚠️ Önemli: `--interval` seçimi

- `--interval 10` veya daha yüksek **önerilir**. VLM API'sinin dakikalık kotası var, çok sık çağrı yaparsanız 429 alırsınız.
- Eğer rate-limit (`✗ rate-limited` veya `✗ sunucu hatası: VLM call failed ... 429`) görürseniz, script otomatik 60 saniye bekleyip devam eder. Bu normal.
- `--interval 4` çok agresiftir, kota dolup sunucu çökebilir.

### 🪟 Alt-tab davranışı (ön plan kontrolü)

İki mod var:

**1. Arka plan modu (`--background`) — ÖNERİLEN ⭐**
- `windows-capture` kütüphanesi Windows Graphics Capture API'sini kullanır
- TFT **MAÇ İÇİ** penceresini arka planda bile yakalar — alt-tab yapıp tarayıcıya geçseniz bile TFT okumaya devam eder
- DirectX oyunlarını destekler (TFT dahil)
- `--window` **opsiyonel** — verilmezse varsayılan: `League of Legends (TM) Client`
- Windows 10 1903+ gerekir
- 2. ekran/telefonla takip için ideal

**2. Ön plan modu (varsayılan)**
- `mss` kütüphanesi ekranın görünen kısmını yakalar
- TFT ön planda değilse (alt-tab yaptıysanız) capture'ı atlar — sadece "⊘ skip — TFT ön planda değil" yazıp bekler
- TFT'ye geri döndüğünüzde otomatik devam eder
- `--no-foreground-check` ile kapatılabilir (önerilmez)
- Bu özellik `pywin32` gerektirir

## Parametreler

| Parametre | Açıklama | Varsayılan |
|-----------|----------|------------|
| `--url` | Web uygulamasının /api/snapshot URL'i (zorunlu) | — |
| `--interval` | Yakalama aralığı saniye | 4 |
| `--monitor` | Monitör indeksi (0=ana) | 0 |
| `--window` | Yakalanacak pencere adı (arka plan modunda opsiyonel) | (yok) |
| `--region` | x y w h piksel bölge (sadece ön plan modu) | (yok) |
| `--background` | Arka plan yakalama (windows-capture) | kapalı |
| `--quality` | JPEG kalitesi 1-95 | 90 |
| `--no-crops` | Board/bench crop gönderme (sadece tam ekran) | kapalı |
| `--no-foreground-check` | Ön plan kontrolünü kapat (ön plan modu) | kapalı |
| `--verbose` | Detaylı çıktı | kapalı |

## Nasıl çalışır?

1. `mss` kütüphanesi ekrandan bir kare yakalar (~5ms)
2. Pillow ile JPEG'e çevirir (kalite 80, ~200KB)
3. **Board ve bench bölgelerini kırpar** (tam ekranın %25-75 genişlik, %12-67 yüksekliği = board; %67-78 = bench), 2x yakınlaştırır, ayrı JPEG'ler yapar
4. Tam ekran + board crop + bench crop'u birlikte web uygulamasına POST'lar
5. Web uygulaması VLM ile görüntüleri analiz eder (~3-8s):
   - Tam ekran'dan stage/gold/hp/level okur
   - Board crop'tan şampiyonları okur (trait paneliyle karıştırmaz)
   - Bench crop'tan yedek şampiyonları okur
6. Şampiyon adları 61 kişilik Set 17 kadrosuna göre kontrol edilir; uymayanlar (trait isimleri, halüsinasyonlar) otomatik elenir
7. Öneriler tarayıcıda görünür (otomatik yenile)

### 🎯 Board/Bench crop (otomatik)

capture.py varsayılan olarak tam ekranın yanında **board ve bench bölgelerini de kırpar** ve
yakınlaştırılmış gönderir. Bu, VLM'in şampiyonları trait paneliyle karıştırmasını engeller —

- Board crop: ekranın ortasındaki hex grid (4x7 hücre) — şampiyon kartları burada
- Bench crop: board'un hemen altındaki yatay şerit (9 slot) — yedek şampiyonlar
- Her ikisi de yüzde tabanlı (%25-75W), yani 1920x1080, 2560x1440, 1600x900 windowed hepsinde çalışır

Crop'u kapatmak isterseniz: `--no-crops` flag'i ekleyin (eski davranış — sadece tam ekran).
Normalde açık bırakın, çünkü crop olmadan VLM trait panelinden saçma şampiyon isimleri okuyabiliyor.

## Güvenlik

- **Sadece okur**: Hiçbir tıklama/klavye simulasyonu yok. Oyuna müdahale etmez.
- **Anti-cheat**: League of Legends anti-cheat (Vanguard) ekran yakalamaya karışmaz.
- **Ağ**: Sadece belirttiğiniz URL'e POST yapar. Başka hiçbir yere bağlanmaz.
- **Veri**: Ekran görüntüleri web sunucusunda işlenir, kalıcı olarak saklanmaz (sadece
  çıkarılan oyun durumu ve öneriler veritabanına yazılır).

## Sorun giderme

**"Eksik bağımlılık: mss"** → `pip install mss requests pillow` (ön plan modu için)

**"windows-capture kütüphanesi yok"** → `pip install windows-capture numpy` (arka plan modu için)

**"'League of Legends' penceresi bulunamadı"** → TFT açık mı? Oyun içi client'ta olmalısınız (lobby değil).

**"HTTP 404"** → URL yanlış. `/api/snapshot` ile bittiğinden emin ol.

**"ağ hatası"** → Sandbox URL'ine erişilemiyor. Tarayıcıdan açıp test edin.

**Pencere bulunamıyor** → `--window` yerine `--region` veya tam ekran kullanın.

**Çok yavaş** → `--quality 60` deneyin veya `--window` ile sadece TFT'yi yakalayın.

## Çıkmak

`Ctrl+C` ile durdurun.

---

## 🚫 Riot Live API kaldırıldı

Eski sürümlerde `--probe` modu ve otomatik Riot Live Client API (`127.0.0.1:2999`)
entegrasyonu vardı. **Kaldırıldı** çünkü:

- Riot API TFT için **LoL-shaped** veri döndürüyor — `currentGold` 500-977 gibi
  LoL altın değerleri veriyor (TFT'de altın 100'ü geçmez). Tamamen yanlış.
- `allPlayers[].gold`, `units`, `shop`, `traits` alanları **boş** geliyor.
- Sadece `level` güvenilir ama onu da VLM zaten okuyor.
- Konsola her 90 saniyede bir gürültü yazıyordu.

Artık **sadece VLM** kullanıyoruz — ekran görüntüsünden her şeyi okuyor.

---

## 🐛 Debug: VLM yanlış/boş değer döndürüyorsa

Eğer VLM sürekli `hp=100 gold=0 lvl=1 stage=1-1` (boş default) döndürüyorsa,
`--save-frames` ile her frame'i diske kaydedip ne yakalandığını kontrol edin:

```bash
python capture.py --url https://YOUR-SANDBOX-URL/api/snapshot \
  --interval 10 --background --save-frames ./debug-frames -v
```

Frame'ler `./debug-frames/` klasörüne JPEG olarak kaydedilir. Birkaç tanesini
açın ve kontrol edin:
- TFT oyun ekranı mı? (board, bench, shop, gold görünüyor mu?)
- Yoksa loading/masaüstü mü?

Eğer masaüstü görüyorsanız → TFT maç içinde değil, oyuna girin.
Eğer TFT ekranı görüyorsanız ama VLM hala default döndürüyorsa → VLM API sorunu olabilir,
`dev.log`'u kontrol edin.


---

## 🚀 Hızlı Mod: Local Data (Live API + Gold OCR)

VLM yavaş ve bazen yanlış okuyor. **Local data** kullanırsanız:
- **Level:** Riot'un resmi Live API'sinden (port 2999) — %100 doğru, anlık
- **Gold:** Tesseract OCR ile ekrandan okur — VLM halüsinasyonu yok
- **HP:** VLM'den gelir (Live API TFT'de HP vermiyor)

### Kurulum (Windows)

1. **Tesseract binary kur:**
   - https://github.com/UB-Mannheim/tesseract/wiki
   - `tesseract-ocr-w64-setup-5.3.3.20231005.exe` indir
   - Default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`

2. **Python bağımlılıkları:**
   ```cmd
   pip install pytesseract pillow requests numpy
   ```

3. **capture.py'yi --use-local ile çalıştır:**
   ```cmd
   python capture.py --url https://preview-chat-990c607b-c060-412d-b814-c1fd2a96f5f3.space-z.ai/api/snapshot --interval 5 --background --window "League of Legends (TM) Client" --no-crops --use-local -v
   ```

### Local Data Avantajları

- ✅ **Level %100 doğru** — Live API Riot'un resmi API'si, halüsinasyon yok
- ✅ **Gold daha güvenilir** — Tesseract sadece rakam okur, "500" gibi saçma değerler olmaz
- ✅ **connected garantili** — Live API "TFT" mode tespiti, VLM "TFT değil" diyemez
- ✅ **VLM yine çalışır** — stage, HP, shop, board için VLM lazım, local data sadece level/gold override eder

### Local Data Sınırlamaları

- ❌ **HP:** Live API TFT'de HP vermiyor (sadece LoL'de), VLM'den gelir
- ❌ **Stage/Round:** Live API vermiyor, VLM'den gelir
- ❌ **Shop/Board/Bench:** Live API vermiyor, VLM'den gelir
- ⚠️ **Gold OCR:** 1920x1080 için tuned. Farklı çözünürlükte koordinatlar scale edilir ama test gerekir

### Local Reader Test

Local reader'ı tek başına test etmek için:

```cmd
cd public\capture-client
python local_reader.py
```

Çıktı:
- `[1] Live API test` — TFT açık mı, level kaç
- `[2] Tesseract test` — Tesseract yüklü mü

### Local Reader Çalışmıyorsa

- **"Live API yok"** → TFT kapalı. TFT aç, maça gir, tekrar dene.
- **"Tesseract yok"** → `pip install pytesseract pillow` + binary kur
- **"Level None"** → Live API TFT mode tespit edemedi, gameData.gameMode "TFT" değil
- **"Gold None"** → OCR başarısız. Koordinatlar yanlış olabilir, debug-frames kaydedip kontrol et
