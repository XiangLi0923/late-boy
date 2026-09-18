// 阿莉的图 — 小程序首页
const { getPalette } = require('./paletteData');

// ============================================================================
// Simulator Engine (inline for mini program — same logic as web simulator)
// ============================================================================
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// CIELAB D65 color matching — same pipeline as web/desktop/C++ engines.
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

const XYZ_MATRIX = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];
const XN = 0.95047, YN = 1.00000, ZN = 1.08883;
const DELTA = 6 / 29, DELTA2 = DELTA * DELTA, DELTA3 = DELTA2 * DELTA;
const INV_3DELTA2 = 1 / (3 * DELTA2);

function labF(t) {
  return t > DELTA3 ? Math.cbrt(t) : INV_3DELTA2 * t + 4 / 29;
}

function rgbToLab(rgb) {
  const lr = srgbToLinear(rgb.r), lg = srgbToLinear(rgb.g), lb = srgbToLinear(rgb.b);
  const x = XYZ_MATRIX[0][0] * lr + XYZ_MATRIX[0][1] * lg + XYZ_MATRIX[0][2] * lb;
  const y = XYZ_MATRIX[1][0] * lr + XYZ_MATRIX[1][1] * lg + XYZ_MATRIX[1][2] * lb;
  const z = XYZ_MATRIX[2][0] * lr + XYZ_MATRIX[2][1] * lg + XYZ_MATRIX[2][2] * lb;
  const fx = labF(x / XN), fy = labF(y / YN), fz = labF(z / ZN);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function findNearest(rgb, paletteColors) {
  const lab = rgbToLab(rgb);
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < paletteColors.length; i++) {
    const p = paletteColors[i]._lab;
    const dl = lab.l - p.l, da = lab.a - p.a, db = lab.b - p.b;
    const d = Math.sqrt(dl * dl + da * da + db * db);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function bayerDither(cells, gridW, gridH, paletteColors) {
  const indices = new Array(gridW * gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x;
      if (cells[idx].coverage < 0.35) { indices[idx] = -1; continue; }
      const lab = rgbToLab({ r: cells[idx].r, g: cells[idx].g, b: cells[idx].b });
      let bestIdx = -1, secondIdx = -1, bestDe = 1e9, secondDe = 1e9;
      for (let i = 0; i < paletteColors.length; i++) {
        const p = paletteColors[i]._lab;
        const dl = lab.l - p.l, da = lab.a - p.a, db = lab.b - p.b;
        const de = Math.sqrt(dl * dl + da * da + db * db);
        if (de < bestDe) {
          secondDe = bestDe; secondIdx = bestIdx;
          bestDe = de; bestIdx = i;
        } else if (de < secondDe) {
          secondDe = de; secondIdx = i;
        }
      }
      const threshold = BAYER_8X8[y % 8][x % 8] / 64;
      let chosen = bestIdx;
      if (secondIdx >= 0 && secondDe - bestDe < 20) {
        const ratio = bestDe / Math.max(secondDe, 0.001);
        if (ratio > threshold) chosen = secondIdx;
      }
      indices[idx] = chosen;
    }
  }
  return indices;
}

function pixelateAndQuantize(imageData, imgW, imgH, gridW, gridH, paletteColors, ditherMode) {
  const total = gridW * gridH;
  const cellW = imgW / gridW, cellH = imgH / gridH;
  const cells = [];

  // Box sample
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = Math.floor(gx * cellW), y0 = Math.floor(gy * cellH);
      const x1 = Math.floor((gx + 1) * cellW), y1 = Math.floor((gy + 1) * cellH);
      let r = 0, g = 0, b = 0, opaque = 0, total = 0;
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * imgW + px) * 4;
          total++;
          if (imageData[idx + 3] < 16) continue;
          r += imageData[idx]; g += imageData[idx + 1]; b += imageData[idx + 2]; opaque++;
        }
      }
      cells.push({
        r: opaque > 0 ? r / opaque : 0,
        g: opaque > 0 ? g / opaque : 0,
        b: opaque > 0 ? b / opaque : 0,
        coverage: total > 0 ? opaque / total : 0,
      });
    }
  }

  // Quantize
  let indices = new Array(total);
  if (ditherMode === 1) {
    // Floyd-Steinberg
    const buf = cells.map(c => ({ r: c.r, g: c.g, b: c.b, empty: c.coverage < 0.35 }));
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const idx = y * gridW + x;
        if (buf[idx].empty) { indices[idx] = -1; continue; }
        const p = buf[idx];
        const cr = Math.max(0, Math.min(255, Math.round(p.r)));
        const cg = Math.max(0, Math.min(255, Math.round(p.g)));
        const cb = Math.max(0, Math.min(255, Math.round(p.b)));
        const ci = findNearest({ r: cr, g: cg, b: cb }, paletteColors);
        indices[idx] = ci;
        const pc = paletteColors[ci]._rgb;
        const er = p.r - pc.r, eg = p.g - pc.g, eb = p.b - pc.b;
        if (x + 1 < gridW && !buf[(x + 1) + y * gridW].empty) { const n = (x + 1) + y * gridW; buf[n].r += er * 7 / 16; buf[n].g += eg * 7 / 16; buf[n].b += eb * 7 / 16; }
        if (y + 1 < gridH) {
          if (x - 1 >= 0 && !buf[(x - 1) + (y + 1) * gridW].empty) { const n = (x - 1) + (y + 1) * gridW; buf[n].r += er * 3 / 16; buf[n].g += eg * 3 / 16; buf[n].b += eb * 3 / 16; }
          if (!buf[x + (y + 1) * gridW].empty) { const n = x + (y + 1) * gridW; buf[n].r += er * 5 / 16; buf[n].g += eg * 5 / 16; buf[n].b += eb * 5 / 16; }
          if (x + 1 < gridW && !buf[(x + 1) + (y + 1) * gridW].empty) { const n = (x + 1) + (y + 1) * gridW; buf[n].r += er * 1 / 16; buf[n].g += eg * 1 / 16; buf[n].b += eb * 1 / 16; }
        }
      }
    }
  } else if (ditherMode === 2) {
    indices = bayerDither(cells, gridW, gridH, paletteColors);
  } else {
    // No dither
    for (let i = 0; i < total; i++) {
      if (cells[i].coverage < 0.35) { indices[i] = -1; continue; }
      const cr = Math.max(0, Math.min(255, Math.round(cells[i].r)));
      const cg = Math.max(0, Math.min(255, Math.round(cells[i].g)));
      const cb = Math.max(0, Math.min(255, Math.round(cells[i].b)));
      indices[i] = findNearest({ r: cr, g: cg, b: cb }, paletteColors);
    }
  }

  // Color counts
  const counts = new Array(paletteColors.length).fill(0);
  for (const ci of indices) { if (ci >= 0 && ci < counts.length) counts[ci]++; }
  return { indices, counts };
}

