/**
 * Perler Engine Simulator — Full CIELAB color matching pipeline.
 *
 * Now uses the same color science as the C++ engine:
 *   sRGB → Linear RGB (gamma correction) → CIE XYZ D65 → CIELAB → CIE76 Delta-E
 *
 * This produces dramatically better color matching than simple RGB distance.
 */

export interface BeadColor {
  name: string;
  code: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  lab: { l: number; a: number; b: number }; // Precomputed CIELAB
}

export interface Palette {
  brand: string;
  version: string;
  colors: BeadColor[];
}

export interface QuantizeResult {
  gridWidth: number;
  gridHeight: number;
  indices: Int32Array;
  colorCounts: Int32Array;
  paletteBrand: string;
  paletteHex: string[];
  paletteNames: string[];
  paletteCodes: string[];
}

// ============================================================================
// Color Science: sRGB → Linear → XYZ → CIELAB (matching C++ engine)
// ============================================================================

/** sRGB component (0-255) → linear (0-1) using IEC 61966-2-1:1999 */
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Linear (0-1) → sRGB component (0-255) */
function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, c * 255)));
}

/** sRGB RGB → Linear RGB */
function rgbToLinearRgb(rgb: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  return { r: srgbToLinear(rgb.r), g: srgbToLinear(rgb.g), b: srgbToLinear(rgb.b) };
}

// sRGB → XYZ D65 matrix (IEC 61966-2-1:1999)
const XYZ_MATRIX = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];

/** Linear RGB → CIE XYZ D65 */
function linearRgbToXyz(lr: { r: number; g: number; b: number }): { x: number; y: number; z: number } {
  return {
    x: XYZ_MATRIX[0][0] * lr.r + XYZ_MATRIX[0][1] * lr.g + XYZ_MATRIX[0][2] * lr.b,
    y: XYZ_MATRIX[1][0] * lr.r + XYZ_MATRIX[1][1] * lr.g + XYZ_MATRIX[1][2] * lr.b,
    z: XYZ_MATRIX[2][0] * lr.r + XYZ_MATRIX[2][1] * lr.g + XYZ_MATRIX[2][2] * lr.b,
  };
}

// D65 reference white (normalized to Y=1.0)
const XN = 0.95047, YN = 1.00000, ZN = 1.08883;
const DELTA = 6 / 29, DELTA2 = DELTA * DELTA, DELTA3 = DELTA2 * DELTA;
const INV_3DELTA2 = 1 / (3 * DELTA2);

function labF(t: number): number {
  return t > DELTA3 ? Math.cbrt(t) : INV_3DELTA2 * t + 4 / 29;
}

