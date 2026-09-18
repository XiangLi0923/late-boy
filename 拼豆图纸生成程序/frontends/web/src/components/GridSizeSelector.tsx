import React, { useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';

const PRESETS = [
  { label: '29×29 (小方板)', w: 29, h: 29 },
  { label: '50×50 (中方板)', w: 50, h: 50 },
  { label: '58×58 (大方板)', w: 58, h: 58 },
  { label: '100×100', w: 100, h: 100 },
];

const GridSizeSelector: React.FC = () => {
  const { gridWidth, gridHeight, setGridSize } = useProjectStore();

  const handleW = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGridSize(parseInt(e.target.value) || 1, gridHeight);
  }, [gridHeight, setGridSize]);

  const handleH = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGridSize(gridWidth, parseInt(e.target.value) || 1);
  }, [gridWidth, setGridSize]);

  return (
    <div className="panel grid-size-selector">
      <h3>拼豆板尺寸</h3>

      <div className="grid-inputs">
        <label>
          宽
          <input type="number" min="1" max="200" value={gridWidth} onChange={handleW} />
        </label>
        <span className="times">×</span>
        <label>
          高
          <input type="number" min="1" max="200" value={gridHeight} onChange={handleH} />
        </label>
      </div>

      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`btn btn-preset ${gridWidth === p.w && gridHeight === p.h ? 'active' : ''}`}
            onClick={() => setGridSize(p.w, p.h)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GridSizeSelector;
