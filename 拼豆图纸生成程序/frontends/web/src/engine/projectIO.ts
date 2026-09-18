import { useProjectStore } from '../stores/projectStore';
import { decodeSharePayload, type DecodedShare } from './shareUtils';

export interface ImportedProject {
  width: number;
  height: number;
  indices: Int32Array;
  paletteBrand: string;
  colors: { name: string; code: string; hex: string }[];
  ditherMode: number;
}

function rgbToHex(rgb: number[] | undefined): string {
  if (!Array.isArray(rgb) || rgb.length < 3) return '#000000';
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`.toUpperCase();
}

function hexToRgb(hex: string): number[] | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function normalizeProjectJSON(json: any): ImportedProject | null {
  if (!json || typeof json !== 'object') return null;

  const width = Number(json.width ?? json.grid_width ?? 0);
  const height = Number(json.height ?? json.grid_height ?? 0);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;

  let grid: any[] | null = Array.isArray(json.grid) ? json.grid : null;
  if (!grid && Array.isArray(json.grid_indices)) {
    grid = [];
    for (let y = 0; y < height; y++) {
      grid.push(json.grid_indices.slice(y * width, (y + 1) * width));
    }
  }
  if (!grid || grid.length !== height) return null;

  let colorTable: any[] | null = Array.isArray(json.color_table) ? json.color_table : null;
  if (!colorTable && Array.isArray(json.colors)) {
    colorTable = json.colors.map((c: any, i: number) => ({
      idx: i,
      code: c.code || '',
      name: c.name || '',
      rgb: hexToRgb(c.hex),
    }));
  }
  if (!colorTable || colorTable.length === 0) return null;

  const sorted = [...colorTable].sort((a, b) => (Number(a.idx) || 0) - (Number(b.idx) || 0));
  const colors = sorted.map((c) => ({
    name: String(c.name || ''),
    code: String(c.code || ''),
    hex: typeof c.hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c.hex)
      ? c.hex.toUpperCase()
      : rgbToHex(Array.isArray(c.rgb) ? c.rgb : hexToRgb(c.hex) || undefined),
  }));

  const indices = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Number(grid[y]?.[x]);
      indices[y * width + x] = Number.isInteger(v) && v >= 0 && v < colors.length ? v : -1;
    }
  }

  return {
    width,
    height,
    indices,
    paletteBrand: String(json.palette_brand || '导入项目'),
    colors,
    ditherMode: Number(json.dither_mode) || 0,
  };
}

export function applyProjectToStore(project: ImportedProject): void {
  const colorCounts = new Int32Array(project.colors.length);
  for (const idx of project.indices) {
    if (idx >= 0 && idx < colorCounts.length) colorCounts[idx]++;
  }

  useProjectStore.setState({
    imageLoaded: false,
    originalImage: null,
    imageData: null,
    imageFile: null,
    gridWidth: project.width,
    gridHeight: project.height,
    ditherMode: project.ditherMode,
    palette: { brand: project.paletteBrand, colors: project.colors },
    beadGrid: {
      gridWidth: project.width,
      gridHeight: project.height,
      paletteBrand: project.paletteBrand,
      indices: project.indices,
      colorCounts,
    },
    error: null,
  });
}

export function applyShareCodeToStore(code: string): boolean {
  const decoded = decodeSharePayload(code);
  if (!decoded) return false;
  applyProjectToStore({
    width: decoded.w,
    height: decoded.h,
    indices: decoded.indices,
    paletteBrand: decoded.pb || '分享图纸',
    colors: decoded.colors.map((c) => ({ name: c.n, code: c.c, hex: c.h })),
    ditherMode: decoded.dt,
  });
  return true;
}

export function extractShareCodeFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('share');
  if (fromQuery) return fromQuery;
  const hash = window.location.hash;
  if (hash.startsWith('#share=')) return hash.slice('#share='.length);
  return null;
}

export function buildShareUrl(code: string): string {
  const configuredBase = import.meta.env.VITE_SHARE_BASE_URL as string | undefined;
  if (configuredBase) {
    const url = new URL(configuredBase);
    url.search = '';
    url.hash = `#share=${encodeURIComponent(code)}`;
    return url.toString();
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `#share=${encodeURIComponent(code)}`;
  return url.toString();
}

export type { DecodedShare };
