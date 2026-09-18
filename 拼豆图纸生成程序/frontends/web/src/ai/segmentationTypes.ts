export type SegmentationBackend = 'wasm' | 'native' | 'auto';

export interface SegmentationParams {
  foregroundConfidenceThreshold: number;
  edgeFeatherRadius: number;
  maskExpandOffset: number;
}

export interface SegmentationInput {
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
  params: SegmentationParams;
  roi?: { x: number; y: number; width: number; height: number };
}

export interface SegmentationOutput {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  mask: Uint8ClampedArray;
  confidence: number;
  autoCropped: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SegmentationProvider {
  readonly backend: SegmentationBackend;
  initialize(): Promise<void>;
  isReady(): boolean;
  segment(input: SegmentationInput): Promise<SegmentationOutput>;
}

export const DEFAULT_SEGMENTATION_PARAMS: SegmentationParams = {
  foregroundConfidenceThreshold: 0.65,
  edgeFeatherRadius: 2,
  maskExpandOffset: 0,
};