/** CIE XYZ D65 → CIELAB */
function xyzToLab(xyz: { x: number; y: number; z: number }): { l: number; a: number; b: number } {
  const fx = labF(xyz.x / XN);
  const fy = labF(xyz.y / YN);
  const fz = labF(xyz.z / ZN);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** sRGB RGB → CIELAB (full chain) */
function rgbToLab(rgb: { r: number; g: number; b: number }): { l: number; a: number; b: number } {
  return xyzToLab(linearRgbToXyz(rgbToLinearRgb(rgb)));
}

/** CIE76 Delta-E: Euclidean distance in CIELAB space */
function cie76(a: { l: number; a: number; b: number }, b: { l: number; a: number; b: number }): number {
  const dl = a.l - b.l, da = a.a - b.a, db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

// ============================================================================
// Palette
// ============================================================================

export function loadPaletteFromJSON(jsonObj: any): Palette {
  const colors: BeadColor[] = (jsonObj.colors || []).map((c: any) => {
    const r = parseInt(c.hex.slice(1, 3), 16);
    const g = parseInt(c.hex.slice(3, 5), 16);
    const b = parseInt(c.hex.slice(5, 7), 16);
    const rgb = { r, g, b };
    return {
      name: c.name || '', code: c.code || '', hex: c.hex || '#000000',
      r, g, b,
      lab: rgbToLab(rgb), // Precompute CIELAB
    };
  });
  return { brand: jsonObj.brand || 'Unknown', version: jsonObj.version || '1.0', colors };
}

// ============================================================================
// Nearest color via CIELAB ΔE (CIE76) — Euclidean distance in Lab space.
// 规格要求「与色卡全部颜色算欧氏距离，匹配距离最小的官方色」——Lab 空间的
// 欧氏距离才是感知上正确的「欧氏距离」。原始 RGB 欧氏距离会把人眼认为相近的
// 颜色（尤其肤色、低饱和色）匹配到错误的官方色号。
// ============================================================================

function findNearestColor(rgb: { r: number; g: number; b: number }, palette: BeadColor[]): number {
  const lab = rgbToLab(rgb);
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i].lab;
    const dl = lab.l - p.l, da = lab.a - p.a, db = lab.b - p.b;
    const d = dl * dl + da * da + db * db;  // squared CIE76 ΔE
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

// ============================================================================
// Pixelation: box-sampling downscale
// ============================================================================

export interface CellSample {
  r: number;
  g: number;
  b: number;
  coverage: number;
}

function pixelateBoxSample(
  imageData: Uint8ClampedArray, imgW: number, imgH: number,
  gridW: number, gridH: number
): CellSample[] {
  const cells: CellSample[] = [];
  const cellW = imgW / gridW, cellH = imgH / gridH;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = Math.floor(gx * cellW), y0 = Math.floor(gy * cellH);
      const x1 = Math.floor((gx + 1) * cellW), y1 = Math.floor((gy + 1) * cellH);
      let rSum = 0, gSum = 0, bSum = 0, opaque = 0, total = 0;
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * imgW + px) * 4;
          total++;
          if (imageData[idx + 3] < 16) continue;
          rSum += imageData[idx]; gSum += imageData[idx + 1]; bSum += imageData[idx + 2];
          opaque++;
        }
      }
      cells.push({
        r: opaque > 0 ? rSum / opaque : 0,
        g: opaque > 0 ? gSum / opaque : 0,
        b: opaque > 0 ? bSum / opaque : 0,
        coverage: total > 0 ? opaque / total : 0,
      });
    }
  }
  return cells;
}

// ============================================================================
// Dithering
// ============================================================================

function floydSteinbergDither(
  cells: CellSample[], gridW: number, gridH: number,
  palette: BeadColor[]
): Int32Array {
  const buf = cells.map(c => ({ r: c.r, g: c.g, b: c.b, empty: c.coverage < 0.35 }));
  const indices = new Int32Array(buf.length);

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x;
      const p = buf[idx];
      if (p.empty) { indices[idx] = -1; continue; }
      const clamped = {
        r: Math.max(0, Math.min(255, Math.round(p.r))),
        g: Math.max(0, Math.min(255, Math.round(p.g))),
        b: Math.max(0, Math.min(255, Math.round(p.b))),
      };
      const ci = findNearestColor(clamped, palette);
      indices[idx] = ci;
      const chosen = palette[ci];
      const er = p.r - chosen.r, eg = p.g - chosen.g, eb = p.b - chosen.b;

      if (x + 1 < gridW && !buf[(x + 1) + y * gridW].empty) { const n = (x + 1) + y * gridW; buf[n].r += er * 7 / 16; buf[n].g += eg * 7 / 16; buf[n].b += eb * 7 / 16; }
      if (y + 1 < gridH) {
        if (x - 1 >= 0 && !buf[(x - 1) + (y + 1) * gridW].empty) { const n = (x - 1) + (y + 1) * gridW; buf[n].r += er * 3 / 16; buf[n].g += eg * 3 / 16; buf[n].b += eb * 3 / 16; }
        if (!buf[x + (y + 1) * gridW].empty) { const n = x + (y + 1) * gridW; buf[n].r += er * 5 / 16; buf[n].g += eg * 5 / 16; buf[n].b += eb * 5 / 16; }
        if (x + 1 < gridW && !buf[(x + 1) + (y + 1) * gridW].empty) { const n = (x + 1) + (y + 1) * gridW; buf[n].r += er * 1 / 16; buf[n].g += eg * 1 / 16; buf[n].b += eb * 1 / 16; }
      }
    }
  }
  return indices;
}

