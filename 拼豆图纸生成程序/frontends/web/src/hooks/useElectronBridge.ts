import { useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';

/**
 * 把 Electron 原生菜单（文件→打开图片 / 导出 PNG/PDF）接到 React 应用里。
 * 在普通浏览器（无 window.electronAPI）下自动跳过。
 */

interface ElectronFileInfo {
  name: string;
  data: ArrayBuffer;
}

interface ElectronAPI {
  onFileOpened: (cb: (info: ElectronFileInfo) => void) => void;
  onMenuExport: (cb: (format: string) => void) => void;
  removeAllListeners: (channel: string) => void;
  saveToFolder: (data: ArrayBuffer, filename: string) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
  nextSeq: (dateStr: string) => Promise<string>;
  loadPalette: (id: string) => Promise<string | null>;
  openExternal: (url: string) => Promise<boolean>;
  segmentImage?: (payload: any) => Promise<any>;
}

declare global {
  interface Window { electronAPI?: ElectronAPI; }
}

export function useElectronBridge() {
  const setImage = useProjectStore((s) => s.setImage);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // 原生菜单「打开图片」
    api.onFileOpened((info) => {
      const file = new File([info.data], info.name, { type: 'image/*' });
      const uint8Data = new Uint8Array(info.data);
      const img = new Image();
      img.onload = () => setImage(img, uint8Data, file);
      img.src = URL.createObjectURL(new Blob([info.data]));
    });

    // 原生菜单「导出 PNG/PDF」→ 转成自定义事件，由 ExportPanel 处理
    api.onMenuExport((format) => {
      window.dispatchEvent(new CustomEvent('bead-menu-export', { detail: format }));
    });

    return () => {
      api.removeAllListeners('file-opened');
      api.removeAllListeners('menu-export');
    };
  }, [setImage]);
}
