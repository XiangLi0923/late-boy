import React, { useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { colorLabel, drawBeadLabel } from '../engine/beadLabel';

const PixelGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { beadGrid, palette, gridWidth, gridHeight, mirrored, toggleMirror, highlightColorIndex } =
    useProjectStore();
  const [scale, setScale] = React.useState(1);
  const [offsetX, setOffsetX] = React.useState(0);
  const [offsetY, setOffsetY] = React.useState(0);
  const [showLabels, setShowLabels] = React.useState(true);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !beadGrid || !palette) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Calculate bead size
    const maxBeadW = rect.width / beadGrid.gridWidth;
    const maxBeadH = rect.height / beadGrid.gridHeight;
    const beadSize = Math.floor(Math.max(4, Math.min(maxBeadW, maxBeadH) * scale));

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const gridPixelW = beadGrid.gridWidth * beadSize;
    const gridPixelH = beadGrid.gridHeight * beadSize;
    const startX = (rect.width - gridPixelW) / 2 + offsetX;
    const startY = (rect.height - gridPixelH) / 2 + offsetY;

    // Light gray board background
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(startX - 2, startY - 2, gridPixelW + 4, gridPixelH + 4);

    const gap = Math.max(1, Math.floor(beadSize / 12));
    const hasHighlight = highlightColorIndex !== null;

    // Draw square beads
    for (let gy = 0; gy < beadGrid.gridHeight; gy++) {
      for (let gx = 0; gx < beadGrid.gridWidth; gx++) {
        const idx = gy * beadGrid.gridWidth + gx;
        const colorIdx = beadGrid.indices[idx];
        if (colorIdx < 0 || colorIdx >= palette.colors.length) continue;

        // 镜像：绘制列坐标水平翻转（数据不变）
        const drawX = mirrored ? beadGrid.gridWidth - 1 - gx : gx;
        const px = startX + drawX * beadSize;
        const py = startY + gy * beadSize;
        const hex = palette.colors[colorIdx].hex;

        // 色号高亮：非高亮色画成浅灰，便于"逐步拼"
        const dimmed = hasHighlight && colorIdx !== highlightColorIndex;
        ctx.fillStyle = dimmed ? '#e3e3e3' : hex;
        ctx.fillRect(px + gap, py + gap, beadSize - gap * 2, beadSize - gap * 2);

        // Label on bead (main view) — 高亮模式下仅高亮色显示标号
        if (showLabels && beadSize >= 14 && !dimmed) {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const label = colorLabel(palette.colors[colorIdx], colorIdx);
          drawBeadLabel(
            ctx,
            label,
            px + beadSize / 2,
            py + beadSize / 2,
            beadSize,
            lum > 140 ? '#000' : '#fff'
          );
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 0.5;
    for (let gy = 0; gy <= beadGrid.gridHeight; gy++) {
      const y = startY + gy * beadSize;
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(startX + gridPixelW, y); ctx.stroke();
    }
    for (let gx = 0; gx <= beadGrid.gridWidth; gx++) {
      const x = startX + gx * beadSize;
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, startY + gridPixelH); ctx.stroke();
    }
  }, [beadGrid, palette, scale, offsetX, offsetY, showLabels, mirrored, highlightColorIndex]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(0.08, Math.min(15, s - e.deltaY * 0.0008)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanning.current = true;
    panStart.current = { x: e.clientX - offsetX, y: e.clientY - offsetY };
  }, [offsetX, offsetY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setOffsetX(e.clientX - panStart.current.x);
    setOffsetY(e.clientY - panStart.current.y);
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  if (!beadGrid || !palette) {
    return (
      <div className="pixel-grid-empty">
        <p>调整参数后点击"开始处理"来生成拼豆图纸</p>
        <p className="hint">支持 PNG、JPG、BMP 格式</p>
      </div>
    );
  }

  return (
    <div className="pixel-grid-container">
      <canvas
        ref={canvasRef}
        className="pixel-grid-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="grid-controls">
        <button onClick={() => setScale(s => s * 1.25)} title="放大">+</button>
        <button onClick={() => setScale(s => s / 1.25)} title="缩小">-</button>
        <button onClick={() => { setScale(1); setOffsetX(0); setOffsetY(0); }} title="重置">重置</button>
        <button
          className={showLabels ? 'active' : ''}
          onClick={() => setShowLabels(!showLabels)}
          title={showLabels ? '隐藏色号' : '显示色号'}
          aria-label={showLabels ? '隐藏色号' : '显示色号'}
          aria-pressed={showLabels}
        >
          色号
        </button>
        <button
          className={mirrored ? 'active' : ''}
          onClick={toggleMirror}
          title={mirrored ? '取消镜像' : '水平镜像（预览烫豆后效果）'}
          aria-label="镜像"
          aria-pressed={mirrored}
        >
          镜像
        </button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
        <span className="grid-info">{beadGrid.gridWidth}×{beadGrid.gridHeight}</span>
      </div>
    </div>
  );
};

export default PixelGrid;
