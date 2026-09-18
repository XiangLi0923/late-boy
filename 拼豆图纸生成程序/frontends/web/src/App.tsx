import React, { useCallback, useEffect, useRef, useState } from 'react';
import ImageUploader from './components/ImageUploader';
import PreprocessingPanel from './components/PreprocessingPanel';
import SegmentationPanel from './components/SegmentationPanel';
import GridSizeSelector from './components/GridSizeSelector';
import PaletteSelector from './components/PaletteSelector';
import DitherSelector from './components/DitherSelector';
import PixelGrid from './components/PixelGrid';
import ColorLegend from './components/ColorLegend';
import ExportPanel from './components/ExportPanel';
import QRShareButton from './components/QRShareButton';
import ProjectHistoryPanel from './components/ProjectHistoryPanel';
import FeedbackModal from './components/FeedbackModal';
import StatusBar from './components/StatusBar';
import WeChatGuard from './components/WeChatGuard';
import TaskOverlay from './components/TaskOverlay';
import { useProjectStore } from './stores/projectStore';
import { useEngine } from './hooks/useEngine';
import { useElectronBridge } from './hooks/useElectronBridge';
import {
  applyProjectToStore,
  applyShareCodeToStore,
  extractShareCodeFromLocation,
  normalizeProjectJSON,
} from './engine/projectIO';
import { recordCurrentProject } from './engine/historyService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'edit' | 'export' | 'history'>('edit');
  const store = useProjectStore();
  const { imageLoaded, beadGrid, isProcessing, palette, gridWidth, gridHeight } = store;
  const importInputRef = useRef<HTMLInputElement>(null);
  const { processImage } = useEngine();
  useElectronBridge();

  const usedColorCount = beadGrid?.colorCounts
    ? Array.from(beadGrid.colorCounts).filter((count) => count > 0).length
    : 0;

  useEffect(() => {
    const code = extractShareCodeFromLocation();
    if (!code) return;
    if (!applyShareCodeToStore(code)) {
      useProjectStore.getState().setError('分享链接无效或已损坏');
    } else {
      recordCurrentProject();
      setActiveTab('export');
    }
  }, []);

  const handleImportProject = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const project = normalizeProjectJSON(JSON.parse(text));
      if (!project) throw new Error('unsupported project format');
      applyProjectToStore(project);
      recordCurrentProject();
      setActiveTab('edit');
    } catch {
      useProjectStore.getState().setError('导入失败：文件不是有效的图纸 JSON');
    }
  }, []);

  const handleImportChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImportProject(file);
    e.target.value = '';
  }, [handleImportProject]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">豆</span>
          <div className="brand-text">
            <h1>阿莉的图</h1>
            <p>图片转拼豆图纸</p>
          </div>
        </div>
        <nav className="tab-nav" aria-label="工作区">
          <button
            className={activeTab === 'edit' ? 'active' : ''}
            onClick={() => setActiveTab('edit')}
            aria-current={activeTab === 'edit' ? 'page' : undefined}
          >
            编辑
          </button>
          <button
            className={activeTab === 'export' ? 'active' : ''}
            onClick={() => setActiveTab('export')}
            disabled={!beadGrid}
            aria-current={activeTab === 'export' ? 'page' : undefined}
          >
            导出
          </button>
          <button
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
            aria-current={activeTab === 'history' ? 'page' : undefined}
          >
            历史
          </button>
        </nav>
        <div className="header-actions">
          <FeedbackModal />
          <button className="btn btn-small" onClick={() => importInputRef.current?.click()}>
            导入项目
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportChange}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {activeTab === 'edit' && (
          <div className="edit-layout">
            {/* Left: Controls */}
            <aside className="controls-panel">
              <ImageUploader />
              {imageLoaded && (
                <>
                  <PreprocessingPanel />
                  <SegmentationPanel />
                  <GridSizeSelector />
                  <PaletteSelector />
                  <DitherSelector />
                  <div className="process-section">
                    <button
                      className="btn btn-primary btn-process"
                      onClick={processImage}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '⏳ 处理中...' : '🔨 开始处理'}
                    </button>
                    {isProcessing && (
                      <p className="process-hint">正在量化图片，请稍候...</p>
                    )}
                  </div>
                </>
              )}
            </aside>

            {/* Center: Preview */}
            <section className="preview-area">
              {beadGrid ? (
                <div className="preview-stage">
                  <div className="preview-toolbar">
                    <div className="preview-meta">
                      <span className="meta-chip">{gridWidth} × {gridHeight}</span>
                      <span className="meta-chip">{usedColorCount} 色</span>
                      {palette && <span className="meta-chip meta-palette">{palette.brand}</span>}
                    </div>
                    <button
                      className="btn btn-small"
                      onClick={() => setActiveTab('export')}
                    >
                      去导出
                    </button>
                  </div>
                  <PixelGrid />
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-mark" aria-hidden="true">豆</span>
                  <p>{imageLoaded ? '图片已就绪' : '拖入图片，开始制作拼豆图纸'}</p>
                  <p className="hint">
                    {imageLoaded
                      ? '调整左侧参数后点击“开始处理”'
                      : '支持 PNG、JPG、BMP，也可 Ctrl+V 粘贴'}
                  </p>
                </div>
              )}
            </section>

            {/* Right: Legend */}
            {beadGrid && (
              <aside className="legend-panel">
                <ColorLegend />
              </aside>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div className="export-layout">
            <ExportPanel />
            <QRShareButton />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-layout">
            <ProjectHistoryPanel onOpen={() => setActiveTab('edit')} />
          </div>
        )}
      </main>

      {/* Footer */}
      <StatusBar />

      {/* 微信环境引导层（检测到微信时弹出「用浏览器打开」指引） */}
      <WeChatGuard />

      {/* 生成/导出进行中的全局等待层 */}
      <TaskOverlay />
    </div>
  );
};

export default App;
