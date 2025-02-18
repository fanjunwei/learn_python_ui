const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startServer, stopServer } = require('./server');
const killPort = require('kill-port');

const isDev = process.env.NODE_ENV === 'development';
const port = process.env.PORT || 5173;
const serverPort = 3000;

let mainWindow = null;
let isQuitting = false;

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
    mainWindow.webContents.openDevTools();
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