const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer, stopServer } = require('./server');
const killPort = require('kill-port');
const TOML = require('@iarna/toml')

const isDev = process.env.NODE_ENV === 'development';
const port = process.env.PORT || 5173;
const serverPort = 3000;

let mainWindow = null;
let isQuitting = false;

// 处理保存地图请求
ipcMain.handle('save-map', async (event, mapConfig) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '保存地图',
      defaultPath: path.join(app.getPath('documents'), 'maze-map.toml'),
      filters: [
        { name: 'TOML 文件', extensions: ['toml'] }
      ]
    });

    if (filePath) {
      // 将地图配置转换为 TOML 格式
      const tomlContent = TOML.stringify(mapConfig)
      fs.writeFileSync(filePath, tomlContent, 'utf-8');
      return { success: true };
    }
    return { success: false, message: '未选择保存位置' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 处理加载地图请求
ipcMain.handle('load-map', async (event) => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '加载地图',
      defaultPath: app.getPath('documents'),
      filters: [
        { name: 'TOML 文件', extensions: ['toml'] }
      ],
      properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      // 解析 TOML 内容
      const config = TOML.parse(content);
      return { 
        success: true, 
        data: {
          ...config,
          maze: config.maze.map(row => row.map(cell => ({ walkable: !!cell })))
        }
      };
    }
    return { success: false, message: '未选择文件' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

async function cleanup() {
  if (isQuitting) return;
  isQuitting = true;
  
  console.log('开始清理...');
  
  // 停止服务器
  stopServer();
  
  // 在开发环境中关闭 Vite 服务器和 Express 服务器
  if (isDev) {
    try {
      await killPort(port);
      await killPort(serverPort);
      console.log('所有服务器已关闭');
    } catch (err) {
      console.error('关闭服务器失败:', err);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false  // 开发环境允许加载本地文件
    }
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // 监听窗口关闭事件
  mainWindow.on('closed', async () => {
    mainWindow = null;
    await cleanup();
    app.quit();
  });

  startServer(mainWindow);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口都被关闭时退出应用
app.on('window-all-closed', async function () {
  await cleanup();
  app.quit();
});

// 在应用退出前清理
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    await cleanup();
    app.quit();
  }
}); 