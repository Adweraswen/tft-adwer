/**
 * YOLO ONNX inference engine — bench slot + champion recognition.
 *
 * TFTSense'in "champion recognizer" yaklaşımı: ML model (CNN/YOLO) ile
 * her slot crop'unu sınıflandır. Boş slot = `bench-empty` sınıfı.
 *
 * Bu modül onnxruntime-node kullanır. Model dosyası: public/models/bench-yolo.onnx
 * Label dosyası: public/models/bench-yolo-labels.txt
 *
 * Model yoksa (eğitilmediyse), fallback olarak std-dev/edge kullanılır (bench-ocr.ts).
 *
 * ONNX model formatı (YOLOv8 export):
 *   Input: float32[1, 3, 640, 640] (RGB, normalized 0-1)
 *   Output: float32[1, num_classes, num_anchors] veya [1, num_anchors, num_classes+4]
 *   (YOLOv8 detection format — NMS gerekir)
 *
 * Bench için basit sınıflandırıcı kullanıyoruz (detection değil):
 *   Input: float32[1, 3, 64, 64] (slot crop, normalized)
 *   Output: float32[1, num_classes] (empty, champion-1, champion-2, ...)
 *   argmax → sınıf
 */

import * as ort from "onnxruntime-node";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const MODEL_PATH = join(process.cwd(), "public", "models", "bench-yolo.onnx");
const LABELS_PATH = join(process.cwd(), "public", "models", "bench-yolo-labels.txt");

let _session: ort.InferenceSession | null = null;
let _labels: string[] | null = null;

/** Model yüklü mü? (eğitilmiş ONNX model var mı) */
export function isYoloModelAvailable(): boolean {
  return existsSync(MODEL_PATH) && existsSync(LABELS_PATH);
}

/** ONNX session'ı lazy yükle (ilk çağrıda). */
async function getSession(): Promise<ort.InferenceSession | null> {
  if (!isYoloModelAvailable()) return null;
  if (!_session) {
    try {
      _session = await ort.InferenceSession.create(MODEL_PATH);
      _labels = readFileSync(LABELS_PATH, "utf8").split("\n").filter(Boolean);
      console.log(`[yolo] Model loaded: ${_labels.length} classes`);
    } catch (e) {
      console.error("[yolo] Model load failed:", e);
      return null;
    }
  }
  return _session;
}

export interface YoloSlotResult {
  slot: number;
  /** En yüksek olasılıklı sınıf adı (empty, champion-X-star-Y, vb). */
  className: string;
  /** Olasılık 0-1. */
  confidence: number;
  /** Sınıf ID. */
  classId: number;
  /** "empty" sınıfı mı? */
  isEmpty: boolean;
  /** Tüm sınıf olasılıkları (debug için). */
  allProbs: { name: string; prob: number }[];
}

export interface YoloBenchResult {
  ok: boolean;
  modelAvailable: boolean;
  slots: YoloSlotResult[];
  occupiedCount: number;
  occupiedSlots: number[];
  error: string | null;
}

/**
 * Slot crop'unu YOLO modeline ver, sınıflandır.
 * 1. Crop'u 64×64'e resize et (model input boyutu).
 * 2. RGB normalize (0-1).
 * 3. NCHW formatında tensor oluştur.
 * 4. Inference → softmax → argmax.
 */
async function classifySlot(
  session: ort.InferenceSession,
  labels: string[],
  pngBuf: Buffer,
  slotIndex: number,
  inputSize: number = 64
): Promise<YoloSlotResult> {
  // Resize to 64×64, raw RGB
  const raw = await sharp(pngBuf)
    .removeAlpha()
    .resize(inputSize, inputSize, { fit: "fill" })
    .raw()
    .toBuffer();

  // NCHW: [1, 3, 64, 64], normalize 0-1
  const tensorData = new Float32Array(3 * inputSize * inputSize);
  for (let c = 0; c < 3; c++) {  // R, G, B
    for (let i = 0; i < inputSize * inputSize; i++) {
      tensorData[c * inputSize * inputSize + i] = raw[i * 3 + c] / 255.0;
    }
  }

  const inputName = session.inputNames[0];
  const tensor = new ort.Tensor("float32", tensorData, [1, 3, inputSize, inputSize]);
  const result = await session.run({ [inputName]: tensor });
  const outputName = session.outputNames[0];
  const output = result[outputName].data as Float32Array;

  // Output: [1, num_classes] — softmax
  const numClasses = output.length;
  let maxIdx = 0;
  let maxVal = output[0];
  for (let i = 1; i < numClasses; i++) {
    if (output[i] > maxVal) {
      maxVal = output[i];
      maxIdx = i;
    }
  }

  // Softmax (normalize probabilities)
  let expSum = 0;
  const exps = new Float32Array(numClasses);
  for (let i = 0; i < numClasses; i++) {
    exps[i] = Math.exp(output[i] - maxVal);  // numerical stability
    expSum += exps[i];
  }
  const probs = Array.from(exps).map((e) => e / expSum);

  // Top 5 classes
  const allProbs = labels
    .map((name, idx) => ({ name, prob: probs[idx] ?? 0 }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  const className = labels[maxIdx] ?? `class-${maxIdx}`;
  return {
    slot: slotIndex,
    className,
    confidence: probs[maxIdx],
    classId: maxIdx,
    isEmpty: className.toLowerCase().includes("empty"),
    allProbs,
  };
}

/**
 * Bench slot'larını YOLO ile sınıflandır.
 * Her slot için crop → 64×64 resize → inference.
 */
export async function runYoloBench(
  pngBuf: Buffer,
  slotRegions: { left: number; top: number; width: number; height: number }[]
): Promise<YoloBenchResult> {
  const session = await getSession();
  if (!session || !_labels) {
    return {
      ok: false,
      modelAvailable: false,
      slots: [],
      occupiedCount: 0,
      occupiedSlots: [],
      error: "YOLO model not available. Run training/train-yolo.ipynb first.",
    };
  }

  const slots: YoloSlotResult[] = [];
  const occupiedSlots: number[] = [];

  for (let i = 0; i < slotRegions.length; i++) {
    const region = slotRegions[i];
    try {
      const slotPng = await sharp(pngBuf)
        .extract({ left: region.left, top: region.top, width: region.width, height: region.height })
        .png()
        .toBuffer();
      const result = await classifySlot(session, _labels, slotPng, i);
      slots.push(result);
      if (!result.isEmpty && result.confidence > 0.5) {
        occupiedSlots.push(i);
      }
    } catch (e) {
      slots.push({
        slot: i,
        className: "error",
        confidence: 0,
        classId: -1,
        isEmpty: true,
        allProbs: [],
      });
    }
  }

  return {
    ok: true,
    modelAvailable: true,
    slots,
    occupiedCount: occupiedSlots.length,
    occupiedSlots,
    error: null,
  };
}

export { _labels as yoloLabels };
