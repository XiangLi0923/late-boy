// Perler Bead Engine — Electron Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveFile: (data, defaultName, filters) =>
    ipcRenderer.invoke('save-file', { data, defaultName, filters }),

  // 直接保存到「图纸试验区」文件夹（无弹窗）
  saveToFolder: (data, filename) =>
    ipcRenderer.invoke('save-to-folder', { data, filename }),

  // 当天序列号
  nextSeq: (dateStr) => ipcRenderer.invoke('next-seq', dateStr),

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
