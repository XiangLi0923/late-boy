import { colorLabel, drawBeadLabel } from './beadLabel';

export interface PaletteColor {
  name: string;
  code: string;
  hex: string;
}

export interface RenderTask {
  format: 'main' | 'sub' | 'pdf';
  gw: number;
  gh: number;
  indices: Int32Array;
  colors: PaletteColor[];
  counts: Int32Array;
  paletteBrand: string;
  beadSize: number;
}

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function hex2rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function createCanvas(w: number, h: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function canvasToBlob(canvas: CanvasLike, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      type,
      quality
    );
  });
}

/** Convert a rendered blueprint canvas into a single-page PDF (JPEG inside PDF). */
async function canvasToPdfBlob(canvas: CanvasLike): Promise<Blob> {
  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const pageW = Math.max(1, Math.round(canvas.width * 72 / 150));
  const pageH = Math.max(1, Math.round(canvas.height * 72 / 150));

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const objectOffsets: number[] = new Array(6).fill(0);
  const push = (data: string | Uint8Array) => {
    chunks.push(typeof data === 'string' ? encoder.encode(data) : data);
  };
  const byteLength = () => chunks.reduce((n, c) => n + c.length, 0);
  const startObject = (num: number) => {
    objectOffsets[num] = byteLength();
    push(`${num} 0 obj\n`);
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  startObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObject(2);
  push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  startObject(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
    `/Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );
  startObject(4);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\n` +
    'stream\n'
  );
  push(jpeg);
  push('\nendstream\nendobj\n');

  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im1 Do\nQ\n`;
  startObject(5);
  push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefOffset = byteLength();
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    push(`${String(objectOffsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const merged = new Uint8Array(byteLength());
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new Blob([merged], { type: 'application/pdf' });
}

/** Render main blueprint (主图): beads + codes + coordinates + legend. */
export function renderMainCanvas(
  gw: number,
  gh: number,
  indices: Int32Array,
  colors: PaletteColor[],
  counts: Int32Array,
  paletteBrand: string,
  beadSize: number
): CanvasLike {
  const labelW = 28;
  const labelH = 18;
  const headerH = 30;
  const margin = 16;

  const gridPxW = gw * beadSize;
  const gridPxH = gh * beadSize;
  const cw = gridPxW + labelW + margin * 2;

  const entries = colors
    .map((c, i) => ({ ...c, count: counts[i] || 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => {
      const na = parseInt((a.code || '0').replace(/\D/g, '')) || 0;
      const nb = parseInt((b.code || '0').replace(/\D/g, '')) || 0;
      return na - nb || a.code.localeCompare(b.code);
    });
  const perRow = Math.max(1, Math.floor((cw - margin * 2) / 160));
  const legendH = 16 + 14 + Math.ceil(entries.length / perRow) * 18 + 8;
  const ch = gridPxH + labelH + headerH + legendH + margin * 2;

  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d') as CanvasContext | null;
  if (!ctx) throw new Error('无法创建画布');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);

  const gx = margin + labelW;
  const gy = margin + headerH + labelH;

  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(gx - 2, gy - 2, gridPxW + 4, gridPxH + 4);

  ctx.fillStyle = '#333';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Perler Bead Blueprint', cw / 2, margin + 14);
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.fillText(`${gw}×${gh}  |  ${paletteBrand}  |  ${indices.length} beads`, cw / 2, margin + 26);

  function colLabel(i: number): string {
    let s = '';
    while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; }
    return s;
  }
  ctx.fillStyle = '#666';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  for (let x = 0; x < gw; x++) {
    ctx.fillText(colLabel(x), gx + x * beadSize + beadSize / 2, gy - 5);
  }

  ctx.textAlign = 'right';
  for (let y = 0; y < gh; y++) {
    ctx.fillText(String(y + 1), gx - 5, gy + y * beadSize + beadSize / 2 + 3);
  }

  const gap = Math.max(1, Math.floor(beadSize / 12));
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const ci = indices[y * gw + x];
      if (ci < 0 || ci >= colors.length) continue;

      const px = gx + x * beadSize;
      const py = gy + y * beadSize;
      const hex = colors[ci].hex;

      ctx.fillStyle = hex;
      ctx.fillRect(px + gap, py + gap, beadSize - gap * 2, beadSize - gap * 2);

      if (beadSize >= 14) {
        const [r, g, b] = hex2rgb(hex);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const txtColor = lum > 140 ? '#000' : '#fff';
        drawBeadLabel(
          ctx,
          colorLabel(colors[ci], ci),
          px + beadSize / 2,
          py + beadSize / 2,
          beadSize,
          txtColor
        );
      }
    }
  }

  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 0.5;
  for (let row = 0; row <= gh; row++) {
    const y = gy + row * beadSize;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gridPxW, y); ctx.stroke();
  }
  for (let col = 0; col <= gw; col++) {
    const x = gx + col * beadSize;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gridPxH); ctx.stroke();
  }

  const ly = gy + gridPxH + 16;
  ctx.fillStyle = '#333';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Color Legend', margin, ly);

  entries.forEach((e, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const lx = margin + col * 160;
    const lry = ly + 14 + row * 18;

    ctx.fillStyle = e.hex;
    ctx.fillRect(lx, lry + 1, 14, 14);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, lry + 1, 14, 14);

    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${e.code} x${e.count}`, lx + 18, lry + 11);
  });

  return canvas;
}

/** Render sub blueprint (副图): clean beads + grid, no labels. */
export function renderSubCanvas(
  gw: number,
  gh: number,
  indices: Int32Array,
  colors: PaletteColor[],
  beadSize: number
): CanvasLike {
  const margin = 16;
  const cw = gw * beadSize + margin * 2;
  const ch = gh * beadSize + margin * 2;

  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d') as CanvasContext | null;
  if (!ctx) throw new Error('无法创建画布');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(margin - 2, margin - 2, gw * beadSize + 4, gh * beadSize + 4);

  const gap = Math.max(1, Math.floor(beadSize / 12));

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const ci = indices[y * gw + x];
      if (ci < 0 || ci >= colors.length) continue;
      const px = margin + x * beadSize;
      const py = margin + y * beadSize;
      ctx.fillStyle = colors[ci].hex;
      ctx.fillRect(px + gap, py + gap, beadSize - gap * 2, beadSize - gap * 2);
    }
  }

  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 0.5;
  for (let gy = 0; gy <= gh; gy++) {
    const y = margin + gy * beadSize;
    ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(margin + gw * beadSize, y); ctx.stroke();
  }
  for (let gx = 0; gx <= gw; gx++) {
    const x = margin + gx * beadSize;
    ctx.beginPath(); ctx.moveTo(x, margin); ctx.lineTo(x, margin + gh * beadSize); ctx.stroke();
  }

  return canvas;
}

/** Render a blueprint and return the final file blob. */
export async function renderBlueprint(task: RenderTask): Promise<Blob> {
  const { format, gw, gh, indices, colors, counts, paletteBrand, beadSize } = task;
  if (format === 'sub') {
    const canvas = renderSubCanvas(gw, gh, indices, colors, beadSize);
    return canvasToBlob(canvas, 'image/png');
  }

  const mainCanvas = renderMainCanvas(gw, gh, indices, colors, counts, paletteBrand, beadSize);
  if (format === 'pdf') {
    return canvasToPdfBlob(mainCanvas);
  }
  return canvasToBlob(mainCanvas, 'image/png');
}
