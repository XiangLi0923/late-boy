import React from 'react';
import { useProjectStore } from '../stores/projectStore';

const SegmentationPanel: React.FC = () => {
  const {
    removeBackground,
    segmentationParams,
    setRemoveBackground,
    setSegmentationParams,
  } = useProjectStore();

  return (
    <div className="panel segmentation-panel">
      <h3>AI 抠图</h3>

      <label className="check-row">
        <input
          type="checkbox"
          checked={removeBackground}
          onChange={(e) => setRemoveBackground(e.target.checked)}
        />
        <span>启用主体分割</span>
      </label>

      {removeBackground && (
        <>
          <label>
            <span>前景置信阈值: {segmentationParams.foregroundConfidenceThreshold.toFixed(2)}</span>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.05"
              value={segmentationParams.foregroundConfidenceThreshold}
              onChange={(e) => setSegmentationParams({ foregroundConfidenceThreshold: parseFloat(e.target.value) })}
            />
          </label>

          <label>
            <span>边缘羽化半径: {segmentationParams.edgeFeatherRadius}</span>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={segmentationParams.edgeFeatherRadius}
              onChange={(e) => setSegmentationParams({ edgeFeatherRadius: parseInt(e.target.value, 10) })}
            />
          </label>

          <label>
            <span>蒙版膨胀/收缩: {segmentationParams.maskExpandOffset}</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={segmentationParams.maskExpandOffset}
              onChange={(e) => setSegmentationParams({ maskExpandOffset: parseInt(e.target.value, 10) })}
            />
          </label>
        </>
      )}
    </div>
  );
};

export default SegmentationPanel;
