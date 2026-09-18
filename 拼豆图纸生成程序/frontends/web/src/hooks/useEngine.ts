import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { engineService } from '../engine/engineService';
import { recordCurrentProject } from '../engine/historyService';
import { trackEvent } from '../engine/analyticsService';
import type { ProcessOptions, DiagnoseResult } from '../engine/engineService';
import type { Palette } from '../engine/simulator';

/**
 * Custom hook that ties the React UI to the engine service.
 * Provides processImage and runDiagnostics functions.
 */
export function useEngine() {
  const [isInitialized, setIsInitialized] = useState(false);
  const store = useProjectStore();

  /** Initialize the engine service (lazy, called once). */
  const initialize = useCallback(async () => {
    if (!isInitialized) {
      await engineService.initialize();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  /** Load a palette and run the full processing pipeline. */
  const processImage = useCallback(async () => {
    const state = useProjectStore.getState();
    if (!state.imageLoaded || !state.imageFile) {
      store.setError('请先上传图片');
      return;
    }

    store.setTaskMessage('正在准备图片...');
    await new Promise(r => setTimeout(r, 40));
    await initialize();
    store.setProcessing(true);
    store.setError(null);
    store.setTaskMessage('正在生成图纸，请稍候...');
    trackEvent('process_started', {
      gridWidth: state.gridWidth,
      gridHeight: state.gridHeight,
      palette: state.selectedPaletteId,
      dither: state.ditherMode,
    });

    try {
      // Load palette
      const palette: Palette = await engineService.loadPalette(state.selectedPaletteId);

      // Build options with quality enhancements
      const options: ProcessOptions = {
        gridWidth: state.gridWidth,
        gridHeight: state.gridHeight,
        ditherMode: state.ditherMode,
        brightness: state.brightness,
        contrast: state.contrast,
        blurSigma: state.blurSigma,
        cropX: state.cropX,
        cropY: state.cropY,
        cropW: state.cropW,
        cropH: state.cropH,
        edgeEnhance: state.edgeEnhance ?? 0.8,     // Default: moderate edge sharpening
        autoContrastEnabled: state.autoContrast ?? true,  // Default: ON
        removeBackground: state.removeBackground,
        mergeSimilarColors: state.mergeSimilarColors,
        segmentationParams: state.segmentationParams,
      };

      // Run pipeline
      const result = await engineService.processImage(state.imageFile, palette, options);

      // Update store
      store.setPalette({
        brand: palette.brand,
        colors: palette.colors.map(c => ({
          name: c.name,
          code: c.code,
          hex: c.hex,
        })),
      });
      store.setBeadGrid({
        gridWidth: result.gridWidth,
        gridHeight: result.gridHeight,
        paletteBrand: result.paletteBrand,
        indices: result.indices,
        colorCounts: result.colorCounts,
      });
      recordCurrentProject();
      trackEvent('project_generated', {
        gridWidth: result.gridWidth,
        gridHeight: result.gridHeight,
        usedColors: Array.from(result.colorCounts).filter((v) => v > 0).length,
        palette: palette.brand,
        dither: options.ditherMode,
      });
    } catch (err: any) {
      store.setError(err.message || '处理失败');
      trackEvent('process_failed', { error: err.message || 'unknown' });
    } finally {
      store.setProcessing(false);
      store.setTaskMessage(null);
    }
  }, [store, initialize]);

  /** Run diagnostics via the engine service. */
  const runDiagnostics = useCallback(async (): Promise<DiagnoseResult[]> => {
    await initialize();
    return engineService.runDiagnostics();
  }, [initialize]);

  return {
    isInitialized,
    isProcessing: store.isProcessing,
    processImage,
    runDiagnostics,
    initialize,
    isWasm: engineService.isWasm,
  };
}
