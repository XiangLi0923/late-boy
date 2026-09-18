import { useProjectStore } from '../stores/projectStore';

export interface HistoryProject {
  version: string;
  width: number;
  height: number;
  grid: number[][];
  color_table: {
    idx: number;
    code: string;
    name: string;
    rgb: [number, number, number];
  }[];
  palette_brand: string;
  dither_mode: number;
}

export interface HistoryItem {
  id: string;
  savedAt: number;
  favorite: boolean;
  title: string;
  gridWidth: number;
  gridHeight: number;
  paletteBrand: string;
  usedColors: number;
  thumbnail: string;
  project: HistoryProject;
}

const HISTORY_KEY = 'perler_bead_history_v1';
const MAX_ITEMS = 80;

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16),
  ];
}

function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Ignore quota/private-mode failures. History is best-effort local data.
  }
}

function dominantTitle(colors: { name: string; code: string }[], counts: Int32Array): string {
  return colors
    .map((c, i) => ({ label: c.name || c.code || `色${i + 1}`, count: counts[i] || 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((c) => c.label)
    .join('·') || '阿莉的图';
}

function buildThumbnail(
  width: number,
  height: number,
  indices: Int32Array,
  colors: { name: string; code: string; hex: string }[],
  maxSize = 180
): string {
  try {
    const cell = Math.max(2, Math.floor(Math.min(maxSize / width, maxSize / height)));
    const canvas = document.createElement('canvas');
    canvas.width = width * cell;
    canvas.height = height * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ci = indices[y * width + x];
        if (ci < 0 || ci >= colors.length) continue;
        ctx.fillStyle = colors[ci].hex || '#000000';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return '';
  }
}

function projectFromStore(): HistoryProject | null {
  const state = useProjectStore.getState();
  if (!state.beadGrid || !state.palette) return null;

  const grid: number[][] = [];
  for (let y = 0; y < state.beadGrid.gridHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < state.beadGrid.gridWidth; x++) {
      row.push(state.beadGrid.indices[y * state.beadGrid.gridWidth + x]);
    }
    grid.push(row);
  }

  return {
    version: '1.0',
    width: state.beadGrid.gridWidth,
    height: state.beadGrid.gridHeight,
    grid,
    color_table: state.palette.colors.map((c, idx) => ({
      idx,
      code: c.code,
      name: c.name,
      rgb: hexToRgb(c.hex),
    })),
    palette_brand: state.palette.brand,
    dither_mode: state.ditherMode,
  };
}

export function recordCurrentProject(): void {
  const project = projectFromStore();
  if (!project) return;

  const state = useProjectStore.getState();
  const colors = state.palette?.colors || [];
  const counts = state.beadGrid?.colorCounts || new Int32Array(colors.length);
  const item: HistoryItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    favorite: false,
    title: dominantTitle(colors, counts),
    gridWidth: project.width,
    gridHeight: project.height,
    paletteBrand: state.palette?.brand || '未知色板',
    usedColors: Array.from(counts).filter((v) => v > 0).length,
    thumbnail: buildThumbnail(project.width, project.height, state.beadGrid!.indices, colors),
    project,
  };

  const items = readHistory();
  items.unshift(item);
  writeHistory(items);
}

export function listHistory(): HistoryItem[] {
  return readHistory().sort((a, b) => b.savedAt - a.savedAt);
}

export function toggleHistoryFavorite(id: string): void {
  const items = readHistory().map((item) =>
    item.id === id ? { ...item, favorite: !item.favorite } : item
  );
  writeHistory(items);
}

export function deleteHistoryItem(id: string): void {
  writeHistory(readHistory().filter((item) => item.id !== id));
}

export function clearHistory(): void {
  writeHistory([]);
}