// ============================================================================
// Main quantize function
// ============================================================================

export function quantize(
  imageData: Uint8ClampedArray, imgW: number, imgH: number,
  gridW: number, gridH: number,
  palette: Palette, ditherMode: number
): QuantizeResult {
  const cells = pixelateBoxSample(imageData, imgW, imgH, gridW, gridH);
  let indices: Int32Array;

  switch (ditherMode) {
    case 1:
      indices = floydSteinbergDither(cells, gridW, gridH, palette.colors);
      break;
    default: {
      indices = new Int32Array(cells.length);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.coverage < 0.35) { indices[i] = -1; continue; }
        const cr = Math.max(0, Math.min(255, Math.round(c.r)));
        const cg = Math.max(0, Math.min(255, Math.round(c.g)));
        const cb = Math.max(0, Math.min(255, Math.round(c.b)));
        indices[i] = findNearestColor({ r: cr, g: cg, b: cb }, palette.colors);
      }
    }
  }

  const colorCounts = new Int32Array(palette.colors.length);
  for (let i = 0; i < indices.length; i++) {
    const ci = indices[i];
    if (ci >= 0 && ci < colorCounts.length) colorCounts[ci]++;
  }

  return {
    gridWidth: gridW, gridHeight: gridH, indices, colorCounts,
    paletteBrand: palette.brand,
    paletteHex: palette.colors.map(c => c.hex),
    paletteNames: palette.colors.map(c => c.name),
    paletteCodes: palette.colors.map(c => c.code),
  };
}

// ============================================================================
// Image loading
// ============================================================================

