const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer, stopServer } = require('./server');
const TOML = require('@iarna/toml')
const fetch = require('node-fetch');

const isDev = process.env.NODE_ENV === 'development';
const port = process.env.PORT || 5173;
const serverPort = 3000;

let mainWindow = null;
let isQuitting = false;
let lastFilePath = null;

// 发送游戏操作请求
async function sendGameAction(action, actionType = '操作') {
  try {
    const response = await fetch('http://localhost:3000/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (!response.ok) {
      console.error(`${actionType}失败:`, response.statusText);
    }
  } catch (error) {
    console.error(`${actionType}失败:`, error);
  }
}

// 注册快捷键
function registerShortcuts() {
  // 向前移动
  globalShortcut.register('Up', () => sendGameAction('forward', '移动'));

  // 向左转
  globalShortcut.register('Left', () => sendGameAction('turnLeft', '转向'));

  // 向右转
  globalShortcut.register('Right', () => sendGameAction('turnRight', '转向'));

  // 收集红宝石
  globalShortcut.register('1', () => sendGameAction('collect_blue', '收集蓝宝石'));

  // 收集蓝宝石
  globalShortcut.register('2', () => sendGameAction('collect_red', '收集红宝石'));
}

// 注销快捷键
function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

// 处理保存地图请求
ipcMain.handle('save-map', async (event, mapConfig) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '保存地图',
      defaultPath: lastFilePath || path.join(app.getPath('documents'), 'maze-map.toml'),
      filters: [
        { name: 'TOML 文件', extensions: ['toml'] }
      ]
    });

    if (filePath) {
      lastFilePath = filePath;
      // 将地图配置转换为 TOML 格式
      const tomlContent = TOML.stringify(mapConfig)
      fs.writeFileSync(filePath, tomlContent, 'utf-8');
      return { success: true };
    }
    return { success: false, message: null };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 处理加载地图请求
ipcMain.handle('load-map', async (event) => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '加载地图',
      defaultPath: lastFilePath || app.getPath('documents'),
      filters: [
        { name: 'TOML 文件', extensions: ['toml'] }
      ],
      properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
      lastFilePath = filePaths[0];
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      console.log('读取的文件内容:', content);
      
      // 解析 TOML 内容
      const config = TOML.parse(content);
      console.log('解析后的配置:', config);

      // 验证配置数据的完整性
      if (!config.levels || !Array.isArray(config.levels)) {
        throw new Error('无效的地图配置：缺少层级数据');
      }

      // 确保每个层级都有必要的属性
      config.levels = config.levels.map(level => ({
        maze: Array.isArray(level.maze) ? level.maze : [],
        blueGems: Array.isArray(level.blueGems) ? level.blueGems : [],
        redGems: Array.isArray(level.redGems) ? level.redGems : [],
        monsters: Array.isArray(level.monsters) ? level.monsters : []
      }));

      // 确保其他必要的属性存在
      const processedConfig = {
        ...config,
        start: config.start || { x: 0, y: 0, level: 0 },
        exit: config.exit || null,
        teleportGates: Array.isArray(config.teleportGates) ? config.teleportGates : []
      };

      return { 
        success: true, 
        data: processedConfig
      };
    }
    return { success: false, message: null };
  } catch (error) {
    console.error('加载地图错误:', error);
    return { success: false, message: error.message };
  }
});

async function cleanup() {
  if (isQuitting) return;
  isQuitting = true;
  
  console.log('开始清理...');
  
  // 停止服务器
  stopServer();
  
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 1000,
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

  // 注册快捷键
  // registerShortcuts();

  // 监听窗口关闭事件
  mainWindow.on('closed', async () => {
    mainWindow = null;
    // 注销快捷键
    unregisterShortcuts();
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
  unregisterShortcuts();
  await cleanup();
  app.quit();
});

// 在应用退出前清理
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    unregisterShortcuts();
    await cleanup();
    app.quit();
  }
}); 