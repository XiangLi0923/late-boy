import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { saveAs } from 'file-saver';
import { trackEvent } from '../engine/analyticsService';
import { openSurveyOnce } from '../engine/surveyService';
import { isWeChat, openWeChatGuard } from '../engine/wechatEnv';
import { renderBlueprintAsync } from '../engine/exportRenderer';
import type { PaletteColor, RenderTask } from '../engine/blueprintRenderer';

// ============================================================================
// Canvas rendering — matches CLI export format
// ============================================================================

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// ============================================================================
// Component
// ============================================================================

/** 保存 Blob：Electron 下弹窗选择位置（默认程序目录「图纸试验区」），浏览器下走下载 */
async function saveBlueprint(blob: Blob, filename: string): Promise<string | null> {
  // 微信内置浏览器无法下载文件：弹出「用浏览器打开」引导层，中止本次导出
  if (isWeChat()) {
    openWeChatGuard('export');
    trackEvent('export_blocked_in_wechat', { filename });
    return null;
  }
  const api = (window as any).electronAPI;
  if (api && typeof api.saveToFolder === 'function') {
    const arrayBuffer = await blob.arrayBuffer();
    const res = await api.saveToFolder(arrayBuffer, filename);
    if (res?.canceled) return null; // 用户取消弹窗，静默返回
    if (!res || !res.success) throw new Error(res?.error || '保存失败');
    return res.path as string;
  }
  saveAs(blob, filename);
  return filename;
}

