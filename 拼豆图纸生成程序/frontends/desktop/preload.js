// Perler Bead Engine — Electron Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveFile: (data, defaultName, filters) =>
    ipcRenderer.invoke('save-file', { data, defaultName, filters }),

  // 保存图纸：弹窗选择位置，默认定位到程序目录「图纸试验区」
  saveToFolder: (data, filename) =>
    ipcRenderer.invoke('save-to-folder', { data, filename }),

  // 当天序列号
  nextSeq: (dateStr) => ipcRenderer.invoke('next-seq', dateStr),

  // 内置调色板（白名单读取，替代 file:// fetch）
  loadPalette: (id) => ipcRenderer.invoke('read-palette', id),

  // 打开问卷/反馈等外部网页
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 本地 AI 抠图
  segmentImage: (payload) => ipcRenderer.invoke('segment-image', payload),

  // Platform info
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Print
  printPDF: () => ipcRenderer.invoke('print-preview'),

  // Event listeners (main → renderer)
  onFileOpened: (callback) =>
    ipcRenderer.on('file-opened', (event, fileInfo) => callback(fileInfo)),

  onMenuExport: (callback) =>
    ipcRenderer.on('menu-export', (event, format) => callback(format)),

  removeAllListeners: (channel) =>
    ipcRenderer.removeAllListeners(channel),
});
