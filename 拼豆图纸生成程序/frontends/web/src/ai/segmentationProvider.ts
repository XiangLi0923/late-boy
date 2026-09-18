import { nativeSegmentationProvider } from './nativeSegmentation';
import type { SegmentationBackend, SegmentationProvider } from './segmentationTypes';
import { onnxSegmentationProvider } from './onnxSegmentation';
import { wasmSegmentationProvider } from './wasmSegmentation';

const configured = (import.meta.env.VITE_SEGMENTATION_BACKEND as string | undefined) as
  | SegmentationBackend
  | undefined;

export function getSegmentationProvider(): SegmentationProvider {
  if (configured === 'native') {
    return nativeSegmentationProvider;
  }
  if (configured === 'wasm') {
    return wasmSegmentationProvider;
  }
  // 默认 auto：优先真实 AI 模型（onnx u2netp）；模型加载失败时由 onnx provider
  // 内部抛错，由调用方（engineService）回退到 wasmSegmentationProvider 的兜底算法。
  // 注意：原生模块是骨架，preload 始终暴露 segmentImage，导致 native 的 isReady()
  // 恒真——若 auto 优先 native，桌面版会永远走「原生模块失败→边缘兜底」而用不上
  // onnx 真实模型，故这里不把 native 作为 auto 的默认项。
  return onnxSegmentationProvider;
}

export const currentSegmentationBackend: SegmentationBackend = configured || 'auto';