export function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; data: Uint8ClampedArray; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      URL.revokeObjectURL(img.src);
      resolve({ img, data: imageData.data, w: img.width, h: img.height });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function removeBackground(
  srcData: Uint8ClampedArray, w: number, h: number, threshold = 28
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(srcData);
  const visited = new Uint8Array(w * h);

  const border: number[] = [];
  for (let x = 0; x < w; x++) { border.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { border.push(y * w, y * w + (w - 1)); }

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (const i of border) {
    const o = i * 4;
    rSum += srcData[o]; gSum += srcData[o + 1]; bSum += srcData[o + 2]; count++;
  }
  if (count === 0) return out;
  const refR = rSum / count, refG = gSum / count, refB = bSum / count;

  const dist = (i: number): number => {
    const o = i * 4;
    return Math.hypot(srcData[o] - refR, srcData[o + 1] - refG, srcData[o + 2] - refB);
  };

  const queue: number[] = [];
  const tryRemove = (i: number) => {
    if (i < 0 || i >= w * h || visited[i]) return;
    visited[i] = 1;
    if (dist(i) <= threshold) {
      out[i * 4 + 3] = 0;
      queue.push(i);
    }
  };

  for (const i of border) tryRemove(i);
  while (queue.length) {
    const i = queue.shift()!;
    const x = i % w;
    if (x > 0) tryRemove(i - 1);
    if (x < w - 1) tryRemove(i + 1);
    if (i >= w) tryRemove(i - w);
    if (i < w * h - w) tryRemove(i + w);
  }

  return out;
}

export function mergeSimilarColors(
  result: QuantizeResult,
  palette: Palette,
  threshold = 6.0
): QuantizeResult {
  const used = Array.from(new Set(Array.from(result.indices).filter((i) => i >= 0)));
  if (used.length < 2) return result;

  used.sort((a, b) => result.colorCounts[b] - result.colorCounts[a]);
  const representatives: number[] = [];
  const colorToRepresentative = new Map<number, number>();

  for (const idx of used) {
    let found = -1;
    for (const rep of representatives) {
      const dl = palette.colors[idx].lab.l - palette.colors[rep].lab.l;
      const da = palette.colors[idx].lab.a - palette.colors[rep].lab.a;
      const db = palette.colors[idx].lab.b - palette.colors[rep].lab.b;
      const de = Math.sqrt(dl * dl + da * da + db * db);
      if (de < threshold) { found = rep; break; }
    }
    if (found >= 0) colorToRepresentative.set(idx, found);
    else { representatives.push(idx); colorToRepresentative.set(idx, idx); }
  }

  const indices = result.indices.map((idx) =>
    idx >= 0 ? colorToRepresentative.get(idx) ?? idx : -1
  );
  const colorCounts = new Int32Array(palette.colors.length);
  for (const idx of indices) {
    if (idx >= 0 && idx < colorCounts.length) colorCounts[idx]++;
  }

  return { ...result, indices: new Int32Array(indices), colorCounts };
}

// ============================================================================
// Preprocessing: brightness, contrast, blur, crop
// ============================================================================

export function preprocess(
  srcData: Uint8ClampedArray, w: number, h: number,
  brightness: number, contrast: number, blurSigma: number
): Uint8ClampedArray {
  let data = new Uint8ClampedArray(srcData);

  // Brightness & contrast
  if (brightness !== 0 || contrast !== 1) {
    const newData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const val = (data[i + c] - 128) * contrast + 128 + brightness * 128;
        newData[i + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
      newData[i + 3] = data[i + 3];
    }
    data = newData;
  }

  // Gaussian blur (separable)
  if (blurSigma > 0) {
    const ks = Math.ceil(blurSigma * 3) * 2 + 1;
    const kernel = new Float32Array(ks);
    let sum = 0;
    for (let i = 0; i < ks; i++) {
      const x = i - Math.floor(ks / 2);
      kernel[i] = Math.exp(-(x * x) / (2 * blurSigma * blurSigma));
      sum += kernel[i];
    }
    for (let i = 0; i < ks; i++) kernel[i] /= sum;
    const halfK = Math.floor(ks / 2);

    // Horizontal pass
    const hPass = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          let total = 0;
          for (let k = -halfK; k <= halfK; k++) {
            const sx = Math.max(0, Math.min(w - 1, x + k));
            total += data[(y * w + sx) * 4 + c] * kernel[k + halfK];
          }
          hPass[(y * w + x) * 4 + c] = Math.round(total);
        }
        hPass[(y * w + x) * 4 + 3] = data[(y * w + x) * 4 + 3];
      }
    }
    // Vertical pass
    const vPass = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          let total = 0;
          for (let k = -halfK; k <= halfK; k++) {
            const sy = Math.max(0, Math.min(h - 1, y + k));
            total += hPass[(sy * w + x) * 4 + c] * kernel[k + halfK];
          }
          vPass[(y * w + x) * 4 + c] = Math.round(total);
        }
        vPass[(y * w + x) * 4 + 3] = hPass[(y * w + x) * 4 + 3];
      }
    }
    data = vPass;
  }
  return data;
}

export function cropImage(
  srcData: Uint8ClampedArray, srcW: number, srcH: number,
  cx: number, cy: number, cw: number, ch: number
): { data: Uint8ClampedArray; w: number; h: number } {
  const x = Math.max(0, Math.min(srcW - 1, cx));
  const y = Math.max(0, Math.min(srcH - 1, cy));
  const w2 = Math.max(1, Math.min(srcW - x, cw));
  const h2 = Math.max(1, Math.min(srcH - y, ch));
  const newData = new Uint8ClampedArray(w2 * h2 * 4);
  for (let row = 0; row < h2; row++) {
    const srcOff = ((y + row) * srcW + x) * 4;
    newData.set(srcData.subarray(srcOff, srcOff + w2 * 4), row * w2 * 4);
  }
  return { data: newData, w: w2, h: h2 };
}

// ============================================================================
// Edge enhancement (unsharp mask) — makes details pop before quantization
// ============================================================================

