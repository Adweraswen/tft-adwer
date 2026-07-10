# TFT Adwer

TFT oynarken ekranı okur, duruma göre comp tavsiyesi verir. Saf CV + OCR (TFTSense'in yolu).

## Geliştirme

```bash
bun install
bun run dev
```

## OCR Pipeline

- **Gold/Round/Shop**: Tesseract OCR (PLAN 15.5)
- **Bench**: std-dev + edge density (gerçek TFT'de doğrulandı) — YOLO model eğitilince onunla değişecek
- **Board**: (yakında) YOLO + 4-köşe kalibrasyon (TFTSense yöntemi)

## YOLO Model Eğitimi (TFTSense yöntemi)

Bench + şampiyon tanıma için YOLO modeli. Eğitim bir kez yapılır, ONNX dosyası repo'ya konur.

### Adımlar

1. **Colab'da notebook aç**: `training/train-yolo.ipynb`'i Google Colab'a yükle (GPU runtime)
2. **Roboflow API key al**: Ücretsiz hesap → https://universe.roboflow.com → API key
3. **Notebook'u sırayla çalıştır**: Dataset indir + YOLOv8n eğit + ONNX export
4. **Çıktıları indir**: `best.onnx` + `labels.txt`
5. **Repo'ya koy**:
   - `best.onnx` → `public/models/bench-yolo.onnx`
   - `labels.txt` → `public/models/bench-yolo-labels.txt`
6. **git push**: Model hazır, Next.js otomatik kullanır

Model geldikten sonra bench otomatik YOLO kullanır (std-dev fallback kalkar).

## Mimari

```
src/lib/tft/ocr/
  engine.ts          — shared OCR helpers (tesseract, crop, processCrop)
  gold-ocr.ts        — Gold OCR (Tesseract)
  round-ocr.ts       — Round OCR (Tesseract)
  shop-ocr.ts        — Shop OCR (Tesseract + fuzzy match)
  bench-ocr.ts       — Bench (std-dev + edge, YOLO fallback)
  yolo-engine.ts     — YOLO ONNX inference (onnxruntime-node)
  item-ocr.ts        — Item (renk imzası, deneysel)
training/
  train-yolo.ipynb   — Colab notebook (YOLOv8n eğitim + ONNX export)
public/models/
  bench-test.onnx    — test model (geçici)
  bench-yolo.onnx    — eğitilmiş model (Colab'dan gelir)
  bench-yolo-labels.txt — sınıf etiketleri
```
