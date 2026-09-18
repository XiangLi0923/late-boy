import React from 'react';
import { useProjectStore } from '../stores/projectStore';

const StatusBar: React.FC = () => {
  const { isProcessing, error, beadGrid, gridWidth, gridHeight, palette } = useProjectStore();

  return (
    <footer className="status-bar">
      <div className="status-left">
        {isProcessing && <span className="status-processing">⏳ 处理中...</span>}
        {error && <span className="status-error">❌ {error}</span>}
        {beadGrid && !isProcessing && (
          <span className="status-ok">
            ✓ 就绪 — {gridWidth}×{gridHeight} 网格
            {palette && ` — ${palette.brand}`}
          </span>
        )}
        {!beadGrid && !isProcessing && !error && (
          <span className="status-idle">等待输入图片</span>
        )}
      </div>
      <div className="status-right">
        <span>阿莉的图 v1.2.2</span>
      </div>
    </footer>
  );
};

export default StatusBar;
