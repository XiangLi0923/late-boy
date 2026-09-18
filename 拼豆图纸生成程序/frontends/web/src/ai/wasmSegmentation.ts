import type {
  SegmentationBackend,
  SegmentationInput,
  SegmentationOutput,
  SegmentationProvider,
} from './segmentationTypes';

type WasmSegmenter = {
  initialize(): Promise<void>;
  segment(input: SegmentationInput): Promise<SegmentationOutput>;
};

let segmenter: WasmSegmenter | null = null;

function makeAlphaMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  input: SegmentationInput
): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height);
  const reference = borderReference(data, width, height);
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const tryPush = (i: number) => {
    if (i < 0 || i >= width * height || visited[i]) return;
    visited[i] = 1;
    const o = i * 4;
    const distance = Math.hypot(data[o] - reference.r, data[o + 1] - reference.g, data[o + 2] - reference.b);
    if (distance <= 32) {
      mask[i] = 0;
      queue.push(i);
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }
  while (queue.length) {
    const i = queue.shift()!;
    const x = i % width;
    if (x > 0) tryPush(i - 1);
    if (x < width - 1) tryPush(i + 1);
    if (i >= width) tryPush(i - width);
    if (i < width * height - width) tryPush(i + width);
  }

  for (let i = 0; i < mask.length; i++) if (!visited[i]) mask[i] = 255;
  return mask;
}

function borderReference(data: Uint8ClampedArray, width: number, height: number) {
  let r = 0, g = 0, b = 0, count = 0;
  for (let x = 0; x < width; x++) {
    const top = x * 4, bottom = ((height - 1) * width + x) * 4;
    r += data[top] + data[bottom]; g += data[top + 1] + data[bottom + 1]; b += data[top + 2] + data[bottom + 2];
    count += 2;
  }
  for (let y = 0; y < height; y++) {
    const left = y * width * 4, right = (y * width + width - 1) * 4;
    r += data[left] + data[right]; g += data[left + 1] + data[right + 1]; b += data[left + 2] + data[right + 2];
    count += 2;
  }
  return { r: r / count, g: g / count, b: b / count };
}

function applyMask(
  data: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  input: SegmentationInput
): SegmentationOutput {
  const threshold = input.params.foregroundConfidenceThreshold;
  const feather = Math.max(0, input.params.edgeFeatherRadius);
  const expand = Math.max(-32, Math.min(32, input.params.maskExpandOffset || 0));

  const adjusted = new Uint8ClampedArray(mask.length);
  const radius = Math.max(1, Math.ceil(feather) + Math.abs(expand) + 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let yy = -radius; yy <= radius; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          const px = x + xx + expand, py = y + yy;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          sum += mask[py * width + px];
          count++;
        }
      }
      adjusted[y * width + x] = count ? sum / count : 0;
    }
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let foregroundCount = 0, highConfidence = 0;

  for (let i = 0; i < width * height; i++) {
    const confidence = adjusted[i] / 255;
    const keep = confidence >= threshold;
    const o = i * 4;
    if (keep) {
      rgba[o] = data[o]; rgba[o + 1] = data[o + 1]; rgba[o + 2] = data[o + 2];
      rgba[o + 3] = Math.round(255 * Math.max(0, Math.min(1, confidence)));
      const x = i % width, y = Math.floor(i / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      foregroundCount++;
      if (confidence > 0.85) highConfidence++;
    }
  }

  if (minX > maxX || minY > maxY) {
    minX = 0; minY = 0; maxX = width - 1; maxY = height - 1;
  }

  return {
    rgba,
    width,
    height,
    mask: adjusted,
    confidence: foregroundCount ? highConfidence / foregroundCount : 0,
    autoCropped: {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX + 1),
      height: Math.max(1, maxY - minY + 1),
    },
  };
}

async function fallbackSegment(input: SegmentationInput): Promise<SegmentationOutput> {
  const mask = makeAlphaMask(input.imageData, input.width, input.height, input);
  return applyMask(input.imageData, mask, input.width, input.height, input);
}

async function loadSegmenter(): Promise<WasmSegmenter | null> {
  try {
    const modelUrl = '/models/segmentation_model.js';
    const module = await import(/* @vite-ignore */ `${modelUrl}`);
    const candidate = module?.default || module;
    if (!candidate || typeof candidate.segment !== 'function') return null;
    return candidate as WasmSegmenter;
  } catch {
    return null;
  }
}

export const wasmSegmentationProvider: SegmentationProvider = {
  backend: 'wasm' as SegmentationBackend,
  async initialize() {
    segmenter = await loadSegmenter();
  },
  isReady() {
    return !!segmenter;
  },
  async segment(input) {
    if (!segmenter) await this.initialize();
    return segmenter ? segmenter.segment(input) : fallbackSegment(input);
  },
};