export function enhanceEdges(
  srcData: Uint8ClampedArray, w: number, h: number, strength: number
): Uint8ClampedArray {
  if (strength <= 0) return new Uint8ClampedArray(srcData);
  const result = new Uint8ClampedArray(srcData);
  const amount = Math.min(2.5, Math.max(0.2, strength));

  // Unsharp mask with a 3×3 Gaussian blur (weights 1-2-1 per axis, σ≈0.85).
  // Gaussian gives a cleaner low-pass than box blur, so facial contours survive
  // downsampling without the halos a box kernel introduces.
  // result = src + amount * (src - blur)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = srcData[((y - 1) * w + (x - 1)) * 4 + c] + 2 * srcData[((y - 1) * w + x) * 4 + c] + srcData[((y - 1) * w + (x + 1)) * 4 + c];
        const mid = 2 * srcData[(y * w + (x - 1)) * 4 + c] + 4 * srcData[idx + c] + 2 * srcData[(y * w + (x + 1)) * 4 + c];
        const bot = srcData[((y + 1) * w + (x - 1)) * 4 + c] + 2 * srcData[((y + 1) * w + x) * 4 + c] + srcData[((y + 1) * w + (x + 1)) * 4 + c];
        const blur = (top + mid + bot) / 16;
        const sharp = srcData[idx + c] + amount * (srcData[idx + c] - blur);
        result[idx + c] = Math.max(0, Math.min(255, Math.round(sharp)));
      }
    }
  }
  return result;
}

// ============================================================================
// Auto contrast optimization — stretch histogram for best bead matching
// ============================================================================

export function autoContrast(
  srcData: Uint8ClampedArray, w: number, h: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(srcData);
  // Find 1st and 99th percentile luminance
  const lums: number[] = [];
  for (let i = 0; i < srcData.length; i += 4) {
    lums.push(0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2]);
  }
  lums.sort((a, b) => a - b);
  const lo = lums[Math.floor(lums.length * 0.02)];
  const hi = lums[Math.floor(lums.length * 0.98)];
  if (hi - lo < 30) return result; // Already low contrast, skip

  // Stretch: map [lo, hi] → [0, 255]
  const scale = 255 / (hi - lo);
  for (let i = 0; i < srcData.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      result[i + c] = Math.max(0, Math.min(255, Math.round((srcData[i + c] - lo) * scale)));
    }
  }
  return result;
}

// ============================================================================
// Smart grid size suggestion
// ============================================================================

export function suggestGridSize(imgW: number, imgH: number): { w: number; h: number; boards: string } {
  const ratio = imgW / imgH;
  const totalPixels = imgW * imgH;

  // Single board presets (sorted by size)
  const singles = [
    { w: 29, h: 29, label: '1×1 小方板' },
    { w: 50, h: 50, label: '1×1 中方板' },
    { w: 58, h: 58, label: '1×1 大方板' },
    { w: 58, h: 87, label: '1×1.5 竖板' },
    { w: 87, h: 58, label: '1.5×1 横板' },
  ];

  // Multi-board layouts (larger projects)
  const multis = [
    { w: 58, h: 58, label: '1×1' },
    { w: 87, h: 58, label: '1.5×1' },
    { w: 58, h: 87, label: '1×1.5' },
    { w: 116, h: 58, label: '2×1' },
    { w: 58, h: 116, label: '1×2' },
    { w: 116, h: 87, label: '2×1.5' },
    { w: 116, h: 116, label: '2×2' },
    { w: 174, h: 116, label: '3×2' },
    { w: 116, h: 174, label: '2×3' },
    { w: 174, h: 174, label: '3×3' },
  ];

  // Pick based on image size
  if (totalPixels < 800 * 600) {
    // Small image: single board
    let best = singles[1]; // default 50×50
    let bestDiff = Infinity;
    for (const p of singles) {
      const diff = Math.abs(ratio - p.w / p.h);
      if (diff < bestDiff) { bestDiff = diff; best = p; }
    }
    return { w: best.w, h: best.h, boards: best.label };
  }

  // Larger image: suggest multi-board
  const targetCells = Math.min(200 * 200, Math.max(50 * 50, Math.round(totalPixels / 500)));
  let best = multis[0];
  let bestDiff = Infinity;
  for (const p of multis) {
    const cells = p.w * p.h;
    const diff = Math.abs(cells - targetCells) + Math.abs(ratio - p.w / p.h) * 500;
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return { w: best.w, h: best.h, boards: best.label + ' 板' };
}
