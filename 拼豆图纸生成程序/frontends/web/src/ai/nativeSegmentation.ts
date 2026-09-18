import type {
  SegmentationBackend,
  SegmentationInput,
  SegmentationOutput,
  SegmentationProvider,
} from './segmentationTypes';

export const nativeSegmentationProvider: SegmentationProvider = {
  backend: 'native' as SegmentationBackend,
  async initialize() {
    // The native addon is loaded lazily by Electron when requested.
  },
  isReady() {
    return typeof window.electronAPI?.segmentImage === 'function';
  },
  async segment(input) {
    const api = window.electronAPI;
    if (!api?.segmentImage) {
      throw new Error('当前桌面版未安装 AI 分割原生模块');
    }
    const bytes = new Uint8Array(input.imageData);
    const data = bytes.buffer;
    const result = await api.segmentImage({
      data,
      width: input.width,
      height: input.height,
      params: input.params,
      roi: input.roi,
    });
    if (result && typeof result === 'object' && 'error' in result) {
      throw new Error(String((result as { error?: string }).error || 'AI 分割失败'));
    }
    return result;
  },
};
