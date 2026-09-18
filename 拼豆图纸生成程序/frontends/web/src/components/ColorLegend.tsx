import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';

const ColorLegend: React.FC = () => {
  const { beadGrid, palette, highlightColorIndex, setHighlightColor } = useProjectStore();
  const [query, setQuery] = useState('');

  const usedColors = useMemo(() => {
    if (!beadGrid || !palette) return [];
    return palette.colors
      .map((color, idx) => ({
        ...color,
        idx,
        count: beadGrid.colorCounts?.[idx] ?? 0,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => {
        // Sort by code number (e.g. "H01" < "H03" < "H17")
        const na = parseInt((a.code || '0').replace(/\D/g, '')) || 0;
        const nb = parseInt((b.code || '0').replace(/\D/g, '')) || 0;
        return na - nb || a.code.localeCompare(b.code);
      });
  }, [beadGrid, palette]);

  const totalBeads = useMemo(
    () => usedColors.reduce((sum, color) => sum + color.count, 0),
    [usedColors]
  );

  const filteredColors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usedColors;
    return usedColors.filter(
      (color) =>
        color.name.toLowerCase().includes(q) ||
        color.code.toLowerCase().includes(q)
    );
  }, [usedColors, query]);

  if (!beadGrid || !palette) return null;

  const toggleHighlight = (idx: number) => {
    setHighlightColor(highlightColorIndex === idx ? null : idx);
  };

  return (
    <div className="color-legend">
      <div className="legend-header">
        <h3>颜色图例 ({usedColors.length}/{palette.colors.length})</h3>
        {highlightColorIndex !== null && (
          <button
            className="legend-clear"
            onClick={() => setHighlightColor(null)}
            title="取消高亮"
          >
            ✕ 取消高亮
          </button>
        )}
      </div>
      <p className="legend-hint">共 {totalBeads} 颗珠子，点击色块可在图纸中高亮该颜色</p>
      {usedColors.length > 6 && (
        <input
          className="legend-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索色号或颜色名"
          aria-label="搜索色号或颜色名"
        />
      )}
      <div className="legend-list">
        {filteredColors.map((color) => (
          <div
            key={color.idx}
            className={`legend-item ${highlightColorIndex === color.idx ? 'highlighted' : ''}`}
            onClick={() => toggleHighlight(color.idx)}
            title={`点击高亮 ${color.code} ${color.name}`}
          >
            <span
              className="legend-swatch"
              style={{ backgroundColor: color.hex }}
            />
            <span className="legend-name">{color.name}</span>
            <span className="legend-code">{color.code}</span>
            <span className="legend-count">{color.count}</span>
          </div>
        ))}
        {filteredColors.length === 0 && (
          <p className="empty-hint">{query ? '没有匹配的颜色' : '暂无使用的颜色'}</p>
        )}
      </div>
    </div>
  );
};

export default ColorLegend;
