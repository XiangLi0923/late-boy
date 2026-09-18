(function () {
  'use strict';

  var PALETTE_IDS = ['mard_221', 'mard_all', 'universal_24', 'hama_midi', 'perler_standard'];
  var PALETTE_LABELS = {
    mard_221: 'Mard 221',
    mard_all: 'Mard 291',
    universal_24: 'Universal 24',
    hama_midi: 'Hama Midi',
    perler_standard: 'Perler Standard'
  };
  var GRID_PRESETS = [
    { label: '29×29', w: 29, h: 29 },
    { label: '50×50', w: 50, h: 50 },
    { label: '58×58', w: 58, h: 58 },
    { label: '100×100', w: 100, h: 100 }
  ];
  var BAYER_8X8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];
  var MAX_WORK_EDGE = 900;

  var state = {
    sourceCanvas: null,
    sourceWidth: 0,
    sourceHeight: 0,
    gridWidth: 50,
    gridHeight: 50,
    paletteId: 'mard_221',
    palette: null,
    ditherMode: 1,
    brightness: 0,
    contrast: 1,
    blurSigma: 0,
    edgeEnhance: 1.2,
    autoContrast: true,
    mergeSimilarColors: true,
    removeBackground: false,
    segmentationParams: {
      foregroundConfidenceThreshold: 0.65,
      edgeFeatherRadius: 2,
      maskExpandOffset: 0
    },
    result: null,
    scale: 1,
    showLabels: true,
    mirrored: false,
    busy: false
  };

  var dom = {};
  var previewObjectUrl = null;
  var toastTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexToRgb(hex) {
    var value = String(hex || '#000000').replace('#', '');
    return {
      r: parseInt(value.substring(0, 2), 16),
      g: parseInt(value.substring(2, 4), 16),
      b: parseInt(value.substring(4, 6), 16)
    };
  }

  function srgbToLinear(component) {
    var value = component / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  var XYZ_MATRIX = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041]
  ];
  var XN = 0.95047;
  var YN = 1.00000;
  var ZN = 1.08883;
  var DELTA = 6 / 29;
  var DELTA2 = DELTA * DELTA;
  var DELTA3 = DELTA2 * DELTA;
  var INV_3DELTA2 = 1 / (3 * DELTA2);

  function labF(t) {
    return t > DELTA3 ? Math.cbrt(t) : INV_3DELTA2 * t + 4 / 29;
  }

  function rgbToLab(rgb) {
    var lr = srgbToLinear(rgb.r);
    var lg = srgbToLinear(rgb.g);
    var lb = srgbToLinear(rgb.b);
    var x = XYZ_MATRIX[0][0] * lr + XYZ_MATRIX[0][1] * lg + XYZ_MATRIX[0][2] * lb;
    var y = XYZ_MATRIX[1][0] * lr + XYZ_MATRIX[1][1] * lg + XYZ_MATRIX[1][2] * lb;
    var z = XYZ_MATRIX[2][0] * lr + XYZ_MATRIX[2][1] * lg + XYZ_MATRIX[2][2] * lb;
    var fx = labF(x / XN);
    var fy = labF(y / YN);
    var fz = labF(z / ZN);
    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  function findNearest(rgb, colors) {
    var lab = rgbToLab(rgb);
    var best = 0;
    var bestDistance = Infinity;
    for (var i = 0; i < colors.length; i++) {
      var colorLab = colors[i]._lab;
      var dl = lab.l - colorLab.l;
      var da = lab.a - colorLab.a;
      var db = lab.b - colorLab.b;
      var distance = dl * dl + da * da + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  function preparePalette(raw) {
    var colors = [];
    for (var i = 0; i < raw.colors.length; i++) {
      var item = raw.colors[i];
      var rgb = hexToRgb(item.hex);
      colors.push({
        name: item.name || '',
        code: item.code || '',
        hex: item.hex || '#000000',
        _rgb: rgb,
        _lab: rgbToLab(rgb)
      });
    }
    return {
      brand: raw.brand || PALETTE_LABELS[state.paletteId] || 'Color Palette',
      colors: colors
    };
  }

  function setPalette(id) {
    var raw = window.PERLER_PALETTES && window.PERLER_PALETTES[id];
    if (!raw) {
      raw = window.PERLER_PALETTES.universal_24;
      id = 'universal_24';
    }
    state.paletteId = id;
    state.palette = preparePalette(raw);
    renderPaletteTabs();
    renderPalettePreview();
  }

  function renderPaletteTabs() {
    dom.paletteTabs.innerHTML = '';
    for (var i = 0; i < PALETTE_IDS.length; i++) {
      var id = PALETTE_IDS[i];
      var button = document.createElement('button');
      var raw = window.PERLER_PALETTES[id];
      button.type = 'button';
      button.className = 'palette-tab' + (id === state.paletteId ? ' active' : '');
      button.setAttribute('data-palette-id', id);
      button.textContent = id;
      if (raw && raw.colors) {
        var count = document.createElement('span');
        count.className = 'palette-tab-count';
        count.textContent = String(raw.colors.length);
        button.appendChild(count);
      }
      dom.paletteTabs.appendChild(button);
    }
    dom.paletteMeta.textContent = PALETTE_LABELS[state.paletteId] || state.paletteId;
  }

  function renderPalettePreview() {
    if (!state.palette) return;
    dom.paletteBrand.textContent = state.palette.brand + ' · ' + state.palette.colors.length + ' 色';
    dom.paletteSwatches.innerHTML = '';
    var limit = Math.min(12, state.palette.colors.length);
    for (var i = 0; i < limit; i++) {
      var swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.backgroundColor = state.palette.colors[i].hex;
      swatch.title = state.palette.colors[i].code + ' ' + state.palette.colors[i].name;
      dom.paletteSwatches.appendChild(swatch);
    }
    if (state.palette.colors.length > limit) {
      var more = document.createElement('span');
      more.className = 'swatch-more';
      more.textContent = '+' + (state.palette.colors.length - limit);
      dom.paletteSwatches.appendChild(more);
    }
  }

  function renderGridPresets() {
    dom.gridPresets.innerHTML = '';
    for (var i = 0; i < GRID_PRESETS.length; i++) {
      var preset = GRID_PRESETS[i];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip' + (
        state.gridWidth === preset.w && state.gridHeight === preset.h ? ' active' : ''
      );
      button.setAttribute('data-grid-w', String(preset.w));
      button.setAttribute('data-grid-h', String(preset.h));
      button.textContent = preset.label;
      dom.gridPresets.appendChild(button);
    }
  }

  function syncGridValues() {
    dom.gridWidth.value = String(state.gridWidth);
    dom.gridHeight.value = String(state.gridHeight);
    renderGridPresets();
  }

  function updateRangeLabels() {
    dom.brightnessValue.textContent = state.brightness.toFixed(2);
    dom.contrastValue.textContent = state.contrast.toFixed(2);
    dom.blurValue.textContent = state.blurSigma.toFixed(1);
    dom.edgeValue.textContent = state.edgeEnhance.toFixed(1);
    dom.confidenceValue.textContent = state.segmentationParams.foregroundConfidenceThreshold.toFixed(2);
    dom.featherValue.textContent = String(state.segmentationParams.edgeFeatherRadius);
    dom.maskOffsetValue.textContent = String(state.segmentationParams.maskExpandOffset);
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.remove('hidden');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      dom.toast.classList.add('hidden');
    }, 2600);
  }

  function setBusy(visible, message) {
    state.busy = visible;
    dom.progressOverlay.classList.toggle('hidden', !visible);
    dom.progressText.textContent = message || '正在生成图纸...';
    dom.processButton.disabled = visible || !state.sourceCanvas;
  }

  function setStatus(message) {
    dom.statusText.textContent = message;
  }

  function loadImageFile(file) {
    if (!file || !/^image\//.test(file.type)) {
      showToast('请选择图片文件');
      return;
    }

    var url = URL.createObjectURL(file);
    var image = new Image();
    image.onload = function () {
      var scale = Math.min(1, MAX_WORK_EDGE / Math.max(image.width, image.height));
      var width = Math.max(1, Math.round(image.width * scale));
      var height = Math.max(1, Math.round(image.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);

      state.sourceCanvas = canvas;
      state.sourceWidth = width;
      state.sourceHeight = height;
      state.result = null;
      dom.resultSection.classList.add('hidden');
      dom.settingsArea.classList.remove('hidden');
      dom.imagePreviewWrap.classList.remove('hidden');
      dom.imageMeta.textContent = width + ' × ' + height + ' px';
      dom.processButton.disabled = false;
      setStatus('图片已就绪');

      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = url;
      dom.imagePreview.src = url;
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      showToast('图片读取失败');
    };
    image.src = url;
  }

  function getPixels(canvas) {
    var context = canvas.getContext('2d');
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  function adjustBrightnessContrast(data, brightness, contrast) {
    if (brightness === 0 && contrast === 1) return data;
    var output = new Uint8ClampedArray(data.length);
    for (var i = 0; i < data.length; i += 4) {
      output[i] = clamp((data[i] - 128) * contrast + 128 + brightness * 128, 0, 255);
      output[i + 1] = clamp((data[i + 1] - 128) * contrast + 128 + brightness * 128, 0, 255);
      output[i + 2] = clamp((data[i + 2] - 128) * contrast + 128 + brightness * 128, 0, 255);
      output[i + 3] = data[i + 3];
    }
    return output;
  }

  function autoContrast(data) {
    var histogram = new Int32Array(256);
    var i;
    var total = 0;
    for (i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      var luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[luminance]++;
      total++;
    }
    if (total < 10) return data;

    var lowTarget = total * 0.02;
    var highTarget = total * 0.98;
    var cumulative = 0;
    var low = 0;
    var high = 255;
    for (i = 0; i < 256; i++) {
      cumulative += histogram[i];
      if (cumulative >= lowTarget) {
        low = i;
        break;
      }
    }
    cumulative = 0;
    for (i = 0; i < 256; i++) {
      cumulative += histogram[i];
      if (cumulative >= highTarget) {
        high = i;
        break;
      }
    }
    if (high - low < 30) return data;

    var scale = 255 / (high - low);
    var output = new Uint8ClampedArray(data.length);
    for (i = 0; i < data.length; i += 4) {
      output[i] = clamp((data[i] - low) * scale, 0, 255);
      output[i + 1] = clamp((data[i + 1] - low) * scale, 0, 255);
      output[i + 2] = clamp((data[i + 2] - low) * scale, 0, 255);
      output[i + 3] = data[i + 3];
    }
    return output;
  }

  function canvasBlur(data, width, height, sigma) {
    if (sigma <= 0) return data;
    var source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    var sourceContext = source.getContext('2d');
    var imageData = sourceContext.createImageData(width, height);
    imageData.data.set(data);
    sourceContext.putImageData(imageData, 0, 0);

    var target = document.createElement('canvas');
    target.width = width;
    target.height = height;
    var targetContext = target.getContext('2d');
    if (typeof targetContext.filter === 'string') {
      targetContext.filter = 'blur(' + sigma.toFixed(2) + 'px)';
      targetContext.drawImage(source, 0, 0);
      return targetContext.getImageData(0, 0, width, height).data;
    }
    return fallbackBoxBlur(data, width, height, Math.max(1, Math.round(sigma * 1.5)));
  }

  function fallbackBoxBlur(data, width, height, radius) {
    var input = new Uint8ClampedArray(data);
    var output = new Uint8ClampedArray(data.length);
    var x;
    var y;
    var channel;
    var sum;
    var count;
    var offset;
    var sourceOffset;

    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        offset = (y * width + x) * 4;
        for (channel = 0; channel < 4; channel++) {
          sum = 0;
          count = 0;
          for (var dx = -radius; dx <= radius; dx++) {
            var sx = clamp(x + dx, 0, width - 1);
            sourceOffset = (y * width + sx) * 4 + channel;
            sum += input[sourceOffset];
            count++;
          }
          output[offset + channel] = Math.round(sum / count);
        }
      }
    }

    var vertical = new Uint8ClampedArray(output.length);
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        offset = (y * width + x) * 4;
        for (channel = 0; channel < 4; channel++) {
          sum = 0;
          count = 0;
          for (var dy = -radius; dy <= radius; dy++) {
            var sy = clamp(y + dy, 0, height - 1);
            sourceOffset = (sy * width + x) * 4 + channel;
            sum += output[sourceOffset];
            count++;
          }
          vertical[offset + channel] = Math.round(sum / count);
        }
      }
    }
    return vertical;
  }

  function enhanceEdges(data, width, height, strength) {
    if (strength <= 0) return data;
    var output = new Uint8ClampedArray(data);
    var amount = clamp(strength, 0.2, 2.5);
    for (var y = 1; y < height - 1; y++) {
      for (var x = 1; x < width - 1; x++) {
        var index = (y * width + x) * 4;
        for (var channel = 0; channel < 3; channel++) {
          var top = data[((y - 1) * width + x - 1) * 4 + channel] +
            2 * data[((y - 1) * width + x) * 4 + channel] +
            data[((y - 1) * width + x + 1) * 4 + channel];
          var middle = 2 * data[(y * width + x - 1) * 4 + channel] +
            4 * data[index + channel] +
            2 * data[(y * width + x + 1) * 4 + channel];
          var bottom = data[((y + 1) * width + x - 1) * 4 + channel] +
            2 * data[((y + 1) * width + x) * 4 + channel] +
            data[((y + 1) * width + x + 1) * 4 + channel];
          var blurred = (top + middle + bottom) / 16;
          output[index + channel] = clamp(data[index + channel] + amount * (data[index + channel] - blurred), 0, 255);
        }
      }
    }
    return output;
  }

  function borderReference(data, width, height) {
    var r = 0;
    var g = 0;
    var b = 0;
    var count = 0;
    var x;
    var y;
    var offset;

    for (x = 0; x < width; x++) {
      offset = x * 4;
      if (data[offset + 3] >= 16) {
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count++;
      }
      offset = ((height - 1) * width + x) * 4;
      if (data[offset + 3] >= 16) {
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count++;
      }
    }
    for (y = 0; y < height; y++) {
      offset = (y * width) * 4;
      if (data[offset + 3] >= 16) {
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count++;
      }
      offset = (y * width + width - 1) * 4;
      if (data[offset + 3] >= 16) {
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count++;
      }
    }
    if (!count) return { r: 255, g: 255, b: 255 };
    return { r: r / count, g: g / count, b: b / count };
  }

  function makeForegroundMask(data, width, height, confidence) {
    var reference = borderReference(data, width, height);
    var visited = new Uint8Array(width * height);
    var queue = new Int32Array(width * height);
    var head = 0;
    var tail = 0;
    var threshold = clamp(58 - confidence * 40, 18, 56);

    function tryPush(index) {
      if (index < 0 || index >= width * height || visited[index]) return;
      visited[index] = 1;
      var offset = index * 4;
      if (data[offset + 3] < 16) {
        queue[tail++] = index;
        return;
      }
      var dr = data[offset] - reference.r;
      var dg = data[offset + 1] - reference.g;
      var db = data[offset + 2] - reference.b;
      if (Math.sqrt(dr * dr + dg * dg + db * db) <= threshold) queue[tail++] = index;
    }

    for (var x = 0; x < width; x++) {
      tryPush(x);
      tryPush((height - 1) * width + x);
    }
    for (var y = 0; y < height; y++) {
      tryPush(y * width);
      tryPush(y * width + width - 1);
    }
    while (head < tail) {
      var index = queue[head++];
      var px = index % width;
      if (px > 0) tryPush(index - 1);
      if (px < width - 1) tryPush(index + 1);
      if (index >= width) tryPush(index - width);
      if (index < width * height - width) tryPush(index + width);
    }

    var mask = new Uint8ClampedArray(width * height);
    for (var i = 0; i < mask.length; i++) {
      mask[i] = visited[i] ? 0 : 255;
    }
    return mask;
  }

  function changeMaskOffset(mask, width, height, offset) {
    if (!offset) return mask;
    var distance = Math.abs(offset);
    var current = new Uint8ClampedArray(mask);
    for (var step = 0; step < distance; step++) {
      var next = new Uint8ClampedArray(current.length);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var value = offset > 0 ? 0 : 255;
          for (var dy = -1; dy <= 1; dy++) {
            var sy = y + dy;
            if (sy < 0 || sy >= height) continue;
            for (var dx = -1; dx <= 1; dx++) {
              var sx = x + dx;
              if (sx < 0 || sx >= width) continue;
              var sample = current[sy * width + sx];
              value = offset > 0 ? Math.max(value, sample) : Math.min(value, sample);
            }
          }
          next[y * width + x] = value;
        }
      }
      current = next;
    }
    return current;
  }

  function featherMask(mask, width, height, radius) {
    if (radius <= 0) return mask;
    var horizontal = new Uint8ClampedArray(mask.length);
    var output = new Uint8ClampedArray(mask.length);
    var x;
    var y;
    var sum;
    var count;

    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        sum = 0;
        count = 0;
        for (var dx = -radius; dx <= radius; dx++) {
          var sx = clamp(x + dx, 0, width - 1);
          sum += mask[y * width + sx];
          count++;
        }
        horizontal[y * width + x] = Math.round(sum / count);
      }
    }
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        sum = 0;
        count = 0;
        for (var dy = -radius; dy <= radius; dy++) {
          var sy = clamp(y + dy, 0, height - 1);
          sum += horizontal[sy * width + x];
          count++;
        }
        output[y * width + x] = Math.round(sum / count);
      }
    }
    return output;
  }

  function segmentSubject(data, width, height, params) {
    var mask = makeForegroundMask(data, width, height, params.foregroundConfidenceThreshold);
    mask = changeMaskOffset(mask, width, height, params.maskExpandOffset);
    mask = featherMask(mask, width, height, params.edgeFeatherRadius);
    var output = new Uint8ClampedArray(data.length);
    var threshold = Math.round(params.foregroundConfidenceThreshold * 255);
    for (var i = 0; i < mask.length; i++) {
      var offset = i * 4;
      if (mask[i] >= threshold) {
        output[offset] = data[offset];
        output[offset + 1] = data[offset + 1];
        output[offset + 2] = data[offset + 2];
        output[offset + 3] = mask[i];
      }
    }
    return output;
  }

  function pixelateBoxSample(data, imageWidth, imageHeight, gridWidth, gridHeight) {
    var cells = [];
    var cellWidth = imageWidth / gridWidth;
    var cellHeight = imageHeight / gridHeight;
    for (var gy = 0; gy < gridHeight; gy++) {
      for (var gx = 0; gx < gridWidth; gx++) {
        var x0 = Math.floor(gx * cellWidth);
        var y0 = Math.floor(gy * cellHeight);
        var x1 = Math.floor((gx + 1) * cellWidth);
        var y1 = Math.floor((gy + 1) * cellHeight);
        var r = 0;
        var g = 0;
        var b = 0;
        var opaque = 0;
        var total = 0;
        if (x1 <= x0) x1 = Math.min(imageWidth, x0 + 1);
        if (y1 <= y0) y1 = Math.min(imageHeight, y0 + 1);
        for (var py = y0; py < y1; py++) {
          for (var px = x0; px < x1; px++) {
            var offset = (py * imageWidth + px) * 4;
            total++;
            if (data[offset + 3] < 16) continue;
            r += data[offset];
            g += data[offset + 1];
            b += data[offset + 2];
            opaque++;
          }
        }
        cells.push({
          r: opaque ? r / opaque : 0,
          g: opaque ? g / opaque : 0,
          b: opaque ? b / opaque : 0,
          coverage: total ? opaque / total : 0
        });
      }
    }
    return cells;
  }

  function floydSteinberg(cells, gridWidth, gridHeight, colors) {
    var buffer = [];
    for (var i = 0; i < cells.length; i++) {
      buffer.push({
        r: cells[i].r,
        g: cells[i].g,
        b: cells[i].b,
        empty: cells[i].coverage < 0.35
      });
    }
    var indices = new Int32Array(buffer.length);
    for (var y = 0; y < gridHeight; y++) {
      for (var x = 0; x < gridWidth; x++) {
        var index = y * gridWidth + x;
        var cell = buffer[index];
        if (cell.empty) {
          indices[index] = -1;
          continue;
        }
        var colorIndex = findNearest({
          r: clamp(Math.round(cell.r), 0, 255),
          g: clamp(Math.round(cell.g), 0, 255),
          b: clamp(Math.round(cell.b), 0, 255)
        }, colors);
        indices[index] = colorIndex;
        var chosen = colors[colorIndex]._rgb;
        var er = cell.r - chosen.r;
        var eg = cell.g - chosen.g;
        var eb = cell.b - chosen.b;
        var next;

        if (x + 1 < gridWidth && !buffer[index + 1].empty) {
          next = buffer[index + 1];
          next.r += er * 7 / 16;
          next.g += eg * 7 / 16;
          next.b += eb * 7 / 16;
        }
        if (y + 1 < gridHeight) {
          if (x > 0 && !buffer[index + gridWidth - 1].empty) {
            next = buffer[index + gridWidth - 1];
            next.r += er * 3 / 16;
            next.g += eg * 3 / 16;
            next.b += eb * 3 / 16;
          }
          if (!buffer[index + gridWidth].empty) {
            next = buffer[index + gridWidth];
            next.r += er * 5 / 16;
            next.g += eg * 5 / 16;
            next.b += eb * 5 / 16;
          }
          if (x + 1 < gridWidth && !buffer[index + gridWidth + 1].empty) {
            next = buffer[index + gridWidth + 1];
            next.r += er * 1 / 16;
            next.g += eg * 1 / 16;
            next.b += eb * 1 / 16;
          }
        }
      }
    }
    return indices;
  }

  function bayerDither(cells, gridWidth, gridHeight, colors) {
    var indices = new Int32Array(cells.length);
    for (var y = 0; y < gridHeight; y++) {
      for (var x = 0; x < gridWidth; x++) {
        var index = y * gridWidth + x;
        var cell = cells[index];
        if (cell.coverage < 0.35) {
          indices[index] = -1;
          continue;
        }
        var lab = rgbToLab({
          r: clamp(Math.round(cell.r), 0, 255),
          g: clamp(Math.round(cell.g), 0, 255),
          b: clamp(Math.round(cell.b), 0, 255)
        });
        var best = -1;
        var second = -1;
        var bestDistance = Infinity;
        var secondDistance = Infinity;
        for (var i = 0; i < colors.length; i++) {
          var colorLab = colors[i]._lab;
          var dl = lab.l - colorLab.l;
          var da = lab.a - colorLab.a;
          var db = lab.b - colorLab.b;
          var distance = dl * dl + da * da + db * db;
          if (distance < bestDistance) {
            secondDistance = bestDistance;
            second = best;
            bestDistance = distance;
            best = i;
          } else if (distance < secondDistance) {
            secondDistance = distance;
            second = i;
          }
        }
        var threshold = BAYER_8X8[y % 8][x % 8] / 64;
        if (second >= 0 && secondDistance - bestDistance < 400) {
          var ratio = bestDistance / Math.max(secondDistance, 0.001);
          indices[index] = ratio > threshold ? second : best;
        } else {
          indices[index] = best;
        }
      }
    }
    return indices;
  }

  function quantize(data, imageWidth, imageHeight, gridWidth, gridHeight, palette, ditherMode) {
    var cells = pixelateBoxSample(data, imageWidth, imageHeight, gridWidth, gridHeight);
    var indices;
    if (ditherMode === 1) {
      indices = floydSteinberg(cells, gridWidth, gridHeight, palette.colors);
    } else if (ditherMode === 2) {
      indices = bayerDither(cells, gridWidth, gridHeight, palette.colors);
    } else {
      indices = new Int32Array(cells.length);
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        if (cell.coverage < 0.35) {
          indices[i] = -1;
          continue;
        }
        indices[i] = findNearest({
          r: clamp(Math.round(cell.r), 0, 255),
          g: clamp(Math.round(cell.g), 0, 255),
          b: clamp(Math.round(cell.b), 0, 255)
        }, palette.colors);
      }
    }

    var counts = new Int32Array(palette.colors.length);
    for (var index = 0; index < indices.length; index++) {
      var colorIndex = indices[index];
      if (colorIndex >= 0 && colorIndex < counts.length) counts[colorIndex]++;
    }
    return {
      indices: indices,
      counts: counts,
      gridWidth: gridWidth,
      gridHeight: gridHeight
    };
  }

  function mergeSimilar(result, palette, threshold) {
    var used = [];
    var seen = {};
    var i;
    for (i = 0; i < result.indices.length; i++) {
      var value = result.indices[i];
      if (value >= 0 && !seen[value]) {
        seen[value] = true;
        used.push(value);
      }
    }
    if (used.length < 2) return result;

    used.sort(function (a, b) {
      return result.counts[b] - result.counts[a];
    });
    var representatives = [];
    var replacements = {};
    for (i = 0; i < used.length; i++) {
      var colorIndex = used[i];
      var replacement = colorIndex;
      for (var j = 0; j < representatives.length; j++) {
        var rep = representatives[j];
        var a = palette.colors[colorIndex]._lab;
        var b = palette.colors[rep]._lab;
        var dl = a.l - b.l;
        var da = a.a - b.a;
        var db = a.b - b.b;
        if (Math.sqrt(dl * dl + da * da + db * db) < threshold) {
          replacement = rep;
          break;
        }
      }
      if (replacement === colorIndex) representatives.push(colorIndex);
      replacements[colorIndex] = replacement;
    }

    var indices = new Int32Array(result.indices.length);
    var counts = new Int32Array(palette.colors.length);
    for (i = 0; i < result.indices.length; i++) {
      var oldIndex = result.indices[i];
      var nextIndex = oldIndex >= 0 && replacements[oldIndex] !== undefined ? replacements[oldIndex] : oldIndex;
      indices[i] = nextIndex;
      if (nextIndex >= 0 && nextIndex < counts.length) counts[nextIndex]++;
    }
    result.indices = indices;
    result.counts = counts;
    return result;
  }

  function processPixels(sourceData, width, height, palette) {
    var data = sourceData;
    if (state.autoContrast) data = autoContrast(data);
    data = adjustBrightnessContrast(data, state.brightness, state.contrast);
    data = canvasBlur(data, width, height, state.blurSigma);
    if (state.removeBackground) {
      data = segmentSubject(data, width, height, state.segmentationParams);
    }
    data = enhanceEdges(data, width, height, state.edgeEnhance);
    var result = quantize(data, width, height, state.gridWidth, state.gridHeight, palette, state.ditherMode);
    if (state.mergeSimilarColors) result = mergeSimilar(result, palette, 6);
    return result;
  }

  function generateBlueprint() {
    if (!state.sourceCanvas || state.busy) return;
    setBusy(true, '正在调整图片...');
    setStatus('处理中');

    window.setTimeout(function () {
      try {
        var pixels = getPixels(state.sourceCanvas);
        setBusy(true, '正在生成拼豆图纸...');
        var result = processPixels(pixels.data, pixels.width, pixels.height, state.palette);
        state.result = result;
        state.scale = 1;
        dom.resultSection.classList.remove('hidden');
        renderCanvas();
        renderLegend();
        setStatus('处理完成');
        showToast('图纸生成完成');
        window.setTimeout(function () {
          dom.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      } catch (error) {
        setStatus('处理失败');
        showToast(error && error.message ? error.message : '处理失败');
      } finally {
        setBusy(false);
      }
    }, 30);
  }

  function calculateBeadSize(cssWidth, cssHeight) {
    var result = state.result;
    var fit = Math.min(cssWidth / result.gridWidth, cssHeight / result.gridHeight);
    var scaled = fit * state.scale;
    if (scaled < 4) return 4;
    if (scaled > 32) return 32;
    return scaled;
  }

  function renderCanvas() {
    if (!state.result || !state.palette) return;
    var canvas = dom.resultCanvas;
    var context = canvas.getContext('2d');
    var rect = canvas.getBoundingClientRect();
    var cssWidth = Math.max(220, rect.width || 320);
    var cssHeight = Math.max(260, rect.height || 340);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, cssWidth, cssHeight);

    var beadSize = calculateBeadSize(cssWidth, cssHeight);
    var gridPixelWidth = state.result.gridWidth * beadSize;
    var gridPixelHeight = state.result.gridHeight * beadSize;
    var startX = (cssWidth - gridPixelWidth) / 2;
    var startY = (cssHeight - gridPixelHeight) / 2;

    context.fillStyle = '#e8edf1';
    context.fillRect(startX - 2, startY - 2, gridPixelWidth + 4, gridPixelHeight + 4);
    var gap = Math.max(1, Math.floor(beadSize / 12));

    for (var y = 0; y < state.result.gridHeight; y++) {
      for (var x = 0; x < state.result.gridWidth; x++) {
        var index = y * state.result.gridWidth + x;
        var colorIndex = state.result.indices[index];
        if (colorIndex < 0 || colorIndex >= state.palette.colors.length) continue;
        var drawX = state.mirrored ? state.result.gridWidth - 1 - x : x;
        var px = startX + drawX * beadSize;
        var py = startY + y * beadSize;
        var color = state.palette.colors[colorIndex];
        context.fillStyle = color.hex;
        context.fillRect(px + gap, py + gap, beadSize - gap * 2, beadSize - gap * 2);

        if (state.showLabels && beadSize >= 13) {
          var luminance = 0.299 * color._rgb.r + 0.587 * color._rgb.g + 0.114 * color._rgb.b;
          drawBeadLabel(context, color.code || ('#' + (colorIndex + 1)), px + beadSize / 2, py + beadSize / 2, beadSize, luminance > 140 ? '#000000' : '#ffffff');
        }
      }
    }

    context.strokeStyle = '#cbd3da';
    context.lineWidth = 0.5;
    for (var gy = 0; gy <= state.result.gridHeight; gy++) {
      var lineY = startY + gy * beadSize;
      context.beginPath();
      context.moveTo(startX, lineY);
      context.lineTo(startX + gridPixelWidth, lineY);
      context.stroke();
    }
    for (var gx = 0; gx <= state.result.gridWidth; gx++) {
      var lineX = startX + gx * beadSize;
      context.beginPath();
      context.moveTo(lineX, startY);
      context.lineTo(lineX, startY + gridPixelHeight);
      context.stroke();
    }
  }

  function drawBeadLabel(context, text, centerX, centerY, beadSize, fillStyle) {
    var maxWidth = Math.max(8, beadSize - 2);
    var fontSize = Math.min(beadSize * 0.42, Math.max(6, beadSize * 0.34));
    context.fillStyle = fillStyle;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = fontSize.toFixed(2) + "px 'SF Mono','Consolas',monospace";
    while (fontSize > 5 && context.measureText(text).width > maxWidth) {
      fontSize -= 0.25;
      context.font = fontSize.toFixed(2) + "px 'SF Mono','Consolas',monospace";
    }
    if (context.measureText(text).width <= maxWidth + 1) {
      context.fillText(text, centerX, centerY);
    }
  }

  function renderLegend() {
    if (!state.result || !state.palette) return;
    dom.legendList.innerHTML = '';
    var items = [];
    for (var i = 0; i < state.palette.colors.length; i++) {
      if (state.result.counts[i] > 0) {
        items.push({
          color: state.palette.colors[i],
          index: i,
          count: state.result.counts[i]
        });
      }
    }
    items.sort(function (a, b) {
      var aCode = parseInt(String(a.color.code).replace(/\D/g, ''), 10) || 0;
      var bCode = parseInt(String(b.color.code).replace(/\D/g, ''), 10) || 0;
      return aCode - bCode || String(a.color.code).localeCompare(String(b.color.code));
    });
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var row = document.createElement('div');
      row.className = 'legend-item';
      var swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.backgroundColor = item.color.hex;
      var name = document.createElement('span');
      name.className = 'legend-name';
      name.textContent = item.color.name || item.color.code;
      var code = document.createElement('span');
      code.className = 'legend-code';
      code.textContent = item.color.code || ('#' + (item.index + 1));
      var count = document.createElement('span');
      count.className = 'legend-count';
      count.textContent = String(item.count);
      row.appendChild(swatch);
      row.appendChild(name);
      row.appendChild(code);
      row.appendChild(count);
      dom.legendList.appendChild(row);
    }
    var usedColors = items.length;
    dom.resultMeta.textContent = state.result.gridWidth + ' × ' + state.result.gridHeight + ' · ' +
      usedColors + ' 色 · ' + state.palette.brand;
  }

  function saveToAlbum() {
    if (!state.result || !dom.resultCanvas) return;
    if (!(window.xhs && window.xhs.miniTool && typeof window.xhs.miniTool.saveImageToPhotosAlbum === 'function')) {
      showToast('请在小红书小工具内使用保存功能');
      return;
    }

    var dataUri;
    try {
      dataUri = dom.resultCanvas.toDataURL('image/png');
    } catch (error) {
      showToast('图纸导出失败');
      return;
    }

    var miniTool = window.xhs.miniTool;
    var saveDirect = function () {
      return miniTool.saveImageToPhotosAlbum({ filePath: dataUri });
    };
    var promise;
    if (typeof miniTool.writeTempFile === 'function') {
      promise = miniTool.writeTempFile({ data: dataUri }).then(function (result) {
        if (!result || !result.filePath) throw new Error('临时文件生成失败');
        return miniTool.saveImageToPhotosAlbum({ filePath: result.filePath });
      }).catch(saveDirect);
    } else {
      promise = saveDirect();
    }

    Promise.resolve(promise).then(function () {
      showToast('已保存到相册');
    }).catch(function (error) {
      showToast(error && error.errMsg ? error.errMsg : '保存失败');
    });
  }

  function bindEvents() {
    dom.chooseButton.addEventListener('click', function () {
      dom.fileInput.click();
    });
    dom.fileInput.addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (file) loadImageFile(file);
      event.target.value = '';
    });

    dom.brightness.addEventListener('input', function (event) {
      state.brightness = parseFloat(event.target.value) || 0;
      updateRangeLabels();
    });
    dom.contrast.addEventListener('input', function (event) {
      state.contrast = parseFloat(event.target.value) || 0;
      updateRangeLabels();
    });
    dom.blurSigma.addEventListener('input', function (event) {
      state.blurSigma = parseFloat(event.target.value) || 0;
      updateRangeLabels();
    });
    dom.edgeEnhance.addEventListener('input', function (event) {
      state.edgeEnhance = parseFloat(event.target.value) || 0;
      updateRangeLabels();
    });
    dom.autoContrast.addEventListener('change', function (event) {
      state.autoContrast = event.target.checked;
    });
    dom.mergeSimilarColors.addEventListener('change', function (event) {
      state.mergeSimilarColors = event.target.checked;
    });
    dom.removeBackground.addEventListener('change', function (event) {
      state.removeBackground = event.target.checked;
      dom.segmentationControls.classList.toggle('hidden', !state.removeBackground);
    });
    dom.foregroundConfidence.addEventListener('input', function (event) {
      state.segmentationParams.foregroundConfidenceThreshold = parseFloat(event.target.value) || 0.65;
      updateRangeLabels();
    });
    dom.edgeFeather.addEventListener('input', function (event) {
      state.segmentationParams.edgeFeatherRadius = parseInt(event.target.value, 10) || 0;
      updateRangeLabels();
    });
    dom.maskOffset.addEventListener('input', function (event) {
      state.segmentationParams.maskExpandOffset = parseInt(event.target.value, 10) || 0;
      updateRangeLabels();
    });

    dom.gridWidth.addEventListener('change', function (event) {
      state.gridWidth = clamp(parseInt(event.target.value, 10) || 1, 1, 200);
      syncGridValues();
    });
    dom.gridHeight.addEventListener('change', function (event) {
      state.gridHeight = clamp(parseInt(event.target.value, 10) || 1, 1, 200);
      syncGridValues();
    });
    dom.gridPresets.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-grid-w]') : null;
      if (!button) return;
      state.gridWidth = parseInt(button.getAttribute('data-grid-w'), 10);
      state.gridHeight = parseInt(button.getAttribute('data-grid-h'), 10);
      syncGridValues();
    });

    dom.paletteTabs.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-palette-id]') : null;
      if (!button) return;
      setPalette(button.getAttribute('data-palette-id'));
    });

    var ditherInputs = document.querySelectorAll('input[name="dither"]');
    for (var i = 0; i < ditherInputs.length; i++) {
      ditherInputs[i].addEventListener('change', function (event) {
        if (event.target.checked) state.ditherMode = parseInt(event.target.value, 10);
      });
    }

    dom.processButton.addEventListener('click', generateBlueprint);
    dom.saveButton.addEventListener('click', saveToAlbum);
    dom.zoomInButton.addEventListener('click', function () {
      state.scale = clamp(state.scale * 1.25, 0.25, 8);
      dom.zoomText.textContent = Math.round(state.scale * 100) + '%';
      renderCanvas();
    });
    dom.zoomOutButton.addEventListener('click', function () {
      state.scale = clamp(state.scale / 1.25, 0.25, 8);
      dom.zoomText.textContent = Math.round(state.scale * 100) + '%';
      renderCanvas();
    });
    dom.labelsButton.addEventListener('click', function () {
      state.showLabels = !state.showLabels;
      dom.labelsButton.classList.toggle('active', state.showLabels);
      renderCanvas();
    });
    dom.mirrorButton.addEventListener('click', function () {
      state.mirrored = !state.mirrored;
      dom.mirrorButton.classList.toggle('active', state.mirrored);
      renderCanvas();
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(renderCanvas, 120);
    });
  }

  function initializeDom() {
    dom.imageMeta = byId('imageMeta');
    dom.chooseButton = byId('chooseButton');
    dom.fileInput = byId('fileInput');
    dom.imagePreviewWrap = byId('imagePreviewWrap');
    dom.imagePreview = byId('imagePreview');
    dom.settingsArea = byId('settingsArea');
    dom.brightness = byId('brightness');
    dom.brightnessValue = byId('brightnessValue');
    dom.contrast = byId('contrast');
    dom.contrastValue = byId('contrastValue');
    dom.blurSigma = byId('blurSigma');
    dom.blurValue = byId('blurValue');
    dom.edgeEnhance = byId('edgeEnhance');
    dom.edgeValue = byId('edgeValue');
    dom.autoContrast = byId('autoContrast');
    dom.mergeSimilarColors = byId('mergeSimilarColors');
    dom.removeBackground = byId('removeBackground');
    dom.segmentationControls = byId('segmentationControls');
    dom.foregroundConfidence = byId('foregroundConfidence');
    dom.confidenceValue = byId('confidenceValue');
    dom.edgeFeather = byId('edgeFeather');
    dom.featherValue = byId('featherValue');
    dom.maskOffset = byId('maskOffset');
    dom.maskOffsetValue = byId('maskOffsetValue');
    dom.gridWidth = byId('gridWidth');
    dom.gridHeight = byId('gridHeight');
    dom.gridPresets = byId('gridPresets');
    dom.paletteMeta = byId('paletteMeta');
    dom.paletteTabs = byId('paletteTabs');
    dom.paletteBrand = byId('paletteBrand');
    dom.paletteSwatches = byId('paletteSwatches');
    dom.processButton = byId('processButton');
    dom.statusText = byId('statusText');
    dom.resultSection = byId('resultSection');
    dom.resultMeta = byId('resultMeta');
    dom.resultCanvas = byId('resultCanvas');
    dom.saveButton = byId('saveButton');
    dom.zoomOutButton = byId('zoomOutButton');
    dom.zoomInButton = byId('zoomInButton');
    dom.labelsButton = byId('labelsButton');
    dom.mirrorButton = byId('mirrorButton');
    dom.zoomText = byId('zoomText');
    dom.legendList = byId('legendList');
    dom.progressOverlay = byId('progressOverlay');
    dom.progressText = byId('progressText');
    dom.toast = byId('toast');
  }

  function start() {
    initializeDom();
    if (!window.PERLER_PALETTES) {
      setStatus('色卡数据加载失败');
      return;
    }
    setPalette('mard_221');
    syncGridValues();
    updateRangeLabels();
    bindEvents();
    dom.processButton.disabled = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
