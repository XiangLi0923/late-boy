import { create } from 'zustand';

export interface BeadColor {
  name: string;
  code: string;
  hex: string;
}

export interface PaletteInfo {
  brand: string;
  colors: BeadColor[];
}

export interface BeadGrid {
  gridWidth: number;
  gridHeight: number;
  paletteBrand: string;
  indices: Int32Array;
  colorCounts: Int32Array;
  paletteCodes?: string[];
}

export interface ProjectState {
  // Image
  imageLoaded: boolean;
  originalImage: HTMLImageElement | null;
  imageData: Uint8Array | null;
  imageFile: File | null;
  imageWidth: number;
  imageHeight: number;

  // Preprocessing
  brightness: number;
  contrast: number;
  blurSigma: number;
  edgeEnhance: number;
  autoContrast: boolean;
  removeBackground: boolean;
  mergeSimilarColors: boolean;
  segmentationParams: {
    foregroundConfidenceThreshold: number;
    edgeFeatherRadius: number;
    maskExpandOffset: number;
  };
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;

  // Grid settings
  gridWidth: number;
  gridHeight: number;
  ditherMode: number; // 0=None, 1=FloydSteinberg, 2=Bayer8x8

  // Palette
  selectedPaletteId: string;
  palette: PaletteInfo | null;
  availablePalettes: string[];

  // Result
  beadGrid: BeadGrid | null;
  isProcessing: boolean;
  taskMessage: string | null;
  error: string | null;

  // View options
  mirrored: boolean; // 图纸水平镜像（烫豆面预览）
  highlightColorIndex: number | null; // 高亮的色号下标（逐步拼），null=不高亮

  // Actions
  setImage: (img: HTMLImageElement, data: Uint8Array, file?: File) => void;
  setBrightness: (v: number) => void;
  setContrast: (v: number) => void;
  setBlurSigma: (v: number) => void;
  setEdgeEnhance: (v: number) => void;
  setAutoContrast: (v: boolean) => void;
  setRemoveBackground: (v: boolean) => void;
  setMergeSimilarColors: (v: boolean) => void;
  setSegmentationParams: (params: Partial<ProjectState['segmentationParams']>) => void;
  setCrop: (x: number, y: number, w: number, h: number) => void;
  setGridSize: (w: number, h: number) => void;
  setDitherMode: (mode: number) => void;
  setPaletteId: (id: string) => void;
  setPalette: (palette: PaletteInfo) => void;
  setBeadGrid: (grid: BeadGrid | null) => void;
  setProcessing: (v: boolean) => void;
  setTaskMessage: (message: string | null) => void;
  setError: (err: string | null) => void;
  setAvailablePalettes: (ids: string[]) => void;
  toggleMirror: () => void;
  setHighlightColor: (idx: number | null) => void;
  clearImage: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  // Image
  imageLoaded: false,
  originalImage: null,
  imageData: null,
  imageFile: null,
  imageWidth: 0,
  imageHeight: 0,

  // Preprocessing
  brightness: 0,
  contrast: 1,
  blurSigma: 0,
  edgeEnhance: 1.2,
  autoContrast: true,
  removeBackground: false,
  mergeSimilarColors: true,
  segmentationParams: {
    foregroundConfidenceThreshold: 0.65,
    edgeFeatherRadius: 2,
    maskExpandOffset: 0,
  },
  cropX: 0,
  cropY: 0,
  cropW: 0,
  cropH: 0,

  // Grid
  gridWidth: 50,
  gridHeight: 50,
  ditherMode: 1, // 默认 Floyd-Steinberg：消除皮肤/渐变处的色带

  // Palette
  selectedPaletteId: 'mard_221',
  palette: null,
  availablePalettes: ['mard_221', 'mard_all', 'hama_midi', 'perler_standard', 'universal_24'],

  // Result
  beadGrid: null,
  isProcessing: false,
  taskMessage: null,
  error: null,

  // View options
  mirrored: false,
  highlightColorIndex: null,

  // Actions
  setImage: (img, data, file) => set({
    imageLoaded: true,
    originalImage: img,
    imageData: data,
    imageFile: file || null,
    imageWidth: img.width,
    imageHeight: img.height,
    cropW: img.width,
    cropH: img.height,
    error: null,
  }),

  setBrightness: (v) => set({ brightness: Math.max(-1, Math.min(1, v)) }),
  setContrast: (v) => set({ contrast: Math.max(0, Math.min(3, v)) }),
  setBlurSigma: (v) => set({ blurSigma: Math.max(0, Math.min(10, v)) }),
  setEdgeEnhance: (v) => set({ edgeEnhance: Math.max(0, Math.min(2, v)) }),
  setAutoContrast: (v) => set({ autoContrast: v }),
  setRemoveBackground: (v) => set({ removeBackground: v }),
  setMergeSimilarColors: (v) => set({ mergeSimilarColors: v }),
  setSegmentationParams: (params) => set((state) => ({
    segmentationParams: { ...state.segmentationParams, ...params },
  })),
  setCrop: (x, y, w, h) => set({ cropX: x, cropY: y, cropW: w, cropH: h }),
  setGridSize: (w, h) => set({
    gridWidth: Math.max(1, Math.min(500, Math.round(w) || 1)),
    gridHeight: Math.max(1, Math.min(500, Math.round(h) || 1)),
  }),
  setDitherMode: (mode) => set({ ditherMode: mode }),
  setPaletteId: (id) => set({ selectedPaletteId: id }),
  setPalette: (palette) => set({ palette }),
  setBeadGrid: (grid) => set({ beadGrid: grid }),
  setProcessing: (v) => set({ isProcessing: v }),
  setTaskMessage: (message) => set({ taskMessage: message }),
  setError: (err) => set({ error: err }),
  setAvailablePalettes: (ids) => set({ availablePalettes: ids }),
  toggleMirror: () => set((s) => ({ mirrored: !s.mirrored })),
  setHighlightColor: (idx) => set({ highlightColorIndex: idx }),
  clearImage: () => set({
    imageLoaded: false,
    originalImage: null,
    imageData: null,
    imageFile: null,
    beadGrid: null,
    error: null,
  }),
}));
