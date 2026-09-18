import React, { useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';

const PreprocessingPanel: React.FC = () => {
  const {
    brightness, contrast, blurSigma, edgeEnhance, autoContrast, mergeSimilarColors,
    setBrightness, setContrast, setBlurSigma, setEdgeEnhance, setAutoContrast,
    setMergeSimilarColors,
  } = useProjectStore();

  // Handlers optimized with useCallback to avoid re-renders on each keystroke
  const handleBrightness = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBrightness(parseFloat(e.target.value));
  }, [setBrightness]);

  const handleContrast = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setContrast(parseFloat(e.target.value));
  }, [setContrast]);

  const handleBlur = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBlurSigma(parseFloat(e.target.value));
  }, [setBlurSigma]);

  const handleEdgeEnhance = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEdgeEnhance(parseFloat(e.target.value));
  }, [setEdgeEnhance]);

  return (
    <div className="panel preprocessing-panel">
      <h3>图像调整</h3>

      <label>
        <span>亮度: {brightness.toFixed(2)}</span>
        <input type="range" min="-1" max="1" step="0.01" value={brightness} onChange={handleBrightness} />
      </label>

      <label>
        <span>对比度: {contrast.toFixed(2)}</span>
        <input type="range" min="0" max="3" step="0.01" value={contrast} onChange={handleContrast} />
      </label>

      <label>
        <span>高斯模糊: {blurSigma.toFixed(1)}</span>
        <input type="range" min="0" max="10" step="0.1" value={blurSigma} onChange={handleBlur} />
      </label>

      <label>
        <span>边缘增强: {edgeEnhance.toFixed(1)}</span>
        <input type="range" min="0" max="2" step="0.1" value={edgeEnhance} onChange={handleEdgeEnhance} />
        <small style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '-4px' }}>
          提高珠子图案的细节清晰度
        </small>
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={autoContrast}
          onChange={(e) => setAutoContrast(e.target.checked)}
        />
        <span>自动对比度优化</span>
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={mergeSimilarColors}
          onChange={(e) => setMergeSimilarColors(e.target.checked)}
        />
        <span>相似色替换（减少用色）</span>
      </label>
    </div>
  );
};

export default PreprocessingPanel;
