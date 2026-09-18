import React from 'react';
import { useProjectStore } from '../stores/projectStore';

const MODES = [
  { value: 0, label: '无抖动', desc: '直接最近邻匹配' },
  { value: 1, label: 'Floyd-Steinberg', desc: '误差扩散，过渡自然' },
  { value: 2, label: 'Bayer 8×8', desc: '有序抖动，图案感强' },
];

const DitherSelector: React.FC = () => {
  const { ditherMode, setDitherMode } = useProjectStore();

  return (
    <div className="panel dither-selector">
      <h3>抖动模式</h3>
      <div className="radio-group">
        {MODES.map((m) => (
          <label key={m.value} className="radio-item">
            <input
              type="radio"
              name="dither"
              value={m.value}
              checked={ditherMode === m.value}
              onChange={() => setDitherMode(m.value)}
            />
            <span>
              <strong>{m.label}</strong>
              <small>{m.desc}</small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default DitherSelector;
