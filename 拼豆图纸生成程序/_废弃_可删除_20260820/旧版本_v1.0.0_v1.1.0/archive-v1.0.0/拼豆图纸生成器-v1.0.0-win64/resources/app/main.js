// Perler Bead Engine — Electron Main Process
const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '拼豆图纸生成器',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 允许 file:// 页面用 fetch 读取本地调色板 JSON（离线桌面应用）
      webSecurity: false,
    },
  });

  // Load the web app
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

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
              message: '拼豆图纸生成器 v1.0.0',
              detail: '跨平台拼豆图纸生成系统\nC++17引擎 + React + Electron',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

// 图纸输出目录：打包后写到「文档/图纸试验区」（用户可写），开发模式写到项目目录
function blueprintDir() {
  return app.isPackaged
    ? path.join(app.getPath('documents'), '图纸试验区')
    : path.join(__dirname, '..', '..', '图纸试验区');
}

// Save blueprint directly to the 图纸试验区 folder (no dialog)
ipcMain.handle('save-to-folder', async (event, { data, filename }) => {
  const dir = blueprintDir();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const buffer = Buffer.from(data);
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: String((err && err.message) || err) };
  }
});

// 计算本周期（当天）下一个图纸序列号
ipcMain.handle('next-seq', async (event, dateStr) => {
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

// Get platform info
ipcMain.handle('get-platform', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
  };
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