function removeBackground(srcData, w, h, threshold = 28) {
  const out = new Uint8ClampedArray(srcData);
  const visited = new Uint8Array(w * h);
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, x + (h - 1) * w);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + (w - 1));

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (const i of border) {
    const o = i * 4;
    rSum += srcData[o]; gSum += srcData[o + 1]; bSum += srcData[o + 2]; count++;
  }
  if (count === 0) return out;
  const refR = rSum / count, refG = gSum / count, refB = bSum / count;

  const dist = (i) => {
    const o = i * 4;
    return Math.hypot(srcData[o] - refR, srcData[o + 1] - refG, srcData[o + 2] - refB);
  };

  const queue = [];
  const tryRemove = (i) => {
    if (i < 0 || i >= w * h || visited[i]) return;
    visited[i] = 1;
    if (dist(i) <= threshold) {
      out[i * 4 + 3] = 0;
      queue.push(i);
    }
  };

  for (const i of border) tryRemove(i);
  while (queue.length) {
    const i = queue.shift();
    const x = i % w;
    if (x > 0) tryRemove(i - 1);
    if (x < w - 1) tryRemove(i + 1);
    if (i >= w) tryRemove(i - w);
    if (i < w * h - w) tryRemove(i + w);
  }
  return out;
}

function mergeSimilarColors(indices, counts, paletteColors, threshold = 6) {
  const used = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) used.push(i);
  }
  if (used.length < 2) return { indices, counts };

  used.sort((a, b) => counts[b] - counts[a]);
  const reps = [];
  const replacement = new Map();
  for (const idx of used) {
    let found = -1;
    for (const rep of reps) {
      const a = paletteColors[idx]._lab;
      const b = paletteColors[rep]._lab;
      const dl = a.l - b.l, da = a.a - b.a, db = a.b - b.b;
      if (Math.sqrt(dl * dl + da * da + db * db) < threshold) {
        found = rep;
        break;
      }
    }
    if (found >= 0) replacement.set(idx, found);
    else { reps.push(idx); replacement.set(idx, idx); }
  }

  const newIndices = indices.map((idx) => replacement.get(idx) ?? idx);
  const newCounts = new Array(paletteColors.length).fill(0);
  for (const idx of newIndices) {
    if (idx >= 0 && idx < newCounts.length) newCounts[idx]++;
  }
  return { indices: newIndices, counts: newCounts };
}

