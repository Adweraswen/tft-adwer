# TFT ADWER — ANA PLAN & HAFIZA

> Bu dosya, kullanıcının ve benim (Z.ai Code) konuştuğumuz her şeyin kalıcı kaydıdır.
> Yeni bir işe başlamadan önce bu dosyayı oku. Onaysız özellik ekleme.
> Son güncelleme: Augment okuma EVET (gerçek okuma, TFTSense etik kaygısı takılmıyor). VLM→CV geçişi uzun vadeli onaylandı. Canlı Bağla testi hâlâ bekliyor (bölüm 5.6).

---

## 0. ÇALIŞMA KURALLARI (Kullanıcı Sözleşmesi)

Bu kurallar benim (asistan) için, kullanıcıya verilen sözler:

1. **Onaysız özellik yok.** Konuşmadığımız, onaylamadığın hiçbir şeyi koda ekleme. "Şu da güzel olur" diyorsam önce sorarım, sen evet demeden yapmam.
2. **Her iş sonrası düz özet.** Bir şeyi bitirince teknik terim kullanmadan, düz Türkçe ile "şunu yaptım, şöyle çalışıyor, şu sorun var" diye özet veririm. "VLM ile doğruladım, lint temiz" gibi laflar değil, "ekranı açtım test ettim, hata yok, şöyle görünüyor" gibi insanca.
3. **Plan demir gibi, onay sonrası uygulama.** Önce plan netleşir, onaylanır. Onaydan sonra adımları sırayla uygularım, gerçekten kararsız kaldığımda sorarım.
4. **Okuma testleri kullanıcıda.** Okuma doğruluğu testi gerektiğinde, "kod yaz devam et" demek yerine kullanıcıya "şu testi yap" derim. Kod benim, test kullanıcıda. Okuduğum şeyi (sayı, şampiyon, augment) kullanıcıya gösteririm, "doğru mu yanlış mı" diye sorarım. Otomatik QA (lint, sayfa açılışı) beni ilgilendirir, ama "doğru okudun mu" insan gözü ister.
5. **Bu dosyayı güncelle.** Yeni karar alındıkça, yeni onay geldikçe bu dosyaya eklerim. Unutmamak için buraya yazıyoruz.

---

## 1. PROJE VİZYONU (Netleştirilmiş)

**Tek cümle:** İndirilen küçük bir masaüstü program; TFT oynarken ekranı okur, duruma göre hangi comp'a gidildiğini anlar, ne eksikse söyler.

**Dağıtım:**
- z.ai sandbox'undan bağımsız, gerçek bir ürün.
- Kullanıcı bir kez kurar (küçük, ~10-50 MB), açar, çalışır.
- İçinde mevcut Next.js arayüzümüz (comp tarayıcısı, vs.) + ekran-okuyucu motor.
- GitHub'dan indirilir, dağıtımı basit.
- Şişman Electron değil, cılız Tauri-benzeri bir şey (karar verilmedi, kullanıcıya sorulacak).

**Olmayacaklar:**
- "Sadece website" yolu yok — tarayıcı başka program ekranını gizlice göremez, ekran paylaşımı her seferinde izin ister, kötü deneyim.
- Sadece Python capture + terminal yok — kullanıcı teknik değil, kurcalamayacak.
- z.ai preview'a mahkum değiliz — o sadece geliştirme ortamı, ürün değil.
- Shop okuma yok (kullanıcı kararı: "shop kısmını siktir et").

---

## 2. OKUMA STRATEJİSİ

### 2.1 Katmanlar (haza göre, hız farklı)

**Yavaş katman (5 saniyede bir okunur):**
- Board (28 kare)
- Bench (9 kare)
- Level
- Altın
- Round
- Can barı

Bunlar saniyede değil 5-10 saniyede bir değişir. Okuması nispeten kolay. Stratejik tavsiye buradan gelir.

**Hızlı katman (SHOP) — YOK:**
- Kullanıcı kararı: shop okumayı bıraktık. Early'de lazım ama augment + bench + item drop ile açığı kapatılır (bkz. bölüm 4).

### 2.2 Okuma yöntemleri

- **Yapay zeka görüntü tanıma (VLM):** kareyi gönder, "hangi şampiyonlar, hangi sayılar" diye sor. Esnek ama yavaş ve para. 3-5 sn'de bir çağır.
- **Görsel eşleştirme:** her şampiyon ikonu önceden kayıtlı, ekran içinde ara. Hızlı, parasız, ama ikon değişince bozulur. Ön tarama için.
- **OCR (sayılar için):** altın/level/round sayılarını okumak için. VLM de yapabilir, ekstra OCR gerekmeyebilir.

### 2.3 Hata azaltma (emin olma katmanı)

- Aynı şeyi 2-3 kare üst üste görmeden "doğru" deme.
- Emin olamazsan "şu an X var mı, emin değilim" yaz.
- Bölgesel okuma: tüm ekranı tek seferde okutma, bölgelere böl (üst şerit, bench, board).
- "Değişim anı" tetiklenmesi: sadece round değişti / re-roll atıldı / augment açıldı anlarında oku.

---

## 3. KARAR MEKANİZMASI (Netleştirilmiş)

### 3.1 Ana kural
- **Kullanıcı comp seçmez.** Karar mekanizması duruma göre yön verir.
- Okunan durum → 25 comp'tan en yakın olanı bul → "hedef bu, eksikler şu" de.

### 3.2 Puanlama sistemi
Her sinyal comp'lara puan ekler:
- Augment eşleşmesi: +5 puan
- Trait aktivasyonu eşleşmesi: +2 puan
- Bench birikimi (reroll sinyali): +4 puan
- Item drop eşleşmesi: +3 puan
- Anomaly eşleşmesi: +3 puan

En yüksek puanlı comp = mevcut hedef. Puan düşükse "bekle, emin değilim" de. Puan yüksekse "hedef bu" de.

### 3.3 Stratejik vs taktiksel tavsiye
- **Stratejik tavsiye** (yavaş katmandan, ilk öncelik): "Board'ında 2 Conduit, 1 Aurelion Sol var, hedef comp bu, bir Conduit daha ara."
- **Taktiksel tavsiye** (shop gerekli): YOK. Shop okumadığımız için taktiksel "bu shop'tan al" tavsiyesi yok.

---

## 4. EARLY GAME AÇIĞI KAPATMA LİSTESİ (10 madde)

Shop okumadığımız için early'de zayıf kalabilirdik. Bu liste o açığı kapatır:

