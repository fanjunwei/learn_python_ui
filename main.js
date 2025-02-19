const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer, stopServer } = require('./server');
const killPort = require('kill-port');

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
      const tomlContent = generateToml(mapConfig);
      fs.writeFileSync(filePath, tomlContent, 'utf-8');
      return { success: true };
    }
    return { success: false, message: '未选择保存位置' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 生成 TOML 格式的内容
function generateToml(config) {
  const lines = [
    `title = "${config.title}"`,
    '',
    '# 迷宫布局 (1: 可通过, 0: 墙壁)',
    'maze = [',
    ...config.maze.map(row => '  [' + row.join(', ') + '],'),
    ']',
    '',
    '# 起点坐标',
    `start = { x = ${config.start.x}, y = ${config.start.y} }`,
    '',
    '# 蓝宝石位置',
    'blueGems = [',
    ...config.blueGems.map(gem => `  { x = ${gem.x}, y = ${gem.y} },`),
    ']',
    '',
    '# 红宝石位置',
    'redGems = [',
    ...config.redGems.map(gem => `  { x = ${gem.x}, y = ${gem.y} },`),
    ']',
    '',
    '# 怪物位置',
    'monsters = [',
    ...config.monsters.map(monster => `  { x = ${monster.x}, y = ${monster.y} },`),
    ']',
    '',
    '# 终点坐标',
    `exit = { x = ${config.exit.x}, y = ${config.exit.y} }`,
    '',
    '# 所需宝石数量',
    `requiredBlueGems = ${config.requiredBlueGems}`,
    `requiredRedGems = ${config.requiredRedGems}`
  ];

  return lines.join('\n');
}

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
      // 将 0/1 数组转换为 walkable 对象数组
      const config = parseToml(content);
      return { 
        success: true, 
        data: {
          ...config,
          maze: config.maze.map(row => row.map(cell => ({ walkable: cell === 1 })))
        }
      };
    }
    return { success: false, message: '未选择文件' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 解析 TOML 格式的内容
function parseToml(content) {
  const lines = content.split('\n');
  const config = {
    title: '',
    maze: [],
    start: { x: 0, y: 0 },
    blueGems: [],
    redGems: [],
    monsters: [],
    exit: { x: 0, y: 0 },
    requiredBlueGems: 0,
    requiredRedGems: 0
  };

  let currentSection = '';
  let currentArray = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    if (trimmedLine.startsWith('title')) {
      config.title = trimmedLine.split('=')[1].trim().replace(/"/g, '');
    } else if (trimmedLine.startsWith('maze')) {
      currentSection = 'maze';
    } else if (trimmedLine.startsWith('start')) {
      const coords = trimmedLine.match(/x = (\d+), y = (\d+)/);
      if (coords) {
        config.start = { x: parseInt(coords[1]), y: parseInt(coords[2]) };
      }
    } else if (trimmedLine.startsWith('blueGems')) {
      currentSection = 'blueGems';
      currentArray = [];
    } else if (trimmedLine.startsWith('redGems')) {
      currentSection = 'redGems';
      currentArray = [];
    } else if (trimmedLine.startsWith('monsters')) {
      currentSection = 'monsters';
      currentArray = [];
    } else if (trimmedLine.startsWith('exit')) {
      const coords = trimmedLine.match(/x = (\d+), y = (\d+)/);
      if (coords) {
        config.exit = { x: parseInt(coords[1]), y: parseInt(coords[2]) };
      }
    } else if (trimmedLine.startsWith('requiredBlueGems')) {
      config.requiredBlueGems = parseInt(trimmedLine.split('=')[1]);
    } else if (trimmedLine.startsWith('requiredRedGems')) {
      config.requiredRedGems = parseInt(trimmedLine.split('=')[1]);
    } else if (trimmedLine.includes('[') && !trimmedLine.includes('=')) {
      const numbers = trimmedLine.replace(/[\[\],\s]/g, ' ').trim().split(/\s+/);
      if (currentSection === 'maze') {
        if (numbers.length > 0) {
          config.maze.push(numbers.map(n => parseInt(n)));
        }
      }
    } else if (trimmedLine.includes('x =')) {
      const coords = trimmedLine.match(/x = (\d+), y = (\d+)/);
      if (coords && currentSection) {
        const pos = { x: parseInt(coords[1]), y: parseInt(coords[2]) };
        currentArray.push(pos);
        if (currentSection === 'blueGems') config.blueGems = [...currentArray];
        if (currentSection === 'redGems') config.redGems = [...currentArray];
        if (currentSection === 'monsters') config.monsters = [...currentArray];
      }
    }
  }

  return config;
}

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