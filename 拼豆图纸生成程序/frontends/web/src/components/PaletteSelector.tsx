import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore, PaletteInfo } from '../stores/projectStore';
import { useEngine } from '../hooks/useEngine';

interface PaletteMeta {
  brand: string;
  colorCount: number;
}

/**
 * 色卡选项卡：用户切换色卡后，如果之前已经处理过图像，则自动用新色卡重处理，
 * 避免用户每次切换都要重新点"开始处理"。
 */
const PaletteSelector: React.FC = () => {
  const { selectedPaletteId, palette, availablePalettes, setPaletteId, setPalette } =
    useProjectStore();
  const { processImage, isProcessing } = useEngine();
  const isInitialLoad = useRef(true);
  const [metaById, setMetaById] = useState<Record<string, PaletteMeta>>({});

  // 加载某个色卡的 JSON，并（条件性）触发重处理
  const loadPalette = useCallback(async (id: string, shouldReprocess: boolean) => {
    try {
      const api = (window as any).electronAPI;
      let data: any;
      if (api && typeof api.loadPalette === 'function') {
        const text = await api.loadPalette(id);
        if (!text) return;
        data = JSON.parse(text);
      } else {
        const resp = await fetch(`./palettes/${id}.json`);
        if (!resp.ok) return;
        data = await resp.json();
      }
      const pal: PaletteInfo = {
        brand: data.brand,
        colors: data.colors.map((c: any) => ({
          name: c.name,
          code: c.code,
          hex: c.hex,
        })),
      };
      setPalette(pal);
      setPaletteId(id);
      setMetaById((prev) => ({
        ...prev,
        [id]: { brand: data.brand, colorCount: data.colors.length },
      }));

      // 非初次切换 + 已处理过 → 用新色卡自动重处理
      if (shouldReprocess) {
        const s = useProjectStore.getState();
        if (s.imageLoaded && s.beadGrid && !isProcessing) {
          await processImage();
        }
      }
    } catch (err) {
      console.error('Failed to load palette:', err);
    }
  }, [setPalette, setPaletteId, processImage, isProcessing]);

  // 切换色卡
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      loadPalette(selectedPaletteId, false); // 初次不触发重处理
    } else {
      loadPalette(selectedPaletteId, true); // 后续切换触发
    }
  }, [selectedPaletteId, loadPalette]);

  return (
    <div className="panel palette-selector">
      <h3>色卡</h3>
      <div className="palette-tabs">
        {availablePalettes.map((id) => {
          const meta = metaById[id];
          const isActive = id === selectedPaletteId;
          return (
            <button
              key={id}
              type="button"
              className={`palette-tab ${isActive ? 'active' : ''}`}
              onClick={() => setPaletteId(id)}
              disabled={isProcessing}
              title={meta ? `${meta.brand} — ${meta.colorCount} 色` : id}
            >
              <span className="palette-tab-name">{id}</span>
              {meta && (
                <span className="palette-tab-count">{meta.colorCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {palette && (
        <div className="palette-info">
          <p className="palette-brand">{palette.brand}</p>
          <div className="palette-swatches">
            {palette.colors.slice(0, 12).map((c, i) => (
              <span
                key={i}
                className="swatch"
                style={{ backgroundColor: c.hex }}
                title={`${c.code} ${c.name}`}
              />
            ))}
            {palette.colors.length > 12 && (
              <span className="swatch-more">+{palette.colors.length - 12}</span>
            )}
          </div>
          {isProcessing && (
            <p className="palette-reprocessing">⏳ 用新色卡重新处理中...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PaletteSelector;