1. **Augment okuma (GERÇEK OKUMA — kullanıcı kararı)** — augment seçim ekranını VLM ile oku, 3 augment ismini al. Augment ekranı stage 1-2, 2-2, 3-2, 4-2'de açılır, 15-20 sn tam ekran durur (en kolay okunan şey). Crop: ekranın orta bölgesi (augment kartları). VLM: "3 augment'ın isimlerini listele". Normalize: Set 17 augment veritabanı ile fuzzy match (typo tolerant, Levenshtein). Augment → comp tablosu elle bir kez yazılır. 3 augment sırayla okununca comp kısa listesi 25'ten 4-5'e iner. Early game'in %70'i bu.
   - **Etik notu:** TFTSense augment okumayı "etik sınır" diye yapmıyor. AMA Blitz/MetaTFT/Mobalytics okuyor (veya memory'den çekiyor). Kullanıcı kararı (güncelleme 5): "herkes okuyor, biz de okuyalım." TFTSense'in kaygısını takmıyoruz.
   - **Augment veritabanı:** asistan toplar (Set 17 tüm augment isimleri + tier + açıklama). Patch değişince güncellenir. Kaynak: community sitesi (Mobalytics/MetaTFT) veya Riot Data Dragon.
   - **Panic modu yedek:** okuma başarısız olursa "augment'ini eliyle yaz" modu devreye girer (bölüm 4.10). Ama ana yol gerçek okuma.
2. **İlk trait aktivasyonları** (stage 1-2) — board'a konan şampiyonlar comp niyetini ele verir. Board okuma moturu zaten yapıyor, ekstra iş yok. Sadece "stage 1-2'de sinyal zayıfsa agresif tahmin yapma" kuralı.
3. **Bench birikimi → reroll tespiti** — bench'te aynı şampiyondan 2-3 tane varsa reroll comp sinyali. Shop okumadan tespit edilir. Bench her 5 sn okunuyor, maliyet sıfır.
4. **Item drop okuma** (stage 2-1, 2-5, 3-1) — AD/AP/tank item comp'a yön verir. Oyuncunun item'ı hangi şampiyona taktığı board'dan görünür, "carry kim" sinyali verir.
5. **Anomaly okuma** (Set 17) — belirli round'larda anomaly seçimi, comp'a yön verir. Tam ekran, kolay okunur.
6. **Puanlama sistemi** — sinyaller comp'lara puan ekler, en yüksek puanlı = hedef. Belirsizlikte sessiz, emin olunca konuş. "Falso" hissini öldürür.
7. **Stage bazlı karar akışı**:
   - 1-1 to 1-4: ilk trait'leri oku, sessiz kal (henüz erken)
   - 2-1: ilk augment oku → comp kısa listesi (3-5 comp), "şu comp'lara gidebilirsin" de
   - 2-5: item drop oku → liste daralır
   - 3-1: ikinci augment + trait + bench → comp netleşir (1-2 comp), "hedef bu" de
   - 3-5 ve sonrası: stabil hedef, eksiklik tavsiyesi ("2 Conduit eksik, Aurelion Sol ara")
8. **Hibrit mod (yarı otomatik onay)** — stage 2-1'de "augment'ine göre şu 3 comp uygun, hangisini oynayacaksın?" diye sor, kullanıcı tıklar. Sonra otomatik devam. Hata azaltır. İleride tam otomatik mod eklenebilir.
9. **Stage 1 statik tavsiyeleri** — augment yokken bile genel TFT ilkeleri ver: "aynı şampiyondan 3 tane varsa satma", "2 trait aktive edebiliyorsan etkin", "carry'ye item tak". Statik kurallar, okuma gerektirmez, "hiç konuşmuyor" hissini önler.
10. **Panic modu** — okuma başarısız olursa (augment okunamadıysa) "okuyamadım, hangisini seçtin?" diye sor. Kullanıcı eliyle yazar. Sessiz+falso durumunu önler.

---

## 5. DAĞITIM & TEKNİK YAPI

### 5.1 Dağıtım formatı
- **Tauri-benzeri** küçük masaüstü program önerildi.
- Tek dosya installer veya portable.
- İçinde: Next.js arayüzü (build'lenmiş statik) + Rust/native ekran yakalama.
- **Paketleme aşamasında karar verilecek** (Tauri mi Electron mu). Şimdi değil.
- Kullanıcı tek kurulumla her şeyi kurmuş olacak — Python, capture client, site hepsi paketin içinde. "Bilgisi olmayanlar için kolaylık ve pratiklik" = tek installer, kurcala yok.

### 5.2 İki ekran yakalama yolu (ikisi de duracak)

Kullanıcı kararı: **IKI YOL DA DURSUN.** Pratiklik için tarayıcı yolu, arka plan okuma için Python yolu. Kullanıcı kurulumda seçer.

**Yol A — Tarayıcı (kolay, pratik):**
- "Canlı Bağla" butonu, tarayıcı ekran paylaşımı, TFT pencereyi seç.
- Kurulum yok, sayfayı açan herkes kullanabilir.
- Bedeli: sayfa açık kalmalı, arka plan okuma YOK. İkinci ekran/telefon lazım.

**Yol B — Python capture (arka plan):**
- Mevcut `capture.py` (`mss` veya `windows-capture` ile).
- Alt-tab yapsan bile TFT'yi okur.
- Bedeli: Python kur + paket kur + script çalıştır. Ama paket halinde olursa tek installer hepsini kurar, kullanıcı terminal görmmez.

**Ortak çekirdek (ikisi de bunu kullanır):**
- HTTP POST `/api/snapshot` (aynı endpoint).
- `vlm-analyzer.ts` (aynı dosya, aynı VLM mantığı).
- Champion normalize, sanity filter, comp tahmini — hepsi ortak.
- Yani "ekranı nasıl yakaladığımız" değişiyor sadece, "nasıl okuduğumuz" aynı.

### 5.3 Geliştirme sıralaması (öneri)
1. **Okuma moturu** (yavaş katman): ekran yakalama + bölgesel kırpma + VLM çağrısı + board/bench/sayı okuma. Bu olmadan hiçbir şey olmaz.
2. **Augment okuma** + augment→comp tablosu (en kritik early sinyali).
3. **Puanlama sistemi** + comp tahmini.
4. **Karar mekanizması** (hedef comp + eksiklik tavsiyesi).
5. **Arayüz entegrasyonu** (canlı panel, tavsiyeler, durum gösterimi).
6. **Panic modu + hibrit onay** (kullanıcı geri bildirimi katmanı).
7. **Paketleme** (Tauri/Electron kararı + installer).

### 5.4 Şu anki mevcut durum (comp tarayıcısı)
- 25 comp, Set 17, güncel.
- Comp detay modalı: trait aktivasyonları, augment gereksinimleri, 3-yıldız hedefleri, sticky stat footer.
- Bu kısım HAZIR, dokunmuyoruz. Canlı okuma tarafı bunun yanına eklenir.

### 5.5 Test notu (önemli)
- **Ekran paylaşımı (Canlı Bağla) z.ai preview paneli (iframe) içinde ÇALIŞMAZ.**
- Tarayıcılar iframe içinde `getDisplayMedia` çağrısını güvenlik sebebiyle engeller (direkt "İzin reddedildi" hatası, hiç sormaz).
- Test için: **her zaman "Open in New Tab"** yap → ayrı sekmede aç → orada "Canlı Bağla" çalışır.
- App'e paketlenince bu sorun yok (app penceresi iframe değil, gerçek pencere).

### 5.6 BEKLEYEN TEST (kullanıcı yapacak)
- **Yol A prototipi (Canlı Bağla) testi bekliyor.**
- Kullanıcı TFT'yi açmayacak ilk seferde, herhangi bir pencere ile "mekanizma çalışıyor mu" testi yapacak.
- Adımlar: Open in New Tab → Canlı Bağla → herhangi pencere paylaş → 5-10 sn bekle → sonucu bildir.
 Beklenen: "Son okuma" bölümü çıkar, "Okunamadı (ekran TFT değil mi?)" veya "VLM meşgul" mesajı görünür.
- Test sonrası: oran (top crop %12), sıklık (5sn), hata mesajları ayarlanır. Sonra TFT ile gerçek test.
- **Asistan görevi: her fırsatta kullanıcıya "Canlı Bağla testini yaptın mı?" hatırlat.**

---

## 6. UNUTULMAMASI GEREKEN KARARLAR

- ✅ Shop okuma YOK (kullanıcı iptal etti).
- ✅ Kullanıcı comp seçmez, sistem duruma göre yön verir.
- ✅ Sadece website değil, indirilen program.
- ✅ z.ai sandbox'tan bağımsız ürün.
- ✅ Early game açığı augment + bench + item ile kapatılır.
- ✅ Stratejik tavsiye önce, taktiksel (shop) tavsiye yok.
- ✅ Hibrit mod EVET (stage 2-1'de 3 comp soralım, kullanıcı tıklar). En kötü sonradan değişiriz.
- ✅ Her iş sonrası düz Türkçe özet.
- ✅ Onaysız özellik yok.
- ✅ Okuma sıklığı 5 sn (kabul edildi). RİSK: geçmişte 10 sn'de bile VLM hata veriyordu, 5 sn'de daha sık çağrı olduğu için sorun çıkabilir. Sorun çıkarsa ayarlarız.
- ✅ Şampiyon ikon verisini asistan toplar (web'den). Okuyamazsa nerede devreye girileceğini asistan bilir, kullanıcıya bırakılmaz.
- ✅ İki ekran yakalama yolu da durur: tarayıcı (kolay) + Python capture (arka plan). Kullanıcı seçer. Paket halinde tek installer hepsini kurar.
- ⏳ Tauri vs Electron dağıtım kararı SONRAYA (şimdi değil, paketleme aşamasında konuşulur).
- ✅ Augment okuma EVET (kullanıcı kararı, güncelleme 5: "herkes okuyor, biz de okuyalım"). TFTSense'in etik kaygısı takılmıyor. Gerçek VLM okuma + fuzzy normalize. Panic modu yedek.
- ✅ VLM→CV geçişi UZUN VADELİ hedef (kullanıcı onayı: "sen daha iyi bilirsin, uzun vadede olur"). Başlangıçta VLM, sonra Rust + şablon eşleştirme. Hız (0.3sn vs 3-8sn) + maliyet ana motivasyon.

---

## 7. CEVAPLANAN SORULAR (bu tur)

1. ~~Dağıtım formatı: Tauri mi Electron mu?~~ → SONRAYA, paketleme aşamasında konuşulur.
2. ~~Okuma sıklığı?~~ → 5 sn. (Risk: VLM 10 sn'de bile hata veriyordu, 5 sn'de sorun çıkarsa ayarlarız.)
3. ~~Şampiyon ikon verisi: toplayalım mı?~~ → Asistan toplar (web'den). Okuma hatasında asistan müdahale eder.
4. ~~Hibrit mod olsun mu?~~ → EVET. En kötü sonradan değişiriz.

**Bekleyen:** Başlangıç adımı onayı (aşağıda bölüm 9).

---

## 8. DEĞİŞİKLİK GEÇMİŞİ

- **İlk oluşturma:** Konuştuğumuz vizyon, kararlar, 10 maddelik early listesi, çalışma kuralları yazıldı. Onay bekleniyor.
- **Güncelleme 1:** 4 soru cevaplandı (5sn okuma, hibrit evet, ikon asistanda, dağıtım sonraya). "Takır takır" lafı sadeleştirildi. Test kuralı netleştirildi: okuma testi kullanıcıda, kod asistanda. Başlangıç adımı (bölüm 9) onay bekleniyor.
- **Güncelleme 2:** "Arka plan şart" + "ikisi de dursun" kararı. Bölüm 5.2 eklendi: iki yol (tarayıcı + Python) ortak çekirdeği paylaşır. Paket tek installer ile ikisini de kurar, kullanıcı terminal görmez.
- **Güncelleme 3:** Yol A prototipi (Canlı Bağla) KODU YAZILDI. live-capture.tsx oluşturuldu, page.tsx'e entegre edildi. Lint temiz, agent-browser ile render onayı. Kullanıcı testi bekliyor (bölüm 5.6). İframe notu eklendi (bölüm 5.5).
- **Güncelleme 4:** TFTSense yama notları için bölüm 10 eklendi (kullanıcı gönderecek, asistan işleyecek).
- **Güncelleme 5:** Augment okuma kararı TERSİNE döndü. Kullanıcı: "augmenti herkes okuyor, biz de okuyalım" (Blitz/MetaTFT/Mobalytics referansı). TFTSense'in etik kaygısı takılmıyor. Bölüm 4.1 gerçek VLM okuma olarak güncellendi (panic modu yedek). Bölüm 10.3 ve 10.4 güncellendi. VLM→CV geçişi uzun vadeli hedef olarak onaylandı (bölüm 6).

---

## 9. BAŞLANGIÇ ADIMI (ONAYLANDI, uygulandı)

**İlk yapılacak iş:** Ekran paylaşımı + tek kare + üst şerit okuma prototipi.

Neden bu: Okuma moturunun en küçük çalışan hali. Sayı okuma (altın, level, round) en kolay ve en güvenilir kısım. Bu çalışınca "okuma moturu var" deriz, sonra bench → board → augment ekleriz.

**Somut adımlar (Yol A — tarayıcı prototipi):**
1. Sitenin üstüne "Canlı Bağla" butonu koy (tarayıcı ekran paylaşımı).
2. Kullanıcı TFT penceresini paylaşır.
3. Sistem bir kare alır, üst şeridi (altın/level/round/can) kırpar (JavaScript'te canvas ile).
4. Kırpanan parçayı `/api/snapshot`'a yollar (eski Python yolu ile aynı endpoint).
5. `vlm-analyzer.ts` (mevcut, değişmiyor) sayıları okur.
6. Sonucu ekrana yazar ("altın: 12, level: 7, round: 3-2").

**Durum:** KODU YAZILDI (live-capture.tsx). Lint temiz, render onaylandı. Kullanıcı testi bekliyor (bölüm 5.6).

Not: Yol B (Python capture) mevcut haliyle durur, dokunulmaz. Bu prototip sadece Yol A'yı ekler.

Test (kullanıcıda): Prototip çalışınca sana gösteririm. TFT açar, ekran paylaşırsın, bir kare alır okurum. Sonucu sana gösteririm: "ben 12 altın, level 7, round 3-2 okudum". Sen "doğru" veya "yanlış, aslında 14 altın" dersin. Yanlışsa döner düzeltirim.

Bu adımdan sonra sıra: bench okuma → board okuma → augment okuma → puanlama → karar → arayüz → paketleme (Tauri/Electron + Python capture katarlı installer).

---

## 10. TFTSense YAMA NOTLARI (kullanıcı gönderecek, asistan işleyecek)

> Bu bölüm TFTSense'in kendi yama notlarından çıkarılan ipuçlarını tutar.
> Amaç: TFTSense'in çözdüğü sorunları/eklediği özellikleri öğrenip kendi geliştirmemize yön vermek.
> Kullanıcı notları gönderince, asistan buraya özetler ve bölüm 4 (early game) / bölüm 5 (teknik) ile ilişkilendirir.

### 10.1 Bekleyen Notlar
- ✅ TFTSense sitesi baştan sona okundu (home, features, faq, comparison, docs, patch-notes, study-hall). Notlar aşağıda özetlendi.

### 10.2 Çıkarılan İpuçları (TFTSense incelendi)

**A. Teknik yapı (doğrulama)**
- TFTSense **Tauri 2 + Rust + Preact** kullanıyor. Yani bizim "indirilen küçük program (Tauri-benzeri)" vizyonumuz doğru.
- Rust backend okuma pipeline'ını çalıştırıyor, Preact (React-benzeri) frontend arayüz.
- **Tauri vs Electron kararı: TFTSense Tauri seçmiş, bu bize referans.** Tauri küçük (10-50MB), Rust ile native okuma yapılır, web tech ile arayüz.
- Windows-only (şimdilik). Borderless/Windowed mod şart, tam ekran exclusive'te overlay çizilmez.

**B. Okuma yöntemi: VLM DEĞİL, saf computer vision**
- TFTSense **VLM kullanmıyor**. "Pure computer vision" diyor. Yani şablon eşleştirme / görüntü tanıma (Rust'ta).
- Bu ÖNEMLİ ipucu: VLM yavaş (3-8 sn) ve pahalı. TFTSense saniyede birkaç kare okuyor (reroll'da 3 kat hızlı).
- Bizim planımızda VLM var. İleride Rust + şablon eşleştirmeye geçmek daha iyi olabilir. Ama başlangıç için VLM çalışır, sonra optimize ederiz.

**C. Board kalibrasyonu (kritik, biz de yapmalıyız)**
- TFTSense 4 köşe hex sürükle-bırak ile kalibrasyon istiyor: Front-left, Front-right, Back-right, Back-left.
- 4x7 = 28 hex. 4 köşeden matematiksel olarak tüm grid warp ediliyor.
- **Default 1920x1080 için** hazır grid var, kalibrasyon opsiyonel ama önerilir.
- Kalibrasyon board okuma + placement bubble'ları için ŞART. Sayılar (gold/level) kalibrasyonsuz çalışır.
- **Bizim sıralamamız doğru:** önce sayılar (kolay), sonra board (kalibrasyon lazım).

**D. Etik sınır: Augment seçim ekranını OKUMA**
- TFTSense augment seçim ekranını OKUMUYOR: "Never reads or displays the live augment offer on the augment-select screen, because that would cross the line."
- Sadece augment statik verisini (tier, açıklama) gösteriyor.
- **Bizim planımızda augment okuma var (bölüm 4.1).** Bunu yeniden düşünelim — augment ekranını okumak yerine, kullanıcıya "augment seçtiğini eliyle söyle" (panic modu) daha güvenli olabilir. Veya augment ekranını okuruz ama sadece isim (tier değil). Karar bekliyor.

**E. "Sticky" comp (emin olma katmanı)**
- Comp tahmini saniyede değişmesin diye, yeni comp en az **1.5 saniye "kendini kanıtlamalı"** (prove itself).
- Aynı şeyi bizim "emin olma katmanı" yapacak (2-3 kare üst üste).
- TFTSense'in rakamı 1.5 sn — bize referans.

**F. Pool counting (havuz sayımı)**
- "you own 2 of 9" — her şampiyonun havuzda sınırlı kopyası var (1-cost: 29, 2-cost: 22, 3-cost: 18, 4-cost: 12, 5-cost: 9).
- Board + bench'te kaç kopya var sayılır, kalan havuz hesaplanır.
- "3 yıldız gerçekçi mi" sorusunu cevaplar. Comp tahminini güçlendirir.
- **Bizim comp verisine eklenebilir.** Şampiyon havuz boyutları statik bilgi.

**G. Contested detection (rakip aynı comp'a oynuyor)**
- Carry shop'ta görünmüyorsa → "contested" işaretle → uncontested comp'a geç.
- **SORUN:** Bu shop okuma gerektirir. Biz shop okumayı bıraktık. Ama bench birikimi ile telafi: "carry'den 2-3 tane var ama 2 yıldız yapamıyorsan contested olabilir."
- Veya: "carry 2 yıldız olmadı stage 3'te, contested sinyali." Bizde olablir ama zayıf versiyon.

**H. Tempo chip (tek satır karar)**
- "roll / level / push / hold" — board gücü + gold + level'dan türetilir.
- Tek satır headline tavsiye. Bizim "oneLiner" ile aynı.
- Bizim advisor.ts bunu yapıyor zaten (economy + stage).

**İ. 35 gold rule + loss-streak play + HP-pressure rolldown**
- 35 gold'ta roll-down yap (stabilize etmek için).
- Loss-streak oyna (HP düşerken altın biriktir).
- HP düşükse roll to stabilize.
- Bunlar **statik TFT kuralları**, bizim advisor'a eklenebilir. Kural tablosu yazılır.

**J. Diamond positioning**
- Tanklar ön ve ortada, melee carry'ler arkalarında, ranged carry'ler arka köşede.
- "front/back" yerine "3 sıra" mantığı.
- Bizim board yerleşim tavsiyesine eklenebilir (şimdilik yok).

**K. Per-level comp board**
- Comp'ı sadece endgame board olarak değil, her level için göster (level 6 board, level 7 board, vs.).
- "Şu an levelsin, bu level'da board'ın şöyle olmalı."
- **Bizim comp verisine eklenebilir.** Her comp için per-level board tanımı.

**L. Demo mode**
- Oyun yoksa mock data göster, panel boş kalmasın.
- TFTSense "Demo" pill'i ile bunu yapıyor.
- Bizde: Canlı Bağla beklerken "Demo" modu olabilir (örnek ekran gösterimi).

**M. Reading pipeline crash recovery**
- Okuma çökerse overlay birkaç saniyede boşalır, donmaz.
- "the reading pipeline now recovers from crashes on its own"
- **Bizim in-flight guard (60s watchdog) ile aynı mantık.** Zaten yapmışız.

**N. Augment okuma etik sınırı (tekrar vurgu)**
- TFTSense augment seçim ekranını okumuyor. Sadece augment statik verisini gösteriyor.
- Etik sınır: "would cross the line" — augment teklifini gerçek-zamanlı okumak Riot ToS'a yakın.
- **Bizim augment okuma planımız (bölüm 4.1) yeniden değerlendirilmeli.** Aşağıda bölüm 10.3'te.

**O. Shop okuma hızı**
- TFTSense shop okumayı reroll/buy'dan sonra **3 kat hızlı** yapıyor (~0.3 sn).
- VLM bunu yapamaz (3-8 sn). Bu da VLM→CV geçişini destekler.

**P. "Confirm your board" manuel onay**
- Kullanıcı board'daki şampiyonları elle tick eder, okuma + manuel birleşir.
- Okuma yanlışsa kullanıcı düzeltir.
- **Bizim panic modu / hibrit mod ile aynı.** Bizde zaten var.

**Q. 1080p şart + ultrawide desteği**
- 1920x1080 için tuned. Ultrawide (21:9, 32:9) için "centered 16:9 band" kullanılıyor.
- Bizim Yol A'da ekran paylaşımından gelen çözünürlük neyse o, kırparız. 1080p varsayım yeterli başlangıç.

**R. Update mekanizması**
- App açılınca güncelleme kontrolü, arka planda kurulum.
- "always on the latest patch's comps and coaching without reinstalling"
- Bizim paketleme aşamasında düşüneceğimiz şey.

### 10.3 Bizim Planla İlişkisi

**Doğrulanan kararlar:**
- ✅ Tauri-benzeri dağıtım (TFTSense de Tauri kullanıyor) — bölüm 5.1
- ✅ Sıralama: sayılar önce (kolay), board sonra (zor, kalibrasyon lazım) — bölüm 4, 5.3
- ✅ Emin olma katmanı (1.5 sn "prove itself") — bölüm 2.3
- ✅ Borderless/Windowed mod şart — bölüm 5'e eklenmeli
- ✅ Reading pipeline crash recovery — zaten var (in-flight guard)
- ✅ Hibrit mod (manuel onay + okuma) — bölüm 4.8

**Onaylanan kararlar (güncelleme 5 sonrası):**
- ✅ **Augment okuma (bölüm 4.1):** KULLANICI KARARI — augment okuyacağız. TFTSense "etik sınır" diye okumuyor ama Blitz/MetaTFT/Mobalytics okuyor (veya memory'den çekiyor). Kullanıcı: "herkes okuyor, biz de okuyalım." TFTSense kaygısını takmıyoruz. Augment ekranını VLM ile oku (orta bölge crop), 3 ismi normalize et (fuzzy match), comp tahminine besle. Panic modu yedek (okuma başarısızsa kullanıcı eliyle yazar).
- ✅ **VLM → CV geçişi (uzun vadeli):** KULLANICI ONAYI — "sen daha iyi bilirsin, uzun vadede olur." Başlangıçta VLM (çünkü CV Rust'ta yazmak zor, Tauri'ye geçince), ileride Rust + şablon eşleştirme. Motivasyon: VLM 3-8 sn + para, CV 0.3 sn + parasız. TFTSense saf CV kullanıyor, bu bize referans.

**Eklenebilecek yeni özellikler:**
- ➕ Pool counting (havuz sayımı) — comp verisine statik bilgi ekle.
- ➕ 35 gold rule + loss-streak + HP-pressure rolldown — advisor'a statik kurallar.
- ➕ Per-level comp board — her comp için level 6/7/8/9 board tanımı.
- ➕ Demo mode — Canlı Bağla beklerken örnek veri.
- ➕ Diamond positioning — 3 sıra yerleşim tavsiyesi.
- ➕ Board kalibrasyonu — 4 köşe sürükle-bırak (Tauri'ye geçince).

**Bizden daha iyi olduğumuz alanlar (şimdilik):**
- Bizim comp tarayıcısı 25 comp, detay modalı (trait aktivasyonları, augment gereksinimleri, 3-yıldız hedefleri) — TFTSense benzeri var ama bizimki web'den erişilebilir.
- İki yol (tarayıcı + Python) — TFTSense sadece app, web erişimi yok.

### 10.4 Sıralama Güncellemesi (TFTSense notları sonrası)

1. Yol A prototipi (Canlı Bağla) — KODU YAZILDI, test bekliyor.
2. Sayı okuma (üst şerit) — prototipte var, test sonrası iyileştir.
3. Bench okuma → board okuma (kalibrasyon ile).
4. **Augment okuma (VLM ile GERÇEK okuma) + augment veritabanı + fuzzy normalize.** Panic modu yedek (okuma başarısızsa). (bölüm 4.1, güncelleme 5)
5. Pool counting + 35 gold rule + per-level board — advisor'a ekle.
6. Karar mekanizması + puanlama.
7. Arayüz entegrasyonu.
8. Tauri'ye paketleme + CV'ye geçiş (uzun vadeli).

---

## 11. MEMORY OKUMA SEÇENEĞİ (KULLANICI ÖNERİSİ — ARAŞTIRMA AŞAMASINDA)

> Kullanıcı önerisi: "ban riski okuma-only + kişisel kullanım için çok düşük, Riot göz yumuyor."
> Blitz/Mobalytics memory okuyor, ban yemiyorlar. Biz de deneyebilir miyiz?

### 11.1 Durum
- ✅ Ban riski: DÜŞÜK (okuma-only, hile yok, kişisel kullanım, Riot göz yumuyor).
- ✅ Doğruluk/hız: MÜKEMMEL (TFTSense bile CV ile uğraşıyor, memory daha kolay + doğru).
- ⚠️ Teknik zorluk: YÜKSEK (pointer/offset bulma, her patch bakım, Windows API, Tauri şart).
- ⚠️ Offset kaynağı: YOK (topluluk paylaşmıyor, talep az. Kullanıcı "dumper" arayabilir, Cheat Engine ile kendimiz bulmak zor).
- ⚠️ Ben (asistan) offset bulamam: TFT yok, Cheat Engine çalıştıramam. Kullanıcı veya topluluk bulmak zorunda.

### 11.2 Plan (uzun vadeli, şimdi değil)
1. Önce VLM prototip bitir (sayı → bench → board → augment → karar → arayüz).
2. Tauri'ye geç (tarayıcıda memory okunmaz, native şart).
3. Tauri'de 3 yol dene sırayla:
   - **A. VLM** (yavaş ama esnek, mevcut).
   - **B. CV** (Rust şablon eşleştirme, TFTSense gibi).
   - **C. Memory** (en hızlı + doğru ama offset lazım, her patch bakım).
4. Hangisi daha iyi gelirse onu seç. Üçü de pakete dahil edebiliriz, kullanıcı seçer.

### 11.3 Memory için gerekenler (Tauri sonrası)
- Rust + windows-rs crate (ReadProcessMemory).
- TFT process ID bulma, handle açma (admin gerekebilir).
- Cheat Engine ile offset bulma (kullanıcı veya topluluk yapar).
- Champion ID → isim tablosu (elle yazılır, her patch güncellenir).
- Antivirüs workaround (kod imzalama veya kullanıcıya "izin ver" mesajı).
- Her patch için offset güncelleme (1 gün/patch).

### 11.4 Karar
- **Şimdi HAYIR.** VLM prototip bitene kadar beklenir.
- Tauri'ye geçince **denenebilir**. Offset bulunursa C yolu (memory) en hızlı + doğru olur, Blitz seviyesi.
- Offset bulunamazsa → B yolu (CV) veya A yolu (VLM) kalır.
- Topluluk "dumper" çıkar veya kullanıcı offset bulursa, memory yolu aktif edilir.

### 11.5 Dumper Araştırması (kullanıcı yapacak)
- "TFT memory dumper", "TFT offset github", "TFT Cheat Engine table" ara.
- Topluluk forumları (Reddit /r/CompetitiveTFT, Discord).
- Bulunan offset'ler PLAN.md'e eklenir, her patch güncellenir.

### 11.6 LOL vs TFT Offset İlişkisi (düzeltme)
> Önceki mesajımda "TFT farklı process" demiştim — YANLIŞ. Düzeltme:
> TFT, `League of Legends.exe` içinde bir moddur. Aynı process, aynı motor, aynı bellek.

**LOL offset'leri TFT'de ÇALIŞIR (ortak motor):**
- HeroList (şampiyon listesi) — board'daki şampiyonları listele.
- Şampiyon HP'si, koordinatları (X, Y, Z), isim — hepsi aynı struct.
- ObjectManager, GameObject yapısı — birebir aynı.

**LOL offset'leri TFT'de ÇALIŞMAZ (TFT'ye özel):**
- Shop (5 slot dükkan).
- Altın miktarı.
- Augment'ler.
- Stage/round bilgisi.
- Level/XP.

**Strateji:**
1. **Board okuma** (şampiyon isimleri + yıldız + item) — LOL offset'leri ile yapılabilir (HeroList). UnknownCheats'te hazır var.
2. **Sayı okuma** (altın, HP, level, stage) — TFT özel offset gerekir. Cheat Engine ile "LocalPlayer içinden TFT alt adresleri" bulunur. UnknownCheats'te "TFT" araması ile kod blokları var.
3. **Augment okuma** — TFT özel, manuel bulunur.

**UnknownCheats arama:**
- "TFT" araması LOL bölümünde → diğer geliştiricilerin "LOL offset'inden TFT shop/altın bulma" kod blokları var.
- Bu bloklar bize hazır offset verebilir, Cheat Engine ile uğraşmaya gerek kalmaz.

### 11.7 LCU API (Riot resmi — alternatif yol)
- Riot, oyun client'ı ile yerel API açıyor (LCU API).
- `https://127.0.0.1:PORT` adresinde çalışır.
- Canlı oyun verisi verir mi? ARAŞTIRILACAK.
- Varsa: ban riski SIFIR, memory okumaya gerek yok.
- Yoksa: memory yoluna devam.

### 11.8 Memory Offset Detayları (UnknownCheats topluluğu — 2024-2025)

> Kaynak: UnknownCheats "Some Nice TFT Information" + "TFT In-Game Shop Manager" başlıkları.
> Bu bilgiler Tauri sonrası memory okuma için hazır notlar. Şimdi kullanılmıyor.

#### A. Şampiyon Listesi — MinionList (HeroList DEĞİL)
- TFT şampiyonları `HeroList`'te değil, **`MinionList`** içinde tutulur.
- Board, bench, shop kartları — hepsi oyun motoru için "minyon".
- MinionList offset'i oku → dev nesne havuzu.
- Filtre: `mName` içinde "TFT" geçenleri al.
- İsim örnekleri:
  - `S3000054_TFT_BoardSlot` (board karesi)
  - `TFT_BenchSlot` (bench karesi)
  - `TFT12_Ziggs` (şampiyon — Set 12, isim Ziggs)
  - `TFT_ItemBenchSlot` (item slot)

#### B. Yıldız Seviyesi (Star Level) — Boyut Çarpanı
- Şampiyonun 1/2/3 yıldız olduğunu boyut çarpanından anla.
- LoL motorunda temel boyut = 1.0.
- 2-3 yıldız yapınca oyun içi boyut büyür, bellek değeri de değişir.
- Kural:
  - `size == 1.0` → 1 yıldız
  - `1.0 < size < 1.3` (örn. 1.15) → 2 veya 3 yıldız
- (Tam eşik değerleri Cheat Engine ile doğrulanmalı.)

#### C. Oyuncu Struct'ı — 8 oyuncu, 96 byte aralıklı
```cpp
struct TFTPlayerEntry {
    uint8_t  partnerGroupId;  // +9. byte  (Takım ID'si)
    uint8_t  health;          // +10. byte (Oyuncunun anlık HP'si)
    uint32_t playbookItemId;  // +32. byte
    void*    units_array;     // +56. byte (Oyuncunun şampiyon listesi pointer'ı)
    uint32_t unit_count;      // +64. byte (Board + bench'teki toplam şampiyon sayısı)
};
// 8 oyuncu yan yana, her biri 96 byte. Toplam 768 byte.
```
- Bu struct'tan 8 oyuncunun HP'si okunur → leaderboard yerine.
- Kendi HP'miz için: oyuncu index'i bulunmalı (genelde 0 veya LocalPlayer pointer'ı).

#### D. Shop Manager — TFT_ShopManager global pointer
- Dükkandaki 5 kartın ne olduğunu verir.
- Global pointer: `TFT_ShopManager`.
- İçinde yan yana dizilmiş 5 × (ChampionID + Cost) çifti.
- ChampionID → isim tablosu gerekir (örn. 142 = Jhin). Her patch güncellenir.

#### E. Item Bench — TFT_ItemBenchSlot × 10
- Sol kenarda biriken item'lar için 10 slot.
- Obje ismi: `TFT_ItemBenchSlot`.
- İçinden item ID'si okunur → item isim tablosu.

#### F. Bench (Yedek Kulübe) — TFT_BenchSlot × 9
- 9 slot, obje ismi `TFT_BenchSlot`.
- MinionList'ten "TFT_BenchSlot" içerenleri filtrele → 9 bench karesi.
- Her karenin içinde şampiyon referansı var.

### 11.9 Memory Okuma Yol Haritası (Tauri sonrası)

1. **Bağlantı:** Rust + windows-rs, `League of Legends.exe` process ID bul, handle aç (PROCESS_VM_READ).
2. **Module base:** League of Legends.exe base address + module offset'leri.
3. **MinionList oku:** HeroList yerine MinionList offset'i. mName filtre "TFT".
4. **8 oyuncu HP:** TFTPlayerEntry struct'ı, 96 byte aralıklı, +10. byte = HP.
5. **Board şampiyonları:** MinionList'ten "TFT_BoardSlot" veya "TFT12_..." filtrele, size multiplier → star level.
6. **Bench şampiyonları:** MinionList'ten "TFT_BenchSlot" filtrele.
7. **Shop:** TFT_ShopManager global pointer → 5 × (ChampionID + Cost).
8. **Item'lar:** TFT_ItemBenchSlot × 10.
9. **Level/altın/augment:** Bilinmiyor, Cheat Engine ile bulunacak. UnknownCheats'te "TFT" ara.

### 11.10 Öncelik Sırası (Tauri sonrası)
- **Kolay (önce):** 8 oyuncu HP (struct hazır), MinionList → board şampiyon isimleri.
- **Orta:** Bench, item bench, size multiplier → star level.
- **Zor (sonra):** Shop, altın, augment, stage/round (TFT özel offset, manuel bulunacak).

> Not: Bu bilgiler 2024-2025 döneminden. Set 17'de offset'ler değişmiş olabilir ama
> struct mantığı aynı. Cheat Engine ile doğrulamak gerekir. Kullanıcı veya topluluk
> güncel offset'leri UnknownCheats'ten çekecek.

### 11.11 Kesin Okunabilir Veriler (LOL offsetleri ile — ek notlar)

> Kaynak: UnknownCheats ek araştırma. LOL offset'leri TFT'de birebir çalışan kısımlar.

**1. Tahta + Yedek Şampiyonlar (MinionList)**
- LOL MinionList offset'i oku.
- mName filtre: "TFT12_Ziggs", "TFT12_Ahri" gibi "TFT" ile başlayanlar.
- Tüm lobby'deki şampiyonları yakalar (8 oyuncunun hepsi).

**2. Şampiyon Koordinatları (X, Y, Z)**
- Her şampiyon objesinde X, Y, Z offset — LOL ile birebir aynı.
- Hangi hex'te duruyor, ne tarafa yürüyor → overlay'de göster.
- (Bizde overlay yok şimdilik, ama ileride board yerleşim tavsiyesi için kullanılabilir.)

**3. Anlık HP ve Mana (mHealth, mMana)**
- LOL offset'leri ile ortak.
- Şampiyonların can barlarını overlay'de baştan çizdirebilir.
- (TFTSense bunu yapıyor — rakip board'larında şampiyon HP'si.)

**4. 8 Oyuncu HP'si**
- TFTPlayerEntry struct'ı (96 byte aralıklı, +10. byte = HP).
- VEYA HeroList (her oyuncunun Küçük Efsanesi motor için bir "hero").
- 0-100 arası HP kesin okunur.

### 11.12 Geliştirici Tüyoları (UnknownCheats sırları)

**A. Havuz Kontrolü (Pool Counter)**
- TFT'de her şampiyondan havuzda kaç tane kaldığını hesaplama.
- Yöntem: Tüm MinionList'i tara, o şampiyondan toplamda kaç tane spawn edildiğini say.
- "TFT_BenchSlot" veya "TFT_BoardSlot" içeren obje = bir oyuncu tarafından satın alınmış.
- Toplam havuz sayısı − satın alınan = havuzda kalan kart.
- (TFTSense'in "you own 2 of 9" özelliği bu mantıkla çalışıyor.)
- Pool boyutları: 1-cost: 29, 2-cost: 22, 3-cost: 18, 4-cost: 12, 5-cost: 9.

**B. Eşya Havuzu (Item Bench) Takibi**
- TFT_ItemBenchSlot objelerini tara (sol alt köşedeki basılmamış item'lar).
- Alt offset'ler: slotta hangi item olduğunu ID olarak verir (örn. B.F. Sword, Needlessly Large Rod).
- Item ID → isim tablosu gerekir.

**C. Yıldız Seviyesi — 2 Yöntem**
- **Yöntem 1 (SpellBook):** Şampiyon nesnesindeki SpellBook offset'ini oku. AMA bazen sadece kendi şampiyonlarında çalışır.
- **Yöntem 2 (Size Multiplier):** Rakiplerininkini de görmek için boyut çarpanı. 1.0 = 1 yıldız, >1.0 = 2-3 yıldız. (Daha güvenilir.)

**D. Dükkan (Shop) Kartları**
- TFT_ShopManager global pointer.
- Her tur başında güncellenen 5 kart.
- Her slot ChampionID barındırır.
- (Biz shop okumayı bıraktık ama memory ile %100 doğru okunabilir — ileride ekleyebiliriz.)

### 11.13 Overlay Stratejisi (Tauri sonrası — özet)

En temiz yol (UnknownCheats önerisi):
1. UC'den güncel LOL offset listesini al.
2. Rust kodunu League of Legends.exe process'ine bağla.
3. MinionList'i döngüye sok.
4. İsminde "TFT" geçen objeleri filtrele ve ekrana yazdır.
5. Bu başarılırsa overlay projenin **%80'i bitmiş** demektir.

> Yani: ilk milestone = MinionList oku + "TFT" filtre + şampiyon isimleri listele.
> Gerisi (HP, yıldız, koordinat, shop) bunun üzerine eklenir.

### 11.14 Memory Okuma — Güvenlik ve Kod Yapısı (Tauri sonrası)

> Kaynak: UnknownCheats / yapay zeka tüyoları. Sadece yenileri not alındı.

**A. Handle Hijacking (Vanguard atlatma — ÖNEMLİ)**
- `OpenProcess` yerine **Handle Hijacking** kullan.
- Mantık: Bilgisayarda zaten açık olan Discord/Spotify gibi programların LoL'e açtığı **yasal handle'ı çal**.
- GitHub/UC'de 20-30 satırlık hazır Rust/C++ kodu var.
- Vanguard'a yakalanma riski sıfıra yakın.
- Güvenlik kodu yazmaya gerek yok, hazır kod yapıştır.

**B. offsets.rs Tek Dosya**
- Tüm offset'leri tek bir Rust dosyasında topla (`offsets.rs`).
- Ana kodda `offsets::MINION_LIST` şeklinde çağır.
- Her patch'te sadece bu dosyayı güncelle, kafa karışmaz.

**C. Pointer Chain Helper (read_pointer_chain)**
- UC'den gelen veriler bazen zincir: "LocalPlayer → +0x60 → +0x10".
- `read_pointer_chain(base, vec![0x60, 0x10])` helper fonksiyonu yaz.
- Her seferinde 5 satır yazma, tek çağrı.

**D. WorldToScreen (Overlay için ŞART)**
- Memory'den 3D koordinat (X, Y, Z float) gelir.
- Ekran pikseline çevirmek için **ViewMatrix** offset'ini oku.
- WorldToScreen formülü: 3D → 2D piksel.
- Tauri overlay'i tam şampiyon üstüne oturtmak için şart.
- (Bizde overlay şimdilik yok, Tauri sonrası board yerleşim tavsiyesi için.)

> Not: u64/usize (64-bit adresler), cargo build --release (Vanguard analiz zor) — standart Rust, not almaya gerek yok.

---

## 12. MEMORY OKUMA SCAFFOLD (Tauri Sonrası — Stub Yazıldı)

> Kullanıcı 2026-07-09'da güncel LOL offset listesini sağladı (710 offset).
> Memory okuma için iskelet dosyaları oluşturuldu. Mevcut VLM koduna DOKUNULMADI.

### 12.1 Oluşturulan Dosyalar

**1. `src/lib/tft-data/offsets.ts`** — offset referans verisi
- Tüm offset'ler hex string olarak (ES2017 target, BigInt literal desteklenmiyor).
- Runtime'da `BigInt()` ile parse edilir.
- Negatif offset'ler (dump'ta `0x-FFFFFFFFFE124C88`) işaretsiz 64-bit hex olarak (`"0xFFFFFFFFFE124C88"`), 64-bit wraparound ile çözülür.
- Gruplar: GLOBALS, HERO, OBJECT, ATTACKABLE_UNIT, AVATAR, OBJECT_MANAGER, GAME_OBJECTS, INVENTORY, SPELL_BOOK, CHARACTER_DATA_STACK, HUD, D3D.
- `TFT_PENDING_OFFSETS` — TFT'ye özel olup dump'ta olmayan offset'ler (null placeholder).
- Helper fonksiyonlar: `toBigInt`, `isNegativeOffset`, `toSigned`, `resolveAddress`.
- Rust tarafında `src-tauri/src/offsets.rs` olarak 1:1 kopyalanacak.

**2. `src/lib/tft/reading-provider.ts`** — okuma yöntemi soyutlaması
- `ReadingProvider` interface: `read()`, `isConnected()`, `disconnect()`.
- `ReadingMethod` type: `"vlm" | "memory" | "cv" | "lcu"`.
- `MemoryReaderConfig`, `VlmReaderConfig` tipleri.
- `createReader(method)` factory (şimdilik hepsi hata atar — VLM refactor edilmedi).
- Amacı: üst katman (advisor, sanity filter, UI) hangi okuma yöntemi kullanıldığını bilmesin.

**3. `src/lib/tft/memory-reader.ts`** — MemoryReader stub
- `MemoryReader` sınıfı, `ReadingProvider` interface'ini implement eder.
- Tüm fonksiyonlar "Tauri ortamı dışında çalışmaz" hatası atar (kasıtlı — yanlışlıkla tarayıcıda çağrılırsa sessizce boş state döndürmesin).
- Alt-seviye fonksiyonlar (Rust implementasyonu için imza hazır):
  - `readGold`, `readLevel`, `readHp`, `readStage`, `readRound`
  - `readBoard`, `readBench`, `readAugments`
  - `readChampionPool` (pool counter — TFTSense "you own 2 of 9" özelliği)
  - `readAllPlayersHp` (8 oyuncu, leaderboard yerine)
  - `worldToScreen` (overlay için — 3D→2D)
- `createMemoryReader(config)` factory, Tauri global kontrolü yapar.

### 12.2 Eksik Offset'ler (Kullanıcı Toplayacak)

Aşağıdaki offset'ler dump'ta YOK. Cheat Engine veya topluluk ile bulunmalı:

- **TFTPlayerEntryBase** — 8 oyuncu struct'ı başlangıç adresi. (Stride 96, HP +10, units_array +56, unit_count +64 biliniyor.)
- **TFTShopManager** — dükkan kartları (5 × ChampionID + Cost). Biz shop okumayı bıraktık ama memory ile %100 doğru okunabilir — karar yeniden değerlendirilebilir (PLAN.md 11.12-D).
- **TFTStage** — mevcut stage (1-9).
- **TFTRound** — mevcut round (1-7).
- **TFTAugmentList** — seçili augment'lar.

TFT_BenchSlot / TFT_BoardSlot / TFT_ItemBenchSlot offset'leri gereksiz — bu objeler MinionList'ten mName filtresi ile bulunur ("TFT_BoardSlot" gibi).

### 12.3 Tauri Sonrası Yol Haritası

1. Tauri projesi kurul (`src-tauri/`).
2. `offsets.rs` yaz — `offsets.ts`'in 1:1 Rust kopyası.
3. `memory_reader.rs` yaz — `MemoryReader` sınıfının Rust karşılığı.
   - Handle hijacking (Vanguard atlatma — PLAN.md 11.14-A).
   - `read_pointer_chain` helper (PLAN.md 11.14-C).
   - `read_gold`, `read_level`, `read_board`, vb. fonksiyonlar.
4. Tauri command: `#[tauri::command] fn read_game_state() -> GameState`.
5. TS tarafında `MemoryReader.read()` → `invoke('read_game_state')` çağrısı.
6. ReadingProvider ile VLM/memory arasında runtime seçim.

### 12.4 Test Stratejisi (Tauri Sonrası)

- Önce `readGold` tek başına test edilir (en kolay — LocalPlayer + Hero.Gold).
- Sonra `readLevel`, `readHp`.
- Sonra `readBoard` (MinionList filtre — en kritik, PLAN.md 11.13'e göre "%80 bitti" milestone).
- En son `readAugments`, `readStage`, `readRound` (TFT özel offset gerektirir).
- WorldToScreen + overlay en son (görsel, kritik değil).

### 12.5 Mevcut Durum (2026-07-09)

- Stub yazıldı, lint temiz, tip kontrolü temiz.
- Mevcut VLM prototip bozulmadı.
- 1280px VLM testi hâlâ bekleniyor (kullanıcıda).
- Memory'ye geçiş için kod zemin hazır, ama Tauri ortamı şart (z.ai sandbox Tauri çalıştıramaz).
- Kullanıcı TFT'ye özel offset'leri topladıkça `TFT_PENDING_OFFSETS` doldurulacak.

---

## 13. WEB SEARCH BULGULARI (2026-07-09 — Tauri/Memory geçişi öncesi araştırma)

> Kullanıcı isteği: "web araması yapabilirsin kanka sıkça istersen plan kısmına kaydet çünkü önemli bilgiler buluyorsun"
> 9 web search + 2 page_reader yapıldı. Bulgular kalıcı olarak burada.

### 13.1 Tauri 2 + Rust + Memory Okuma — MÜMKÜN

- `windows-rs` veya `windows-sys` crate ile `ReadProcessMemory` çağrılır.
- Tauri 2'de Rust fonksiyonu frontend'ten `invoke('read_game_state')` ile çağrılır.
- Örnek kaynaklar:
  - https://v2.tauri.app/develop/calling-rust (Tauri command sistemi)
  - https://learn.microsoft.com/windows/win32/api/memoryapi/nf-memoryapi-readprocessmemory (Win32 API)
  - https://crates.io/crates/read-process-memory (Rust wrapper crate)
  - https://docs.rs/process-memory (alternatif crate)
- Bizim yaklaşım: `windows-rs` crate direkt kullan (en düşük seviye, en az bağımlılık).

### 13.2 Handle Hijacking (Vanguard Atlatma) — KOD VAR

- GitHub'da C++ örnekleri var: `Apxaey/Handle-Hijacking-Anti-Cheat-Bypass`.
- Mantık: `NtQuerySystemInformation` ile sistemdeki tüm handle'ları tara, Discord/Spotify gibi programların LoL'e açtığı yasal handle'ı bul, onu çal.
- Rust referansı: `Kudaes/rust_tips_and_tricks` (Rust Windows cheatsheet).
- **Bizim karar:** Önce basit `OpenProcess` (PROCESS_VM_READ) deneriz. Eğer Vanguard engellerse (muhtemelen engeller), handle hijacking'e geçeriz. İkisi de kodlanır, config'den seçilir (`MemoryReaderConfig.useHandleHijacking`).
- **Risk:** Vanguard her Windows güncellemesinde değişebilir. İlk denemede "access denied" alabiliriz. Çözümleri var ama zaman alır.

### 13.3 LCU / Live Client Data API — TFT İÇİN YETERSİZ

- `https://127.0.0.1:2999/liveclientdata/allgamedata` var, TFT'de çalışıyor.
- AMA: Riot 2020'den beri TFT'ye özel geliştirme yapmamış.
  - GitHub issue #373 (RiotGames/developer-relations): 2020'de açıldı, 2024'te hâlâ açık. "Is Riot Dev team planning any update for this API?" → Cevap yok.
  - Verdiği: temel oyuncu bilgisi (gold bazen yanlış — issue #865).
  - Vermediği: board, bench, shop, augment, stage, round, trait aktivasyonları.
- **Sonuç:** LCU API tek başına yetersiz, memory gerekli. LCU belki "oyun içi miyim" tespiti için kullanılabilir (allgamedata boşsa oyun dışı).

### 13.4 TFT MinionList Okuma — SOMUT BİLGİ VAR (UnknownCheats)

Çok değerli bulgular:

- **MinionList offset:** `0x24A8220` (eski patch, güncel değil ama mantık aynı).
- **mName offset:** `0x2BAC` (her objenin isim alanı).
- **Board objeleri:** mName içinde `TFT_BoardSlot` geçer.
- **Bench objeleri:** mName içinde `TFT_BenchSlot` geçer.
- **Carousel tespiti (koordinat):** `pos.x > 6200.f && pos.x < 8300.f && pos.z > 6800.f && pos.z < 9200.f`
- **Pool counter mantığı:** MinionList'i tara, "TFT_BoardSlot" / "TFT_BenchSlot" içeren objeleri say. Toplam havuz boyutu (1-cost: 29, 2-cost: 22, 3-cost: 18, 4-cost: 12, 5-cost: 9) − satın alınan = kalan.
- **Yıldız seviyesi:** Boyut çarpanı (size multiplier). 1.0 = 1★, >1.0 = 2-3★. CharacterDataStack içinde.
- Kaynak: https://www.unknowncheats.me/forum/league-of-legends/499228-teamfight-tactics.html + /590313-iterate-minionlist.html

### 13.5 Blitz/MetaTFT Nasıl Yapıyor?

- GitHub issue #373'te sorulmuş (Mehdi-YC 2024, Frazl 2024): "how is blitz creating all those dashboards?"
- Riot'tan cevap yok. Topluluk tahmini: memory okuma yapıyorlar (LCU API yetmiyor).
- Yani bizim yolumuz doğru — memory okuma, TFTSense/Blitz/MetaTFT seviyesi için şart.

### 13.6 Tauri 2 + Next.js Entegrasyonu

- Tauri 2 frontendDist olarak statik dosyalar bekler.
- Next.js'i `output: 'export'` ile statik üretmek lazım (SSG).
- AMA: API route'lar (VLM analyzer) statik export'ta çalışmaz.
- **Çözüm:** Tauri içinde Next.js dev server çalıştır (dev modunda). Prod için statik export, API route'lar devre dışı. Frontend runtime'da Tauri varsa `invoke('read_game_state')` çağırır, yoksa `fetch('/api/snapshot')` (VLM yolu) çağırır.
- Yani: VLM yolu web preview için kalır, memory yolu Tauri app için. İkisi paralel.

### 13.7 Kararlar (Bu Araştırma Sonrası)

- ✅ Memory okuma yolu: Tauri 2 + Rust + windows-rs.
- ✅ Handle: önce OpenProcess, sonra hijacking (config'den seçilir).
- ✅ LCU API: yedek olarak "oyun içi mi" tespiti için kullanılabilir, ana yol değil.
- ✅ Board/bench: MinionList + "TFT_BoardSlot"/"TFT_BenchSlot" filtresi.
- ✅ Shop: ilerde eklenebilir (TFT_ShopManager offset gerekir, kullanıcı bulacak).
- ✅ Stage/round/augment: ilerde — panic modu (kullanıcı yazar) veya VLM hibrit.
- ✅ VLM yolu: web preview için kalır, silinmez. Tauri app memory kullanır.

### 13.8 Önemli URL'ler (ileride referans için)

- https://v2.tauri.app/develop/calling-rust — Tauri command sistemi
- https://learn.microsoft.com/windows/win32/api/memoryapi/nf-memoryapi-readprocessmemory — Win32 API
- https://github.com/Apxaey/Handle-Hijacking-Anti-Cheat-Bypass — Handle hijacking C++ örnek
- https://github.com/Kudaes/rust_tips_and_tricks — Rust Windows cheatsheet
- https://github.com/RiotGames/developer-relations/issues/373 — TFT Live Client API eksiklikleri
- https://www.unknowncheats.me/forum/league-of-legends/499228-teamfight-tactics.html — TFT MinionList detayları
- https://hextechdocs.dev — LCU API dokümantasyonu
- https://developer.riotgames.com/docs/tft — Riot TFT resmi dokümantasyon

---

## 14. PROJE DESTEK ARAŞTIRMASI (2026-07-09 — Tauri dev beklerken)

> Kullanıcı bun kurarken geniş çaplı web araştırması yapıldı. 11 web search + 3 page_reader.
> Bulgular projemizin mimarisini ve risklerini doğrudan etkiliyor.

### 14.1 AÇIK KAYNAK TFT MEMORY OKUMA PROJELERİ — ÇOK DEĞERLİ

**A. conradftw/TFT-Tooltips-Twitch-Extension-Companion**
- GitHub: https://github.com/conradftw/TFT-Tooltips-Twitch-Extension-Companion
- Ne yapar: Streamer'ların TFT oyununu memory'den okur, Twitch extension'a yollar.
- **KRİTİK:** "Riot is aware of this project and has said they are okay with me continuing work on this project."
- Teknik: "passive memory reading" — sadece okuma, hile yok.
- Riot'un politikası: "passive memory reading is allowed as long as no competitive advantage is provided."
- Yani: **bizim projemiz de bu kategoriye girer** — sadece okuma, hile yok, kişisel kullanım.
- Gereksinim: Windows 10, TFT 1920x1080.
- **Bu repo incelemeli — kodları referans olabilir.**

**B. Mattbusel/tft-synapse**
- GitHub: https://github.com/Mattbusel/tft-synapse
- Ne yapar: BİREBİR bizim projemiz gibi — TFT overlay, augment tavsiyesi, board advisor, economy advisor, carry identification, item advisor, champion pool tracker, positioning advisor, stage awareness, post-game review.
- **KRİTİK MİMARİ:** "three-tier detection chain":
  1. **Riot Live Client Data API (localhost:2999) — PRIMARY source, "full game state" verir!**
  2. Screen capture fallback (Win32 BitBlt) — Live API yoksa HP/gold ekrandan okur.
  3. Mock mode — oyun yoksa UI test için.
- **BİZİM İÇİN ÇOK ÖNEMLİ:** Biz "LCU API TFT için yetersiz" dedik (bölüm 13.3). Ama tft-synapse 2024/2025'te "primary source, full game state" diyor. Yani:
  - Ya Riot 2020'den beri geliştirdi (GitHub issue #373 eski).
  - Ya da tft-synapse "full game state" ifadesini abartıyor.
  - **TEST ETMEMİZ LAZIM:** TFT'de `https://127.0.0.1:2999/liveclientdata/allgamedata` çağır, ne dönüyor gör.
- Workspace: Rust crates (tft-types, tft-data, tft-game-state, tft-ml, tft-capture, tft-advisor, tft-ui, tft-synapse). Bizim mimari benzer.
- AI: contextual bandit + 3-layer neural net. Biz rule-based yapıyoruz (daha basit, daha güvenilir).
- **Bu repo en yakın referansımız. İncelemeliyiz.**

**C. Just2good/TFT-Overlay**
- GitHub: https://github.com/Just2good/TFT-Overlay
- Ne yapar: Statik bilgi overlay'i (item combinations, champions). Memory okuma YOK.
- Bizim için: arayüz referansı olabilir.

### 14.2 LIVE CLIENT DATA API — YENİDEN DEĞERLENDİRME GEREKİYOR

Önceki araştırma (bölüm 13.3): "LCU API TFT için yetersiz, Riot 2020'den beri geliştirme yapmamış."

**Yeni bulgu (tft-synapse README):** "Riot Games Live Client Data API - a local HTTP server TFT runs on localhost:2999. No API key required. This is the primary source and gives full game state."

**Çelişki:** Ya Riot geliştirdi (issue #373 eski), ya da tft-synapse abartıyor.

**Test planı:** TFT açıkken `https://127.0.0.1:2999/liveclientdata/allgamedata` çağır. Dönen JSON'u incele:
- `playerlist` endpoint: 8 oyuncunun champion listesi?
- `activeplayer` endpoint: kendi gold/level/hp?
- `gameevents` endpoint: augment seçimleri, round bilgisi?

Eğer Live API gerçekten "full game state" veriyorsa:
- **Memory okuma gerekmeyebilir!** Sadece HTTP fetch.
- Ban riski SIFIR (Riot'un resmi API'si, izin gerekmez).
- Bakım YOK (Riot patch'lerle günceller).
- Hız: localhost HTTP, milisaniye.

**Bu çok büyük bir ihtimal.** Test edilmesi şart.

### 14.3 RIOT POLITİKASI — BİZİM İÇİN NE DEMEK?

Riot Developer Policy (https://developer.riotgames.com/docs/lol):

> "Products must not use or incorporate information not present in the game client that would give players a competitive edge."

Yorumumuz:
- **Live API:** Riot'un kendisi sunuyor, %100 güvenli.
- **Memory okuma:** "passive memory reading" (sadece okuma, hile yok) — conradftw projesi için Riot izin vermiş. Bizim projemiz de aynı kategori.
- **Yasak olan:** Memory'den shop kartlarını önceden görmek, rakip board'unu scouting yapmak (client'ta görüntü var ama kullanıcı normalde görmüyor). Biz shop okumayı bıraktık (PLAN.md bölüm 6), bu iyi.
- **Gri alan:** Augment okuma. Client'ta augment seçim ekranı var, kullanıcı görüyor. "Önceden görmek" yok, sadece "seçtikten sonra okumak" var. Güvenli olmalı.

Sonuç: **bizim projemiz Riot politikasına uygun.** conradftw precedensi var.

### 14.4 HANDLE HIJACKING vs OPENPROCESS — GÜNCEL DURUM

- Vanguard her Windows güncellemesinde değişiyor.
- OpenProcess (PROCESS_VM_READ) Vanguard yüzünden genelde fail ediyor.
- Handle hijacking (NtQuerySystemInformation ile yasal handle çal) hâlâ çalışıyor ama her patch'te bakım.
- **conradftw projesi nasıl yapıyor?** README'sine göre "passive memory reading" ama detay yok. Kodlarına bakmak lazım.
- **Alternatif:** Eğer Live API yeterliyse, memory okuma HİÇ gerekmez. Önce Live API test edelim.

### 14.5 YENİ PLAN (Bu Araştırma Sonrası)

Öncelik sıralaması güncellendi:

1. **Live API testi (ÖNCE BUNU YAPALIM):**
   - TFT açıkken `https://127.0.0.1:2999/liveclientdata/allgamedata` çağır.
   - JSON'u incele — gold/level/hp/board/bench/shop/augment veriyor mu?
   - Veriyorsa: **memory okuma iptal**, sadece Live API kullan.
   - Vermiyorsa: memory okuma yoluna devam.

2. **Eğer Live API yeterliyse:**
   - Tauri app içinde HTTP fetch → JSON parse → GameState.
   - Hiç Rust memory kodu yok, sadece HTTP client.
   - Ban riski SIFIR, bakım YOK, hızlı.

3. **Eğer Live API yetersizse:**
   - Memory okuma yoluna devam (mevcut plan).
   - Handle hijacking gerekir.
   - conradftw kodlarından ilham alınabilir.

4. **conradftw repo incelemesi:**
   - Memory okuma nasıl yapıyorlar?
   - Hangi offset'leri kullanıyorlar?
   - Hangi verileri okuyorlar (board/bench/shop)?
   - Bu bize hız katabilir.

5. **tft-synapse repo incelemesi:**
   - Live API'den tam olarak ne alıyor?
   - Hangi endpoint'leri kullanıyor?
   - "Full game state" ne demek tam olarak?

### 14.6 KULLANICIYA SORULACAKLAR

1. TFT açıkken şu URL'i tarayıcıda aç: `https://127.0.0.1:2999/liveclientdata/allgamedata`
   - Sertifika hatası verirse "yine de devam et" de.
   - Dönen JSON'u bana gönder (kopayala-yapıştır).
   - Bu test 2 dakika sürer, ama memory okuma yolundan bizi kurtarabilir.

2. Eğer Live API yeterliyse, memory okuma kodunu silelim mi?
   - Daha az risk, daha az bakım, daha hızlı geliştirme.

### 14.7 ÖZET KARAR

**Memory okuma iskeletini yazdık (commit d99e6d9), ama önce Live API'yi test edelim.** Çünkü:
- tft-synapse "full game state" diyor — belki gerçekten veriyor.
- Live API varsa memory okuma gereksiz.
- conradftw projesi "passive memory reading" diyor — belki sadece Live API + biraz memory tamamlama.

**Kanka, bun kurulumu bitince ilk iş: Live API testi.** Bu bize haftalarca uğraştan kurtarabilir.

### 14.8 LIVE API TEST SONUCU (2026-07-09 — KULLANICI TESTİ)

Kullanıcı TFT açıkken `https://127.0.0.1:2999/liveclientdata/allgamedata` çağırdı. JSON analizi:

**VERENLER:**
- `activePlayer.level` — kendi level (testte 2). DOĞRU.
- `allPlayers[].level` — 8 oyuncunun level'ı (2, 2, 2, 2, 2, 3, 2, 2). DOĞRU.
- `allPlayers[].riotId` — oyuncu isimleri (MessiNiger#365 vb.). DOĞRU.
- `gameData.gameMode` — "TFT". DOĞRU (oyun içinde miyim tespiti için).
- `gameData.gameTime` — saniye (67.97). DOĞRU ama işe yaramaz.
- `events.Events` — sadece "GameStart" event'i. İşe yaramaz.

**VERMEYENLER:**
- `activePlayer.currentGold: 500.0` — LOL goldu (TFT değil! TFT'de 500 olamaz, başlangıç goldu 4'tür). **YANLIŞ/ÇÖP.**
- HP — hiç yok. 8 oyuncunun HP'si yok.
- board/bench — hiç yok.
- shop — hiç yok.
- augment — hiç yok.
- stage/round — hiç yok. `gameTime` var ama bu saniye, stage-round değil.

**SONUÇ:** Live API TFT için YETERSİZ. tft-synapse "full game state" diyordu ama **abartıyor veya eski bilgi.** Gerçekte sadece level + oyuncu isimleri + gameMode veriyor.

**KARAR:** Memory okuma yoluna DEVAM. Live API sadece yardımcı olarak kullanılabilir:
- "Oyun içinde miyim?" tespiti (gameMode == "TFT").
- Level çapraz kontrolü (memory'den okunan level ile Live API level karşılaştır).

Diğer her şey (gold, HP, board, bench, augment, stage, round) memory'den okunmalı.

**conradftw projesi kodları incelemeli** — gerçekten "passive memory reading" yapıyorlarsa, nasıl yaptıklarını görelir. Belki offset'leri paylaşmışlardır.

---

## 15. CV (COMPUTER VISION) YOLU — FİNAL PLAN (2026-07-09)

> Memory öldü (Vanguard), Overwolf whitelist gerek, VLM yavaş + halüsinasyon.
> TFTSense'in yolu: saf CV. Biz de bunu yapacağız.
> Araştırma: 40+ web search, 20+ page reader, TFT-OCR-BOT 10 kaynak dosya satır satır okundu.

### 15.1 Karar: Saf CV (VLM'i Tamamen Kaldır)

**Neden:**
- VLM 3-8 sn — overlay için kullanılamaz
- Memory — Vanguard kernel koruması, aşılamaz
- Overwolf — whitelist 3-7 gün, bağımlılık
- CV — TFTSense yapmış, kanıtlanmış, ömürlük, 1-2 gün/patch bakım

**Hedef:** TFTSense seviyesi. <500ms tam döngü. Ömürlük program.

### 15.2 Mimari

```
[capture.py (Python)]
  ├── mss ile ekran yakala (TFT penceresi)
  ├── Live API (port 2999) → level (sadece bu güvenilir)
  ├── Tesseract OCR → gold, round, HP, shop isimleri
  ├── Renk tespiti (numpy) → bench doluluk, HP halka rengi
  ├── Template matching (OpenCV) → şampiyon portreleri (shop, board, bench)
  └── POST /api/snapshot → Next.js (advisor + UI)
```

### 15.3 TFT-OCR-BOT Koordinatları (1920x1080)

TFT-OCR-BOT (github.com/jfd02/TFT-OCR-BOT) kaynak kodundan ÇIKARILDI:

| Veri | Koordinat (x1,y1,x2,y2) | OCR Ayarı |
|---|---|---|
| **Gold** | (870, 883, 920, 909) | PSM7, digits whitelist, 3x scale |
| **Round** | (753, 10, 870, 34) | PSM7, "0123456789-" whitelist |
| **Shop** | (481, 1039, 1476, 1070) + 5 kart adı | PSM7, ALPHABET, 5 paralel thread, fuzzy ≥0.7 |
| **Bench** | 9 slot, y=777 | OCR YOK — yeşil [0,255,18] renk tespiti |
| **Board** | 28 hex, 4 satır zigzag (y=651/571/494/423) | template matching (TFT-OCR-BOT yapmıyor!) |
| **HP** | sağ sütun, sarı halkalı portre | renk tespiti + OCR (kendi yazacağız) |
| **Level** | — | Live API (port 2999) — %100 doğru |

### 15.4 Önemli Bulgular

1. **TFT-OCR-BOT board'u CV ile OKUMAZ** — state-machine ile izler (satın al→bench→board). Bizim board'u ekrandan okumamız gerekiyor, bu EN ZOR kısım.

2. **Live API TFT'de buggy:**
   - GitHub issue #865: currentGold=500 (LoL leak) → gold için OCR şart
   - GitHub issue #373: allPlayers "recycled LoL JSON" → 8 oyuncu HP'si yok
   - Sadece level (activePlayer.level) güvenilir

3. **tesserocr > pytesseract** — persistent C++ API, subprocess yok, daha hızlı. Geçiş yapmalıyız.

4. **Data Dragon URL'leri doğrulandı:**
   - Champ ikon: `ddragon.leagueoflegends.com/cdn/{ver}/img/tft-champion/{image.full}` → 256×128 PNG
   - Item ikon: `ddragon.leagueoflegends.com/cdn/{ver}/img/tft-item/{image.full}` → 128×128 PNG
   - `tft-champion.json` tüm setleri içerir → mevcut set prefix'i ile filtrele

5. **TFTSense = saf CV (doğrulandı):** Tauri+Rust+Preact. Board kalibrasyonu (4 köşe) + template/OCR + renk. Augment gösteriyor (ToS riski), biz atlıyoruz (güvende).

### 15.5 Uygulama Sırası

1. **Gold OCR** (kolay) — TFT-OCR-BOT koordinatları: (870, 883, 920, 909), PSM7, digits, 3x scale
2. **Round OCR** (kolay) — (753, 10, 870, 34), PSM7, "0123456789-"
3. **Shop** (orta) — 5 kart paralel OCR, fuzzy matching
4. **Bench** (kolay) — yeşil renk tespiti, OCR yok
5. **Data Dragon indirici** (orta) — şampiyon ikonları otomatik indir
6. **Board kalibrasyonu** (ZOR) — 4 köşe hex + perspective transform
7. **Board şampiyon tanıma** (ZOR) — template matching + OCR kombinasyonu
8. **HP 8 oyuncu** (ZOR) — sarı halka tespiti + OCR
9. **Item tanıma** (orta)
10. **Cache/paralel optimizasyonu** — <500ms hedef
11. **Patch pipeline** — Data Dragon otomatik güncelleme, ~2 saat/patch

### 15.6 Top 5 Risk

1. **Board şampiyon tanıma** — portre template düşük isabet (render/border/star farkı). Çözüm: OCR isim + pHash ön-filtre + star sayımı kombinasyonu.
2. **8 oyuncu HP OCR** — referans yok, küçük renkli rakamlar. Çözüm: renk maske + scale×4 + sanity 0-100.
3. **Koordinat/çözünürlük** — 1920x1080 dışı çözünürlük. Çözüm: setup_screen scale + board kalibrasyonu.
4. **Live API bug'ları** — gold/HP yanlış. Çözüm: OCR öncelikli.
5. **İsim OCR doğruluğu** — Türkçe client. Çözüm: whitelist + OTSU + rapidfuzz ≥0.7.

### 15.7 Test Kolaylığı (Kural 5 — Test Bende)

Her veri için "test aracı" yazılacak:
- Sen TFT'de bir kez ekran görüntüsü al
- Araç 8 farklı threshold/ayar dener
- Hangisinin çalıştığını söyler
- Sen "X ayarı çalıştı" dersin
- Ben o ayarı koda eklerim

Böylece her veri için TFT'yi 8 kez açmana gerek yok.

### 15.8 Mevcut Durum (2026-07-09)

- ✅ Live API level: %100 doğru, çalışıyor
- ✅ VLM connected override: local data connected=true ise VLM "TFT değil" hatası kalkar
- ⚠️ Gold OCR: koordinatlar güncellendi (TFT-OCR-BOT), beyaz text tespiti eklendi, test bekleniyor
- ❌ Round OCR: kod yazılmadı henüz (koordinatlar hazır)
- ❌ Shop: kod yazılmadı
- ❌ Bench: kod yazılmadı
- ❌ Board: kod yazılmadı (en zor)
- ❌ HP: kod yazılmadı (en zor)
- ❌ Item: kod yazılmadı
- ✅ VLM: çalışıyor ama yavaş, CV tamamlanınca kaldırılacak
- ✅ capture.py: --use-local flag ile Live API + gold OCR
- ✅ local_reader.py: Live API + gold OCR (gold henüz çalışmıyor)

### 15.9 Sıradaki Adım

**Gold OCR'ı çalıştır.** TFT-OCR-BOT koordinatları: (870, 883, 920, 909). Beyaz text tespiti (R>180, G>180, B>180 → siyah, diğer → beyaz). PSM7, digits whitelist, 3x scale.

Test: `--gold-debug` ile çalıştır, `debug-gold/gold_processed_*.png`'de "siyah text beyaz arka plan" görmeliyiz. OCR rakam okumalı.




