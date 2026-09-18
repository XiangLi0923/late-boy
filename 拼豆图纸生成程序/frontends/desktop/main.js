// Perler Bead Engine — Electron Main Process
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let segmentationAddon = null;

try {
  segmentationAddon = require('./native/build/Release/segmentation_addon.node');
} catch {
  segmentationAddon = null;
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '阿莉的图',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Load the web app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  // Keep the renderer from opening new windows or navigating to remote pages.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? url.startsWith('http://localhost:5173')
      : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  // Set up menu
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开图片',
          accelerator: 'CmdOrCtrl+O',
          click: () => openImageFile(),
        },
        { type: 'separator' },
        {
          label: '导出 PNG',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu-export', 'png'),
        },
        {
          label: '导出 PDF',
          click: () => mainWindow?.webContents.send('menu-export', 'pdf'),
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '开发者工具', role: 'toggleDevTools' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '阿莉的图 v1.2.2',
              detail: '跨平台拼豆图纸生成系统\nC++17引擎 + React + Electron',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function isTrustedFrame(frame) {
  if (!frame || !frame.url) return false;
  if (process.env.NODE_ENV === 'development') {
    return frame.url.startsWith('http://localhost:5173');
  }
  return frame.url.startsWith('file://');
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/;

function safeBlueprintFilename(filename) {
  if (typeof filename !== 'string') return null;
  if (!filename || filename.includes('/') || filename.includes('\\')) return null;
  if (filename.includes('..') || INVALID_FILENAME_CHARS.test(filename)) return null;
  return filename;
}

// Open image file via native dialog
async function openImageFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] },
    ],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    mainWindow?.webContents.send('file-opened', {
      name: path.basename(filePath),
      data: data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ),
    });
  }
}

// Save file via native dialog
ipcMain.handle('save-file', async (event, { data, defaultName, filters }) => {
  if (!isTrustedFrame(event.senderFrame)) return { success: false, error: '拒绝来自不可信页面的保存请求' };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存文件',
    defaultPath: defaultName || 'output.png',
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });

  if (!result.canceled && result.filePath) {
    const buffer = Buffer.from(data);
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// 程序自身文件夹：打包后为可执行文件所在目录，开发模式为桌面端目录
function appDir() {
  return app.isPackaged ? path.dirname(process.execPath) : __dirname;
}

// 图纸默认输出目录：程序自身文件夹里的「图纸试验区」
function blueprintDir() {
  return path.join(appDir(), '图纸试验区');
}

// 保存图纸：弹窗选择保存位置，默认定位到程序自身文件夹的「图纸试验区」
ipcMain.handle('save-to-folder', async (event, { data, filename }) => {
  if (!isTrustedFrame(event.senderFrame)) {
    return { success: false, error: '拒绝来自不可信页面的写入请求' };
  }
  const safeName = safeBlueprintFilename(filename);
  if (!safeName) return { success: false, error: '非法文件名' };

  const dir = blueprintDir();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { success: false, error: String((err && err.message) || err) };
  }

  // 根据扩展名选择保存过滤器
  const ext = path.extname(safeName).toLowerCase().replace('.', '');
  const filterMap = {
    png: { name: 'PNG 图片', extensions: ['png'] },
    pdf: { name: 'PDF 文档', extensions: ['pdf'] },
    csv: { name: 'CSV 数据', extensions: ['csv'] },
    json: { name: 'JSON 项目', extensions: ['json'] },
  };
  const filters = filterMap[ext]
    ? [filterMap[ext]]
    : [{ name: '所有文件', extensions: ['*'] }];

  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存图纸',
    defaultPath: path.join(dir, safeName),
    filters,
  });

  if (result.canceled || !result.filePath) return { success: false, canceled: true };

  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: String((err && err.message) || err) };
  }
});

// 计算本周期（当天）下一个图纸序列号
ipcMain.handle('next-seq', async (event, dateStr) => {
  if (!isTrustedFrame(event.senderFrame)) return '001';
  if (typeof dateStr !== 'string' || !/^\d{8}$/.test(dateStr)) return '001';

  const dir = blueprintDir();
  let max = 0;
  try {
    if (fs.existsSync(dir)) {
      const re = new RegExp('^' + dateStr + '_[^_]+_(\\d{3})_');
      for (const f of fs.readdirSync(dir)) {
        const m = f.match(re);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    }
  } catch (err) { /* ignore */ }
  return String(max + 1).padStart(3, '0');
});

// Read a built-in palette JSON (allowlisted) for the packaged desktop app.
ipcMain.handle('read-palette', async (event, id) => {
  if (!isTrustedFrame(event.senderFrame)) return null;
  const allowed = new Set(['mard_221', 'mard_all', 'universal_24', 'hama_midi', 'perler_standard']);
  if (!allowed.has(id)) return null;
  try {
    return fs.readFileSync(
      path.join(__dirname, 'renderer', 'palettes', `${id}.json`),
      'utf8'
    );
  } catch {
    return null;
  }
});

// Get platform info
ipcMain.handle('get-platform', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
  };
});

// 打开问卷/反馈等外部网页，只允许 http/https 链接。
ipcMain.handle('open-external', async (event, url) => {
  if (!isTrustedFrame(event.senderFrame)) return false;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  await shell.openExternal(url);
  return true;
});

// Local AI segmentation: route to the native addon when it has been built.
ipcMain.handle('segment-image', async (event, payload) => {
  if (!isTrustedFrame(event.senderFrame)) {
    return { error: '拒绝来自不可信页面的分割请求' };
  }
  if (!segmentationAddon) {
    return { error: 'AI 分割原生模块未安装，请在配置中切换为 WASM 模拟器' };
  }
  try {
    return segmentationAddon.segmentImage(payload);
  } catch (err) {
    return { error: (err && err.message) || 'AI 分割失败' };
  }
});

// Print
ipcMain.handle('print-preview', async () => {
  if (!mainWindow) return { success: false };
  try {
    const data = await mainWindow.webContents.printPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