Page({
  data: {
    imagePath: '',
    imageWidth: 0, imageHeight: 0,
    gridWidth: 50, gridHeight: 50,
    paletteList: ['mard_221', 'mard_all', 'universal_24', 'hama_midi', 'perler_standard'],
    paletteNames: ['Mard 221 色（推荐）', 'Mard 291 色（完整）', 'Universal 24', 'Hama Midi', 'Perler Standard'],
    paletteIndex: 0,
    ditherMode: 0,
    ditherModes: [
      { value: 0, label: '无抖动' },
      { value: 1, label: 'Floyd-Steinberg' },
      { value: 2, label: 'Bayer 8×8' },
    ],
    presets: [
      { label: '29×29', w: 29, h: 29 },
      { label: '50×50', w: 50, h: 50 },
      { label: '58×58', w: 58, h: 58 },
    ],
    beadGridReady: false,
    beadIndices: [],
    colorCounts: [],
    usedColors: 0,
    beadGridW: 0, beadGridH: 0,
    canvasWidth: 300, canvasHeight: 300,
    scale: 100,
    processing: false,
    errorMsg: '',
    paletteColors: [],
    paletteBrand: '',
    showLabels: true,  // toggle main/sub view
    mergeSimilarColors: false,
    removeBackground: false,
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    // Load default palette
    this.loadPalette(this.data.paletteList[0]);
  },

  loadPalette(id) {
    const palette = getPalette(id);
    if (!palette) return;
    const colors = palette.colors.map(c => ({
      ...c,
      _rgb: hexToRgb(c.hex),
      _lab: rgbToLab(hexToRgb(c.hex)),
    }));
    this.setData({ paletteColors: colors, paletteBrand: palette.brand });
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res.tempFilePaths[0];
        this.setData({ imagePath: path, errorMsg: '' });
        wx.getImageInfo({
          src: path,
          success: (info) => {
            this.setData({ imageWidth: info.width, imageHeight: info.height });
          },
        });
      },
    });
  },

  onGridWidth(e) { this.setData({ gridWidth: Math.max(1, Math.min(500, parseInt(e.detail.value) || 1)) }); },
  onGridHeight(e) { this.setData({ gridHeight: Math.max(1, Math.min(500, parseInt(e.detail.value) || 1)) }); },
  setPreset(e) {
    this.setData({
      gridWidth: e.currentTarget.dataset.w,
      gridHeight: e.currentTarget.dataset.h,
    });
  },

  onPaletteChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({ paletteIndex: idx });
    this.loadPalette(this.data.paletteList[idx]);
  },

  onDitherChange(e) {
    this.setData({ ditherMode: parseInt(e.detail.value) });
  },

  onMergeChange(e) {
    const value = e.detail.value || [];
    this.setData({
      mergeSimilarColors: value.includes('merge'),
      removeBackground: value.includes('background'),
    });
  },

  // Process image
  processImage() {
    if (!this.data.imagePath) return;
    this.setData({ processing: true, errorMsg: '' });

    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: this.data.imagePath,
      success: (res) => this._processImageData(res.data),
      fail: (err) => {
        this.setData({ processing: false, errorMsg: '读取图片失败: ' + err.errMsg });
      },
    });
  },

  _processImageData(arrayBuffer) {
    const { gridWidth, gridHeight, ditherMode } = this.data;
    let paletteId = this.data.paletteList[this.data.paletteIndex];
    const palette = getPalette(paletteId);
    const paletteColors = palette.colors.map(c => ({ ...c, _rgb: hexToRgb(c.hex), _lab: rgbToLab(hexToRgb(c.hex)) }));

    // Decode image using canvas
    const query = wx.createSelectorQuery();
    query.select('#hiddenCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) {
        // Fallback: decode via OffscreenCanvas
        this._decodeAndProcess(arrayBuffer, gridWidth, gridHeight, ditherMode, paletteColors, palette);
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const img = canvas.createImage();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        this._runEngine(imageData.data, img.width, img.height, gridWidth, gridHeight, ditherMode, paletteColors, palette);
      };
      img.onerror = () => {
        this.setData({ processing: false, errorMsg: '图片解码失败' });
      };
      img.src = this.data.imagePath;
    });
  },

  _decodeAndProcess(arrayBuffer, gridW, gridH, ditherMode, paletteColors, palette) {
    // Alternate path: use wx.getImageInfo + canvas
    const canvas = wx.createOffscreenCanvas({ type: '2d', width: 100, height: 100 });
    const ctx = canvas.getContext('2d');
    const img = canvas.createImage();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      this._runEngine(imageData.data, img.width, img.height, gridW, gridH, ditherMode, paletteColors, palette);
    };
    img.onerror = () => {
      this.setData({ processing: false, errorMsg: '图片解码失败' });
    };
    img.src = this.data.imagePath;
  },

  _runEngine(pixels, imgW, imgH, gridW, gridH, ditherMode, paletteColors, palette) {
    let workingPixels = pixels;
    if (this.data.removeBackground) {
      workingPixels = removeBackground(pixels, imgW, imgH);
    }
    let { indices, counts } = pixelateAndQuantize(workingPixels, imgW, imgH, gridW, gridH, paletteColors, ditherMode);
    if (this.data.mergeSimilarColors) {
      const merged = mergeSimilarColors(indices, counts, paletteColors);
      indices = merged.indices;
      counts = merged.counts;
    }
    const usedColors = counts.filter(c => c > 0).length;

    this.setData({
      processing: false,
      beadGridReady: true,
      beadIndices: indices,
      colorCounts: counts,
      usedColors,
      beadGridW: gridW,
      beadGridH: gridH,
      canvasWidth: Math.max(200, Math.min(350, gridW * 6)),
      canvasHeight: Math.max(200, Math.min(350, gridH * 6)),
      paletteColors,
      paletteBrand: palette.brand,
      errorMsg: '',
    });

    // Render
    setTimeout(() => this.renderBeadGrid(), 100);
  },

  // Render bead grid to Canvas 2D
  renderBeadGrid() {
    const query = wx.createSelectorQuery();
    query.select('#beadCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) return;

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const { beadGridW, beadGridH, beadIndices, paletteColors, scale, showLabels } = this.data;

      // Calculate bead size
      const baseSize = Math.max(4, Math.min(
        this.data.canvasWidth / beadGridW,
        this.data.canvasHeight / beadGridH
      ) * scale / 100);
      const beadSize = Math.floor(baseSize);
      const gridPxW = beadGridW * beadSize;
      const gridPxH = beadGridH * beadSize;

      canvas.width = gridPxW * dpr;
      canvas.height = gridPxH * dpr;
      ctx.scale(dpr, dpr);

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, gridPxW, gridPxH);

      // Draw beads
      const gap = Math.max(1, Math.floor(beadSize / 12));
      for (let y = 0; y < beadGridH; y++) {
        for (let x = 0; x < beadGridW; x++) {
          const idx = y * beadGridW + x;
          const ci = beadIndices[idx];
          if (ci < 0 || ci >= paletteColors.length) continue;

          const px = x * beadSize, py = y * beadSize;
          ctx.fillStyle = paletteColors[ci].hex;
          ctx.fillRect(px + gap, py + gap, beadSize - gap * 2, beadSize - gap * 2);

          // Label on bead
          if (showLabels && beadSize >= 12) {
            const txt = paletteColors[ci].code || `#${ci + 1}`;
            ctx.fillStyle = (paletteColors[ci]._rgb.r + paletteColors[ci]._rgb.g + paletteColors[ci]._rgb.b) > 400 ? '#000' : '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const maxWidth = Math.max(8, beadSize - 2);
            let fontSize = Math.min(beadSize * 0.42, Math.max(6, beadSize * 0.34));
            ctx.font = `${fontSize}px sans-serif`;
            while (fontSize > 5 && ctx.measureText(txt).width > maxWidth) {
              fontSize -= 0.25;
              ctx.font = `${fontSize}px sans-serif`;
            }
            if (ctx.measureText(txt).width <= maxWidth + 1) {
              ctx.fillText(txt, px + beadSize / 2, py + beadSize / 2);
            }
          }
        }
      }

      // Grid lines
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 0.5;
      for (let gy = 0; gy <= beadGridH; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, gy * beadSize);
        ctx.lineTo(gridPxW, gy * beadSize);
        ctx.stroke();
      }
      for (let gx = 0; gx <= beadGridW; gx++) {
        ctx.beginPath();
        ctx.moveTo(gx * beadSize, 0);
        ctx.lineTo(gx * beadSize, gridPxH);
        ctx.stroke();
      }
    });
  },

  toggleLabels() {
    this.setData({ showLabels: !this.data.showLabels });
    setTimeout(() => this.renderBeadGrid(), 50);
  },

  zoomIn() {
    this.setData({ scale: Math.min(400, this.data.scale + 25) });
    this.renderBeadGrid();
  },
  zoomOut() {
    this.setData({ scale: Math.max(25, this.data.scale - 25) });
    this.renderBeadGrid();
  },

  // Save canvas to album
  saveToAlbum() {
    const query = wx.createSelectorQuery();
    query.select('#beadCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) return;
      wx.canvasToTempFilePath({
        canvas: res[0].node,
        success: (r) => {
          wx.saveImageToPhotosAlbum({
            filePath: r.tempFilePath,
            success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
            fail: () => wx.showToast({ title: '保存失败', icon: 'error' }),
          });
        },
      });
    });
  },

  onShareAppMessage() {
    return {
      title: `阿莉的图 ${this.data.beadGridW}×${this.data.beadGridH} · ${this.data.paletteBrand}`,
      path: '/pages/index/index',
    };
  },

  onShareTimeline() {
    return {
      title: `阿莉的图 ${this.data.beadGridW}×${this.data.beadGridH} · ${this.data.paletteBrand}`,
    };
  },
});