/** 生成图纸文件名：日期_主色内容_序列号_主图/副图.png */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** 用色最多的前 2 个颜色名，作为图纸「大概内容元素」的描述 */
function dominantContent(colors: PaletteColor[], counts: Int32Array): string {
  const top = colors
    .map((c, i) => ({ name: c.name || c.code, count: counts[i] || 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(c => c.name);
  return top.join('') || '拼豆';
}

/** 本周期（当天）序列号：Electron 下扫描「图纸试验区」，浏览器下降级为 001 */
async function nextSeq(dateStr: string): Promise<string> {
  const api = (window as any).electronAPI;
  if (api && typeof api.nextSeq === 'function') {
    try { return await api.nextSeq(dateStr); } catch { /* fall through */ }
  }
  return '001';
}

/** 生成主图/副图文件名 */
async function buildBlueprintNames(
  colors: PaletteColor[], counts: Int32Array
): Promise<{ main: string; sub: string }> {
  const dateStr = formatDate(new Date());
  const content = dominantContent(colors, counts);
  const seq = await nextSeq(dateStr);
  return {
    main: `${dateStr}_${content}_${seq}_主图.png`,
    sub: `${dateStr}_${content}_${seq}_副图.png`,
  };
}

/** 水平镜像 indices（烫豆面预览），数据不修改，返回新数组 */
function mirrorIndices(indices: Int32Array, gw: number): Int32Array {
  const gh = indices.length / gw;
  const out = new Int32Array(indices.length);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      out[y * gw + x] = indices[y * gw + (gw - 1 - x)];
    }
  }
  return out;
}

const ExportPanel: React.FC = () => {
  const { beadGrid, palette, gridWidth, gridHeight, mirrored } = useProjectStore();
  const setTaskMessage = useProjectStore((s) => s.setTaskMessage);
  const [exporting, setExporting] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // 导出时应用镜像（若有）
  const effectiveIndices = useMemo(
    () => (beadGrid && mirrored ? mirrorIndices(beadGrid.indices, gridWidth) : beadGrid?.indices ?? null),
    [beadGrid, mirrored, gridWidth]
  );

  const taskBase = useMemo<Omit<RenderTask, 'format' | 'beadSize'> | null>(() => {
    if (!beadGrid || !palette || !effectiveIndices) return null;
    return {
      gw: gridWidth,
      gh: gridHeight,
      indices: effectiveIndices,
      colors: palette.colors,
      counts: beadGrid.colorCounts || new Int32Array(palette.colors.length),
      paletteBrand: palette.brand,
    };
  }, [beadGrid, palette, gridWidth, gridHeight, effectiveIndices]);

  /** Export both main + sub */
  const exportBoth = useCallback(async () => {
    if (!beadGrid || !palette || !taskBase) return;
    setExporting('both');
    setTaskMessage('正在导出主图和副图，请稍候...');
    await new Promise(r => setTimeout(r, 50));

    try {
      const [mainBlob, subBlob] = await Promise.all([
        renderBlueprintAsync({ ...taskBase, format: 'main', beadSize: 26 }),
        renderBlueprintAsync({ ...taskBase, format: 'sub', beadSize: 26 }),
      ]);
      const names = await buildBlueprintNames(taskBase.colors, taskBase.counts);
      const savedPaths = await Promise.all([
        saveBlueprint(mainBlob, names.main),
        saveBlueprint(subBlob, names.sub),
      ]);
      const shown = savedPaths.filter((p): p is string => !!p);
      if (shown.length) {
        setLastSaved(shown.join('  |  '));
        trackEvent('export', { format: 'png', mode: 'both', gridWidth, gridHeight });
        openSurveyOnce();
      }
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setTaskMessage(null);
      setExporting(null);
    }
  }, [beadGrid, palette, taskBase, setTaskMessage, gridWidth, gridHeight]);

  /** Export main only */
  const exportMain = useCallback(async () => {
    if (!beadGrid || !palette || !taskBase) return;
    setExporting('main');
    setTaskMessage('正在导出主图，请稍候...');
    await new Promise(r => setTimeout(r, 50));
    try {
      const blob = await renderBlueprintAsync({ ...taskBase, format: 'main', beadSize: 26 });
      const names = await buildBlueprintNames(taskBase.colors, taskBase.counts);
      const path = await saveBlueprint(blob, names.main);
      if (path) {
        setLastSaved(path);
        trackEvent('export', { format: 'png', mode: 'main', gridWidth, gridHeight });
        openSurveyOnce();
      }
    } catch (e) { console.error(e); }
    finally {
      setTaskMessage(null);
      setExporting(null);
    }
  }, [beadGrid, palette, taskBase, setTaskMessage, gridWidth, gridHeight]);

  /** Export sub only */
  const exportSub = useCallback(async () => {
    if (!beadGrid || !palette || !taskBase) return;
    setExporting('sub');
    setTaskMessage('正在导出副图，请稍候...');
    await new Promise(r => setTimeout(r, 50));
    try {
      const blob = await renderBlueprintAsync({ ...taskBase, format: 'sub', beadSize: 26 });
      const names = await buildBlueprintNames(taskBase.colors, taskBase.counts);
      const path = await saveBlueprint(blob, names.sub);
      if (path) {
        setLastSaved(path);
        trackEvent('export', { format: 'png', mode: 'sub', gridWidth, gridHeight });
        openSurveyOnce();
      }
    } catch (e) { console.error(e); }
    finally {
      setTaskMessage(null);
      setExporting(null);
    }
  }, [beadGrid, palette, taskBase, setTaskMessage, gridWidth, gridHeight]);

  /** Export main blueprint as PDF */
  const exportPDF = useCallback(async () => {
    if (!beadGrid || !palette || !taskBase) return;
    setExporting('pdf');
    setTaskMessage('正在导出 PDF，请稍候...');
    await new Promise(r => setTimeout(r, 50));
    try {
      const blob = await renderBlueprintAsync({ ...taskBase, format: 'pdf', beadSize: 42 });
      const names = await buildBlueprintNames(taskBase.colors, taskBase.counts);
      const path = await saveBlueprint(blob, names.main.replace(/\.png$/, '.pdf'));
      if (path) {
        setLastSaved(path);
        trackEvent('export', { format: 'pdf', gridWidth, gridHeight });
        openSurveyOnce();
      }
    } catch (e) { console.error(e); }
    finally {
      setTaskMessage(null);
      setExporting(null);
    }
  }, [beadGrid, palette, taskBase, setTaskMessage, gridWidth, gridHeight]);

  // 响应 Electron 原生菜单「导出 PNG/PDF」
  useEffect(() => {
    const handler = (e: Event) => {
      const format = (e as CustomEvent).detail;
      if (format === 'pdf') void exportPDF();
      else void exportBoth();
    };
    window.addEventListener('bead-menu-export', handler);
    return () => window.removeEventListener('bead-menu-export', handler);
  }, [exportBoth, exportPDF]);

  const exportCSV = useCallback(async () => {
    if (!beadGrid || !palette) return;
    setExporting('csv');
    setTaskMessage('正在导出 CSV 数据...');
    await new Promise(r => setTimeout(r, 30));
    try {
      const lines: string[] = [];
      lines.push('width,height,palette');
      lines.push(`${beadGrid.gridWidth},${beadGrid.gridHeight},${csvCell(palette.brand)}`);
      lines.push('row,col,color_name,color_code,color_hex');
      for (let y = 0; y < beadGrid.gridHeight; y++) {
        for (let x = 0; x < beadGrid.gridWidth; x++) {
          const ci = effectiveIndices![y * beadGrid.gridWidth + x];
          const c = palette.colors[ci];
          lines.push(`${y},${x},${csvCell(c?.name || '?')},${csvCell(c?.code || '?')},${csvCell(c?.hex || '#000000')}`);
        }
      }
      lines.push('');
      lines.push('color_code,color_name,hex,count');
      const counts = beadGrid.colorCounts || new Int32Array(0);
      for (let i = 0; i < palette.colors.length; i++) {
        if (counts[i] > 0) {
          lines.push(`${csvCell(palette.colors[i].code)},${csvCell(palette.colors[i].name)},${csvCell(palette.colors[i].hex)},${counts[i]}`);
        }
      }
      const path = await saveBlueprint(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `bead-${gridWidth}x${gridHeight}.csv`);
      if (path) {
        setLastSaved(path);
        trackEvent('export', { format: 'csv', gridWidth, gridHeight });
        openSurveyOnce();
      }
    } catch (e) {
      console.error('CSV export failed:', e);
    } finally {
      setTaskMessage(null);
      setExporting(null);
    }
  }, [beadGrid, palette, gridWidth, gridHeight, effectiveIndices, setTaskMessage]);

  const exportJSON = useCallback(async () => {
    if (!beadGrid || !palette) return;
    setExporting('json');
    setTaskMessage('正在导出项目 JSON...');
    await new Promise(r => setTimeout(r, 30));
    try {
      const hex2rgb = (hex: string): [number, number, number] => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];

      const grid: number[][] = [];
      for (let y = 0; y < beadGrid.gridHeight; y++) {
        const row: number[] = [];
        for (let x = 0; x < beadGrid.gridWidth; x++) {
          row.push(effectiveIndices![y * beadGrid.gridWidth + x]);
        }
        grid.push(row);
      }

      const color_table = palette.colors.map((c, i) => ({
        idx: i,
        code: c.code,
        name: c.name,
        rgb: hex2rgb(c.hex),
      }));

      const project = {
        version: '1.0',
        width: beadGrid.gridWidth,
        height: beadGrid.gridHeight,
        grid,
        color_table,
        palette_brand: palette.brand,
        dither_mode: useProjectStore.getState().ditherMode,
      };
      const path = await saveBlueprint(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `bead-${gridWidth}x${gridHeight}.json`);
      if (path) {
        setLastSaved(path);
        trackEvent('export', { format: 'json', gridWidth, gridHeight });
        openSurveyOnce();
      }
    } catch (e) {
      console.error('JSON export failed:', e);
    } finally {
      setTaskMessage(null);
      setExporting(null);
    }
  }, [beadGrid, palette, gridWidth, gridHeight, effectiveIndices, setTaskMessage]);

  if (!beadGrid) return null;

  const totalBeads = beadGrid.gridWidth * beadGrid.gridHeight;
  const usedColors = beadGrid.colorCounts ? Array.from(beadGrid.colorCounts).filter(c => c > 0).length : 0;

  return (
    <div className="export-panel">
      <h2>导出图纸</h2>
      <p className="export-meta">
        {gridWidth}×{gridHeight} · {totalBeads} 颗珠子 · {usedColors} 种颜色 · {palette?.brand}
      </p>

      <div className="export-buttons">
        <button className="btn btn-primary" onClick={exportBoth} disabled={!!exporting}>
          {exporting === 'both' ? '⏳ 导出中...' : '📋 导出主图+副图'}
        </button>
        <button className="btn" onClick={exportMain} disabled={!!exporting}>
          {exporting === 'main' ? '⏳ ...' : '📐 仅主图'}
        </button>
        <button className="btn" onClick={exportSub} disabled={!!exporting}>
          {exporting === 'sub' ? '⏳ ...' : '🎨 仅副图'}
        </button>
      </div>

      <div className="export-buttons" style={{ marginTop: 8 }}>
        <button className="btn" onClick={exportPDF} disabled={!!exporting}>
          {exporting === 'pdf' ? '⏳ ...' : '📕 导出 PDF'}
        </button>
        <button className="btn" onClick={exportCSV} disabled={!!exporting}>
          {exporting === 'csv' ? '⏳ ...' : '📊 CSV 数据'}
        </button>
        <button className="btn" onClick={exportJSON} disabled={!!exporting}>
          {exporting === 'json' ? '⏳ ...' : '💾 项目 JSON'}
        </button>
      </div>

      <div className="export-info">
        <p><strong>主图</strong>（带标号）：白底 + 色号标注 + 行列坐标 + 底部颜色图例</p>
        <p><strong>副图</strong>（纯效果）：白底 + 网格线，简洁预览</p>
        <p><strong>PDF</strong>：主图转 PDF，适合直接打印或分享</p>
      </div>

      {lastSaved && (
        <p className="export-saved" style={{ marginTop: 8, color: '#2e7d32', fontSize: 12, wordBreak: 'break-all' }}>
          ✅ 已保存到：{lastSaved}
        </p>
      )}
    </div>
  );
};

export default ExportPanel;
