// Shared TypeScript type definitions — canonical types for all frontends
// Manually kept in sync with engine/src/types.h

// ---- Color Types ----
export interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface LAB {
  l: number; // 0-100
  a: number; // green(-) to red(+)
  b: number; // blue(-) to yellow(+)
}

// ---- Palette Types ----
export interface BeadColor {
  name: string;  // e.g. "White"
  code: string;  // manufacturer part number, e.g. "H01"
  hex: string;   // e.g. "#FFFFFF"
}

export interface Palette {
  brand: string;
  version: string;
  description?: string;
  colors: BeadColor[];
}

// ---- Image Types ----
export interface ImageData {
  width: number;
  height: number;
  channels: number; // always 4 (RGBA)
  pixels: Uint8Array;
}

// ---- Dither Mode ----
export enum DitherMode {
  None = 0,
  FloydSteinberg = 1,
  Bayer8x8 = 2,
}

// ---- Bead Grid ----
export interface BeadGrid {
  gridWidth: number;
  gridHeight: number;
  paletteBrand: string;
  indices: Int32Array;   // gridWidth × gridHeight, palette color indices
  colorCounts: Int32Array; // per-palette-color usage count
}

// ---- Export Config ----
export interface ExportConfig {
  outputPath: string;
  dpi: number;
  includeColorLegend: boolean;
  compressJson: boolean;
}

export enum ExportFormat {
  PNG = 0,
  PDF = 1,
  CSV = 2,
  ProjectJSON = 3,
}

// ---- Project State (serializable for share) ----
export interface ProjectState {
  version: string;
  gridWidth: number;
  gridHeight: number;
  paletteBrand: string;
  paletteVersion?: string;
  indices: number[];
  ditherMode: DitherMode;
  sourceWidth?: number;
  sourceHeight?: number;
  brightness?: number;
  contrast?: number;
  blurSigma?: number;
  engineVersion?: string;
  createdAt?: string;
}

// ---- Diagnostic Results ----
export enum DiagStatus {
  PASS = 0,
  FAIL = 1,
  REPAIRED = 2,
  SKIPPED = 3,
}

export interface DiagResult {
  check: string;
  module: string;
  status: 'PASS' | 'FAIL' | 'REPAIRED' | 'SKIPPED';
  detail: string;
  timestamp?: string;
}

// ---- Plugin Types ----
export enum PluginType {
  PaletteSource = 0,
  BoardShape = 1,
  DitherAlgorithm = 2,
  ExportFormat = 3,
  ImageFilter = 4,
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  script?: string;  // relative Lua script path
  config?: Record<string, unknown>;
}

// ---- Palette Schema (JSON Schema subset) ----
export const PALETTE_SCHEMA = {
  type: 'object',
  required: ['brand', 'colors'],
  properties: {
    brand: { type: 'string', minLength: 1 },
    version: { type: 'string' },
    description: { type: 'string' },
    colors: {
      type: 'array',
      minItems: 10,
      items: {
        type: 'object',
        required: ['name', 'hex'],
        properties: {
          name: { type: 'string', minLength: 1 },
          code: { type: 'string' },
          hex: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
          },
        },
      },
    },
  },
};

// ---- Plugin Manifest Schema ----
export const PLUGIN_MANIFEST_SCHEMA = {
  type: 'object',
  required: ['name', 'version', 'type'],
  properties: {
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    type: {
      type: 'string',
      enum: ['palette_source', 'board_shape', 'dither_algo', 'export_format', 'image_filter'],
    },
    description: { type: 'string' },
    author: { type: 'string' },
    script: { type: 'string' },
    config: { type: 'object' },
  },
};
