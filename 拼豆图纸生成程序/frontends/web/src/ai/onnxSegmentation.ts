import * as ort from 'onnxruntime-web/wasm';
import type {
  SegmentationBackend,
  SegmentationInput,
  SegmentationOutput,
  SegmentationProvider,
} from './segmentationTypes';

/**
 * 基于 onnxruntime-web + U²-Net (u2netp) 的真实 AI 抠图。
 *
 * 模型：u2netp.onnx（4.4MB，Apache-2.0），本地 /models/ 下。
 * 预处理：resize 320×320 → [0,1] → ImageNet 归一化 → NCHW。
 * 推理：输出 d0 显著图 [1,1,320,320]，min-max 归一化后 resize 回原图。
 * 后处理：置信阈值 / 羽化 / 膨胀收缩 → RGBA + 自动裁剪框。
 *
 * 注意：必须静态 import onnxruntime-web/wasm——动态 import 该带特殊
 * exports 条件的包时 Vite 不会打包，导致运行时静默缺失、回退兜底。
 */

const INPUT_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session: any = null;
let initPromise: Promise<void> | null = null;

/** 双线性缩放，输出 [dstH][dstW][3] 的 RGB（0-255 float） */
function resizeToRGB(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array {
  const out = new Float32Array(dstW * dstH * 3);
  const sx = srcW / dstW;
  const sy = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const fy0 = y * sy;
    const y0 = Math.floor(fy0);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const fy = fy0 - y0;
    for (let x = 0; x < dstW; x++) {
      const fx0 = x * sx;
      const x0 = Math.floor(fx0);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const fx = fx0 - x0;
      const o = (y * dstW + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v00 = src[(y0 * srcW + x0) * 4 + c];
        const v01 = src[(y0 * srcW + x1) * 4 + c];
        const v10 = src[(y1 * srcW + x0) * 4 + c];
        const v11 = src[(y1 * srcW + x1) * 4 + c];
        const top = v00 + (v01 - v00) * fx;
        const bot = v10 + (v11 - v10) * fx;
        out[o + c] = top + (bot - top) * fy;
      }
    }
  }
  return out;
}

/** 双线性放大 mask，从 srcW×srcH 到 dstW×dstH，输出 [0,1] float */
function resizeMask(
  src: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array {
  const out = new Float32Array(dstW * dstH);
  const sx = srcW / dstW;
  const sy = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const fy0 = y * sy;
    const y0 = Math.floor(fy0);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const fy = fy0 - y0;
    for (let x = 0; x < dstW; x++) {
      const fx0 = x * sx;
      const x0 = Math.floor(fx0);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const fx = fx0 - x0;
      const v00 = src[y0 * srcW + x0];
      const v01 = src[y0 * srcW + x1];
      const v10 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];
      const top = v00 + (v01 - v00) * fx;
      const bot = v10 + (v11 - v10) * fx;
      out[y * dstW + x] = top + (bot - top) * fy;
    }
  }
  return out;
}

/** mask（[0,1]）→ 应用阈值/羽化/膨胀 → RGBA + autoCrop */
function applyMaskToOutput(
  data: Uint8ClampedArray,
  mask01: Float32Array,
  width: number,
  height: number,
  input: SegmentationInput
): SegmentationOutput {
  const threshold = input.params.foregroundConfidenceThreshold;
  const feather = Math.max(0, input.params.edgeFeatherRadius);
  const expand = Math.max(-32, Math.min(32, input.params.maskExpandOffset || 0));

  // 羽化：盒式模糊 mask（近似的边缘柔化）
  let feathered = mask01;
  if (feather > 0) {
    const r = Math.max(1, Math.ceil(feather));
    feathered = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, cnt = 0;
        for (let yy = -r; yy <= r; yy++) {
          for (let xx = -r; xx <= r; xx++) {
            const px = x + xx, py = y + yy;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            sum += mask01[py * width + px];
            cnt++;
          }
        }
        feathered[y * width + x] = cnt ? sum / cnt : 0;
      }
    }
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let fgCount = 0, hiConf = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      // 膨胀/收缩：偏移采样
      let conf = feathered[i];
      if (expand !== 0) {
        const px = Math.max(0, Math.min(width - 1, x - expand));
        conf = feathered[y * width + px];
      }
      const keep = conf >= threshold;
      const o = i * 4;
      if (keep) {
        rgba[o] = data[o];
        rgba[o + 1] = data[o + 1];
        rgba[o + 2] = data[o + 2];
        rgba[o + 3] = Math.round(255 * Math.max(0, Math.min(1, conf)));
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        fgCount++;
        if (conf > 0.85) hiConf++;
      }
    }
  }

  if (minX > maxX || minY > maxY) { minX = 0; minY = 0; maxX = width - 1; maxY = height - 1; }

  const mask8 = new Uint8ClampedArray(width * height);
  for (let i = 0; i < mask8.length; i++) mask8[i] = Math.round(255 * feathered[i]);

  return {
    rgba, width, height, mask: mask8,
    confidence: fgCount ? hiConf / fgCount : 0,
    autoCropped: { x: minX, y: minY, width: Math.max(1, maxX - minX + 1), height: Math.max(1, maxY - minY + 1) },
  };
}

export const onnxSegmentationProvider: SegmentationProvider = {
  backend: 'wasm' as SegmentationBackend,

  async initialize() {
    if (session) return;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      // 单线程 + 禁用 worker proxy：主线程直接跑 wasm，避免 worker 脚本在打包后路径失效
      // （onnxruntime 默认开 worker，worker 路径是常见失败点）。
      // wasm 文件由 Vite 打包到 assets，bundle 版通过 import.meta.url 自动定位。
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      session = await ort.InferenceSession.create('/models/u2netp.onnx', {
        executionProviders: ['wasm'],
      });
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
    return initPromise;
  },

  isReady() {
    return !!session;
  },

  async segment(input: SegmentationInput): Promise<SegmentationOutput> {
    if (!session) await this.initialize();
    if (!session) throw new Error('抠图模型未就绪');

    const { imageData, width, height } = input;

    // 1. resize 到 320×320 并转 RGB float
    const rgb = resizeToRGB(imageData, width, height, INPUT_SIZE, INPUT_SIZE);

    // 2. 归一化 + NCHW [1,3,320,320]
    const n = INPUT_SIZE * INPUT_SIZE;
    const tensor = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const v = rgb[i * 3 + c] / 255.0;
        tensor[c * n + i] = (v - MEAN[c]) / STD[c];
      }
    }

    // 3. 推理
    const feeds = {
      [session.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    };
    const results = await session.run(feeds);
    const d0 = results[session.outputNames[0]]; // [1,1,320,320]
    const mask320 = d0.data as Float32Array;

    // 4. min-max 归一化
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < mask320.length; i++) {
      if (mask320[i] < mn) mn = mask320[i];
      if (mask320[i] > mx) mx = mask320[i];
    }
    const range = mx - mn || 1;
    for (let i = 0; i < mask320.length; i++) mask320[i] = (mask320[i] - mn) / range;

    // 5. resize 回原图
    const mask01 = resizeMask(mask320, INPUT_SIZE, INPUT_SIZE, width, height);

    // 6. 后处理 → RGBA
    return applyMaskToOutput(imageData, mask01, width, height, input);
  },
};
